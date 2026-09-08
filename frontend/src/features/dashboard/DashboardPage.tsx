import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardSummary } from './api';
import { useAuth } from '../auth/AuthContext';

const QUICK_LINKS = [
  { to: '/remitos/nuevo', label: 'Nuevo remito' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/productos', label: 'Productos' },
  { to: '/importar-lista', label: 'Importar lista' },
];

function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const canSeeFinancials = hasPermission('settlements.read');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchDashboardSummary,
    enabled: canSeeFinancials,
  });

  const alertCount = data
    ? data.alerts.staleSupplierLists.length +
      (data.alerts.productsWithoutPrice > 0 ? 1 : 0) +
      (data.alerts.unmatchedSupplierReferences > 0 ? 1 : 0) +
      (data.alerts.unsignedDeliveryNotes > 0 ? 1 : 0) +
      data.alerts.highBalanceCustomers.length
    : 0;

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Hola, {user?.email}</h1>
      <p className="mb-6 text-sm text-slate-500">Roles: {user?.roles.join(', ') || '—'}</p>

      <div className="mb-6 flex flex-wrap gap-2">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100"
          >
            {link.label}
          </Link>
        ))}
      </div>

      {!canSeeFinancials && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          Los indicadores de cuenta corriente y las alertas del negocio son visibles para roles con acceso a
          liquidaciones (Administrador / Administración).
        </p>
      )}

      {canSeeFinancials && isLoading && <p className="text-sm text-slate-400">Cargando…</p>}

      {canSeeFinancials && data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Cuentas activas" value={String(data.indicators.activeAccounts)} />
            <StatTile label="Saldo total a cobrar" value={formatCompactCurrency(data.indicators.totalReceivable)} />
            <StatTile label="Remitos por liquidar" value={String(data.indicators.pendingSettlementDeliveryNotes)} />
            <StatTile label="Productos" value={String(data.indicators.productsCount)} />
            <StatTile label="Proveedores" value={String(data.indicators.suppliersCount)} />
            <StatTile label="Listas cargadas" value={String(data.indicators.priceListsCount)} />
          </div>

          {alertCount > 0 && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h2 className="mb-2 text-sm font-medium text-amber-900">Alertas ({alertCount})</h2>
              <ul className="space-y-1 text-sm text-amber-800">
                {data.alerts.staleSupplierLists.map((s) => (
                  <li key={s.supplierId}>
                    Lista desactualizada: <strong>{s.supplierName}</strong>{' '}
                    {s.lastImportedAt ? `(última importación ${new Date(s.lastImportedAt).toLocaleDateString('es-AR')})` : '(nunca importada)'}
                  </li>
                ))}
                {data.alerts.productsWithoutPrice > 0 && (
                  <li>{data.alerts.productsWithoutPrice} producto(s) vinculado(s) a un proveedor sin precio vigente</li>
                )}
                {data.alerts.unmatchedSupplierReferences > 0 && (
                  <li>
                    <Link to="/productos/matching" className="underline">
                      {data.alerts.unmatchedSupplierReferences} referencia(s) de proveedor sin vincular a un producto
                    </Link>
                  </li>
                )}
                {data.alerts.unsignedDeliveryNotes > 0 && (
                  <li>
                    <Link to="/remitos" className="underline">
                      {data.alerts.unsignedDeliveryNotes} remito(s) sin firma todavía
                    </Link>
                  </li>
                )}
                {data.alerts.highBalanceCustomers.map((c) => (
                  <li key={c.customerId}>
                    <Link to={`/clientes/${c.customerId}/cuenta`} className="underline">
                      {c.customerName}
                    </Link>{' '}
                    superó su límite de crédito (${c.balance.toLocaleString('es-AR')} de ${c.creditLimit.toLocaleString('es-AR')})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.significantPriceChanges.length > 0 && (
            <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-medium text-slate-700">Cambios de precio importantes</h2>
              <ul className="space-y-1 text-sm text-slate-600">
                {data.significantPriceChanges.map((c) => (
                  <li key={c.productId}>
                    {c.productDescription}: ${c.previousPrice.toLocaleString('es-AR')} → ${c.newPrice.toLocaleString('es-AR')}{' '}
                    <span className={c.percentChange > 0 ? 'text-red-600' : 'text-green-700'}>
                      ({c.percentChange > 0 ? '+' : ''}{(c.percentChange * 100).toFixed(0)}%)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-medium text-slate-700">Remitos recientes</h2>
              {data.recentDeliveryNotes.length === 0 && <p className="text-sm text-slate-400">Sin remitos todavía.</p>}
              <ul className="space-y-1 text-sm">
                {data.recentDeliveryNotes.map((n) => (
                  <li key={n.id}>
                    <Link to={`/remitos/${n.id}`} className="underline">
                      {n.series}-{String(n.number).padStart(8, '0')}
                    </Link>{' '}
                    — {n.customerName} <span className="text-slate-400">({n.status})</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-medium text-slate-700">Pagos recientes</h2>
              {data.recentPayments.length === 0 && <p className="text-sm text-slate-400">Sin pagos todavía.</p>}
              <ul className="space-y-1 text-sm">
                {data.recentPayments.map((p) => (
                  <li key={p.id}>
                    <Link to={`/pagos/${p.id}`} className="underline">
                      $ {p.amount.toLocaleString('es-AR')}
                    </Link>{' '}
                    — {p.customerName} <span className="text-slate-400">({new Date(p.paymentDate).toLocaleDateString('es-AR')})</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
