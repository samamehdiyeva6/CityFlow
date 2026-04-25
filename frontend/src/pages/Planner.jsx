import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, MapPin, Clock, Info, Zap, AlertTriangle, Train } from 'lucide-react';

const API_BASE_URL = "http://127.0.0.1:8000";

const Planner = () => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [time, setTime] = useState('08:30');
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locations, setLocations] = useState({});
  const [traffic, setTraffic] = useState({ rush_hours: [] });
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [travelModeActive, setTravelModeActive] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState('');
  const [walletPoints, setWalletPoints] = useState(null);
  const [bakikartBalance, setBakikartBalance] = useState(null);
  const [pendingPeakDecision, setPendingPeakDecision] = useState(false);
  const [alternativeBusLabel, setAlternativeBusLabel] = useState('');

  useEffect(() => {
    fetchLocations();
    fetchTraffic();
    fetchProfile();
  }, []);

  const fetchLocations = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/locations`);
      setLocations(res.data);
    } catch (err) {
      console.error("Error fetching locations", err);
    }
  };

  const fetchTraffic = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/traffic`);
      setTraffic(res.data || { rush_hours: [] });
    } catch (err) {
      setTraffic({ rush_hours: [] });
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/user/profile`);
      setWalletPoints(res.data?.wallet?.points ?? null);
      setBakikartBalance(res.data?.wallet?.bakikart_balance ?? null);
    } catch {
      setWalletPoints(null);
      setBakikartBalance(null);
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
      setSelectedRoute(null);
      setTravelModeActive(false);
      setPendingPeakDecision(false);
      setDecisionMessage('');
    } catch (err) {
      setError("Marşrut tapılmadı. Zəhmət olmasa başqa yer seçin.");
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  };

  const getRouteMeta = (route) => {
    const typeText = String(route.type || '').toLowerCase();
    const idText = String(route.id || '');
    const isMetro = typeText.includes('metro') || idText.toLowerCase().includes('metro');

    if (isMetro) {
      const metroName = route.line_name || `${route.start} - ${route.end}`;
      return { mode: 'Metro', name: metroName, isMetro: true };
    }

    const busNumber = route.route_number || (/^\d+$/.test(idText) ? idText : 'N/A');
    return { mode: 'Avtobus', name: `No ${busNumber}`, isMetro: false };
  };

  const isRushHour = () => {
    const current = time || '08:30';
    const toMinutes = (v) => {
      const [h, m] = v.split(':').map(Number);
      return h * 60 + m;
    };
    const now = toMinutes(current);

    const windows = Array.isArray(traffic?.rush_hours) ? traffic.rush_hours : [];
    return windows.some((window) => {
      const parts = String(window).split('-');
      if (parts.length !== 2) return false;
      const startM = toMinutes(parts[0]);
      const endM = toMinutes(parts[1]);
      return now >= startM && now <= endM;
    });
  };

  const findAlternativeBus = (route) => {
    const selectedId = String(route?.id || '');
    const alternative = routes.find((r) => {
      const typeText = String(r?.type || '').toLowerCase();
      const idText = String(r?.id || '');
      const isMetro = typeText.includes('metro') || idText.toLowerCase().includes('metro');
      return !isMetro && idText !== selectedId;
    });

    if (!alternative) return '';
    const busNumber = alternative.route_number || alternative.id || 'N/A';
    return `No ${busNumber}`;
  };

  const submitJourneyDecision = async (route, waited) => {
    setDecisionLoading(true);
    try {
      const effectiveTime = waited ? addMinutesToTime(time, 15) : time;
      const res = await axios.post(`${API_BASE_URL}/journey/decision`, {
        start,
        end,
        route,
        selected_time: effectiveTime,
        waited,
        wait_minutes: 15,
      });

      setWalletPoints(res.data?.wallet_points ?? walletPoints);
      setBakikartBalance(res.data?.bakikart_balance ?? bakikartBalance);
      setDecisionMessage(res.data?.message || (waited ? 'Gözləmə qərarı qeydə alındı.' : 'Səfər başladı.'));
      setTravelModeActive(true);
      setPendingPeakDecision(false);
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Qərar yaddaşa yazılmadı.';
      setDecisionMessage(msg);
      setPendingPeakDecision(false);
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleSelectRoute = (route) => {
    if (travelModeActive) {
      return;
    }

    setSelectedRoute(route);
    setDecisionMessage('');

    if (isRushHour()) {
      setPendingPeakDecision(true);
      setTravelModeActive(false);
      setAlternativeBusLabel(findAlternativeBus(route));
      return;
    }

    submitJourneyDecision(route, false);
  };

  const addMinutesToTime = (hhmm, plusMinutes) => {
    const [hh, mm] = String(hhmm || '08:30').split(':').map(Number);
    const total = (hh * 60 + mm + plusMinutes) % (24 * 60);
    const outH = String(Math.floor(total / 60)).padStart(2, '0');
    const outM = String(total % 60).padStart(2, '0');
    return `${outH}:${outM}`;
  };

  const deactivateTravelMode = () => {
    setTravelModeActive(false);
    setSelectedRoute(null);
    setPendingPeakDecision(false);
    setDecisionMessage('Səyahət modu deaktiv edildi. Yeni route seçə bilərsiniz.');
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left Sidebar - Form */}
      <div className="w-[400px] bg-white border-r border-gray-200 flex flex-col h-full">
        <div className="p-6">
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
                <span>{time}</span>
              </div>
              <input 
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 rounded-xl border-none text-sm focus:ring-2 focus:ring-black"
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

      {/* Right Sidebar - Results */}
      <div className="w-[420px] bg-white border-l border-gray-200 flex flex-col h-full">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-widest">Optimal Routes</h3>
          <span className="text-xs text-gray-400 font-medium">{routes.length} paths found</span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
          {walletPoints !== null && (
            <div className="p-3 rounded-xl bg-black text-white text-xs font-semibold">
              Wallet Balance: {walletPoints} pts
            </div>
          )}

          {bakikartBalance !== null && (
            <div className="p-3 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700">
              BakiKart Balance: {Number(bakikartBalance).toFixed(2)} AZN
            </div>
          )}

          {travelModeActive && selectedRoute && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
              <p className="text-xs font-bold uppercase mb-1">Səyahət Modu Aktivdir</p>
              <p className="text-sm">Seçilmiş marşrut: {selectedRoute.start} → {selectedRoute.end}</p>
              <button
                onClick={deactivateTravelMode}
                className="mt-3 bg-white border border-emerald-300 text-emerald-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-emerald-100"
              >
                Deaktiv et və route dəyiş
              </button>
            </div>
          )}

          {pendingPeakDecision && selectedRoute && (
            <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 space-y-3">
              <p className="text-xs font-bold uppercase">Pik saat tövsiyəsi</p>
              <p className="text-sm leading-relaxed">
                Hazırda pik saatdır. 15 dəqiqə gözləyib {alternativeBusLabel || 'alternativ avtobusa'} minsəniz əlavə +{selectedRoute.bonus_points || 0} point qazanacaqsınız.
              </p>
              <div className="flex gap-2">
                <button
                  disabled={decisionLoading}
                  onClick={() => submitJourneyDecision(selectedRoute, true)}
                  className="bg-black text-white px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  Gözləyirəm (+point)
                </button>
                <button
                  disabled={decisionLoading}
                  onClick={() => submitJourneyDecision(selectedRoute, false)}
                  className="bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  İndi minirəm (0 point)
                </button>
              </div>
            </div>
          )}

          {decisionMessage && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm">
              {decisionMessage}
            </div>
          )}

          {error && <div className="text-red-500 text-sm p-4 bg-red-50 rounded-xl">{error}</div>}

          {!error && routes.length === 0 && !loading && (
            <div className="text-sm text-gray-500 p-4 bg-white rounded-xl border border-gray-100">
              Marşrut nəticələri burada görünəcək.
            </div>
          )}

          {routes.map((route, i) => {
            const meta = getRouteMeta(route);
            const isSelected = selectedRoute && route.id === selectedRoute.id;
            const isDisabledByTravelMode = travelModeActive && !isSelected;

            return (
              <div key={i} className={`p-5 rounded-2xl bg-white border-2 transition-all ${isDisabledByTravelMode ? 'opacity-45' : 'cursor-pointer'} ${isSelected ? 'border-emerald-500' : i === 0 ? 'border-black' : 'border-transparent hover:border-gray-200'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold">{route.eta} <span className="text-sm font-medium text-gray-400">min</span></span>
                    {i === 0 && <span className="bg-gray-100 text-[10px] font-bold px-2 py-1 rounded-md uppercase">AI Recommended</span>}
                  </div>
                  <div className="flex gap-1">
                    {meta.isMetro ? (
                      <div className="bg-purple-100 text-purple-600 p-1.5 rounded-lg"><Train size={16} /></div>
                    ) : (
                      <div className="bg-orange-100 text-orange-600 p-1.5 rounded-lg"><Zap size={16} /></div>
                    )}
                  </div>
                </div>

                <div className="mb-3 text-xs font-semibold text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-400 uppercase mr-2">Növ:</span>{meta.mode}
                  <span className="mx-2 text-gray-300">|</span>
                  <span className="text-gray-400 uppercase mr-2">Ad/Nömrə:</span>{meta.name}
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
                  <button
                    disabled={decisionLoading || isDisabledByTravelMode || (travelModeActive && !isSelected)}
                    onClick={() => handleSelectRoute(route)}
                    className="bg-black text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-40"
                  >
                    {isSelected ? 'Selected' : 'Select Route'}
                  </button>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                    <Clock size={14} /> <span>Wait 15m for +{route.bonus_points} pts</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Planner;
