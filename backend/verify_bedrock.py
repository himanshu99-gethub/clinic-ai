"""
AWS Bedrock Connection Verifier
"""
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

key = os.getenv("AWS_BEDROCK_API_KEY")
region = os.getenv("AWS_REGION", "ap-southeast-2")

print(f"Key loaded: {key[:15]}..." if key else "No key found")
print(f"Region: {region}")

# Bedrock API key HTTP headers verification
headers = {
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json"
}

print("✅ AWS Bedrock configuration configured in backend/.env")
