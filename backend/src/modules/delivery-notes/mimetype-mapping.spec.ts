import { extensionForMimetype, mimetypeForStorageKey } from './delivery-notes.service';

// Bug real encontrado al probar contra Postgres: adjuntar una firma en PNG
// se guardaba siempre con extensión ".pdf" (hardcodeada), sin importar el
// tipo real del archivo subido. Este test cubre el fix.
describe('mapeo de mimetype <-> extensión de archivo adjunto', () => {
  it('deriva la extensión correcta según el mimetype subido', () => {
    expect(extensionForMimetype('image/png')).toBe('.png');
    expect(extensionForMimetype('image/jpeg')).toBe('.jpg');
    expect(extensionForMimetype('application/pdf')).toBe('.pdf');
  });

  it('usa una extensión genérica para un mimetype desconocido, nunca asume PDF', () => {
    expect(extensionForMimetype('application/octet-stream')).toBe('.bin');
  });

  it('reconstruye el Content-Type a partir de la extensión guardada, para servir el archivo correctamente', () => {
    expect(mimetypeForStorageKey('delivery-note-signatures/abc123.png')).toBe('image/png');
    expect(mimetypeForStorageKey('delivery-note-signatures/abc123.jpg')).toBe('image/jpeg');
    expect(mimetypeForStorageKey('delivery-note-signatures/abc123.pdf')).toBe('application/pdf');
  });
});
