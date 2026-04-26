import React, { useState } from 'react';
import axios from 'axios';
import { LogIn } from 'lucide-react';

const API_BASE_URL = "http://127.0.0.1:8000";

const initialRegisterForm = {
  full_name: '',
  email: '',
  bakikart_id: '',
  phone: '',
  password: '',
};

const initialLoginForm = {
  email: '',
  password: '',
};

const SignIn = ({ onSignedIn }) => {
  const [mode, setMode] = useState('login');
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onRegisterChange = (event) => {
    const { name, value } = event.target;
    setRegisterForm((prev) => ({ ...prev, [name]: value }));
  };

  const onLoginChange = (event) => {
    const { name, value } = event.target;
    setLoginForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload = mode === 'login' ? loginForm : registerForm;
      const res = await axios.post(`${API_BASE_URL}${endpoint}`, payload);
      const email = res.data?.profile?.email || payload.email.toLowerCase();
      onSignedIn(email);
      setRegisterForm(initialRegisterForm);
      setLoginForm(initialLoginForm);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Əməliyyat alınmadı. Yenidən yoxlayın.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900">{mode === 'login' ? 'Login' : 'Register'}</h1>
        <p className="text-sm text-gray-500 mt-2">
          {mode === 'login'
            ? 'Qeydiyyatdan keçmisinizsə email və şifrə ilə daxil olun.'
            : 'Yeni hesab yaratmaq üçün məlumatları doldurun.'}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors ${mode === 'login' ? 'bg-white text-black' : 'text-gray-500'}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors ${mode === 'register' ? 'bg-white text-black' : 'text-gray-500'}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {mode === 'register' && (
            <>
              <input name="full_name" value={registerForm.full_name} onChange={onRegisterChange} placeholder="Ad Soyad" required className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              <input name="bakikart_id" value={registerForm.bakikart_id} onChange={onRegisterChange} placeholder="BakiKart ID" required className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              <input name="phone" value={registerForm.phone} onChange={onRegisterChange} placeholder="Telefon (optional)" className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </>
          )}
          <input
            name="email"
            type="email"
            value={mode === 'login' ? loginForm.email : registerForm.email}
            onChange={mode === 'login' ? onLoginChange : onRegisterChange}
            placeholder="Email"
            required
            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <input
            name="password"
            type="password"
            value={mode === 'login' ? loginForm.password : registerForm.password}
            onChange={mode === 'login' ? onLoginChange : onRegisterChange}
            placeholder="Şifrə"
            required
            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3.5 rounded-xl font-bold text-sm hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <LogIn size={16} />
            {loading ? 'Yoxlanılır...' : (mode === 'login' ? 'Login' : 'Register')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SignIn;
