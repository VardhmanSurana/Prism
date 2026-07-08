from fastapi import Request
from fastapi.responses import JSONResponse


async def root():
    return {"message": "Welcome to Prism Photos API"}


async def health_check():
    return {"status": "healthy"}
