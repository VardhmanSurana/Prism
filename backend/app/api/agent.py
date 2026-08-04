import uuid
import json
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.agent.service import Prism_agent
from app.config import settings
from app.db import get_db
from app.models import AgentSession, AgentMessage
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    session_id: Optional[str] = None
    image_path: Optional[str] = None


class CreateSessionRequest(BaseModel):
    title: Optional[str] = "New Chat"


class UpdateSessionRequest(BaseModel):
    title: str


@router.get("/sessions")
async def list_sessions(db: AsyncSession = Depends(get_db)):
    if not settings.ENABLE_AI_AGENT:
        raise HTTPException(status_code=400, detail="AI Agent is disabled in settings.")
    stmt = select(AgentSession).order_by(AgentSession.updated_at.desc())
    res = await db.execute(stmt)
    sessions = res.scalars().all()
    return [
        {
            "id": s.id,
            "title": s.title,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s in sessions
    ]


@router.post("/sessions")
async def create_session(
    req: CreateSessionRequest = Body(CreateSessionRequest()),
    db: AsyncSession = Depends(get_db)
):
    if not settings.ENABLE_AI_AGENT:
        raise HTTPException(status_code=400, detail="AI Agent is disabled in settings.")
    session_id = str(uuid.uuid4())
    title = req.title.strip() if req.title and req.title.strip() else "New Chat"
    session = AgentSession(id=session_id, title=title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
    }


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    if not settings.ENABLE_AI_AGENT:
        raise HTTPException(status_code=400, detail="AI Agent is disabled in settings.")
    stmt = select(AgentSession).where(AgentSession.id == session_id).options(selectinload(AgentSession.messages))
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = []
    for m in session.messages:
        msg_dict = {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        if m.photos_json:
            try:
                msg_dict["photos"] = json.loads(m.photos_json)
            except Exception:
                msg_dict["photos"] = []
        if m.plan_json:
            try:
                msg_dict["plan"] = json.loads(m.plan_json)
            except Exception:
                pass
        if m.tools_json:
            try:
                msg_dict["tools"] = json.loads(m.tools_json)
            except Exception:
                pass
        if m.total_candidates is not None:
            msg_dict["totalCandidates"] = m.total_candidates
        messages.append(msg_dict)

    return {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
        "messages": messages,
    }


@router.patch("/sessions/{session_id}")
async def update_session(session_id: str, req: UpdateSessionRequest, db: AsyncSession = Depends(get_db)):
    if not settings.ENABLE_AI_AGENT:
        raise HTTPException(status_code=400, detail="AI Agent is disabled in settings.")
    stmt = select(AgentSession).where(AgentSession.id == session_id)
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if req.title and req.title.strip():
        session.title = req.title.strip()
        session.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(session)

    return {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
    }


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    if not settings.ENABLE_AI_AGENT:
        raise HTTPException(status_code=400, detail="AI Agent is disabled in settings.")
    stmt = select(AgentSession).where(AgentSession.id == session_id)
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.delete(session)
    await db.commit()
    return {"status": "ok", "message": "Session deleted"}


async def _load_session_history(session_id: str, db: AsyncSession, limit: int = 20) -> list[dict]:
    """
    Load conversation history from the database for a given session.
    Returns the last `limit` messages in chronological order.
    """
    if not session_id:
        return []

    stmt = (
        select(AgentMessage)
        .where(AgentMessage.session_id == session_id)
        .order_by(AgentMessage.id.desc())
        .limit(limit)
    )
    res = await db.execute(stmt)
    messages = list(reversed(res.scalars().all()))

    if not messages:
        return []

    return [{"role": m.role, "content": m.content} for m in messages]


@router.post("/chat")
async def chat_with_agent(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    if not settings.ENABLE_AI_AGENT:
        raise HTTPException(status_code=400, detail="AI Agent is disabled in settings.")

    session_id = req.session_id

    if session_id:
        stmt = select(AgentSession).where(AgentSession.id == session_id)
        res = await db.execute(stmt)
        session = res.scalar_one_or_none()
        if not session:
            session = AgentSession(id=session_id, title="New Chat")
            db.add(session)
            await db.commit()

        # Save user message
        user_msg = AgentMessage(
            session_id=session_id,
            role="user",
            content=req.message,
        )
        db.add(user_msg)

        # Update session title if it's "New Chat"
        if session.title == "New Chat" and req.message.strip():
            auto_title = req.message.strip()
            if len(auto_title) > 30:
                auto_title = auto_title[:30] + "..."
            session.title = auto_title

        session.updated_at = datetime.now(timezone.utc)
        await db.commit()

    if session_id:
        db_history = await _load_session_history(session_id, db)
    else:
        db_history = []

    if db_history:
        history_dicts = db_history
    else:
        history_dicts = [{"role": h.role, "content": h.content} for h in req.history] if req.history else []


    async def event_generator():
        last_result = None
        last_plan = None
        last_tools = None
        last_total_candidates = None

        try:
            async for event in Prism_agent.chat_stream(req.message, history=history_dicts, image_path=req.image_path):
                if event.get("type") == "progress":
                    if event.get("plan"):
                        last_plan = event.get("plan")
                    if event.get("tools"):
                        last_tools = event.get("tools")
                    if event.get("total_candidates") is not None:
                        last_total_candidates = event.get("total_candidates")
                elif event.get("type") == "result":
                    last_result = event

                yield json.dumps(event) + "\n"

            if session_id and last_result:
                from app.db import async_session
                async with async_session() as async_db:
                    assistant_msg = AgentMessage(
                        session_id=session_id,
                        role="assistant",
                        content=last_result.get("text", ""),
                        photos_json=json.dumps(last_result.get("photos", [])) if last_result.get("photos") else None,
                        plan_json=json.dumps(last_plan) if last_plan else None,
                        tools_json=json.dumps(last_tools) if last_tools else None,
                        total_candidates=last_total_candidates,
                    )
                    async_db.add(assistant_msg)

                    sess_stmt = select(AgentSession).where(AgentSession.id == session_id)
                    sess_res = await async_db.execute(sess_stmt)
                    sess = sess_res.scalar_one_or_none()
                    if sess:
                        sess.updated_at = datetime.now(timezone.utc)
                    await async_db.commit()

        finally:
            try:
                Prism_agent.schedule_unload()
            except Exception:
                try:
                    from app.services.vision_pipeline import unload_models
                    Prism_agent.unload_llm()
                    unload_models()
                except Exception:
                    pass

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")


from fastapi import UploadFile, File

@router.post("/upload_image")
async def upload_agent_image(file: UploadFile = File(...)):
    if not settings.ENABLE_AI_AGENT:
        raise HTTPException(status_code=400, detail="AI Agent is disabled in settings.")

    import os
    from pathlib import Path

    uploads_dir = Path(settings.BASE_DIR) / "data" / "agent_uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    ext = os.path.splitext(file.filename)[1].lower() or ".jpg"
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    target_path = uploads_dir / unique_filename

    contents = await file.read()
    with open(target_path, "wb") as f:
        f.write(contents)

    return {
        "status": "ok",
        "image_path": str(target_path.absolute()),
        "image_url": f"/api/v1/agent/uploads/{unique_filename}",
        "filename": file.filename
    }


@router.get("/uploads/{filename}")
async def serve_agent_upload(filename: str):
    from fastapi.responses import FileResponse
    from pathlib import Path
    uploads_dir = Path(settings.BASE_DIR) / "data" / "agent_uploads"
    target = uploads_dir / filename
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(target))


@router.post("/preload")
async def preload_agent():
    if not settings.ENABLE_AI_AGENT:
        raise HTTPException(status_code=400, detail="AI Agent is disabled in settings.")
    try:
        Prism_agent.get_llm()
        return {"status": "ok", "message": "Agent preloaded to GPU"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
