import requests
import sys

# Configure stdout/stderr to use UTF-8 encoding
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

try:
    stats_r = requests.get("http://localhost:5000/api/stats")
    print(f"Stats: {stats_r.json()}")
    
    logs_r = requests.get("http://localhost:5000/api/logs?limit=15")
    print("\nRecent Logs:")
    for log_entry in logs_r.json():
        msg = log_entry['message'].encode('ascii', errors='replace').decode('ascii')
        print(f"  {log_entry['timestamp']} - {msg}")
except Exception as e:
    print(f"Error: {e}")
