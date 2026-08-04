import json
import logging
import re
from typing import Any

from app.agent.llm import LlamaManager
from app.agent.router.registry import GLOBAL_TOOL_REGISTRY
from app.agent.router.types import Intent, RouteDecision

logger = logging.getLogger(__name__)

MAX_TOOLS = {
    Intent.CONVERSATION: 0,
    Intent.PHOTO_SEARCH: 2,
    Intent.PHOTO_METADATA: 1,
    Intent.PHOTO_EDITING: 2,
    Intent.VIDEO_EDITING: 3,
    Intent.PHOTO_ORGANIZATION: 3,
    Intent.LIBRARY_MAINTENANCE: 3,
    Intent.MULTI_STEP_TASK: 6,
    Intent.UNKNOWN: 0,
}

class AgentRouter:
    def __init__(self, llm_manager: LlamaManager | None = None):
        self.llm_manager = llm_manager or LlamaManager()

    def route_request(self, message: str, history: list = None) -> RouteDecision:
        """
        Two-stage routing:
        1. Fast deterministic pre-router.
        2. LLM-based intent classification for ambiguous queries.
        """
        # Stage A: Deterministic
        decision = self._deterministic_route(message)
        if decision:
            logger.info(f"Deterministic router decision: {decision.intent.value} (tools: {decision.needs_tools})")
            return self._enforce_minimum_tools(decision)

        # Stage B: LLM Classifier
        logger.info("Falling back to LLM intent classification.")
        decision = self._llm_route(message, history)
        return self._enforce_minimum_tools(decision)

    def _deterministic_route(self, message: str) -> RouteDecision | None:
        msg_lower = message.lower().strip()

        # 1. Direct Response / Conversation
        greetings = {"hello", "hi", "hey", "how are you", "what can you do", "help"}
        if msg_lower in greetings or len(msg_lower.split()) < 3 and any(w in msg_lower for w in greetings):
            return RouteDecision(
                intent=Intent.CONVERSATION,
                needs_tools=False,
                confidence=1.0,
                selected_tool_names=[],
                required_inputs=[],
                requires_confirmation=False,
                rationale="Matched conversational greeting.",
                max_steps=0,
            )

        edit_advice = ["how do i", "can you explain", "what is the difference"]
        if any(msg_lower.startswith(prefix) for prefix in edit_advice):
            return RouteDecision(
                intent=Intent.CONVERSATION,
                needs_tools=False,
                confidence=0.9,
                selected_tool_names=[],
                required_inputs=[],
                requires_confirmation=False,
                rationale="Matched general explanation/advice request.",
                max_steps=0,
            )

        # 2. Basic Single-Tool Routing
        if "metadata" in msg_lower or "details for this photo" in msg_lower:
            return RouteDecision(
                intent=Intent.PHOTO_METADATA,
                needs_tools=True,
                confidence=0.8,
                selected_tool_names=["search_metadata"],
                required_inputs=[],
                requires_confirmation=False,
                rationale="Matched metadata keyword.",
                max_steps=1,
            )

        if msg_lower.startswith("find my") or msg_lower.startswith("show me"):
            # A simple heuristic: if it looks like a simple search, default to semantic
            return RouteDecision(
                intent=Intent.PHOTO_SEARCH,
                needs_tools=True,
                confidence=0.7,
                selected_tool_names=["semantic_search", "search_metadata"],
                required_inputs=["text_query"],
                requires_confirmation=False,
                rationale="Matched search keyword.",
                max_steps=2,
            )

        return None

    def _parse_json_robustly(self, output_text: str) -> dict:
        text = output_text.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()

        try:
            return json.loads(text)
        except Exception:
            pass

        try:
            start_idx = text.find("{")
            end_idx = text.rfind("}")
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                candidate = text[start_idx:end_idx + 1]
                return json.loads(candidate)
        except Exception:
            pass

        raise ValueError("Could not parse valid JSON from LLM output")

    def _llm_route(self, message: str, history: list = None) -> RouteDecision:
        llm = self.llm_manager.get_llm()

        tool_summaries = []
        for name, cap in GLOBAL_TOOL_REGISTRY.items():
            tool_summaries.append(f"- {name}: {cap.description} (Cost: {cap.estimated_cost})")
        tools_str = "\n".join(tool_summaries)

        intent_list = [i.value for i in Intent]

        prompt = (
            "<start_of_turn>user\n"
            "You are the intent router for Prism Photos. Your job is to classify the user's request and determine if tools are needed.\n"
            "Output a JSON object matching the RouteDecision schema.\n\n"
            "Available Intents:\n"
            f"{', '.join(intent_list)}\n\n"
            "Available Tools:\n"
            f"{tools_str}\n\n"
            "Rules:\n"
            "- If the request can be answered directly without looking up data, set needs_tools=false and selected_tool_names=[].\n"
            "- Select the absolute minimum number of tools required.\n"
            "- Destructive actions or actions affecting multiple items require confirmation (requires_confirmation=true).\n\n"
            "JSON Schema:\n"
            "{\n"
            "  \"intent\": \"string\",\n"
            "  \"needs_tools\": boolean,\n"
            "  \"confidence\": float (0.0 to 1.0),\n"
            "  \"selected_tool_names\": [\"tool_name1\"],\n"
            "  \"required_inputs\": [\"input_name\"],\n"
            "  \"requires_confirmation\": boolean,\n"
            "  \"rationale\": \"string explaining choice\"\n"
            "}\n\n"
            f"User request: \"{message}\"\n\n"
            "JSON response:\n"
            "<end_of_turn>\n"
            "<start_of_turn>model\n"
        )

        try:
            res = llm(
                prompt,
                max_tokens=250,
                temperature=0.1,
                top_p=0.95,
                top_k=64,
                stop=["<end_of_turn>"],
            )
            output_text = res["choices"][0]["text"].strip()
            data = self._parse_json_robustly(output_text)

            intent_str = data.get("intent", "unknown")
            try:
                intent = Intent(intent_str)
            except ValueError:
                intent = Intent.UNKNOWN

            return RouteDecision(
                intent=intent,
                needs_tools=bool(data.get("needs_tools", False)),
                confidence=float(data.get("confidence", 0.0)),
                selected_tool_names=[str(t) for t in data.get("selected_tool_names", [])],
                required_inputs=[str(i) for i in data.get("required_inputs", [])],
                requires_confirmation=bool(data.get("requires_confirmation", False)),
                rationale=str(data.get("rationale", "")),
                max_steps=MAX_TOOLS.get(intent, 0)
            )

        except Exception as e:
            logger.error(f"Error in LLM routing: {e}")
            return RouteDecision(
                intent=Intent.UNKNOWN,
                needs_tools=False,
                confidence=0.0,
                selected_tool_names=[],
                required_inputs=[],
                requires_confirmation=False,
                rationale="Fallback due to routing error.",
                max_steps=0
            )

    def _enforce_minimum_tools(self, decision: RouteDecision) -> RouteDecision:
        max_allowed = MAX_TOOLS.get(decision.intent, 0)

        if not decision.needs_tools:
            decision.selected_tool_names = []
            decision.max_steps = 0
            return decision

        # Filter selected tools against registry and constraints
        valid_tools = []
        for t in decision.selected_tool_names:
            if t in GLOBAL_TOOL_REGISTRY:
                cap = GLOBAL_TOOL_REGISTRY[t]
                if decision.intent in cap.intents or decision.intent == Intent.MULTI_STEP_TASK:
                    valid_tools.append(t)

        # Apply strict limits
        if len(valid_tools) > max_allowed:
            valid_tools = valid_tools[:max_allowed]

        decision.selected_tool_names = valid_tools
        decision.max_steps = max_allowed
        return decision
