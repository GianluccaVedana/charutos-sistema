import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Tabela from '../components/Tabela';
import Modal from '../components/Modal';

const FORM_VAZIO = { nome: '', cpf_cnpj: '', contato: '', telefone: '', email: '', endereco: '', cidade: '', estado: '', cep: '', observacoes: '' };
const ESTADOS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

const fmtTelefone = v => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
};

const BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(false);
  const [detalheId, setDetalheId] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editando, setEditando] = useState(null);
  const [portalLink, setPortalLink] = useState('');
  const [copiado, setCopiado] = useState(false);

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

  const gerarPortalLink = async (id) => {
    const r = await api.get(`/clientes/${id}/portal-token`);
    const url = `${BASE_URL}/portal/${r.data.token}`;
    setPortalLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      prompt('Copie o link do portal:', url);
    }
  };

  const colunas = [
    { key: 'codigo', label: 'Código', width: 90 },
    { key: 'nome', label: 'Nome / Razão Social' },
    { key: 'cpf_cnpj', label: 'CPF/CNPJ', width: 140, render: v => v || '—' },
    { key: 'telefone', label: 'Telefone', width: 130 },
    { key: 'cidade', label: 'Cidade', width: 120 },
    { key: 'estado', label: 'UF', width: 45 },
  ];

  const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
  const fmt = v => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <input className="input max-w-xs" placeholder="Buscar por nome, CPF/CNPJ, telefone..."
          value={busca} onChange={e => setBusca(e.target.value)} />
        <button className="btn-primary" onClick={abrirCriar}>+ Novo Cliente</button>
      </div>

      {copiado && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-lg">
          ✓ Link do portal copiado para a área de transferência!
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <Tabela colunas={colunas} dados={clientes} loading={loading}
          acoes={row => (
            <>
              <button className="btn-secondary text-xs py-1 px-2" onClick={() => setDetalheId(row.id)}>Histórico</button>
              <button className="btn-secondary text-xs py-1 px-2" onClick={() => abrirEditar(row)}>Editar</button>
              <button className="btn-secondary text-xs py-1 px-2" title="Copiar link do portal"
                onClick={() => gerarPortalLink(row.id)}>🔗 Portal</button>
              <button className="btn-danger text-xs py-1 px-2" onClick={() => excluir(row.id)}>Excluir</button>
            </>
          )}
        />
      </div>

      {/* Modal de cadastro */}
      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Cliente' : 'Novo Cliente'} size="lg">
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="label">Nome / Razão Social *</label>
            <input className="input" value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">CPF / CNPJ</label>
              <input className="input" value={form.cpf_cnpj} placeholder="000.000.000-00 ou 00.000.000/0001-00"
                onChange={e => setForm(f => ({ ...f, cpf_cnpj: e.target.value }))} />
            </div>
            <div>
              <label className="label">Contato (nome da pessoa)</label>
              <input className="input" value={form.contato}
                onChange={e => setForm(f => ({ ...f, contato: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Telefone / WhatsApp</label>
              <input className="input" value={form.telefone} placeholder="(00) 00000-0000"
                onChange={e => setForm(f => ({ ...f, telefone: fmtTelefone(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Endereço</label>
            <input className="input" value={form.endereco}
              onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="label">Cidade</label>
              <input className="input" value={form.cidade}
                onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={form.estado}
                onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                <option value="">UF</option>
                {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <div>
              <label className="label">CEP</label>
              <input className="input" value={form.cep} placeholder="00000-000"
                onChange={e => setForm(f => ({ ...f, cep: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={2} value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>

      {/* Modal de histórico */}
      <Modal open={!!detalheId} onClose={() => setDetalheId(null)}
        title={`Histórico — ${detalhe?.nome || ''}`} size="xl">
        {detalhe ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm bg-gray-50 rounded-lg p-4">
              <div><span className="text-gray-500">Código:</span> <strong>{detalhe.codigo}</strong></div>
              {detalhe.cpf_cnpj && <div><span className="text-gray-500">CPF/CNPJ:</span> {detalhe.cpf_cnpj}</div>}
              <div><span className="text-gray-500">Telefone:</span> {detalhe.telefone || '—'}</div>
              <div><span className="text-gray-500">Email:</span> {detalhe.email || '—'}</div>
              {detalhe.cidade && <div><span className="text-gray-500">Cidade:</span> {detalhe.cidade} / {detalhe.estado}</div>}
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Últimas Vendas</h4>
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
                      <td className="table-cell">{fmtDate(v.data_venda)}</td>
                      <td className="table-cell">{v.produto_nome}</td>
                      <td className="table-cell">{v.qtd_vendida}</td>
                      <td className="table-cell">{fmt(v.qtd_vendida * v.preco_unit)}</td>
                    </tr>
                  ))}
                  {detalhe.vendas.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-gray-400 text-sm">Sem vendas</td></tr>}
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Consignações</h4>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Data</th>
                    <th className="table-header">Produto</th>
                    <th className="table-header">Enviada</th>
                    <th className="table-header">Vendida</th>
                    <th className="table-header">Em Aberto</th>
                  </tr>
                </thead>
                <tbody>
                  {detalhe.consignacoes.map(c => {
                    const aberto = c.qtd_enviada - c.qtd_vendida - c.qtd_devolvida;
                    return (
                      <tr key={c.id} className="border-b border-gray-50">
                        <td className="table-cell">{fmtDate(c.data_envio)}</td>
                        <td className="table-cell">{c.produto_nome}</td>
                        <td className="table-cell">{c.qtd_enviada}</td>
                        <td className="table-cell">{c.qtd_vendida}</td>
                        <td className="table-cell">
                          <span className={aberto > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>{aberto}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {detalhe.consignacoes.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-gray-400 text-sm">Sem consignações</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <button className="btn-secondary text-sm" onClick={() => gerarPortalLink(detalheId)}>
                🔗 Copiar link do portal do consignado
              </button>
              {portalLink && (
                <span className="text-xs text-gray-400 truncate max-w-xs ml-3">{portalLink}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-charuto-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </Modal>
    </div>
  );
}
