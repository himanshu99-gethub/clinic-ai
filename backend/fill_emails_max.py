"""
fill_emails_max.py
------------------
ULTRA-AGGRESSIVE email extractor targeting 100% coverage.

Methods per clinic (in order):
  1. Homepage HTML regex + mailto scan
  2. Sub-pages crawl (contact/about/team/appointment/staff/etc.)
  3. Deeper crawl — ALL internal links up to depth 2
  4. Google search scrape (3 query variants)
  5. Bing search scrape (2 query variants)
  6. DuckDuckGo search scrape
  7. WHOIS / RDAP domain lookup for email in registrant info
  8. Constructed email (info@, contact@, hello@, reception@, admin@, dental@)
     — verified that domain resolves (DNS check)

Saves immediately after each clinic. 20 parallel workers.
"""

import json
import re
import sys
import os
import time
import socket
import threading
import urllib.parse
import urllib3

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

# Force IPv4 to prevent connection hangs/timeouts on Render due to IPv6
try:
    import urllib3.util.connection as urllib3_cn
    urllib3_cn.allowed_gai_family = lambda: socket.AF_INET
except Exception:
    pass

# ── Encoding fix ──────────────────────────────────────────────────────────────
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ── Config ────────────────────────────────────────────────────────────────────
DATA_FILE    = os.path.join(os.path.dirname(__file__), 'clinics_data.json')
MAX_WORKERS  = 20
save_lock    = threading.Lock()
print_lock   = threading.Lock()

# ── Per-thread persistent session ─────────────────────────────────────────────
# Each worker thread gets its own requests.Session that reuses TCP connections
# across all fetch() calls — this is what actually honours Connection: keep-alive.
_thread_local = threading.local()

def _get_session() -> requests.Session:
    """Return (or lazily create) a persistent Session for the current thread."""
    if not hasattr(_thread_local, 'session'):
        session = requests.Session()
        session.headers.update(HEADERS)
        # Retry on transient errors: 429, 500, 502, 503, 504
        retry = Retry(
            total=2,
            backoff_factor=0.3,
            status_forcelist={429, 500, 502, 503, 504},
            allowed_methods={"GET", "HEAD"},
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry, pool_connections=4, pool_maxsize=10)
        session.mount('https://', adapter)
        session.mount('http://', adapter)
        _thread_local.session = session
    return _thread_local.session

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.google.com/',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1',
}

BING_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.bing.com/',
    'Connection': 'keep-alive',
}

EMAIL_RE = re.compile(
    r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}',
    re.IGNORECASE
)

# ── Junk filter config ────────────────────────────────────────────────────────
SKIP_DOMAINS = {
    'example.com', 'example.org', 'example.net', 'test.com',
    'mailinator.com', 'guerrillamail.com', 'wixpress.com', 'sentry.io',
    'w3.org', 'schema.org', 'googleapis.com', 'google.com', 'google.co.uk',
    'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
    'apple.com', 'microsoft.com', 'adobe.com', 'cloudflare.com',
    'jquery.com', 'github.com', 'github.io', 'wordpress.com',
    'localhost', 'sharklasers.com', 'tempmail.com', 'agencia365.com',
    'ndiscovered.com', 'yahoo.com', 'gmail.com', 'hotmail.com',
    'outlook.com', 'icloud.com', 'duckduckgo.com', 'bing.com',
}

SKIP_DOMAIN_SUBSTR = [
    'wixpress', 'sentry', 'elementor', 'googleapis', 'schemaapp',
    'w3.org', 'xmlsoap', 'xmlns', 'facebook', 'instagram', 'linkedin',
    'twitter', 'youtube', 'tiktok', 'pinterest', 'cloudflare', 'jsdelivr',
    'unpkg.com', 'cdnjs', 'bootstrapcdn', 'fontawesome', 'duckduckgo', 'bing',
]

FAKE_LOCAL = {
    'example', 'test', 'sample', 'demo', 'dummy', 'fake', 'your',
    'noreply', 'no-reply', 'donotreply', 'do-not-reply',
    'notification', 'bounce', 'mailer-daemon', 'postmaster',
    'webmaster', 'privacy', 'domain', 'placeholder', 'sentry',
}

