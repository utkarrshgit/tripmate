"""
Command-line tasks. From backend/:

    python -m app.cli seed-catalog     load or refresh the destinations, interests and places
    python -m app.cli create-admin     make an admin account, or make an existing account an admin

seed-demo arrives with the step that needs it.
"""

import argparse
import asyncio
import getpass

from app.db.session import SessionLocal, engine


async def _seed_catalog() -> None:
    from app.db.seed import seed_catalog

    async with SessionLocal() as session:
        counts = await seed_catalog(session)
    await engine.dispose()
    print(f"Catalog ready: {counts['destinations']} destinations, {counts['interests']} interests, {counts['places']} places.")


async def _create_admin() -> None:
    from sqlalchemy import select

    from app.core.security import hash_password, password_problem
    from app.models import User
    from app.services.auth_service import check_email, now

    email = check_email(input("Email: "))
    async with SessionLocal() as session:
        user = await session.scalar(select(User).where(User.email == email))
        if user:
            user.role, user.email_verified_at, user.disabled_at = "admin", user.email_verified_at or now(), None
            print(f"{email} is now an admin.")
        else:
            name = input("Name: ").strip() or "Admin"
            password = getpass.getpass("Password: ")
            if problem := password_problem(password, email):
                raise SystemExit(problem)
            session.add(User(name=name, email=email, password_hash=hash_password(password), role="admin", email_verified_at=now()))
            print(f"Admin account created for {email}.")
        await session.commit()
    await engine.dispose()


COMMANDS = {"seed-catalog": _seed_catalog, "create-admin": _create_admin}


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="TripMate backend tasks")
    parser.add_argument("command", choices=sorted(COMMANDS))
    args = parser.parse_args()
    asyncio.run(COMMANDS[args.command]())


if __name__ == "__main__":
    main()
