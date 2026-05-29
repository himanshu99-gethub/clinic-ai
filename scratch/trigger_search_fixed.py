import requests
import time
import sys

# Configure stdout/stderr to use UTF-8 encoding
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

url = "http://localhost:5000/api/search"
payload = {
    "city": "London",
    "country": "United Kingdom",
    "specialization": "Dermatology",
    "auto_outreach": False
}

print("Checking current status...")
stats_r = requests.get("http://localhost:5000/api/stats")
print(f"Current Stats: {stats_r.json()}")

# Wait and poll for stats/logs to verify progress
for i in range(12):
    time.sleep(15)
    stats_r = requests.get("http://localhost:5000/api/stats")
    logs_r = requests.get("http://localhost:5000/api/logs?limit=8")
    print(f"\n--- Poll {i+1} ---")
    print(f"Stats: {stats_r.json()}")
    print("Recent Logs:")
    for log_entry in logs_r.json():
        print(f"  {log_entry['timestamp']} - {log_entry['message']}")
