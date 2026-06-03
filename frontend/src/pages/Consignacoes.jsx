import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Tabela from '../components/Tabela';
import Modal from '../components/Modal';

const fmt = v => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const BASE_URL = import.meta.env.VITE_API_URL || '';

const FORM_VAZIO = { data_envio: '', cliente_id: '', produto_sku: '', qtd_enviada: '', preco_unit: '', frete: '', observacoes: '' };
const ITEM_VAZIO = { produto_sku: '', qtd_enviada: '', preco_unit: '', frete: 0 };

function BadgeAlerta({ v }) {
  if (v === 'CRÍTICO') return <span className="badge-red">{v}</span>;
  if (v === 'ATENÇÃO') return <span className="badge-yellow">{v}</span>;
  if (v === 'Fechado') return <span className="badge-gray">Fechado</span>;
  return <span className="badge-green">OK</span>;
}

export default function Consignacoes() {
  const [aba, setAba] = useState('consig'); // 'consig' | 'remessas' | 'pedidos'
  const [dados, setDados] = useState([]);
  const [remessas, setRemessas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('aberto');
  const [clientes, setClientes] = useState([]);
  const [produtos, setProdutos] = useState([]);

  // Modais
  const [modal, setModal] = useState(false);
  const [modalRemessa, setModalRemessa] = useState(false);
  const [modalFechamento, setModalFechamento] = useState(null);

  const [form, setForm] = useState(FORM_VAZIO);
  const [formFech, setFormFech] = useState({ qtd_vendida: '', qtd_devolvida: '' });

  // Formulário de remessa (multi-item)
  const [remessaForm, setRemessaForm] = useState({ cliente_id: '', data_envio: '', observacoes: '' });
  const [remessaItens, setRemessaItens] = useState([{ ...ITEM_VAZIO }]);

  const carregar = async () => {
    setLoading(true);
    const params = filtro !== 'todos' ? { status: filtro } : {};
    const [r, rem, ped] = await Promise.all([
      api.get('/consignacoes', { params }),
      api.get('/remessas'),
      api.get('/pedidos-reposicao', { params: { status: 'pendente' } }),
    ]);
    setDados(r.data);
    setRemessas(rem.data);
    setPedidos(ped.data);
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

  const salvarRemessa = async e => {
    e.preventDefault();
    const itensValidos = remessaItens.filter(i => i.produto_sku && i.qtd_enviada);
    if (!itensValidos.length) return alert('Adicione pelo menos um produto');
    await api.post('/remessas', { ...remessaForm, itens: itensValidos });
    setModalRemessa(false);
    setRemessaForm({ cliente_id: '', data_envio: '', observacoes: '' });
    setRemessaItens([{ ...ITEM_VAZIO }]);
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

  const excluirRemessa = async id => {
    if (!confirm('Excluir esta remessa e todos os seus itens?')) return;
    await api.delete(`/remessas/${id}`);
    carregar();
  };

  const baixarPdf = (endpoint, nome) => {
    const token = localStorage.getItem('token');
    const url = `${BASE_URL}/api${endpoint}`;
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', nome);
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const burl = URL.createObjectURL(blob);
        a.href = burl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(burl);
      });
  };

  const atenderPedido = async (id) => {
    await api.patch(`/pedidos-reposicao/${id}`, { status: 'atendido' });
    carregar();
  };

  const adicionarItem = () => setRemessaItens(prev => [...prev, { ...ITEM_VAZIO }]);
  const removerItem = i => setRemessaItens(prev => prev.filter((_, idx) => idx !== i));
  const atualizarItem = (i, campo, valor) => {
    setRemessaItens(prev => {
      const novo = [...prev];
      novo[i] = { ...novo[i], [campo]: valor };
      if (campo === 'produto_sku') {
        const p = produtos.find(x => x.sku === valor);
        if (p) novo[i].preco_unit = p.preco_venda || '';
      }
      return novo;
    });
  };

  const totalRemessa = remessaItens.reduce((acc, i) => acc + (Number(i.qtd_enviada) || 0) * (Number(i.preco_unit) || 0), 0);

  const colunasConsig = [
    { key: 'codigo', label: 'Cód.', width: 90 },
    { key: 'data_envio', label: 'Data', width: 95, render: fmtDate },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'produto_nome', label: 'Produto' },
    { key: 'qtd_enviada', label: 'Env.', width: 55 },
    { key: 'qtd_vendida', label: 'Vend.', width: 55 },
    { key: 'qtd_em_aberto', label: 'Aberto', width: 65, render: v => <strong className={v > 0 ? 'text-orange-600' : 'text-green-600'}>{v}</strong> },
    { key: 'valor_potencial', label: 'Valor', width: 100, render: v => fmt(v) },
    { key: 'dias_em_aberto', label: 'Dias', width: 55, render: v => v || '—' },
    { key: 'alerta', label: 'Status', width: 90, render: v => <BadgeAlerta v={v} /> },
  ];

  const colunasRemessas = [
    { key: 'codigo', label: 'Código', width: 95 },
    { key: 'data_envio', label: 'Data', width: 95, render: fmtDate },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'total_itens', label: 'Itens', width: 55 },
    { key: 'total_unidades', label: 'Unidades', width: 80 },
    { key: 'valor_total', label: 'Valor Total', width: 110, render: v => fmt(v) },
    { key: 'qtd_em_aberto', label: 'Em Aberto', width: 80, render: v => <strong className={v > 0 ? 'text-orange-600' : 'text-green-600'}>{v ?? 0}</strong> },
  ];

  const colunasPedidos = [
    { key: 'criado_em', label: 'Data', width: 110, render: v => v ? new Date(v).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—' },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'produto_nome', label: 'Produto' },
    { key: 'quantidade', label: 'Qtd', width: 60 },
    { key: 'observacoes', label: 'Obs.', render: v => v || '—' },
  ];

  return (
    <div className="space-y-5">
      {/* Abas */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[['consig','Consignações'], ['remessas','Remessas'], ['pedidos',`Pedidos${pedidos.length ? ` (${pedidos.length})` : ''}`]].map(([val, label]) => (
            <button key={val} onClick={() => setAba(val)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${aba === val ? 'bg-white text-charuto-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" onClick={() => { setRemessaForm({ cliente_id: '', data_envio: '', observacoes: '' }); setRemessaItens([{ ...ITEM_VAZIO }]); setModalRemessa(true); }}>
            📦 Nova Remessa
          </button>
          <button className="btn-primary text-sm" onClick={() => { setForm(FORM_VAZIO); setModal(true); }}>
            + Consignação avulsa
          </button>
        </div>
      </div>

      {/* Aba: Consignações */}
      {aba === 'consig' && (
        <>
          <div className="flex gap-2 flex-wrap">
            {[['aberto','Abertas'],['fechado','Fechadas'],['todos','Todas']].map(([val, label]) => (
              <button key={val} onClick={() => setFiltro(val)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtro === val ? 'bg-charuto-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="card p-0 overflow-hidden">
            <Tabela colunas={colunasConsig} dados={dados} loading={loading}
              acoes={row => (
                <>
                  <button className="btn-secondary text-xs py-1 px-2"
                    onClick={() => baixarPdf(`/consignacoes/${row.id}/pdf`, `${row.codigo}.pdf`)}>
                    PDF
                  </button>
                  {row.qtd_em_aberto > 0 && (
                    <button className="btn-success text-xs py-1 px-2"
                      onClick={() => { setModalFechamento(row); setFormFech({ qtd_vendida: row.qtd_em_aberto, qtd_devolvida: '' }); }}>
                      Fechar
                    </button>
                  )}
                  <button className="btn-danger text-xs py-1 px-2" onClick={() => excluir(row.id)}>Excluir</button>
                </>
              )}
            />
          </div>
        </>
      )}

      {/* Aba: Remessas */}
      {aba === 'remessas' && (
        <div className="card p-0 overflow-hidden">
          <Tabela colunas={colunasRemessas} dados={remessas} loading={loading}
            acoes={row => (
              <>
                <button className="btn-secondary text-xs py-1 px-2"
                  onClick={() => baixarPdf(`/remessas/${row.id}/pdf`, `${row.codigo}.pdf`)}>
                  PDF Romaneio
                </button>
                <button className="btn-danger text-xs py-1 px-2" onClick={() => excluirRemessa(row.id)}>Excluir</button>
              </>
            )}
          />
        </div>
      )}

      {/* Aba: Pedidos de reposição */}
      {aba === 'pedidos' && (
        <div className="card p-0 overflow-hidden">
          {pedidos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="text-4xl mb-3">✅</span>
              <p className="text-gray-500">Nenhum pedido de reposição pendente</p>
            </div>
          ) : (
            <Tabela colunas={colunasPedidos} dados={pedidos} loading={loading}
              acoes={row => (
                <button className="btn-success text-xs py-1 px-2" onClick={() => atenderPedido(row.id)}>
                  Atender
                </button>
              )}
            />
          )}
        </div>
      )}

      {/* Modal: consignação avulsa */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nova Consignação" size="lg">
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Data de Envio *</label>
              <input className="input" type="date" value={form.data_envio}
                onChange={e => setForm(f => ({ ...f, data_envio: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Cliente *</label>
              <select className="input" value={form.cliente_id}
                onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))} required>
                <option value="">Selecione</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Produto *</label>
            <select className="input" value={form.produto_sku}
              onChange={e => {
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
              <input className="input" type="number" min="1" value={form.qtd_enviada}
                onChange={e => setForm(f => ({ ...f, qtd_enviada: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Preço Unit. (R$) *</label>
              <input className="input" type="number" step="0.01" value={form.preco_unit}
                onChange={e => setForm(f => ({ ...f, preco_unit: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Frete (R$)</label>
              <input className="input" type="number" step="0.01" value={form.frete}
                onChange={e => setForm(f => ({ ...f, frete: e.target.value }))} />
            </div>
          </div>
          {form.qtd_enviada && form.preco_unit && (
            <div className="bg-charuto-50 rounded-lg p-3 text-sm">
              Valor Potencial: <strong>{fmt(Number(form.qtd_enviada) * Number(form.preco_unit) + Number(form.frete || 0))}</strong>
            </div>
          )}
          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={2} value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Registrar</button>
          </div>
        </form>
      </Modal>

      {/* Modal: nova remessa multi-item */}
      <Modal open={modalRemessa} onClose={() => setModalRemessa(false)} title="Nova Remessa — Múltiplos Produtos" size="xl">
        <form onSubmit={salvarRemessa} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cliente *</label>
              <select className="input" value={remessaForm.cliente_id}
                onChange={e => setRemessaForm(f => ({ ...f, cliente_id: e.target.value }))} required>
                <option value="">Selecione</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Data de Envio *</label>
              <input className="input" type="date" value={remessaForm.data_envio}
                onChange={e => setRemessaForm(f => ({ ...f, data_envio: e.target.value }))} required />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Produtos da Remessa</label>
              <button type="button" className="text-charuto-600 text-sm font-medium hover:underline" onClick={adicionarItem}>
                + Adicionar produto
              </button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                <span className="col-span-5">Produto</span>
                <span className="col-span-2">Qtd</span>
                <span className="col-span-2">Preço Unit.</span>
                <span className="col-span-2">Frete</span>
                <span className="col-span-1"></span>
              </div>
              {remessaItens.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <select className="input text-sm" value={item.produto_sku}
                      onChange={e => atualizarItem(i, 'produto_sku', e.target.value)} required>
                      <option value="">Selecione</option>
                      {produtos.map(p => <option key={p.sku} value={p.sku}>{p.sku} — {p.descricao}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input className="input text-sm" type="number" min="1" placeholder="Qtd"
                      value={item.qtd_enviada}
                      onChange={e => atualizarItem(i, 'qtd_enviada', e.target.value)} required />
                  </div>
                  <div className="col-span-2">
                    <input className="input text-sm" type="number" step="0.01" placeholder="R$"
                      value={item.preco_unit}
                      onChange={e => atualizarItem(i, 'preco_unit', e.target.value)} required />
                  </div>
                  <div className="col-span-2">
                    <input className="input text-sm" type="number" step="0.01" placeholder="R$"
                      value={item.frete}
                      onChange={e => atualizarItem(i, 'frete', e.target.value)} />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {remessaItens.length > 1 && (
                      <button type="button" className="text-red-400 hover:text-red-600 text-lg leading-none"
                        onClick={() => removerItem(i)}>×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {totalRemessa > 0 && (
              <div className="mt-3 bg-charuto-50 rounded-lg p-3 text-sm text-right">
                Valor Total da Remessa: <strong className="text-charuto-700">{fmt(totalRemessa)}</strong>
              </div>
            )}
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={2} value={remessaForm.observacoes}
              onChange={e => setRemessaForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalRemessa(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Registrar Remessa</button>
          </div>
        </form>
      </Modal>

      {/* Modal: fechar consignação */}
      <Modal open={!!modalFechamento} onClose={() => setModalFechamento(null)} title="Fechar Consignação">
        {modalFechamento && (
          <form onSubmit={salvarFechamento} className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p><strong>{modalFechamento.produto_nome}</strong> — {modalFechamento.cliente_nome}</p>
              <p className="text-gray-500 mt-1">Em aberto: <strong>{modalFechamento.qtd_em_aberto} unidades</strong></p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Qtd. Vendida</label>
                <input className="input" type="number" min="0" max={modalFechamento.qtd_em_aberto}
                  value={formFech.qtd_vendida}
                  onChange={e => setFormFech(f => ({ ...f, qtd_vendida: e.target.value }))} />
              </div>
              <div>
                <label className="label">Qtd. Devolvida</label>
                <input className="input" type="number" min="0" max={modalFechamento.qtd_em_aberto}
                  value={formFech.qtd_devolvida}
                  onChange={e => setFormFech(f => ({ ...f, qtd_devolvida: e.target.value }))} />
              </div>
            </div>
            {(formFech.qtd_vendida || formFech.qtd_devolvida) && (
              <div className="bg-charuto-50 rounded-lg p-3 text-sm">
                Restará em aberto: <strong>
                  {Math.max(0, modalFechamento.qtd_em_aberto - Number(formFech.qtd_vendida || 0) - Number(formFech.qtd_devolvida || 0))} un.
                </strong>
              </div>
            )}
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
