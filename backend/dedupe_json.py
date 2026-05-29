import json
import os

DATA_FILE = os.path.join(os.path.dirname(__file__), 'clinics_data.json')

def dedupe():
    if not os.path.exists(DATA_FILE):
        print("Data file not found.")
        return
        
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Original records: {len(data)}")
    
    # ── Enforce Single Specialization ──
    spec_counts = {}
    for clinic in data:
        spec = clinic.get('specialization', '').strip().lower()
        if spec:
            spec_counts[spec] = spec_counts.get(spec, 0) + 1
            
    target_spec = max(spec_counts, key=spec_counts.get) if spec_counts else None
    if target_spec:
        print(f"[SPECIALIZATION] Enforcing single specialization: '{target_spec}'")
        data = [c for c in data if c.get('specialization', '').strip().lower() == target_spec]
        print(f"[SPECIALIZATION] Kept {len(data)} matching records.")
        
    unique_data = []
    seen_names = set()
    seen_websites = set()
    seen_emails = set()
    seen_phones = set()
    
    def clean_web(url):
        if not url:
            return ""
        return url.replace("https://", "").replace("http://", "").replace("www.", "").rstrip("/")
        
    def clean_phone(ph):
        if not ph:
            return ""
        return ph.replace("+", "").replace(" ", "").replace("-", "").strip().lower()
    
    for clinic in data:
        name = clinic.get('name', '').strip().lower()
        website = clean_web(clinic.get('website', ''))
        email = clinic.get('email', '').strip().lower()
        phone = clean_phone(clinic.get('phone', ''))
        
        is_duplicate = False
        
        if name in seen_names:
            is_duplicate = True
        elif website and website in seen_websites:
            is_duplicate = True
        elif email and email in seen_emails:
            is_duplicate = True
        elif phone and phone in seen_phones:
            is_duplicate = True
            
        if not is_duplicate:
            unique_data.append(clinic)
            seen_names.add(name)
            if website:
                seen_websites.add(website)
            if email:
                seen_emails.add(email)
            if phone:
                seen_phones.add(phone)
                
    print(f"Unique records after strict name/phone/website/email dedupe: {len(unique_data)}")
    print(f"Removed {len(data) - len(unique_data)} duplicates.")
    
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(unique_data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    dedupe()
