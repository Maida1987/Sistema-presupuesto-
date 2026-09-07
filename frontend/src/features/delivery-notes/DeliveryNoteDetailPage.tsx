import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attachSignedDocument, fetchDeliveryNote, markDelivered, openDeliveryNotePdf, voidDeliveryNote } from './api';
import { useAuth } from '../auth/AuthContext';

export function DeliveryNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [voidReason, setVoidReason] = useState('');
  const [showVoidForm, setShowVoidForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: deliveryNote, isLoading } = useQuery({
    queryKey: ['delivery-note', id],
    queryFn: () => fetchDeliveryNote(id as string),
    enabled: Boolean(id),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['delivery-note', id] });
    queryClient.invalidateQueries({ queryKey: ['delivery-notes'] });
  }

  const deliverMutation = useMutation({
    mutationFn: () => markDelivered(id as string),
    onSuccess: invalidate,
    onError: () => setActionError('No se pudo marcar como entregado.'),
  });

  const attachMutation = useMutation({
    mutationFn: (file: File) => attachSignedDocument(id as string, file),
    onSuccess: invalidate,
    onError: () => setActionError('No se pudo adjuntar el remito firmado.'),
  });

  const voidMutation = useMutation({
    mutationFn: () => voidDeliveryNote(id as string, voidReason),
    onSuccess: () => {
      invalidate();
      setShowVoidForm(false);
      setVoidReason('');
    },
    onError: () => setActionError('No se pudo anular el remito.'),
  });

  if (isLoading || !deliveryNote) {
    return <p className="text-sm text-slate-400">Cargando…</p>;
  }

  const canWrite = hasPermission('delivery-notes.write');
  const canAttach = canWrite && ['EMITIDO', 'ENTREGADO'].includes(deliveryNote.status);
  const canDeliver = canWrite && deliveryNote.status === 'EMITIDO';
  const canVoid = canWrite && !['ANULADO', 'LIQUIDADO'].includes(deliveryNote.status);

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">
        Remito {deliveryNote.series}-{String(deliveryNote.number).padStart(8, '0')}
      </h1>
      <p className="mb-4 text-sm text-slate-500">
        {deliveryNote.customer.businessName} ({deliveryNote.customer.internalCode}) ·{' '}
        {new Date(deliveryNote.issuedAt).toLocaleDateString('es-AR')} · <strong>{deliveryNote.status}</strong>
        {deliveryNote.voidReason && <> — motivo de anulación: {deliveryNote.voidReason}</>}
      </p>

      <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Descripción</th>
              <th className="px-4 py-2">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {deliveryNote.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{item.codeSnapshot}</td>
                <td className="px-4 py-2">{item.descriptionSnapshot}</td>
                <td className="px-4 py-2">
                  {item.quantity} {item.unit ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button onClick={() => openDeliveryNotePdf(deliveryNote.id, 'original')} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
          Ver PDF original
        </button>
        <button onClick={() => openDeliveryNotePdf(deliveryNote.id, 'duplicado')} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
          Ver PDF duplicado
        </button>

        {canDeliver && (
          <button
            onClick={() => deliverMutation.mutate()}
            disabled={deliverMutation.isPending}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50"
          >
            Marcar entregado
          </button>
        )}

        {canAttach && (
          <label className="cursor-pointer rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
            {attachMutation.isPending ? 'Subiendo…' : 'Adjuntar remito firmado'}
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) attachMutation.mutate(file);
              }}
            />
          </label>
        )}

        {canVoid && !showVoidForm && (
          <button onClick={() => setShowVoidForm(true)} className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
            Anular remito
          </button>
        )}
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

      {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}

      {deliveryNote.documents.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-slate-700">Documentos adjuntos</h2>
          <ul className="text-sm text-slate-600">
            {deliveryNote.documents.map((doc) => (
              <li key={doc.id}>
                {doc.type} — {new Date(doc.uploadedAt).toLocaleString('es-AR')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-slate-700">Historial de estados</h2>
        <ul className="text-sm text-slate-500">
          {deliveryNote.statusLog.map((entry) => (
            <li key={entry.id}>
              {new Date(entry.changedAt).toLocaleString('es-AR')} — {entry.fromStatus ?? '—'} → {entry.toStatus}
              {entry.reason && <> ({entry.reason})</>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
