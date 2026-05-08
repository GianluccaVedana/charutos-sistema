import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Tabela from '../components/Tabela';
import Modal from '../components/Modal';

const fmt = v => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

const FORM_VAZIO = { data_envio: '', cliente_id: '', produto_sku: '', qtd_enviada: '', preco_unit: '', frete: '', observacoes: '' };

export default function Consignacoes() {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('aberto');
  const [modal, setModal] = useState(false);
  const [modalFechamento, setModalFechamento] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [formFech, setFormFech] = useState({ qtd_vendida: '', qtd_devolvida: '' });

  const carregar = async () => {
    setLoading(true);
    const params = filtro !== 'todos' ? { status: filtro } : {};
    const r = await api.get('/consignacoes', { params });
    setDados(r.data);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [filtro]);
  useEffect(() => {
    Promise.all([api.get('/clientes'), api.get('/produtos')]).then(([c, p]) => {
      setClientes(c.data);
      setProdutos(p.data);
    });
  }, []);

  const salvar = async e => {
    e.preventDefault();
    await api.post('/consignacoes', form);
    setModal(false);
    setForm(FORM_VAZIO);
    carregar();
  };

  const salvarFechamento = async e => {
    e.preventDefault();
    await api.put(`/consignacoes/${modalFechamento.id}`, formFech);
    setModalFechamento(null);
    carregar();
  };

  const excluir = async id => {
    if (!confirm('Excluir esta consignação?')) return;
    await api.delete(`/consignacoes/${id}`);
    carregar();
  };

  const badgeAlerta = a => {
    if (a === 'CRÍTICO') return <span className="badge-red">{a}</span>;
    if (a === 'ATENÇÃO') return <span className="badge-yellow">{a}</span>;
    if (a === 'Fechado') return <span className="badge-gray">Fechado</span>;
    return <span className="badge-green">OK</span>;
  };

  const colunas = [
    { key: 'codigo', label: 'Cód.', width: 90 },
    { key: 'data_envio', label: 'Data Envio', width: 105, render: fmtDate },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'produto_nome', label: 'Produto' },
    { key: 'qtd_enviada', label: 'Enviada', width: 75 },
    { key: 'qtd_vendida', label: 'Vendida', width: 75 },
    { key: 'qtd_devolvida', label: 'Devolvida', width: 85 },
    { key: 'qtd_em_aberto', label: 'Em Aberto', width: 90, render: v => <strong className={v > 0 ? 'text-orange-600' : 'text-green-600'}>{v}</strong> },
    { key: 'preco_unit', label: 'Preço', width: 90, render: v => fmt(v) },
    { key: 'valor_potencial', label: 'Valor Total', width: 110, render: v => fmt(v) },
    { key: 'dias_em_aberto', label: 'Dias', width: 60, render: v => v || '—' },
    { key: 'alerta', label: 'Alerta', width: 90, render: v => badgeAlerta(v) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {[['aberto','Abertas'],['fechado','Fechadas'],['todos','Todas']].map(([val, label]) => (
            <button key={val} onClick={() => setFiltro(val)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filtro === val ? 'bg-charuto-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => { setForm(FORM_VAZIO); setModal(true); }}>+ Nova Consignação</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <Tabela colunas={colunas} dados={dados} loading={loading}
          acoes={row => (
            <>
              {row.qtd_em_aberto > 0 && (
                <button className="btn-success text-xs py-1 px-2" onClick={() => { setModalFechamento(row); setFormFech({ qtd_vendida: row.qtd_em_aberto, qtd_devolvida: '' }); }}>Fechar</button>
              )}
              <button className="btn-danger text-xs py-1 px-2" onClick={() => excluir(row.id)}>Excluir</button>
            </>
          )}
        />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nova Consignação" size="lg">
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Data de Envio *</label>
              <input className="input" type="date" value={form.data_envio} onChange={e => setForm(f => ({ ...f, data_envio: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Cliente *</label>
              <select className="input" value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))} required>
                <option value="">Selecione</option>
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
              <option value="">Selecione</option>
              {produtos.map(p => <option key={p.sku} value={p.sku}>{p.sku} — {p.descricao}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Qtd. Enviada *</label>
              <input className="input" type="number" min="1" value={form.qtd_enviada} onChange={e => setForm(f => ({ ...f, qtd_enviada: e.target.value }))} required />
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
          {form.qtd_enviada && form.preco_unit && (
            <div className="bg-charuto-50 rounded-lg p-3 text-sm">
              Valor Potencial: <strong>{fmt(Number(form.qtd_enviada) * Number(form.preco_unit) + Number(form.frete || 0))}</strong>
            </div>
          )}
          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Registrar</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!modalFechamento} onClose={() => setModalFechamento(null)} title="Fechar Consignação">
        {modalFechamento && (
          <form onSubmit={salvarFechamento} className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p><strong>{modalFechamento.produto_nome}</strong> — {modalFechamento.cliente_nome}</p>
              <p className="text-gray-500">Em aberto: {modalFechamento.qtd_em_aberto} unidades</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Qtd. Vendida</label>
                <input className="input" type="number" min="0" max={modalFechamento.qtd_em_aberto} value={formFech.qtd_vendida} onChange={e => setFormFech(f => ({ ...f, qtd_vendida: e.target.value }))} />
              </div>
              <div>
                <label className="label">Qtd. Devolvida</label>
                <input className="input" type="number" min="0" max={modalFechamento.qtd_em_aberto} value={formFech.qtd_devolvida} onChange={e => setFormFech(f => ({ ...f, qtd_devolvida: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModalFechamento(null)}>Cancelar</button>
              <button type="submit" className="btn-success">Confirmar</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
