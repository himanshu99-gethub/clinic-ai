import time
import re
import urllib.parse
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

def log(msg, level="INFO"):
    """Comprehensive logging with levels."""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    output = f"[{timestamp}] [SCRAPER] [{level}] {msg}"
    print(output, flush=True)
    sys.stdout.flush()  # Explicit flush for daemon threads

class ClinicScraper:
    def __init__(self):
        log("Initializing Selenium WebDriver...")
        self.driver = None
        self.email_regex = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
        self.contact_page_patterns = ['/contact', '/contact-us', '/get-in-touch', '/reach-us', '/email']
        
        try:
            options = Options()
            options.add_argument("--headless")
            options.add_argument("--disable-gpu")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
            options.add_argument("--log-level=3")
            options.add_argument("--disable-extensions")
            options.add_argument("--window-size=1920,1080")
            options.add_argument("--start-maximized")
            # No image blocking or eager page load strategy, as Google Maps requires them to render search panels
            
            self.driver = webdriver.Chrome(options=options)
            # Remove navigator.webdriver flag to bypass bot detection
            self.driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
                "source": """
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    })
                """
            })
            self.driver.set_page_load_timeout(60)
            log("WebDriver initialized successfully with window size 1920x1080")
        except Exception as e:
            error_msg = f"Failed to initialize WebDriver: {str(e)}\n{traceback.format_exc()}"
            log(error_msg, "ERROR")
            raise Exception(error_msg)

    def search_google_maps(self, query, on_clinic_found=None):
        """Scrape clinics from Google Maps with robust error handling."""
        log(f"Starting Google Maps search for: {query}")
        results = []
        
        try:
            url = f"https://www.google.com/maps/search/{urllib.parse.quote(query)}"
            log(f"Navigating to: {url}")
            self.driver.get(url)
            
            # Handle cookie consent redirect/dialog
            self._handle_cookie_consent()
            
            # Wait for search results to load
            wait = WebDriverWait(self.driver, 20)
            try:
                wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, "hfpxzc")))
                log("Search results loaded successfully")
            except TimeoutException:
                # Retry cookie consent in case it popped up late
                self._handle_cookie_consent()
                try:
                    wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, "hfpxzc")))
                    log("Search results loaded after cookie consent retry")
                except TimeoutException:
                    log("Timeout waiting for search results", "WARNING")
                    try:
                        import os
                        screenshot_path = os.path.join(os.path.dirname(__file__), 'timeout_screenshot.png')
                        self.driver.save_screenshot(screenshot_path)
                        log(f"Saved timeout screenshot to {screenshot_path}", "INFO")
                    except Exception as ss_err:
                        log(f"Failed to save screenshot: {ss_err}", "WARNING")
                    return results
            
            # Extract initial results
            links = self.driver.find_elements(By.CLASS_NAME, "hfpxzc")
            log(f"Found {len(links)} clinic links on initial load")
            
            # Scroll to load more results
            for scroll_count in range(60):
                try:
                    # Scroll down to load more results
                    self.driver.execute_script("""
                        var results_div = document.querySelector('div[role="feed"]') || document.querySelector('[role="main"]') || document.body;
                        results_div.scrollTop += 2000;
                    """)
                    time.sleep(2)
                    new_links = self.driver.find_elements(By.CLASS_NAME, "hfpxzc")
                    log(f"After scroll {scroll_count + 1}: Found {len(new_links)} total links")
                    if len(new_links) == len(links):
                        log("No new results after scroll, stopping")
                        break
                    links = new_links
                except Exception as e:
                    log(f"Error during scroll: {str(e)}", "WARNING")
                    break
            
            # Extract clinic data from each result
            used_names = set()
            for i in range(500):
                try:
                    # Re-find links dynamically to prevent StaleElementReferenceException
                    links = self.driver.find_elements(By.CLASS_NAME, "hfpxzc")
                    if i >= len(links):
                        break
                        
                    link = links[i]
                    # Get clinic name
                    name = link.get_attribute('aria-label')
                    if not name or name in used_names:
                        continue
                    
                    log(f"Processing clinic {i+1}: {name}")
                    
                    # Click on the clinic to view details
                    try:
                        # Scroll element into view and wait briefly to ensure it is clickable in the viewport
                        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", link)
                        time.sleep(0.5)
                        
                        try:
                            link.click()
                        except Exception:
                            self.driver.execute_script("arguments[0].click();", link)
                        
                        # Wait dynamically for details panel to load the new clinic name
                        start_time = time.time()
                        panel_loaded = False
                        clean_name = re.sub(r'[^a-zA-Z0-9]', '', name).lower()
                        while time.time() - start_time < 5.0:
                            try:
                                h1_els = self.driver.find_elements(By.TAG_NAME, "h1")
                                h1_texts = [el.text for el in h1_els if el.text]
                                for txt in h1_texts:
                                    clean_txt = re.sub(r'[^a-zA-Z0-9]', '', txt).lower()
                                    if clean_name in clean_txt or clean_txt in clean_name:
                                        panel_loaded = True
                                        break
                                if panel_loaded:
                                    break
                            except:
                                pass
                            time.sleep(0.2)
                            
                        # Fallback: if H1 checks fail, check if any details panel element is present (e.g. phone or address)
                        if not panel_loaded:
                            try:
                                # Look for address or phone data item IDs in the page source
                                page_source_lower = self.driver.page_source.lower()
                                if "phone:tel:" in page_source_lower or "tel:" in page_source_lower or 'data-item-id="address"' in page_source_lower:
                                    panel_loaded = True
                                    log(f"H1 name mismatch but details panel content detected for {name}", "INFO")
                            except:
                                pass
                                
                        if not panel_loaded:
                            log(f"Dynamic wait for panel details timed out for {name}, proceeding", "WARNING")
                    except Exception as click_err:
                        log(f"Error clicking clinic link: {str(click_err)}", "WARNING")
                        continue
                    
                    # Extract details from the panel
                    clinic_data = self._extract_clinic_panel_details(name)
                    
                    if clinic_data:
                        results.append(clinic_data)
                        used_names.add(name)
                        log(f"Successfully extracted: {name}")
                        if on_clinic_found:
                            try:
                                on_clinic_found(clinic_data)
                            except Exception as cb_err:
                                log(f"Callback error: {cb_err}", "WARNING")
                    
                except Exception as e:
                    log(f"Error processing clinic {i+1}: {str(e)}", "WARNING")
                    continue
            
            log(f"Search complete: {len(results)} clinics extracted")
            return results
            
        except Exception as e:
            error_msg = f"Google Maps search failed: {str(e)}\n{traceback.format_exc()}"
            log(error_msg, "ERROR")
            return results

    def _extract_clinic_panel_details(self, clinic_name):
        """Extract details from the Google Maps clinic panel."""
        try:
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            
            # Extract website
            website = self._extract_website_from_panel(soup)
            
            # Extract phone
            phone = self._extract_phone_from_panel(soup)
            
            # Extract address
            address = self._extract_address_from_panel(soup)
            
            # Requirement: MUST have at least website or phone to proceed
            if not website and not phone:
                log(f"⚠️  REJECTED - No website and no phone: {clinic_name}", "WARNING")
                return None
            
            log(f"✓ Extracted: {clinic_name}", "OK")
            return {
                "name": clinic_name,
                "website": website or "",
                "phone": phone or "",
                "address": address or ""
            }
        except Exception as e:
            log(f"Error extracting panel details: {str(e)}", "WARNING")
            return None

    def _clean_google_url(self, url):
        """Clean redirect URLs from Google."""
        if not url:
            return ""
        if "/url?" in url or "google.com/url" in url:
            try:
                parsed = urllib.parse.urlparse(url)
                qs = urllib.parse.parse_qs(parsed.query)
                if 'q' in qs:
                    return qs['q'][0]
            except:
                pass
        # Skip google domain unless it's a redirect query
        if "google.com" in url or "google.co" in url or "google.ad" in url:
            return ""
        return url

    def _extract_website_from_panel(self, soup):
        """Extract website URL from Google Maps panel."""
        try:
            # Look for website link by data-item-id="authority" first
            authority_link = soup.find('a', {'data-item-id': 'authority'})
            if authority_link and authority_link.get('href'):
                href = authority_link.get('href')
                resolved = self._clean_google_url(href)
                if resolved:
                    return resolved

            # Fallback: scan all links
            for a in soup.find_all('a', href=True):
                href = a.get('href', '')
                resolved = self._clean_google_url(href)
                if resolved and not resolved.startswith('tel:') and not resolved.startswith('mailto:'):
                    return resolved
        except Exception as e:
            log(f"Error in website extraction: {str(e)}", "WARNING")
        return ""

    def _extract_phone_from_panel(self, soup):
        """Extract phone number from Google Maps panel with robust fallback."""
        try:
            # Search by data-item-id starting with phone:tel:
            phone_el = soup.find(lambda tag: tag.name in ['a', 'button', 'div'] and tag.has_attr('data-item-id') and tag['data-item-id'].startswith('phone:tel:'))
            if phone_el:
                item_id = phone_el['data-item-id']
                phone = item_id.replace('phone:tel:', '').strip()
                if phone:
                    return phone

            # Find phone number elements with tel:
            for a in soup.find_all('a', href=True):
                href = a.get('href', '')
                if href.startswith('tel:'):
                    phone = href.replace('tel:', '').strip()
                    if phone and len(phone) > 5:
                        return phone
            
            # Alternative: look for phone text in buttons/divs
            phone_buttons = soup.find_all(['button', 'div', 'span'], 
                                         {'data-item-id': lambda x: x and 'phone' in str(x).lower()})
            for btn in phone_buttons:
                text = btn.get_text(strip=True)
                if text and any(c.isdigit() for c in text):
                    return text
        except:
            pass
        return ""

    def _extract_address_from_panel(self, soup):
        """Extract address from Google Maps panel."""
        try:
            # 1. Look for data-item-id="address"
            address_el = soup.find(attrs={"data-item-id": "address"})
            if address_el:
                return address_el.get_text(strip=True)
            
            # 2. Look for button or div with data-item-id containing address
            address_el = soup.find(lambda tag: tag.has_attr('data-item-id') and 'address' in tag['data-item-id'].lower())
            if address_el:
                return address_el.get_text(strip=True)

            # 3. Look for address in various formats
            address_divs = soup.find_all(['div', 'span'], {'data-item-id': 'address'})
            if address_divs:
                return address_divs[0].get_text(strip=True)
            
            # Alternative approach: look for text that looks like an address
            for div in soup.find_all('div', class_=lambda x: x and 'address' in x.lower()):
                text = div.get_text(strip=True)
                if text and len(text) > 5:
                    return text
        except:
            pass
        return ""

    def _validate_website_url(self, website_url):
        """Validate that the website URL is genuine and accessible."""
        if not website_url:
            return False, "No URL provided"
        
        try:
            # Check URL format
            if not website_url.startswith('http'):
                website_url = 'https://' + website_url
            
            parsed = urllib.parse.urlparse(website_url)
            if not parsed.netloc:
                return False, "Invalid URL format"
            
            # Blacklist suspicious domains
            blacklist = ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'youtube.com', 
                        'whatsapp.com', 'telegram.org', 'maps.google.com', 'google.com']
            if any(bl in parsed.netloc.lower() for bl in blacklist):
                return False, "Social media/blacklisted domain"
            
            # Make HEAD request to check if URL is accessible
            try:
                response = requests.head(
                    website_url,
                    timeout=8,
                    allow_redirects=True,
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'},
                    verify=False
                )
                if response.status_code >= 400:
                    return False, f"HTTP {response.status_code}"
                return True, "Valid"
            except:
                # Fallback to GET request
                response = requests.get(
                    website_url,
                    timeout=8,
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'},
                    verify=False
                )
                if response.status_code >= 400:
                    return False, f"HTTP {response.status_code}"
                return True, "Valid"
                
        except Exception as e:
            return False, str(e)

    def _is_fake_email(self, email):
        """Check if email is obviously fake/test - STRICT VERSION."""
        fake_local_parts = [
            'example', 'test', 'sample', 'demo', 'your', 'dummy', 'fake',
            'temp', 'placeholder', 'noreply', 'no-reply', 'donotreply',
            'do-not-reply', 'notification', 'bounce', 'mailer-daemon',
            'sentry', 'privacy', 'domain', 'webmaster'
        ]
        fake_domains = [
            'example.com', 'example.org', 'example.net', 'test.com', 'localhost',
            'agencia365.com', 'agencia365.com.br', 'ndiscovered.com',
            'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'sharklasers.com',
            'wixpress.com', 'sentry.io'
        ]
        email_lower = email.lower()
        try:
            local, domain = email_lower.split('@')
        except ValueError:
            return True  # malformed
        # Check local part
        if local in fake_local_parts:
            return True
        # Check domain
        if domain in fake_domains:
            return True
        # Check for obvious fakes in local part prefix
        if any(email_lower.startswith(p + '@') for p in fake_local_parts):
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

    def _get_domain_from_url(self, url):
        """Extract main domain from URL."""
        try:
            parsed = urllib.parse.urlparse(url)
            domain = parsed.netloc.lower()
            # Remove www and subdomains for matching
            parts = domain.split('.')
            if len(parts) > 1:
                return '.'.join(parts[-2:])  # Get example.com from www.example.com
            return domain
        except:
            return ""

    def _email_matches_website(self, email, website_url):
        """Check if email domain matches the website domain (strict)."""
        try:
            domain_from_url = self._get_domain_from_url(website_url)
            if not domain_from_url:
                return False
            email_domain = email.split('@')[1].lower()
            # Exact match or subdomain match only
            return email_domain == domain_from_url or email_domain.endswith('.' + domain_from_url)
        except:
            return False

    def _extract_emails_from_html(self, html, website_url=None):
        """Extract and validate all real emails from raw HTML. Returns ranked list."""
        email_pattern = r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}'
        raw = set(re.findall(email_pattern, html))

        # Also decode obfuscated mailto: links
        mailto_pattern = r'mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})'
        raw.update(re.findall(mailto_pattern, html))

        valid = []
        domain_match = []
        preferred_prefixes = ['info', 'contact', 'hello', 'inquiry', 'enquiry',
                              'appointment', 'secretary', 'reception', 'admin',
                              'office', 'clinic', 'mail', 'support', 'team']

        junk_suffixes = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.js',
                         '.xml', '.pdf', '.ico', '.woff', '.ttf']
        junk_domains_contain = ['w3.org', 'xmlns', 'schema.org', 'sentry.io',
                                'googleapis.com', 'google.com', 'facebook.com',
                                'twitter.com', 'instagram.com', 'linkedin.com',
                                'apple.com', 'microsoft.com', 'adobe.com',
                                'wixpress.com', 'sentry', 'elementor', 'wordpress',
                                'cloudflare', 'github', 'git', 'localhost']

        for e in raw:
            if e.count('@') != 1 or len(e) > 120:
                continue
            if self._is_fake_email(e):
                continue
            e_lower = e.lower()
            if any(e_lower.endswith(s) for s in junk_suffixes):
                continue
            domain_part = e.split('@')[1].lower()
            if any(jd in domain_part for jd in junk_domains_contain):
                continue
            if domain_part.count('.') < 1:
                continue
            valid.append(e)
            if website_url and self._email_matches_website(e, website_url):
                domain_match.append(e)

        if not valid:
            return []

        # Sort: domain-matching first, then preferred prefix, then rest
        def rank(e):
            local = e.split('@')[0].lower()
            if e in domain_match and any(local.startswith(p) for p in preferred_prefixes):
                return 0
            if e in domain_match:
                return 1
            if any(local.startswith(p) for p in preferred_prefixes):
                return 2
            return 3

        return sorted(valid, key=rank)

    def extract_website_details(self, website_url, clinic_name="", city=""):
        """
        3-STEP EMAIL EXTRACTION:
          Step 1 — Scrape homepage
          Step 2 — Crawl contact / about pages if homepage had no email
          Step 3 — Google search fallback if website scraping failed entirely
        """
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        log(f"[EXTRACT_START] {clinic_name} | {website_url}", "INFO")

        if not website_url or not website_url.startswith('http'):
            log(f"[EXTRACT_FAIL] No valid URL for {clinic_name}", "WARNING")
            # Immediately try Google search fallback
            if clinic_name:
                email = self.search_email_on_google(clinic_name, city)
                if email:
                    log(f"[EXTRACT_GOOGLE_HIT] Found via Google: {email}", "OK")
                    return {"email": email, "status": "Verified", "validation": "Google-Search"}
            return {"email": "", "status": "Unverified", "validation": "No URL"}

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                          'AppleWebKit/537.36 (KHTML, like Gecko) '
                          'Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }

        # ── STEP 1: Homepage ──────────────────────────────────────────────
        homepage_html = ""
        try:
            resp = requests.get(website_url, timeout=12, headers=headers,
                                verify=False, allow_redirects=True)
            homepage_html = resp.text
            log(f"[STEP1] Fetched homepage ({len(homepage_html)} bytes)", "INFO")

            ranked = self._extract_emails_from_html(homepage_html, website_url)
            if ranked:
                email = ranked[0]
                log(f"[STEP1_HIT] Homepage email: {email}", "OK")
                return {"email": email, "status": "Verified", "validation": "Homepage"}
            else:
                log(f"[STEP1_MISS] No email on homepage for {clinic_name}", "INFO")
        except Exception as e:
            log(f"[STEP1_ERR] Homepage fetch failed for {clinic_name}: {e}", "WARNING")

        # ── STEP 2: Contact / About pages ────────────────────────────────
        log(f"[STEP2] Crawling sub-pages for {clinic_name}...", "INFO")
        email_from_sub = self._extract_from_contact_pages(website_url, homepage_html)
        if email_from_sub:
            log(f"[STEP2_HIT] Sub-page email: {email_from_sub}", "OK")
            return {"email": email_from_sub, "status": "Verified", "validation": "ContactPage"}
        else:
            log(f"[STEP2_MISS] No email on sub-pages for {clinic_name}", "INFO")

        # ── STEP 3: Google Search fallback ───────────────────────────────
        log(f"[STEP3] Trying Google search fallback for {clinic_name}...", "INFO")
        try:
            parsed = urllib.parse.urlparse(website_url)
            domain = parsed.netloc
            email_from_google = self.search_email_on_google(clinic_name, city, domain=domain)
            if email_from_google:
                log(f"[STEP3_HIT] Google email: {email_from_google}", "OK")
                return {"email": email_from_google, "status": "Verified",
                        "validation": "Google-Search"}
            else:
                log(f"[STEP3_MISS] Google search also returned nothing for {clinic_name}", "INFO")
        except Exception as e:
            log(f"[STEP3_ERR] Google search error: {e}", "WARNING")

        log(f"[EXTRACT_DONE] No email found after 3 steps for {clinic_name}", "WARNING")
        return {"email": "", "status": "Unverified", "validation": "Exhausted-All-Methods"}

    def _extract_from_contact_pages(self, homepage_url, html_content):
        """Crawl contact/about sub-pages to find real emails."""
        try:
            parsed_home = urllib.parse.urlparse(homepage_url)
            base_origin = f"{parsed_home.scheme}://{parsed_home.netloc}"
            soup = BeautifulSoup(html_content, 'html.parser')
            contact_links = set()

            # Expanded keywords to catch more contact pages
            keywords = [
                'contact', 'about', 'reach', 'email', 'touch', 'info',
                'support', 'help', 'feedback', 'inquiry', 'enquiry',
                'communicate', 'message', 'team', 'staff', 'clinic',
                'appointment', 'book', 'refer'
            ]

            for a in soup.find_all('a', href=True):
                href = a.get('href', '').strip()
                text = a.get_text(strip=True).lower()
                href_lower = href.lower()

                # Skip anchors, JS, external social links
                if not href or href.startswith('#') or href.startswith('javascript'):
                    continue
                if any(s in href_lower for s in ['facebook.', 'twitter.', 'instagram.', 'linkedin.', 'youtube.']):
                    continue

                is_contact = (any(kw in href_lower for kw in keywords) or
                              any(kw in text for kw in keywords))
                if is_contact:
                    try:
                        full_url = urllib.parse.urljoin(homepage_url, href)
                        p = urllib.parse.urlparse(full_url)
                        # Only same-domain links
                        if p.netloc != parsed_home.netloc:
                            continue
                        normalized = f"{p.scheme}://{p.netloc}{p.path}"
                        contact_links.add(normalized)
                    except:
                        pass

            # Always add hardcoded patterns as safety net
            for pattern in self.contact_page_patterns:
                contact_links.add(f"{base_origin}{pattern}")

            contact_links = list(contact_links)[:12]  # try up to 12 pages
            log(f"[STEP2] Scanning {len(contact_links)} sub-pages for {homepage_url}")

            request_headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                              'AppleWebKit/537.36 (KHTML, like Gecko) '
                              'Chrome/124.0.0.0 Safari/537.36'
            }

            for url in contact_links:
                try:
                    if url.rstrip('/') == homepage_url.rstrip('/'):
                        continue
                    resp = requests.get(url, timeout=8,
                                        headers=request_headers, verify=False)
                    if resp.status_code == 200:
                        ranked = self._extract_emails_from_html(resp.text, homepage_url)
                        if ranked:
                            log(f"[STEP2_HIT] Found '{ranked[0]}' on {url}", "OK")
                            return ranked[0]
                except Exception as sub_err:
                    log(f"[STEP2_SUB_ERR] {url}: {sub_err}", "WARNING")
                    continue

        except Exception as e:
            log(f"[STEP2_ERR] _extract_from_contact_pages: {e}", "WARNING")

        return ""

    def search_email_on_google(self, clinic_name, city, domain=None):
        """Google search fallback — tries 3 query patterns, uses strict email filter."""
        log(f"[GOOGLE_SEARCH] clinic={clinic_name}, city={city}, domain={domain}")

        # Build multiple query strategies for better coverage
        queries = []
        if domain:
            queries.append(f'site:{domain} email')
            queries.append(f'site:{domain} contact')
        if clinic_name:
            clean_name = clinic_name.replace('"', '')
            queries.append(f'"{clean_name}" {city} email')
            queries.append(f'"{clean_name}" contact email')

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                          'AppleWebKit/537.36 (KHTML, like Gecko) '
                          'Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.5'
        }

        for query in queries:
            try:
                search_url = f"https://www.google.com/search?q={urllib.parse.quote(query)}&num=5"

                # Try requests first (fast)
                try:
                    resp = requests.get(search_url, headers=headers, timeout=8)
                    if resp.status_code == 200:
                        ranked = self._extract_emails_from_html(resp.text, domain)
                        if ranked:
                            log(f"[GOOGLE_HIT_REQUESTS] '{ranked[0]}' via query: {query}", "OK")
                            return ranked[0]
                except Exception:
                    pass

                # Try Selenium if requests returned nothing (handles JS pages)
                if self.driver:
                    try:
                        self.driver.get(search_url)
                        time.sleep(2)
                        ranked = self._extract_emails_from_html(
                            self.driver.page_source, domain
                        )
                        if ranked:
                            log(f"[GOOGLE_HIT_SELENIUM] '{ranked[0]}' via query: {query}", "OK")
                            return ranked[0]
                    except Exception:
                        pass

            except Exception as e:
                log(f"[GOOGLE_SEARCH_ERR] query='{query}': {e}", "WARNING")
                continue

        log(f"[GOOGLE_SEARCH_MISS] No email found via Google for {clinic_name}", "INFO")
        return ""

    def _handle_cookie_consent(self):
        """Handle Google's cookie consent redirect or popup if it appears."""
        try:
            current_url = self.driver.current_url
            if "consent.google" in current_url:
                log("Redirected to Google Consent page. Attempting to accept...", "INFO")
                # Find buttons on Google consent page
                buttons = self.driver.find_elements(By.XPATH, "//button")
                for btn in buttons:
                    txt = btn.text.strip().lower()
                    if 'accept' in txt or 'agree' in txt or 'tout accepter' in txt or 'accept all' in txt:
                        self.driver.execute_script("arguments[0].click();", btn)
                        log("Consent page accepted.", "OK")
                        time.sleep(2)
                        break
            else:
                # Check for consent buttons on the page itself
                consent_buttons = self.driver.find_elements(By.XPATH, 
                    "//button[contains(text(), 'Accept all') or contains(text(), 'Agree') or contains(@aria-label, 'Accept')]"
                )
                if consent_buttons:
                    for btn in consent_buttons:
                        if btn.is_displayed():
                            self.driver.execute_script("arguments[0].click();", btn)
                            log("Cookie consent dialog accepted.", "OK")
                            time.sleep(1)
                            break
        except Exception as e:
            log(f"Error handling cookie consent: {e}", "WARNING")

    def close(self):
        """Properly close the WebDriver."""
        try:
            if self.driver:
                self.driver.quit()
                log("WebDriver closed successfully")
        except Exception as e:
            log(f"Error closing WebDriver: {str(e)}", "WARNING")
