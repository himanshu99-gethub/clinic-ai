"""
fill_emails.py
--------------
Scans all clinics in clinics_data.json that have a website but no email,
then attempts to extract a real email address using:
  Step 1: Fetch homepage → regex scan
  Step 2: Try /contact, /about, /contact-us sub-pages
  Step 3: Google search fallback "clinic name email"
Saves after every clinic so progress is never lost.
"""

import json, re, time, sys, os
import requests
from bs4 import BeautifulSoup
import urllib.parse

# Force UTF-8 output on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

DATA_FILE = os.path.join(os.path.dirname(__file__), 'clinics_data.json')

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}

EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')

# ── Domains / strings we always skip ──────────────────────────────────────────
JUNK_DOMAINS = {
    'example.com', 'example.org', 'example.net', 'test.com', 'localhost',
    'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'sharklasers.com',
    'wixpress.com', 'sentry.io', 'w3.org', 'schema.org', 'googleapis.com',
    'google.com', 'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
    'apple.com', 'microsoft.com', 'adobe.com', 'cloudflare.com',
}

JUNK_DOMAIN_SUBSTR = [
    'wixpress', 'sentry', 'elementor', 'googleapis', 'schemaapp',
    'github', 'localhost', 'w3.org', 'xmlsoap', 'xmlns',
]

FAKE_LOCAL = {
    'example', 'test', 'sample', 'demo', 'dummy', 'fake',
    'temp', 'placeholder', 'noreply', 'no-reply', 'donotreply',
    'do-not-reply', 'notification', 'bounce', 'mailer-daemon',
}

JUNK_EXTS = ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.js',
             '.xml', '.pdf', '.ico', '.woff', '.ttf', '.eot', '.webp')

PREFERRED = ['info', 'contact', 'hello', 'enquiry', 'inquiry',
             'appointment', 'secretary', 'reception', 'admin',
             'office', 'clinic', 'mail', 'support', 'team', 'care']

CONTACT_SLUGS = [
    '/contact', '/contact-us', '/contactus', '/get-in-touch',
    '/about', '/about-us', '/aboutus', '/reach-us', '/email',
    '/team', '/staff', '/our-team',
]

# ── Helpers ────────────────────────────────────────────────────────────────────

def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def is_junk_email(email: str) -> bool:
    """Return True if the email is obviously junk/fake/system."""
    if email.count('@') != 1 or len(email) > 120:
        return True
    local, domain = email.lower().split('@')
    if not local or not domain:
        return True
    # Extension check
    if any(local.endswith(ext.lstrip('.')) for ext in JUNK_EXTS):
        return True
    if any(email.lower().endswith(ext) for ext in JUNK_EXTS):
        return True
    # Fake local
    if local in FAKE_LOCAL:
        return True
    if any(email.lower().startswith(p + '@') for p in FAKE_LOCAL):
        return True
    # Junk domains
    if domain in JUNK_DOMAINS:
        return True
    if any(sub in domain for sub in JUNK_DOMAIN_SUBSTR):
        return True
    # Pure hex hash (UUID/MD5) — very long all-hex local part
    if len(local) >= 20 and re.match(r'^[0-9a-f]+$', local):
        return True
    return False


def get_site_domain(url: str) -> str:
    try:
        n = urllib.parse.urlparse(url).netloc.lower()
        parts = n.split('.')
        return '.'.join(parts[-2:]) if len(parts) >= 2 else n
    except Exception:
        return ''


def email_matches_site(email: str, site_url: str) -> bool:
    try:
        domain = email.split('@')[1].lower()
        site_domain = get_site_domain(site_url)
        return domain == site_domain or domain.endswith('.' + site_domain)
    except Exception:
        return False


def rank_emails(emails, site_url=''):
    """Sort emails: site-domain + preferred prefix first."""
    def score(e):
        local = e.split('@')[0].lower()
        on_domain = email_matches_site(e, site_url)
        preferred = any(local.startswith(p) for p in PREFERRED)
        if on_domain and preferred:
            return 0
        if on_domain:
            return 1
        if preferred:
            return 2
        return 3
    return sorted(emails, key=score)


def extract_emails(html: str, site_url: str = '') -> list:
    """Pull all valid emails from raw HTML, ranked best-first."""
    raw = set(EMAIL_RE.findall(html))
    # Also pick up mailto: hrefs
    raw.update(re.findall(r'mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})', html))
    valid = [e for e in raw if not is_junk_email(e)]
    return rank_emails(valid, site_url) if valid else []


