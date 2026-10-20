import React from 'react';

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'red', badge }) {
  const colorMap = {
    red: 'border-red-500 bg-white text-red-600',
    emerald: 'border-emerald-500 bg-white text-emerald-600',
    amber: 'border-amber-500 bg-white text-amber-600',
    blue: 'border-blue-500 bg-white text-blue-600',
    purple: 'border-purple-500 bg-white text-purple-600',
    slate: 'border-slate-400 bg-white text-slate-700'
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {value}
            </h3>
            {badge && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-xs text-slate-700 font-medium">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl border ${colorMap[color]} shadow-2xs`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
}
