"""
Command-line tasks. From backend/:

    python -m app.cli seed-catalog     load or refresh the destinations, interests and places

More commands (create-admin, seed-demo) arrive with the steps that need them.
"""

import argparse
import asyncio

from app.db.session import SessionLocal, engine


async def _seed_catalog() -> None:
    from app.db.seed import seed_catalog

    async with SessionLocal() as session:
        counts = await seed_catalog(session)
    await engine.dispose()
    print(f"Catalog ready: {counts['destinations']} destinations, {counts['interests']} interests, {counts['places']} places.")


COMMANDS = {"seed-catalog": _seed_catalog}


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="TripMate backend tasks")
    parser.add_argument("command", choices=sorted(COMMANDS))
    args = parser.parse_args()
    asyncio.run(COMMANDS[args.command]())


if __name__ == "__main__":
    main()
