import { useAuth } from '../auth/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Hola, {user?.email}</h1>
      <p className="mb-6 text-sm text-slate-500">
        Roles: {user?.roles.join(', ') || '—'}
      </p>
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Los indicadores y alertas del dashboard (saldo a cobrar, remitos
        pendientes de liquidación, listas desactualizadas, etc.) se agregan
        en la Fase 6 del plan, cuando existan remitos y cuentas corrientes
        con datos reales para mostrar (ver docs/05-ux-api-testing-plan.md).
      </div>
    </div>
  );
}
