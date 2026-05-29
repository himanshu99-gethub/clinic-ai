import json

with open('clinics_data.json', encoding='utf-8') as f:
    data = json.load(f)

total = len(data)
with_email = [c for c in data if c.get('email', '').strip()]
without_email = [c for c in data if not c.get('email', '').strip()]

print(f"Total clinics: {total}")
print(f"With email:    {len(with_email)}")
print(f"Without email: {len(without_email)}")
print("\n--- Sample WITHOUT email ---")
for c in without_email[:5]:
    print(f"  {c.get('name')} | website: {c.get('website','N/A')}")
print("\n--- Sample WITH email ---")
for c in with_email[:5]:
    print(f"  {c.get('name')} | {c.get('email')}")
