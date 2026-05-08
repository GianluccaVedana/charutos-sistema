import React from 'react';

export default function Tabela({ colunas, dados, acoes, loading, emptyMsg = 'Nenhum registro encontrado' }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-charuto-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            {colunas.map(col => (
              <th key={col.key} className="table-header" style={{ width: col.width }}>
                {col.label}
              </th>
            ))}
            {acoes && <th className="table-header text-right">Ações</th>}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-50">
          {dados.length === 0 ? (
            <tr>
              <td colSpan={colunas.length + (acoes ? 1 : 0)} className="text-center py-12 text-gray-400 text-sm">
                {emptyMsg}
              </td>
            </tr>
          ) : (
            dados.map((row, i) => (
              <tr key={row.id || i} className="table-row">
                {colunas.map(col => (
                  <td key={col.key} className="table-cell">
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
                {acoes && (
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-2">
                      {acoes(row)}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
