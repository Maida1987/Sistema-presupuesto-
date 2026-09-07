import { Fragment, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createProduct, searchProducts } from './api';
import { PriceComparisonPanel } from './PriceComparisonPanel';
import { useAuth } from '../auth/AuthContext';

export function ProductsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: () => searchProducts(search),
  });

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowForm(false);
    },
    onError: () => setFormError('No se pudo crear el producto. Verificá que el código no esté repetido.'),
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    createMutation.mutate({
      internalCode: String(form.get('internalCode') ?? ''),
      description: String(form.get('description') ?? ''),
      brand: String(form.get('brand') ?? '') || undefined,
      unit: String(form.get('unit') ?? '') || undefined,
      truckApplication: String(form.get('truckApplication') ?? '') || undefined,
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Productos</h1>
        {hasPermission('products.write') && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {showForm ? 'Cancelar' : 'Nuevo producto'}
          </button>
        )}
      </div>

      <input
        type="search"
        placeholder="Buscar por código o descripción (tolera variaciones de escritura)…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full max-w-lg rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 grid max-w-2xl grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <input name="internalCode" required placeholder="Código interno" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="description" required placeholder="Descripción" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="brand" placeholder="Marca" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="unit" placeholder="Unidad" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="truckApplication" placeholder="Aplicación / modelo de camión" className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" />
          {formError && <p className="col-span-2 text-sm text-red-600">{formError}</p>}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="col-span-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Guardando…' : 'Guardar producto'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Descripción</th>
              <th className="px-4 py-2">Marca</th>
              <th className="px-4 py-2">Aplicación</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Cargando…
                </td>
              </tr>
            )}
            {!isLoading && products?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Sin productos para mostrar.
                </td>
              </tr>
            )}
            {products?.map((product) => (
              <Fragment key={product.id}>
                <tr className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{product.internalCode}</td>
                  <td className="px-4 py-2">{product.description}</td>
                  <td className="px-4 py-2">{product.brand ?? '—'}</td>
                  <td className="px-4 py-2">{product.truckApplication ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        product.status === 'ACTIVE'
                          ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700'
                          : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500'
                      }
                    >
                      {product.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => setExpandedProductId((current) => (current === product.id ? null : product.id))}
                      className="text-xs text-slate-500 underline hover:text-slate-900"
                    >
                      {expandedProductId === product.id ? 'Ocultar precios' : 'Ver precios'}
                    </button>
                  </td>
                </tr>
                {expandedProductId === product.id && (
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <td colSpan={6}>
                      <PriceComparisonPanel productId={product.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
