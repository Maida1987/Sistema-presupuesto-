import { getAccessToken } from './client';

/**
 * Descarga un archivo desde la API forzando el diálogo "Guardar como" del
 * navegador. No existía este patrón en el proyecto — lo único que había
 * (el PDF de remito) usa `window.open` para abrirlo inline en una pestaña
 * nueva, que no sirve para reportes que el usuario quiere guardar/enviar.
 * No se puede usar un <a href> directo porque el endpoint requiere el
 * header Authorization.
 */
export async function downloadFile(path: string, fallbackFilename: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(typeof body.message === 'string' ? body.message : 'No se pudo generar el archivo');
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : fallbackFilename;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
