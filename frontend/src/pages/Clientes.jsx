import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Tabela from '../components/Tabela';
import Modal from '../components/Modal';

const FORM_VAZIO = { nome: '', cpf_cnpj: '', contato: '', telefone: '', email: '', endereco: '', cidade: '', estado: '', cep: '', observacoes: '' };
const ESTADOS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(false);
  const [detalheId, setDetalheId] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editando, setEditando] = useState(null);

  const carregar = async () => {
    setLoading(true);
    const r = await api.get('/clientes', { params: { busca } });
    setClientes(r.data);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [busca]);

  useEffect(() => {
    if (detalheId) api.get(`/clientes/${detalheId}`).then(r => setDetalhe(r.data));
    else setDetalhe(null);
  }, [detalheId]);

  const abrirCriar = () => { setForm(FORM_VAZIO); setEditando(null); setModal(true); };
  const abrirEditar = c => { setForm(c); setEditando(c.id); setModal(true); };

  const salvar = async e => {
    e.preventDefault();
    if (editando) await api.put(`/clientes/${editando}`, form);
    else await api.post('/clientes', form);
    setModal(false);
    carregar();
  };

  const excluir = async id => {
    if (!confirm('Excluir este cliente?')) return;
    await api.delete(`/clientes/${id}`);
    carregar();
  };

  const colunas = [
    { key: 'codigo', label: 'Código', width: 90 },
    { key: 'nome', label: 'Nome/Razão Social' },
    { key: 'contato', label: 'Contato', width: 140 },
    { key: 'telefone', label: 'Telefone', width: 140 },
    { key: 'email', label: 'Email' },
    { key: 'cidade', label: 'Cidade', width: 120 },
    { key: 'estado', label: 'UF', width: 50 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <input className="input max-w-xs" placeholder="Buscar por nome, telefone, email..." value={busca} onChange={e => setBusca(e.target.value)} />
        <button className="btn-primary" onClick={abrirCriar}>+ Novo Cliente</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <Tabela colunas={colunas} dados={clientes} loading={loading}
          acoes={row => (
            <>
              <button className="btn-secondary text-xs py-1 px-2" onClick={() => setDetalheId(row.id)}>Histórico</button>
              <button className="btn-secondary text-xs py-1 px-2" onClick={() => abrirEditar(row)}>Editar</button>
              <button className="btn-danger text-xs py-1 px-2" onClick={() => excluir(row.id)}>Excluir</button>
            </>
          )}
        />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Cliente' : 'Novo Cliente'} size="lg">
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="label">Nome / Razão Social *</label>
            <input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Contato</label>
              <input className="input" value={form.contato} onChange={e => setForm(f => ({ ...f, contato: e.target.value }))} />
            </div>
            <div>
              <label className="label">CPF/CNPJ</label>
              <input className="input" value={form.cpf_cnpj} onChange={e => setForm(f => ({ ...f, cpf_cnpj: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Telefone</label>
              <input className="input" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Endereço</label>
            <input className="input" value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="label">Cidade</label>
              <input className="input" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                <option value="">UF</option>
                {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detalheId} onClose={() => setDetalheId(null)} title={`Histórico — ${detalhe?.nome || ''}`} size="xl">
        {detalhe ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Telefone:</span> {detalhe.telefone || '—'}</div>
              <div><span className="text-gray-500">Email:</span> {detalhe.email || '—'}</div>
              <div><span className="text-gray-500">Cidade:</span> {detalhe.cidade || '—'} / {detalhe.estado || '—'}</div>
              <div><span className="text-gray-500">Código:</span> {detalhe.codigo}</div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Últimas Vendas</h4>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Data</th>
                    <th className="table-header">Produto</th>
                    <th className="table-header">Qtd</th>
                    <th className="table-header">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {detalhe.vendas.map(v => (
                    <tr key={v.id} className="border-b border-gray-50">
                      <td className="table-cell">{new Date(v.data_venda).toLocaleDateString('pt-BR')}</td>
                      <td className="table-cell">{v.produto_nome}</td>
                      <td className="table-cell">{v.qtd_vendida}</td>
                      <td className="table-cell">{(v.qtd_vendida * v.preco_unit).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                  ))}
                  {detalhe.vendas.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-gray-400 text-sm">Sem vendas</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        ) : <div className="flex justify-center py-8"><div className="w-8 h-8 border-2 border-charuto-400 border-t-transparent rounded-full animate-spin" /></div>}
      </Modal>
    </div>
  );
}
