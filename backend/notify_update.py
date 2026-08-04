import asyncio
from app.services.sync_service import sync_service

async def notify():
    await sync_service.initialize() # Needed to setup clients etc if not already
    sync_service.broadcast({"type": "people_updated"})
    print("Broadcast sent")

if __name__ == "__main__":
    asyncio.run(notify())
