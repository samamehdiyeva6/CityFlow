import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, MapPin, Clock, Info, ChevronRight, Award, Zap, AlertTriangle } from 'lucide-react';

const API_BASE_URL = "http://127.0.0.1:8000";

const Planner = () => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [time, setTime] = useState('08:30');
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locations, setLocations] = useState({});

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/locations`);
      setLocations(res.data);
    } catch (err) {
      console.error("Error fetching locations", err);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/plan`, {
        params: { start, end, time }
      });
      setRoutes(res.data);
    } catch (err) {
      setError("Marşrut tapılmadı. Zəhmət olmasa başqa yer seçin.");
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Sidebar - Form & Results */}
      <div className="w-[450px] bg-white border-r border-gray-200 flex flex-col h-full">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
             <MapPin size={20} /> Plan Journey
          </h2>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <div className="w-2 h-2 rounded-full border-2 border-gray-400" />
              </div>
              <select 
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl border-none text-sm focus:ring-2 focus:ring-black appearance-none"
              >
                <option value="">Start Location</option>
                {Object.keys(locations).map(id => (
                  <option key={id} value={locations[id].name}>{locations[id].name}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <MapPin size={16} className="text-red-500" />
              </div>
              <select 
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl border-none text-sm focus:ring-2 focus:ring-black appearance-none"
              >
                <option value="">Destination</option>
                {Object.keys(locations).map(id => (
                  <option key={id} value={locations[id].name}>{locations[id].name}</option>
                ))}
              </select>
            </div>
            
            <div className="pt-2">
              <div className="flex justify-between text-xs font-bold text-gray-400 uppercase mb-3">
                <span>Time Window</span>
                <span>{time} AM</span>
              </div>
              <input 
                type="range" 
                min="06:00" 
                max="23:59" 
                step="30"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
              />
            </div>

            <button 
              type="submit"
              disabled={loading || !start || !end}
              className="w-full bg-black text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all disabled:opacity-50"
            >
              {loading ? "Searching..." : "Find Best Routes"} <Search size={18} />
            </button>
          </form>

          <div className="mt-6 p-4 bg-orange-50 border border-orange-100 rounded-xl flex gap-3">
             <AlertTriangle size={20} className="text-orange-500 shrink-0" />
             <p className="text-[11px] text-orange-800 font-medium">
               <span className="font-bold">Peak Hour Warning</span><br />
               Metro lines M1 & M2 are currently at 95% capacity. AI suggests delaying departure by 15m for 40% less crowding.
             </p>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
          <div className="flex items-center justify-between mb-2">
             <h3 className="font-bold text-sm text-gray-400 uppercase tracking-widest">Optimal Routes</h3>
             <span className="text-xs text-gray-400 font-medium">{routes.length} paths found</span>
          </div>

          {error && <div className="text-red-500 text-sm p-4 bg-red-50 rounded-xl">{error}</div>}
          
          {routes.map((route, i) => (
            <div key={i} className={`p-5 rounded-2xl bg-white border-2 transition-all cursor-pointer ${i === 0 ? 'border-black' : 'border-transparent hover:border-gray-200'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold">{route.eta} <span className="text-sm font-medium text-gray-400">min</span></span>
                  {i === 0 && <span className="bg-gray-100 text-[10px] font-bold px-2 py-1 rounded-md uppercase">AI Recommended</span>}
                </div>
                <div className="flex gap-1">
                   {route.type === 'Metro' ? <div className="bg-purple-100 text-purple-600 p-1.5 rounded-lg"><Train size={16} /></div> : <div className="bg-orange-100 text-orange-600 p-1.5 rounded-lg"><Zap size={16} /></div>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Crowding</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${route.crowding > 70 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${route.crowding}%` }} />
                    </div>
                    <span className="text-xs font-bold">{route.crowding}%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Confidence</span>
                  <div className="flex items-center gap-2">
                     <span className="text-xs font-bold">{route.confidence}%</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl flex gap-2 mb-4">
                 <Info size={14} className="text-gray-400 shrink-0 mt-0.5" />
                 <p className="text-[11px] text-gray-600 italic leading-relaxed">{route.explanation}</p>
              </div>

              <div className="flex items-center justify-between pt-2">
                 <button className="bg-black text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-800 transition-colors">Select Route</button>
                 <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                    <Clock size={14} /> <span>Wait 15m for +{route.bonus_points} pts</span>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map View Area */}
      <div className="flex-1 bg-slate-200 relative">
         <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-medium italic">
            Map Interface (Leaflet Integration)
         </div>
         
         {/* Map Overlays */}
         <div className="absolute top-6 left-6 flex flex-col gap-2">
            <button className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center font-bold text-lg">+</button>
            <button className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center font-bold text-lg">-</button>
            <button className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center mt-2"><MapPin size={20} /></button>
         </div>

         <div className="absolute top-6 right-6 flex flex-col gap-2">
            <div className="bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-100 flex items-center gap-3">
               <div className="w-3 h-1 bg-black rounded-full" />
               <span className="text-[10px] font-bold uppercase tracking-wider">AI Recommended Path</span>
            </div>
            <div className="bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-100 flex items-center gap-3">
               <div className="w-3 h-1 bg-purple-500 rounded-full" />
               <span className="text-[10px] font-bold uppercase tracking-wider">Metro M2 Line</span>
            </div>
         </div>

         {/* Congestion Forecast Overlay */}
         <div className="absolute bottom-6 left-6 right-6 h-32 bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-4">
            <div className="flex justify-between items-center mb-2">
               <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">City-Wide Congestion Forecast</h4>
               <div className="flex gap-4">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase"><div className="w-2 h-2 rounded-full bg-black" /> Density %</div>
                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase"><div className="w-2 h-2 rounded-full bg-green-500" /> Reward Multiplier</div>
               </div>
            </div>
            <div className="w-full h-16 bg-gray-100 rounded-lg flex items-end px-2 gap-1 overflow-hidden">
               {/* Simplified Forecast Graph */}
               {Array.from({ length: 24 }).map((_, i) => (
                 <div key={i} className="flex-1 bg-black/10 rounded-t-sm" style={{ height: `${Math.sin(i / 3) * 40 + 50}%` }} />
               ))}
            </div>
            <div className="flex justify-between mt-1 text-[8px] font-bold text-gray-400 px-1 uppercase tracking-widest">
               <span>08:15</span>
               <span>08:30</span>
               <span>08:45</span>
               <span>09:00</span>
               <span>09:15</span>
               <span>09:30</span>
               <span>09:45</span>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Planner;
