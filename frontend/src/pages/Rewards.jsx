import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Award, Zap, History, ChevronRight, ShoppingBag, Gift, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { getMembershipTier } from '../utils/membership';
import espressoImage from '../../images/espresso-coffee-recipe04-500x375.webp';
import costaImage from '../../images/images.jpeg';
import scooterImage from '../../images/skuter-by-lxj-466-11-133-10-elektron-skuterlr-35573-39-K.jpg';
import bikeImage from '../../images/velosiped.jpg';
import { API_BASE_URL } from '../config/api';

const Rewards = ({ profile, membershipTier, onRefreshProfile }) => {
  const [coupons, setCoupons] = useState([]);
  const [userCoupons, setUserCoupons] = useState([]);
  const [activeTab, setActiveTab] = useState('shop'); // 'shop' or 'my-coupons'
  const [purchaseStatus, setPurchaseStatus] = useState({ loading: false, error: null, success: null });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const email = profile?.email || localStorage.getItem('signedInEmail') || '';

  useEffect(() => {
    if (!email) return;
    fetchUserCoupons(email);
  }, [email]);

  const fetchCoupons = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/coupons`);
      setCoupons(res.data);
    } catch (err) {
      console.error("Error fetching coupons", err);
    }
  };

  const fetchUserCoupons = async (userEmail) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/user/coupons`, {
        params: { email: userEmail },
      });
      setUserCoupons(res.data);
    } catch (err) {
      console.error("Error fetching user coupons", err);
    }
  };

  const handlePurchase = async (couponId) => {
    setPurchaseStatus({ loading: true, error: null, success: null });
    try {
      const res = await axios.post(`${API_BASE_URL}/coupons/purchase/${couponId}`, null, {
        params: { email },
      });
      setPurchaseStatus({ 
        loading: false, 
        error: null, 
        success: `Təbriklər! Promo kodunuz: ${res.data.promo_code}` 
      });
      // Refresh user coupons list
      if (email) fetchUserCoupons(email);
      // Refresh global profile points without reloading the whole page
      if (onRefreshProfile) onRefreshProfile();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || "Alış zamanı xəta baş verdi";
      setPurchaseStatus({ loading: false, error: errorMsg, success: null });
      setTimeout(() => setPurchaseStatus(prev => ({ ...prev, error: null })), 4000);
    }
  };

  const points = Number(profile?.wallet?.points || 0);
  const tier = membershipTier || getMembershipTier(points);
  const nextTierTarget = points < 1000 ? 1000 : points < 2000 ? 2000 : points < 5000 ? 5000 : 10000;
  const pointsToNextTier = Math.max(0, nextTierTarget - points);
  const progress = Math.max(0, Math.min(100, Math.round((points / nextTierTarget) * 100)));
  const joinedLabel = profile?.joined_at
    ? new Date(profile.joined_at).toLocaleDateString('az-AZ', { month: 'short', year: 'numeric' })
    : 'Yeni';

  const activityFeed = [
    ...(profile?.history || []).map((item) => ({
      id: `journey-${item.id}`,
      title: `${item.start_location || 'Başlanğıc'} → ${item.end_location || 'Təyinat'}`,
      date: item.timestamp,
      value: Number(item.points_earned || 0),
      type: 'Səfər',
    })),
  ]
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 8);

  const formatActivityDate = (value) => {
    if (!value) return 'Naməlum vaxt';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Naməlum vaxt';
    return d.toLocaleString('az-AZ');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('az-AZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const resolveCouponImage = (coupon) => {
    const partner = String(coupon?.partner_name || '').toLowerCase();
    if (partner.includes('espresso')) return espressoImage;
    if (partner.includes('costa')) return costaImage;
    if (partner.includes('skuter')) return scooterImage;
    if (partner.includes('velosiped')) return bikeImage;
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header Stat Card */}
      <div className="bg-black text-white rounded-3xl p-10 flex flex-col md:flex-row justify-between items-center gap-12 mb-12 relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase mb-4">
             <Award size={12} className="text-yellow-400" /> {tier} Üzv <span className="text-gray-400 ml-2">Qoşulub: {joinedLabel}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-7xl font-bold">{profile?.wallet?.points || 0}</h2>
            <span className="text-xl font-medium text-gray-400">xal</span>
          </div>
          <p className="text-gray-400 mt-4 max-w-xs">
            Bu ay <span className="text-white font-bold">{profile?.wallet?.co2_saved || 0}kq CO2</span> qənaət etdiniz və {profile?.wallet?.peak_crowds_avoided || 0} dəfə pik saat sıxlığından qaçdınız.
          </p>
        </div>
        
        <div className="w-full md:w-80 relative z-10">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
             <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Növbəti Səviyyə</span>
                <span className="text-xs font-bold">{points >= 5000 ? 'Ən Üst Səviyyə' : `${nextTierTarget} xal səviyyəsi`}</span>
             </div>
             <div className="text-right mb-2">
                <span className="text-xs font-bold">{pointsToNextTier} xal qaldı</span>
             </div>
             <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-white" style={{ width: `${progress}%` }} />
             </div>
             <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                <span>Bürünc</span>
                <span>Gümüş (2000 xal)</span>
             </div>
          </div>
        </div>

        {/* Decorative Circles */}
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full" />
      </div>

      <div className="space-y-12">
          
          {/* Marketplace Section */}
          <section>
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold flex items-center gap-2"><Gift size={20} /> Xalları İstifadə Et</h3>
               <div className="flex gap-2">
                  <button 
                    onClick={() => setActiveTab('shop')}
                    className={`${activeTab === 'shop' ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'} text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase transition-all`}
                  >
                    Mağaza
                  </button>
                  <button 
                    onClick={() => setActiveTab('my-coupons')}
                    className={`${activeTab === 'my-coupons' ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'} text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase transition-all flex items-center gap-1.5`}
                  >
                    Kuponlarım {userCoupons.length > 0 && <span className="bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px]">{userCoupons.length}</span>}
                  </button>
               </div>
            </div>

            {/* Notification Messages */}
            {purchaseStatus.success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3 text-green-700 animate-in fade-in slide-in-from-top-4">
                <CheckCircle2 size={20} />
                <span className="text-sm font-bold">{purchaseStatus.success}</span>
              </div>
            )}
            {purchaseStatus.error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 animate-in fade-in slide-in-from-top-4">
                <AlertCircle size={20} />
                <span className="text-sm font-bold">{purchaseStatus.error}</span>
              </div>
            )}

            {activeTab === 'shop' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {coupons.map((coupon, i) => (
                  <div key={i} className="bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all group flex flex-col h-full">
                      <div className="h-40 bg-white relative overflow-hidden border-b border-gray-50 shrink-0">
                        {resolveCouponImage(coupon) ? (
                          <img
                            src={resolveCouponImage(coupon)}
                            alt={coupon.partner_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                            <Gift size={40} className="text-gray-200" />
                          </div>
                        )}
                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1.5">
                          <Award size={10} className="text-yellow-500" /> Tərəfdaş
                        </div>
                        <div className="absolute top-4 right-4 bg-black/90 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-[9px] font-bold uppercase">
                          {coupon.cost_points} xal
                        </div>
                      </div>
                      <div className="p-6 flex flex-col flex-1">
                        <h4 className="font-bold text-lg mb-1">{coupon.partner_name}</h4>
                        <p className="text-gray-500 text-sm mb-4 line-clamp-2">{coupon.description}</p>
                        <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">30 Gün Keçərli</span>
                            <button 
                              onClick={() => handlePurchase(coupon.id)}
                              disabled={purchaseStatus.loading || points < coupon.cost_points}
                              className={`${points < coupon.cost_points ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-black text-white hover:bg-gray-800'} px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50`}
                            >
                              {purchaseStatus.loading ? "..." : points < coupon.cost_points ? "Kifayət deyil" : `${coupon.cost_points} xal`} <ChevronRight size={14} />
                            </button>
                        </div>
                      </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {userCoupons.length > 0 ? userCoupons.map((uc) => (
                  <div key={uc.id} className="bg-white p-6 rounded-3xl border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gray-50 rounded-2xl overflow-hidden p-2 flex items-center justify-center shrink-0 border border-gray-100">
                        {resolveCouponImage(uc) ? (
                          <img src={resolveCouponImage(uc)} alt={uc.partner_name} className="w-full h-full object-cover" />
                        ) : (
                          <Gift size={24} className="text-gray-300" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-base">{uc.partner_name}</h4>
                        <p className="text-sm text-gray-500">{uc.title}</p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <span className="flex items-center gap-1"><Clock size={12} /> Bitmə Tarixi: {formatDate(uc.expires_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center md:items-end gap-2">
                       <div className="bg-gray-100 border-2 border-dashed border-gray-200 px-6 py-3 rounded-xl font-mono text-lg font-bold tracking-widest text-black">
                          {uc.promo_code}
                       </div>
                       <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest"> Kassirə göstərin</span>
                    </div>
                  </div>
                )) : (
                  <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                       <Gift size={24} className="text-gray-300" />
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1 text-lg">Hələ kuponunuz yoxdur</h4>
                    <p className="text-sm text-gray-500 mb-6">Səfərlər edərək XP toplayın və hədiyyələr qazanın.</p>
                    <button 
                      onClick={() => setActiveTab('shop')}
                      className="text-xs font-bold text-black border-b-2 border-black pb-1 hover:text-gray-600 hover:border-gray-600 transition-all uppercase tracking-widest"
                    >
                      Mağazaya Get
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Activity Feed */}
          <section>
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold flex items-center gap-2"><History size={20} /> Fəaliyyət Tarixçəsi</h3>
               <button className="text-xs font-bold text-gray-400 uppercase hover:text-black">Tam Tarixçə</button>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
               {activityFeed.length ? activityFeed.map((item) => (
                 <div key={item.id} className="flex items-center justify-between p-6 border-b border-gray-50 last:border-none hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400">
                          {item.value >= 0 ? <Zap size={20} className="text-yellow-500" /> : <ShoppingBag size={20} className="text-blue-500" />}
                       </div>
                       <div>
                          <h4 className="font-bold text-sm">{item.title}</h4>
                          <p className="text-xs text-gray-400 mt-1">{formatActivityDate(item.date)} • <span className="font-bold text-gray-300 uppercase text-[9px] tracking-widest">{item.type}</span></p>
                       </div>
                    </div>
                    <span className={`font-bold ${item.value >= 0 ? 'text-green-600' : 'text-gray-900'}`}>
                      {item.value >= 0 ? '+' : ''}{item.value.toFixed(0)} xal
                    </span>
                 </div>
               )) : (
                 <div className="p-6 text-sm text-gray-500">Hələ heç bir fəaliyyət yoxdur.</div>
               )}
            </div>
          </section>
      </div>
    </div>
  );
};

export default Rewards;
