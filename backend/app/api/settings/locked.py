"""Locked folder settings endpoints."""
from fastapi import APIRouter, HTTPException
from .schemas import LockedSetupRequest

router = APIRouter()


def check_password_strength(password: str) -> dict:
    feedback = []
    score = 0
    if len(password) >= 8:
        score += 1
    if len(password) >= 12:
        score += 1
    else:
        feedback.append("Password is too short (should be at least 12 characters)")
    
    if any(c.isupper() for c in password):
        score += 1
    else:
        feedback.append("Add at least one uppercase letter")
        
    if any(c.islower() for c in password):
        score += 1
    else:
        feedback.append("Add at least one lowercase letter")
        
    if any(c.isdigit() for c in password):
        score += 1
    else:
        feedback.append("Add at least one number")
        
    if any(c in "!@#$%^&*()-_=+[]{}|;:',.<>?/`~" for c in password):
        score += 1
    else:
        feedback.append("Add at least one special character")
        
    return {
        "score": score,  # 0 to 6
        "strength": "weak" if score < 3 else "medium" if score < 5 else "strong",
        "feedback": feedback
    }


@router.get("/locked-folder/status")
async def get_locked_folder_status():
    from app.services.locked_service import locked_service
    return {
        "is_configured": locked_service.is_password_set(),
        "is_authenticated": locked_service.is_authenticated
    }


@router.post("/locked-folder/setup")
async def setup_locked_folder(req: LockedSetupRequest):
    if len(req.password) < 12:
        raise HTTPException(status_code=400, detail="Password must be at least 12 characters long")
        
    strength = check_password_strength(req.password)
    if strength["strength"] == "weak":
        raise HTTPException(
            status_code=400, 
            detail=f"Password is too weak. Feedback: {', '.join(strength['feedback'])}"
        )

    from app.services.locked_service import locked_service
    success = await locked_service.setup_password(req.password)
    return {"success": success}


@router.post("/locked-folder/verify")
async def verify_locked_folder(req: LockedSetupRequest):
    from app.services.locked_service import locked_service
    success = await locked_service.verify_password(req.password)
    return {"success": success}


@router.post("/locked-folder/lock-session")
async def lock_locked_folder_session():
    from app.services.locked_service import locked_service
    locked_service.lock_session()
    return {"success": True}

