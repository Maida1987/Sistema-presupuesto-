import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCustomer } from '../customers/api';
import { fetchCustomerAccount } from './api';
import { createPayment, fetchPaymentMethods } from '../payments/api';
import { useAuth } from '../auth/AuthContext';

const TYPE_LABEL: Record<string, string> = {
  REMITO_PENDIENTE: 'Remito pendiente',
  LIQUIDACION: 'Liquidación',
  PAGO: 'Pago',
  AJUSTE: 'Ajuste',
};

export function CustomerAccountPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const { data: customer } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => fetchCustomer(id as string),
    enabled: Boolean(id),
  });

  const { data: account, isLoading } = useQuery({
    queryKey: ['customer-account', id],
    queryFn: () => fetchCustomerAccount(id as string),
    enabled: Boolean(id),
  });

  const { data: paymentMethods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: fetchPaymentMethods,
    enabled: showPaymentForm,
  });

  const paymentMutation = useMutation({
    mutationFn: createPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-account', id] });
      setShowPaymentForm(false);
    },
    onError: () => setPaymentError('No se pudo registrar el pago. Revisá los datos ingresados.'),
  });

  function handleCreatePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentError(null);
    const form = new FormData(event.currentTarget);
    paymentMutation.mutate({
      customerId: id as string,
      amount: Number(form.get('amount')),
      paymentMethodId: String(form.get('paymentMethodId')),
      referenceNumber: String(form.get('referenceNumber') ?? '') || undefined,
      notes: String(form.get('notes') ?? '') || undefined,
    });
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">
        Cuenta corriente — {customer?.businessName ?? '…'}
      </h1>
      <p className="mb-4 text-sm text-slate-500">{customer?.internalCode}</p>

      <div className="mb-6 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <p className="text-xs uppercase text-slate-400">Saldo</p>
          <p className="text-2xl font-semibold text-slate-900">
            {isLoading ? '…' : `$ ${account?.balance.toLocaleString('es-AR')}`}
          </p>
        </div>
        <div className="flex gap-2">
          {hasPermission('payments.write') && (
            <button
              onClick={() => setShowPaymentForm((v) => !v)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
            >
              {showPaymentForm ? 'Cancelar' : 'Registrar pago'}
            </button>
          )}
          {hasPermission('settlements.write') && (
            <Link
              to={`/clientes/${id}/liquidar`}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Liquidar remitos pendientes
            </Link>
          )}
        </div>
      </div>

      {showPaymentForm && (
        <form onSubmit={handleCreatePayment} className="mb-6 grid max-w-lg grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <input name="amount" type="number" step="0.01" min="0.01" required placeholder="Importe" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select name="paymentMethodId" required className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Medio de pago…</option>
            {paymentMethods?.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input name="referenceNumber" placeholder="N° de comprobante (si aplica)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="notes" placeholder="Observaciones" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          {paymentError && <p className="col-span-2 text-sm text-red-600">{paymentError}</p>}
          <button
            type="submit"
            disabled={paymentMutation.isPending}
            className="col-span-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {paymentMutation.isPending ? 'Guardando…' : 'Guardar pago'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Debe</th>
              <th className="px-4 py-2">Haber</th>
              <th className="px-4 py-2">Saldo</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">Cargando…</td>
              </tr>
            )}
            {!isLoading && account?.movements.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">Sin movimientos todavía.</td>
              </tr>
            )}
            {account?.movements.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">{new Date(m.movementDate).toLocaleDateString('es-AR')}</td>
                <td className="px-4 py-2">{TYPE_LABEL[m.type] ?? m.type}</td>
                <td className="px-4 py-2">{Number(m.debit) > 0 ? `$ ${Number(m.debit).toLocaleString('es-AR')}` : '—'}</td>
                <td className="px-4 py-2">{Number(m.credit) > 0 ? `$ ${Number(m.credit).toLocaleString('es-AR')}` : '—'}</td>
                <td className="px-4 py-2">$ {Number(m.balanceAfter).toLocaleString('es-AR')}</td>
                <td className="px-4 py-2">
                  {m.referenceType === 'AccountSettlement' && (
                    <Link to={`/liquidaciones/${m.referenceId}`} className="text-xs text-slate-500 underline hover:text-slate-900">
                      ver detalle
                    </Link>
                  )}
                  {m.referenceType === 'Payment' && (
                    <Link to={`/pagos/${m.referenceId}`} className="text-xs text-slate-500 underline hover:text-slate-900">
                      ver detalle
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
