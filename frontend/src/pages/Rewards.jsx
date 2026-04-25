import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Award, Zap, History, Target, Settings, ChevronRight, ShoppingBag, Gift } from 'lucide-react';

const API_BASE_URL = "http://127.0.0.1:8000";

const Rewards = ({ profile }) => {
  const [coupons, setCoupons] = useState([]);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/coupons`);
      setCoupons(res.data);
    } catch (err) {
      console.error("Error fetching coupons", err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header Stat Card */}
      <div className="bg-black text-white rounded-3xl p-10 flex flex-col md:flex-row justify-between items-center gap-12 mb-12 relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase mb-4">
             <Award size={12} className="text-yellow-400" /> Bronze Member <span className="text-gray-400 ml-2">Joined Feb 2024</span>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-7xl font-bold">{profile?.wallet?.points || 0}</h2>
            <span className="text-xl font-medium text-gray-400">pts</span>
          </div>
          <p className="text-gray-400 mt-4 max-w-xs">
            You've saved <span className="text-white font-bold">{profile?.wallet?.co2_saved || 0}kg of CO2</span> and avoided {profile?.wallet?.peak_crowds_avoided || 0} peak-hour crowds this month.
          </p>
        </div>
        
        <div className="w-full md:w-80 relative z-10">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
             <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Next Tier</span>
                <span className="text-xs font-bold">Silver Status</span>
             </div>
             <div className="text-right mb-2">
                <span className="text-xs font-bold">750 pts to go</span>
             </div>
             <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-white" style={{ width: '60%' }} />
             </div>
             <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                <span>Bronze</span>
                <span>Silver (2000 pts)</span>
             </div>
          </div>
        </div>

        {/* Decorative Circles */}
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left: Activity & Challenges */}
        <div className="lg:col-span-2 space-y-12">
          {/* Activity Feed */}
          <section>
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold flex items-center gap-2"><History size={20} /> Activity Feed</h3>
               <button className="text-xs font-bold text-gray-400 uppercase hover:text-black">Full History</button>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
               {[
                 { title: "28 May to Koroglu", date: "Today, 08:45 AM", pts: "+45 pts", type: "AI Suggested" },
                 { title: "Espresso Baku - Flat White", date: "Yesterday, 04:20 PM", pts: "-150 pts", type: "Spent" },
                 { title: "Icherisheher to Elmler Akademiyasi", date: "24 May, 06:15 PM", pts: "+60 pts", type: "Off-peak Reward" },
               ].map((item, i) => (
                 <div key={i} className="flex items-center justify-between p-6 border-b border-gray-50 last:border-none hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400">
                          {item.pts.startsWith('+') ? <Zap size={20} className="text-yellow-500" /> : <ShoppingBag size={20} className="text-blue-500" />}
                       </div>
                       <div>
                          <h4 className="font-bold text-sm">{item.title}</h4>
                          <p className="text-xs text-gray-400 mt-1">{item.date} • <span className="font-bold text-gray-300 uppercase text-[9px] tracking-widest">{item.type}</span></p>
                       </div>
                    </div>
                    <span className={`font-bold ${item.pts.startsWith('+') ? 'text-green-600' : 'text-gray-900'}`}>{item.pts}</span>
                 </div>
               ))}
            </div>
          </section>

          {/* Redeem Points Marketplace */}
          <section>
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold flex items-center gap-2"><Gift size={20} /> Redeem Points</h3>
               <div className="flex gap-2">
                  <button className="bg-gray-100 text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase">Marketplace</button>
                  <button className="text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase text-gray-400">My Coupons</button>
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {coupons.map((coupon, i) => (
                 <div key={i} className="bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all cursor-pointer group">
                    <div className="h-40 bg-gray-100 relative">
                       <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1.5">
                          <Award size={10} className="text-yellow-500" /> Partner Favorite
                       </div>
                    </div>
                    <div className="p-6">
                       <h4 className="font-bold text-lg mb-1">{coupon.partner_name}</h4>
                       <p className="text-gray-500 text-sm mb-4">{coupon.description}</p>
                       <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                          <span className="text-xs text-gray-400">Valid for 30 days</span>
                          <button className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 group-hover:gap-4 transition-all">
                             {coupon.cost_points} pts <ChevronRight size={14} />
                          </button>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
          </section>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-12">
           <section>
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Target size={20} /> Weekly Challenges</h3>
              <div className="space-y-4">
                 {[
                   { title: "Night Owl", desc: "Take 5 trips after 8:00 PM", pts: "+250", progress: 60 },
                   { title: "Sustainability Champ", desc: "Save 10kg of CO2", pts: "+500", progress: 40 },
                 ].map((c, i) => (
                   <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100">
                      <div className="flex justify-between items-start mb-4">
                         <div>
                            <h4 className="font-bold text-sm">{c.title}</h4>
                            <p className="text-[11px] text-gray-400 mt-1">{c.desc}</p>
                         </div>
                         <span className="text-xs font-bold text-green-600">{c.pts}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                         <div className="h-full bg-black" style={{ width: `${c.progress}%` }} />
                      </div>
                   </div>
                 ))}
                 <button className="w-full py-4 text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-black">View All Challenges</button>
              </div>
           </section>

           <section>
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings size={20} /> Quick Settings</h3>
              <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
                 {[
                   { label: "Notifications & Alerts", status: "2 New" },
                   { label: "Points Redemptions", status: null },
                   { label: "Privacy & Opt-ins", status: null },
                 ].map((s, i) => (
                   <div key={i} className="flex items-center justify-between p-5 border-b border-gray-50 last:border-none hover:bg-gray-50 cursor-pointer">
                      <span className="text-sm font-medium text-gray-600">{s.label}</span>
                      <div className="flex items-center gap-2">
                         {s.status && <span className="bg-gray-100 text-[9px] font-bold px-2 py-1 rounded-md uppercase text-gray-400">{s.status}</span>}
                         <ChevronRight size={16} className="text-gray-300" />
                      </div>
                   </div>
                 ))}
              </div>
           </section>
        </div>
      </div>
    </div>
  );
};

export default Rewards;
