#!/usr/bin/env python3
"""
Utility to view real-time activity logs from the clinic discovery backend.
"""
import requests
import time

API_BASE = "http://localhost:5000/api"

def display_logs(limit=20, follow=False):
    """Display logs from the backend."""
    print("=" * 70)
    print("CLINIC DISCOVERY - ACTIVITY LOG VIEWER")
    print("=" * 70)
    
    last_count = 0
    
    try:
        while True:
            try:
                response = requests.get(f"{API_BASE}/logs?limit={limit}", timeout=5)
                if response.status_code == 200:
                    logs = response.json()
                    
                    # Clear screen and show logs
                    if len(logs) > last_count:
                        # New logs appeared
                        print(f"\n[{time.strftime('%H:%M:%S')}] Activity Log ({len(logs)} entries):")
                        print("-" * 70)
                        
                        for log in logs:
                            timestamp = log.get('timestamp', 'N/A')
                            message = log.get('message', log.get('text', 'Unknown'))
                            
                            # Color-code by status
                            if '✅' in message or 'OK' in message:
                                status_icon = '✅'
                            elif '❌' in message or 'ERROR' in message:
                                status_icon = '❌'
                            elif '⚠️' in message or 'WARNING' in message:
                                status_icon = '⚠️'
                            elif '🚀' in message:
                                status_icon = '🚀'
                            else:
                                status_icon = '•'
                            
                            print(f"{status_icon} [{timestamp}] {message}")
                        
                        last_count = len(logs)
                        
                        if not follow:
                            break
                    
                    if follow:
                        time.sleep(2)
                else:
                    print(f"Error: {response.status_code}")
                    break
                    
            except Exception as e:
                print(f"Connection error: {e}")
                if follow:
                    print("Retrying in 3 seconds...")
                    time.sleep(3)
                else:
                    break
                    
    except KeyboardInterrupt:
        print("\n\nLog viewer stopped.")

if __name__ == "__main__":
    import sys
    
    follow_mode = "--follow" in sys.argv or "-f" in sys.argv
    
    if follow_mode:
        print("Running in FOLLOW mode (press Ctrl+C to stop)...")
        display_logs(limit=50, follow=True)
    else:
        display_logs(limit=30, follow=False)
