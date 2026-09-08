import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { GlobalSearch } from '../features/search/GlobalSearch';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/proveedores', label: 'Proveedores' },
  { to: '/productos', label: 'Productos' },
  { to: '/remitos', label: 'Remitos' },
  { to: '/importar-lista', label: 'Importar lista' },
  { to: '/reglas-de-precios', label: 'Reglas de precios' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();

  const navItems = hasPermission('audit.read') ? [...NAV_ITEMS, { to: '/auditoria', label: 'Auditoría' }] : NAV_ITEMS;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-6">
            <span className="font-semibold text-slate-900">Sistema de Repuestos</span>
            <nav className="flex flex-wrap gap-4 text-sm">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    location.pathname === item.to
                      ? 'font-medium text-slate-900'
                      : 'text-slate-500 hover:text-slate-900'
                  }
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex flex-shrink-0 items-center gap-3 text-sm text-slate-500">
            <GlobalSearch />
            <span>{user?.email}</span>
            <button onClick={logout} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100">
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
