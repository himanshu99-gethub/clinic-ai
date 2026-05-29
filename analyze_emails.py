import json

with open('backend/clinics_data.json') as f:
    data = json.load(f)

total = len(data)
with_email = sum(1 for c in data if c.get('email', '').strip())
success_rate = (with_email / total * 100) if total > 0 else 0

print(f"Total clinics: {total}")
print(f"With emails: {with_email}")
print(f"Success rate: {success_rate:.1f}%")
print(f"\nClinics with emails:")
for clinic in data:
    if clinic.get('email', '').strip():
        print(f"  - {clinic['name']}: {clinic['email']}")
