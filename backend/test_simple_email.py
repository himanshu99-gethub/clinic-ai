import re
import requests
from bs4 import BeautifulSoup
import time
import json

def find_email_simple(website_url, clinic_name):
    """Simple, direct email extraction from website."""
    
    email = ""
    
    try:
        # Fetch website
        response = requests.get(
            website_url,
            timeout=8,
            headers={'User-Agent': 'Mozilla/5.0'},
            verify=False
        )
        
        html = response.text
        
        # Extract ALL text content
        soup = BeautifulSoup(html, 'html.parser')
        
        # Remove scripts and styles
        for script in soup(["script", "style"]):
            script.decompose()
        
        text = soup.get_text()
        
        # Email regex - capture all potential emails
        email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        emails = set(re.findall(email_pattern, html + text))
        
        # Filter
        valid = []
        for e in emails:
            if e.count('@') == 1 and len(e) < 100:
                if not any(x in e.lower() for x in ['noreply', 'no-reply', '.png', '.jpg', '.svg', 'w3.org']):
                    valid.append(e)
        
        if valid:
            # Prefer contact/info emails
            preferred = [e for e in valid if any(x in e.lower() for x in ['info@', 'contact@', 'hello@', 'hello@', 'inquiry@', 'email@'])]
            email = preferred[0] if preferred else valid[0]
            print(f"✅ Found: {email}")
            return email
        else:
            print(f"❌ No email found")
            return ""
            
    except Exception as e:
        print(f"Error: {e}")
        return ""

# Test on the clinics we have
clinics = [
    ("http://www.london-gynaecology.com/clinics/the-portland-hospital", "London Gynaecology at The Portland Hospital"),
    ("https://www.harleystreetgynaecology.com/", "Harley Street Gynaecology"),
    ("http://www.london-gynaecology.com/", "London Gynaecology Moorgate"),
    ("https://gghealthcare.uk/", "Grosvenor Gardens"),
    ("https://www.london-gynaecology.com/", "London Gynaecology Harley Street"),
    ("https://www.womanfirst.co.uk/", "Woman First"),
    ("https://www.aristogp.co.uk/", "AristoGP"),
]

print("Testing Email Extraction\n" + "="*60)
found_count = 0

for website, name in clinics:
    print(f"\n🔍 {name}")
    print(f"   URL: {website}")
    result = find_email_simple(website, name)
    if result:
        found_count += 1

print(f"\n" + "="*60)
print(f"✅ Found emails in {found_count}/{len(clinics)} websites")
