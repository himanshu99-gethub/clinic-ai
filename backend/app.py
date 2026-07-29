"""
AI Bulk Email Sender — FastAPI Backend
Handles document upload → RAG pipeline → email extraction → bulk send.
"""

import asyncio
import io
import json
import os
import sys
import time
import threading
import uuid
import csv
import datetime
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

# ── Load environment ─────────────────────────────────────────
backend_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(backend_dir, ".env"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ── RAG imports ──────────────────────────────────────────────
from rag.document_loader import load_document
from rag.chunker import chunk_documents
from rag.embedder import embed_texts, embed_query
from rag.vector_store import VectorStore
from rag.email_extractor import extract_from_vector_store, extract_emails_from_text, validate_and_deduplicate

# ── Email engine imports ──────────────────────────────────────
from email_engine.sender import SendSession, run_send_session
from email_engine.validator import is_valid_email

# ── Database imports ──────────────────────────────────────────
from db.database import (
    init_db, create_campaign, insert_recipients,
    update_recipient_status, complete_campaign,
    list_campaigns, get_campaign, get_recipients, delete_campaign
)

# ── Logging ──────────────────────────────────────────────────
def log(msg: str, level: str = "INFO"):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [{level}] {msg}", flush=True)


# ── App lifecycle ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    log("Initializing database...")
    await init_db()
    log("Database ready.")
    yield
    log("Shutting down.")


app = FastAPI(
    title="AI Bulk Email Sender",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory state ───────────────────────────────────────────
# One VectorStore per upload session (session_id → VectorStore)
vector_stores: Dict[str, VectorStore] = {}
# Extracted emails per session
session_emails: Dict[str, Dict] = {}
# Active send sessions
send_sessions: Dict[str, SendSession] = {}

# Serve React frontend if dist exists
dist_folder = os.path.join(backend_dir, "..", "frontend", "dist")
if os.path.isdir(dist_folder):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_folder, "assets")), name="assets")


# ════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ════════════════════════════════════════════════════════════

class SmtpConfig(BaseModel):
    host: str = "smtp.gmail.com"
    port: int = 587
    username: str
    password: str
    use_tls: bool = True


class SendRequest(BaseModel):
    session_id: str
    campaign_name: str = "Untitled Campaign"
    subject: str
    body_html: str
    body_text: str = ""
    signature: str = ""
    smtp_config: SmtpConfig
    recipients: List[Dict[str, str]]  # [{email, name?, source?}]


class TestEmailRequest(BaseModel):
    to_email: str
    subject: str
    body_html: str
    body_text: str = ""
    smtp_config: SmtpConfig


# ════════════════════════════════════════════════════════════
# UPLOAD & RAG PIPELINE
# ════════════════════════════════════════════════════════════

@app.post("/api/upload")
async def upload_documents(files: List[UploadFile] = File(...)):
    """
    Upload one or more documents.
    Runs the full RAG pipeline and returns extracted emails.
    """
    session_id = str(uuid.uuid4())
    store = VectorStore()
    all_raw_emails = []
    file_summaries = []
    total_chunks = 0

    log(f"Upload session {session_id}: processing {len(files)} file(s)")

    for upload in files:
        try:
            file_bytes = await upload.read()
            filename = upload.filename or "unknown"

            log(f"  Loading: {filename} ({len(file_bytes)} bytes)")
            pages = load_document(filename, file_bytes)

            log(f"  Chunking: {filename} → {len(pages)} pages")
            chunks = chunk_documents(pages)
            total_chunks += len(chunks)

            if chunks:
                texts = [c["content"] for c in chunks]
                log(f"  Embedding: {len(texts)} chunks from {filename}")
                embeddings = embed_texts(texts)
                store.add(chunks, embeddings)

            # Also extract emails directly from raw text for recall
            raw_from_file = extract_emails_from_text(
                "\n".join(p["content"] for p in pages), source=filename
            )
            all_raw_emails.extend(raw_from_file)

            file_summaries.append({
                "filename": filename,
                "pages": len(pages),
                "chunks": len(chunks),
                "size_bytes": len(file_bytes),
            })

        except Exception as e:
            log(f"  ERROR processing {upload.filename}: {e}", "ERROR")
            file_summaries.append({
                "filename": upload.filename,
                "error": str(e),
            })

    # Store the vector store for this session
    vector_stores[session_id] = store

    # Run full extraction from vector store + direct scan
    store_result = extract_from_vector_store(store)

    # Merge all raw emails and deduplicate
    all_raw_emails.extend(store_result.get("valid", []))
    all_raw_emails.extend(store_result.get("invalid", []))
    all_raw_emails.extend(store_result.get("duplicates", []))

    # Final deduplication pass
    final_result = validate_and_deduplicate(all_raw_emails)
    session_emails[session_id] = final_result

    log(
        f"Session {session_id}: extracted {final_result['stats']['valid_count']} valid emails "
        f"from {total_chunks} chunks"
    )

    return {
        "session_id": session_id,
        "files": file_summaries,
        "total_chunks": total_chunks,
        "emails": final_result,
    }