def fetch(url: str, timeout=12) -> str:
    """Fetch URL, return HTML string or empty string on failure."""
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout,
                         verify=False, allow_redirects=True)
        if r.status_code < 400:
            return r.text
    except Exception:
        pass
    return ''


def find_contact_links(html: str, base_url: str) -> list:
    """Extract same-domain contact/about page URLs from homepage HTML."""
    parsed_base = urllib.parse.urlparse(base_url)
    base_netloc = parsed_base.netloc
    soup = BeautifulSoup(html, 'html.parser')
    found = set()

    kw = ['contact', 'about', 'reach', 'email', 'touch', 'info',
          'support', 'team', 'staff', 'appointment', 'book', 'enquiry', 'inquiry']

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
                full = urllib.parse.urljoin(base_url, href)
                p = urllib.parse.urlparse(full)
                if p.netloc == base_netloc:
                    found.add(f"{p.scheme}://{p.netloc}{p.path}")
            except Exception:
                pass

    # Always add hard-coded slugs
    origin = f"{parsed_base.scheme}://{parsed_base.netloc}"
    for slug in CONTACT_SLUGS:
        found.add(origin + slug)

    return list(found)[:15]


def google_search_email(clinic_name: str, city: str = '', domain: str = '') -> str:
    """Google search fallback to find a clinic's email."""
    queries = []
    if domain:
        queries.append(f'site:{domain} email contact')
    if clinic_name:
        clean = clinic_name.replace('"', '')
        queries.append(f'"{clean}" {city} email'.strip())
        queries.append(f'"{clean}" contact email'.strip())

    for q in queries:
        url = f"https://www.google.com/search?q={urllib.parse.quote(q)}&num=5"
        html = fetch(url, timeout=10)
        if html:
            ranked = extract_emails(html, domain)
            if ranked:
                log(f"  [GOOGLE HIT] {ranked[0]} (query: {q})")
                return ranked[0]
        time.sleep(1)
    return ''


# ── Core extraction ────────────────────────────────────────────────────────────

def find_email_for_clinic(clinic: dict) -> str:
    name    = clinic.get('name', '')
    website = clinic.get('website', '').strip()
    city    = clinic.get('city', '')

    if not website.startswith('http'):
        website = ('https://' + website) if website else ''

    domain = get_site_domain(website) if website else ''

    # Step 1: homepage
    if website:
        log(f"  [Step 1] Homepage: {website}")
        html = fetch(website)
        if html:
            ranked = extract_emails(html, website)
            if ranked:
                log(f"  [HIT-1] {ranked[0]}")
                return ranked[0]

            # Step 2: contact / about sub-pages
            log(f"  [Step 2] Crawling sub-pages...")
            sub_urls = find_contact_links(html, website)
            for sub_url in sub_urls:
                if sub_url.rstrip('/') == website.rstrip('/'):
                    continue
                sub_html = fetch(sub_url, timeout=10)
                if sub_html:
                    ranked = extract_emails(sub_html, website)
                    if ranked:
                        log(f"  [HIT-2] {sub_url} -> {ranked[0]}")
                        return ranked[0]

    # Step 3: Google search
    log(f"  [Step 3] Google search fallback...")
    email = google_search_email(name, city, domain)
    if email:
        return email

    log(f"  [MISS] No email found for {name}")
    return ''


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    with open(DATA_FILE, encoding='utf-8') as f:
        data = json.load(f)

    total      = len(data)
    need_email = [c for c in data if not c.get('email', '').strip()]
    has_email  = total - len(need_email)

    log(f"Total clinics: {total}")
    log(f"Already have email: {has_email}")
    log(f"Need email extraction: {len(need_email)}")
    log("=" * 60)

    found_count = 0
    for idx, clinic in enumerate(data):
        if clinic.get('email', '').strip():
            continue  # already has email, skip

        log(f"\n[{idx+1}/{total}] {clinic['name']} | {clinic.get('website','NO WEBSITE')}")

        email = find_email_for_clinic(clinic)
        if email:
            clinic['email'] = email
            clinic['status'] = 'Verified'
            found_count += 1
            log(f"  [SAVED] {email}")
        else:
            clinic['email'] = ''
            clinic['status'] = 'Unverified'

        # Save after every clinic so progress is never lost
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        time.sleep(0.5)  # polite delay

    log("\n" + "=" * 60)
    log(f"[DONE] Emails found: {found_count} / {len(need_email)}")
    log(f"[SUMMARY] Total with email now: {has_email + found_count} / {total}")


if __name__ == '__main__':
    main()
