"""
Vector Store — FAISS-based in-memory index for per-session document retrieval.
Each upload session gets its own VectorStore instance.
"""

import numpy as np
from typing import List, Dict, Any, Optional

try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False


class VectorStore:
    """
    Lightweight FAISS wrapper that stores chunks and their embeddings.
    Falls back to brute-force cosine search if FAISS is unavailable.
    """

    def __init__(self):
        self.chunks: List[Dict[str, Any]] = []
        self.embeddings: Optional[np.ndarray] = None
        self.index = None
        self.dim: Optional[int] = None

    def add(self, chunks: List[Dict[str, Any]], embeddings: np.ndarray):
        """Add chunks and their pre-computed embeddings to the store."""
        if len(chunks) == 0:
            return

        self.chunks.extend(chunks)
        new_embeddings = embeddings.astype(np.float32)

        if self.embeddings is None:
            self.embeddings = new_embeddings
        else:
            self.embeddings = np.vstack([self.embeddings, new_embeddings])

        self.dim = self.embeddings.shape[1]
        self._rebuild_index()

    def _rebuild_index(self):
        """Rebuild FAISS index from current embeddings."""
        if not FAISS_AVAILABLE or self.embeddings is None:
            return
        index = faiss.IndexFlatIP(self.dim)  # Inner product (cosine after normalization)
        normalized = self.embeddings.copy()
        faiss.normalize_L2(normalized)
        index.add(normalized)
        self.index = index

    def similarity_search(self, query_embedding: np.ndarray, k: int = 5) -> List[Dict[str, Any]]:
        """Return top-k most similar chunks for a query embedding."""
        if not self.chunks:
            return []

        k = min(k, len(self.chunks))

        if FAISS_AVAILABLE and self.index is not None:
            query = query_embedding.astype(np.float32).reshape(1, -1)
            faiss.normalize_L2(query)
            _, indices = self.index.search(query, k)
            return [self.chunks[i] for i in indices[0] if i < len(self.chunks)]
        else:
            # Brute-force cosine similarity fallback
            q = query_embedding / (np.linalg.norm(query_embedding) + 1e-10)
            e = self.embeddings / (np.linalg.norm(self.embeddings, axis=1, keepdims=True) + 1e-10)
            scores = e @ q
            top_k = np.argsort(scores)[::-1][:k]
            return [self.chunks[i] for i in top_k]

    def get_all_content(self) -> str:
        """Return all chunk contents concatenated — used for full-text email extraction."""
        return "\n".join(c.get("content", "") for c in self.chunks)

    def clear(self):
        self.chunks = []
        self.embeddings = None
        self.index = None
        self.dim = None
