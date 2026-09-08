import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSuppliers } from '../suppliers/api';
import {
  bulkIgnoreReferences,
  bulkMatchReferences,
  createProductAndMatch,
  fetchBulkSuggestions,
  fetchSupplierReferences,
  searchProducts,
} from './api';
import type { MatchStatus, MatchSuggestion, Product } from './types';

const PAGE_SIZE = 50;
const AUTO_SELECT_THRESHOLD = 0.5;

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-slate-400">Sin sugerencia</span>;
  const pct = Math.round(score * 100);
  const cls =
    score >= AUTO_SELECT_THRESHOLD
      ? 'bg-green-50 text-green-700 border-green-200'
      : 'bg-amber-50 text-amber-700 border-amber-200';
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{pct}% similar</span>;
}

function OverridePicker({ onChoose, onCancel }: { onChoose: (product: Product) => void; onCancel: () => void }) {
  const [term, setTerm] = useState('');
  const { data: results, isFetching } = useQuery({
    queryKey: ['products-search-inline', term],
    queryFn: () => searchProducts(term),
    enabled: term.trim().length > 0,
  });

  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar producto del catálogo…"
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
        <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-800">
          Cancelar
        </button>
      </div>
      {isFetching && <p className="mt-1 text-xs text-slate-400">Buscando…</p>}
      {results && results.length > 0 && (
        <ul className="mt-1 max-h-40 overflow-y-auto">
          {results.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => onChoose(p)}
                className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-200"
              >
                <span className="font-mono text-xs text-slate-400">{p.internalCode}</span> {p.description}
              </button>
            </li>
          ))}
        </ul>
      )}
      {results && results.length === 0 && term.trim().length > 0 && !isFetching && (
        <p className="mt-1 text-xs text-slate-400">Sin resultados.</p>
      )}
    </div>
  );
}

