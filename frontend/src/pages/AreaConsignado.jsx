import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const fmt = v => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

function BadgeDias({ dias }) {
  if (dias > 30) return <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{dias}d — CRÍTICO</span>;
  if (dias > 15) return <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">{dias}d — ATENÇÃO</span>;
  return <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{dias}d — OK</span>;
}

export default function AreaConsignado() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState('consignados');
  const [pedidoForm, setPedidoForm] = useState({ produto_sku: '', quantidade: '', observacoes: '' });
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    if (!usuario || usuario.perfil !== 'consignado') {
      navigate('/login', { replace: true });
      return;
    }
    api.get('/consignado/minha-area')
      .then(r => setDados(r.data))
      .catch(() => navigate('/login', { replace: true }))
      .finally(() => setLoading(false));
  }, []);

  const enviarPedido = async e => {
    e.preventDefault();
    if (!pedidoForm.produto_sku || !pedidoForm.quantidade) return;
    setEnviando(true);
    try {
      await api.post('/consignado/reposicao', pedidoForm);
      setSucesso('Pedido de reposição enviado com sucesso!');
      setPedidoForm({ produto_sku: '', quantidade: '', observacoes: '' });
      setTimeout(() => setSucesso(''), 5000);
    } catch {
      alert('Erro ao enviar pedido. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const { cliente, consignacoes, produtos, pedidos_pendentes } = dados || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-amber-800 to-amber-600 text-white">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <div>
              <p className="text-sm text-amber-200 font-medium">Área do Consignado</p>
              <h1 className="text-xl font-bold">{cliente?.nome}</h1>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="text-sm text-amber-200 hover:text-white transition-colors"
          >
            Sair
          </button>
        </div>
      </div>

      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 flex gap-0">
          {[
            ['consignados', `Em consignação (${consignacoes?.length ?? 0})`],
            ['produtos', `Produtos disponíveis (${produtos?.length ?? 0})`],
            ['pedido', 'Solicitar reposição'],
          ].map(([val, label]) => (
            <button key={val} onClick={() => setAba(val)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${aba === val ? 'border-amber-600 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {aba === 'consignados' && (
          <>
            {!consignacoes?.length ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">✅</p>
                <p className="text-gray-500">Nenhum item em consignação no momento</p>
              </div>
            ) : (
              <div className="space-y-3">
                {consignacoes.map(c => (
                  <div key={c.codigo} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{c.produto_nome}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Enviado em {fmtDate(c.data_envio)} · Cód. {c.codigo}
                        </p>
                      </div>
                      <BadgeDias dias={c.dias_em_aberto} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3 text-center">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-gray-900">{c.qtd_enviada}</p>
                        <p className="text-xs text-gray-400">Enviado</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-green-600">{c.qtd_vendida}</p>
                        <p className="text-xs text-gray-400">Vendido</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-orange-600">{c.qtd_em_aberto}</p>
                        <p className="text-xs text-gray-400">Em aberto</p>
                      </div>
                    </div>
                    <div className="mt-2 text-right text-xs text-gray-400">
                      Valor em aberto: <strong className="text-gray-700">{fmt(c.qtd_em_aberto * c.preco_unit)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {aba === 'produtos' && (
          <>
            {!produtos?.length ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">📦</p>
                <p className="text-gray-500">Nenhum produto disponível</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {produtos.map(p => (
                  <div key={p.sku} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex">
                    {(p.foto_filename || p.link_imagem) ? (
                      <img
                        src={p.foto_filename
                          ? `${import.meta.env.VITE_API_URL || ''}/uploads/${p.foto_filename}`
                          : p.link_imagem}
                        alt={p.descricao}
                        className="w-24 h-24 object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-amber-50 flex items-center justify-center flex-shrink-0 text-3xl">🏆</div>
                    )}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900">{p.descricao}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {[p.marca, p.tipo_charuto, p.vitola].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold text-amber-700">{fmt(p.preco_venda)}</p>
                          <p className="text-xs text-gray-400">{p.estoque_disponivel} un. disp.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {aba === 'pedido' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-1">Solicitar Reposição de Estoque</h3>
            <p className="text-sm text-gray-500 mb-5">Informe o produto e a quantidade desejada. Entraremos em contato para confirmar o envio.</p>

            {sucesso && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
                ✓ {sucesso}
              </div>
            )}

            {pedidos_pendentes?.length > 0 && (
              <div className="mb-5 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm font-medium text-amber-800 mb-2">Pedidos pendentes:</p>
                {pedidos_pendentes.map(p => (
                  <div key={p.id} className="text-sm text-amber-700">
                    • {p.produto_nome} — {p.quantidade} un.
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={enviarPedido} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Produto *</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={pedidoForm.produto_sku}
                  onChange={e => setPedidoForm(f => ({ ...f, produto_sku: e.target.value }))}
                  required
                >
                  <option value="">Selecione o produto</option>
                  {produtos?.map(p => (
                    <option key={p.sku} value={p.sku}>{p.descricao}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade *</label>
                <input
                  type="number" min="1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={pedidoForm.quantidade}
                  onChange={e => setPedidoForm(f => ({ ...f, quantidade: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações (opcional)</label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Preferência de data, embalagem especial, etc."
                  value={pedidoForm.observacoes}
                  onChange={e => setPedidoForm(f => ({ ...f, observacoes: e.target.value }))}
                />
              </div>
              <button
                type="submit"
                disabled={enviando}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {enviando ? 'Enviando...' : 'Enviar Pedido de Reposição'}
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="text-center py-8 text-xs text-gray-300">
        Charutos Premium · Portal Exclusivo
      </div>
    </div>
  );
}
