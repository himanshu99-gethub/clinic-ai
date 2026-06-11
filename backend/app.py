from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
# No psycopg2 needed, using requests for Supabase REST API
import os
import datetime
import time
import threading
import smtplib
import traceback
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from scraper import ClinicScraper
from fill_emails_max import find_email as extract_email_max
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
import sys

# Force IPv4 to prevent connection hangs/timeouts on Render due to IPv6
try:
    import socket
    import urllib3.util.connection as urllib3_cn
    urllib3_cn.allowed_gai_family = lambda: socket.AF_INET
except Exception:
    pass

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# Load .env file from the backend directory specifically
backend_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(backend_dir, '.env'))


# Set up static folder pointing to the built React frontend dist folder
dist_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'frontend', 'dist')

app = Flask(__name__, static_folder=dist_folder, static_url_path='/')
CORS(app)
app.json.compact = False  # Return formatted/pretty-printed JSON by default

# ────────────────────────────────────────────────────────────
# LOGGING SYSTEM
# ────────────────────────────────────────────────────────────

def log(msg, level="INFO"):
    """Comprehensive logging with timestamps and levels."""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    output = f"[{timestamp}] [BACKEND] [{level}] {msg}"
    print(output, flush=True)
    sys.stdout.flush()  # Explicit flush for daemon threads

# ────────────────────────────────────────────────────────────
# SUPABASE REST API CONFIGURATION
# ────────────────────────────────────────────────────────────

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase_connected = False

if SUPABASE_URL and SUPABASE_KEY:
    supabase_connected = True
    log(f"✓ Supabase REST API configured for URL: {SUPABASE_URL}", "OK")
else:
    log("Supabase URL or Key not set. Running on local JSON file storage fallback.", "WARNING")

def get_supabase_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def supabase_get(table, params=None):
    """Fetch rows from a Supabase table."""
    if not supabase_connected:
        return None
    try:
        url = f"{SUPABASE_URL}/rest/v1/{table}"
        response = requests.get(url, headers=get_supabase_headers(), params=params, timeout=10)
        if response.status_code == 200:
            return response.json()
        else:
            log(f"Supabase GET {table} failed ({response.status_code}): {response.text}", "WARNING")
            return None
    except Exception as e:
        log(f"Supabase GET error: {e}", "WARNING")
        return None

def supabase_upsert(table, data):
    """Upsert rows into a Supabase table."""
    if not supabase_connected:
        return False
    try:
        url = f"{SUPABASE_URL}/rest/v1/{table}"
        headers = get_supabase_headers()
        headers["Prefer"] = "resolution=merge-duplicates"
        response = requests.post(url, headers=headers, json=data, timeout=10)
        if response.status_code in [200, 201]:
            return True
        else:
            log(f"Supabase POST {table} failed ({response.status_code}): {response.text}", "WARNING")
            return False
    except Exception as e:
        log(f"Supabase POST error: {e}", "WARNING")
        return False

def supabase_delete(table, params):
    """Delete rows from a Supabase table based on query parameters."""
    if not supabase_connected:
        return False
    try:
        url = f"{SUPABASE_URL}/rest/v1/{table}"
        response = requests.delete(url, headers=get_supabase_headers(), params=params, timeout=10)
        if response.status_code in [200, 204]:
            return True
        else:
            log(f"Supabase DELETE {table} failed ({response.status_code}): {response.text}", "WARNING")
            return False
    except Exception as e:
        log(f"Supabase DELETE error: {e}", "WARNING")
        return False

# ────────────────────────────────────────────────────────────
# PERSISTENT FILE STORAGE (survives restarts)
# ────────────────────────────────────────────────────────────

import json

DATA_FILE = os.path.join(os.path.dirname(__file__), 'clinics_data.json')
SETTINGS_FILE = os.path.join(os.path.dirname(__file__), 'settings_data.json')

DEFAULT_TEMPLATE = ""

def load_template(verbose=True):
    """Load the email template from Supabase or local JSON fallback."""
    # 1. Try Supabase
    if supabase_connected:
        rows = supabase_get("settings", {"key": "eq.outreach_template"})
        if rows and len(rows) > 0:
            if verbose:
                log("Loaded email template from Supabase settings table", "OK")
            return rows[0].get("value")
                
    # 2. Try JSON file fallback
    try:
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
                settings = json.load(f)
                if "outreach_template" in settings:
                    if verbose:
                        log("Loaded email template from file storage", "OK")
                    return settings["outreach_template"]
    except Exception as e:
        if verbose:
            log(f"Could not load settings file: {e}", "WARNING")
            
    # 3. Default fallback
    if verbose:
        log("Using default fallback email template", "INFO")
    return DEFAULT_TEMPLATE

def save_template(template_content):
    """Save the email template to Supabase and local JSON fallback."""
    # 1. Try Supabase
    db_success = False
    if supabase_connected:
        db_success = supabase_upsert("settings", [{"key": "outreach_template", "value": template_content}])
        if db_success:
            log("Saved email template to Supabase successfully", "OK")
            
    # 2. Try JSON file
    try:
        settings = {}
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
                try:
                    settings = json.load(f)
                except Exception:
                    pass
        settings["outreach_template"] = template_content
        with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        log("Saved email template to file storage successfully", "OK")
        return True
    except Exception as e:
        log(f"Could not save settings file: {e}", "WARNING")
        return db_success

