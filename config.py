# config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-here')
    OSRM_API_URL = 'http://router.project-osrm.org/route/v1'
    OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter'
    GEOSERVER_URL = 'http://localhost:8080/geoserver' 
    
    # Map default center coordinates (Kathmandu)
    DEFAULT_LAT = 27.7172
    DEFAULT_LON = 85.3240
    DEFAULT_ZOOM = 13

    # Game settings
    LANDMARKS_REQUIRED = 5
    REWARD_POINTS = 100