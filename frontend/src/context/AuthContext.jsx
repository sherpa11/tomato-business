import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('tomato_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('tomato_token');
    if (token) {
      authAPI.getMe()
        .then((res) => {
          if (res.success) {
            setUser(res.user);
            localStorage.setItem('tomato_user', JSON.stringify(res.user));
          }
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await authAPI.login({ username, password });
    if (res.success) {
      localStorage.setItem('tomato_token', res.token);
      localStorage.setItem('tomato_user', JSON.stringify(res.user));
      setUser(res.user);
      window.dispatchEvent(new Event('auth-change'));
      return res;
    }
    throw new Error(res.message || 'Login failed');
  };

  const logout = () => {
    localStorage.removeItem('tomato_token');
    localStorage.removeItem('tomato_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
