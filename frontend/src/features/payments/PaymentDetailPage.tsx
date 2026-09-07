import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPayment, voidPayment } from './api';
import { useAuth } from '../auth/AuthContext';

const STATUS_CLASS: Record<string, string> = {
  REGISTRADO: 'bg-green-100 text-green-700',
  ANULADO: 'bg-red-100 text-red-700',
};

export function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showVoidForm, setShowVoidForm] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: payment, isLoading } = useQuery({
    queryKey: ['payment', id],
    queryFn: () => fetchPayment(id as string),
    enabled: Boolean(id),
  });

  const voidMutation = useMutation({
    mutationFn: () => voidPayment(id as string, voidReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      setShowVoidForm(false);
    },
    onError: () => setError('No se pudo anular el pago.'),
  });

  if (isLoading || !payment) {
    return <p className="text-sm text-slate-400">Cargando…</p>;
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Pago</h1>
      <p className="mb-4 text-sm text-slate-500">
        <Link to={`/clientes/${payment.customerId}/cuenta`} className="underline">
          {payment.customer.businessName} ({payment.customer.internalCode})
        </Link>{' '}
        · {new Date(payment.paymentDate).toLocaleDateString('es-AR')} ·{' '}
        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[payment.status]}`}>{payment.status}</span>
        {payment.voidReason && <> — motivo: {payment.voidReason}</>}
      </p>

      <div className="mb-6 max-w-md rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <dl className="space-y-2">
          <div className="flex justify-between"><dt className="text-slate-400">Importe</dt><dd className="font-semibold">$ {Number(payment.amount).toLocaleString('es-AR')}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-400">Medio de pago</dt><dd>{payment.paymentMethod.name}</dd></div>
          {payment.referenceNumber && <div className="flex justify-between"><dt className="text-slate-400">Comprobante</dt><dd>{payment.referenceNumber}</dd></div>}
          {payment.notes && <div className="flex justify-between"><dt className="text-slate-400">Observaciones</dt><dd>{payment.notes}</dd></div>}
        </dl>
      </div>

      {hasPermission('payments.write') && payment.status === 'REGISTRADO' && !showVoidForm && (
        <button onClick={() => setShowVoidForm(true)} className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
          Anular pago
        </button>
      )}

      {showVoidForm && (
        <div className="mt-4 max-w-md rounded-lg border border-red-200 bg-red-50 p-4">
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

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
