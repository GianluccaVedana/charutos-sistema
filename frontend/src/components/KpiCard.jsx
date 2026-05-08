import React from 'react';

export default function KpiCard({ titulo, valor, sub, icone, cor = 'charuto', trend }) {
  const cores = {
    charuto: 'from-charuto-500 to-charuto-700',
    green: 'from-green-500 to-green-700',
    blue: 'from-blue-500 to-blue-700',
    red: 'from-red-500 to-red-700',
    purple: 'from-purple-500 to-purple-700',
    orange: 'from-orange-500 to-orange-700',
  };

  return (
    <div className={`bg-gradient-to-br ${cores[cor]} rounded-xl p-5 text-white shadow-lg`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-white/80 text-xs font-medium uppercase tracking-wider">{titulo}</p>
          <p className="text-2xl font-bold mt-1 leading-tight">{valor}</p>
          {sub && <p className="text-white/70 text-xs mt-1">{sub}</p>}
        </div>
        <span className="text-3xl ml-2">{icone}</span>
      </div>
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <span>{trend >= 0 ? '↑' : '↓'}</span>
          <span>{Math.abs(trend).toFixed(1)}% vs mês anterior</span>
        </div>
      )}
    </div>
  );
}
