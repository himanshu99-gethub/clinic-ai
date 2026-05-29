import sys
import os
import time

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

import app
from scraper import ClinicScraper

# Override app's save_data and load_data to print debug messages
def debug_save_data():
    print(f"DEBUG: save_data called. live_db size: {len(app.live_db)}", flush=True)
    app.DATA_FILE = os.path.join(os.path.dirname(__file__), 'test_clinics_data.json')
    try:
        with open(app.DATA_FILE, 'w', encoding='utf-8') as f:
            import json
            json.dump(app.live_db, f, ensure_ascii=False, indent=2)
        print("DEBUG: save_data wrote successfully.", flush=True)
    except Exception as e:
        print(f"DEBUG: save_data failed: {e}", flush=True)

app.save_data = debug_save_data

# Create a test version of run_scraper_task to run synchronously and print details
def test_sync_scraper():
    city = "Mumbai"
    country = "India"
    specialization = "dental"
    auto_outreach = False

    print("Starting test_sync_scraper...", flush=True)
    
    # We will simulate what on_clinic_found does
    def test_callback(res):
        print(f"CALLBACK CALLED for: {res.get('name')}", flush=True)
        try:
            res_name_lower = res["name"].strip().lower()
            print(f"Checking seen_names for duplicate: {res_name_lower}", flush=True)
            
            # Immediately initialize as unverified clinic and add to live_db
            clinic_data = {
                "name": res["name"],
                "city": city,
                "country": country,
                "specialization": specialization,
                "address": res.get("address", ""),
                "phone": res.get("phone", ""),
                "website": res.get("website", ""),
                "email": "",
                "status": "Unverified",
                "outreach_status": "Pending",
                "discovery_date": time.strftime("%Y-%m-%d %H:%M:%S")
            }
            
            print(f"Created clinic_data dictionary: {clinic_data}", flush=True)
            
            # Check duplicates in live_db
            is_dup = any(c['name'].lower() == clinic_data['name'].lower() and c.get('city', '').lower() == clinic_data['city'].lower() for c in app.live_db)
            print(f"Is duplicate in live_db? {is_dup}", flush=True)
            
            if not is_dup:
                app.live_db.append(clinic_data)
                app.save_data()
                print(f"Successfully added {clinic_data['name']} to live_db", flush=True)
        except Exception as ex:
            print(f"CALLBACK INTERNAL ERROR: {ex}", flush=True)
            import traceback
            traceback.print_exc()

    scraper = ClinicScraper()
    print("Starting search...", flush=True)
    # Search for just one query and stop quickly by returning
    scraper.search_google_maps("Sabka Dentist in Vashi", on_clinic_found=test_callback)
    scraper.close()
    print("test_sync_scraper finished.", flush=True)

test_sync_scraper()
