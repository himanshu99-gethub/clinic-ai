import json, sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

with open('clinics_data.json', encoding='utf-8') as f:
    data = json.load(f)

missing = [c for c in data if not c.get('email','').strip()]
print(f"Missing emails: {len(missing)}")
for c in missing:
    print(f"  Name   : {c.get('name')}")
    print(f"  Website: {c.get('website')}")
    print(f"  Phone  : {c.get('phone')}")
    print(f"  City   : {c.get('city')}")
    print()
