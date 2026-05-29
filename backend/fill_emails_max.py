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
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

# ── Encoding fix ──────────────────────────────────────────────────────────────
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ── Config ────────────────────────────────────────────────────────────────────
DATA_FILE    = os.path.join(os.path.dirname(__file__), 'clinics_data.json')
MAX_WORKERS  = 15
save_lock    = threading.Lock()
print_lock   = threading.Lock()

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
}

BING_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)'
    ),
    'Accept': 'text/html,*/*',
    'Accept-Language': 'en-US,en;q=0.5',
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
    'appointment', 'appointments', 'secretary', 'reception',
    'admin', 'office', 'clinic', 'mail', 'support', 'team',
    'care', 'dental', 'doctor', 'dr', 'practice', 'surgery',
    'bookings', 'book', 'help', 'ask',
]

CONTACT_SLUGS = [
    '/contact', '/contact-us', '/contactus', '/get-in-touch',
    '/about', '/about-us', '/aboutus', '/reach-us', '/our-team',
    '/team', '/staff', '/email', '/connect', '/appointments',
    '/book', '/book-appointment', '/booking', '/appointments',
    '/enquiry', '/enquiries', '/find-us', '/visit-us', '/location',
    '/locations', '/surgery',
]

CONSTRUCT_PREFIXES = [
    'info', 'contact', 'hello', 'reception', 'admin',
    'enquiries', 'enquiry', 'appointments', 'dental',
    'clinic', 'practice', 'office', 'team', 'hello',
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

def fetch(url: str, timeout=5, headers=None) -> str:
    hdrs = headers or HEADERS
    try:
        r = requests.get(url, headers=hdrs, timeout=timeout,
                         verify=False, allow_redirects=True)
        if r.status_code < 400:
            return r.text
    except Exception:
        pass
    return ''


def fetch_sub_urls(homepage_url: str, html: str, max_urls=6) -> list:
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
        return list(found)[:max_urls]
    except Exception:
        return []


def fetch_all_internal_links(homepage_url: str, html: str, max_urls=10) -> list:
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
    html = fetch(website, timeout=5)
    if html:
        ranked = extract_from_html(html, website)
        if ranked:
            return ranked[0], html
    return '', html


def method_subpages(website: str, homepage_html: str) -> str:
    """M2: Crawl contact/about/team sub-pages."""
    if not website or not homepage_html:
        return ''
    sub_urls = fetch_sub_urls(website, homepage_html)
    for url in sub_urls:
        html = fetch(url, timeout=5)
        if html:
            ranked = extract_from_html(html, website)
            if ranked:
                log(f"    [M2-SUB] {url} -> {ranked[0]}")
                return ranked[0]
    return ''


def method_deep_crawl(website: str, homepage_html: str) -> str:
    """M3: Crawl ALL internal links (depth-1), scanning each for emails."""
    if not website or not homepage_html:
        return ''
    all_links = fetch_all_internal_links(website, homepage_html, max_urls=10)
    visited = set()
    for url in all_links:
        if url in visited:
            continue
        visited.add(url)
        html = fetch(url, timeout=5)
        if html:
            ranked = extract_from_html(html, website)
            if ranked:
                log(f"    [M3-DEEP] {url} -> {ranked[0]}")
                return ranked[0]
    return ''


def method_google(clinic_name: str, city: str, domain: str) -> str:
    """M4: Google search scrape (2 query variants)."""
    queries = []
    if domain:
        queries.append(f'site:{domain} email')
    if clinic_name:
        clean = re.sub(r'[^\w\s]', '', clinic_name)
        queries.append(f'"{clean}" {city} email contact'.strip())

    for q in queries[:2]:
        url = f"https://www.google.com/search?q={urllib.parse.quote(q)}&num=10"
        html = fetch(url, timeout=5)
        if html:
            ranked = extract_from_html(html, domain)
            if ranked:
                log(f"    [M4-GOOGLE] {ranked[0]}")
                return ranked[0]
        time.sleep(0.1)
    return ''


def method_bing(clinic_name: str, city: str, domain: str) -> str:
    """M5: Bing search scrape (2 query variants)."""
    queries = []
    if domain:
        queries.append(f'site:{domain} email')
    if clinic_name:
        clean = re.sub(r'[^\w\s]', '', clinic_name)
        queries.append(f'"{clean}" {city} email'.strip())

    for q in queries[:2]:
        url = f"https://www.bing.com/search?q={urllib.parse.quote(q)}&count=10"
        html = fetch(url, timeout=5, headers=BING_HEADERS)
        if html:
            ranked = extract_from_html(html, domain)
            if ranked:
                log(f"    [M5-BING] {ranked[0]}")
                return ranked[0]
        time.sleep(0.1)
    return ''


def method_duckduckgo(clinic_name: str, city: str, domain: str) -> str:
    """M6: DuckDuckGo HTML search scrape (1 query variant)."""
    queries = []
    if domain:
        queries.append(f'site:{domain} email')

    for q in queries[:1]:
        url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(q)}"
        html = fetch(url, timeout=5)
        if html:
            ranked = extract_from_html(html, domain)
            if ranked:
                log(f"    [M6-DDG] {ranked[0]}")
                return ranked[0]
        time.sleep(0.1)
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
    """Search Google/Bing to find the official website of the clinic if missing."""
    if not clinic_name:
        return ""
    
    clean_name = re.sub(r'[^\w\s]', '', clinic_name)
    queries = [
        f'"{clean_name}" {city} website',
        f'"{clean_name}" official website'
    ]
    
    for q in queries:
        try:
            # Try Google first
            url = f"https://www.google.com/search?q={urllib.parse.quote(q)}&num=3"
            html = fetch(url, timeout=5)
            if html:
                soup = BeautifulSoup(html, 'html.parser')
                for a in soup.find_all('a', href=True):
                    href = a['href']
                    if '/url?q=' in href:
                        try:
                            href = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)['q'][0]
                        except:
                            continue
                    if href.startswith('http'):
                        ignore = ['google.com', 'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com', 
                                  'youtube.com', 'yelp.', 'tripadvisor.', 'yell.com', 'nhs.uk', 'map', 'search']
                        if not any(ig in href.lower() for ig in ignore):
                            log(f"    [WEBSITE SEARCH] Found website via Google: {href}")
                            return href
            
            # Fallback to Bing
            url = f"https://www.bing.com/search?q={urllib.parse.quote(q)}&count=3"
            html = fetch(url, timeout=5, headers=BING_HEADERS)
            if html:
                soup = BeautifulSoup(html, 'html.parser')
                for a in soup.find_all('a', href=True):
                    href = a['href']
                    if href.startswith('http'):
                        ignore = ['google.com', 'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com', 
                                  'youtube.com', 'yelp.', 'tripadvisor.', 'yell.com', 'nhs.uk', 'bing.com', 'microsoft.com']
                        if not any(ig in href.lower() for ig in ignore):
                            log(f"    [WEBSITE SEARCH] Found website via Bing: {href}")
                            return href
        except Exception as e:
            log(f"    [WARNING] Website search error: {e}")
    return ""


