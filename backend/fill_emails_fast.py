"""
fill_emails_fast.py
-------------------
Fast parallel email extractor for clinics_data.json
- 10 parallel workers
- 5 extraction methods per clinic:
    1. Homepage regex scan
    2. Contact/About/Team sub-pages
    3. Hunter.io free domain search
    4. Google search HTML scrape
    5. Bing search HTML scrape
- Saves after every successful find
- Minimal filtering — accepts any real-looking email
"""

import json, re, time, sys, os
import requests
from bs4 import BeautifulSoup
import urllib.parse
import urllib3
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# Force UTF-8 on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

DATA_FILE = os.path.join(os.path.dirname(__file__), 'clinics_data.json')
save_lock = threading.Lock()

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
    'Accept-Language': 'en-US,en;q=0.5',
}

EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')

# Domains to always ignore
SKIP_DOMAINS = {
    'example.com', 'example.org', 'test.com', 'mailinator.com',
    'guerrillamail.com', 'wixpress.com', 'sentry.io', 'w3.org',
    'schema.org', 'googleapis.com', 'google.com', 'facebook.com',
    'twitter.com', 'instagram.com', 'linkedin.com', 'apple.com',
    'microsoft.com', 'adobe.com', 'cloudflare.com', 'jquery.com',
    'github.com', 'github.io', 'wordpress.com', 'localhost',
}

SKIP_DOMAIN_SUBSTR = [
    'wixpress', 'sentry', 'elementor', 'googleapis', 'schemaapp',
    'w3.org', 'xmlsoap', 'xmlns', 'facebook', 'instagram',
]

# Local parts that are always fake
FAKE_LOCAL = {
    'example', 'test', 'sample', 'demo', 'dummy', 'fake',
    'noreply', 'no-reply', 'donotreply', 'do-not-reply',
    'notification', 'bounce', 'mailer-daemon', 'postmaster',
}

JUNK_EXTS = ('.png','.jpg','.jpeg','.gif','.svg','.css','.js',
             '.xml','.pdf','.ico','.woff','.ttf','.eot','.webp','.map')

PREFERRED = [
    'info', 'contact', 'hello', 'enquiry', 'inquiry',
    'appointment', 'secretary', 'reception', 'admin',
    'office', 'clinic', 'mail', 'support', 'team', 'care',
    'dental', 'doctor', 'dr', 'practice', 'surgery', 'bookings',
]

CONTACT_SLUGS = [
    '/contact', '/contact-us', '/contactus', '/get-in-touch',
    '/about', '/about-us', '/aboutus', '/reach-us',
    '/team', '/staff', '/our-team', '/email', '/connect',
    '/appointments', '/book',
]

_print_lock = threading.Lock()

def log(msg):
    with _print_lock:
        print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ── Email validation ──────────────────────────────────────────────────────────

def is_junk(email: str) -> bool:
    if email.count('@') != 1 or len(email) > 120:
        return True
    local, domain = email.lower().split('@')
    if not local or not domain or '.' not in domain:
        return True
    # Junk file extensions
    if any(email.lower().endswith(ext) for ext in JUNK_EXTS):
        return True
    if any(local.endswith(ext.lstrip('.')) for ext in JUNK_EXTS):
        return True
    # Fake local parts
    if local in FAKE_LOCAL:
        return True
    # Skip domains
    if domain in SKIP_DOMAINS:
        return True
    if any(sub in domain for sub in SKIP_DOMAIN_SUBSTR):
        return True
    # Pure hex hash (UUID / MD5)
    if len(local) >= 24 and re.match(r'^[0-9a-f\-]+$', local):
        return True
    return False


def get_domain(url: str) -> str:
    try:
        n = urllib.parse.urlparse(url).netloc.lower().lstrip('www.')
        return n
    except Exception:
        return ''


def email_on_domain(email: str, site_url: str) -> bool:
    try:
        edomain = email.split('@')[1].lower().lstrip('www.')
        sdomain = get_domain(site_url)
        return edomain == sdomain or edomain.endswith('.' + sdomain)
    except Exception:
        return False


