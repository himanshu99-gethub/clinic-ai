import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from scraper import ClinicScraper

def mock_callback(clinic):
    print(f"--> Mock Callback Triggered: {clinic['name']}", flush=True)

try:
    print("Initializing test...")
    scraper = ClinicScraper()
    print("Running Map search with callback...")
    # Search for a very specific query that returns fast
    results = scraper.search_google_maps("dental clinic in vashi navi mumbai", on_clinic_found=mock_callback)
    print(f"Results list size: {len(results)}")
    scraper.close()
    print("Test finished successfully.")
except Exception as e:
    print(f"Test failed with error: {e}")
