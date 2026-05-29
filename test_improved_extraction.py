#!/usr/bin/env python3
"""Test improved email extraction"""
import sys
sys.path.insert(0, 'c:/Users/shaky/OneDrive/Desktop/clinic ai/backend')

from scraper import ClinicScraper

# Initialize scraper (without driver needed for this test)
scraper = ClinicScraper()

# Test websites that should have emails
test_sites = [
    ("https://gghealthcare.uk/", "Grosvenor Gardens Gynaecology"),
    ("https://obgynmatters.co.uk/", "ObGyn Matters"),
    ("https://www.gynae-centre.co.uk/", "The Gynae Centre"),
    ("https://www.aristogp.co.uk/", "AristoGP"),
    ("https://www.centralhealthlondon.com/", "Central Health London"),
]

print("Testing improved email extraction:\n")
for url, name in test_sites:
    result = scraper.extract_website_details(url, name, "London")
    email = result.get("email", "")
    status = "✓" if email else "✗"
    print(f"{status} {name:40s} | {url:45s} | {email}")

print("\n\nDone.")