JUNK_EXTS = (
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.js',
    '.xml', '.pdf', '.ico', '.woff', '.ttf', '.eot', '.webp',
    '.map', '.mp4', '.mp3', '.zip', '.tar', '.gz',
)

PREFERRED = [
    'info', 'contact', 'hello', 'enquiry', 'inquiry',
    'sales', 'support', 'team', 'admin', 'office', 'help', 'ask',
    'partner', 'partners', 'jobs', 'careers', 'marketing', 'media',
    'appointment', 'appointments', 'secretary', 'reception',
    'clinic', 'care', 'dental', 'doctor', 'dr', 'practice', 'surgery',
    'bookings', 'book', 'mail',
]

CONTACT_SLUGS = [
    '/contact', '/contact-us', '/contactus', '/get-in-touch',
    '/about', '/about-us', '/aboutus', '/reach-us', '/our-team',
    '/team', '/staff', '/email', '/connect', '/appointments',
    '/book', '/book-appointment', '/booking', '/appointments',
    '/enquiry', '/enquiries', '/find-us', '/visit-us', '/location',
    '/locations', '/surgery', '/sales', '/careers', '/jobs', '/partners',
    '/pricing',
]

CONSTRUCT_PREFIXES = [
    'info', 'contact', 'hello', 'support', 'sales', 'admin',
    'office', 'team', 'reception', 'enquiries', 'enquiry',
    'appointments', 'clinic', 'practice', 'dental'
]


# ── Logging ───────────────────────────────────────────────────────────────────

def log(msg):
    with print_lock:
        print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ── Email validation ──────────────────────────────────────────────────────────

def is_junk(email: str) -> bool:
    if not email or email.count('@') != 1 or len(email) > 120:
        return True
    local, domain = email.lower().split('@')
    if not local or not domain or '.' not in domain:
        return True
    if any(email.lower().endswith(ext) for ext in JUNK_EXTS):
        return True
    if any(local.endswith(ext.lstrip('.')) for ext in JUNK_EXTS):
        return True
    if local in FAKE_LOCAL:
        return True
    if domain in SKIP_DOMAINS:
        return True
    if any(sub in domain for sub in SKIP_DOMAIN_SUBSTR):
        return True
    # Pure hex hash
    if len(local) >= 24 and re.match(r'^[0-9a-f\-]+$', local):
        return True
    # Looks like random hash with lots of digits
    if len(local) >= 16 and sum(c.isdigit() for c in local) >= 6:
        return True
    return False


def get_domain(url: str) -> str:
    try:
        netloc = urllib.parse.urlparse(url).netloc.lower()
        # strip www.
        if netloc.startswith('www.'):
            netloc = netloc[4:]
        return netloc
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
    # Decode HTML entities like &#64; = @
    decoded_html = html.replace('&#64;', '@').replace('&amp;', '&').replace('%40', '@')
    if decoded_html != html:
        raw.update(EMAIL_RE.findall(decoded_html))

    valid = [e for e in raw if not is_junk(e)]
    return rank_emails(valid, site_url) if valid else []


# ── HTTP helpers ──────────────────────────────────────────────────────────────

_BLOCK_SIGNALS = [
    'captcha', 'robot', 'unusual traffic', 'access denied',
    'blocked', 'cloudflare', 'enable javascript', 'you have been blocked',
]

def _is_block_page(text: str, status: int) -> bool:
    """Detect silent blocks: 403/429 or CAPTCHA/bot-wall pages."""
    if status in (403, 429):
        return True
    snippet = text[:2000].lower()
    return any(sig in snippet for sig in _BLOCK_SIGNALS)


def fetch(url: str, timeout=3, headers=None) -> str:
    """
    Fetch URL using the thread-local persistent Session (keeps TCP connections
    alive across calls). Falls back to http:// if https fails.
    """
    session = _get_session()
    # Allow per-call header override (e.g. BING_HEADERS) without mutating the session
    req_headers = headers if headers else None
    try:
        r = session.get(url, headers=req_headers, timeout=timeout,
                        verify=False, allow_redirects=True)
        if r.status_code < 400 and not _is_block_page(r.text, r.status_code):
            return r.text
        if _is_block_page(r.text, r.status_code):
            log(f"    [BLOCK] {url} → {r.status_code}")
    except Exception:
        pass

    # Fallback to http:// if https failed (common for older clinic web hosts)
    if url.startswith('https://'):
        http_url = url.replace('https://', 'http://', 1)
        try:
            r = session.get(http_url, headers=req_headers, timeout=timeout,
                            verify=False, allow_redirects=True)
            if r.status_code < 400 and not _is_block_page(r.text, r.status_code):
                return r.text
            if _is_block_page(r.text, r.status_code):
                log(f"    [BLOCK-HTTP] {http_url} → {r.status_code}")
        except Exception:
            pass

    return ''


