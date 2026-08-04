import json
import logging
from typing import Any

from app.agent.router.registry import GLOBAL_TOOL_REGISTRY
from app.agent.router.types import AgentContext

logger = logging.getLogger(__name__)

class ToolNotAllowedError(Exception):
    pass

class ToolExecutionMiddleware:
    def __init__(self, search_tools):
        self.search_tools = search_tools
        self._execution_history = set()

    def _canonicalize_arguments(self, arguments: dict[str, Any]) -> str:
        # Create a stable string representation of arguments for duplicate detection
        def _sort_dict(d):
            if isinstance(d, dict):
                return {k: _sort_dict(v) for k, v in sorted(d.items())}
            if isinstance(d, list):
                return [_sort_dict(x) for x in d]
            return d
        return json.dumps(_sort_dict(arguments))

    def _enforce_allowlist(self, tool_name: str, context: AgentContext):
        if tool_name not in context.allowed_tool_names:
            logger.error(f"Tool '{tool_name}' blocked by allow-list. Allowed: {context.allowed_tool_names}")
            raise ToolNotAllowedError(tool_name)

    def _enforce_confirmation(self, tool_name: str, context: AgentContext):
        capability = GLOBAL_TOOL_REGISTRY.get(tool_name)
        if capability and (capability.destructive or capability.external_side_effect):
            # Simulated confirmation check: in a real system, you'd check context.confirmed_actions
            # or emit a confirmation request to the UI.
            # For Prism's current scope, this throws an exception to signal the UI flow.
            if tool_name not in context.confirmed_actions:
                logger.warning(f"Tool '{tool_name}' requires confirmation.")
                raise Exception(f"CONFIRMATION_REQUIRED: {tool_name}")

    def _check_duplicate(self, tool_name: str, arguments: dict[str, Any], context: AgentContext) -> bool:
        sig = f"{context.request_id}:{tool_name}:{self._canonicalize_arguments(arguments)}"
        if sig in self._execution_history:
            return True
        self._execution_history.add(sig)
        return False

    async def execute_tool(self, db, tool_name: str, arguments: dict[str, Any], context: AgentContext) -> list | set:
        """
        Executes a single tool step with middleware guardrails.
        """
        logger.info(f"Executing tool: {tool_name} with arguments: {arguments}")

        # 1. Check Allowlist
        self._enforce_allowlist(tool_name, context)

        # 2. Check Confirmation Policy
        self._enforce_confirmation(tool_name, context)

        # 3. Check Duplicate Execution within this request context
        if self._check_duplicate(tool_name, arguments, context):
            logger.info(f"Duplicate tool call suppressed: {tool_name}")
            return []

        # 4. Limit enforcement
        if context.tool_calls_used >= context.max_tool_calls:
            logger.warning(f"Maximum tool calls ({context.max_tool_calls}) exceeded.")
            return []

        context.tool_calls_used += 1

        # 5. Dispatch to SearchTools
        method = getattr(self.search_tools, tool_name, None)
        if not method:
            logger.error(f"Tool method not implemented on SearchTools: {tool_name}")
            raise NotImplementedError(f"Tool not implemented: {tool_name}")

        try:
            # Map common arguments. The dictionary keys must match the tool method signatures.
            # Note: We enforce 'ordered=False' for set-based intersections downstream if needed,
            # but search_tools methods currently return sets by default unless ordered=True.
            kwargs = {**arguments, "db": db}

            # The search methods expect 'is_locked' which we can extract from arguments if present

            if tool_name == "search_metadata":
                return await method(
                    db,
                    location=arguments.get("location"),
                    favorites=arguments.get("favorites"),
                    year=arguments.get("year"),
                    month=arguments.get("month"),
                    is_locked=arguments.get("is_locked", False)
                )
            elif tool_name == "search_people":
                return await method(
                    db,
                    names=arguments.get("names", []),
                    is_locked=arguments.get("is_locked", False)
                )
            elif tool_name == "search_captions":
                return await method(
                    db,
                    query=arguments.get("query", ""),
                    is_locked=arguments.get("is_locked", False)
                )
            elif tool_name == "semantic_search":
                return await method(
                    db,
                    text_query=arguments.get("query", ""),
                    top_k=arguments.get("top_k", 30),
                    is_locked=arguments.get("is_locked", False)
                )
            elif tool_name == "search_albums":
                return await method(
                    db,
                    query=arguments.get("query", ""),
                    is_locked=arguments.get("is_locked", False)
                )
            elif tool_name == "search_ocr":
                return await method(
                    db,
                    query=arguments.get("query", ""),
                    is_locked=arguments.get("is_locked", False)
                )
            elif tool_name == "similar_image":
                return await method(
                    db,
                    photo_id=arguments.get("photo_id"),
                    top_k=arguments.get("top_k", 30),
                    is_locked=arguments.get("is_locked", False)
                )
            elif tool_name == "search_events":
                return await method(
                    db,
                    query=arguments.get("query", ""),
                    is_locked=arguments.get("is_locked", False)
                )
            else:
                return await method(**kwargs)

        except Exception as e:
            logger.error(f"Execution failed for tool '{tool_name}': {e}")
            raise e
