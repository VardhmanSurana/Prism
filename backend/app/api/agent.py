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

@router.post("/chat")
async def chat_with_agent(req: ChatRequest):
    # Convert Pydantic history to LangChain format if needed
    # For now, we'll just pass the raw message to keep it simple
    response = await Prism_agent.chat(req.message)
    return {"response": response}
