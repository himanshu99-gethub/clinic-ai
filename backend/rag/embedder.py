"""
Embedder — generates vector embeddings using sentence-transformers (local, no API key needed).
Falls back gracefully if the model isn't loaded.
"""

import numpy as np
from typing import List

_model = None
_model_name = "all-MiniLM-L6-v2"


def _get_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(_model_name)
        except Exception as e:
            raise RuntimeError(f"Failed to load SentenceTransformer model '{_model_name}': {e}")
    return _model


def embed_texts(texts: List[str]) -> np.ndarray:
    """
    Generate embeddings for a list of text strings.
    Returns a 2D numpy array of shape (len(texts), embedding_dim).
    """
    if not texts:
        return np.array([])
    model = _get_model()
    embeddings = model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
    return embeddings


def embed_query(query: str) -> np.ndarray:
    """Generate embedding for a single query string."""
    model = _get_model()
    return model.encode([query], show_progress_bar=False, convert_to_numpy=True)[0]


def get_embedding_dim() -> int:
    """Return the embedding dimension of the loaded model."""
    model = _get_model()
    return model.get_sentence_embedding_dimension()