@app.get("/api/session/{session_id}/emails")
async def get_session_emails(session_id: str):
    """Get extracted emails for a session."""
    if session_id not in session_emails:
        raise HTTPException(status_code=404, detail="Session not found")
    return session_emails[session_id]


@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    """Clean up a session's vector store and emails."""
    vector_stores.pop(session_id, None)
    session_emails.pop(session_id, None)
    return {"message": "Session deleted"}


# ════════════════════════════════════════════════════════════
# EMAIL SENDING
# ════════════════════════════════════════════════════════════

@app.post("/api/send")
async def start_send(request: SendRequest, background_tasks: BackgroundTasks):
    """
    Start a sequential bulk email send session.
    Returns a send_session_id for SSE progress streaming.
    """
    send_session_id = str(uuid.uuid4())
    session = SendSession(send_session_id)

    session.recipients = request.recipients
    session.subject = request.subject
    session.body_html = request.body_html
    session.body_text = request.body_text or ""
    session.signature = request.signature
    session.smtp_config = request.smtp_config.model_dump()

    loop = asyncio.get_event_loop()
    session.set_loop(loop)

    send_sessions[send_session_id] = session

    # Save campaign to DB
    try:
        campaign_id = await create_campaign({
            "name": request.campaign_name,
            "subject": request.subject,
            "body_html": request.body_html,
            "body_text": request.body_text,
            "signature": request.signature,
            "smtp_host": request.smtp_config.host,
            "smtp_port": request.smtp_config.port,
            "smtp_username": request.smtp_config.username,
            "total_recipients": len(request.recipients),
        })
        await insert_recipients(campaign_id, request.recipients)
        session.campaign_id = campaign_id
    except Exception as e:
        log(f"DB error saving campaign: {e}", "WARNING")
        session.campaign_id = None

    # Run sending in background thread (non-blocking)
    def _run():
        run_send_session(session)
        # Update DB after completion
        if hasattr(session, "campaign_id") and session.campaign_id:
            asyncio.run_coroutine_threadsafe(
                complete_campaign(
                    session.campaign_id,
                    session.sent_count,
                    session.failed_count,
                    session.status,
                ),
                loop,
            )

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

    return {
        "send_session_id": send_session_id,
        "total": len(request.recipients),
        "message": "Send session started",
    }


