import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { confirmImport, fetchImportErrors, previewImport } from './api';
import { fetchSuppliers } from '../suppliers/api';
import type { ConfirmSheetInput, ImportReport, ImportRowError, PreviewResult, SheetPreview } from './types';

interface SheetConfig {
  include: boolean;
  effectiveDate: string;
  currency: 'ARS' | 'USD';
}

function defaultConfigFor(sheet: SheetPreview): SheetConfig {
  return {
    include: sheet.mapping !== null && sheet.validCount > 0,
    effectiveDate: sheet.suggestedEffectiveDate ?? new Date().toISOString().slice(0, 10),
    currency: sheet.suggestedCurrency ?? 'ARS',
  };
}

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Nuevo',
  EXISTING_PRICE_CHANGED: 'Precio modificado',
  EXISTING_PRICE_SAME: 'Sin cambios',
};

const STATUS_CLASS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  EXISTING_PRICE_CHANGED: 'bg-amber-100 text-amber-700',
  EXISTING_PRICE_SAME: 'bg-slate-100 text-slate-500',
};

export function ImportListPage() {
  const [supplierId, setSupplierId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [sheetConfigs, setSheetConfigs] = useState<Record<string, SheetConfig>>({});
  const [report, setReport] = useState<ImportReport | null>(null);
  const [errorsBySheet, setErrorsBySheet] = useState<Record<string, ImportRowError[]>>({});

  const { data: suppliers } = useQuery({ queryKey: ['suppliers', ''], queryFn: () => fetchSuppliers('') });

  const previewMutation = useMutation({
    mutationFn: () => previewImport(supplierId, file as File),
    onSuccess: (result) => {
      setPreview(result);
      setReport(null);
      setErrorsBySheet({});
      const configs: Record<string, SheetConfig> = {};
      result.sheets.forEach((sheet) => {
        configs[sheet.sheetName] = defaultConfigFor(sheet);
      });
      setSheetConfigs(configs);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error('Sin previsualización');
      const sheets: ConfirmSheetInput[] = preview.sheets
        .filter((sheet) => sheet.mapping && sheet.dataStartRow !== null && sheetConfigs[sheet.sheetName]?.include)
        .map((sheet) => ({
          sheetName: sheet.sheetName,
          include: true,
          mapping: sheet.mapping!,
          dataStartRow: sheet.dataStartRow as number,
          effectiveDate: sheetConfigs[sheet.sheetName].effectiveDate,
          currency: sheetConfigs[sheet.sheetName].currency,
        }));
      return confirmImport(supplierId, file as File, sheets);
    },
    onSuccess: setReport,
  });

  async function loadErrors(sheetName: string, priceListId: string) {
    const errors = await fetchImportErrors(priceListId);
    setErrorsBySheet((prev) => ({ ...prev, [sheetName]: errors }));
  }

  const canAnalyze = supplierId && file && !previewMutation.isPending;
  const includedCount = Object.values(sheetConfigs).filter((c) => c.include).length;

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Importar lista de precios</h1>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Proveedor</span>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Seleccionar…</option>
            {suppliers?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Archivo Excel</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </label>

        <button
          disabled={!canAnalyze}
          onClick={() => previewMutation.mutate()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {previewMutation.isPending ? 'Analizando…' : 'Analizar'}
        </button>

        {previewMutation.isError && (
          <p className="w-full text-sm text-red-600">{(previewMutation.error as Error).message}</p>
        )}
      </div>

      {preview && (
        <div className="space-y-4">
          {preview.sheets.map((sheet) => {
            const config = sheetConfigs[sheet.sheetName];
            const sheetReport = report?.sheets.find((r) => r.sheetName === sheet.sheetName);
            return (
              <div key={sheet.sheetName} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={config?.include ?? false}
                        disabled={!sheet.mapping || Boolean(report)}
                        onChange={(e) =>
                          setSheetConfigs((prev) => ({
                            ...prev,
                            [sheet.sheetName]: { ...prev[sheet.sheetName], include: e.target.checked },
                          }))
                        }
                      />
                      {sheet.sheetName}
                    </label>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {sheet.detectionMode === 'header'
                        ? 'encabezados detectados'
                        : sheet.detectionMode === 'positional'
                          ? 'modo posicional (sin encabezados)'
                          : 'sin datos reconocibles'}
                    </span>
                  </div>

                  {!report && sheet.mapping && (
                    <div className="flex items-center gap-2 text-sm">
                      <label className="flex items-center gap-1">
                        Vigencia
                        <input
                          type="date"
                          value={config?.effectiveDate ?? ''}
                          onChange={(e) =>
                            setSheetConfigs((prev) => ({
                              ...prev,
                              [sheet.sheetName]: { ...prev[sheet.sheetName], effectiveDate: e.target.value },
                            }))
                          }
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        Moneda
                        <select
                          value={config?.currency ?? 'ARS'}
                          onChange={(e) =>
                            setSheetConfigs((prev) => ({
                              ...prev,
                              [sheet.sheetName]: { ...prev[sheet.sheetName], currency: e.target.value as 'ARS' | 'USD' },
                            }))
                          }
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                        >
                          <option value="ARS">ARS</option>
                          <option value="USD">USD</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>

                {!sheet.mapping ? (
                  <p className="text-sm text-slate-500">No se pudo detectar una tabla de código/descripción/precio en esta hoja.</p>
                ) : sheetReport ? (
                  <p className="text-sm text-slate-700">
                    Importados: <strong>{sheetReport.imported}</strong> · Nuevos: <strong>{sheetReport.newReferences}</strong> ·
                    {' '}Actualizados: <strong>{sheetReport.updatedReferences}</strong> · Errores: <strong>{sheetReport.errors}</strong>
                    {sheetReport.errors > 0 && (
                      <button
                        onClick={() => loadErrors(sheet.sheetName, sheetReport.priceListId)}
                        className="ml-2 text-slate-500 underline hover:text-slate-900"
                      >
                        ver errores
                      </button>
                    )}
                  </p>
                ) : (
                  <p className="mb-3 text-sm text-slate-700">
                    Válidos: <strong>{sheet.validCount}</strong> (nuevos: {sheet.newCount}, actualizados: {sheet.updatedCount}) ·
                    {' '}Categorías: {sheet.categoryRowCount} · Errores: <strong className={sheet.errors.length > 0 ? 'text-red-600' : ''}>{sheet.errors.length}</strong> ·
                    {' '}Advertencias de precio: <strong className={sheet.warnings.length > 0 ? 'text-amber-600' : ''}>{sheet.warnings.length}</strong>
                  </p>
                )}

                {errorsBySheet[sheet.sheetName] && (
                  <div className="mb-3 max-h-40 overflow-y-auto rounded-md bg-red-50 p-2 text-xs text-red-700">
                    {errorsBySheet[sheet.sheetName].map((err, i) => (
                      <div key={i}>
                        Fila {err.rowNumber}: {err.errorMessage}
                      </div>
                    ))}
                  </div>
                )}

                {!report && sheet.sampleItems.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="py-1 pr-3">Código</th>
                          <th className="py-1 pr-3">Descripción</th>
                          <th className="py-1 pr-3">Precio</th>
                          <th className="py-1 pr-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sheet.sampleItems.map((item) => (
                          <tr key={item.code} className="border-t border-slate-100">
                            <td className="py-1 pr-3 font-mono">{item.code}</td>
                            <td className="py-1 pr-3">{item.description}</td>
                            <td className="py-1 pr-3">{item.price.toLocaleString('es-AR')}</td>
                            <td className="py-1 pr-3">
                              <span className={`rounded-full px-2 py-0.5 ${STATUS_CLASS[item.status]}`}>
                                {STATUS_LABEL[item.status]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {sheet.validCount > sheet.sampleItems.length && (
                      <p className="mt-1 text-xs text-slate-400">
                        …y {sheet.validCount - sheet.sampleItems.length} ítems más.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {!report && (
            <button
              disabled={includedCount === 0 || confirmMutation.isPending}
              onClick={() => confirmMutation.mutate()}
              className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {confirmMutation.isPending ? 'Importando…' : `Confirmar importación (${includedCount} hoja${includedCount === 1 ? '' : 's'})`}
            </button>
          )}
          {confirmMutation.isError && (
            <p className="text-sm text-red-600">{(confirmMutation.error as Error).message}</p>
          )}
        </div>
      )}
    </div>
  );
}
