import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogs } from './api';

const MODULES = [
  'customers',
  'suppliers',
  'products',
  'price-lists',
  'pricing-rules',
  'delivery-notes',
  'account-settlements',
  'payments',
];

export function AuditLogPage() {
  const [module, setModule] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [filters, setFilters] = useState({ module: '', entityType: '', entityId: '' });

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => fetchAuditLogs(filters),
  });

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Auditoría</h1>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Módulo</span>
          <select value={module} onChange={(e) => setModule(e.target.value)} className="w-48 rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todos</option>
            {MODULES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Tipo de entidad</span>
          <input value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="Customer, DeliveryNote…" className="w-48 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">ID de entidad</span>
          <input value={entityId} onChange={(e) => setEntityId(e.target.value)} className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button
          onClick={() => setFilters({ module, entityType, entityId })}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Filtrar
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Usuario</th>
              <th className="px-4 py-2">Módulo</th>
              <th className="px-4 py-2">Entidad</th>
              <th className="px-4 py-2">Acción</th>
              <th className="px-4 py-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">Cargando…</td>
              </tr>
            )}
            {!isLoading && logs?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">Sin registros para estos filtros.</td>
              </tr>
            )}
            {logs?.map((log) => (
              <tr key={log.id} className="border-b border-slate-100 last:border-0 align-top">
                <td className="px-4 py-2 whitespace-nowrap">{new Date(log.occurredAt).toLocaleString('es-AR')}</td>
                <td className="px-4 py-2">{log.user?.email ?? '—'}</td>
                <td className="px-4 py-2">{log.module}</td>
                <td className="px-4 py-2">
                  {log.entityType} <span className="font-mono text-xs text-slate-400">{log.entityId.slice(0, 8)}…</span>
                </td>
                <td className="px-4 py-2">{log.action}</td>
                <td className="px-4 py-2 text-slate-500">{log.reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