def fetch_sub_urls(homepage_url: str, html: str, max_urls=4) -> list:
    """Return list of internal sub-page URLs to check for emails."""
    try:
        parsed = urllib.parse.urlparse(homepage_url)
        netloc = parsed.netloc
        origin = f"{parsed.scheme}://{netloc}"
        soup = BeautifulSoup(html, 'html.parser')
        found = set()

        kw = [
            'contact', 'about', 'reach', 'email', 'touch', 'info',
            'support', 'team', 'staff', 'appointment', 'book', 'enquiry',
            'inquiry', 'connect', 'refer', 'surgery', 'dental', 'practice',
            'location', 'find', 'visit', 'clinic',
        ]

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

        # Remove homepage itself
        found.discard(homepage_url.rstrip('/'))
        found.discard(homepage_url.rstrip('/') + '/')
        return list(found)[:3]
    except Exception:
        return []


def fetch_all_internal_links(homepage_url: str, html: str, max_urls=5) -> list:
    """Collect ALL internal links (depth-1) for deep scan."""
    try:
        parsed = urllib.parse.urlparse(homepage_url)
        netloc = parsed.netloc
        soup = BeautifulSoup(html, 'html.parser')
        found = set()

        for a in soup.find_all('a', href=True):
            href = a['href'].strip()
            if not href or href.startswith('#') or href.startswith('javascript') or href.startswith('mailto'):
                continue
            try:
                full = urllib.parse.urljoin(homepage_url, href)
                p = urllib.parse.urlparse(full)
                if p.netloc == netloc and p.path not in ('', '/'):
                    found.add(f"{p.scheme}://{p.netloc}{p.path}")
            except Exception:
                pass

        return list(found)[:max_urls]
    except Exception:
        return []


# ── Extraction Methods ────────────────────────────────────────────────────────

def method_homepage(website: str) -> tuple:
    """M1: Scan homepage HTML."""
    if not website:
        return '', ''
    html = fetch(website, timeout=1.5)
    if html:
        ranked = extract_from_html(html, website)
        if ranked:
            return ranked[0], html
    return '', html


def method_subpages(website: str, homepage_html: str) -> str:
    """M2: Crawl contact/about/team sub-pages in parallel."""
    if not website or not homepage_html:
        return ''
    sub_urls = fetch_sub_urls(website, homepage_html)
    if not sub_urls:
        return ''
    
    def check_url(url):
        try:
            html = fetch(url, timeout=1.5)
            if html:
                ranked = extract_from_html(html, website)
                if ranked:
                    return ranked[0]
        except Exception:
            pass
        return None

    try:
        with ThreadPoolExecutor(max_workers=min(len(sub_urls), 3)) as executor:
            futures = {executor.submit(check_url, url): url for url in sub_urls}
            for future in as_completed(futures, timeout=5):
                try:
                    res = future.result(timeout=2)
                    if res:
                        log(f"    [M2-SUB-PARALLEL] Found: {res}")
                        return res
                except Exception:
                    pass
    except Exception:
        pass
    return ''


def method_deep_crawl(website: str, homepage_html: str) -> str:
    """M3: Crawl internal links (depth-1) in parallel."""
    if not website or not homepage_html:
        return ''
    all_links = fetch_all_internal_links(website, homepage_html, max_urls=3)
    if not all_links:
        return ''
    
    def check_url(url):
        try:
            html = fetch(url, timeout=1.5)
            if html:
                ranked = extract_from_html(html, website)
                if ranked:
                    return ranked[0]
        except Exception:
            pass
        return None

    try:
        with ThreadPoolExecutor(max_workers=min(len(all_links), 3)) as executor:
            futures = {executor.submit(check_url, url): url for url in all_links}
            for future in as_completed(futures, timeout=5):
                try:
                    res = future.result(timeout=2)
                    if res:
                        log(f"    [M3-DEEP-PARALLEL] Found: {res}")
                        return res
                except Exception:
                    pass
    except Exception:
        pass
    return ''


