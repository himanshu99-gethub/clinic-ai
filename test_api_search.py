#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://127.0.0.1:8081"

print(f"Testing API at {BASE_URL}")

# Test 1: Health check
print("\n=== Testing Health Check ===")
try:
    response = requests.get(f"{BASE_URL}/api", timeout=5)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")

# Test 2: Trigger Search
print("\n=== Triggering Search ===")
try:
    search_data = {
        "city": "London",
        "specialization": "Gynecologist",
        "country": "UK"
    }
    response = requests.post(
        f"{BASE_URL}/api/search",
        json=search_data,
        timeout=5
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")

# Test 3: Get clinics (after waiting)
print("\n=== Waiting 5 seconds then checking clinics ===")
time.sleep(5)

try:
    response = requests.get(f"{BASE_URL}/api/clinics", timeout=5)
    print(f"Status: {response.status_code}")
    clinics = response.json()
    print(f"Clinics found: {len(clinics)}")
    if clinics:
        print(f"First clinic: {clinics[0]}")
except Exception as e:
    print(f"Error: {e}")
