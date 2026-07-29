"""
SMTP Email Sender — sequential sending engine with pause/resume/cancel support.
Streams progress via asyncio queue for SSE delivery.
"""

import asyncio
import smtplib
import time
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Dict, Any, Optional, Callable
import os


class SendSession:
    """Represents one bulk-send operation with full state tracking."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.recipients: List[Dict] = []
        self.subject: str = ""
        self.body_html: str = ""
        self.body_text: str = ""
        self.signature: str = ""
        self.attachments: List[Dict] = []  # [{name, data, mime_type}]
        self.smtp_config: Dict = {}

        # State
        self.status: str = "idle"  # idle | running | paused | cancelled | done
        self.sent: List[Dict] = []
        self.failed: List[Dict] = []
        self.pending_indices: List[int] = []
        self.current_index: int = 0

        # Concurrency primitives
        self._pause_event = threading.Event()
        self._pause_event.set()  # Not paused by default
        self._cancel_flag = threading.Event()
        self._progress_callbacks: List[Callable] = []

        # Async queue for SSE events
        self.event_queue: asyncio.Queue = asyncio.Queue()
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop

    def emit(self, event: Dict):
        """Thread-safe event emission to asyncio queue."""
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(
                self.event_queue.put(event), self._loop
            )

    def pause(self):
        self._pause_event.clear()
        self.status = "paused"
        self.emit({"type": "paused", "session_id": self.session_id})

    def resume(self):
        self._pause_event.set()
        self.status = "running"
        self.emit({"type": "resumed", "session_id": self.session_id})

    def cancel(self):
        self._cancel_flag.set()
        self._pause_event.set()  # Unblock if paused
        self.status = "cancelled"
        self.emit({"type": "cancelled", "session_id": self.session_id})

    @property
    def total(self) -> int:
        return len(self.recipients)

    @property
    def sent_count(self) -> int:
        return len(self.sent)

    @property
    def failed_count(self) -> int:
        return len(self.failed)

    @property
    def remaining(self) -> int:
        return self.total - self.sent_count - self.failed_count

    def get_stats(self) -> Dict:
        return {
            "session_id": self.session_id,
            "status": self.status,
            "total": self.total,
            "sent": self.sent_count,
            "failed": self.failed_count,
            "remaining": self.remaining,
            "progress_pct": round((self.sent_count + self.failed_count) / max(self.total, 1) * 100, 1),
        }


def _build_message(
    from_email: str,
    to_email: str,
    subject: str,
    body_html: str,
    body_text: str,
    signature: str,
    attachments: List[Dict],
    variables: Dict[str, str],
) -> MIMEMultipart:
    """Build a MIME email message with variable substitution."""
    # Replace template variables
    def replace_vars(text: str) -> str:
        for key, val in variables.items():
            text = text.replace(f"{{{{{key}}}}}", val)
        return text

    msg = MIMEMultipart("mixed")
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = replace_vars(subject)

    # Create alternative part (text + html)
    alt = MIMEMultipart("alternative")

    plain = replace_vars(body_text or "")
    html = replace_vars(body_html or plain)
    if signature:
        html += f"<br><br>--<br>{replace_vars(signature)}"
        plain += f"\n\n--\n{replace_vars(signature)}"

    alt.attach(MIMEText(plain, "plain", "utf-8"))
    alt.attach(MIMEText(html, "html", "utf-8"))
    msg.attach(alt)

    # Attach files
    for att in attachments:
        part = MIMEBase("application", "octet-stream")
        part.set_payload(att["data"])
        encoders.encode_base64(part)
        part.add_header(
            "Content-Disposition",
            f'attachment; filename="{att["name"]}"',
        )
        msg.attach(part)

    return msg


def _connect_smtp(config: Dict) -> smtplib.SMTP:
    """Create authenticated SMTP connection."""
    host = config.get("host", "smtp.gmail.com")
    port = int(config.get("port", 587))
    username = config.get("username", "")
    password = config.get("password", "")
    use_tls = config.get("use_tls", True)

    if port == 465:
        server = smtplib.SMTP_SSL(host, port, timeout=30)
    else:
        server = smtplib.SMTP(host, port, timeout=30)
        if use_tls:
            server.starttls()

    server.login(username, password)
    return server


def run_send_session(session: SendSession):
    """
    Blocking function that sends emails sequentially.
    Should be run in a background thread.
    """
    session.status = "running"
    smtp_config = session.smtp_config
    from_email = smtp_config.get("username", "")
    retry_queue: List[int] = []

    session.emit({
        "type": "started",
        "session_id": session.session_id,
        **session.get_stats(),
    })

    server: Optional[smtplib.SMTP] = None

    try:
        server = _connect_smtp(smtp_config)
    except Exception as e:
        session.status = "error"
        session.emit({
            "type": "error",
            "message": f"SMTP connection failed: {str(e)}",
            "session_id": session.session_id,
        })
        return

    for idx, recipient in enumerate(session.recipients):
        # Check cancel
        if session._cancel_flag.is_set():
            break

        # Check pause — block here until resumed
        session._pause_event.wait()

        if session._cancel_flag.is_set():
            break

        email = recipient.get("email", "")
        name = recipient.get("name", email.split("@")[0])

        variables = {"email": email, "name": name}

        try:
            msg = _build_message(
                from_email=from_email,
                to_email=email,
                subject=session.subject,
                body_html=session.body_html,
                body_text=session.body_text,
                signature=session.signature,
                attachments=session.attachments,
                variables=variables,
            )

            # Reconnect if needed
            try:
                server.noop()
            except Exception:
                server = _connect_smtp(smtp_config)

            server.sendmail(from_email, email, msg.as_string())
            session.sent.append({"email": email, "name": name, "index": idx})
            session.emit({
                "type": "sent",
                "email": email,
                "name": name,
                "index": idx,
                **session.get_stats(),
            })
        except Exception as e:
            session.failed.append({
                "email": email, "name": name, "index": idx, "error": str(e)
            })
            session.emit({
                "type": "failed",
                "email": email,
                "name": name,
                "index": idx,
                "error": str(e),
                **session.get_stats(),
            })

        # Small delay to avoid rate limiting
        time.sleep(0.3)

    # Close SMTP connection
    try:
        if server:
            server.quit()
    except Exception:
        pass

    if session.status != "cancelled":
        session.status = "done"

    session.emit({
        "type": "completed",
        "session_id": session.session_id,
        **session.get_stats(),
    })