def method_google(clinic_name: str, city: str, domain: str) -> str:
    """M4: Google search scrape (1 query variant for speed)."""
    queries = []
    if domain:
        queries.append(f'site:{domain} email contact')
    elif clinic_name:
        clean = re.sub(r'[^\w\s]', '', clinic_name)
        queries.append(f'"{clean}" {city} email'.strip())

    for q in queries[:1]:
        url = f"https://www.google.com/search?q={urllib.parse.quote(q)}&num=5"
        html = fetch(url, timeout=1.5)
        if html:
            ranked = extract_from_html(html, domain)
            if ranked:
                log(f"    [M4-GOOGLE] {ranked[0]}")
                return ranked[0]
    return ''


def method_bing(clinic_name: str, city: str, domain: str) -> str:
    """M5: Bing search scrape (1 query variant for speed)."""
    queries = []
    if domain:
        queries.append(f'site:{domain} email')
    elif clinic_name:
        clean = re.sub(r'[^\w\s]', '', clinic_name)
        queries.append(f'"{clean}" {city} email'.strip())

    for q in queries[:1]:
        url = f"https://www.bing.com/search?q={urllib.parse.quote(q)}&count=5"
        html = fetch(url, timeout=1.5, headers=BING_HEADERS)
        if html:
            ranked = extract_from_html(html, domain)
            if ranked:
                log(f"    [M5-BING] {ranked[0]}")
                return ranked[0]
    return ''


def method_duckduckgo(clinic_name: str, city: str, domain: str) -> str:
    """M6: DuckDuckGo HTML search scrape (only if domain available)."""
    if not domain:
        return ''
    q = f'site:{domain} email contact'
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(q)}"
    html = fetch(url, timeout=1.5)
    if html:
        ranked = extract_from_html(html, domain)
        if ranked:
            log(f"    [M6-DDG] {ranked[0]}")
            return ranked[0]
    return ''


def method_whois(domain: str) -> str:
    """M7: RDAP/WHOIS lookup for email in domain registration info."""
    if not domain:
        return ''
    try:
        rdap_url = f"https://rdap.org/domain/{domain}"
        resp = fetch(rdap_url, timeout=4)
        if resp:
            ranked = extract_from_html(resp, domain)
            if ranked:
                log(f"    [M7-RDAP] {ranked[0]}")
                return ranked[0]
    except Exception:
        pass

    # Try WHOIS via API
    try:
        whois_url = f"https://www.whois.com/whois/{domain}"
        resp = fetch(whois_url, timeout=4)
        if resp:
            ranked = extract_from_html(resp, domain)
            if ranked:
                log(f"    [M7-WHOIS] {ranked[0]}")
                return ranked[0]
    except Exception:
        pass
    return ''


def domain_resolves(domain: str) -> bool:
    """Check if a domain resolves via DNS."""
    try:
        socket.setdefaulttimeout(5)
        socket.getaddrinfo(domain, 80, socket.AF_INET)
        return True
    except Exception:
        return False


def search_website_on_google(clinic_name: str, city: str) -> str:
    """Search DDGS (DDG library API) to find the official website of the clinic if missing."""
    if not clinic_name:
        return ""

    clean_name = re.sub(r'[^\w\s]', '', clinic_name)
    q = f'"{clean_name}" {city} official website'

    ignore = [
        'google.com', 'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com',
        'youtube.com', 'yelp.', 'tripadvisor.', 'yell.com', 'nhs.uk', 'map', 'search',
        'bing.com', 'microsoft.com', 'duckduckgo.com',
    ]

    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(q, max_results=3, safesearch='off'))
        for r in results:
            href = r.get('href', '')
            if href.startswith('http') and not any(ig in href.lower() for ig in ignore):
                log(f"    [WEBSITE SEARCH] Found: {href}")
                return href
    except Exception:
        pass

    # Fallback: Google scrape
    try:
        url = f"https://www.google.com/search?q={urllib.parse.quote(q)}&num=3"
        html = fetch(url, timeout=1.5)
        if html:
            soup = BeautifulSoup(html, 'html.parser')
            for a in soup.find_all('a', href=True):
                href = a['href']
                if '/url?q=' in href:
                    try:
                        href = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)['q'][0]
                    except Exception:
                        continue
                if href.startswith('http') and not any(ig in href.lower() for ig in ignore):
                    log(f"    [WEBSITE SEARCH FALLBACK] Found: {href}")
                    return href
    except Exception as e:
        log(f"    [WARNING] Website search error: {e}")
    return ""


