import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Tabela from '../components/Tabela';
import Modal from '../components/Modal';

const fmt = v => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

const FORMAS_PAGAMENTO = ['À Vista', 'Pix', 'Cartão de Débito', 'Cartão de Crédito', 'Boleto', 'Transferência', 'A Prazo'];
const FORM_VAZIO = { data_venda: new Date().toISOString().slice(0, 10), cliente_id: '', produto_sku: '', qtd_vendida: '', preco_unit: '', frete: '', origem: 'Estoque', forma_pagamento: 'Pix', observacoes: '' };

export default function Vendas() {
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ data_inicio: '', data_fim: '' });
  const [modal, setModal] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [totais, setTotais] = useState({ vendas: 0, margem: 0, qtd: 0 });

  const carregar = async () => {
    setLoading(true);
    const r = await api.get('/vendas', { params: filtros });
    setVendas(r.data);
    setTotais({
      vendas: r.data.reduce((s, v) => s + (v.valor_total || 0), 0),
      margem: r.data.reduce((s, v) => s + (v.margem_bruta || 0), 0),
      qtd: r.data.reduce((s, v) => s + (v.qtd_vendida || 0), 0),
    });
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [filtros]);
  useEffect(() => {
    Promise.all([api.get('/clientes'), api.get('/produtos')]).then(([c, p]) => {
      setClientes(c.data); setProdutos(p.data);
    });
  }, []);

  const salvar = async e => {
    e.preventDefault();
    await api.post('/vendas', form);
    setModal(false);
    setForm(FORM_VAZIO);
    carregar();
  };

  const excluir = async id => {
    if (!confirm('Excluir esta venda?')) return;
    await api.delete(`/vendas/${id}`);
    carregar();
  };

  const colunas = [
    { key: 'codigo', label: 'Cód.', width: 90 },
    { key: 'data_venda', label: 'Data', width: 100, render: fmtDate },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'produto_nome', label: 'Produto' },
    { key: 'qtd_vendida', label: 'Qtd.', width: 55 },
    { key: 'preco_unit', label: 'Preço', width: 90, render: v => fmt(v) },
    { key: 'valor_total', label: 'Total', width: 110, render: v => <strong>{fmt(v)}</strong> },
    { key: 'margem_bruta', label: 'Margem', width: 100, render: v => <span className={v >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{fmt(v)}</span> },
    { key: 'origem', label: 'Origem', width: 95, render: v => <span className={v === 'Estoque' ? 'badge-blue' : 'badge-purple'}>{v}</span> },
    { key: 'forma_pagamento', label: 'Pagamento', width: 120 },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
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
      </div>

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
          {(filtros.data_inicio || filtros.data_fim) && (
            <button className="btn-secondary mt-4" onClick={() => setFiltros({ data_inicio: '', data_fim: '' })}>Limpar</button>
          )}
        </div>
        <button className="btn-primary" onClick={() => { setForm(FORM_VAZIO); setModal(true); }}>+ Nova Venda</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <Tabela colunas={colunas} dados={vendas} loading={loading}
          acoes={row => (
            <button className="btn-danger text-xs py-1 px-2" onClick={() => excluir(row.id)}>Excluir</button>
          )}
        />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Registrar Venda" size="lg">
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Data da Venda *</label>
              <input className="input" type="date" value={form.data_venda} onChange={e => setForm(f => ({ ...f, data_venda: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Cliente</label>
              <select className="input" value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}>
                <option value="">Selecione (opcional)</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Produto *</label>
            <select className="input" value={form.produto_sku} onChange={e => {
              const p = produtos.find(x => x.sku === e.target.value);
              setForm(f => ({ ...f, produto_sku: e.target.value, preco_unit: p?.preco_venda || '' }));
            }} required>
              <option value="">Selecione o produto</option>
              {produtos.map(p => <option key={p.sku} value={p.sku}>{p.sku} — {p.descricao} ({fmt(p.preco_venda)})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Quantidade *</label>
              <input className="input" type="number" min="0.01" step="0.01" value={form.qtd_vendida} onChange={e => setForm(f => ({ ...f, qtd_vendida: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Preço Unit. (R$) *</label>
              <input className="input" type="number" step="0.01" value={form.preco_unit} onChange={e => setForm(f => ({ ...f, preco_unit: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Frete (R$)</label>
              <input className="input" type="number" step="0.01" value={form.frete} onChange={e => setForm(f => ({ ...f, frete: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Origem</label>
              <select className="input" value={form.origem} onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}>
                <option value="Estoque">Estoque</option>
                <option value="Consignado">Consignado</option>
              </select>
            </div>
            <div>
              <label className="label">Forma de Pagamento</label>
              <select className="input" value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}>
                {FORMAS_PAGAMENTO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
              </select>
            </div>
          </div>
          {form.qtd_vendida && form.preco_unit && (
            <div className="bg-charuto-50 rounded-lg p-3 text-sm grid grid-cols-2 gap-4">
              <div>Total: <strong>{fmt(Number(form.qtd_vendida) * Number(form.preco_unit) + Number(form.frete || 0))}</strong></div>
              {produtos.find(p => p.sku === form.produto_sku) && (
                <div>Margem: <strong>{fmt(Number(form.qtd_vendida) * Number(form.preco_unit) - Number(form.qtd_vendida) * (produtos.find(p => p.sku === form.produto_sku)?.custo_total || 0))}</strong></div>
              )}
            </div>
          )}
          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Registrar Venda</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
