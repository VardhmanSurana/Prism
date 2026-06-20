# Fix empty tag extraction in vision pipeline

## Root cause
`generate_tags_json()` in `backend/app/services/image_summary/llm.py:120-124` passes `response_format={"type": "json_object"}` to the Gemma-4-E2B GGUF server (`llama-server`). Some GGUF backends cannot reliably produce strict `json_object` mode and return an empty `content` string, causing `json.loads("")` to throw (line 137) — caught and silently degraded to `[]`.

## Changes

### 1. `backend/app/services/image_summary/llm.py` — `generate_tags_json()`
- Remove `response_format={"type": "json_object"}` from the request (Gemma GGUF via llama-server doesn't reliably support it).
- After stripping fenced code blocks, if `content` is still empty or doesn't contain a JSON object, fall back to regex-extracting any JSON array from the raw text: `re.findall(r'\[.*?\]', content, re.DOTALL)[-1]`.
- Add an explicit guard before `json.loads`: if content is empty after cleanup, return `[]` with a warning log instead of raising.
- Failure path stays the same (return `[]`), but logs are more informative.

### 2. `backend/tests/test_vision_pipeline.py` — keep existing tests passing
- No test changes needed unless a new random-tag-extraction unit test is desired (optional, non-blocking).

## Risk / Impact
- Minimal: only changes tag parsing; summaries and embeddings are unaffected.
- Positive: auto_tags will populate instead of silently staying `NULL`.
