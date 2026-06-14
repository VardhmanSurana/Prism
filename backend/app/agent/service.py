from app.agent.embeddings import EmbeddingClient
from app.agent.llm import LlamaManager
from app.agent.orchestrator import AgentOrchestrator
from app.agent.planner import Planner
from app.agent.search_tools import SearchTools


class PrismAgent:
    _llm = None

    def __init__(
        self,
        llm_manager: LlamaManager | None = None,
        embedding_client: EmbeddingClient | None = None,
        search_tools: SearchTools | None = None,
        planner: Planner | None = None,
        orchestrator: AgentOrchestrator | None = None,
    ):
        self.llm_manager = llm_manager or LlamaManager()
        self.embedding_client = embedding_client or EmbeddingClient()
        self.search_tools = search_tools or SearchTools(self.embedding_client)
        self.planner = planner or Planner(self.llm_manager)
        self.orchestrator = orchestrator or AgentOrchestrator(self.planner, self.search_tools)

    def get_llm(self):
        llm = self.llm_manager.get_llm()
        PrismAgent._llm = llm
        return llm

    @classmethod
    def unload_llm(cls):
        """Releases the LLM from GPU VRAM."""
        LlamaManager.unload_llm()
        cls._llm = None

    def heuristic_fallback(self, message: str) -> dict:
        return self.planner.heuristic_fallback(message)

    async def search_metadata(self, db, date_range=None, location=None, favorites=None, year=None, is_locked=False) -> set[int]:
        return await self.search_tools.search_metadata(
            db,
            date_range=date_range,
            location=location,
            favorites=favorites,
            year=year,
            is_locked=is_locked,
        )

    async def search_people(self, db, names: list[str], min_confidence=0.8) -> set[int]:
        return await self.search_tools.search_people(db, names=names, min_confidence=min_confidence)

    async def search_captions(self, db, query: str) -> set[int]:
        return await self.search_tools.search_captions(db, query=query)

    async def semantic_search(self, db, text_query: str, top_k=30, is_locked=False) -> set[int]:
        return await self.search_tools.semantic_search(db, text_query=text_query, top_k=top_k, is_locked=is_locked)

    async def search_albums(self, db, query: str) -> set[int]:
        return await self.search_tools.search_albums(db, query=query)

    async def search_ocr(self, db, query: str) -> set[int]:
        return await self.search_tools.search_ocr(db, query=query)

    async def similar_image(self, db, photo_id: int, top_k=30) -> set[int]:
        return await self.search_tools.similar_image(db, photo_id=photo_id, top_k=top_k)

    def extract_search_parameters(self, message: str, history: list = None) -> dict:
        return self.planner.extract_search_parameters(message, history=history)

    def verify_photos_match(self, query: str, photos_metadata: list) -> list:
        return self.planner.verify_photos_match(query, photos_metadata)

    def reformulate_search(self, query: str, previous_plan: dict, history: list = None) -> dict:
        return self.planner.reformulate_search(query, previous_plan, history=history)

    def generate_chat_response(self, message: str, photos: list) -> str:
        return self.planner.generate_chat_response(message, photos)

    def get_query_embedding(self, query: str) -> list[float] | None:
        return self.embedding_client.get_query_embedding(query)

    async def chat(self, message: str, history: list = None):
        return await self.orchestrator.chat(message, history=history)


Prism_agent = PrismAgent()
