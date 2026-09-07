import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchCustomers } from '../customers/api';
import { searchProducts } from '../products/api';
import { createDeliveryNote } from './api';
import type { Customer } from '../customers/types';
import type { Product } from '../products/types';

interface DraftItem {
  productId: string;
  code: string;
  description: string;
  quantity: number;
}

export function NewDeliveryNotePage() {
  const navigate = useNavigate();

  const [customerSearch, setCustomerSearch] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: customerOptions } = useQuery({
    queryKey: ['customers', customerSearch],
    queryFn: () => fetchCustomers(customerSearch),
    enabled: !customer && customerSearch.length > 0,
  });

  const { data: productOptions } = useQuery({
    queryKey: ['products', productSearch],
    queryFn: () => searchProducts(productSearch),
    enabled: !selectedProduct && productSearch.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: createDeliveryNote,
    onSuccess: (deliveryNote) => navigate(`/remitos/${deliveryNote.id}`),
    onError: () => setError('No se pudo generar el remito. Verificá los datos e intentá de nuevo.'),
  });

  function addItem() {
    if (!selectedProduct || quantity <= 0) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === selectedProduct.id);
      if (existing) {
        return prev.map((i) => (i.productId === selectedProduct.id ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [...prev, { productId: selectedProduct.id, code: selectedProduct.internalCode, description: selectedProduct.description, quantity }];
    });
    setSelectedProduct(null);
    setProductSearch('');
    setQuantity(1);
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function handleGenerate() {
    setError(null);
    if (!customer) {
      setError('Elegí un cliente.');
      return;
    }
    if (items.length === 0) {
      setError('Agregá al menos un producto.');
      return;
    }
    createMutation.mutate({
      customerId: customer.id,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Nuevo remito</h1>

      <div className="mb-6 max-w-2xl space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Cliente</label>
          {customer ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="rounded-md bg-slate-100 px-3 py-1.5">
                {customer.businessName} ({customer.internalCode})
              </span>
              <button onClick={() => setCustomer(null)} className="text-slate-500 underline hover:text-slate-900">
                Cambiar
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="search"
                placeholder="Buscar cliente por nombre o código…"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              {customerOptions && customerOptions.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white text-sm shadow-sm">
                  {customerOptions.map((c) => (
                    <li
                      key={c.id}
                      onClick={() => {
                        setCustomer(c);
                        setCustomerSearch('');
                      }}
                      className="cursor-pointer px-3 py-2 hover:bg-slate-100"
                    >
                      {c.businessName} ({c.internalCode})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Producto</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="search"
                placeholder="Buscar por código o descripción…"
                value={selectedProduct ? `${selectedProduct.internalCode} — ${selectedProduct.description}` : productSearch}
                onChange={(e) => {
                  setSelectedProduct(null);
                  setProductSearch(e.target.value);
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              {!selectedProduct && productOptions && productOptions.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white text-sm shadow-sm">
                  {productOptions.map((p) => (
                    <li
                      key={p.id}
                      onClick={() => {
                        setSelectedProduct(p);
                        setProductSearch('');
                      }}
                      className="cursor-pointer px-3 py-2 hover:bg-slate-100"
                    >
                      <span className="font-mono text-xs text-slate-500">{p.internalCode}</span> — {p.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <input
              type="number"
              min={1}
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={addItem}
              disabled={!selectedProduct}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="mb-6 max-w-2xl overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2">Producto</th>
                <th className="px-4 py-2">Cantidad</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.productId} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{item.code}</td>
                  <td className="px-4 py-2">{item.description}</td>
                  <td className="px-4 py-2">{item.quantity}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => removeItem(item.productId)} className="text-xs text-red-600 underline">
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="mb-3 max-w-2xl text-sm text-red-600">{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={createMutation.isPending}
        className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {createMutation.isPending ? 'Generando…' : 'Generar remito'}
      </button>
    </div>
  );
}
