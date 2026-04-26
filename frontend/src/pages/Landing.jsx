import React from 'react';
import { ArrowRight, Zap, Globe, Award, Eye, Link, BarChart3 } from 'lucide-react';

const Landing = ({ onStart }) => {
  const features = [
    { icon: <Zap size={20} />, title: "AI Route Planner", desc: "Dynamic pathfinding that considers current traffic, historical trends, and special events." },
    { icon: <Globe size={20} />, title: "Real-time Tracking", desc: "Live updates for every bus and metro line in the city. Know exactly when your ride is coming." },
    { icon: <Award size={20} />, title: "Rewards Ecosystem", desc: "Earn CityPoints for choosing off-peak times or eco-friendly routes. Redeem them for snacks or shopping." },
    { icon: <Eye size={20} />, title: "Crowd Transparency", desc: "View live 'busy-ness' scores for stations and carriages. Make informed choices for comfort." },
    { icon: <Link size={20} />, title: "Seamless Integration", desc: "Plan multi-modal trips combining Metro, Bus, and Walking in one unified interface." },
    { icon: <BarChart3 size={20} />, title: "Predictive Analytics", desc: "Plan your week ahead. Our AI predicts future congestion based on holiday schedules and weather." },
  ];

  return (
    <div className="flex flex-col items-center w-full">
      {/* Hero Section */}
      <section className="max-w-7xl w-full px-6 py-20 flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1 space-y-8">
          <div className="inline-flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full text-xs font-semibold text-gray-600">
            <Zap size={14} className="text-yellow-500" />
            AI-Powered Transit Optimization
          </div>
          <h1 className="text-6xl font-bold leading-tight">
            Travel Smarter.<br />Avoid the Crowd.
          </h1>
          <p className="text-xl text-gray-500 max-w-lg">
            CityFlow uses real-time AI to route you through the least congested paths. Save time, reduce stress, and earn rewards for travelling during off-peak hours.
          </p>
          <div className="flex gap-4">
            <button 
              onClick={onStart}
              className="bg-black text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-800 transition-all"
            >
              Plan my route <ArrowRight size={20} />
            </button>
            <button className="border border-gray-300 px-8 py-4 rounded-xl font-bold hover:bg-gray-50 transition-all">
              How it works
            </button>
          </div>
          <div className="flex items-center gap-4 pt-4">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-gray-200" />
              ))}
            </div>
            <span className="text-sm font-medium text-gray-500">
              <span className="text-black font-bold">12,000+</span> Bakunians travel smarter daily
            </span>
          </div>
        </div>
        <div className="flex-1 w-full aspect-square bg-gray-200 rounded-3xl overflow-hidden relative shadow-2xl">
           <div className="absolute top-6 left-6 bg-white p-4 rounded-2xl shadow-lg border border-gray-100 max-w-[200px]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-gray-400 uppercase">Live Updates</span>
              </div>
              <p className="text-xs font-medium">New congestion detected near Koroglu Station. AI routing updated.</p>
           </div>
           <div className="absolute bottom-6 right-6 bg-black text-white p-4 rounded-2xl shadow-xl border border-white/20">
              <div className="flex items-center gap-2 mb-1">
                <Award size={16} className="text-yellow-400" />
                <span className="text-xs font-bold">Points Earned!</span>
              </div>
              <p className="text-[10px] text-gray-400">+50 CityPoints for off-peak travel.</p>
           </div>
           {/* Placeholder for Map Visual */}
           <div className="w-full h-full bg-slate-300 flex items-center justify-center">
              <span className="text-gray-400 font-medium italic">Interactive Map Visual</span>
           </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl w-full px-6 py-24 bg-white border-y border-gray-100">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Everything you need for a better commute</h2>
          <p className="text-gray-500">We combine city-wide data with advanced neural networks to give you the most efficient travel experience Baku has to offer.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <div key={i} className="p-8 rounded-2xl border border-gray-100 hover:border-black transition-all group">
              <div className="bg-gray-50 w-12 h-12 rounded-xl flex items-center justify-center mb-6 group-hover:bg-black group-hover:text-white transition-all">
                {f.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl w-full px-6 py-24">
        <div className="bg-black rounded-3xl p-16 text-white flex flex-col items-center text-center space-y-8">
           <h2 className="text-5xl font-bold max-w-2xl leading-tight">Be rewarded for helping the city breathe.</h2>
           <p className="text-gray-400 max-w-xl text-lg">
             By choosing off-peak travel times suggested by our AI, you directly reduce peak-hour congestion for everyone. As a thank you, CityFlow awards you points for every "Green Trip."
           </p>
           <div className="flex gap-4">
             <button className="bg-white text-black px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition-all">Explore Rewards</button>
             <button className="border border-white/20 px-8 py-4 rounded-xl font-bold hover:bg-white/10 transition-all">Join as a Partner</button>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-12 pt-12 border-t border-white/10 w-full mt-12">
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold">12k</span>
                <span className="text-xs text-gray-500 uppercase font-bold tracking-widest mt-2">Daily Users</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold">4.9</span>
                <span className="text-xs text-gray-500 uppercase font-bold tracking-widest mt-2">App Rating</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold">5M</span>
                <span className="text-xs text-gray-500 uppercase font-bold tracking-widest mt-2">CO2 Saved (kg)</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold">30+</span>
                <span className="text-xs text-gray-500 uppercase font-bold tracking-widest mt-2">Local Partners</span>
              </div>
           </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
