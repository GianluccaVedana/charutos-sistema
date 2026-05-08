import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import api from '../services/api';
import Tabela from '../components/Tabela';
import Modal from '../components/Modal';

const fmt = v => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

const CATEGORIAS_ENTRADA = ['Venda', 'Recebimento', 'Consignação', 'Investimento', 'Outros'];
const CATEGORIAS_SAIDA = ['Compra de Produto', 'Frete', 'Impostos', 'Despesa Operacional', 'Marketing', 'Pessoal', 'Outros'];
const FORMAS = ['Pix', 'Dinheiro', 'Cartão de Débito', 'Cartão de Crédito', 'Transferência', 'Boleto'];

const FORM_VAZIO = { data: new Date().toISOString().slice(0, 10), tipo: 'Entrada', categoria: '', documento_ref: '', cliente_id: '', descricao: '', entradas: '', saidas: '', forma_pagamento: 'Pix', observacoes: '' };

export default function FluxoCaixa() {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ data_inicio: '', data_fim: '' });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [clientes, setClientes] = useState([]);
  const [editando, setEditando] = useState(null);

  const carregar = async () => {
    setLoading(true);
    const r = await api.get('/fluxo-caixa', { params: filtros });
    setDados(r.data);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [filtros]);
  useEffect(() => { api.get('/clientes').then(r => setClientes(r.data)); }, []);

  const salvar = async e => {
    e.preventDefault();
    const payload = { ...form, entradas: form.tipo === 'Entrada' ? Number(form.entradas || 0) : 0, saidas: form.tipo === 'Saída' ? Number(form.saidas || 0) : 0 };
    if (editando) await api.put(`/fluxo-caixa/${editando}`, payload);
    else await api.post('/fluxo-caixa', payload);
    setModal(false);
    setEditando(null);
    setForm(FORM_VAZIO);
    carregar();
  };

  const abrirEditar = row => {
    setForm({ ...row, entradas: row.entradas || '', saidas: row.saidas || '' });
    setEditando(row.id);
    setModal(true);
  };

  const excluir = async id => {
    if (!confirm('Excluir este lançamento?')) return;
    await api.delete(`/fluxo-caixa/${id}`);
    carregar();
  };

  const totais = {
    entradas: dados.reduce((s, r) => s + (r.entradas || 0), 0),
    saidas: dados.reduce((s, r) => s + (r.saidas || 0), 0),
    saldo: dados.length > 0 ? dados[dados.length - 1].saldo_acumulado : 0,
  };

  const graficoDados = dados.slice(-30).map(r => ({
    data: fmtDate(r.data),
    Entradas: r.entradas || 0,
    Saídas: r.saidas || 0,
    Saldo: r.saldo_acumulado,
  }));

  const colunas = [
    { key: 'data', label: 'Data', width: 100, render: fmtDate },
    { key: 'tipo', label: 'Tipo', width: 75, render: v => <span className={v === 'Entrada' ? 'badge-green' : 'badge-red'}>{v}</span> },
    { key: 'categoria', label: 'Categoria', width: 140 },
    { key: 'cliente_nome', label: 'Cliente', width: 140 },
    { key: 'descricao', label: 'Descrição' },
    { key: 'entradas', label: 'Entradas', width: 110, render: v => v > 0 ? <span className="text-green-600 font-medium">{fmt(v)}</span> : '—' },
    { key: 'saidas', label: 'Saídas', width: 110, render: v => v > 0 ? <span className="text-red-600 font-medium">{fmt(v)}</span> : '—' },
    { key: 'saldo_acumulado', label: 'Saldo Acum.', width: 120, render: v => <strong className={v >= 0 ? 'text-green-700' : 'text-red-700'}>{fmt(v)}</strong> },
    { key: 'forma_pagamento', label: 'Forma Pgto.', width: 120 },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="card bg-green-50 border-green-100">
          <p className="text-xs text-green-600 uppercase font-semibold">Total Entradas</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{fmt(totais.entradas)}</p>
        </div>
        <div className="card bg-red-50 border-red-100">
          <p className="text-xs text-red-600 uppercase font-semibold">Total Saídas</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{fmt(totais.saidas)}</p>
        </div>
        <div className={`card ${totais.saldo >= 0 ? 'bg-charuto-50 border-charuto-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-xs text-charuto-600 uppercase font-semibold">Saldo Acumulado</p>
          <p className={`text-2xl font-bold mt-1 ${totais.saldo >= 0 ? 'text-charuto-700' : 'text-red-700'}`}>{fmt(totais.saldo)}</p>
        </div>
      </div>

      {graficoDados.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Evolução do Fluxo de Caixa</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={graficoDados}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="data" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt(v)} />
              <Legend />
              <Bar dataKey="Entradas" fill="#22c55e" radius={[2,2,0,0]} />
              <Bar dataKey="Saídas" fill="#ef4444" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div>
            <label className="label text-xs">De</label>
            <input className="input" type="date" value={filtros.data_inicio} onChange={e => setFiltros(f => ({ ...f, data_inicio: e.target.value }))} />
          </div>
          <div>
            <label className="label text-xs">Até</label>
            <input className="input" type="date" value={filtros.data_fim} onChange={e => setFiltros(f => ({ ...f, data_fim: e.target.value }))} />
          </div>
        </div>
        <button className="btn-primary" onClick={() => { setForm(FORM_VAZIO); setEditando(null); setModal(true); }}>+ Novo Lançamento</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <Tabela colunas={colunas} dados={dados} loading={loading}
          acoes={row => (
            <>
              <button className="btn-secondary text-xs py-1 px-2" onClick={() => abrirEditar(row)}>Editar</button>
              <button className="btn-danger text-xs py-1 px-2" onClick={() => excluir(row.id)}>Excluir</button>
            </>
          )}
        />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Lançamento' : 'Novo Lançamento'} size="lg">
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Data *</label>
              <input className="input" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Tipo *</label>
              <select className="input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value, categoria: '' }))} required>
                <option value="Entrada">Entrada</option>
                <option value="Saída">Saída</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Categoria</label>
              <select className="input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                <option value="">Selecione</option>
                {(form.tipo === 'Entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Forma de Pagamento</label>
              <select className="input" value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}>
                {FORMAS.map(fp => <option key={fp} value={fp}>{fp}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Cliente (opcional)</label>
            <select className="input" value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}>
              <option value="">Nenhum</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Descrição</label>
            <input className="input" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div>
            <label className="label">{form.tipo === 'Entrada' ? 'Valor de Entrada (R$) *' : 'Valor de Saída (R$) *'}</label>
            <input className="input" type="number" step="0.01" min="0.01" value={form.tipo === 'Entrada' ? form.entradas : form.saidas}
              onChange={e => setForm(f => form.tipo === 'Entrada' ? { ...f, entradas: e.target.value } : { ...f, saidas: e.target.value })} required />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
