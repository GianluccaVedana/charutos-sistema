import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TITULOS = {
  '/': 'Dashboard',
  '/produtos': 'Produtos',
  '/clientes': 'Clientes',
  '/estoque': 'Estoque',
  '/consignacoes': 'Consignações',
  '/vendas': 'Vendas',
  '/fluxo-caixa': 'Fluxo de Caixa',
  '/contas-receber': 'Contas a Receber',
  '/relatorios': 'Relatórios',
  '/usuarios': 'Usuários',
};

export default function Header({ onMenuClick }) {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{TITULOS[pathname] || 'Sistema'}</h1>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        <button
          onClick={handleLogout}
          className="ml-4 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
