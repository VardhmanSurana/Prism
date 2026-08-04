"""Lightweight IOU/centroid face tracker for cross-frame identity persistence in videos."""

import numpy as np
from typing import Optional


class TrackedFace:
    def __init__(self, track_id: int, bbox: tuple, embedding: np.ndarray, frame_idx: int):
        self.track_id = track_id
        self.bbox = bbox
        self.embedding = embedding
        self.frame_idx = frame_idx
        self.centroid = self._compute_centroid()
        self.hits = 1
        self.age = 0
        self.missed = 0
        self.embeddings = [embedding]

    def _compute_centroid(self):
        x1, y1, x2, y2 = self.bbox
        return ((x1 + x2) / 2, (y1 + y2) / 2)

    def update(self, bbox, embedding, frame_idx):
        self.bbox = bbox
        self.embedding = embedding
        self.frame_idx = frame_idx
        self.centroid = self._compute_centroid()
        self.hits += 1
        self.age += 1
        self.missed = 0
        self.embeddings.append(embedding)

    def mark_missed(self):
        self.missed += 1
        self.age += 1


class FaceTracker:
    def __init__(self, max_missed: int = 5, iou_threshold: float = 0.3,
                 centroid_dist_threshold: float = 150.0, embedding_sim_threshold: float = 0.4):
        self.tracks: dict[int, TrackedFace] = {}
        self.next_track_id = 1
        self.max_missed = max_missed
        self.iou_threshold = iou_threshold
        self.centroid_dist_threshold = centroid_dist_threshold
        self.embedding_sim_threshold = embedding_sim_threshold

    def _compute_iou(self, bbox1, bbox2):
        x1 = max(bbox1[0], bbox2[0])
        y1 = max(bbox1[1], bbox2[1])
        x2 = min(bbox1[2], bbox2[2])
        y2 = min(bbox1[3], bbox2[3])
        inter = max(0, x2 - x1) * max(0, y2 - y1)
        area1 = (bbox1[2] - bbox1[0]) * (bbox1[3] - bbox1[1])
        area2 = (bbox2[2] - bbox2[0]) * (bbox2[3] - bbox2[1])
        union = area1 + area2 - inter
        return inter / union if union > 0 else 0

    def _compute_centroid_distance(self, c1, c2):
        return ((c1[0] - c2[0])**2 + (c1[1] - c2[1])**2) ** 0.5

    def _compute_embedding_similarity(self, emb1, emb2):
        return float(np.dot(emb1, emb2))

    def update(self, detections: list[tuple[tuple, np.ndarray]]) -> dict[int, np.ndarray]:
        for track in self.tracks.values():
            track.mark_missed()

        matched_tracks = set()
        matched_detections = set()

        track_ids = list(self.tracks.keys())
        if track_ids and detections:
            cost_matrix = np.zeros((len(track_ids), len(detections)))
            for i, tid in enumerate(track_ids):
                track = self.tracks[tid]
                for j, (bbox, emb) in enumerate(detections):
                    iou = self._compute_iou(track.bbox, bbox)
                    new_centroid = ((bbox[0]+bbox[2])/2, (bbox[1]+bbox[3])/2)
                    centroid_dist = self._compute_centroid_distance(track.centroid, new_centroid)
                    emb_sim = self._compute_embedding_similarity(track.embedding, emb)

                    if iou > self.iou_threshold and emb_sim > self.embedding_sim_threshold:
                        cost_matrix[i, j] = iou * 0.4 + emb_sim * 0.4 + (1 - min(centroid_dist / self.centroid_dist_threshold, 1)) * 0.2
                    elif centroid_dist < self.centroid_dist_threshold * 0.5 and emb_sim > self.embedding_sim_threshold * 0.8:
                        cost_matrix[i, j] = emb_sim * 0.5 + (1 - min(centroid_dist / self.centroid_dist_threshold, 1)) * 0.5
                    else:
                        cost_matrix[i, j] = 0

            for _ in range(min(len(track_ids), len(detections))):
                if cost_matrix.max() <= 0:
                    break
                i, j = np.unravel_index(cost_matrix.argmax(), cost_matrix.shape)
                tid = track_ids[i]
                bbox, emb = detections[j]
                self.tracks[tid].update(bbox, emb, self.tracks[tid].age)
                matched_tracks.add(tid)
                matched_detections.add(j)
                cost_matrix[i, :] = 0
                cost_matrix[:, j] = 0

        for j, (bbox, emb) in enumerate(detections):
            if j not in matched_detections:
                track = TrackedFace(self.next_track_id, bbox, emb, 0)
                self.tracks[self.next_track_id] = track
                self.next_track_id += 1

        dead_ids = [tid for tid, track in self.tracks.items() if track.missed > self.max_missed]
        for tid in dead_ids:
            del self.tracks[tid]

        return {tid: track.embedding for tid, track in self.tracks.items() if track.missed == 0}

    def get_final_identities(self) -> dict[int, dict]:
        result = {}
        for tid, track in self.tracks.items():
            avg_emb = np.mean(track.embeddings, axis=0)
            avg_emb = avg_emb / np.linalg.norm(avg_emb)
            result[tid] = {
                'embedding': avg_emb,
                'frame_idx': track.frame_idx,
                'hit_count': track.hits,
                'embeddings': track.embeddings,
            }
        return result
