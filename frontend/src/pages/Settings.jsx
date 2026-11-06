import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle2, AlertCircle, Info, Users, Store, KeyRound } from 'lucide-react';
import UserManagement from '../components/UserManagement';
import ChangeCredentials from '../components/ChangeCredentials';
import { useSettings } from '../context/SettingsContext';

export default function Settings() {
  const { settings, updateSettings, loading } = useSettings();

  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [defaultSellingRate, setDefaultSellingRate] = useState('');
  const [defaultPurchaseRate, setDefaultPurchaseRate] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [thermalPrintWidth, setThermalPrintWidth] = useState('80mm');

  const [activeTab, setActiveTab] = useState('PROFILE'); // 'PROFILE', 'SECURITY', or 'USERS'
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (settings) {
      setBusinessName(settings.businessName || '');
      setOwnerName(settings.ownerName || '');
      setPhone(settings.phone || '');
      setAddress(settings.address || '');
      setDefaultSellingRate(settings.defaultSellingRate?.toString() || '1100');
      setDefaultPurchaseRate(settings.defaultPurchaseRate?.toString() || '1000');
      setCurrencySymbol(settings.currencySymbol || '₹');
      setThermalPrintWidth(settings.thermalPrintWidth || '80mm');
    }
  }, [settings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await updateSettings({
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        defaultSellingRate: Number(defaultSellingRate) || 0,
        defaultPurchaseRate: Number(defaultPurchaseRate) || 0,
        currencySymbol,
        thermalPrintWidth
      });
      setSuccessMsg('Settings updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-slate-100 text-slate-800 rounded-xl flex items-center justify-center border border-slate-200 shrink-0">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">System Configuration & Administration</h1>
            <p className="text-xs text-slate-500 font-medium">Configure business parameters, bill branding, and cashier access roles</p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex flex-wrap items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0 self-start sm:self-auto gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('PROFILE')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'PROFILE'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Store Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SECURITY')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'SECURITY'
                ? 'bg-white text-emerald-800 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
            <span>Change Credentials</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('USERS')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'USERS'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>Staff & Roles</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {activeTab === 'SECURITY' && (
        <ChangeCredentials />
      )}

      {activeTab === 'PROFILE' && (
        <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-6">
          <h2 className="text-base sm:text-lg font-black text-slate-900 border-b border-slate-100 pb-3">Business Profile & Bill Header</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Business Name</label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none"
                placeholder="e.g. Mahalakshmi Traders"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Owner / Contact Person</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none"
                placeholder="e.g. R Bootto"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Contact Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none"
                placeholder="e.g. 94434 01838 / 99438 01838"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Market Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none"
                placeholder="e.g. No. 25, Gandhi market, Dindigul, 625001"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-6">
          <h2 className="text-base sm:text-lg font-black text-slate-900 border-b border-slate-100 pb-3">Operational Defaults</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Default Selling Rate per Big Box (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={defaultSellingRate}
                onChange={(e) => setDefaultSellingRate(e.target.value)}
                className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Default Purchase Rate per Big Box (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={defaultPurchaseRate}
                onChange={(e) => setDefaultPurchaseRate(e.target.value)}
                className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Thermal Print Width</label>
              <select
                value={thermalPrintWidth}
                onChange={(e) => setThermalPrintWidth(e.target.value)}
                className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none bg-white font-medium"
              >
                <option value="80mm">80mm (Standard Mandi Thermal)</option>
                <option value="58mm">58mm (Compact)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pt-4 flex items-center justify-end border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 h-11 px-6 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 w-full sm:w-auto"
          >
            <Save className="w-4 h-4 shrink-0" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
      )}

      {activeTab === 'USERS' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs">
          <UserManagement />
        </div>
      )}
    </div>
  );
}
