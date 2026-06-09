import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Tabela from '../components/Tabela';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

const FORM_VAZIO = { nome: '', email: '', senha: '', perfil: 'vendas', ativo: 1, cliente_id: '' };
const PERFIS = [
  { value: 'admin', label: 'Administrador', desc: 'Acesso total ao sistema' },
  { value: 'financeiro', label: 'Financeiro', desc: 'Fluxo de caixa, contas a receber, relatórios' },
  { value: 'vendas', label: 'Vendas', desc: 'Clientes, vendas, consignações, estoque' },
  { value: 'estoque', label: 'Estoque', desc: 'Produtos e controle de estoque' },
  { value: 'consignado', label: 'Consignado', desc: 'Acesso à área exclusiva do consignado' },
];

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editando, setEditando] = useState(null);
  const [clientes, setClientes] = useState([]);
  const { usuario: usuarioAtual } = useAuth();

  if (usuarioAtual?.perfil !== 'admin') {
    return <div className="text-center py-16 text-gray-400">Acesso restrito a administradores.</div>;
  }

  const carregar = async () => {
    setLoading(true);
    const [r, c] = await Promise.all([api.get('/auth/usuarios'), api.get('/clientes')]);
    setUsuarios(r.data);
    setClientes(c.data);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const abrirEditar = u => { setForm({ ...u, senha: '' }); setEditando(u.id); setModal(true); };
  const abrirCriar = () => { setForm(FORM_VAZIO); setEditando(null); setModal(true); };

  const salvar = async e => {
    e.preventDefault();
    if (editando) await api.put(`/auth/usuarios/${editando}`, form);
    else await api.post('/auth/usuarios', form);
    setModal(false);
    carregar();
  };

  const badgePerfil = p => {
    const cores = { admin: 'badge-red', financeiro: 'badge-blue', vendas: 'badge-green', estoque: 'badge-yellow', consignado: 'badge-purple' };
    return <span className={cores[p] || 'badge-gray'}>{p}</span>;
  };

  const colunas = [
    { key: 'nome', label: 'Nome' },
    { key: 'email', label: 'Email' },
    { key: 'perfil', label: 'Perfil', width: 120, render: badgePerfil },
    { key: 'ativo', label: 'Status', width: 90, render: v => <span className={v ? 'badge-green' : 'badge-red'}>{v ? 'Ativo' : 'Inativo'}</span> },
    { key: 'criado_em', label: 'Criado em', width: 140, render: v => v ? new Date(v).toLocaleDateString('pt-BR') : '—' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={abrirCriar}>+ Novo Usuário</button>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Níveis de Acesso</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {PERFIS.map(p => (
            <div key={p.value} className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-900 text-sm">{p.label}</p>
              <p className="text-xs text-gray-500 mt-1">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <Tabela colunas={colunas} dados={usuarios} loading={loading}
          acoes={row => (
            <button className="btn-secondary text-xs py-1 px-2" onClick={() => abrirEditar(row)}>Editar</button>
          )}
        />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Usuário' : 'Novo Usuário'}>
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="label">Nome *</label>
            <input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label className="label">{editando ? 'Nova Senha (deixe em branco para manter)' : 'Senha *'}</label>
            <input className="input" type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} required={!editando} minLength={6} />
          </div>
          <div>
            <label className="label">Perfil *</label>
            <select className="input" value={form.perfil} onChange={e => setForm(f => ({ ...f, perfil: e.target.value }))} required>
              {PERFIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {form.perfil === 'consignado' && (
            <div>
              <label className="label">Cliente vinculado *</label>
              <select className="input" value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))} required>
                <option value="">Selecione o cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Este usuário verá apenas os dados do cliente selecionado.</p>
            </div>
          )}
          {editando && (
            <div className="flex items-center gap-3">
              <input type="checkbox" id="ativo" checked={form.ativo === 1} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked ? 1 : 0 }))} />
              <label htmlFor="ativo" className="text-sm text-gray-700">Usuário ativo</label>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
