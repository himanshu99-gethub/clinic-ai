from scraper import ClinicScraper

# Initialize scraper
scraper = ClinicScraper()

# Test with some known clinic websites
test_websites = [
    ("https://www.maxhealthcare.in", "Max Healthcare", "Delhi"),
    ("https://www.apollohospitals.com", "Apollo Hospitals", "India"),
    ("https://www.fortishealthcare.com", "Fortis Healthcare", "India"),
]

print("Testing Email Extraction from Clinic Websites\n" + "="*60)

for website, name, city in test_websites:
    print(f"\n🔍 Testing: {name}")
    print(f"   Website: {website}")
    try:
        result = scraper.extract_website_details(website, name, city)
        email = result.get("email", "")
        status = result.get("status", "Unknown")
        
        if email:
            print(f"   ✅ Found Email: {email}")
        else:
            print(f"   ❌ No Email Found")
        print(f"   Status: {status}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

print("\n" + "="*60)
print("Test Complete!")
scraper.close()
