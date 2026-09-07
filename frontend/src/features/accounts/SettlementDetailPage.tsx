import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { confirmSettlement, fetchSettlement, voidSettlement } from './api';
import { useAuth } from '../auth/AuthContext';

const STATUS_CLASS: Record<string, string> = {
  BORRADOR: 'bg-amber-100 text-amber-700',
  CONFIRMADA: 'bg-green-100 text-green-700',
  ANULADA: 'bg-red-100 text-red-700',
};

export function SettlementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showVoidForm, setShowVoidForm] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: settlement, isLoading } = useQuery({
    queryKey: ['settlement', id],
    queryFn: () => fetchSettlement(id as string),
    enabled: Boolean(id),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['settlement', id] });
  }

  const confirmMutation = useMutation({
    mutationFn: () => confirmSettlement(id as string),
    onSuccess: invalidate,
    onError: () => setActionError('No se pudo confirmar la liquidación.'),
  });

  const voidMutation = useMutation({
    mutationFn: () => voidSettlement(id as string, voidReason),
    onSuccess: () => {
      invalidate();
      setShowVoidForm(false);
    },
    onError: () => setActionError('No se pudo anular la liquidación.'),
  });

  if (isLoading || !settlement) {
    return <p className="text-sm text-slate-400">Cargando…</p>;
  }

  const canWrite = hasPermission('settlements.write');

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Liquidación</h1>
      <p className="mb-4 text-sm text-slate-500">
        <Link to={`/clientes/${settlement.customerId}/cuenta`} className="underline">
          {settlement.customer.businessName} ({settlement.customer.internalCode})
        </Link>{' '}
        · {new Date(settlement.periodFrom).toLocaleDateString('es-AR')} – {new Date(settlement.periodTo).toLocaleDateString('es-AR')} ·{' '}
        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[settlement.status]}`}>{settlement.status}</span>
        {settlement.voidReason && <> — motivo: {settlement.voidReason}</>}
      </p>

      <div className="mb-6 space-y-3">
        {settlement.items.map((item) => {
          const b = item.priceBreakdown;
          return (
            <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs text-slate-500">{b.code}</span> <strong>{b.product}</strong>
                </div>
                <div className="font-semibold">$ {Number(item.subtotal).toLocaleString('es-AR')}</div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-4">
                <div><dt className="text-slate-400">Remito</dt><dd>{b.deliveryNoteNumber}</dd></div>
                <div><dt className="text-slate-400">Fecha retiro</dt><dd>{new Date(b.deliveryDate).toLocaleDateString('es-AR')}</dd></div>
                <div><dt className="text-slate-400">Proveedor</dt><dd>{b.supplier ?? '—'}</dd></div>
                <div><dt className="text-slate-400">Lista</dt><dd>{b.priceListEffectiveDate ?? '—'}</dd></div>
                <div><dt className="text-slate-400">Precio de lista</dt><dd>$ {b.netPrice.toLocaleString('es-AR')}</dd></div>
                <div><dt className="text-slate-400">Margen</dt><dd>{(b.marginPct * 100).toFixed(1)}%</dd></div>
                <div><dt className="text-slate-400">Gastos</dt><dd>{(b.expensesPct * 100).toFixed(1)}%</dd></div>
                <div><dt className="text-slate-400">IVA</dt><dd>{(b.ivaPct * 100).toFixed(1)}%</dd></div>
                <div><dt className="text-slate-400">Precio final</dt><dd>$ {b.finalPrice.toLocaleString('es-AR')} × {item.quantity}</dd></div>
              </dl>
              {b.alternativeCandidates.length > 0 && (
                <details className="mt-2 text-xs text-slate-500">
                  <summary className="cursor-pointer underline">Comparar con otros proveedores ({b.alternativeCandidates.length})</summary>
                  <ul className="mt-1 space-y-0.5">
                    {b.alternativeCandidates.map((c) => (
                      <li key={c.priceHistoryId}>
                        {c.supplierName}: $ {c.computedPublicPrice.toLocaleString('es-AR')}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-6 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-lg font-semibold text-slate-900">Total: $ {Number(settlement.totalAmount).toLocaleString('es-AR')}</p>
        <div className="flex gap-2">
          {canWrite && settlement.status === 'BORRADOR' && (
            <button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {confirmMutation.isPending ? 'Confirmando…' : 'Confirmar liquidación'}
            </button>
          )}
          {canWrite && settlement.status !== 'ANULADA' && !showVoidForm && (
            <button onClick={() => setShowVoidForm(true)} className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
              Anular
            </button>
          )}
        </div>
      </div>

      {showVoidForm && (
        <div className="mb-6 max-w-md rounded-lg border border-red-200 bg-red-50 p-4">
          <label className="mb-2 block text-sm font-medium text-slate-700">Motivo de la anulación</label>
          <textarea
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={() => voidMutation.mutate()}
              disabled={voidReason.trim().length < 3 || voidMutation.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Confirmar anulación
            </button>
            <button onClick={() => setShowVoidForm(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}
    </div>
  );
}