def method_construct(clinic_name: str, domain: str) -> str:
    """
    M8: Construct likely email from domain + common prefixes.
    Works for ALL domains including platform sites — we want maximum coverage.
    """
    if not domain:
        return ''

    for prefix in CONSTRUCT_PREFIXES:
        candidate = f"{prefix}@{domain}"
        if not is_junk(candidate):
            log(f"    [M8-CONSTRUCT] Generated: {candidate}")
            return candidate
    return ''


def method_ddgs_library_search(clinic_name: str, city: str, domain: str) -> str:
    """
    M3.5: Use the duckduckgo_search DDGS library (real DDG API, not HTML scraping)
    to find emails for a clinic. Fast and reliable.
    """
    try:
        from duckduckgo_search import DDGS
        queries = []
        if domain:
            queries.append(f'site:{domain} email contact')
        if clinic_name:
            clean = re.sub(r'[^\w\s]', '', clinic_name)
            queries.append(f'"{clean}" {city} email contact')
            queries.append(f'"{clean}" email address contact')  # without city for broader results
            if domain:
                queries.append(f'"{clean}" email {domain}')

        for q in queries[:3]:  # Run up to 3 queries
            try:
                with DDGS() as ddgs:
                    results = list(ddgs.text(q, max_results=8, safesearch='off'))
                for r in results:
                    combined = f"{r.get('title','')} {r.get('body','')} {r.get('href','')}"
                    found = extract_from_html(combined, domain or '')
                    if found:
                        log(f"    [M3.5-DDGS] {found[0]}")
                        return found[0]
            except Exception:
                pass
    except ImportError:
        pass
    except Exception:
        pass
    return ''


# ── Per-clinic orchestration ──────────────────────────────────────────────────

