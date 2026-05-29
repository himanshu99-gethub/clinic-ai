import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

def test_frontend():
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
    
    # Enable browser log capturing
    options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

    driver = webdriver.Chrome(options=options)
    try:
        url = "http://localhost:5173/"
        print(f"Navigating to {url}...")
        driver.get(url)
        time.sleep(5)
        
        # Scroll down to make table visible
        driver.execute_script("window.scrollBy(0, 800);")
        time.sleep(1)
        
        # Save screenshot to brain directory
        brain_dir = r"C:\Users\shaky\.gemini\antigravity\brain\2702ff24-3238-4056-9055-b2d08c280d42"
        os.makedirs(brain_dir, exist_ok=True)
        screenshot_path = os.path.join(brain_dir, "frontend_debug_large.png")
        driver.save_screenshot(screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")
        
        # Get console logs
        logs = driver.get_log('browser')
        print("--- Browser Console Logs ---")
        for log in logs:
            print(f"[{log['level']}] {log['message']}")
        print("----------------------------")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    test_frontend()
