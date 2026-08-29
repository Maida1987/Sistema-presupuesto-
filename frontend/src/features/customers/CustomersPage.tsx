import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCustomer, fetchCustomers } from './api';
import { useAuth } from '../auth/AuthContext';

export function CustomersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => fetchCustomers(search),
  });

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
    },
    onError: () => setFormError('No se pudo crear el cliente. Verificá que el código no esté repetido.'),
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    createMutation.mutate({
      internalCode: String(form.get('internalCode') ?? ''),
      businessName: String(form.get('businessName') ?? ''),
      cuit: String(form.get('cuit') ?? '') || undefined,
      phone: String(form.get('phone') ?? '') || undefined,
      email: String(form.get('email') ?? '') || undefined,
      city: String(form.get('city') ?? '') || undefined,
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Clientes</h1>
        {hasPermission('customers.write') && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {showForm ? 'Cancelar' : 'Nuevo cliente'}
          </button>
        )}
      </div>

      <input
        type="search"
        placeholder="Buscar por nombre, código o CUIT…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 grid max-w-2xl grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <input name="internalCode" required placeholder="Código interno" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="businessName" required placeholder="Razón social" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="cuit" placeholder="CUIT" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="phone" placeholder="Teléfono" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="email" placeholder="Email" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="city" placeholder="Localidad" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          {formError && <p className="col-span-2 text-sm text-red-600">{formError}</p>}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="col-span-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Guardando…' : 'Guardar cliente'}
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
              <th className="px-4 py-2">Localidad</th>
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
            {!isLoading && customers?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Sin clientes para mostrar.
                </td>
              </tr>
            )}
            {customers?.map((customer) => (
              <tr key={customer.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{customer.internalCode}</td>
                <td className="px-4 py-2">{customer.businessName}</td>
                <td className="px-4 py-2">{customer.cuit ?? '—'}</td>
                <td className="px-4 py-2">{customer.city ?? '—'}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      customer.status === 'ACTIVE'
                        ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700'
                        : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500'
                    }
                  >
                    {customer.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
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