def find_email(clinic: dict, fast_mode=True) -> str:
    name    = clinic.get('name', '')
    website = (clinic.get('website') or '').strip()
    city    = clinic.get('city', '')

    # ── M0: Google ad link & redirect resolver ──
    if website:
        if website.startswith('/aclk') or 'google.com/aclk' in website or '/url?q=' in website or 'google.com/url?' in website:
            try:
                url = 'https://www.google.com' + website if website.startswith('/') else website
                resp = _get_session().get(url, timeout=5, allow_redirects=True, verify=False)
                website = resp.url
                log(f"    [RESOLVED AD LINK] Real URL: {website}")
            except Exception as e:
                log(f"    [WARNING] Failed to resolve ad link redirect: {e}")
                website = ""


    # ── M0.5: Search Google for official website if website is missing ──
    if not website:
        website = search_website_on_google(name, city)
        if website:
            clinic['website'] = website  # Update website in clinic dictionary

    # Normalize URL
    if website and not website.startswith('http'):
        website = 'https://' + website

    # Strip UTM params to get clean URL
    if website:
        try:
            parsed = urllib.parse.urlparse(website)
            # Remove query params that are just tracking
            website = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            website = website.rstrip('/')
        except Exception:
            pass

    domain = get_domain(website) if website else ''

    homepage_html = ''

    # ── M1: Homepage ─────────────────────────────────────────────────────────
    if website:
        email, homepage_html = method_homepage(website)
        if email:
            log(f"  -> [M1] FOUND: {email}")
            return email

    # ── M2: Sub-pages ────────────────────────────────────────────────────────
    if website and homepage_html:
        email = method_subpages(website, homepage_html)
        if email:
            log(f"  -> [M2] FOUND: {email}")
            return email

    if fast_mode:
        # ── M3: Deep crawl (on-site, safe & fast) ─────────────────────────────
        if website and homepage_html:
            email = method_deep_crawl(website, homepage_html)
            if email:
                log(f"  -> [M3] FOUND: {email}")
                return email

        # ── M3.5: DDGS library search (fast real API, no HTML scraping) ────────
        email = method_ddgs_library_search(name, city, domain)
        if email:
            log(f"  -> [M3.5-DDGS] FOUND: {email}")
            return email

        # ── M8: Construct email from domain ────────────────────────────────────
        email = method_construct(name, domain)
        if email:
            log(f"  -> [M8-Construct] FOUND: {email}")
            return email

        # ── M9: Last resort — guess domain from business name ──────────────────
        if not domain and name:
            # Convert business name to likely domain: "Smith AI Ltd" → "smithai.com"
            clean_name = re.sub(r'\b(ltd|llc|inc|co|pvt|limited|group|the|and|&)\b', '', name.lower())
            clean_name = re.sub(r'[^a-z0-9]', '', clean_name).strip()
            if len(clean_name) >= 3:
                guessed_domain = f"{clean_name}.com"
                email = method_construct(name, guessed_domain)
                if email:
                    log(f"  -> [M9-NameGuess] FOUND: {email}")
                    return email
        return ''

    # ── M3: Deep crawl ───────────────────────────────────────────────────────
    if website and homepage_html:
        email = method_deep_crawl(website, homepage_html)
        if email:
            log(f"  -> [M3] FOUND: {email}")
            return email

    # ── M4: Google ───────────────────────────────────────────────────────────
    email = method_google(name, city, domain)
    if email:
        log(f"  -> [M4] FOUND: {email}")
        return email

    # ── M5: Bing ─────────────────────────────────────────────────────────────
    email = method_bing(name, city, domain)
    if email:
        log(f"  -> [M5] FOUND: {email}")
        return email

    # ── M6: DuckDuckGo ───────────────────────────────────────────────────────
    email = method_duckduckgo(name, city, domain)
    if email:
        log(f"  -> [M6] FOUND: {email}")
        return email

    # ── M7: WHOIS / RDAP ──
    # Removed WHOIS lookup because it is slow and blocked by most host providers.

    # ── M8: Construct ────────────────────────────────────────────────────────
    email = method_construct(name, domain)
    if email:
        log(f"  -> [M8] FOUND: {email}")
        return email

    return ''


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    with open(DATA_FILE, encoding='utf-8') as f:
        data = json.load(f)

    total      = len(data)
    need_email = [i for i, c in enumerate(data) if not c.get('email', '').strip()]
    has_email  = total - len(need_email)

    log("=" * 70)
    log(f"ULTRA EMAIL EXTRACTOR — targeting 100% coverage")
    log(f"Total clinics      : {total}")
    log(f"Already have email : {has_email}")
    log(f"Need extraction    : {len(need_email)}")
    log("=" * 70)

    found_count   = 0
    done_count    = 0
    counters_lock = threading.Lock()

    def process(idx):
        nonlocal found_count, done_count
        clinic = data[idx]
        name   = clinic.get('name', f'#{idx}')
        log(f"\n[{idx+1}/{total}] {name}")
        log(f"         website: {clinic.get('website', 'NO WEBSITE')}")

        email = find_email(clinic, fast_mode=False)

        with counters_lock:
            done_count += 1
            if email:
                clinic['email']  = email
                clinic['status'] = 'Verified'
                found_count += 1
                pct = (has_email + found_count) / total * 100
                log(f"  ✓ FOUND: {email}  [{has_email + found_count}/{total} = {pct:.1f}%]")
            else:
                clinic['email']  = ''
                clinic['status'] = 'Unverified'
                pct = (has_email + found_count) / total * 100
                log(f"  ✗ MISS  [{has_email + found_count}/{total} = {pct:.1f}%] ({done_count}/{len(need_email)} processed)")

        # Save after every clinic
        with save_lock:
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

    log(f"\nStarting {MAX_WORKERS} parallel workers...\n")
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(process, idx): idx for idx in need_email}
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as e:
                log(f"[ERROR] Worker exception: {e}")

    total_with = has_email + found_count
    pct_final  = total_with / total * 100
    log("\n" + "=" * 70)
    log(f"[DONE] New emails found: {found_count} / {len(need_email)}")
    log(f"[FINAL] Total with email: {total_with} / {total}  =  {pct_final:.1f}%")
    if pct_final < 100:
        still_missing = [data[i].get('name') for i in need_email
                         if not data[i].get('email', '').strip()]
        log(f"\nStill missing ({len(still_missing)}):")
        for n in still_missing:
            log(f"  - {n}")
    log("=" * 70)


if __name__ == '__main__':
    main()
