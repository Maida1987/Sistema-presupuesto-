import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCustomers } from '../customers/api';
import {
  downloadAccountStatement,
  downloadCustomersReport,
  downloadDeliveryNotesReport,
  downloadProductsReport,
  type ExportFormat,
} from './api';
import type { DeliveryNoteStatus } from '../delivery-notes/types';

const STATUS_OPTIONS: DeliveryNoteStatus[] = ['BORRADOR', 'EMITIDO', 'ENTREGADO', 'FIRMADO', 'LIQUIDADO', 'ANULADO'];

function ReportCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-medium text-slate-900">{title}</h2>
      <p className="mb-3 mt-1 text-sm text-slate-500">{description}</p>
      {children}
    </div>
  );
}

function FormatButtons({
  onDownload,
  formats = ['xlsx', 'csv'],
  isPending,
}: {
  onDownload: (format: ExportFormat) => void;
  formats?: ExportFormat[];
  isPending: boolean;
}) {
  return (
    <div className="flex gap-2">
      {formats.map((format) => (
        <button
          key={format}
          disabled={isPending}
          onClick={() => onDownload(format)}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          Descargar .{format}
        </button>
      ))}
    </div>
  );
}

export function ReportsPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const { data: customers } = useQuery({ queryKey: ['customers', ''], queryFn: () => fetchCustomers('') });

  const [dnCustomerId, setDnCustomerId] = useState('');
  const [dnStatus, setDnStatus] = useState('');
  const [dnFrom, setDnFrom] = useState('');
  const [dnTo, setDnTo] = useState('');

  const [stCustomerId, setStCustomerId] = useState('');
  const [stFrom, setStFrom] = useState('');
  const [stTo, setStTo] = useState('');

  async function run(key: string, fn: () => Promise<void>) {
    setError(null);
    setPending(key);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el reporte');
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Reportes y exportaciones</h1>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReportCard title="Clientes" description="Listado completo del catálogo de clientes.">
          <FormatButtons isPending={pending === 'customers'} onDownload={(f) => run('customers', () => downloadCustomersReport(f))} />
        </ReportCard>

        <ReportCard title="Productos" description="Catálogo maestro con el mejor precio vigente por producto (entre proveedores matcheados).">
          <FormatButtons isPending={pending === 'products'} onDownload={(f) => run('products', () => downloadProductsReport(f))} />
        </ReportCard>

        <ReportCard
          title="Remitos"
          description="Listado de remitos por período/cliente/estado. Nunca incluye precios (el remito no fija el precio)."
        >
          <div className="mb-3 grid grid-cols-2 gap-2">
            <select value={dnCustomerId} onChange={(e) => setDnCustomerId(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">Todos los clientes</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName}
                </option>
              ))}
            </select>
            <select value={dnStatus} onChange={(e) => setDnStatus(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">Todos los estados</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input type="date" value={dnFrom} onChange={(e) => setDnFrom(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            <input type="date" value={dnTo} onChange={(e) => setDnTo(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <FormatButtons
            isPending={pending === 'delivery-notes'}
            onDownload={(f) =>
              run('delivery-notes', () =>
                downloadDeliveryNotesReport(f, { customerId: dnCustomerId || undefined, status: dnStatus || undefined, from: dnFrom || undefined, to: dnTo || undefined }),
              )
            }
          />
        </ReportCard>

        <ReportCard title="Extracto de cuenta corriente" description="Movimientos y saldo de un cliente en un período, con opción a PDF para entregar.">
          <div className="mb-3 grid grid-cols-3 gap-2">
            <select value={stCustomerId} onChange={(e) => setStCustomerId(e.target.value)} className="col-span-3 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">Elegir cliente…</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName}
                </option>
              ))}
            </select>
            <input type="date" value={stFrom} onChange={(e) => setStFrom(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            <input type="date" value={stTo} onChange={(e) => setStTo(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          {!stCustomerId ? (
            <p className="text-xs text-slate-400">Elegí un cliente para habilitar la descarga.</p>
          ) : (
            <div className="flex gap-2">
              <button
                disabled={pending === 'statement-pdf'}
                onClick={() => run('statement-pdf', () => downloadAccountStatement(stCustomerId, 'pdf', { from: stFrom || undefined, to: stTo || undefined }))}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Descargar .pdf
              </button>
              <FormatButtons
                isPending={pending === 'statement'}
                onDownload={(f) => run('statement', () => downloadAccountStatement(stCustomerId, f, { from: stFrom || undefined, to: stTo || undefined }))}
              />
            </div>
          )}
        </ReportCard>
      </div>
    </div>
  );
}
