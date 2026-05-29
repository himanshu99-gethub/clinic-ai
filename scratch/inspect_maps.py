import time
import sys
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

def log(msg):
    print(f"[INSPECT] {msg}", flush=True)

try:
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
    options.add_argument("--window-size=1920,1080")
    
    driver = webdriver.Chrome(options=options)
    log("Driver started.")
    
    url = "https://www.google.com/maps/search/Dentist+in+London"
    log(f"Navigating to {url}")
    driver.get(url)
    time.sleep(5)
    
    links = driver.find_elements(By.CLASS_NAME, "hfpxzc")
    log(f"Initial links: {len(links)}")
    
    if len(links) > 0:
        first_clinic = links[0]
        first_name = first_clinic.get_attribute('aria-label')
        log(f"Clicking: {first_name}")
        
        start_time = time.time()
        driver.execute_script("arguments[0].click();", first_clinic)
        
        # Wait dynamically for h1 to match first_name
        for _ in range(30): # up to 3 seconds
            try:
                h1_els = driver.find_elements(By.TAG_NAME, "h1")
                h1_texts = [el.text for el in h1_els if el.text]
                log(f"All h1 texts: {h1_texts}")
                
                matched = False
                for txt in h1_texts:
                    if first_name.lower() in txt.lower():
                        log(f"Matched h1: '{txt}' in {time.time() - start_time:.2f} seconds!")
                        matched = True
                        break
                if matched:
                    break
            except Exception as e:
                log(f"Exception: {e}")
            time.sleep(0.2)
            
    driver.quit()
    log("Done.")
except Exception as e:
    log(f"Error: {e}")
