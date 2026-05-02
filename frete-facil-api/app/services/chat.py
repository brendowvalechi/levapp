from __future__ import annotations
import uuid
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message
from app.models.ride import Ride, Offer, RideStatus, OfferStatus
from app.models.user import User


async def _assert_participant(db: AsyncSession, user: User, ride_id: uuid.UUID) -> Ride:
    """Ensure user is either the client or the accepted driver for this ride."""
    result = await db.execute(
        select(Ride).where(Ride.id == ride_id, Ride.deleted_at.is_(None))
    )
    ride = result.scalar_one_or_none()
    if not ride:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corrida não encontrada")

    if ride.status not in (RideStatus.matched, RideStatus.in_progress, RideStatus.completed):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Chat disponível apenas para corridas com motorista aceito",
        )

    is_client = ride.client_id == user.id

    is_driver = False
    if ride.accepted_offer_id:
        offer_result = await db.execute(
            select(Offer).where(Offer.id == ride.accepted_offer_id)
        )
        offer = offer_result.scalar_one_or_none()
        is_driver = offer is not None and offer.driver_id == user.id

    if not is_client and not is_driver:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")

    return ride


async def save_message(
    db: AsyncSession, sender: User, ride_id: uuid.UUID, content: str
) -> Message:
    ride = await _assert_participant(db, sender, ride_id)
    msg = Message(ride_id=ride_id, sender_id=sender.id, content=content.strip())
    db.add(msg)
    await db.commit()
    await db.refresh(msg, ["sender"])

    # Notify the other participant
    from app.models.ride import Offer
    from app.tasks.notifications import send_push_to_user
    if ride.accepted_offer_id:
        offer_res = await db.execute(
            select(Offer).where(Offer.id == ride.accepted_offer_id)
        )
        offer = offer_res.scalar_one_or_none()
        recipient_id = (
            str(ride.client_id) if offer and offer.driver_id == sender.id
            else str(offer.driver_id) if offer else None
        )
        if recipient_id and recipient_id != str(sender.id):
            preview = content[:80] + ("…" if len(content) > 80 else "")
            send_push_to_user.delay(
                recipient_id,
                sender.name,
                preview,
                {"type": "new_message", "ride_id": str(ride_id)},
            )

    return msg


async def get_messages(
    db: AsyncSession,
    user: User,
    ride_id: uuid.UUID,
    limit: int = 50,
    before_id: Optional[uuid.UUID] = None,
) -> list[Message]:
    await _assert_participant(db, user, ride_id)
    q = (
        select(Message)
        .options(selectinload(Message.sender))
        .where(Message.ride_id == ride_id)
        .order_by(Message.created_at.asc())
        .limit(limit)
    )
    if before_id:
        sub = select(Message.created_at).where(Message.id == before_id).scalar_subquery()
        q = q.where(Message.created_at < sub)
    result = await db.execute(q)
    return list(result.scalars().all())


async def mark_read(db: AsyncSession, user: User, ride_id: uuid.UUID) -> int:
    """Mark all unread messages NOT sent by current user as read. Returns count."""
    result = await db.execute(
        select(Message).where(
            Message.ride_id == ride_id,
            Message.sender_id != user.id,
            Message.is_read == False,
        )
    )
    msgs = result.scalars().all()
    for m in msgs:
        m.is_read = True
    await db.commit()
    return len(msgs)


async def list_conversations(db: AsyncSession, user: User) -> list[dict]:
    """
    Return list of matched/in_progress rides where the user is participant,
    with last message and unread count.
    """
    # Rides where user is client
    client_rides_q = select(Ride).where(
        Ride.client_id == user.id,
        Ride.status.in_([RideStatus.matched, RideStatus.in_progress, RideStatus.completed]),
        Ride.deleted_at.is_(None),
        Ride.accepted_offer_id.isnot(None),
    )
    client_result = await db.execute(client_rides_q)
    client_rides = client_result.scalars().all()

    # Rides where user is the accepted driver
    driver_offers_q = (
        select(Offer)
        .where(Offer.driver_id == user.id, Offer.status == OfferStatus.accepted)
    )
    driver_result = await db.execute(driver_offers_q)
    accepted_offers = driver_result.scalars().all()

    driver_ride_ids = [o.ride_id for o in accepted_offers]
    driver_rides_result = await db.execute(
        select(Ride).where(
            Ride.id.in_(driver_ride_ids),
            Ride.status.in_([RideStatus.matched, RideStatus.in_progress, RideStatus.completed]),
            Ride.deleted_at.is_(None),
        )
    )
    driver_rides = driver_rides_result.scalars().all()

    all_rides = {r.id: r for r in [*client_rides, *driver_rides]}

    conversations = []
    for ride in all_rides.values():
        # Last message
        last_msg_result = await db.execute(
            select(Message)
            .where(Message.ride_id == ride.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_msg = last_msg_result.scalar_one_or_none()

        # Unread count
        unread_result = await db.execute(
            select(func.count(Message.id)).where(
                Message.ride_id == ride.id,
                Message.sender_id != user.id,
                Message.is_read == False,
            )
        )
        unread_count = unread_result.scalar_one()

        # Other participant
        other_user_id: uuid.UUID
        other_user_name: str
        if ride.client_id == user.id:
            # Find driver
            if ride.accepted_offer_id:
                offer_res = await db.execute(
                    select(Offer).options(selectinload(Offer.driver)).where(Offer.id == ride.accepted_offer_id)
                )
                offer = offer_res.scalar_one_or_none()
                other_user_id = offer.driver_id if offer else ride.client_id
                other_user_name = offer.driver.name if offer and offer.driver else "Motorista"
            else:
                continue
        else:
            # Current user is driver, other is client
            client_res = await db.execute(select(User).where(User.id == ride.client_id))
            client = client_res.scalar_one_or_none()
            other_user_id = ride.client_id
            other_user_name = client.name if client else "Cliente"

        conversations.append({
            "ride_id": ride.id,
            "other_user_id": other_user_id,
            "other_user_name": other_user_name,
            "last_message": last_msg.content if last_msg else None,
            "last_message_at": last_msg.created_at if last_msg else None,
            "unread_count": unread_count,
        })

    conversations.sort(key=lambda c: c["last_message_at"] or c["ride_id"], reverse=True)
    return conversations
