import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Produtos from './pages/Produtos';
import Clientes from './pages/Clientes';
import Estoque from './pages/Estoque';
import Consignacoes from './pages/Consignacoes';
import Vendas from './pages/Vendas';
import FluxoCaixa from './pages/FluxoCaixa';
import ContasReceber from './pages/ContasReceber';
import Relatorios from './pages/Relatorios';
import Usuarios from './pages/Usuarios';
import Portal from './pages/Portal';
import AreaConsignado from './pages/AreaConsignado';

function RotaProtegida({ children, perfis }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  if (perfis && !perfis.includes(usuario.perfil)) return <Navigate to="/consignacoes" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/portal/:token" element={<Portal />} />
          <Route path="/consignado" element={<AreaConsignado />} />
          <Route path="/" element={<RotaProtegida><Layout /></RotaProtegida>}>
            <Route index element={<RotaProtegida perfis={['admin','financeiro','estoque']}><Dashboard /></RotaProtegida>} />
            <Route path="produtos" element={<RotaProtegida perfis={['admin','estoque']}><Produtos /></RotaProtegida>} />
            <Route path="clientes" element={<RotaProtegida perfis={['admin']}><Clientes /></RotaProtegida>} />
            <Route path="estoque" element={<RotaProtegida perfis={['admin','estoque']}><Estoque /></RotaProtegida>} />
            <Route path="consignacoes" element={<Consignacoes />} />
            <Route path="vendas" element={<RotaProtegida perfis={['admin']}><Vendas /></RotaProtegida>} />
            <Route path="fluxo-caixa" element={<RotaProtegida perfis={['admin','financeiro']}><FluxoCaixa /></RotaProtegida>} />
            <Route path="contas-receber" element={<RotaProtegida perfis={['admin','financeiro']}><ContasReceber /></RotaProtegida>} />
            <Route path="relatorios" element={<RotaProtegida perfis={['admin','financeiro']}><Relatorios /></RotaProtegida>} />
            <Route path="usuarios" element={<RotaProtegida perfis={['admin']}><Usuarios /></RotaProtegida>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
