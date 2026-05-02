import uuid
from app.core.security import hash_password
from app.models.user import User, UserRole


def make_user(**kwargs) -> dict:
    defaults = {
        "id": uuid.uuid4(),
        "name": "João Teste",
        "email": f"joao_{uuid.uuid4().hex[:6]}@teste.com",
        "phone": f"3499{uuid.uuid4().hex[:7]}",
        "password_hash": hash_password("senha123"),
        "role": UserRole.client,
        "is_active": True,
        "email_verified": False,
        "phone_verified": False,
    }
    defaults.update(kwargs)
    return defaults