def load_data(verbose=True):
    """Load clinics from JSON file."""
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if verbose:
                    log(f"Loaded {len(data)} clinics from file storage", "OK")
                return data
    except Exception as e:
        if verbose:
            log(f"Could not load data file: {e}", "WARNING")
    return []

def save_data():
    """Save clinics to JSON file."""
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(live_db, f, ensure_ascii=False, indent=2)
    except Exception as e:
        log(f"Could not save data file: {e}", "WARNING")

live_db = load_data()   # Persistent real-time data
activity_logs = []
scraper_lock = threading.Lock()


def add_log(msg, content=None):
    """Add entry to activity log."""
    log_entry = {
        "id": len(activity_logs),
        "message": msg,
        "content": content,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    }
    activity_logs.append(log_entry)
    log(f"ACTIVITY: {msg}")
    
    # Keep only last 100 logs in memory
    if len(activity_logs) > 100:
        activity_logs.pop(0)

def is_duplicate_clinic(clinic_data, exclude_name=None, check_supabase=True):
    """
    Check if a clinic is a duplicate in database or memory.
    A clinic is a duplicate if name, website, phone, or email is already present.
    Website, phone, and email must not be empty strings.
    """
    global live_db
    import re
    
    name = clinic_data.get("name", "").strip().lower()
    website = clinic_data.get("website", "").strip().lower()
    phone = clinic_data.get("phone", "").strip().lower()
    email = clinic_data.get("email", "").strip().lower()
    
    def clean_web(url):
        if not url:
            return ""
        return url.replace("https://", "").replace("http://", "").replace("www.", "").rstrip("/")

    web_clean = clean_web(website)
    
    # Check memory (live_db)
    for c in live_db:
        if exclude_name and c["name"].strip().lower() == exclude_name.strip().lower():
            continue
        
        # Name duplicate
        if c["name"].strip().lower() == name:
            log(f"Duplicate found by name: {name}", "INFO")
            return True
            
        # Website duplicate
        if web_clean and c.get("website"):
            c_web = clean_web(c["website"])
            if c_web == web_clean:
                log(f"Duplicate found by website: {website}", "INFO")
                return True
                
        # Phone duplicate
        if phone and c.get("phone"):
            c_phone = c["phone"].strip().replace("+", "").replace(" ", "").replace("-", "").strip().lower()
            phone_clean = phone.replace("+", "").replace(" ", "").replace("-", "").strip().lower()
            if c_phone == phone_clean:
                log(f"Duplicate found by phone: {phone}", "INFO")
                return True
                
        # Email duplicate
        if email and c.get("email"):
            c_email = c["email"].strip().lower()
            if c_email == email:
                log(f"Duplicate found by email: {email}", "INFO")
                return True
                
    # Check Supabase
    if check_supabase and supabase_connected:
        try:
            or_parts = [f"name.ilike.{name}"]
            if phone:
                or_parts.append(f"phone.eq.{phone}")
            if web_clean:
                or_parts.append(f"website.ilike.%{web_clean}%")
            if email:
                or_parts.append(f"email.ilike.{email}")
                
            params = {"or": f"({','.join(or_parts)})"}
            if exclude_name:
                params["name"] = f"neq.{exclude_name}"
                
            rows = supabase_get("clinics", params)
            if rows and len(rows) > 0:
                log(f"Duplicate found in Supabase: {rows[0].get('name')}", "INFO")
                return True
        except Exception as e:
            log(f"Supabase duplicate check failed: {e}", "WARNING")
            
    return False

