import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSupplier, fetchSuppliers } from './api';
import { useAuth } from '../auth/AuthContext';

export function SuppliersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers', search],
    queryFn: () => fetchSuppliers(search),
  });

  const createMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setShowForm(false);
    },
    onError: () => setFormError('No se pudo crear el proveedor. Verificá que el código no esté repetido.'),
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    createMutation.mutate({
      code: String(form.get('code') ?? ''),
      name: String(form.get('name') ?? ''),
      cuit: String(form.get('cuit') ?? '') || undefined,
      contactInfo: String(form.get('contactInfo') ?? '') || undefined,
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Proveedores</h1>
        {hasPermission('suppliers.write') && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {showForm ? 'Cancelar' : 'Nuevo proveedor'}
          </button>
        )}
      </div>

      <input
        type="search"
        placeholder="Buscar por nombre o código…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 grid max-w-2xl grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <input name="code" required placeholder="Código" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="name" required placeholder="Razón social" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="cuit" placeholder="CUIT" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="contactInfo" placeholder="Contacto (tel/email)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          {formError && <p className="col-span-2 text-sm text-red-600">{formError}</p>}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="col-span-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Guardando…' : 'Guardar proveedor'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Razón social</th>
              <th className="px-4 py-2">CUIT</th>
              <th className="px-4 py-2">Contacto</th>
              <th className="px-4 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Cargando…
                </td>
              </tr>
            )}
            {!isLoading && suppliers?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Sin proveedores para mostrar.
                </td>
              </tr>
            )}
            {suppliers?.map((supplier) => (
              <tr key={supplier.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{supplier.code}</td>
                <td className="px-4 py-2">{supplier.name}</td>
                <td className="px-4 py-2">{supplier.cuit ?? '—'}</td>
                <td className="px-4 py-2">{supplier.contactInfo ?? '—'}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      supplier.status === 'ACTIVE'
                        ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700'
                        : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500'
                    }
                  >
                    {supplier.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
