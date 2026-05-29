"""
clean_data.py
=============
Cleans clinics_data.json:
  1. Removes / clears fake/invalid emails
  2. Re-extracts emails from existing websites using the IMPROVED scraper
  3. Saves cleaned data back to clinics_data.json

Run:
    python clean_data.py
"""

import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# ── Setup path so we can import the local scraper ────────────────────
sys.path.insert(0, os.path.dirname(__file__))
from scraper import ClinicScraper

DATA_FILE = os.path.join(os.path.dirname(__file__), 'clinics_data.json')

import re

# ── Fake email patterns (same as scraper) ────────────────────────────
FAKE_LOCAL_PARTS = {
    'example', 'test', 'sample', 'demo', 'your', 'dummy', 'fake',
    'temp', 'placeholder', 'noreply', 'no-reply', 'donotreply',
    'do-not-reply', 'notification', 'bounce', 'mailer-daemon',
    'sentry', 'privacy', 'domain', 'webmaster'
}
FAKE_DOMAINS = {
    'example.com', 'example.org', 'example.net', 'test.com', 'localhost',
    'agencia365.com', 'agencia365.com.br', 'ndiscovered.com',
    'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'sharklasers.com',
    'wixpress.com', 'sentry.io'
}

def is_fake_email(email: str) -> bool:
    if not email or '@' not in email:
        return True
    email_lower = email.lower()
    try:
        local, domain = email_lower.split('@')
    except ValueError:
        return True
    if local in FAKE_LOCAL_PARTS:
        return True
    if domain in FAKE_DOMAINS:
        return True
    if any(email_lower.startswith(p + '@') for p in FAKE_LOCAL_PARTS):
        return True
        
    # Check if local part is a long hexadecimal / alphanumeric hash (e.g., UUID or MD5/SHA)
    if len(local) >= 12 and re.match(r'^[0-9a-fA-F]{12,}$', local):
        return True
        
    # Check if local part looks like a random hash containing letters and numbers (e.g., Wix dynamic emails)
    if len(local) >= 16 and re.match(r'^[a-zA-Z0-9.\-_]+$', local):
        digits_count = sum(c.isdigit() for c in local)
        if digits_count >= 5:
            return True
            
    # Check if domain has suspicious platform substrings
    suspicious_domain_substrings = [
        'wixpress', 'sentry', 'wordpress', 'elementor', 'cloudflare',
        'github', 'git', 'localhost', 'developer', 'feedback', 'webmaster'
    ]
    if any(sub in domain for sub in suspicious_domain_substrings):
        return True
        
    return False


def load_data():
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[SAVE] Saved {len(data)} clinics to {DATA_FILE}")

