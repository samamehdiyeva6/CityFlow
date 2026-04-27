import sys
import os

# Add the 'backend' directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app
