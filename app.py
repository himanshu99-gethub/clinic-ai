import sys
import os

# Add backend directory to python path so internal backend imports work
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
sys.path.insert(0, backend_path)

# Import the flask app from the backend package
from backend.app import app

if __name__ == '__main__':
    app.run()
