"""
Text Chunker — splits document content into overlapping chunks for embedding.
Uses LangChain's RecursiveCharacterTextSplitter.
"""

from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter


_splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,
    chunk_overlap=64,
    length_function=len,
    separators=["\n\n", "\n", " ", ""],
)


def chunk_documents(pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Takes a list of page dicts from the document loader and returns
    a flat list of chunk dicts, each with 'content' and 'metadata'.
    """
    chunks = []
    for page in pages:
        content = page.get("content", "")
        if not content.strip():
            continue
        splits = _splitter.split_text(content)
        for i, split in enumerate(splits):
            chunks.append({
                "content": split,
                "metadata": {**page.get("metadata", {}), "chunk": i}
            })
    return chunks
