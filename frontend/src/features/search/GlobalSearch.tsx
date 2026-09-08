import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { globalSearch } from './api';

const MIN_LENGTH = 2;
const DEBOUNCE_MS = 250;

export function GlobalSearch() {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(term), DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [term]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ['global-search', debounced],
    queryFn: () => globalSearch(debounced),
    enabled: debounced.trim().length >= MIN_LENGTH,
  });

  function go(path: string) {
    setOpen(false);
    setTerm('');
    navigate(path);
  }

  const hasResults =
    data && (data.customers.length > 0 || data.suppliers.length > 0 || data.products.length > 0 || data.deliveryNotes.length > 0);

  return (
    <div ref={containerRef} className="relative w-64">
      <input
        type="search"
        placeholder="Buscar cliente, remito, producto…"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
      />

      {open && debounced.trim().length >= MIN_LENGTH && (
        <div className="absolute right-0 z-20 mt-1 w-96 rounded-md border border-slate-200 bg-white text-sm shadow-lg">
          {isFetching && <p className="p-3 text-slate-400">Buscando…</p>}
          {!isFetching && !hasResults && <p className="p-3 text-slate-400">Sin resultados.</p>}

          {data && data.customers.length > 0 && (
            <div className="border-b border-slate-100 p-2">
              <p className="px-2 py-1 text-xs font-medium uppercase text-slate-400">Clientes</p>
              {data.customers.map((c) => (
                <button key={c.id} onClick={() => go(`/clientes/${c.id}/cuenta`)} className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-100">
                  {c.businessName} <span className="text-xs text-slate-400">({c.internalCode})</span>
                </button>
              ))}
            </div>
          )}

          {data && data.products.length > 0 && (
            <div className="border-b border-slate-100 p-2">
              <p className="px-2 py-1 text-xs font-medium uppercase text-slate-400">Productos</p>
              {data.products.map((p) => (
                <button key={p.id} onClick={() => go('/productos')} className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-100">
                  <span className="font-mono text-xs text-slate-500">{p.internalCode}</span> {p.description}
                </button>
              ))}
            </div>
          )}

          {data && data.deliveryNotes.length > 0 && (
            <div className="border-b border-slate-100 p-2">
              <p className="px-2 py-1 text-xs font-medium uppercase text-slate-400">Remitos</p>
              {data.deliveryNotes.map((d) => (
                <button key={d.id} onClick={() => go(`/remitos/${d.id}`)} className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-100">
                  {d.series}-{String(d.number).padStart(8, '0')} — {d.customerName}
                </button>
              ))}
            </div>
          )}

          {data && data.suppliers.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium uppercase text-slate-400">Proveedores</p>
              {data.suppliers.map((s) => (
                <button key={s.id} onClick={() => go('/proveedores')} className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-100">
                  {s.name} <span className="text-xs text-slate-400">({s.code})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
