import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { Loader, Zap } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setToken, setUser } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', { email, password });
      setToken(data.token);
      setUser(data.user);
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-black" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">AECSA</span>
          </div>
          <p className="text-slate-400 text-sm">Autonomous Enterprise Customer Service Agent</p>
        </div>

        {/* Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h1 className="text-white font-semibold text-lg text-center">Sign in to your workspace</h1>

          {error && (
            <div className="bg-red-900/40 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="agent@company.com"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-600">
            Demo: admin@demo.com / demo1234
          </p>
        </div>
      </div>
    </div>
  );
}
