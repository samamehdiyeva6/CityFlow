from services.data_service import data_service
from services.gemini_service import gemini_service
import math
import datetime

class RoutingService:
    async def find_routes(self, start_name, end_name, desired_time=None):
        all_routes = data_service.get_all_routes()
        locations = data_service.get_all_locations()
        traffic = data_service.get_traffic_data()
        
        matches = []
        
        # 1. Get AI suggestions first (proactive)
        ai_suggestions = await gemini_service.get_ai_suggestions(start_name, end_name, desired_time or "now")
        if ai_suggestions:
            matches.extend(ai_suggestions)

        # 2. Look for direct matches in existing routes
        for route_id, route_info in all_routes.items():
            if route_info['start'].lower() == start_name.lower() and route_info['end'].lower() == end_name.lower():
                matches.append(self._format_route(route_id, route_info, "Direct"))
            elif route_info['start'].lower() == end_name.lower() and route_info['end'].lower() == start_name.lower():
                # Reverse route if possible, but path needs reversing too
                reversed_route = route_info.copy()
                reversed_route['start'], reversed_route['end'] = reversed_route['end'], reversed_route['start']
                reversed_route['path'] = reversed_route['path'][::-1]
                matches.append(self._format_route(route_id, reversed_route, "Direct (Return)"))

        # 2. Look for Metro connections
        metro_data = data_service.get_metro_data()
        start_station = next((s for s in metro_data['stations'] if s['name'].lower() == start_name.lower()), None)
        end_station = next((s for s in metro_data['stations'] if s['name'].lower() == end_name.lower()), None)
        
        if start_station and end_station:
            # Simple metro route (assuming linear or basic connection for now)
            matches.append({
                "id": "metro_line",
                "type": "Metro",
                "start": start_station['name'],
                "end": end_station['name'],
                "cost": metro_data['fare'],
                "eta": 20, # Default for demo
                "path": [ [start_station['lat'], start_station['lng']], [end_station['lat'], end_station['lng']] ],
                "explanation": "Ən etibarlı və sürətli seçim.",
                "crowding": 45,
                "confidence": 98,
                "bonus_points": 10
            })

        # Apply scoring and explanation based on traffic
        is_rush = self._is_rush_hour(desired_time)
        for route in matches:
            if is_rush:
                route['crowding'] += 30
                route['eta'] = int(route['eta'] * 1.4)
                route['explanation'] = "Pik saatdır, alternativ vaxt seçərək bonus qazana bilərsiniz."
                route['bonus_points'] += 50
            
        # Return top 3 matches
        return matches[:3]

    def _format_route(self, route_id, route_info, route_type):
        return {
            "id": route_id,
            "type": route_type,
            "start": route_info['start'],
            "end": route_info['end'],
            "cost": route_info['cost'],
            "eta": route_info['eta'],
            "path": route_info['path'],
            "explanation": "Standart marşrut.",
            "crowding": 20,
            "confidence": 95,
            "bonus_points": 20
        }

    def _is_rush_hour(self, time_str=None):
        if not time_str:
            now = datetime.datetime.now().time()
        else:
            try:
                now = datetime.datetime.strptime(time_str, "%H:%M").time()
            except:
                now = datetime.datetime.now().time()
        
        traffic = data_service.get_traffic_data()
        for rush in traffic['rush_hours']:
            start, end = rush.split('-')
            start_time = datetime.datetime.strptime(start, "%H:%M").time()
            end_time = datetime.datetime.strptime(end, "%H:%M").time()
            if start_time <= now <= end_time:
                return True
        return False

routing_service = RoutingService()
