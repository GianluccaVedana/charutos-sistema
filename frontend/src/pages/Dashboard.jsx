import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '../services/api';
import KpiCard from '../components/KpiCard';

const fmt = v => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00';
const fmtNum = v => v?.toLocaleString('pt-BR') ?? '0';

const CORES_PIE = ['#22c55e', '#ef4444', '#f59e0b'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-charuto-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const { kpis, vendas_mes, produtos_mais_vendidos, clientes_mais_ativos, status_contas } = data || {};

  const dadosPie = [
    { name: 'Liquidado', value: status_contas?.liquidado || 0 },
    { name: 'Em Atraso', value: status_contas?.atrasado || 0 },
    { name: 'A Vencer', value: status_contas?.a_vencer || 0 },
  ];

  const mesesFormatados = (vendas_mes || []).map(m => ({
    ...m,
    mes_label: new Date(m.mes + '-15').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard Executivo</h2>
          <p className="text-gray-500 text-sm mt-1">Visão geral do negócio em tempo real</p>
        </div>
        <span className="text-xs text-gray-400 bg-white px-3 py-1.5 rounded-full border">
          Atualizado: {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard titulo="Vendas Totais" valor={fmt(kpis?.vendas_totais)} icone="💰" cor="charuto" />
        <KpiCard titulo="SKUs Cadastrados" valor={fmtNum(kpis?.skus_cadastrados)} icone="🚬" cor="blue" />
        <KpiCard titulo="Clientes Ativos" valor={fmtNum(kpis?.clientes_ativos)} icone="👥" cor="green" />
        <KpiCard titulo="Contas em Aberto" valor={fmt(kpis?.contas_abertas)} icone="💳" cor="orange" />
        <KpiCard titulo="Consig. Abertas" valor={fmtNum(kpis?.consig_abertas)} sub={`Valor: ${fmt(kpis?.consig_valor_aberto)}`} icone="📋" cor="purple" />
        <KpiCard titulo="Consig. Críticas" valor={fmtNum(kpis?.consig_criticas)} sub="+30 dias em aberto" icone="⚠️" cor="red" />
        <KpiCard titulo="Contas Atrasadas" valor={fmt(kpis?.contas_atrasadas)} icone="🔴" cor="red" />
        <KpiCard titulo="Alertas Estoque" valor={fmtNum(kpis?.alertas_estoque)} sub="Produtos abaixo do mínimo" icone="📦" cor={kpis?.alertas_estoque > 0 ? 'red' : 'green'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <h3 className="font-semibold text-gray-900 mb-4">Vendas e Margem nos Últimos 12 Meses</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={mesesFormatados}>
              <defs>
                <linearGradient id="vendas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d4841e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#d4841e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="margem" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes_label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v, n) => [fmt(v), n === 'vendas_brutas' ? 'Vendas' : 'Margem']} />
              <Legend formatter={v => v === 'vendas_brutas' ? 'Vendas Brutas' : 'Margem Bruta'} />
              <Area type="monotone" dataKey="vendas_brutas" stroke="#d4841e" fill="url(#vendas)" strokeWidth={2} />
              <Area type="monotone" dataKey="margem_bruta" stroke="#22c55e" fill="url(#margem)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Status Contas a Receber</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={dadosPie} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {dadosPie.map((_, i) => <Cell key={i} fill={CORES_PIE[i]} />)}
              </Pie>
              <Tooltip formatter={(v) => [v, 'títulos']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-2">
            {dadosPie.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: CORES_PIE[i] }} />
                  <span className="text-gray-600">{item.name}</span>
                </div>
                <span className="font-semibold text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Produtos Mais Vendidos</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={produtos_mais_vendidos?.slice(0, 8)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="descricao" type="category" width={120} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v, n) => [n === 'qtd' ? v + ' un' : fmt(v), n === 'qtd' ? 'Qtd' : 'Receita']} />
              <Bar dataKey="qtd" fill="#d4841e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Clientes Mais Ativos</h3>
          <div className="space-y-3">
            {(clientes_mais_ativos || []).slice(0, 8).map((c, i) => (
              <div key={c.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${i < 3 ? 'bg-charuto-500' : 'bg-gray-300'}`}>
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.nome}</p>
                    <p className="text-xs text-gray-400">{c.num_compras} compras</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-charuto-700">{fmt(c.total_compras)}</span>
              </div>
            ))}
            {(!clientes_mais_ativos || clientes_mais_ativos.length === 0) && (
              <p className="text-gray-400 text-sm text-center py-8">Nenhuma venda registrada ainda</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
