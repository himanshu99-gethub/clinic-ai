from pymongo import MongoClient
import os

def clear_data():
    """Clear existing clinic data from MongoDB."""
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        client.server_info()
        db = client["clinic_discovery"]
        clinics_collection = db["clinics"]

        # Clear existing data
        count = clinics_collection.count_documents({})
        clinics_collection.delete_many({})
        print(f"✅ Successfully cleared {count} clinics from the database.")
        
    except Exception as e:
        print(f"❌ Error connecting to MongoDB: {e}")

if __name__ == "__main__":
    print("[SEED DATA] - Data Clearing Tool")
    print("=" * 60)
    print("This tool clears mock data from MongoDB.")
    print("Use 'python seed_data.py' to clean the database.")
    print("=" * 60)
    clear_data()
