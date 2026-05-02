import random
import string
from redis.asyncio import Redis

OTP_TTL_SECONDS = 600  # 10 minutes
OTP_MAX_ATTEMPTS = 5
_KEY_PREFIX = "otp:"
_ATTEMPTS_PREFIX = "otp_attempts:"


def _key(phone: str) -> str:
    return f"{_KEY_PREFIX}{phone}"


def _attempts_key(phone: str) -> str:
    return f"{_ATTEMPTS_PREFIX}{phone}"


def _generate_code() -> str:
    return "".join(random.choices(string.digits, k=6))


async def create_otp(redis: Redis, phone: str) -> str:
    code = _generate_code()
    await redis.set(_key(phone), code, ex=OTP_TTL_SECONDS)
    await redis.delete(_attempts_key(phone))
    return code


async def verify_otp(redis: Redis, phone: str, code: str) -> bool:
    attempts_key = _attempts_key(phone)
    attempts = await redis.incr(attempts_key)
    await redis.expire(attempts_key, OTP_TTL_SECONDS)

    if attempts > OTP_MAX_ATTEMPTS:
        return False

    stored = await redis.get(_key(phone))
    if stored and stored == code:
        await redis.delete(_key(phone))
        await redis.delete(attempts_key)
        return True
    return False


async def send_otp_sms(phone: str, code: str) -> None:
    """Send OTP via SMS. Logs in dev; integrate Zenvia/Twilio in production."""
    from app.core.config import settings
    import logging

    logger = logging.getLogger(__name__)

    if settings.is_development:
        logger.info(f"[DEV] OTP para {phone}: {code}")
        return

    # TODO: integrate Zenvia
    # from app.integrations.zenvia import send_sms
    # await send_sms(phone, f"Seu código Levapp: {code}. Válido por 10 minutos.")
