import google.generativeai as genai
import os
import json
from dotenv import load_dotenv
from services.data_service import data_service

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

class GeminiService:
    def __init__(self):
        load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
        api_key = os.getenv("GEMINI_API_KEY")
        self.enabled = bool(api_key) and os.getenv("ENABLE_GEMINI_SUGGESTIONS", "0") == "1"
        self.model = None

        if self.enabled:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')

    async def get_ai_suggestions(self, start_name, end_name, time_str):
        if not self.enabled or not self.model:
            return []

        all_routes = data_service.get_all_routes()
        locations = data_service.get_all_locations()
        traffic = data_service.get_traffic_data()
        
        # Prepare context for Gemini
        context = {
            "locations": locations,
            "available_routes_sample": list(all_routes.values())[:10], # Sample for context
            "traffic_rules": traffic,
            "request": {
                "from": start_name,
                "to": end_name,
                "time": time_str
            }
        }

        prompt = f"""
        Sən CityFlow tətbiqinin ağıllı nəqliyyat köməkçisisən. 
        Aşağıdakı məlumatlara əsasən istifadəçi üçün ən yaxşı 3 marşrut təklifi hazırlamalısan.
        
        İstifadəçi {start_name} nöqtəsindən {end_name} nöqtəsinə saat {time_str}-da getmək istəyir.
        
        Bakı şəhərinin nəqliyyat qaydalarını, pik saatlarını (rush hours) və mövcud marşrutları nəzərə al.
        Pik saatlarda off-peak təklifləri ver və bonus xalları ilə həvəsləndir.
        
        Məlumat bazası:
        {json.dumps(context, indent=2)}
        
        Cavabı mütləq aşağıdakı JSON formatında qaytar (yalnız JSON, başqa mətn olmasın):
        [
          {{
            "id": "ai_route_1",
            "type": "AI Suggested",
            "start": "{start_name}",
            "end": "{end_name}",
            "cost": 0.60,
            "eta": 25,
            "path": [[lat, lng], [lat, lng]],
            "explanation": "Niyə bu yol? (Azərbaycan dilində)",
            "crowding": 30,
            "confidence": 95,
            "bonus_points": 50
          }}
        ]
        """

        try:
            response = self.model.generate_content(prompt)
            # Extract JSON from response (sometimes Gemini adds markdown code blocks)
            text = response.text.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            
            return json.loads(text)
        except Exception as e:
            print(f"Gemini API Error: {e}")
            return []

gemini_service = GeminiService()
