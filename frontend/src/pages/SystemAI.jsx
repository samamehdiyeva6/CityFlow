import React from 'react';
import { Shield, Cpu, Database, Activity, Server, Zap, Globe, Lock } from 'lucide-react';

const SystemAI = () => {
  return (
    <div className="max-w-7xl mx-auto px-6 py-20">
      <div className="mb-20">
        <div className="inline-flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full text-[10px] font-bold uppercase mb-4">
           Technical Specification
        </div>
        <h1 className="text-5xl font-bold mb-6">The Intelligence Behind BakuKart</h1>
        <p className="text-xl text-gray-500 max-w-2xl leading-relaxed">
          BakuKart leverages a state-of-the-art AI stack to synchronize millions of commute paths. Our system predicts congestion 60 minutes in advance, enabling a smarter, rewards-driven transport network.
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-12">
           {[
             { label: "Predictions/Sec", value: "45k+", icon: <Zap size={20} /> },
             { label: "Data Sources", value: "12", icon: <Database size={20} /> },
             { label: "Latency", value: "<120ms", icon: <Activity size={20} /> },
             { label: "Avg Confidence", value: "94.8%", icon: <Shield size={20} /> },
           ].map((stat, i) => (
             <div key={i} className="bg-white p-8 rounded-3xl border border-gray-100 flex flex-col items-center text-center">
                <div className="text-gray-400 mb-4">{stat.icon}</div>
                <div className="text-3xl font-bold mb-1">{stat.value}</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</div>
             </div>
           ))}
        </div>
      </div>

      <section className="mb-20">
        <h2 className="text-3xl font-bold mb-12">System Ecosystem</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {[
             { 
               title: "Data Foundation", 
               icon: <Database size={24} />, 
               items: ["GTFS Real-time", "IoT Sensors", "Fleet Telemetry", "Weather API", "Historical Logs"] 
             },
             { 
               title: "Engine Core", 
               icon: <Cpu size={24} />, 
               items: ["Routing Engine", "Congestion Model", "User Profiling", "Geospatial Index"] 
             },
             { 
               title: "Delivery Layer", 
               icon: <Server size={24} />, 
               items: ["API Gateway", "Reward Ledger", "Push Service", "iOS/Android", "Web App"] 
             },
           ].map((box, i) => (
             <div key={i} className="bg-white p-10 rounded-3xl border border-gray-100 border-t-4 border-t-black">
                <div className="mb-6">{box.icon}</div>
                <h3 className="text-xl font-bold mb-6">{box.title}</h3>
                <div className="flex flex-wrap gap-2">
                   {box.items.map((item, j) => (
                     <span key={j} className="bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500">{item}</span>
                   ))}
                </div>
             </div>
           ))}
        </div>
      </section>

      <section className="bg-black text-white rounded-3xl p-16 flex flex-col md:flex-row items-center gap-16">
         <div className="flex-1 space-y-8">
            <h2 className="text-4xl font-bold leading-tight">24/7 Monitoring & Governance</h2>
            <p className="text-gray-400 text-lg">
              Our operations team oversees system health via a dedicated monitoring gateway. We prioritize data privacy and algorithmic fairness, ensuring BakuKart serves every citizen equitably.
            </p>
            <ul className="space-y-4">
               {[
                 "Real-time drift detection for ML models",
                 "Anonymized data handling (GDPR compliant)",
                 "Automatic failover to legacy routing if AI confidence drops",
                 "Public transparency reports on congestion reduction"
               ].map((item, i) => (
                 <li key={i} className="flex items-center gap-3 text-sm font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> {item}
                 </li>
               ))}
            </ul>
         </div>
         <div className="flex-1 w-full aspect-video bg-white/10 rounded-2xl border border-white/20 flex items-center justify-center italic text-gray-500">
            System Health Dashboard Visual
         </div>
      </section>
    </div>
  );
};

export default SystemAI;
