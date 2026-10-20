import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle2, AlertCircle, Info } from 'lucide-react';
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
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex items-center gap-3">
        <div className="w-10 h-10 sm:w-11 sm:h-11 bg-slate-100 text-slate-800 rounded-xl flex items-center justify-center border border-slate-200 shrink-0">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Business Profile & Settings</h1>
          <p className="text-xs text-slate-500 font-medium">Configure store details, default rates, and receipt formatting</p>
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

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-5 sm:space-y-6">
        <div>
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
            Market Business Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Business / Firm Name</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                className="w-full h-11 text-sm font-semibold border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Proprietor / Owner Name</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Phone Number</label>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Mandi Stall / Shop Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
            Convenience Daily Default Rates
          </h2>

          <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>Rate Preservation Rule:</strong> Default rates are only convenience defaults prefilled into new forms. Every individual sale and purchase permanently retains the specific rate recorded on that date. Changing default rates here will NEVER alter past bills.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Default Selling Rate per Big Box (₹)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={defaultSellingRate}
                onChange={(e) => setDefaultSellingRate(e.target.value)}
                className="w-full h-11 text-base font-black font-mono border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none text-red-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Default Purchase Rate per Big Box (₹)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={defaultPurchaseRate}
                onChange={(e) => setDefaultPurchaseRate(e.target.value)}
                className="w-full h-11 text-base font-black font-mono border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-emerald-800"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
            Print & Currency Preferences
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Currency Symbol</label>
              <input
                type="text"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="w-full h-11 text-sm font-bold border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Default Thermal Printer Width</label>
              <select
                value={thermalPrintWidth}
                onChange={(e) => setThermalPrintWidth(e.target.value)}
                className="w-full h-11 text-sm font-semibold border border-slate-300 rounded-xl px-3.5 bg-white focus:ring-2 focus:ring-slate-500 focus:outline-none"
              >
                <option value="80mm">80mm (Standard POS Thermal Printer)</option>
                <option value="58mm">58mm (Small Thermal Printer)</option>
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
    </div>
  );
}