def auto_send(clinic, template=None):
    """Send automated email to clinic using SMTP."""
    try:
        clinic_name = clinic.get("name", "Clinic")
        recipient_email = clinic.get("email", "").strip()
        
        if not recipient_email:
            msg = f"No email address for {clinic_name}"
            log(f"OUTREACH: {msg}", "WARNING")
            return False, msg
            
        log(f"OUTREACH: Attempting to contact {clinic_name} at {recipient_email}", "INFO")
        
        # Parse template
        subject = "Strategic Partnership Inquiry"
        body = template or ""
        
        if template:
            # If the template starts with "Subject:", extract it
            if template.strip().lower().startswith("subject:"):
                lines = template.split('\n', 1)
                subject_line = lines[0]
                subject = subject_line.replace("Subject:", "").replace("subject:", "").strip()
                if len(lines) > 1:
                    body = lines[1].strip()
            
            # Replace placeholder variants with actual name
            for placeholder in ["[Clinic Name]", "[Business Name]", "[Company Name]", "[Lead Name]", "[Name]"]:
                subject = subject.replace(placeholder, clinic_name)
                body = body.replace(placeholder, clinic_name)
        else:
            # Default fallback template
            subject = f"Strategic Partnership Inquiry | {clinic_name}"
            body = (
                f"Dear Team,\n\n"
                f"I hope this message finds you well. I am reaching out to {clinic_name} regarding a collaboration opportunity.\n\n"
                f"We would love to discuss how we can support your business.\n\n"
                f"Best regards,\nHimanshu Shakya"
            )
            
        # Try Google Apps Script HTTP Relay if configured
        apps_script_url = os.getenv("APPS_SCRIPT_URL")
        if apps_script_url:
            try:
                log(f"HTTP RELAY: Sending email to {recipient_email} via Google Apps Script Web App...", "INFO")
                payload = {
                    "to": recipient_email,
                    "subject": subject,
                    "body": body,
                    "token": os.getenv("APPS_SCRIPT_SECRET", "clinic-flow-secret-token")
                }
                response = requests.post(apps_script_url, json=payload, timeout=15)
                if response.status_code == 200:
                    try:
                        res_json = response.json()
                        if res_json.get("status") == "success":
                            log(f"HTTP RELAY: Successfully sent email to {recipient_email} via Apps Script", "OK")
                            return True, "Success"
                        else:
                            relay_err = res_json.get("message", "Unknown relay error")
                            log(f"HTTP RELAY WARNING: {relay_err}", "WARNING")
                            # Fallback to SMTP
                    except Exception as json_err:
                        log(f"HTTP RELAY WARNING: Response not JSON: {response.text[:200]}", "WARNING")
                        # Fallback to SMTP
                else:
                    log(f"HTTP RELAY WARNING: Request failed with status code {response.status_code}", "WARNING")
                    # Fallback to SMTP
            except Exception as relay_ex:
                log(f"HTTP RELAY WARNING: Connection failed: {str(relay_ex)}", "WARNING")
                # Fallback to SMTP
        
        # Standard SMTP Flow
        email_user = os.getenv("EMAIL_USER")
        email_pass = os.getenv("EMAIL_PASS")
        email_host = os.getenv("EMAIL_HOST", "smtp.gmail.com")
        try:
            email_port = int(os.getenv("EMAIL_PORT", "587"))
        except:
            email_port = 587
            
        if not email_user or not email_pass:
            msg = "Email credentials (EMAIL_USER or EMAIL_PASS) or APPS_SCRIPT_URL not configured."
            log(msg, "WARNING")
            return False, msg
            
        # Create message container
        msg = MIMEMultipart()
        msg['From'] = email_user
        msg['To'] = recipient_email
        msg['Subject'] = subject
        
        # Record the MIME types
        msg.attach(MIMEText(body, 'plain', 'utf-8'))
        
        # Connect and send
        connected = False
        server = None
        conn_errors = []
        
        # Try configured port first
        try:
            log(f"SMTP: Connecting to {email_host}:{email_port}...", "INFO")
            if email_port == 465:
                server = smtplib.SMTP_SSL(email_host, email_port, timeout=15)
            else:
                server = smtplib.SMTP(email_host, email_port, timeout=15)
                server.starttls()
            connected = True
        except Exception as e:
            err_msg = f"Port {email_port} connection failed: {str(e)}"
            log(f"SMTP: {err_msg}", "WARNING")
            conn_errors.append(err_msg)
            
        # Fallback to port 465 with SSL if STARTTLS port failed (Render environment compatibility)
        if not connected and email_port != 465:
            try:
                log(f"SMTP: Render/Cloud environment fallback — attempting SSL connection on {email_host}:465...", "INFO")
                server = smtplib.SMTP_SSL(email_host, 465, timeout=15)
                connected = True
            except Exception as fallback_err:
                err_msg = f"Port 465 fallback failed: {str(fallback_err)}"
                log(f"SMTP: {err_msg}", "ERROR")
                conn_errors.append(err_msg)
                
        if not connected or not server:
            raise Exception(f"Failed to connect to SMTP server. Details: {'; '.join(conn_errors)}")
            
        try:
            log("SMTP: Logging in...", "INFO")
            server.login(email_user, email_pass)
            log(f"SMTP: Sending email to {recipient_email}...", "INFO")
            server.sendmail(email_user, recipient_email, msg.as_string())
            server.quit()
        except smtplib.SMTPAuthenticationError as auth_err:
            log(f"SMTP AUTHENTICATION ERROR: {str(auth_err)}", "ERROR")
            try:
                server.close()
            except:
                pass
            return False, f"SMTP Authentication failed: {str(auth_err)}. Please verify your App Password."
        except Exception as send_err:
            log(f"SMTP SEND ERROR: {str(send_err)}", "ERROR")
            try:
                server.close()
            except:
                pass
            return False, f"SMTP Transmission failed: {str(send_err)}"
        
        log(f"OUTREACH: Successfully sent email to {recipient_email}", "OK")
        return True, "Success"
    except Exception as e:
        log(f"Outreach Error sending to {clinic.get('email', 'N/A')}: {str(e)}\n{traceback.format_exc()}", "ERROR")
        return False, str(e)

# ────────────────────────────────────────────────────────────
# SCRAPER TASK
# ────────────────────────────────────────────────────────────

