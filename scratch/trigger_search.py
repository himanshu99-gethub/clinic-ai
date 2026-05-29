import requests
import time

url = "http://localhost:5000/api/search"
payload = {
    "city": "London",
    "country": "United Kingdom",
    "specialization": "Dermatology",
    "auto_outreach": False
}

print("Triggering search...")
r = requests.post(url, json=payload)
print(f"Status Code: {r.status_code}")
print(r.json())

# Wait and poll for stats/logs to verify progress
for i in range(18):
    time.sleep(15)
    stats_r = requests.get("http://localhost:5000/api/stats")
    logs_r = requests.get("http://localhost:5000/api/logs?limit=8")
    print(f"\n--- Poll {i+1} ---")
    print(f"Stats: {stats_r.json()}")
    print("Recent Logs:")
    for log_entry in logs_r.json():
        print(f"  {log_entry['timestamp']} - {log_entry['message']}")