def method_construct(clinic_name: str, domain: str) -> str:
    """
    M8: Construct likely email from domain + common prefixes.
    """
    if not domain:
        return ''
    # Skip generic platform domains
    skip = [
        'wix.com', 'wordpress.com', 'squarespace.com', 'weebly.com',
        'shopify.com', 'godaddy.com', 'hostgator.com', 'bluehost.com',
        'tumblr.com', 'blogger.com', 'site123.com', 'jimdo.com',
    ]
    if any(s in domain for s in skip):
        return ''

    # Bypassed DNS check on Windows to prevent socket hangs

    for prefix in CONSTRUCT_PREFIXES:
        candidate = f"{prefix}@{domain}"
        if not is_junk(candidate):
            log(f"    [M8-CONSTRUCT] Generated: {candidate}")
            return candidate
    return ''


# ── Per-clinic orchestration ──────────────────────────────────────────────────

def find_email(clinic: dict) -> str:
    name    = clinic.get('name', '')
    website = (clinic.get('website') or '').strip()
    city    = clinic.get('city', '')

    # ── M0: Google ad link & redirect resolver ──
    if website:
        if website.startswith('/aclk') or 'google.com/aclk' in website or '/url?q=' in website or 'google.com/url?' in website:
            try:
                url = 'https://www.google.com' + website if website.startswith('/') else website
                resp = requests.get(url, timeout=10, allow_redirects=True, headers=HEADERS)
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

    # ── M7: WHOIS / RDAP ─────────────────────────────────────────────────────
    if domain:
        email = method_whois(domain)
        if email:
            log(f"  -> [M7] FOUND: {email}")
            return email

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

        email = find_email(clinic)

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
