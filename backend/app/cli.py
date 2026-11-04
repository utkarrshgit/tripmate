"""
Command-line tasks. From backend/:

    python -m app.cli seed-catalog     load or refresh the destinations, interests and places
    python -m app.cli create-admin     make an admin account, or make an existing account an admin
    python -m app.cli seed-demo        make the demo account (demo@tripmate.local) with saved trips
    python -m app.cli demo-account     print the demo account's log-in
    python -m app.cli demo-prompts     print the demo prompts to type (run.sh shows these; --real adds the AI ones)
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


async def seed_demo(session) -> dict:
    """Starts the demo account over: an admin with three trips planned by rules (predictable), one changed in words."""
    from sqlalchemy import delete

    from app.core.security import hash_password
    from app.db import demo_data
    from app.llm.gateway import Gateway
    from app.models import User
    from app.services import reviser, saved_trips
    from app.services.auth_service import now
    from app.services.trip_service import trip_service

    account = demo_data.DEMO_ACCOUNT
    await session.execute(delete(User).where(User.email == account["email"]))
    user = User(name=account["name"], email=account["email"], password_hash=hash_password(account["password"]), role="admin", email_verified_at=now())
    session.add(user)
    await session.commit()
    first = None
    for index in demo_data.SAVED:
        prompt = demo_data.PROMPTS[index][0]
        start, end = demo_data.prompt_dates(index)
        plan = await trip_service.plan_trip(prompt, start_date=start, end_date=end, user_id=user.id, gateway=Gateway(enabled=False))
        trip = await saved_trips.create_trip(session, user, prompt, plan)
        first = first or trip
    await reviser.revise_trip(session, user, first["id"], demo_data.PROMPTS[demo_data.SAVED[0]][4][0], gateway=Gateway(enabled=False))
    return {"trips": len(demo_data.SAVED), "email": account["email"]}


async def _seed_demo() -> None:
    from app.db import demo_data

    async with SessionLocal() as session:
        await seed_demo(session)
    await engine.dispose()
    a = demo_data.DEMO_ACCOUNT
    print(f"Demo account ready: {a['email']} / {a['password']} (an admin, with {len(demo_data.SAVED)} saved trips)")


async def _demo_account() -> None:
    from app.db import demo_data

    a = demo_data.DEMO_ACCOUNT
    print(f"  Log in as {a['email']} / {a['password']}: an admin with saved trips, and AI activity in the account menu.")


async def _demo_prompts(real: bool = False) -> None:
    from app.db import demo_data

    if real:
        print("  With the AI models:")
        for prompt, notice in demo_data.AI_PROMPTS:
            print(f"   • {prompt}\n     {notice}")
        print(f"   • On a saved trip, Change it in words: {' · '.join(demo_data.AI_REVISIONS)}")
        print("  These also work, and show the pricing:")
    for n, (prompt, _, _, notice, follow_ups) in enumerate(demo_data.PROMPTS, 1):
        print(f"  {n}. {prompt}")
        print(f"     Notice: {notice}")
        print(f"     Then save it and try Change it in words: {' · '.join(follow_ups)}")
    print("  On Your trips, search: " + " · ".join(f"“{q}” ({what})" for q, what in demo_data.SEARCHES))


COMMANDS = {
    "seed-catalog": _seed_catalog,
    "create-admin": _create_admin,
    "seed-demo": _seed_demo,
    "demo-account": _demo_account,
    "demo-prompts": _demo_prompts,
}


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="TripMate backend tasks")
    parser.add_argument("command", choices=sorted(COMMANDS))
    parser.add_argument("--real", action="store_true", help="demo-prompts: include the prompts for the real AI models")
    args = parser.parse_args()
    command = COMMANDS[args.command]
    asyncio.run(command(real=args.real) if args.command == "demo-prompts" else command())


if __name__ == "__main__":
    main()
