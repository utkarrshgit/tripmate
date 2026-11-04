"""
A tiny in-memory cache for repeated lookups: the same model question, the same search,
the same catalog read. Entries expire after `ttl` seconds; past `size` entries the least
recently used goes. One process only, cleared on restart: it's for speed, never for truth.
"""

import time
from collections import OrderedDict
from typing import Any

MISS = object()


class TTLCache:
    def __init__(self, size: int = 256, ttl: float = 1800):
        self.size, self.ttl = size, ttl
        self._data: OrderedDict[Any, tuple[float, Any]] = OrderedDict()
        self.hits = self.misses = 0

    def get(self, key):
        item = self._data.get(key)
        if item is None or item[0] < time.monotonic():
            self._data.pop(key, None)
            self.misses += 1
            return MISS
        self._data.move_to_end(key)
        self.hits += 1
        return item[1]

    def set(self, key, value) -> None:
        self._data[key] = (time.monotonic() + self.ttl, value)
        self._data.move_to_end(key)
        while len(self._data) > self.size:
            self._data.popitem(last=False)

    def clear(self) -> None:
        self._data.clear()

    def stats(self) -> dict:
        total = self.hits + self.misses
        return {"entries": len(self._data), "hits": self.hits, "misses": self.misses, "hit_rate": round(self.hits / total, 3) if total else None}
