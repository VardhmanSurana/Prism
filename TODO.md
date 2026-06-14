# TODO — Face detection & clustering backend understanding/improvements

## Step 1: Gather & verify key code paths
- [x] Read face detection, recognition, clustering orchestration, SDK, utilities.
- [x] Read DB models for Photo/Person/PhotoPerson.
- [x] Read config thresholds used by face pipeline.
- [x] Read background processing queue to see when/where face clustering runs.

## Step 2: Identify performance/correctness risks
- [ ] Locate all call sites of `scan_and_cluster_face`.
- [ ] Review concurrency behavior (single worker vs multiple jobs).
- [ ] Analyze centroid update correctness vs embedding_cache lifecycle.

## Step 3: Plan targeted improvements (only after approval)
- [ ] Precompute per-person PhotoPerson counts to avoid N+1 count queries.
- [ ] Replace brute-force linear search with ANN or cached matrix (optional, larger change).
- [ ] Add safety checks/logging for missing/invalid embeddings.
- [ ] Ensure thumbnail path consistency (`cover_face_thumbnail` uses correct /thumbnails prefix).

## Step 4: Implement changes
- [ ] Apply approved code edits.
- [ ] Update/extend tests in `backend/tests/test_face_clustering.py`.

## Step 5: Validate
- [ ] Run backend pytest suite.
- [ ] Run lint/type checks if configured.

