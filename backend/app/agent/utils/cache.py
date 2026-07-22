"""
Bounded LRU cache with per-key access tracking.

Stdlib-only. Drop-in replacement for the raw-dict + threshold + clear()
pattern used across the agent subsystem.
"""

from __future__ import annotations

import threading
from collections import OrderedDict
from typing import Generic, Hashable, TypeVar

K = TypeVar("K", bound=Hashable)
V = TypeVar("V")


class LRUCache(Generic[K, V]):
    """Thread-safe, bounded LRU cache."""

    __slots__ = ("_maxsize", "_data", "_lock", "_hits", "_misses")

    def __init__(self, maxsize: int = 512):
        if maxsize < 1:
            raise ValueError("maxsize must be >= 1")
        self._maxsize = maxsize
        self._data: OrderedDict[K, V] = OrderedDict()
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0

    def get(self, key: K, default: V | None = None) -> V | None:
        with self._lock:
            if key in self._data:
                self._data.move_to_end(key)
                self._hits += 1
                return self._data[key]
            self._misses += 1
            return default

    def put(self, key: K, value: V) -> None:
        with self._lock:
            if key in self._data:
                self._data.move_to_end(key)
                self._data[key] = value
            else:
                if len(self._data) >= self._maxsize:
                    self._data.popitem(last=False)  # evict oldest (LRU)
                self._data[key] = value

    def __contains__(self, key: K) -> bool:
        with self._lock:
            return key in self._data

    def __getitem__(self, key: K) -> V:
        with self._lock:
            if key in self._data:
                self._data.move_to_end(key)
                return self._data[key]
            raise KeyError(key)

    def __setitem__(self, key: K, value: V) -> None:
        self.put(key, value)

    def __len__(self) -> int:
        with self._lock:
            return len(self._data)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    @property
    def stats(self) -> dict[str, int]:
        with self._lock:
            return {"hits": self._hits, "misses": self._misses, "size": len(self._data)}
