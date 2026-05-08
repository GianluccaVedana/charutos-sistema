import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MENU_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '📊', perfis: ['admin', 'financeiro', 'vendas', 'estoque'] },
  { path: '/produtos', label: 'Produtos', icon: '🚬', perfis: ['admin', 'estoque'] },
  { path: '/clientes', label: 'Clientes', icon: '👥', perfis: ['admin', 'vendas'] },
  { path: '/estoque', label: 'Estoque', icon: '📦', perfis: ['admin', 'estoque'] },
  { path: '/consignacoes', label: 'Consignações', icon: '📋', perfis: ['admin', 'vendas'] },
  { path: '/vendas', label: 'Vendas', icon: '🛒', perfis: ['admin', 'vendas'] },
  { path: '/fluxo-caixa', label: 'Fluxo de Caixa', icon: '💰', perfis: ['admin', 'financeiro'] },
  { path: '/contas-receber', label: 'Contas a Receber', icon: '💳', perfis: ['admin', 'financeiro'] },
  { path: '/relatorios', label: 'Relatórios', icon: '📈', perfis: ['admin', 'financeiro', 'vendas'] },
  { path: '/usuarios', label: 'Usuários', icon: '🔐', perfis: ['admin'] },
];

export default function Sidebar({ open, onClose }) {
  const { usuario } = useAuth();

  const itensVisiveis = MENU_ITEMS.filter(item =>
    !item.perfis || item.perfis.includes(usuario?.perfil)
  );

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-20 bg-black/20 lg:hidden" onClick={onClose} />
      )}
      <aside className={`
        ${open ? 'w-64' : 'w-0 lg:w-16'}
        flex-shrink-0 bg-white border-r border-gray-100 shadow-sm
        transition-all duration-300 overflow-hidden flex flex-col
        fixed lg:relative z-30 h-full
      `}>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100 min-w-[256px]">
          <span className="text-2xl">🚬</span>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">Charutos</p>
            <p className="text-charuto-600 text-xs font-medium">Premium</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto min-w-[256px]">
          {itensVisiveis.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 min-w-[256px]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-charuto-100 rounded-full flex items-center justify-center text-charuto-700 font-semibold text-sm">
              {usuario?.nome?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{usuario?.nome}</p>
              <p className="text-xs text-gray-500 capitalize">{usuario?.perfil}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