@app.get("/api/send/{send_session_id}/stream")
async def stream_send_progress(send_session_id: str):
    """
    SSE endpoint that streams real-time send progress events.
    """
    session = send_sessions.get(send_session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Send session not found")

    async def event_generator():
        # Send initial state
        yield f"data: {json.dumps({'type': 'init', **session.get_stats()})}\n\n"

        while True:
            try:
                event = await asyncio.wait_for(session.event_queue.get(), timeout=30.0)
                yield f"data: {json.dumps(event)}\n\n"

                if event.get("type") in ("completed", "cancelled", "error"):
                    break
            except asyncio.TimeoutError:
                # Send heartbeat
                yield f"data: {json.dumps({'type': 'heartbeat', **session.get_stats()})}\n\n"
                if session.status in ("done", "cancelled", "error"):
                    break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/send/{send_session_id}/status")
async def get_send_status(send_session_id: str):
    """Get current status of a send session."""
    session = send_sessions.get(send_session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Send session not found")
    return {
        **session.get_stats(),
        "sent_list": session.sent,
        "failed_list": session.failed,
    }


@app.post("/api/send/{send_session_id}/pause")
async def pause_send(send_session_id: str):
    session = send_sessions.get(send_session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.pause()
    return {"message": "Paused", "status": session.status}


@app.post("/api/send/{send_session_id}/resume")
async def resume_send(send_session_id: str):
    session = send_sessions.get(send_session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.resume()
    return {"message": "Resumed", "status": session.status}


@app.post("/api/send/{send_session_id}/cancel")
async def cancel_send(send_session_id: str):
    session = send_sessions.get(send_session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.cancel()
    return {"message": "Cancelled", "status": session.status}


@app.post("/api/send/{send_session_id}/retry-failed")
async def retry_failed(send_session_id: str, background_tasks: BackgroundTasks):
    """Create a new send session for all failed recipients."""
    old_session = send_sessions.get(send_session_id)
    if not old_session:
        raise HTTPException(status_code=404, detail="Session not found")

    failed_recipients = [
        {"email": f["email"], "name": f.get("name", "")}
        for f in old_session.failed
    ]

    if not failed_recipients:
        return {"message": "No failed recipients to retry"}

    new_session_id = str(uuid.uuid4())
    new_session = SendSession(new_session_id)
    new_session.recipients = failed_recipients
    new_session.subject = old_session.subject
    new_session.body_html = old_session.body_html
    new_session.body_text = old_session.body_text
    new_session.signature = old_session.signature
    new_session.smtp_config = old_session.smtp_config
    new_session.attachments = old_session.attachments

    loop = asyncio.get_event_loop()
    new_session.set_loop(loop)
    send_sessions[new_session_id] = new_session

    thread = threading.Thread(
        target=run_send_session, args=(new_session,), daemon=True
    )
    thread.start()

    return {"send_session_id": new_session_id, "total": len(failed_recipients)}


# ════════════════════════════════════════════════════════════
# TEST EMAIL
# ════════════════════════════════════════════════════════════

@app.post("/api/send-test-email")
async def send_test_email(request: TestEmailRequest):
    """Send a single test email to verify SMTP config and template."""
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = request.smtp_config.username
        msg["To"] = request.to_email
        msg["Subject"] = f"[TEST] {request.subject}"
        msg.attach(MIMEText(request.body_text or request.body_html, "plain", "utf-8"))
        msg.attach(MIMEText(request.body_html, "html", "utf-8"))

        cfg = request.smtp_config
        if cfg.port == 465:
            server = smtplib.SMTP_SSL(cfg.host, cfg.port, timeout=15)
        else:
            server = smtplib.SMTP(cfg.host, cfg.port, timeout=15)
            if cfg.use_tls:
                server.starttls()

        server.login(cfg.username, cfg.password)
        server.sendmail(cfg.username, request.to_email, msg.as_string())
        server.quit()

        return {"success": True, "message": f"Test email sent to {request.to_email}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ════════════════════════════════════════════════════════════
# CAMPAIGN HISTORY
# ════════════════════════════════════════════════════════════

@app.get("/api/campaigns")
async def get_campaigns():
    """List all campaigns."""
    campaigns = await list_campaigns()
    return {"campaigns": campaigns}


@app.get("/api/campaigns/{campaign_id}")
async def get_campaign_detail(campaign_id: int):
    """Get a campaign with its recipients."""
    campaign = await get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    recipients = await get_recipients(campaign_id)
    return {**campaign, "recipients": recipients}


@app.delete("/api/campaigns/{campaign_id}")
async def remove_campaign(campaign_id: int):
    """Delete a campaign."""
    await delete_campaign(campaign_id)
    return {"message": "Campaign deleted"}


@app.get("/api/campaigns/{campaign_id}/report/csv")
async def download_csv_report(campaign_id: int):
    """Download campaign report as CSV."""
    campaign = await get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    recipients = await get_recipients(campaign_id)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Email", "Name", "Status", "Error", "Sent At"])
    for r in recipients:
        writer.writerow([
            r.get("email", ""),
            r.get("name", ""),
            r.get("status", ""),
            r.get("error", ""),
            r.get("sent_at", ""),
        ])

    output.seek(0)
    filename = f"campaign_{campaign_id}_{campaign['name'].replace(' ', '_')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ════════════════════════════════════════════════════════════
# HEALTH & FRONTEND FALLBACK
# ════════════════════════════════════════════════════════════

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "version": "1.0.0",
        "timestamp": datetime.datetime.utcnow().isoformat(),
    }


@app.get("/api/smtp-presets")
async def smtp_presets():
    """Return common SMTP provider presets."""
    return {
        "presets": [
            {"name": "Gmail", "host": "smtp.gmail.com", "port": 587, "use_tls": True},
            {"name": "Outlook / Hotmail", "host": "smtp.office365.com", "port": 587, "use_tls": True},
            {"name": "Yahoo Mail", "host": "smtp.mail.yahoo.com", "port": 587, "use_tls": True},
            {"name": "Custom SMTP", "host": "", "port": 587, "use_tls": True},
        ]
    }


# Serve React SPA fallback
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    index_path = os.path.join(dist_folder, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return JSONResponse({"message": "AI Bulk Email Sender API is running"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8081, reload=True)
