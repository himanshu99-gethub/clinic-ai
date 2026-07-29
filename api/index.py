import os
import sys

# Add project root and backend to python path
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
backend_dir = os.path.join(root_dir, "backend")

if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import FastAPI app from backend/app.py
from backend.app import app

# Vercel Serverless Function entry point
app = app
