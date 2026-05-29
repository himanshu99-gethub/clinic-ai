#!/usr/bin/env python3
"""
Utility script to manually test the clinic discovery and outreach APIs.
"""
import requests
import json

API_BASE = "http://localhost:5000/api"

def test_health():
    """Test backend health."""
    print("\n[1] Testing Backend Health...")
    try:
        response = requests.get(f"{API_BASE}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Backend is healthy")
            print(f"   Database: {data.get('database')}")
            print(f"   Clinics: {data.get('clinics_count')}")
            return True
        else:
            print(f"❌ Backend error: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return False

def test_search():
    """Test clinic discovery."""
    print("\n[2] Testing Clinic Discovery...")
    try:
        data = {
            "city": "Lucknow",
            "country": "India",
            "specialization": "Dentist",
            "auto_outreach": False
        }
        print(f"   Searching for: {data['specialization']} in {data['city']}, {data['country']}")
        response = requests.post(f"{API_BASE}/search", json=data, timeout=10)
        if response.status_code in [200, 202]:
            print(f"✅ Discovery initiated")
            print(f"   {response.json().get('message')}")
            return True
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_get_clinics():
    """Get discovered clinics."""
    print("\n[3] Fetching Discovered Clinics...")
    try:
        response = requests.get(f"{API_BASE}/clinics", timeout=5)
        if response.status_code == 200:
            clinics = response.json()
            print(f"✅ Found {len(clinics)} clinics")
            if clinics:
                for clinic in clinics[:3]:
                    print(f"   - {clinic.get('name')} ({clinic.get('city')})")
                    print(f"     Email: {clinic.get('email', 'N/A')}")
                    print(f"     Status: {clinic.get('status')}")
            return True
        else:
            print(f"❌ Error: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_stats():
    """Get discovery statistics."""
    print("\n[4] Fetching Statistics...")
    try:
        response = requests.get(f"{API_BASE}/stats", timeout=5)
        if response.status_code == 200:
            stats = response.json()
            print(f"✅ Statistics:")
            print(f"   Total: {stats.get('total')}")
            print(f"   Verified: {stats.get('verified')}")
            print(f"   Unverified: {stats.get('unverified')}")
            print(f"   Contacted: {stats.get('contacted')}")
            print(f"   Pending: {stats.get('pending')}")
            return True
        else:
            print(f"❌ Error: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_logs():
    """Get activity logs."""
    print("\n[5] Fetching Activity Logs...")
    try:
        response = requests.get(f"{API_BASE}/logs?limit=5", timeout=5)
        if response.status_code == 200:
            logs = response.json()
            print(f"✅ Last {len(logs)} activities:")
            for log in logs:
                print(f"   [{log.get('timestamp')}] {log.get('message')}")
            return True
        else:
            print(f"❌ Error: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("CLINIC DISCOVERY - API TEST SUITE")
    print("=" * 60)
    
    # Run tests
    if test_health():
        test_get_clinics()
        test_stats()
        test_logs()
        print("\n" + "=" * 60)
        print("To initiate a clinic discovery scan, uncomment the test_search() call")
        # test_search()  # Uncomment to run a discovery scan
    
    print("=" * 60)
