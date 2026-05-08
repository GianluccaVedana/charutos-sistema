import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Tabela from '../components/Tabela';
import Modal from '../components/Modal';

const fmt = v => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

const FORM_VAZIO = { cliente_id: '', origem: 'Estoque', documento_ref: '', data_emissao: new Date().toISOString().slice(0, 10), vencimento: '', valor_bruto: '', frete: '0', observacoes: '' };

export default function ContasReceber() {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('pendente');
  const [resumo, setResumo] = useState(null);
  const [modal, setModal] = useState(false);
  const [modalReceber, setModalReceber] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [valorReceber, setValorReceber] = useState('');
  const [clientes, setClientes] = useState([]);

  const carregar = async () => {
    setLoading(true);
    const params = filtro !== 'todos' ? { status: filtro } : {};
    const [r, res] = await Promise.all([api.get('/contas-receber', { params }), api.get('/contas-receber/resumo')]);
    setDados(r.data);
    setResumo(res.data);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [filtro]);
  useEffect(() => { api.get('/clientes').then(r => setClientes(r.data)); }, []);

  const salvar = async e => {
    e.preventDefault();
    await api.post('/contas-receber', form);
    setModal(false);
    setForm(FORM_VAZIO);
    carregar();
  };

  const registrarRecebimento = async e => {
    e.preventDefault();
    await api.patch(`/contas-receber/${modalReceber.id}/receber`, { valor_recebido: Number(valorReceber) });
    setModalReceber(null);
    setValorReceber('');
    carregar();
  };

  const excluir = async id => {
    if (!confirm('Excluir este título?')) return;
    await api.delete(`/contas-receber/${id}`);
    carregar();
  };

  const badgeStatus = s => {
    if (s === 'Em Atraso') return <span className="badge-red">{s}</span>;
    if (s === 'Liquidado') return <span className="badge-green">{s}</span>;
    return <span className="badge-yellow">{s}</span>;
  };

  const colunas = [
    { key: 'codigo', label: 'Cód.', width: 90 },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'origem', label: 'Origem', width: 90 },
    { key: 'data_emissao', label: 'Emissão', width: 100, render: fmtDate },
    { key: 'vencimento', label: 'Vencimento', width: 105, render: fmtDate },
    { key: 'valor_total', label: 'Valor Total', width: 110, render: v => fmt(v) },
    { key: 'valor_recebido', label: 'Recebido', width: 110, render: v => v > 0 ? <span className="text-green-600">{fmt(v)}</span> : '—' },
    { key: 'saldo_aberto', label: 'Saldo Aberto', width: 115, render: v => v > 0 ? <strong className="text-red-600">{fmt(v)}</strong> : <span className="text-green-600 font-medium">Quitado</span> },
    { key: 'dias_atraso', label: 'Atraso', width: 70, render: v => v > 0 ? <span className="text-red-600 font-medium">{v}d</span> : '—' },
    { key: 'status', label: 'Status', width: 100, render: badgeStatus },
  ];

  return (
    <div className="space-y-5">
      {resumo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card text-center">
            <p className="text-2xl font-bold text-charuto-700">{fmt(resumo.total_bruto)}</p>
            <p className="text-sm text-gray-500 mt-1">Total Emitido</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-600">{fmt(resumo.total_recebido)}</p>
            <p className="text-sm text-gray-500 mt-1">Total Recebido</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-blue-600">{fmt(resumo.total_aberto)}</p>
            <p className="text-sm text-gray-500 mt-1">Saldo em Aberto</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-red-600">{fmt(resumo.total_atrasado)}</p>
            <p className="text-sm text-gray-500 mt-1">Total Atrasado</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {[['pendente','A Vencer'],['atrasado','Em Atraso'],['liquidado','Liquidadas'],['todos','Todas']].map(([val, label]) => (
            <button key={val} onClick={() => setFiltro(val)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filtro === val ? 'bg-charuto-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => { setForm(FORM_VAZIO); setModal(true); }}>+ Nova Conta</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <Tabela colunas={colunas} dados={dados} loading={loading}
          acoes={row => (
            <>
              {row.saldo_aberto > 0 && (
                <button className="btn-success text-xs py-1 px-2" onClick={() => { setModalReceber(row); setValorReceber(row.saldo_aberto); }}>Receber</button>
              )}
              <button className="btn-danger text-xs py-1 px-2" onClick={() => excluir(row.id)}>Excluir</button>
            </>
          )}
        />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nova Conta a Receber" size="lg">
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="label">Cliente *</label>
            <select className="input" value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))} required>
              <option value="">Selecione</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Origem</label>
              <select className="input" value={form.origem} onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}>
                <option value="Estoque">Estoque</option>
                <option value="Consignação">Consignação</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="label">Documento / Ref.</label>
              <input className="input" value={form.documento_ref} onChange={e => setForm(f => ({ ...f, documento_ref: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Data de Emissão *</label>
              <input className="input" type="date" value={form.data_emissao} onChange={e => setForm(f => ({ ...f, data_emissao: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Vencimento *</label>
              <input className="input" type="date" value={form.vencimento} onChange={e => setForm(f => ({ ...f, vencimento: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Valor Bruto (R$) *</label>
              <input className="input" type="number" step="0.01" min="0.01" value={form.valor_bruto} onChange={e => setForm(f => ({ ...f, valor_bruto: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Frete (R$)</label>
              <input className="input" type="number" step="0.01" min="0" value={form.frete} onChange={e => setForm(f => ({ ...f, frete: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!modalReceber} onClose={() => setModalReceber(null)} title="Registrar Recebimento">
        {modalReceber && (
          <form onSubmit={registrarRecebimento} className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
              <p><strong>Cliente:</strong> {modalReceber.cliente_nome}</p>
              <p><strong>Vencimento:</strong> {fmtDate(modalReceber.vencimento)}</p>
              <p><strong>Saldo em Aberto:</strong> <span className="text-red-600 font-semibold">{fmt(modalReceber.saldo_aberto)}</span></p>
            </div>
            <div>
              <label className="label">Valor a Receber *</label>
              <input className="input" type="number" step="0.01" min="0.01" max={modalReceber.saldo_aberto} value={valorReceber} onChange={e => setValorReceber(e.target.value)} required />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModalReceber(null)}>Cancelar</button>
              <button type="submit" className="btn-success">Confirmar Recebimento</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
