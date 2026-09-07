import { useQuery } from '@tanstack/react-query';
import { fetchPriceComparison } from './api';

export function PriceComparisonPanel({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['product-prices', productId],
    queryFn: () => fetchPriceComparison(productId),
  });

  if (isLoading) return <p className="p-3 text-sm text-slate-400">Cargando precios…</p>;

  if (!data || data.comparisons.length === 0) {
    return (
      <p className="p-3 text-sm text-slate-400">
        Sin referencias de proveedor vinculadas a este producto, o sin precios importados todavía.
      </p>
    );
  }

  return (
    <div className="p-3">
      <table className="w-full text-left text-xs">
        <thead className="text-slate-500">
          <tr>
            <th className="py-1 pr-3">Proveedor</th>
            <th className="py-1 pr-3">Código del proveedor</th>
            <th className="py-1 pr-3">Precio</th>
            <th className="py-1 pr-3">Vigencia</th>
            <th className="py-1 pr-3">Variación</th>
          </tr>
        </thead>
        <tbody>
          {data.comparisons.map((entry) => (
            <tr key={entry.supplierId} className="border-t border-slate-100">
              <td className="py-1 pr-3">
                {entry.supplierName}
                {entry.supplierId === data.bestSupplierId && (
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-green-700">mejor costo</span>
                )}
              </td>
              <td className="py-1 pr-3 font-mono">{entry.supplierCode}</td>
              <td className="py-1 pr-3">
                {entry.currency} {entry.price.toLocaleString('es-AR')}
              </td>
              <td className="py-1 pr-3">{new Date(entry.effectiveDate).toLocaleDateString('es-AR')}</td>
              <td className="py-1 pr-3">
                {entry.percentChange === null ? (
                  '—'
                ) : (
                  <span className={entry.percentChange > 0 ? 'text-red-600' : entry.percentChange < 0 ? 'text-green-700' : ''}>
                    {(entry.percentChange * 100).toFixed(1)}%
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
