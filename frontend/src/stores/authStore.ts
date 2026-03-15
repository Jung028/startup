import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: async (email, password) => {
        const { data } = await axios.post('/api/auth/login', { email, password });
        set({ token: data.token, user: data.user });
        axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      },
      logout: () => {
        set({ token: null, user: null });
        delete axios.defaults.headers.common['Authorization'];
      },
    }),
    { name: 'aecsa-auth' }
  )
);

// Initialize axios auth header from persisted token
const stored = JSON.parse(localStorage.getItem('aecsa-auth') || '{}');
if (stored?.state?.token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${stored.state.token}`;
}
