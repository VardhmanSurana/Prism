from fastapi import APIRouter, Body
from app.agent.service import Prism_agent
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

from fastapi.responses import StreamingResponse
import json

@router.post("/chat")
async def chat_with_agent(req: ChatRequest):
    history_dicts = [{"role": h.role, "content": h.content} for h in req.history] if req.history else []
    
    async def event_generator():
        async for event in Prism_agent.chat_stream(req.message, history=history_dicts):
            yield json.dumps(event) + "\n"
            
    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

@router.post("/preload")
async def preload_agent():
    """Predictive preload of the agent model to GPU."""
    try:
        # get_llm triggers the mutual exclusion and GPU load
        Prism_agent.get_llm()
        return {"status": "ok", "message": "Agent preloaded to GPU"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
