import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Planner from './pages/Planner';
import Rewards from './pages/Rewards';
import SystemAI from './pages/SystemAI';
import axios from 'axios';

const API_BASE_URL = "http://127.0.0.1:8000";

function App() {
  const [currentPage, setCurrentPage] = useState('landing');
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/user/profile`);
      setUserProfile(response.data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'landing': return <Landing onStart={() => setCurrentPage('planner')} />;
      case 'planner': return <Planner />;
      case 'rewards': return <Rewards profile={userProfile} />;
      case 'system': return <SystemAI />;
      default: return <Landing onStart={() => setCurrentPage('planner')} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 w-full">
      <Navbar 
        currentPage={currentPage} 
        onNavigate={setCurrentPage} 
        points={userProfile?.wallet?.points || 0}
      />
      <main className="pt-16">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
