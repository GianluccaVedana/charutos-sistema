import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Tabela from '../components/Tabela';
import Modal from '../components/Modal';

const fmt = v => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

export default function Estoque() {
  const [estoque, setEstoque] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalEntrada, setModalEntrada] = useState(false);
  const [modalInicial, setModalInicial] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [formEntrada, setFormEntrada] = useState({ produto_sku: '', quantidade: '', observacoes: '' });
  const [formInicial, setFormInicial] = useState({ produto_sku: '', quantidade: '' });

  const carregar = async () => {
    setLoading(true);
    const [e, p] = await Promise.all([api.get('/estoque'), api.get('/produtos')]);
    setEstoque(e.data);
    setProdutos(p.data);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const salvarEntrada = async e => {
    e.preventDefault();
    await api.post('/estoque/entrada', formEntrada);
    setModalEntrada(false);
    setFormEntrada({ produto_sku: '', quantidade: '', observacoes: '' });
    carregar();
  };

  const salvarInicial = async e => {
    e.preventDefault();
    await api.post('/estoque/estoque-inicial', formInicial);
    setModalInicial(false);
    carregar();
  };

  const dadosFiltrados = estoque.filter(r => {
    if (filtro === 'repor') return r.alerta === 'REPOR';
    if (filtro === 'ok') return r.alerta === 'OK';
    return true;
  });

  const totais = {
    valor: estoque.reduce((s, r) => s + (r.valor_estoque || 0), 0),
    repor: estoque.filter(r => r.alerta === 'REPOR').length,
    sem_param: estoque.filter(r => r.alerta === 'SEM PARÂMETRO').length,
  };

  const colunas = [
    { key: 'sku', label: 'SKU', width: 90 },
    { key: 'descricao', label: 'Produto' },
    { key: 'estoque_inicial', label: 'Est. Inicial', width: 95, render: v => v ?? 0 },
    { key: 'entradas', label: 'Entradas', width: 80, render: v => v ?? 0 },
    { key: 'saidas_venda', label: 'Saídas Venda', width: 110, render: v => v ?? 0 },
    { key: 'enviado_consignacao', label: 'Enviado Cons.', width: 120, render: v => v ?? 0 },
    { key: 'retorno_consignacao', label: 'Retorno', width: 80, render: v => v ?? 0 },
    { key: 'saldo_em_maos', label: 'Saldo Mãos', width: 100, render: v => <strong>{v ?? 0}</strong> },
    { key: 'saldo_com_clientes', label: 'Saldo Clientes', width: 120, render: v => v ?? 0 },
    { key: 'estoque_total', label: 'Total', width: 70, render: v => <strong className={v <= 0 ? 'text-red-600' : 'text-green-700'}>{v ?? 0}</strong> },
    { key: 'valor_estoque', label: 'Valor', width: 110, render: v => fmt(v) },
    { key: 'estoque_minimo', label: 'Mín.', width: 60 },
    { key: 'alerta', label: 'Alerta', width: 90, render: v => (
      <span className={v === 'REPOR' ? 'badge-red' : v === 'OK' ? 'badge-green' : 'badge-gray'}>
        {v}
      </span>
    )},
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-charuto-700">{fmt(totais.valor)}</p>
          <p className="text-sm text-gray-500 mt-1">Valor Total em Estoque</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-red-600">{totais.repor}</p>
          <p className="text-sm text-gray-500 mt-1">Produtos para Repor</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-gray-500">{totais.sem_param}</p>
          <p className="text-sm text-gray-500 mt-1">Sem Parâmetro</p>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {['todos', 'repor', 'ok'].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${filtro === f ? 'bg-charuto-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
              {f === 'todos' ? 'Todos' : f === 'repor' ? '⚠️ Repor' : '✅ OK'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setModalInicial(true)}>Ajustar Estoque Inicial</button>
          <button className="btn-primary" onClick={() => setModalEntrada(true)}>+ Registrar Entrada</button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <Tabela colunas={colunas} dados={dadosFiltrados} loading={loading} />
      </div>

      <Modal open={modalEntrada} onClose={() => setModalEntrada(false)} title="Registrar Entrada de Estoque">
        <form onSubmit={salvarEntrada} className="space-y-4">
          <div>
            <label className="label">Produto *</label>
            <select className="input" value={formEntrada.produto_sku} onChange={e => setFormEntrada(f => ({ ...f, produto_sku: e.target.value }))} required>
              <option value="">Selecione o produto</option>
              {produtos.map(p => <option key={p.sku} value={p.sku}>{p.sku} — {p.descricao}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Quantidade *</label>
            <input className="input" type="number" min="0.01" step="0.01" value={formEntrada.quantidade} onChange={e => setFormEntrada(f => ({ ...f, quantidade: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Observações</label>
            <input className="input" value={formEntrada.observacoes} onChange={e => setFormEntrada(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalEntrada(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Registrar</button>
          </div>
        </form>
      </Modal>

      <Modal open={modalInicial} onClose={() => setModalInicial(false)} title="Ajustar Estoque Inicial">
        <form onSubmit={salvarInicial} className="space-y-4">
          <div>
            <label className="label">Produto *</label>
            <select className="input" value={formInicial.produto_sku} onChange={e => setFormInicial(f => ({ ...f, produto_sku: e.target.value }))} required>
              <option value="">Selecione o produto</option>
              {produtos.map(p => <option key={p.sku} value={p.sku}>{p.sku} — {p.descricao}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Quantidade Inicial *</label>
            <input className="input" type="number" min="0" step="1" value={formInicial.quantidade} onChange={e => setFormInicial(f => ({ ...f, quantidade: e.target.value }))} required />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalInicial(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
