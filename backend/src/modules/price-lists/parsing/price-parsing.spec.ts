import { parsePrice } from './price-parsing';

describe('parsePrice', () => {
  it('acepta un número directo', () => {
    expect(parsePrice(160)).toBe(160);
  });

  it('redondea ruido de coma flotante a centavos', () => {
    expect(parsePrice(332.40374999999995)).toBe(332.4);
  });

  it('parsea formato moneda en-US con separador de miles ("$ 121,271.26")', () => {
    expect(parsePrice('$ 121,271.26')).toBe(121271.26);
  });

  it('parsea formato es-AR con separador de miles ("$121.271,26")', () => {
    expect(parsePrice('$121.271,26')).toBe(121271.26);
  });

  it('parsea un número simple como string', () => {
    expect(parsePrice('170')).toBe(170);
  });

  it('devuelve null para vacío o no numérico', () => {
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('CONSULTAR')).toBeNull();
  });

  it('nunca interpreta una fecha como precio', () => {
    expect(parsePrice('DESDE EL 24/08/2026')).toBeNull();
    expect(parsePrice('24/08/2026')).toBeNull();
  });
});
