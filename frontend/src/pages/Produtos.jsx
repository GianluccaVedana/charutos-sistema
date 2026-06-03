import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import Tabela from '../components/Tabela';
import Modal from '../components/Modal';

const fmt = v => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const fmtPct = v => v != null ? (v * 100).toFixed(1) + '%' : '—';

const BASE_URL = import.meta.env.VITE_API_URL || '';

const FORM_VAZIO = {
  sku: '', descricao: '', marca: '', dimensoes: '', origem: '', unidade: 1,
  preco_fob: '', frete_unit: 0, impostos_unit: 0, outros_custos: 0, preco_venda: '',
  estoque_minimo: '', observacoes: '', link_imagem: '',
  tipo_charuto: '', vitola: '', intensidade: '',
};

const TIPOS_CHARUTO = ['', 'Charuto', 'Cigarrilha', 'Charuto de Cachimbo', 'Mini Charuto', 'Outro'];
const INTENSIDADES = ['', 'Suave', 'Médio-Suave', 'Médio', 'Médio-Forte', 'Forte'];

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editando, setEditando] = useState(null);
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [uploadando, setUploadando] = useState(false);
  const fileInputRef = useRef();

  const carregar = async () => {
    setLoading(true);
    const r = await api.get('/produtos', { params: { busca } });
    setProdutos(r.data);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [busca]);

  const abrirCriar = () => {
    setForm(FORM_VAZIO);
    setEditando(null);
    setFotoFile(null);
    setFotoPreview(null);
    setModal(true);
  };

  const abrirEditar = p => {
    setForm({ ...FORM_VAZIO, ...p, preco_fob: p.preco_fob || '', preco_venda: p.preco_venda || '', estoque_minimo: p.estoque_minimo || '' });
    setEditando(p.sku);
    setFotoFile(null);
    setFotoPreview(p.foto_filename ? `${BASE_URL}/uploads/${p.foto_filename}` : null);
    setModal(true);
  };

  const onFotoChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const salvar = async e => {
    e.preventDefault();
    if (editando) {
      await api.put(`/produtos/${editando}`, form);
    } else {
      await api.post('/produtos', form);
    }
    if (fotoFile) {
      setUploadando(true);
      const fd = new FormData();
      fd.append('file', fotoFile);
      await api.post(`/produtos/${editando || form.sku}/foto`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadando(false);
    }
    setModal(false);
    carregar();
  };

  const excluir = async sku => {
    if (!confirm('Excluir este produto?')) return;
    await api.delete(`/produtos/${sku}`);
    carregar();
  };

  const custo = f => Number(f.preco_fob) + Number(f.frete_unit) + Number(f.impostos_unit) + Number(f.outros_custos);
  const margem = f => Number(f.preco_venda) > 0 ? (Number(f.preco_venda) - custo(f)) / Number(f.preco_venda) : 0;

  const colunas = [
    {
      key: 'foto_filename', label: '', width: 44,
      render: (v, r) => v || r.link_imagem ? (
        <img src={v ? `${BASE_URL}/uploads/${v}` : r.link_imagem} alt=""
          className="w-8 h-8 rounded object-cover border border-gray-200" />
      ) : (
        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-300 text-base">🚬</div>
      ),
    },
    { key: 'sku', label: 'SKU', width: 90 },
    { key: 'descricao', label: 'Produto' },
    { key: 'marca', label: 'Marca', width: 100 },
    { key: 'tipo_charuto', label: 'Tipo', width: 100, render: v => v || '—' },
    { key: 'intensidade', label: 'Intensidade', width: 110, render: v => v || '—' },
    { key: 'custo_total', label: 'Custo', width: 100, render: v => fmt(v) },
    { key: 'preco_venda', label: 'Venda', width: 100, render: v => fmt(v) },
    {
      key: 'preco_venda', label: 'Margem', width: 85, render: (_, r) => {
        const m = r.preco_venda > 0 ? (r.preco_venda - r.custo_total) / r.preco_venda : 0;
        return <span className={m >= 0.3 ? 'text-green-600 font-medium' : m >= 0.15 ? 'text-yellow-600 font-medium' : 'text-red-600 font-medium'}>{fmtPct(m)}</span>;
      }
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <input className="input max-w-xs" placeholder="Buscar por SKU, nome ou marca..."
          value={busca} onChange={e => setBusca(e.target.value)} />
        <button className="btn-primary" onClick={abrirCriar}>+ Novo Produto</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <Tabela colunas={colunas} dados={produtos} loading={loading}
          acoes={row => (
            <>
              <button className="btn-secondary text-xs py-1 px-2" onClick={() => abrirEditar(row)}>Editar</button>
              <button className="btn-danger text-xs py-1 px-2" onClick={() => excluir(row.sku)}>Excluir</button>
            </>
          )}
        />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Produto' : 'Novo Produto'} size="xl">
        <form onSubmit={salvar} className="space-y-4">
          {/* Identificação */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">SKU *</label>
              <input className="input" value={form.sku}
                onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                disabled={!!editando} required />
            </div>
            <div>
              <label className="label">Marca</label>
              <input className="input" value={form.marca}
                onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Descrição *</label>
            <input className="input" value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} required />
          </div>

          {/* Características do charuto */}
          <div className="bg-charuto-50 rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold text-charuto-700 uppercase tracking-wide">Características</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="label">Tipo</label>
                <select className="input" value={form.tipo_charuto}
                  onChange={e => setForm(f => ({ ...f, tipo_charuto: e.target.value }))}>
                  {TIPOS_CHARUTO.map(t => <option key={t} value={t}>{t || 'Selecione'}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Vitola</label>
                <input className="input" value={form.vitola} placeholder="ex: Robusto, Churchill..."
                  onChange={e => setForm(f => ({ ...f, vitola: e.target.value }))} />
              </div>
              <div>
                <label className="label">Intensidade</label>
                <select className="input" value={form.intensidade}
                  onChange={e => setForm(f => ({ ...f, intensidade: e.target.value }))}>
                  {INTENSIDADES.map(i => <option key={i} value={i}>{i || 'Selecione'}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Dimensões</label>
                <input className="input" value={form.dimensoes} placeholder="ex: 165x19mm"
                  onChange={e => setForm(f => ({ ...f, dimensoes: e.target.value }))} />
              </div>
              <div>
                <label className="label">Origem / País</label>
                <input className="input" value={form.origem} placeholder="Brasil, Cuba..."
                  onChange={e => setForm(f => ({ ...f, origem: e.target.value }))} />
              </div>
              <div>
                <label className="label">Qtd. por caixa</label>
                <input className="input" type="number" min="1" value={form.unidade}
                  onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Custos e preço */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="label">Preço FOB (R$) *</label>
              <input className="input" type="number" step="0.01" value={form.preco_fob}
                onChange={e => setForm(f => ({ ...f, preco_fob: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Frete Unit. (R$)</label>
              <input className="input" type="number" step="0.01" value={form.frete_unit}
                onChange={e => setForm(f => ({ ...f, frete_unit: e.target.value }))} />
            </div>
            <div>
              <label className="label">Impostos (R$)</label>
              <input className="input" type="number" step="0.01" value={form.impostos_unit}
                onChange={e => setForm(f => ({ ...f, impostos_unit: e.target.value }))} />
            </div>
            <div>
              <label className="label">Outros Custos (R$)</label>
              <input className="input" type="number" step="0.01" value={form.outros_custos}
                onChange={e => setForm(f => ({ ...f, outros_custos: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Preço de Venda (R$) *</label>
              <input className="input" type="number" step="0.01" value={form.preco_venda}
                onChange={e => setForm(f => ({ ...f, preco_venda: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Estoque Mínimo (un)</label>
              <input className="input" type="number" value={form.estoque_minimo}
                onChange={e => setForm(f => ({ ...f, estoque_minimo: e.target.value }))} />
            </div>
          </div>

          {(form.preco_fob || form.preco_venda) && (
            <div className="bg-charuto-50 rounded-lg p-3 text-sm">
              <div className="grid grid-cols-3 gap-4">
                <div><span className="text-gray-500">Custo Total:</span> <strong>{fmt(custo(form))}</strong></div>
                <div><span className="text-gray-500">Margem R$:</span> <strong>{fmt(Number(form.preco_venda) - custo(form))}</strong></div>
                <div><span className="text-gray-500">Margem %:</span>
                  <strong className={margem(form) >= 0.3 ? 'text-green-600' : 'text-red-600'}>{fmtPct(margem(form))}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Foto */}
          <div>
            <label className="label">Foto do Produto</label>
            <div className="flex items-start gap-4">
              <div
                className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-charuto-400 transition-colors flex-shrink-0"
                onClick={() => fileInputRef.current?.click()}
              >
                {fotoPreview ? (
                  <img src={fotoPreview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <p className="text-2xl text-gray-300">📷</p>
                    <p className="text-xs text-gray-400">Clique para<br />adicionar</p>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFotoChange} />
                <button type="button" className="btn-secondary text-sm"
                  onClick={() => fileInputRef.current?.click()}>
                  {fotoPreview ? 'Trocar foto' : 'Selecionar foto'}
                </button>
                {fotoFile && <p className="text-xs text-charuto-600">✓ {fotoFile.name}</p>}
                <p className="text-xs text-gray-400">JPG, PNG ou WebP. A foto será salva ao clicar em Salvar.</p>
                <div>
                  <label className="label text-xs">Ou informe um URL de imagem</label>
                  <input className="input text-sm" value={form.link_imagem} placeholder="https://..."
                    onChange={e => setForm(f => ({ ...f, link_imagem: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={2} value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={uploadando}>
              {uploadando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
