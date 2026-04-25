import React from 'react';
import { Train, Map, Gift, Shield, User } from 'lucide-react';

const Navbar = ({ currentPage, onNavigate, points }) => {
  const navItems = [
    { id: 'landing', label: 'How it works', icon: null },
    { id: 'planner', label: 'Route Planner', icon: Map },
    { id: 'rewards', label: 'Rewards', icon: Gift },
    { id: 'system', label: 'System & AI', icon: Shield },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 px-6 flex items-center justify-between">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('landing')}>
        <div className="bg-black text-white p-1.5 rounded-lg">
          <Train size={24} />
        </div>
        <span className="font-bold text-xl tracking-tight">BakuKart</span>
      </div>

      <div className="flex items-center gap-8">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`text-sm font-medium transition-colors ${
              currentPage === item.id ? 'text-black' : 'text-gray-500 hover:text-black'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end mr-2">
          <span className="text-xs font-bold text-gray-500 uppercase">{points} pts</span>
          <span className="text-[10px] text-green-600 font-medium">Premium Member</span>
        </div>
        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200">
          <User size={20} className="text-gray-600" />
        </div>
        <button className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
          Get Started
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