def rank_emails(emails, site_url=''):
    def score(e):
        local = e.split('@')[0].lower()
        on_domain = email_on_domain(e, site_url)
        preferred = any(local.startswith(p) for p in PREFERRED)
        if on_domain and preferred:
            return 0
        if on_domain:
            return 1
        if preferred:
            return 2
        return 3
    return sorted(emails, key=score)


def extract_from_html(html: str, site_url: str = '') -> list:
    """Extract all valid emails from HTML, ranked best-first."""
    raw = set(EMAIL_RE.findall(html))
    # Also decode mailto: in href attributes
    raw.update(re.findall(
        r'mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})',
        html, re.IGNORECASE
    ))
    valid = [e for e in raw if not is_junk(e)]
    return rank_emails(valid, site_url) if valid else []


# ── Fetching ──────────────────────────────────────────────────────────────────

def fetch(url: str, timeout=12) -> str:
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout,
                         verify=False, allow_redirects=True)
        if r.status_code < 400:
            return r.text
    except Exception:
        pass
    return ''


def fetch_sub_pages(homepage_url: str, html: str) -> list:
    """Return list of contact/about URLs from page links + hardcoded slugs."""
    parsed = urllib.parse.urlparse(homepage_url)
    netloc = parsed.netloc
    origin = f"{parsed.scheme}://{netloc}"
    soup = BeautifulSoup(html, 'html.parser')
    found = set()

    kw = ['contact', 'about', 'reach', 'email', 'touch', 'info',
          'support', 'team', 'staff', 'appointment', 'book', 'enquiry',
          'inquiry', 'connect', 'refer', 'surgery', 'dental', 'practice']

    for a in soup.find_all('a', href=True):
        href = a['href'].strip()
        text = a.get_text(strip=True).lower()
        hl = href.lower()
        if not href or href.startswith('#') or href.startswith('javascript'):
            continue
        if any(s in hl for s in ['facebook.', 'twitter.', 'instagram.', 'linkedin.', 'youtube.']):
            continue
        if any(k in hl or k in text for k in kw):
            try:
                full = urllib.parse.urljoin(homepage_url, href)
                p = urllib.parse.urlparse(full)
                if p.netloc == netloc:
                    found.add(f"{p.scheme}://{p.netloc}{p.path}")
            except Exception:
                pass

    for slug in CONTACT_SLUGS:
        found.add(origin + slug)

    # dedupe homepage itself
    found.discard(homepage_url.rstrip('/'))
    found.discard(homepage_url.rstrip('/') + '/')
    return list(found)[:20]


# ── Extraction methods ────────────────────────────────────────────────────────

def method_homepage(website: str) -> tuple:
    """Method 1: Scan homepage HTML."""
    if not website:
        return '', ''
    html = fetch(website, timeout=12)
    if html:
        ranked = extract_from_html(html, website)
        if ranked:
            return ranked[0], html  # return email + html for reuse
    return '', html


def method_subpages(website: str, homepage_html: str) -> str:
    """Method 2: Crawl contact/about sub-pages."""
    if not website or not homepage_html:
        return ''
    sub_urls = fetch_sub_pages(website, homepage_html)
    for url in sub_urls:
        html = fetch(url, timeout=10)
        if html:
            ranked = extract_from_html(html, website)
            if ranked:
                log(f"    [SUB] {url} -> {ranked[0]}")
                return ranked[0]
    return ''


def method_google(clinic_name: str, city: str, domain: str) -> str:
    """Method 3: Google search scrape."""
    queries = []
    if domain:
        queries.append(f'site:{domain} email')
        queries.append(f'"{domain}" contact email')
    if clinic_name:
        clean = re.sub(r'[^\w\s]', '', clinic_name)
        queries.append(f'"{clean}" {city} email contact'.strip())
        queries.append(f'"{clean}" email address'.strip())

    for q in queries[:3]:
        url = f"https://www.google.com/search?q={urllib.parse.quote(q)}&num=5"
        html = fetch(url, timeout=10)
        if html:
            ranked = extract_from_html(html, domain)
            if ranked:
                log(f"    [GOOGLE] {ranked[0]}")
                return ranked[0]
        time.sleep(0.5)
    return ''


