import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';

const fmt = v => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

function KpiSimples({ titulo, valor, sub, cor = 'gray', destaque = false }) {
  const cores = {
    orange: 'border-l-orange-400 bg-orange-50',
    red: 'border-l-red-400 bg-red-50',
    green: 'border-l-green-400 bg-green-50',
    blue: 'border-l-blue-400 bg-blue-50',
    charuto: 'border-l-charuto-400 bg-charuto-50',
    gray: 'border-l-gray-300 bg-gray-50',
  };
  return (
    <div className={`rounded-lg border-l-4 p-4 ${cores[cor]}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{titulo}</p>
      <p className={`text-2xl font-bold mt-1 ${destaque ? 'text-red-600' : 'text-gray-900'}`}>{valor}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function BadgeAlerta({ v }) {
  if (v === 'CRÍTICO') return <span className="badge-red text-xs">CRÍTICO</span>;
  if (v === 'ATENÇÃO') return <span className="badge-yellow text-xs">ATENÇÃO</span>;
  return <span className="badge-green text-xs">OK</span>;
}

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

  const { kpis, vendas_mes, estoque_repor, consig_abertas_lista, contas_vencer_lista } = data || {};

  const mesesFmt = (vendas_mes || []).map(m => ({
    ...m,
    label: new Date(m.mes + '-15').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-500 text-sm mt-0.5">Resumo operacional em tempo real</p>
        </div>
        <span className="text-xs text-gray-400 bg-white px-3 py-1.5 rounded-full border">
          {new Date().toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
        </span>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiSimples titulo="Consignações abertas" valor={kpis?.consig_abertas ?? 0}
          sub={fmt(kpis?.consig_valor_aberto)} cor="charuto" />
        <KpiSimples titulo="Consignações críticas" valor={kpis?.consig_criticas ?? 0}
          sub="+30 dias em aberto" cor={kpis?.consig_criticas > 0 ? 'red' : 'green'}
          destaque={kpis?.consig_criticas > 0} />
        <KpiSimples titulo="Contas a receber" valor={fmt(kpis?.contas_abertas)}
          sub={`Atrasado: ${fmt(kpis?.contas_atrasadas)}`} cor={kpis?.contas_atrasadas > 0 ? 'orange' : 'green'} />
        <KpiSimples titulo="Alertas de estoque" valor={kpis?.alertas_estoque ?? 0}
          sub={`${kpis?.pedidos_reposicao ?? 0} pedido(s) de reposição`}
          cor={kpis?.alertas_estoque > 0 ? 'red' : 'green'} destaque={kpis?.alertas_estoque > 0} />
      </div>

      {/* Gráfico de vendas */}
      {mesesFmt.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Vendas e Margem — Últimos 6 meses</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={mesesFmt}>
              <defs>
                <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d4841e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#d4841e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gM" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v, n) => [fmt(v), n === 'vendas_brutas' ? 'Vendas' : 'Margem']} />
              <Area type="monotone" dataKey="vendas_brutas" stroke="#d4841e" fill="url(#gV)" strokeWidth={2} />
              <Area type="monotone" dataKey="margem_bruta" stroke="#22c55e" fill="url(#gM)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Seção 1: Estoque */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            Estoque — Produtos para Repor
          </h3>
          {estoque_repor && estoque_repor.length > 0 ? (
            <div className="space-y-2">
              {estoque_repor.map(p => (
                <div key={p.sku} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.descricao}</p>
                    <p className="text-xs text-gray-400">{p.sku} · Mín: {p.estoque_minimo}</p>
                  </div>
                  <span className="ml-3 text-sm font-bold text-red-600 flex-shrink-0">
                    {p.estoque_total} un.
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="text-3xl mb-2">✅</span>
              <p className="text-sm text-gray-500">Estoque dentro do ideal</p>
            </div>
          )}
        </div>

        {/* Seção 2: Consignações abertas */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
            Consignações em Aberto
          </h3>
          {consig_abertas_lista && consig_abertas_lista.length > 0 ? (
            <div className="space-y-2">
              {consig_abertas_lista.map((c, i) => (
                <div key={i} className="flex items-start justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.cliente_nome}</p>
                    <p className="text-xs text-gray-400 truncate">{c.produto_nome}</p>
                    <p className="text-xs text-gray-400">{c.qtd_em_aberto} un. · {c.dias_em_aberto}d</p>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    <BadgeAlerta v={c.alerta} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="text-3xl mb-2">✅</span>
              <p className="text-sm text-gray-500">Sem consignações em aberto</p>
            </div>
          )}
        </div>

        {/* Seção 3: Contas a receber */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            Contas a Receber
          </h3>
          {contas_vencer_lista && contas_vencer_lista.length > 0 ? (
            <div className="space-y-2">
              {contas_vencer_lista.map((c, i) => (
                <div key={i} className="flex items-start justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.cliente_nome}</p>
                    <p className="text-xs text-gray-400">{c.codigo} · Venc: {fmtDate(c.vencimento)}</p>
                    {c.dias_atraso > 0 && (
                      <p className="text-xs text-red-500">{c.dias_atraso} dia(s) em atraso</p>
                    )}
                  </div>
                  <div className="ml-2 text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{fmt(c.saldo_aberto)}</p>
                    <span className={`text-xs font-medium ${c.status === 'Em Atraso' ? 'text-red-600' : 'text-blue-600'}`}>
                      {c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="text-3xl mb-2">✅</span>
              <p className="text-sm text-gray-500">Sem títulos pendentes</p>
            </div>
          )}
        </div>
      </div>

      {/* Info rodapé */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center py-3 bg-white rounded-lg border border-gray-100">
          <p className="text-2xl font-bold text-gray-900">{kpis?.skus_cadastrados ?? 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Produtos cadastrados</p>
        </div>
        <div className="text-center py-3 bg-white rounded-lg border border-gray-100">
          <p className="text-2xl font-bold text-gray-900">{kpis?.clientes_ativos ?? 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Clientes</p>
        </div>
        <div className="text-center py-3 bg-white rounded-lg border border-gray-100">
          <p className="text-2xl font-bold text-charuto-600">{fmt(kpis?.vendas_totais)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Vendas totais</p>
        </div>
      </div>
    </div>
  );
}
