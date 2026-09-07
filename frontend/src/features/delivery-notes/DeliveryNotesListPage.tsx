import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDeliveryNotes } from './api';
import type { DeliveryNoteStatus } from './types';

const STATUS_CLASS: Record<DeliveryNoteStatus, string> = {
  BORRADOR: 'bg-slate-100 text-slate-500',
  EMITIDO: 'bg-blue-100 text-blue-700',
  ENTREGADO: 'bg-amber-100 text-amber-700',
  FIRMADO: 'bg-green-100 text-green-700',
  LIQUIDADO: 'bg-purple-100 text-purple-700',
  ANULADO: 'bg-red-100 text-red-700',
};

export function DeliveryNotesListPage() {
  const { data: deliveryNotes, isLoading } = useQuery({
    queryKey: ['delivery-notes', {}],
    queryFn: () => fetchDeliveryNotes({}),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Remitos</h1>
        <Link
          to="/remitos/nuevo"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Nuevo remito
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2">Número</th>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">Cargando…</td>
              </tr>
            )}
            {!isLoading && deliveryNotes?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">Sin remitos todavía.</td>
              </tr>
            )}
            {deliveryNotes?.map((dn) => (
              <tr key={dn.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  <Link to={`/remitos/${dn.id}`} className="font-mono text-xs text-slate-700 underline">
                    {dn.series}-{String(dn.number).padStart(8, '0')}
                  </Link>
                </td>
                <td className="px-4 py-2">{new Date(dn.issuedAt).toLocaleDateString('es-AR')}</td>
                <td className="px-4 py-2">{dn.customer.businessName}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[dn.status]}`}>{dn.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