def run_scraper_task(city, country, specialization, auto_outreach, template=""):
    """Main scraper orchestration function."""
    global live_db
    
    log(f"[SCRAPER_TASK_START] Starting scraper task for {specialization} in {city}, {country}", "INFO")
    add_log(f"🚀 DISCOVERY INITIATED: {specialization} in {city}, {country or 'Global'}")
    
    # Load existing clinics from memory/file storage to append new results
    live_db = load_data(verbose=False)
    log("Loaded existing clinics to append new search results.", "INFO")

    scraper = None
    try:
        log(f"[SCRAPER_TASK_LOCK] Acquiring scraper lock...", "INFO")
        with scraper_lock:
            log(f"[SCRAPER_TASK_INIT] Creating ClinicScraper instance...", "INFO")
            scraper = ClinicScraper()
            log(f"[SCRAPER_TASK_CREATED] ClinicScraper instance created successfully", "OK")
        
        log(f"[SCRAPER_TASK_QUERY_SETUP] Setting up query variations", "INFO")
        
        # Determine if the specialization/category looks like a medical field
        medical_keywords = ['clinic', 'health', 'dental', 'doctor', 'physio', 'gynae', 'pediatr', 'cardi', 'hospital', 'medical', 'dentist', 'gynaecologist', 'clinics']
        is_medical = any(w in specialization.lower() for w in medical_keywords)
        
        if is_medical:
            base_queries = [
                f"{specialization} in {city}",
                f"{specialization} clinic in {city}",
                f"{specialization} center in {city}",
                f"best {specialization} in {city}",
                f"top rated {specialization} in {city}",
                f"{specialization} specialist in {city}",
            ]
        else:
            base_queries = [
                f"{specialization} in {city}",
                f"{specialization} near {city}",
                f"best {specialization} in {city}",
                f"top rated {specialization} in {city}",
                f"{specialization} companies in {city}",
                f"{specialization} firms in {city}",
            ]
        
        query_variations = []
        for q in base_queries:
            if country:
                query_variations.append(f"{q}, {country}")
            else:
                query_variations.append(q)
                
        # Remove any duplicates in queries
        seen_qs = set()
        unique_queries = []
        for q in query_variations:
            q_lower = q.lower()
            if q_lower not in seen_qs:
                seen_qs.add(q_lower)
                unique_queries.append(q)
        query_variations = unique_queries
        
        log(f"[SCRAPER_TASK_QUERY_SETUP] Generated {len(query_variations)} unique query variations", "INFO")
            
        results = []
        # Populate seen_names from memory (live_db) to avoid scraping duplicates in subsequent runs or queries
        seen_names = {c["name"].strip().lower() for c in live_db if c.get("name")}
        TARGET_CLINICS = 200  # Target: 200 unique clinics
        
        # ThreadPoolExecutor for background extraction. We run up to 20 workers.
        # Started here so we can submit tasks dynamically.
        extraction_executor = ThreadPoolExecutor(max_workers=20)
        extraction_futures = []
        verified_count = 0
        real_count = 0
        stats_lock = threading.Lock()
        
        def extract_and_update(clinic_ref):
            nonlocal verified_count, real_count
            try:
                log(f"[PROCESS_START] Processing clinic: {clinic_ref.get('name')}", "INFO")
                website = clinic_ref.get("website", "").strip()
                name = clinic_ref.get("name", "").strip()
                
                # Verify duplicate on name, website, phone
                if is_duplicate_clinic(clinic_ref, exclude_name=name):
                    log(f"🗑️ REJECTED - Duplicate website/phone/name for {name}", "WARNING")
                    # Remove it from live_db
                    global live_db
                    live_db = [c for c in live_db if c["name"].lower() != name.lower()]
                    save_data()
                    if supabase_connected:
                        supabase_delete("clinics", {"name": f"eq.{name}", "city": f"eq.{city}"})
                    return

                log(f"[PROCESS_EXTRACT] Attempting email extraction for {name} with website: {website}", "INFO")
                
                # Extract email using fill_emails_max logic (M0 to M8)
                email = extract_email_max(clinic_ref)
                
                clinic_ref["email"] = email
                clinic_ref["status"] = "Verified" if email else "Unverified"
                
                if email:
                    # Verify if this newly found email is a duplicate of another clinic
                    if is_duplicate_clinic(clinic_ref, exclude_name=name):
                        log(f"🗑️ REJECTED - Email '{email}' is already associated with another clinic.", "WARNING")
                        live_db = [c for c in live_db if c["name"].lower() != name.lower()]
                        save_data()
                        if supabase_connected:
                            supabase_delete("clinics", {"name": f"eq.{name}", "city": f"eq.{city}"})
                        add_log(f"🗑️ Removed duplicate clinic (matching email): {name}")
                        return
                    
                    with stats_lock:
                        verified_count += 1
                    add_log(f"✅ Found email: {email}")
                    log(f"[PROCESS_EMAIL_FOUND] Email found! verified_count now = {verified_count}", "OK")
                    
                    if auto_outreach:
                        add_log(f"⏳ Auto-outreach: Sending email to {name}...")
                        success, err_msg = auto_send(clinic_ref, template)
                        if success:
                            clinic_ref["outreach_status"] = "Contacted"
                            add_log(f"🚀 Auto-outreach: Email sent successfully to {name}")
                        else:
                            add_log(f"❌ Auto-outreach failed for {name}: {err_msg}")
                else:
                    log(f"[PROCESS_EMAIL_EMPTY] Email extraction returned empty", "WARNING")
                
                # Store or update in Supabase
                if supabase_connected:
                    clinic_payload = {
                        "name": clinic_ref.get("name"),
                        "city": clinic_ref.get("city"),
                        "country": clinic_ref.get("country"),
                        "specialization": clinic_ref.get("specialization"),
                        "address": clinic_ref.get("address"),
                        "phone": clinic_ref.get("phone"),
                        "website": clinic_ref.get("website"),
                        "email": clinic_ref.get("email"),
                        "status": clinic_ref.get("status"),
                        "outreach_status": clinic_ref.get("outreach_status"),
                        "discovery_date": clinic_ref.get("discovery_date")
                    }
                    success = supabase_upsert("clinics", [clinic_payload])
                    if success:
                        log(f"[PROCESS_SUPABASE_SAVED] Saved to Supabase clinics table", "INFO")
                
                save_data()
                log(f"[PROCESS_SAVED] Data persisted to JSON", "OK")
                
                with stats_lock:
                    real_count += 1
                
            except Exception as e:
                log(f"[PROCESS_ERROR] Exception in process_clinic: {str(e)}\n{traceback.format_exc()}", "ERROR")

        def on_clinic_found(res):
            res_name_lower = res["name"].strip().lower()
            if res_name_lower not in seen_names:
                seen_names.add(res_name_lower)
                results.append(res)
                
                # Immediately initialize as unverified clinic and add to live_db for real-time frontend streaming
                clinic_data = {
                    "name": res["name"],
                    "city": city,
                    "country": country or "Global",
                    "specialization": specialization,
                    "address": res.get("address", ""),
                    "phone": res.get("phone", ""),
                    "website": res.get("website", ""),
                    "email": "",
                    "status": "Unverified",
                    "outreach_status": "Pending",
                    "discovery_date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                }
                
                # Check for duplicates using new strict checks (skip Supabase on the main Selenium thread)
                if not is_duplicate_clinic(clinic_data, check_supabase=False):
                    live_db.append(clinic_data)
                    save_data()  # Persist to disk immediately
                    add_log(f"✨ Found clinic #{len(live_db)}: {clinic_data['name']}")
                    log(f"Streamed clinic: {clinic_data['name']}", "OK")
                    
                    # Submit to background extraction pool
                    future = extraction_executor.submit(extract_and_update, clinic_data)
                    extraction_futures.append(future)

        log(f"[SCRAPER_TASK_SEARCH_LOOP] Starting query loop — Target: {TARGET_CLINICS} unique clinics", "INFO")
        for idx, query in enumerate(query_variations):
            # Stop if we've already found enough clinics
            if len(live_db) >= TARGET_CLINICS:
                log(f"[SCRAPER_TASK_TARGET_REACHED] Reached {TARGET_CLINICS} unique clinics, stopping queries", "INFO")
                add_log(f"🎯 Target of {TARGET_CLINICS} clinics reached after query {idx+1}. Stopping search.")
                break

            log(f"[SCRAPER_TASK_QUERY_{idx}] Query {idx+1}/{len(query_variations)}: {query} (found {len(live_db)} so far)", "INFO")
            add_log(f"🔍 Query {idx+1}/{len(query_variations)}: {query} | Found so far: {len(live_db)}")
            
            try:
                scraper.search_google_maps(query, on_clinic_found=on_clinic_found, exclude_names=seen_names)
                add_log(f"Query {idx+1} done. Total unique clinics: {len(results)}")
            except Exception as query_err:
                log(f"[SCRAPER_TASK_QUERY_{idx}_ERROR] Query failed: {str(query_err)}\n{traceback.format_exc()}", "ERROR")
                add_log(f"Query {idx+1} failed: {str(query_err)}", "WARNING")


        # Ensure we have at least 100 unique clinics. If not, trigger expansion queries.
        if len(live_db) < 100:
            log(f"[SCRAPER_TASK_EXPANSION] Only found {len(live_db)} unique clinics. Initiating search expansion...", "INFO")
            add_log(f"⚠️ Search yielded only {len(live_db)} clinics. Triggering dynamic search expansion to meet 100+ target...")
            
            if is_medical:
                expansion_queries = [
                    f"{specialization} near {city}",
                    f"{specialization} in {city} surrounding areas",
                    f"{specialization} in {city} region",
                    f"medical clinic in {city}",
                    f"private clinic in {city}",
                    f"doctors in {city}",
                    f"health center in {city}",
                    f"hospital in {city}"
                ]
            else:
                expansion_queries = [
                    f"{specialization} near {city}",
                    f"{specialization} in {city} surrounding areas",
                    f"{specialization} in {city} region",
                    f"top {specialization} in {city}",
                    f"local {specialization} in {city}",
                    f"{specialization} services in {city}",
                    f"best {specialization} services in {city}",
                    f"top rated {specialization} services in {city}"
                ]
            if country:
                expansion_queries = [f"{q}, {country}" for q in expansion_queries]
                
            # Filter duplicates or queries we already ran
            unique_exp_queries = []
            for eq in expansion_queries:
                if eq.lower() not in seen_qs:
                    seen_qs.add(eq.lower())
                    unique_exp_queries.append(eq)
            
            for idx_exp, query in enumerate(unique_exp_queries):
                if len(live_db) >= 100:
                    log(f"[SCRAPER_TASK_EXPANSION_TARGET_REACHED] Reached {len(live_db)} unique clinics, stopping expansion", "INFO")
                    add_log(f"🎯 Target of 100+ unique clinics reached during search expansion. Stopping search.")
                    break
                    
                log(f"[SCRAPER_TASK_EXPANSION_{idx_exp}] Expansion Query {idx_exp+1}/{len(unique_exp_queries)}: {query} (found {len(live_db)} so far)", "INFO")
                add_log(f"🔍 Expansion Query {idx_exp+1}/{len(unique_exp_queries)}: {query} | Found so far: {len(live_db)}")
                
                try:
                    scraper.search_google_maps(query, on_clinic_found=on_clinic_found, exclude_names=seen_names)
                    add_log(f"Expansion Query {idx_exp+1} done. Total unique clinics: {len(results)}")
                except Exception as query_err:
                    log(f"[SCRAPER_TASK_EXPANSION_{idx_exp}_ERROR] Expansion query failed: {str(query_err)}\n{traceback.format_exc()}", "ERROR")
                    add_log(f"Expansion Query {idx_exp+1} failed: {str(query_err)}", "WARNING")

        
        if not results:
            log(f"[SCRAPER_TASK_NO_RESULTS] No clinics found matching criteria", "WARNING")
            add_log("❌ No clinics found matching criteria", "WARNING")
            return
        
        # Wait for all background extractions to finish
        log(f"[SCRAPER_TASK_WAIT] Waiting for background email extractions to complete ({len(extraction_futures)} tasks)...", "INFO")
        add_log(f"⏳ Waiting for background email extractions to complete ({len(extraction_futures)} tasks)...")
        
        # Shutdown the executor, waiting for running futures to finish
        extraction_executor.shutdown(wait=True)
        
        log(f"[SCRAPER_TASK_SUMMARY] DISCOVERY COMPLETE - real_count={real_count}, verified_count={verified_count}", "OK")
        add_log(f"✅ DISCOVERY COMPLETE:")
        add_log(f"   📊 Total clinics found: {real_count}")
        add_log(f"   📧 With verified emails: {verified_count}")
        add_log(f"   🎯 Success rate: {round(verified_count/real_count*100) if real_count else 0}%")
        add_log(f"   💾 Saved in database: {real_count}")
        
    except Exception as e:
        error_msg = f"CRITICAL SCRAPER FAILURE: {str(e)}\n{traceback.format_exc()}"
        log(f"[SCRAPER_TASK_ERROR] {error_msg}", "ERROR")
        add_log(f"❌ {error_msg}", "ERROR")
    finally:
        if scraper:
            try:
                log(f"[SCRAPER_TASK_CLEANUP] Closing scraper", "INFO")
                scraper.close()
                log("Scraper closed", "OK")
            except Exception as e:
                log(f"Error closing scraper: {str(e)}", "WARNING")

# ────────────────────────────────────────────────────────────
# API ENDPOINTS
# ────────────────────────────────────────────────────────────

@app.route('/api', methods=['GET'])
def api_index():
    """Root route - show API info."""
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return jsonify({
        "name": "ClinicFlow AI - Backend API",
        "status": "running",
        "version": "1.0.0",
        "frontend_url": frontend_url,
        "message": f"Open {frontend_url} in your browser to use the app!",
        "endpoints": {
            "health":   "GET  /api/health",
            "clinics":  "GET  /api/clinics",
            "stats":    "GET  /api/stats",
            "logs":     "GET  /api/logs",
            "search":   "POST /api/search",
            "outreach": "POST /api/outreach",
            "generate": "POST /api/generate-protocol"
        }
    }), 200

# Catch-all route to serve the React frontend app
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path.startswith('api/') or path == 'api':
        return jsonify({"error": "Not Found"}), 404
        
    if app.static_folder and os.path.exists(os.path.join(app.static_folder, 'index.html')):
        return send_from_directory(app.static_folder, 'index.html')
        
    return api_index()


@app.route('/api/search', methods=['POST'])
def launch_search():
    """Launch a clinic discovery scan."""
    try:
        data = request.json or {}
        city = data.get('city', '').strip()
        country = data.get('country', '').strip()
        specialization = data.get('specialization', '').strip()
        auto_outreach = data.get('auto_outreach', False)
        
        # Validation
        if not city or not specialization:
            log("Invalid search request: missing city or specialization", "WARNING")
            return jsonify({
                "error": "Missing required fields: city and specialization"
            }), 400
        
        add_log(f"📡 New search request: {specialization} in {city}, {country}")
        
        template = data.get('template', '')
        
        # Launch async scraper task
        thread = threading.Thread(
            target=run_scraper_task,
            args=(city, country, specialization, auto_outreach, template),
            daemon=True
        )
        thread.start()
        
        return jsonify({
            "message": "Discovery protocol launched successfully",
            "query": f"{specialization} in {city}, {country}",
            "status": "running"
        }), 202
        
    except Exception as e:
        log(f"Search endpoint error: {str(e)}", "ERROR")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/clinics', methods=['GET'])
def get_clinics():
    """Fetch clinics with optional filters."""
    global live_db
    live_db = load_data(verbose=False)
    try:
        city = request.args.get('city', '').strip().lower()
        spec = request.args.get('specialization', '').strip().lower()
        status_filter = request.args.get('status', '').strip()
        
        data = []
        
        # Try to fetch from Supabase first
        if supabase_connected:
            params = {}
            if city:
                params["city"] = f"ilike.{city}"
            if spec:
                params["specialization"] = f"ilike.{spec}"
            if status_filter in ['Verified', 'Unverified']:
                params["status"] = f"eq.{status_filter}"
            
            params["order"] = "discovery_date.desc"
            params["limit"] = "100"
            
            db_rows = supabase_get("clinics", params)
            if db_rows:
                data.extend(db_rows)
                log(f"Fetched {len(db_rows)} clinics from Supabase", "OK")
        
        # Add live_db entries not in Supabase/database
        if live_db:
            existing_names = {c['name'] for c in data}
            for live_clinic in live_db:
                if live_clinic['name'] not in existing_names:
                    # Apply same filters to live_db
                    if city and city.lower() not in live_clinic.get('city', '').lower():
                        continue
                    if spec and spec.lower() not in live_clinic.get('specialization', '').lower():
                        continue
                    if status_filter and live_clinic.get('status') != status_filter:
                        continue
                    data.insert(0, live_clinic)
        
        # If no filters applied and we got some data, return all
        if not data and not city and not spec:
            log("No clinics found in database", "WARNING")
            return jsonify([]), 200
        
        return jsonify(data), 200
        
    except Exception as e:
        log(f"Clinics endpoint error: {str(e)}", "ERROR")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/clinics', methods=['DELETE'])
def clear_all_clinics():
    """Clear all clinics from database and memory file."""
    global live_db
    try:
        # Clear Supabase table
        if supabase_connected:
            success = supabase_delete("clinics", {"id": "gt.0"})
            if success:
                log("✓ Cleared all clinics from Supabase", "OK")
            
        # Clear memory db
        live_db = []
        save_data()
        log("✓ Cleared all clinics from memory and file storage", "OK")
        
        # Add entry to logs
        add_log("🗑️ Database Cleared: All clinical leads deleted by administrator.")
        
        return jsonify({"message": "All clinical leads successfully deleted."}), 200
        
    except Exception as e:
        log(f"Error clearing clinics: {str(e)}", "ERROR")
        return jsonify({"error": f"Failed to clear database: {str(e)}"}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get statistics about clinic discovery."""
    global live_db
    live_db = load_data(verbose=False)
    try:
        stats = {
            "total": 0,
            "verified": 0,
            "unverified": 0,
            "contacted": 0,
            "pending": 0
        }
        
        # Get from Supabase
        if supabase_connected:
            rows = supabase_get("clinics")
            if rows:
                stats["total"] = len(rows)
                stats["verified"] = len([r for r in rows if r.get("status") == "Verified"])
                stats["unverified"] = len([r for r in rows if r.get("status") == "Unverified"])
                stats["contacted"] = len([r for r in rows if r.get("outreach_status") == "Contacted"])
                stats["pending"] = len([r for r in rows if r.get("outreach_status") == "Pending"])
                log(f"Stats retrieved from Supabase: {stats}", "OK")
        
        # Add live_db stats if no MongoDB data
        if stats["total"] == 0 and live_db:
            stats["total"] = len(live_db)
            stats["verified"] = len([c for c in live_db if c.get('status') == 'Verified'])
            stats["unverified"] = len([c for c in live_db if c.get('status') == 'Unverified'])
            stats["contacted"] = len([c for c in live_db if c.get('outreach_status') == 'Contacted'])
            stats["pending"] = len([c for c in live_db if c.get('outreach_status') == 'Pending'])
        
        stats["scraper_running"] = scraper_lock.locked()
        return jsonify(stats), 200
        
    except Exception as e:
        log(f"Stats endpoint error: {str(e)}", "ERROR")
        return jsonify(stats), 200

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Get activity logs."""
    try:
        limit = request.args.get('limit', 50, type=int)
        return jsonify(activity_logs[-limit:]), 200
    except Exception as e:
        log(f"Logs endpoint error: {str(e)}", "ERROR")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/outreach', methods=['POST'])
def trigger_outreach():
    """Trigger bulk outreach to verified clinics."""
    try:
        data = request.json or {}
        clinic_ids = data.get('clinic_names', [])
        template = data.get('template', '')
        
        add_log(f"📧 Bulk outreach initiated for {len(clinic_ids)} clinics")
        
        contacted = 0
        failed = 0
        
        for clinic_name in clinic_ids:
            try:
                clinic = None
                if supabase_connected:
                    rows = supabase_get("clinics", {"name": f"eq.{clinic_name}"})
                    if rows and len(rows) > 0:
                        clinic = rows[0]
                
                if not clinic:
                    clinic = next((c for c in live_db if c['name'] == clinic_name), None)
                
                if clinic and clinic.get('email'):
                    success, err_msg = auto_send(clinic, template)
                    if success:
                        contacted += 1
                        if supabase_connected:
                            supabase_upsert("clinics", [{"name": clinic_name, "city": clinic.get("city"), "outreach_status": "Contacted"}])
                        # Also update memory live_db state for real-time tracking
                        for c in live_db:
                            if c['name'] == clinic_name:
                                c['outreach_status'] = 'Contacted'
                                break
                    else:
                        failed += 1
                        add_log(f"❌ Outreach failed for {clinic_name}: {err_msg}")
            except Exception as e:
                log(f"Error contacting {clinic_name}: {str(e)}", "WARNING")
                failed += 1
        
        add_log(f"✓ Outreach complete: {contacted} contacted, {failed} failed")
        
        return jsonify({
            "message": "Bulk outreach protocol completed",
            "contacted": contacted,
            "failed": failed
        }), 200
        
    except Exception as e:
        log(f"Outreach endpoint error: {str(e)}", "ERROR")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/generate-protocol', methods=['POST'])
def generate_protocol():
    """Generate a custom email outreach template using NVIDIA AI or a fallback."""
    try:
        data = request.json or {}
        prompt = data.get('prompt', '').strip()
        
        if not prompt:
            return jsonify({"error": "Prompt is required"}), 400
            
        nvidia_api_key = os.getenv("NVIDIA_API_KEY")
        template = ""
        
        if nvidia_api_key:
            try:
                log(f"Attempting to generate AI protocol using NVIDIA API for prompt: {prompt}")
                headers = {
                    "Authorization": f"Bearer {nvidia_api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "meta/llama-3.1-8b-instruct",
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are a professional B2B outreach copywriter. Your goal is to write a highly effective, "
                                "professional B2B email template/outreach protocol for a business. "
                                "You MUST include '[Business Name]' as a placeholder where appropriate. "
                                "Keep the output clean: include a 'Subject:' line at the top, and then the email body. "
                                "Do not output any introductory or concluding conversational text. Return ONLY the template."
                            )
                        },
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.5,
                    "max_tokens": 1024
                }
                
                response = requests.post(
                    "https://integrate.api.nvidia.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=15
                )
                
                if response.status_code == 200:
                    result = response.json()
                    template = result['choices'][0]['message']['content'].strip()
                    log("AI Protocol generated successfully via NVIDIA API")
                else:
                    log(f"NVIDIA API request failed with status code {response.status_code}: {response.text}", "WARNING")
            except Exception as api_err:
                log(f"Error calling NVIDIA API: {str(api_err)}", "WARNING")
                
        # Fallback if NVIDIA API is not configured or fails
        if not template:
            log("Using local heuristic template generator fallback", "INFO")
            template = (
                f"Subject: Strategic Partnership Inquiry | [Business Name]\n\n"
                f"Dear Team,\n\n"
                f"I hope this message finds you well. I am reaching out to [Business Name] regarding a collaboration opportunity in your area.\n\n"
                f"We have been following your achievements and are highly impressed by your commitment to excellence. We specialize in solutions for businesses, specifically targeting {prompt}.\n\n"
                f"We would love to discuss how we can support [Business Name] to streamline operations and enhance outcomes.\n\n"
                f"Are you available for a brief 10-minute introductory call next week?\n\n"
                f"Best regards,\n"
                f"Himanshu Shakya\n"
                f"Lead Developer"
            )
            
        return jsonify({"template": template}), 200
        
    except Exception as e:
        log(f"Generate protocol endpoint error: {str(e)}", "ERROR")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/template', methods=['GET'])
