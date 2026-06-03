import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const BASE_URL = import.meta.env.VITE_API_URL || '';
const fmt = v => v != null ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

function BadgeDias({ dias }) {
  if (dias > 30) return <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{dias}d — CRÍTICO</span>;
  if (dias > 15) return <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">{dias}d — ATENÇÃO</span>;
  return <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{dias}d — OK</span>;
}

export default function Portal() {
  const { token } = useParams();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [aba, setAba] = useState('produtos');
  const [pedidoForm, setPedidoForm] = useState({ produto_sku: '', quantidade: '', observacoes: '' });
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    fetch(`${BASE_URL}/api/portal/${token}`)
      .then(r => {
        if (!r.ok) throw new Error('Link inválido ou expirado');
        return r.json();
      })
      .then(setDados)
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const enviarPedido = async e => {
    e.preventDefault();
    if (!pedidoForm.produto_sku || !pedidoForm.quantidade) return;
    setEnviando(true);
    try {
      const r = await fetch(`${BASE_URL}/api/portal/${token}/reposicao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pedidoForm),
      });
      if (!r.ok) throw new Error('Erro ao enviar pedido');
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

  if (erro) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center p-8 max-w-sm">
        <p className="text-5xl mb-4">🔒</p>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Link inválido</h2>
        <p className="text-gray-500">{erro}</p>
        <p className="text-sm text-gray-400 mt-4">Entre em contato com seu fornecedor para obter um novo link.</p>
      </div>
    </div>
  );

  const { cliente, produtos, consignacoes, pedidos_pendentes } = dados;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-800 to-amber-600 text-white">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🏆</span>
            <div>
              <p className="text-sm text-amber-200 font-medium">Portal do Consignado</p>
              <h1 className="text-xl font-bold">{cliente.nome}</h1>
            </div>
          </div>
          {(cliente.cidade || cliente.telefone) && (
            <p className="text-sm text-amber-200 mt-1">
              {[cliente.cidade, cliente.estado].filter(Boolean).join(' - ')}
              {cliente.telefone && ` · ${cliente.telefone}`}
            </p>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 flex gap-0">
          {[
            ['produtos', `Produtos (${produtos.length})`],
            ['consignados', `Em consignação (${consignacoes.length})`],
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

        {/* Aba: Produtos disponíveis */}
        {aba === 'produtos' && (
          <>
            {produtos.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">📦</p>
                <p className="text-gray-500">Nenhum produto disponível no momento</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {produtos.map(p => (
                  <div key={p.sku} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex">
                    {(p.foto_filename || p.link_imagem) ? (
                      <img
                        src={p.foto_filename ? `${BASE_URL}/uploads/${p.foto_filename}` : p.link_imagem}
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
                            {[p.marca, p.tipo_charuto, p.vitola, p.intensidade].filter(Boolean).join(' · ')}
                          </p>
                          {p.dimensoes && <p className="text-xs text-gray-400">{p.dimensoes}</p>}
                          {p.origem && <p className="text-xs text-gray-400">Origem: {p.origem}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold text-amber-700">{fmt(p.preco_venda)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{p.estoque_disponivel} unid. disp.</p>
                        </div>
                      </div>
                      {p.observacoes && (
                        <p className="text-xs text-gray-500 mt-2 border-t pt-2">{p.observacoes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Aba: Consignações em aberto */}
        {aba === 'consignados' && (
          <>
            {consignacoes.length === 0 ? (
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
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-green-600">{c.qtd_vendida}</p>
                        <p className="text-xs text-gray-400">Vendido</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-orange-600">{c.qtd_em_aberto}</p>
                        <p className="text-xs text-gray-400">Em aberto</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Aba: Solicitar reposição */}
        {aba === 'pedido' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-1">Solicitar Reposição de Estoque</h3>
            <p className="text-sm text-gray-500 mb-5">Informe o produto e a quantidade desejada. Entraremos em contato para confirmar o envio.</p>

            {sucesso && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
                ✓ {sucesso}
              </div>
            )}

            {pedidos_pendentes.length > 0 && (
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
                  {produtos.map(p => (
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
