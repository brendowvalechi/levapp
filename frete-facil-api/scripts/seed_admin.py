"""
Cria o primeiro usuário administrador.

Uso:
    python scripts/seed_admin.py --email admin@fretefacil.com.br --password SenhaForte123

Se --email ou --password forem omitidos, serão lidos via input interativo.
"""
import asyncio
import argparse
import sys
from pathlib import Path

# Garante que o projeto esteja no path ao rodar fora do contexto do package
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.core.security import hash_password


async def create_admin(email: str, name: str, phone: str, password: str) -> None:
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == email))
        user = existing.scalar_one_or_none()

        if user:
            if user.is_admin:
                print(f"[!] Usuário {email} já é administrador.")
                return
            user.is_admin = True
            await db.commit()
            print(f"[✓] Usuário existente {email} promovido a administrador.")
            return

        admin = User(
            name=name,
            email=email,
            phone=phone,
            password_hash=hash_password(password),
            role=UserRole.client,
            is_admin=True,
            is_active=True,
            email_verified=True,
            phone_verified=True,
        )
        db.add(admin)
        await db.commit()
        print(f"[✓] Administrador criado: {email}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed do primeiro administrador")
    parser.add_argument("--email", default="")
    parser.add_argument("--name", default="Administrador")
    parser.add_argument("--phone", default="")
    parser.add_argument("--password", default="")
    args = parser.parse_args()

    email = args.email or input("Email: ").strip()
    phone = args.phone or input("Telefone (ex: 55349XXXXXXXX): ").strip()
    password = args.password or input("Senha: ").strip()
    name = args.name

    if not email or not phone or not password:
        print("[✗] Email, telefone e senha são obrigatórios.")
        sys.exit(1)

    asyncio.run(create_admin(email, name, phone, password))


if __name__ == "__main__":
    main()
