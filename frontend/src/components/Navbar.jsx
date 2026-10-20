import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Truck,
  History,
  BarChart3,
  Settings,
  LogOut,
  Calendar,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDate } from '../context/DateContext';
import { useSettings } from '../context/SettingsContext';
import { formatDate } from '../utils/formatters';

export default function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { operationalDate, setOperationalDate, resetToToday, isToday } = useDate();
  const { settings } = useSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Buyers & Tally', path: '/buyers', icon: Users },
    { name: 'Suppliers', path: '/suppliers', icon: Truck },
    { name: 'History', path: '/history', icon: History },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: Settings }
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="no-print bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0 min-w-0">
              <img
                src="/tomato.png"
                alt="Tomato Wholesale"
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain filter drop-shadow-xs group-hover:scale-105 transition-transform shrink-0"
              />
              <div className="shrink-0 min-w-0">
                <div className="text-base sm:text-lg font-bold text-slate-900 leading-tight tracking-tight flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
                  <span>{settings.businessName || 'TOMATO BUSINESS'}</span>
                  <span className="hidden sm:inline-block text-[10px] font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                    Wholesale
                  </span>
                </div>
                <div className="text-[11px] sm:text-xs text-slate-500 font-medium whitespace-nowrap">
                  Daily Billing & Tally
                </div>
              </div>
            </Link>
          </div>

          {/* Operational Date Selector in Header (Visible on Desktop >= 1024px) */}
          <div className="hidden lg:flex items-center gap-1.5 xl:gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 xl:px-3 py-1 xl:py-1.5 shadow-2xs shrink-0">
            <div className="flex items-center gap-1 text-slate-500 shrink-0">
              <Calendar className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-red-600 shrink-0" />
              <span className="hidden xl:inline text-xs font-bold text-slate-700">Date:</span>
            </div>
            <input
              type="date"
              value={operationalDate}
              onChange={(e) => setOperationalDate(e.target.value)}
              className="text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2 py-0.5 xl:py-1 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 w-[125px] shrink-0"
            />
            <button
              onClick={resetToToday}
              className={`text-xs px-2 xl:px-2.5 py-0.5 xl:py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                isToday
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
              }`}
              title="Set to today's real date"
            >
              Today
            </button>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-0.5 xl:gap-1 shrink-0">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`inline-flex items-center gap-1 xl:gap-1.5 px-2 xl:px-3 py-1.5 xl:py-2 rounded-xl text-xs xl:text-sm font-semibold whitespace-nowrap transition-all ${
                    active
                      ? 'bg-red-50 text-red-700 shadow-2xs border border-red-100'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0 ${active ? 'text-red-600' : 'text-slate-400'}`} />
                  <span>{link.name}</span>
                </Link>
              );
            })}

            {/* Logout button */}
            <button
              onClick={logout}
              className="ml-1 w-8 h-8 xl:w-9 xl:h-9 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-red-100 shrink-0"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Date indicator & Hamburger */}
          <div className="flex lg:hidden items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex items-center gap-1 sm:gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl px-2 sm:px-2.5 py-1.5 text-slate-800 text-xs font-bold shadow-2xs cursor-pointer active:scale-95 transition-all"
              title="Click to change operational business date"
            >
              <Calendar className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span className="font-mono text-[11px] sm:text-xs">{formatDate(operationalDate)}</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 border border-slate-200 cursor-pointer active:scale-95 transition-all shrink-0"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-3 shadow-lg">
          {/* Mobile Date Switcher */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Calendar className="w-4 h-4 text-red-600" />
              <span>Operational Business Date:</span>
            </div>
            <input
              type="date"
              value={operationalDate}
              onChange={(e) => setOperationalDate(e.target.value)}
              className="w-full text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded px-2.5 py-1.5"
            />
            <button
              onClick={resetToToday}
              className="w-full text-xs py-2 rounded-lg font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Reset to Today
            </button>
          </div>

          {/* Mobile Nav Links */}
          <div className="space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    active
                      ? 'bg-red-50 text-red-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-red-600' : 'text-slate-400'}`} />
                  {link.name}
                </Link>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
            <span className="text-xs text-slate-500 font-medium">Logged in as {user?.name || 'Admin'}</span>
            <button
              onClick={logout}
              className="text-xs font-semibold text-red-600 flex items-center gap-1"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
