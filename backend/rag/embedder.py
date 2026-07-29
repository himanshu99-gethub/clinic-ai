"""
Embedder — generates vector embeddings using sentence-transformers (local).
Includes a lightweight hashing vector fallback if sentence-transformers is not installed.
"""

import numpy as np
from typing import List

_model = None
_model_name = "all-MiniLM-L6-v2"
_use_fallback = False


def _get_model():
    global _model, _use_fallback
    if _model is None and not _use_fallback:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(_model_name)
        except Exception:
            _use_fallback = True
    return _model


def _hash_vector(text: str, dim: int = 384) -> np.ndarray:
    """Generate a lightweight deterministic hash vector for fallback."""
    vec = np.zeros(dim, dtype=np.float32)
    for i, word in enumerate(text.split()):
        idx = hash(word) % dim
        vec[idx] += 1.0
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


def embed_texts(texts: List[str]) -> np.ndarray:
    """
    Generate embeddings for a list of text strings.
    Returns a 2D numpy array of shape (len(texts), embedding_dim).
    """
    if not texts:
        return np.array([])
    model = _get_model()
    if model is not None:
        return model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
    
    # Fallback for lightweight serverless environment
    return np.array([_hash_vector(t) for t in texts], dtype=np.float32)


def embed_query(query: str) -> np.ndarray:
    """Generate embedding for a single query string."""
    model = _get_model()
    if model is not None:
        return model.encode([query], show_progress_bar=False, convert_to_numpy=True)[0]
    return _hash_vector(query)


def get_embedding_dim() -> int:
    """Return the embedding dimension."""
    model = _get_model()
    if model is not None:
        return model.get_sentence_embedding_dimension()
    return 384
