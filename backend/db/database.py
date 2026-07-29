"""
SQLite Database — campaign history and send logs using aiosqlite.
"""

import aiosqlite
import os
import json
import datetime
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "campaigns.db")


async def init_db():
    """Create tables if they don't exist."""
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
                source_file TEXT,
                status TEXT DEFAULT 'pending',
                error TEXT,
                sent_at TEXT,
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
            )
        """)
        await db.commit()


async def create_campaign(data: Dict[str, Any]) -> int:
    """Insert a new campaign and return its ID."""
    now = datetime.datetime.utcnow().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("""
            INSERT INTO campaigns
                (name, subject, body_html, body_text, signature,
                 smtp_host, smtp_port, smtp_username,
                 total_recipients, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', ?)
        """, (
            data.get("name", "Untitled Campaign"),
            data.get("subject", ""),
            data.get("body_html", ""),
            data.get("body_text", ""),
            data.get("signature", ""),
            data.get("smtp_host", ""),
            data.get("smtp_port", 587),
            data.get("smtp_username", ""),
            data.get("total_recipients", 0),
            now,
        ))
        await db.commit()
        return cursor.lastrowid


async def insert_recipients(campaign_id: int, recipients: List[Dict]) -> None:
    """Bulk insert recipients for a campaign."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executemany("""
            INSERT INTO recipients (campaign_id, email, name, source_file, status)
            VALUES (?, ?, ?, ?, 'pending')
        """, [
            (campaign_id, r["email"], r.get("name", ""), r.get("source", ""))
            for r in recipients
        ])
        await db.commit()


async def update_recipient_status(
    campaign_id: int, email: str, status: str, error: Optional[str] = None
) -> None:
    """Update a recipient's send status."""
    sent_at = datetime.datetime.utcnow().isoformat() if status == "sent" else None
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            UPDATE recipients
            SET status = ?, error = ?, sent_at = ?
            WHERE campaign_id = ? AND email = ?
        """, (status, error, sent_at, campaign_id, email))
        await db.commit()


async def complete_campaign(campaign_id: int, sent: int, failed: int, status: str = "completed") -> None:
    """Mark a campaign as complete with final counts."""
    now = datetime.datetime.utcnow().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            UPDATE campaigns
            SET status = ?, sent_count = ?, failed_count = ?, completed_at = ?
            WHERE id = ?
        """, (status, sent, failed, now, campaign_id))
        await db.commit()


async def list_campaigns() -> List[Dict]:
    """Return all campaigns ordered by newest first."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT * FROM campaigns ORDER BY created_at DESC
        """)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def get_campaign(campaign_id: int) -> Optional[Dict]:
    """Get a single campaign by ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def get_recipients(campaign_id: int) -> List[Dict]:
    """Get all recipients for a campaign."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM recipients WHERE campaign_id = ? ORDER BY id",
            (campaign_id,)
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def delete_campaign(campaign_id: int) -> None:
    """Delete a campaign and its recipients."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM recipients WHERE campaign_id = ?", (campaign_id,))
        await db.execute("DELETE FROM campaigns WHERE id = ?", (campaign_id,))
        await db.commit()
