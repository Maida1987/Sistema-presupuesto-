import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPricingRule, fetchPricingRules } from './api';

export function PricingRulesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [scope, setScope] = useState<'GLOBAL' | 'CATEGORY' | 'SUPPLIER' | 'PRODUCT'>('GLOBAL');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: rules, isLoading } = useQuery({ queryKey: ['pricing-rules'], queryFn: fetchPricingRules });

  const createMutation = useMutation({
    mutationFn: createPricingRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-rules'] });
      setShowForm(false);
    },
    onError: () => setFormError('No se pudo guardar la regla. Revisá los valores ingresados.'),
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    createMutation.mutate({
      scope,
      scopeRefId: scope === 'GLOBAL' ? undefined : String(form.get('scopeRefId') ?? '') || undefined,
      marginPct: Number(form.get('marginPct')) / 100,
      marginBase: form.get('marginBase') as 'COST' | 'SALE_PRICE',
      expensesPct: Number(form.get('expensesPct') ?? 0) / 100,
      expensesFixed: Number(form.get('expensesFixed') ?? 0),
      ivaPct: Number(form.get('ivaPct')) / 100,
      roundingRule: String(form.get('roundingRule')),
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Reglas de precios</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? 'Cancelar' : 'Nueva regla'}
        </button>
      </div>
      <p className="mb-4 max-w-2xl text-sm text-amber-700">
        ⚠️ La fórmula (margen → gastos → IVA, en ese orden) es la propuesta documentada en
        docs/04-importacion-y-precios.md §6.2, pendiente de confirmación final con el negocio.
        Una regla nueva nunca modifica las anteriores: cierra la vigente y crea una versión
        nueva, para poder reconstruir con qué regla se liquidó una cuenta en el pasado.
      </p>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 grid max-w-2xl grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Alcance</span>
            <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="GLOBAL">Global</option>
              <option value="CATEGORY">Por categoría</option>
              <option value="SUPPLIER">Por proveedor</option>
              <option value="PRODUCT">Por producto</option>
            </select>
          </label>
          {scope !== 'GLOBAL' && (
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">ID de {scope === 'CATEGORY' ? 'categoría' : scope === 'SUPPLIER' ? 'proveedor' : 'producto'}</span>
              <input name="scopeRefId" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
          )}

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Margen (%)</span>
            <input name="marginPct" type="number" step="0.01" required defaultValue={30} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Margen calculado sobre</span>
            <select name="marginBase" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="COST">Costo</option>
              <option value="SALE_PRICE">Precio de venta</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Gastos (%)</span>
            <input name="expensesPct" type="number" step="0.01" defaultValue={10} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Gastos fijos ($)</span>
            <input name="expensesFixed" type="number" step="0.01" defaultValue={0} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">IVA (%)</span>
            <input name="ivaPct" type="number" step="0.01" required defaultValue={21} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Redondeo</span>
            <select name="roundingRule" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="NONE">Sin redondeo</option>
              <option value="NEAREST_1">Al entero más cercano</option>
              <option value="NEAREST_10">A la decena más cercana</option>
              <option value="NEAREST_100">A la centena más cercana</option>
              <option value="CEIL_10">Hacia arriba, a la decena</option>
              <option value="CEIL_100">Hacia arriba, a la centena</option>
            </select>
          </label>

          {formError && <p className="col-span-2 text-sm text-red-600">{formError}</p>}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="col-span-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Guardando…' : 'Guardar regla'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2">Alcance</th>
              <th className="px-4 py-2">Margen</th>
              <th className="px-4 py-2">Gastos</th>
              <th className="px-4 py-2">IVA</th>
              <th className="px-4 py-2">Redondeo</th>
              <th className="px-4 py-2">Vigencia</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">Cargando…</td>
              </tr>
            )}
            {!isLoading && rules?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">Sin reglas configuradas.</td>
              </tr>
            )}
            {rules?.map((rule) => (
              <tr key={rule.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">{rule.scope}{rule.scopeRefId ? ` (${rule.scopeRefId.slice(0, 8)}…)` : ''}</td>
                <td className="px-4 py-2">{(Number(rule.marginPct) * 100).toFixed(1)}% sobre {rule.marginBase === 'COST' ? 'costo' : 'precio de venta'}</td>
                <td className="px-4 py-2">{(Number(rule.expensesPct) * 100).toFixed(1)}% + ${Number(rule.expensesFixed).toLocaleString('es-AR')}</td>
                <td className="px-4 py-2">{(Number(rule.ivaPct) * 100).toFixed(1)}%</td>
                <td className="px-4 py-2">{rule.roundingRule}</td>
                <td className="px-4 py-2">
                  {rule.effectiveTo === null ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Vigente</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      Hasta {new Date(rule.effectiveTo).toLocaleDateString('es-AR')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
