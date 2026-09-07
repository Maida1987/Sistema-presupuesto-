import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchCustomer } from '../customers/api';
import { createSettlement, fetchPendingItems } from './api';

export function NewSettlementPage() {
  const { id: customerId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const { data: customer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => fetchCustomer(customerId as string),
    enabled: Boolean(customerId),
  });

  const { data: pendingItems, isLoading } = useQuery({
    queryKey: ['pending-settlement-items', customerId],
    queryFn: () => fetchPendingItems(customerId as string),
    enabled: Boolean(customerId),
  });

  useEffect(() => {
    if (pendingItems) {
      setSelected(new Set(pendingItems.filter((i) => i.hasPricing).map((i) => i.deliveryNoteItemId)));
    }
  }, [pendingItems]);

  const createMutation = useMutation({
    mutationFn: () => createSettlement(customerId as string, Array.from(selected)),
    onSuccess: (settlement) => navigate(`/liquidaciones/${settlement.id}`),
    onError: () => setError('No se pudo generar la liquidación. Puede que alguno de los remitos ya no esté disponible.'),
  });

  function toggle(itemId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  const total = (pendingItems ?? [])
    .filter((i) => selected.has(i.deliveryNoteItemId) && i.chosenPrice)
    .reduce((sum, i) => sum + i.chosenPrice!.computedPublicPrice * i.quantity, 0);

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">
        Liquidar cuenta — {customer?.businessName ?? '…'}
      </h1>
      <p className="mb-4 text-sm text-slate-500">
        Remitos firmados pendientes de liquidar. El precio de cada ítem se determina con la regla de
        precios vigente en este momento (nunca la del día del retiro) — ver origen de cada precio abajo.
      </p>

      {isLoading && <p className="text-sm text-slate-400">Cargando…</p>}
      {!isLoading && pendingItems?.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          No hay remitos firmados pendientes de liquidar para este cliente.
        </p>
      )}

      {pendingItems && pendingItems.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2"></th>
                <th className="px-3 py-2">Remito</th>
                <th className="px-3 py-2">Fecha retiro</th>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Cant.</th>
                <th className="px-3 py-2">Proveedor / Lista</th>
                <th className="px-3 py-2">Margen / Gastos / IVA</th>
                <th className="px-3 py-2">Precio final</th>
              </tr>
            </thead>
            <tbody>
              {pendingItems.map((item) => (
                <tr key={item.deliveryNoteItemId} className={`border-b border-slate-100 last:border-0 ${!item.hasPricing ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      disabled={!item.hasPricing}
                      checked={selected.has(item.deliveryNoteItemId)}
                      onChange={() => toggle(item.deliveryNoteItemId)}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{item.deliveryNoteNumber}</td>
                  <td className="px-3 py-2">{new Date(item.issuedAt).toLocaleDateString('es-AR')}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-slate-500">{item.code}</span> {item.description}
                  </td>
                  <td className="px-3 py-2">{item.quantity}</td>
                  {item.hasPricing && item.chosenPrice ? (
                    <>
                      <td className="px-3 py-2 text-xs">
                        {item.chosenPrice.supplierName ?? '—'}
                        {item.chosenPrice.priceListEffectiveDate && (
                          <div className="text-slate-400">lista {item.chosenPrice.priceListEffectiveDate}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {(item.chosenPrice.marginPct * 100).toFixed(0)}% / {(item.chosenPrice.expensesPct * 100).toFixed(0)}% / {(item.chosenPrice.ivaPct * 100).toFixed(0)}%
                      </td>
                      <td className="px-3 py-2 font-medium">
                        $ {item.chosenPrice.computedPublicPrice.toLocaleString('es-AR')}
                        {item.candidates.length > 1 && (
                          <div className="text-xs font-normal text-slate-400">+{item.candidates.length - 1} proveedor(es) más</div>
                        )}
                      </td>
                    </>
                  ) : (
                    <td className="px-3 py-2 text-xs text-red-600" colSpan={3}>
                      Sin precio disponible — no se puede incluir en esta liquidación
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingItems && pendingItems.length > 0 && (
        <div className="mt-6 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <p className="text-xs uppercase text-slate-400">Total a liquidar ({selected.size} ítem{selected.size === 1 ? '' : 's'})</p>
            <p className="text-xl font-semibold text-slate-900">$ {total.toLocaleString('es-AR')}</p>
          </div>
          <button
            onClick={() => createMutation.mutate()}
            disabled={selected.size === 0 || createMutation.isPending}
            className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Generando…' : 'Generar liquidación'}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
