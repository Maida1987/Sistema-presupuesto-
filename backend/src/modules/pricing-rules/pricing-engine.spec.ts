import { calculatePrice } from './pricing-engine';

describe('calculatePrice', () => {
  it('reproduce el ejemplo documentado en docs/04 §6.2: costo 100.000, margen 30% sobre costo, gastos 10%, IVA 21%, redondeo a la centena', () => {
    const result = calculatePrice(100000, {
      marginPct: 0.3,
      marginBase: 'COST',
      expensesPct: 0.1,
      expensesFixed: 0,
      ivaPct: 0.21,
      roundingRule: 'NEAREST_100',
    });

    expect(result.afterMargin).toBe(130000);
    expect(result.afterExpenses).toBe(143000);
    expect(result.beforeRounding).toBeCloseTo(173030, 5);
    expect(result.finalPrice).toBe(173000);
  });

  it('calcula el margen sobre precio de venta cuando marginBase es SALE_PRICE', () => {
    // costo 70, margen 30% sobre precio de venta => precio de venta = 100
    const result = calculatePrice(70, {
      marginPct: 0.3,
      marginBase: 'SALE_PRICE',
      expensesPct: 0,
      expensesFixed: 0,
      ivaPct: 0,
      roundingRule: 'NONE',
    });

    expect(result.afterMargin).toBeCloseTo(100, 5);
  });

  it('aplica gastos fijos además del porcentual', () => {
    const result = calculatePrice(1000, {
      marginPct: 0,
      marginBase: 'COST',
      expensesPct: 0,
      expensesFixed: 50,
      ivaPct: 0,
      roundingRule: 'NONE',
    });

    expect(result.afterExpenses).toBe(1050);
    expect(result.finalPrice).toBe(1050);
  });

  it('redondea hacia arriba a la decena con CEIL_10', () => {
    const result = calculatePrice(101, {
      marginPct: 0,
      marginBase: 'COST',
      expensesPct: 0,
      expensesFixed: 0,
      ivaPct: 0,
      roundingRule: 'CEIL_10',
    });

    expect(result.finalPrice).toBe(110);
  });

  it('sin regla de redondeo, solo normaliza a centavos', () => {
    const result = calculatePrice(10.005, {
      marginPct: 0,
      marginBase: 'COST',
      expensesPct: 0,
      expensesFixed: 0,
      ivaPct: 0,
      roundingRule: 'NONE',
    });

    expect(result.finalPrice).toBeCloseTo(10.01, 2);
  });
});
