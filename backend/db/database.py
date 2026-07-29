"""
SQLite Database — campaign history and send logs using aiosqlite.
Supports Vercel Serverless environment (/tmp fallback).
"""

import aiosqlite
import os
import json
import datetime
from typing import List, Dict, Any, Optional

if os.environ.get("VERCEL"):
    DB_PATH = "/tmp/campaigns.db"
else:
    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "campaigns.db")


async def init_db():
    """Create tables if they don't exist."""
    db_dir = os.path.dirname(DB_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                subject TEXT NOT NULL,
                body_html TEXT,
                body_text TEXT,
                signature TEXT,
                smtp_host TEXT,
                smtp_port INTEGER,
                smtp_username TEXT,
                total_recipients INTEGER DEFAULT 0,
                sent_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                created_at TEXT NOT NULL,
                completed_at TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS recipients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL,
                email TEXT NOT NULL,
                name TEXT,
                status TEXT DEFAULT 'pending',
                error TEXT,
                sent_at TEXT,
                FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
            )
        """)
        await db.commit()


async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db


async def create_campaign(
    name: str,
    subject: str,
    body_html: str,
    body_text: str,
    signature: str,
    smtp_host: str,
    smtp_port: int,
    smtp_username: str,
    total_recipients: int,
) -> int:
    async with await get_db() as db:
        now = datetime.datetime.utcnow().isoformat()
        cursor = await db.execute(
            """
            INSERT INTO campaigns (name, subject, body_html, body_text, signature, smtp_host, smtp_port, smtp_username, total_recipients, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', ?)
            """,
            (name, subject, body_html, body_text, signature, smtp_host, smtp_port, smtp_username, total_recipients, now)
        )
        await db.commit()
        return cursor.lastrowid


async def insert_recipients(campaign_id: int, recipients: List[Dict[str, str]]):
    async with await get_db() as db:
        for r in recipients:
            await db.execute(
                "INSERT INTO recipients (campaign_id, email, name, status) VALUES (?, ?, ?, 'pending')",
                (campaign_id, r["email"], r.get("name", ""))
            )
        await db.commit()


async def update_recipient_status(campaign_id: int, email: str, status: str, error: Optional[str] = None):
    async with await get_db() as db:
        now = datetime.datetime.utcnow().isoformat() if status in ("sent", "failed") else None
        await db.execute(
            "UPDATE recipients SET status = ?, error = ?, sent_at = ? WHERE campaign_id = ? AND email = ?",
            (status, error, now, campaign_id, email)
        )
        if status == "sent":
            await db.execute("UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = ?", (campaign_id,))
        elif status == "failed":
            await db.execute("UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?", (campaign_id,))
        await db.commit()


async def complete_campaign(campaign_id: int, status: str = "completed"):
    async with await get_db() as db:
        now = datetime.datetime.utcnow().isoformat()
        await db.execute(
            "UPDATE campaigns SET status = ?, completed_at = ? WHERE id = ?",
            (status, now, campaign_id)
        )
        await db.commit()


async def list_campaigns() -> List[Dict[str, Any]]:
    async with await get_db() as db:
        async with db.execute("SELECT * FROM campaigns ORDER BY id DESC") as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def get_campaign(campaign_id: int) -> Optional[Dict[str, Any]]:
    async with await get_db() as db:
        async with db.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,)) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None


async def get_recipients(campaign_id: int) -> List[Dict[str, Any]]:
    async with await get_db() as db:
        async with db.execute("SELECT * FROM recipients WHERE campaign_id = ? ORDER BY id ASC", (campaign_id,)) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def delete_campaign(campaign_id: int):
    async with await get_db() as db:
        await db.execute("DELETE FROM recipients WHERE campaign_id = ?", (campaign_id,))
        await db.execute("DELETE FROM campaigns WHERE id = ?", (campaign_id,))
        await db.commit()
