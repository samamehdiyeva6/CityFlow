import json
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")

def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "r", encoding="utf-8-sig") as f:
        return json.load(f)

class DataService:
    def __init__(self):
        self.locations = load_json("locations.json")
        self.metro = load_json("metro.json")
        self.pricing = load_json("pricing.json")
        self.routes = load_json("routes.json")
        self.routes_core = load_json("routes_core.json")
        self.routes_express = load_json("routes_express.json")
        self.routes_suburbs = load_json("routes_suburbs.json")
        self.traffic = load_json("traffic.json")

    def get_all_locations(self):
        return self.locations

    def get_metro_data(self):
        return self.metro

    def get_traffic_data(self):
        return self.traffic

    def get_all_routes(self):
        # Combine all route types
        all_routes = {}
        all_routes.update(self.routes_core)
        all_routes.update(self.routes_express)
        all_routes.update(self.routes_suburbs)
        # Some routes might be in routes.json too
        all_routes.update(self.routes)
        return all_routes

data_service = DataService()