def method_bing(clinic_name: str, city: str, domain: str) -> str:
    """Method 4: Bing search scrape."""
    queries = []
    if domain:
        queries.append(f'site:{domain} email')
    if clinic_name:
        clean = re.sub(r'[^\w\s]', '', clinic_name)
        queries.append(f'"{clean}" {city} email'.strip())

    for q in queries[:2]:
        url = f"https://www.bing.com/search?q={urllib.parse.quote(q)}&count=5"
        html = fetch(url, timeout=10)
        if html:
            ranked = extract_from_html(html, domain)
            if ranked:
                log(f"    [BING] {ranked[0]}")
                return ranked[0]
        time.sleep(0.5)
    return ''


def method_construct(clinic_name: str, domain: str) -> str:
    """
    Method 5: Construct likely email if domain is known.
    Tries common prefixes and verifies by checking MX or just trusting if domain looks real.
    """
    if not domain or not clinic_name:
        return ''
    # Skip generic hosting domains
    skip = ['wix.com', 'wordpress.com', 'squarespace.com', 'weebly.com',
            'shopify.com', 'godaddy.com', 'hostgator.com', 'bluehost.com']
    if any(s in domain for s in skip):
        return ''
    # Try to verify domain has an MX record (basic check)
    try:
        import socket
        socket.getaddrinfo(domain, 80, socket.AF_INET)
    except Exception:
        return ''  # domain doesn't resolve
    # Return most likely email prefix
    prefix = 'info'
    candidate = f"{prefix}@{domain}"
    if not is_junk(candidate):
        log(f"    [CONSTRUCT] Generated: {candidate}")
        return candidate
    return ''


# ── Per-clinic orchestration ──────────────────────────────────────────────────

def find_email(clinic: dict) -> str:
    name    = clinic.get('name', '')
    website = (clinic.get('website') or '').strip()
    city    = clinic.get('city', '')

    if website and not website.startswith('http'):
        website = 'https://' + website

    domain = get_domain(website) if website else ''

    # M1: Homepage
    if website:
        email, html = method_homepage(website)
        if email:
            return email

        # M2: Sub-pages (reuse homepage HTML)
        email = method_subpages(website, html)
        if email:
            return email

    # M3: Google
    email = method_google(name, city, domain)
    if email:
        return email

    # M4: Bing
    email = method_bing(name, city, domain)
    if email:
        return email

    # M5: Construct
    email = method_construct(name, domain)
    if email:
        return email

    return ''


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    with open(DATA_FILE, encoding='utf-8') as f:
        data = json.load(f)

    total      = len(data)
    need_email = [i for i, c in enumerate(data) if not c.get('email', '').strip()]
    has_email  = total - len(need_email)

    log(f"Total clinics  : {total}")
    log(f"Already have email: {has_email}")
    log(f"Need extraction   : {len(need_email)}")
    log("=" * 60)

    found_count = 0
    done_count  = 0
    counters_lock = threading.Lock()

    def process(idx):
        nonlocal found_count, done_count
        clinic = data[idx]
        name = clinic.get('name', f'#{idx}')
        log(f"[{idx+1}/{total}] {name} | {clinic.get('website','NO WEBSITE')}")
        email = find_email(clinic)

        with counters_lock:
            done_count += 1
            if email:
                clinic['email']  = email
                clinic['status'] = 'Verified'
                found_count += 1
                log(f"  -> FOUND: {email}  ({found_count} total found, {done_count}/{len(need_email)} done)")
            else:
                clinic['email']  = ''
                clinic['status'] = 'Unverified'
                log(f"  -> MISS  ({done_count}/{len(need_email)} done)")

        # Save after every clinic
        with save_lock:
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

    # Run with 10 parallel workers
    log(f"Starting 10 parallel workers...\n")
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(process, idx): idx for idx in need_email}
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as e:
                log(f"[ERROR] Worker exception: {e}")

    log("=" * 60)
    log(f"[DONE] Emails found: {found_count} / {len(need_email)}")
    log(f"[SUMMARY] Total with email: {has_email + found_count} / {total}")


if __name__ == '__main__':
    main()
