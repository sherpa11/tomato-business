import React, { createContext, useContext, useState, useEffect } from 'react';
import { settingsAPI } from '../api/client';

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    businessName: 'Tomato Wholesale Market',
    ownerName: '',
    phone: '',
    address: '',
    defaultSellingRate: 1100,
    defaultPurchaseRate: 1000,
    currencySymbol: '₹',
    thermalPrintWidth: '80mm'
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    const token = localStorage.getItem('tomato_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await settingsAPI.getSettings();
      if (res.success && res.settings) {
        setSettings(res.settings);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    const handleAuthChange = () => fetchSettings();
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, []);

  const updateSettings = async (data) => {
    const res = await settingsAPI.updateSettings(data);
    if (res.success) {
      setSettings(res.settings);
      return res;
    }
    throw new Error(res.message || 'Failed to update settings');
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, reloadSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
