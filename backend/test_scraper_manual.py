from scraper import ClinicScraper
import time

try:
    print("Initializing Scraper Test...")
    scraper = ClinicScraper()
    print("Searching Google Maps for 'Dentist in Lucknow'...")
    results = scraper.search_google_maps("Dentist in Lucknow")
    print(f"Found {len(results)} results!")
    for i, res in enumerate(results[:3]):
        print(f"{i+1}. {res['name']}")
    scraper.close()
    print("Test Complete.")
except Exception as e:
    print(f"FAILED: {e}")
