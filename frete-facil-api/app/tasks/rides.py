import asyncio
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.rides.notify_nearby_drivers", bind=True, max_retries=2)
def notify_nearby_drivers(self, ride_id: str):
    """Find nearby online drivers and send push notification about new ride."""
    try:
        asyncio.run(_notify(ride_id))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)


async def _notify(ride_id: str):
    from app.database import AsyncSessionLocal
    from app.models.ride import Ride, RideStatus
    from app.models.user import User, VerificationStatus
    from app.services.rides import get_nearby_driver_ids
    from app.tasks.notifications import send_push_notification
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    import uuid

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Ride).where(Ride.id == uuid.UUID(ride_id)))
        ride = result.scalar_one_or_none()
        if not ride or ride.status != RideStatus.open:
            return

        nearby_profile_ids = await get_nearby_driver_ids(ride.origin_lat, ride.origin_lng)
        if not nearby_profile_ids:
            return

        # Fetch FCM tokens for nearby online approved drivers
        from app.models.user import DriverProfile
        profiles_result = await db.execute(
            select(DriverProfile)
            .options(selectinload(DriverProfile.user))
            .where(
                DriverProfile.id.in_([uuid.UUID(p) for p in nearby_profile_ids]),
                DriverProfile.is_online == True,
                DriverProfile.verification_status == VerificationStatus.approved,
            )
        )
        profiles = profiles_result.scalars().all()
        for profile in profiles:
            if profile.user and profile.user.fcm_token:
                send_push_notification.delay(
                    token=profile.user.fcm_token,
                    title="Nova corrida disponível!",
                    body=f"{ride.origin_address} → {ride.destination_address}",
                    data={"ride_id": ride_id, "type": "new_ride"},
                )


@celery_app.task(name="app.tasks.rides.expire_open_ride")
def expire_open_ride(ride_id: str):
    """Mark ride as expired if still open after timeout."""
    asyncio.run(_expire(ride_id))


async def _expire(ride_id: str):
    from app.database import AsyncSessionLocal
    from app.models.ride import Ride, RideStatus
    from sqlalchemy import select
    import uuid

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Ride).where(Ride.id == uuid.UUID(ride_id)))
        ride = result.scalar_one_or_none()
        if ride and ride.status == RideStatus.open:
            ride.status = RideStatus.expired
            await db.commit()
