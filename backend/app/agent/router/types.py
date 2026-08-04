from dataclasses import dataclass
from enum import Enum
from typing import Any, Literal


class Intent(str, Enum):
    CONVERSATION = "conversation"
    PHOTO_SEARCH = "photo_search"
    PHOTO_METADATA = "photo_metadata"
    PHOTO_ORGANIZATION = "photo_organization"
    PHOTO_EDITING = "photo_editing"
    VIDEO_EDITING = "video_editing"
    IMPORT_EXPORT = "import_export"
    LIBRARY_MAINTENANCE = "library_maintenance"
    SETTINGS = "settings"
    MULTI_STEP_TASK = "multi_step_task"
    UNKNOWN = "unknown"


@dataclass
class RouteDecision:
    intent: Intent
    needs_tools: bool
    confidence: float
    selected_tool_names: list[str]
    required_inputs: list[str]
    requires_confirmation: bool
    rationale: str
    max_steps: int = 5


@dataclass(frozen=True)
class ToolCapability:
    name: str
    intents: set[Intent]
    description: str
    required_inputs: set[str]
    optional_inputs: set[str]
    read_only: bool
    destructive: bool
    external_side_effect: bool
    estimated_cost: Literal["low", "medium", "high"]
    supports_batch: bool
    idempotent: bool
    timeout_seconds: int = 30


@dataclass
class ToolStep:
    tool_name: str
    arguments: dict[str, Any]
    depends_on: list[int]
    purpose: str


@dataclass
class ToolPlan:
    steps: list[ToolStep]
    final_response_mode: Literal["answer", "action_result", "clarification"]


@dataclass
class AgentContext:
    request_id: str
    intent: Intent
    allowed_tool_names: set[str]
    tool_calls_used: int
    max_tool_calls: int
    confirmed_actions: set[str]
    known_asset_ids: set[str]
    cancellation_token: Any
    route: RouteDecision | None = None