def get_template():
    """Retrieve the global email template."""
    try:
        template = load_template()
        return jsonify({"template": template}), 200
    except Exception as e:
        log(f"Get template endpoint error: {str(e)}", "ERROR")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/template', methods=['POST'])
def update_template():
    """Update the global email template."""
    try:
        data = request.json or {}
        template = data.get('template', '').strip()
        if not template:
            return jsonify({"error": "Template is required"}), 400
            
        success = save_template(template)
        if success:
            return jsonify({
                "message": "Global outreach template saved successfully",
                "template": template
            }), 200
        else:
            return jsonify({"error": "Failed to save template"}), 500
    except Exception as e:
        log(f"Update template endpoint error: {str(e)}", "ERROR")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    global live_db
    live_db = load_data(verbose=False)
    try:
        db_status = "Connected" if supabase_connected else "Disconnected"
        return jsonify({
            "status": "healthy",
            "database": f"Supabase REST ({db_status})",
            "clinics_count": len(live_db),
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/send-test-email', methods=['POST'])
def send_test_email():
    """Send a single test email to verify SMTP credentials."""
    try:
        data = request.json or {}
        test_email = data.get('email', '').strip()
        template = data.get('template', '')
        
        if not test_email:
            return jsonify({"error": "Test email address is required"}), 400
            
        test_clinic = {
            "name": "Test Clinic",
            "email": test_email,
            "website": "http://example.com"
        }
        
        log(f"TEST_EMAIL: Attempting to send test outreach email to {test_email}", "INFO")
        success, err_msg = auto_send(test_clinic, template)
        
        if success:
            return jsonify({"message": f"Test email successfully sent to {test_email}!"}), 200
        else:
            return jsonify({"error": f"Failed to send email: {err_msg}"}), 500
    except Exception as e:
        log(f"TEST_EMAIL_ERR: {str(e)}", "ERROR")
        return jsonify({"error": f"Error initiating test: {str(e)}"}), 500

if __name__ == '__main__':
    log("=" * 60, "OK")
    log("LEADFLOW AI BACKEND - STARTING UP", "OK")
    log("=" * 60, "OK")
    log(f"Supabase Connection Url: {'Configured' if SUPABASE_URL else 'Not Configured'}", "INFO")
    log(f"Environment: {os.getenv('ENVIRONMENT', 'development')}", "INFO")
    log(f"Leads loaded from disk: {len(live_db)}", "INFO")
    log("=" * 60, "OK")

    try:
        from waitress import serve
        port = int(os.getenv('PORT', 8081))
        log(f"Starting with Waitress WSGI server on port {port}...", "OK")
        serve(app, host='0.0.0.0', port=port, threads=8)
    except ImportError:
        port = int(os.getenv('PORT', 8081))
        log(f"Waitress not found, falling back to Flask dev server on port {port}...", "WARNING")
        app.run(host='0.0.0.0', port=port, debug=False, threaded=True)