def main():
    data = load_data()
    print(f"[LOAD] {len(data)} clinics loaded")

    # ── Enforce Single Specialization ──────────────────────────────────
    spec_counts = {}
    for clinic in data:
        spec = clinic.get('specialization', '').strip().lower()
        if spec:
            spec_counts[spec] = spec_counts.get(spec, 0) + 1
            
    target_spec = max(spec_counts, key=spec_counts.get) if spec_counts else None
    if target_spec:
        print(f"[SPECIALIZATION] Most common specialization found: '{target_spec}'. Enforcing single specialization.")
        data = [c for c in data if c.get('specialization', '').strip().lower() == target_spec]
        print(f"[SPECIALIZATION] Kept {len(data)} clinics matching specialization '{target_spec}'.")

    # ── Strict Deduplication Pass ──────────────────────────────────────
    unique_data = []
    seen_names = set()
    seen_websites = set()
    seen_emails = set()
    seen_phones = set()
    
    def clean_web(url):
        if not url:
            return ""
        return url.replace("https://", "").replace("http://", "").replace("www.", "").rstrip("/")
        
    def clean_phone(ph):
        if not ph:
            return ""
        return ph.replace("+", "").replace(" ", "").replace("-", "").strip().lower()

    duplicate_count = 0
    for clinic in data:
        name = clinic.get("name", "").strip().lower()
        website = clean_web(clinic.get("website", ""))
        phone = clean_phone(clinic.get("phone", ""))
        email = clinic.get("email", "").strip().lower()
        
        is_dup = False
        if name in seen_names:
            is_dup = True
        elif website and website in seen_websites:
            is_dup = True
        elif phone and phone in seen_phones:
            is_dup = True
        elif email and email in seen_emails:
            is_dup = True
            
        if is_dup:
            duplicate_count += 1
        else:
            unique_data.append(clinic)
            seen_names.add(name)
            if website:
                seen_websites.add(website)
            if phone:
                seen_phones.add(phone)
            if email:
                seen_emails.add(email)
                
    data = unique_data
    print(f"[DEDUPLICATE] Removed {duplicate_count} duplicate clinics. Remaining: {len(data)}")

    # ── Pass 1: Mark clinics with fake emails ──────────────────────────
    fake_cleared = 0
    needs_reextract = []

    for clinic in data:
        email = clinic.get('email', '')
        if email and is_fake_email(email):
            print(f"  [FAKE] Clearing '{email}' from '{clinic['name']}'")
            clinic['email'] = ''
            clinic['status'] = 'Unverified'
            fake_cleared += 1

        # Queue for re-extraction if no email but has a website
        if not clinic.get('email') and clinic.get('website', '').startswith('http'):
            needs_reextract.append(clinic)

    print(f"\n[PASS1] Cleared {fake_cleared} fake emails")
    print(f"[PASS1] {len(needs_reextract)} clinics queued for email re-extraction\n")
    save_data(data)  # save after clearing fakes

    if not needs_reextract:
        print("[DONE] Nothing left to re-extract. All clean!")
        return

    # ── Pass 2: Re-extract emails using improved scraper ──────────────
    print("[PASS2] Starting improved 3-step email extraction (no Selenium needed for this pass)...")

    # We use a lightweight scraper without Selenium for website-only extraction
    # (Selenium is only needed for Google Maps search, not website scraping)
    try:
        scraper = ClinicScraper()
    except Exception as e:
        print(f"[WARN] Could not init Selenium scraper: {e}")
        print("[WARN] Running without Selenium (contact page + Google search via requests only)")
        scraper = None

    recovered = 0
    failed = 0

    def process(clinic):
        website = clinic.get('website', '')
        name = clinic.get('name', '')
        city = clinic.get('city', '')
        print(f"  [TRY] {name} -> {website}")
        try:
            if scraper:
                result = scraper.extract_website_details(website, name, city)
            else:
                # Lightweight: just HTTP fetch without Selenium
                import requests, re, urllib3
                urllib3.disable_warnings()
                from bs4 import BeautifulSoup
                import urllib.parse

                email_pattern = r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}'
                headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                resp = requests.get(website, timeout=12, headers=headers, verify=False, allow_redirects=True)
                emails = re.findall(email_pattern, resp.text)
                valid = [e for e in emails if not is_fake_email(e) and e.count('@') == 1]
                result = {"email": valid[0] if valid else "", "status": "Verified" if valid else "Unverified"}

            return clinic, result
        except Exception as ex:
            return clinic, {"email": "", "status": "Unverified", "error": str(ex)}

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(process, c): c for c in needs_reextract}
        done = 0
        for future in as_completed(futures):
            done += 1
            clinic, result = future.result()
            email = result.get('email', '')
            if email:
                clinic['email'] = email
                clinic['status'] = 'Verified'
                recovered += 1
                print(f"  [OK]  {clinic['name']} -> {email}")
            else:
                failed += 1

            # Save every 10 clinics so progress is not lost
            if done % 10 == 0:
                save_data(data)
                print(f"  [PROGRESS] {done}/{len(needs_reextract)} done | recovered={recovered}")

    save_data(data)

    if scraper:
        try:
            scraper.close()
        except Exception:
            pass

    print(f"\n{'='*55}")
    print(f"  CLEANING COMPLETE")
    print(f"  Fake emails removed   : {fake_cleared}")
    print(f"  Emails re-recovered   : {recovered}")
    print(f"  Still no email        : {failed}")
    print(f"  Total clinics         : {len(data)}")
    print(f"  Verified (with email) : {len([c for c in data if c.get('email')])}")
    print(f"{'='*55}")

if __name__ == '__main__':
    main()
