import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Planner from './pages/Planner';
import Rewards from './pages/Rewards';
import SystemAI from './pages/SystemAI';
import SignIn from './pages/SignIn';
import { getMembershipTier } from './utils/membership';
import axios from 'axios';

const API_BASE_URL = "http://127.0.0.1:8000";

function App() {
  const [signedInEmail, setSignedInEmail] = useState(localStorage.getItem('signedInEmail') || '');
  const [currentPage, setCurrentPage] = useState(signedInEmail ? 'planner' : 'signin');
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    if (signedInEmail) {
      fetchProfile(signedInEmail);
      const intervalId = window.setInterval(() => fetchProfile(signedInEmail), 3000);
      const onFocus = () => fetchProfile(signedInEmail);
      window.addEventListener('focus', onFocus);
      return () => {
        window.clearInterval(intervalId);
        window.removeEventListener('focus', onFocus);
      };
    }
    setUserProfile(null);
  }, [signedInEmail]);

  const fetchProfile = async (email) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/user/profile`, {
        params: { email },
      });
      setUserProfile(response.data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const handleSignedIn = (email) => {
    localStorage.setItem('signedInEmail', email);
    setSignedInEmail(email);
    setCurrentPage('planner');
  };

  const handleAuthAction = () => {
    if (signedInEmail) {
      localStorage.removeItem('signedInEmail');
      setSignedInEmail('');
      setUserProfile(null);
      setCurrentPage('signin');
      return;
    }
    setCurrentPage('signin');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'signin': return <SignIn onSignedIn={handleSignedIn} />;
      case 'landing': return <Landing onStart={() => setCurrentPage('planner')} />;
      case 'planner': return <Planner signedInEmail={signedInEmail} onProfileRefresh={() => fetchProfile(signedInEmail)} />;
      case 'rewards': return <Rewards profile={userProfile} membershipTier={getMembershipTier(userProfile?.wallet?.points)} />;
      case 'system': return <SystemAI />;
      default: return <SignIn onSignedIn={handleSignedIn} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 w-full">
      <Navbar 
        currentPage={currentPage} 
        onNavigate={setCurrentPage} 
        points={userProfile?.wallet?.points || 0}
        membershipTier={getMembershipTier(userProfile?.wallet?.points)}
        isSignedIn={Boolean(signedInEmail)}
        onAuthAction={handleAuthAction}
      />
      <main className="pt-16">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