function CreateProductForm({
  initialCode,
  initialDescription,
  onCreate,
  onCancel,
  isPending,
}: {
  initialCode: string;
  initialDescription: string;
  onCreate: (input: { internalCode: string; description: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [internalCode, setInternalCode] = useState(initialCode);
  const [description, setDescription] = useState(initialDescription);

  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={internalCode}
          onChange={(e) => setInternalCode(e.target.value)}
          placeholder="Código interno"
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción"
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          disabled={isPending || !internalCode.trim() || !description.trim()}
          onClick={() => onCreate({ internalCode: internalCode.trim(), description: description.trim() })}
          className="rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending ? 'Creando…' : 'Crear y vincular'}
        </button>
        <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-800">
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function MatchingPage() {
  const queryClient = useQueryClient();
  const [supplierId, setSupplierId] = useState('');
  const [matchStatus, setMatchStatus] = useState<MatchStatus>('UNMATCHED');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [chosenProduct, setChosenProduct] = useState<Map<string, Product>>(new Map());
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedMode, setExpandedMode] = useState<'override' | 'create' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: suppliers } = useQuery({ queryKey: ['suppliers', ''], queryFn: () => fetchSuppliers('') });

  const { data: page, isLoading } = useQuery({
    queryKey: ['supplier-references', supplierId, matchStatus, offset],
    queryFn: () => fetchSupplierReferences({ supplierId: supplierId || undefined, matchStatus, limit: PAGE_SIZE, offset }),
  });

  const referenceIds = useMemo(() => page?.items.map((i) => i.id) ?? [], [page]);

  const { data: suggestions } = useQuery({
    queryKey: ['supplier-references-suggestions', referenceIds],
    queryFn: () => fetchBulkSuggestions(referenceIds),
    enabled: referenceIds.length > 0 && matchStatus === 'UNMATCHED',
  });

  const suggestionByRef = useMemo(() => {
    const map = new Map<string, MatchSuggestion>();
    for (const s of suggestions ?? []) map.set(s.referenceId, s);
    return map;
  }, [suggestions]);

  // Al llegar nuevas sugerencias, pre-selecciona (checkbox tildado) solo las
  // de alta confianza — nunca aplica nada solo; el usuario confirma con el
  // botón. Ver docs/04 §5: "nunca automática y silenciosa cuando hay
  // ambigüedad".
  useEffect(() => {
    if (!suggestions) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of suggestions) {
        if (s.candidate && s.score !== null && s.score >= AUTO_SELECT_THRESHOLD) {
          next.add(s.referenceId);
        }
      }
      return next;
    });
  }, [suggestions]);

  function resetSelectionState() {
    setSelected(new Set());
    setChosenProduct(new Map());
    setExpandedRow(null);
    setExpandedMode(null);
  }

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['supplier-references'] });
    resetSelectionState();
  }

  const bulkMatchMutation = useMutation({
    mutationFn: bulkMatchReferences,
    onSuccess: (result) => {
      setFeedback(`Se confirmaron ${result.matched} vínculo(s).`);
      invalidateAll();
    },
    onError: () => setFeedback('No se pudo confirmar el lote. Puede que algún producto o referencia ya no exista.'),
  });

  const bulkIgnoreMutation = useMutation({
    mutationFn: bulkIgnoreReferences,
    onSuccess: (result) => {
      setFeedback(`Se ignoraron ${result.ignored} referencia(s).`);
      invalidateAll();
    },
    onError: () => setFeedback('No se pudo ignorar el lote.'),
  });

  const createAndMatchMutation = useMutation({
    mutationFn: ({ referenceId, input }: { referenceId: string; input: { internalCode: string; description: string } }) =>
      createProductAndMatch(referenceId, input),
    onSuccess: () => {
      setFeedback('Producto creado y vinculado.');
      invalidateAll();
    },
    onError: () => setFeedback('No se pudo crear el producto (¿el código interno ya existe?).'),
  });

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function candidateFor(referenceId: string): Product | null {
    return chosenProduct.get(referenceId) ?? suggestionByRef.get(referenceId)?.candidate ?? null;
  }

  function handleConfirmSelected() {
    const items = [...selected]
      .map((referenceId) => ({ referenceId, productId: candidateFor(referenceId)?.id }))
      .filter((item): item is { referenceId: string; productId: string } => Boolean(item.productId));
    if (items.length === 0) {
      setFeedback('Ninguna de las referencias seleccionadas tiene un producto elegido todavía.');
      return;
    }
    bulkMatchMutation.mutate(items);
  }

  function handleIgnoreSelected() {
    if (selected.size === 0) return;
    bulkIgnoreMutation.mutate([...selected]);
  }

  const total = page?.total ?? 0;
  const hasNext = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Matching de referencias de proveedor</h1>
        <span className="text-sm text-slate-500">{total.toLocaleString('es-AR')} referencia(s)</span>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Proveedor</span>
          <select
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              setOffset(0);
              resetSelectionState();
            }}
            className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {suppliers?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Estado</span>
          <select
            value={matchStatus}
            onChange={(e) => {
              setMatchStatus(e.target.value as MatchStatus);
              setOffset(0);
              resetSelectionState();
            }}
            className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="UNMATCHED">Sin vincular</option>
            <option value="MATCHED">Vinculadas</option>
            <option value="IGNORED">Ignoradas</option>
          </select>
        </label>

        {matchStatus === 'UNMATCHED' && (
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleIgnoreSelected}
              disabled={selected.size === 0 || bulkIgnoreMutation.isPending}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Ignorar seleccionadas ({selected.size})
            </button>
            <button
              onClick={handleConfirmSelected}
              disabled={selected.size === 0 || bulkMatchMutation.isPending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {bulkMatchMutation.isPending ? 'Confirmando…' : `Confirmar seleccionadas (${selected.size})`}
            </button>
          </div>
        )}
      </div>

      {feedback && (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {feedback}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              {matchStatus === 'UNMATCHED' && <th className="px-3 py-2"></th>}
              <th className="px-4 py-2">Código proveedor</th>
              <th className="px-4 py-2">Descripción (original del proveedor)</th>
              <th className="px-4 py-2">Producto vinculado / sugerido</th>
              <th className="px-4 py-2">Acciones</th>
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
            {!isLoading && page?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Sin referencias para este filtro.
                </td>
              </tr>
            )}
            {page?.items.map((ref) => {
              const suggestion = suggestionByRef.get(ref.id);
              const chosen = chosenProduct.get(ref.id);
              const effectiveCandidate = matchStatus === 'UNMATCHED' ? candidateFor(ref.id) : ref.product;
              const isExpanded = expandedRow === ref.id;

              return (
                <tr key={ref.id} className="border-b border-slate-100 align-top last:border-0">
                  {matchStatus === 'UNMATCHED' && (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(ref.id)}
                        onChange={() => toggleSelected(ref.id)}
                        className="h-4 w-4"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono text-xs">{ref.supplierCode}</td>
                  <td className="px-4 py-3">
                    {ref.supplierDescription}
                    <div className="text-xs text-slate-400">{ref.supplier.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    {effectiveCandidate ? (
                      <div>
                        <span className="font-mono text-xs text-slate-400">{effectiveCandidate.internalCode}</span>{' '}
                        {effectiveCandidate.description}
                        {chosen ? (
                          <div className="mt-1 text-xs text-slate-400">Elegido manualmente</div>
                        ) : (
                          matchStatus === 'UNMATCHED' && (
                            <div className="mt-1">
                              <ScoreBadge score={suggestion?.score ?? null} />
                            </div>
                          )
                        )}
                      </div>
                    ) : matchStatus === 'UNMATCHED' ? (
                      <ScoreBadge score={suggestion?.score ?? null} />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {matchStatus === 'UNMATCHED' && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            setExpandedRow(isExpanded && expandedMode === 'override' ? null : ref.id);
                            setExpandedMode('override');
                          }}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900"
                        >
                          Elegir otro
                        </button>
                        <button
                          onClick={() => {
                            setExpandedRow(isExpanded && expandedMode === 'create' ? null : ref.id);
                            setExpandedMode('create');
                          }}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900"
                        >
                          Crear producto nuevo
                        </button>
                      </div>
                    )}
                    {isExpanded && expandedMode === 'override' && (
                      <OverridePicker
                        onChoose={(product) => {
                          setChosenProduct((prev) => new Map(prev).set(ref.id, product));
                          setSelected((prev) => new Set(prev).add(ref.id));
                          setExpandedRow(null);
                        }}
                        onCancel={() => setExpandedRow(null)}
                      />
                    )}
                    {isExpanded && expandedMode === 'create' && (
                      <CreateProductForm
                        initialCode={ref.supplierCode}
                        initialDescription={ref.supplierDescription}
                        isPending={createAndMatchMutation.isPending}
                        onCreate={(input) => createAndMatchMutation.mutate({ referenceId: ref.id, input })}
                        onCancel={() => setExpandedRow(null)}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>
          Mostrando {page ? Math.min(offset + 1, total) : 0}–{page ? Math.min(offset + PAGE_SIZE, total) : 0} de{' '}
          {total.toLocaleString('es-AR')}
        </span>
        <div className="flex gap-2">
          <button
            disabled={!hasPrev}
            onClick={() => {
              setOffset((o) => Math.max(0, o - PAGE_SIZE));
              resetSelectionState();
            }}
            className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            disabled={!hasNext}
            onClick={() => {
              setOffset((o) => o + PAGE_SIZE);
              resetSelectionState();
            }}
            className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
