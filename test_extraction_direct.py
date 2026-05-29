#!/usr/bin/env python3
"""Test email extraction directly on websites from scraped data"""

import re
import requests
from bs4 import BeautifulSoup
import json

# Websites from the last batch of scraped clinics
WEBSITES = [
    "http://www.hscfw.co.uk/",
    "https://www.centralhealthlondon.com/",
    "https://londonprestigematernitycentre.com/",
    "http://messinaclinic.co.uk/",
    "https://drduncanbirth.co.uk/",
    "https://www.harleystreetgynaecology.com/",
    "http://www.london-gynaecology.com/",
    "https://gghealthcare.uk/",
    "https://www.london-gynaecology.com/",
]

def extract_email(website_url):
    """Extract email from website"""
    print(f"\n{'='*60}")
    print(f"Testing: {website_url}")
    print(f"{'='*60}")
    
    try:
        response = requests.get(
            website_url,
            timeout=10,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'},
            verify=False,
            allow_redirects=True
        )
        
        html = response.text
        print(f"✓ Fetched {len(html)} bytes")
        
        # Extract text with BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        for script in soup(["script", "style"]):
            script.decompose()
        
        text = soup.get_text()
        print(f"✓ Extracted {len(text)} chars of text")
        
        # Find emails
        email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        emails = set(re.findall(email_pattern, html + " " + text))
        
        print(f"✓ Found {len(emails)} email-like strings: {list(emails)[:5]}")
        
        # Filter
        valid = []
        for e in emails:
            if e.count('@') != 1:
                continue
            if len(e) > 100:
                continue
            if any(x in e.lower() for x in ['noreply', 'no-reply', '.png', '.jpg', '.svg', '.gif', 'w3.org', 'xmlns']):
                continue
            domain = e.split('@')[1].lower()
            if domain.count('.') < 1:
                continue
            valid.append(e)
        
        print(f"✓ Valid emails: {valid}")
        
        if valid:
            # Prefer contact/info emails
            preferred = [e for e in valid if any(x in e.lower() for x in ['info@', 'contact@', 'hello@', 'inquiry@', 'email@', 'appointment@'])]
            email = preferred[0] if preferred else valid[0]
            print(f"✅ RESULT: {email}")
            return email
        else:
            print(f"❌ No valid email found")
            return None
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return None

print("Testing email extraction on actual websites...")

results = {}
for website in WEBSITES:
    email = extract_email(website)
    results[website] = email

print(f"\n\n{'='*60}")
print("SUMMARY")
print(f"{'='*60}")
for website, email in results.items():
    status = "✅" if email else "❌"
    print(f"{status} {website}: {email or 'NO EMAIL'}")

found = sum(1 for e in results.values() if e)
print(f"\nTotal: {found}/{len(WEBSITES)} websites with emails")
