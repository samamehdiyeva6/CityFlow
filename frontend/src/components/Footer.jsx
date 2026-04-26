import React from 'react';
import { Train, Mail, Phone, MapPin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-200 pt-16 pb-8 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        <div className="col-span-1 md:col-span-1 space-y-6">
          <div className="flex items-center gap-2">
            <div className="bg-black text-white p-1.5 rounded-lg">
              <Train size={20} />
            </div>
            <span className="font-bold text-lg tracking-tight">CityFlow</span>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            Bakı şəhəri üçün süni intellekt əsaslı nəqliyyat planlayıcısı. Sıxlıqdan qaçın, vaxtınıza qənaət edin və hər səfərdə mükafatlar qazanın.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-sm uppercase tracking-widest mb-6">Platforma</h4>
          <ul className="space-y-4 text-sm text-gray-500">
            <li><a href="#" className="hover:text-black transition-colors">Marşrut Planlayıcı</a></li>
            <li><a href="#" className="hover:text-black transition-colors">Mükafatlar Sistemi</a></li>
            <li><a href="#" className="hover:text-black transition-colors">Real-vaxt Xəritə</a></li>
            <li><a href="#" className="hover:text-black transition-colors">AI Analitika</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-sm uppercase tracking-widest mb-6">Şirkət</h4>
          <ul className="space-y-4 text-sm text-gray-500">
            <li><a href="#" className="hover:text-black transition-colors">Haqqımızda</a></li>
            <li><a href="#" className="hover:text-black transition-colors">Tərəfdaşlıq</a></li>
            <li><a href="#" className="hover:text-black transition-colors">Karyera</a></li>
            <li><a href="#" className="hover:text-black transition-colors">Blog</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-sm uppercase tracking-widest mb-6">Əlaqə</h4>
          <ul className="space-y-4 text-sm text-gray-500">
            <li className="flex items-center gap-3"><Mail size={16} /> support@cityflow.az</li>
            <li className="flex items-center gap-3"><Phone size={16} /> *2024</li>
            <li className="flex items-center gap-3 leading-relaxed"><MapPin size={16} className="shrink-0" /> Bakı, Azərbaycan<br />Heydər Əliyev pr. 115</li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium text-gray-400 uppercase tracking-widest">
        <p>© 2024 CityFlow AI. Bütün hüquqlar qorunur.</p>
        <div className="flex gap-8">
          <a href="#" className="hover:text-black transition-colors">Məxfilik Siyasəti</a>
          <a href="#" className="hover:text-black transition-colors">İstifadə Şərtləri</a>
          <a href="#" className="hover:text-black transition-colors">Cookie Siyasəti</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
