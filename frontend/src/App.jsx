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

function RotaProtegida({ children }) {
  const { usuario } = useAuth();
  return usuario ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/portal/:token" element={<Portal />} />
          <Route path="/" element={<RotaProtegida><Layout /></RotaProtegida>}>
            <Route index element={<Dashboard />} />
            <Route path="produtos" element={<Produtos />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="estoque" element={<Estoque />} />
            <Route path="consignacoes" element={<Consignacoes />} />
            <Route path="vendas" element={<Vendas />} />
            <Route path="fluxo-caixa" element={<FluxoCaixa />} />
            <Route path="contas-receber" element={<ContasReceber />} />
            <Route path="relatorios" element={<Relatorios />} />
            <Route path="usuarios" element={<Usuarios />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
