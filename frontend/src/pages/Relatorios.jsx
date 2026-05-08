import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import api from '../services/api';

const fmt = v => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

export default function Relatorios() {
  const [vendas, setVendas] = useState([]);
  const [filtros, setFiltros] = useState({
    data_inicio: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
    data_fim: new Date().toISOString().slice(0, 10),
  });
  const [loading, setLoading] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const r = await api.get('/vendas', { params: filtros });
    setVendas(r.data);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [filtros]);

  const vendasPorMes = vendas.reduce((acc, v) => {
    const mes = v.data_venda?.slice(0, 7);
    if (!mes) return acc;
    if (!acc[mes]) acc[mes] = { mes, vendas: 0, margem: 0, qtd: 0 };
    acc[mes].vendas += v.valor_total || 0;
    acc[mes].margem += v.margem_bruta || 0;
    acc[mes].qtd += v.qtd_vendida || 0;
    return acc;
  }, {});

  const dadosMes = Object.values(vendasPorMes).sort((a, b) => a.mes.localeCompare(b.mes)).map(m => ({
    ...m,
    mes_label: new Date(m.mes + '-15').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
  }));

  const vendasPorProduto = vendas.reduce((acc, v) => {
    const k = v.produto_sku;
    if (!acc[k]) acc[k] = { sku: k, nome: v.produto_nome, qtd: 0, receita: 0, custo: 0 };
    acc[k].qtd += v.qtd_vendida || 0;
    acc[k].receita += v.valor_total || 0;
    acc[k].custo += v.custo_total_venda || 0;
    return acc;
  }, {});

  const dadosProduto = Object.values(vendasPorProduto).sort((a, b) => b.receita - a.receita).slice(0, 10);

  const vendasPorCliente = vendas.filter(v => v.cliente_nome).reduce((acc, v) => {
    const k = v.cliente_id;
    if (!acc[k]) acc[k] = { id: k, nome: v.cliente_nome, qtd: 0, receita: 0 };
    acc[k].qtd += v.qtd_vendida || 0;
    acc[k].receita += v.valor_total || 0;
    return acc;
  }, {});

  const dadosCliente = Object.values(vendasPorCliente).sort((a, b) => b.receita - a.receita).slice(0, 10);

  const totais = {
    vendas: vendas.reduce((s, v) => s + (v.valor_total || 0), 0),
    margem: vendas.reduce((s, v) => s + (v.margem_bruta || 0), 0),
    qtd: vendas.reduce((s, v) => s + (v.qtd_vendida || 0), 0),
    transacoes: vendas.length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <label className="label text-xs">Período de</label>
          <input className="input" type="date" value={filtros.data_inicio} onChange={e => setFiltros(f => ({ ...f, data_inicio: e.target.value }))} />
        </div>
        <div>
          <label className="label text-xs">Até</label>
          <input className="input" type="date" value={filtros.data_fim} onChange={e => setFiltros(f => ({ ...f, data_fim: e.target.value }))} />
        </div>
        <div className="flex gap-2 mt-4">
          {[
            ['Este Mês', () => {
              const d = new Date();
              setFiltros({ data_inicio: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10), data_fim: d.toISOString().slice(0, 10) });
            }],
            ['Este Ano', () => setFiltros({ data_inicio: `${new Date().getFullYear()}-01-01`, data_fim: new Date().toISOString().slice(0, 10) })],
            ['Últimos 3 Meses', () => {
              const d = new Date();
              const ini = new Date(d); ini.setMonth(ini.getMonth() - 3);
              setFiltros({ data_inicio: ini.toISOString().slice(0, 10), data_fim: d.toISOString().slice(0, 10) });
            }],
          ].map(([label, fn]) => (
            <button key={label} className="btn-secondary text-xs" onClick={fn}>{label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-charuto-700">{fmt(totais.vendas)}</p>
          <p className="text-sm text-gray-500 mt-1">Vendas Brutas</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-600">{fmt(totais.margem)}</p>
          <p className="text-sm text-gray-500 mt-1">Margem Bruta</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-blue-600">{totais.qtd}</p>
          <p className="text-sm text-gray-500 mt-1">Unidades Vendidas</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-purple-600">{totais.transacoes}</p>
          <p className="text-sm text-gray-500 mt-1">Transações</p>
        </div>
      </div>

      {dadosMes.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Vendas por Mês</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dadosMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes_label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt(v)} />
              <Legend />
              <Bar dataKey="vendas" name="Vendas" fill="#d4841e" radius={[4,4,0,0]} />
              <Bar dataKey="margem" name="Margem" fill="#22c55e" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Top 10 Produtos Mais Vendidos</h3>
          {dadosProduto.length > 0 ? (
            <div className="space-y-3">
              {dadosProduto.map((p, i) => (
                <div key={p.sku} className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${i < 3 ? 'bg-charuto-500' : 'bg-gray-300'}`}>{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.nome}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{p.qtd} un</span>
                      <span className="text-green-600 font-medium">Receita: {fmt(p.receita)}</span>
                    </div>
                    <div className="mt-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-charuto-500 h-1.5 rounded-full" style={{ width: `${(p.receita / dadosProduto[0].receita * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-400 text-sm text-center py-8">Sem dados no período</p>}
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Top 10 Clientes Mais Ativos</h3>
          {dadosCliente.length > 0 ? (
            <div className="space-y-3">
              {dadosCliente.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${i < 3 ? 'bg-blue-500' : 'bg-gray-300'}`}>{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.nome}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{c.qtd} un</span>
                      <span className="text-charuto-600 font-medium">{fmt(c.receita)}</span>
                    </div>
                    <div className="mt-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(c.receita / dadosCliente[0].receita * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-400 text-sm text-center py-8">Sem dados no período</p>}
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Detalhe das Vendas</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Data</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Produto</th>
                <th className="table-header">Qtd</th>
                <th className="table-header">Preço Unit.</th>
                <th className="table-header">Total</th>
                <th className="table-header">Margem</th>
                <th className="table-header">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {vendas.slice(0, 50).map(v => (
                <tr key={v.id} className="table-row">
                  <td className="table-cell">{v.data_venda ? new Date(v.data_venda + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="table-cell">{v.cliente_nome || '—'}</td>
                  <td className="table-cell">{v.produto_nome}</td>
                  <td className="table-cell">{v.qtd_vendida}</td>
                  <td className="table-cell">{fmt(v.preco_unit)}</td>
                  <td className="table-cell font-medium">{fmt(v.valor_total)}</td>
                  <td className="table-cell"><span className={v.margem_bruta >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(v.margem_bruta)}</span></td>
                  <td className="table-cell"><span className={v.origem === 'Estoque' ? 'badge-blue' : 'badge-purple'}>{v.origem}</span></td>
                </tr>
              ))}
              {vendas.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Nenhuma venda no período</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {vendas.length > 50 && <p className="text-xs text-gray-400 mt-2 text-center">Exibindo 50 de {vendas.length} registros</p>}
      </div>
    </div>
  );
}
