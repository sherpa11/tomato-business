import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Truck,
  BarChart3,
  Receipt
} from 'lucide-react';

export default function MobileBottomNav({ onQuickBill }) {
  const location = useLocation();

  const navItems = [
    {
      name: 'Tally',
      path: '/',
      icon: LayoutDashboard,
      exact: true
    },
    {
      name: 'Buyers',
      path: '/buyers',
      icon: Users
    },
    {
      name: 'New Bill',
      isAction: true,
      onClick: () => {
        if (typeof onQuickBill === 'function') {
          onQuickBill();
        } else {
          window.dispatchEvent(new CustomEvent('open-quick-sale'));
        }
      }
    },
    {
      name: 'Suppliers',
      path: '/suppliers',
      icon: Truck
    },
    {
      name: 'Reports',
      path: '/reports',
      icon: BarChart3
    }
  ];

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  return (
    <nav className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-2 py-1.5">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item, index) => {
          const Icon = item.icon;

          if (item.isAction) {
            return (
              <button
                key={index}
                onClick={item.onClick}
                className="flex flex-col items-center justify-center -mt-5 cursor-pointer group focus:outline-none"
                title="Create Buyer Bill"
              >
                <div className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-500/30 active:scale-95 transition-transform border-2 border-white">
                  <Receipt className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-red-600 mt-0.5">
                  + Bill
                </span>
              </button>
            );
          }

          const active = isActive(item);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-w-[56px] ${
                active
                  ? 'text-red-600 font-bold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div className={`p-1 rounded-lg ${active ? 'bg-red-50' : ''}`}>
                <Icon className={`w-5 h-5 ${active ? 'text-red-600' : 'text-slate-400'}`} />
              </div>
              <span className={`text-[10px] tracking-tight ${active ? 'font-bold' : ''}`}>
                {item.name}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
