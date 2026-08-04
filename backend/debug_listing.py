import asyncio
from app.db import async_session
from app.models import Photo
from sqlalchemy.future import select
from sqlalchemy import or_, and_

async def check_listing():
    active_mounts = ["/", "/home", "/boot", "/boot/efi"] # simulation
    async with async_session() as db:
        # Check counts
        total_internal = await db.execute(select(Photo).where(Photo.is_external == False))
        print(f"Total internal: {len(total_internal.scalars().all())}")
        
        # Check visibility
        stmt = select(Photo).where(
            and_(
                Photo.is_trash == False,
                or_(
                    Photo.is_external == False,
                    Photo.device_id.in_(active_mounts)
                )
            )
        )
        res = await db.execute(stmt)
        photos = res.scalars().all()
        print(f"Total visible: {len(photos)}")
        for p in photos:
            print(f"ID: {p.id}, Path: {p.path}, External: {p.is_external}, Device: {p.device_id}")

if __name__ == "__main__":
    asyncio.run(check_listing())


