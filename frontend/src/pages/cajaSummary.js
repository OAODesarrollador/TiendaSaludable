const toNumber = (value) => Number(value || 0);
const isSaleMovementConcept = (concept) => /^Venta #\d+/i.test(String(concept || '').trim());
const isRefundMovementConcept = (concept) => /^Nota de crédito #/i.test(String(concept || '').trim());

export function summarizeCashReport(report, session) {
  const sessions = report?.sessions || [];
  const movements = report?.movements || [];
  const sales = report?.sales || [];

  const totalApertura = sessions.reduce(
    (acc, current) => acc + toNumber(current.opening || current.opening_amount),
    0
  );

  const ingresosPorConcepto = movements
    .filter((movement) => movement.type === 'ingreso' && !isSaleMovementConcept(movement.concept))
    .reduce((acc, movement) => {
      const concept = movement.concept || 'Ingreso';
      acc[concept] = (acc[concept] || 0) + toNumber(movement.amount);
      return acc;
    }, {});

  const ventasPorMetodo = sales
    .filter((sale) => (sale.type || '').toLowerCase() === 'venta')
    .reduce((acc, sale) => {
      const method = sale.payment_method || 'otros';
      acc[method] = (acc[method] || 0) + toNumber(sale.amount ?? sale.total);
      return acc;
    }, {});

  const egresosPorConcepto = movements
    .filter(
      (movement) =>
        movement.type === 'egreso' &&
        !isRefundMovementConcept(movement.concept)
    )
    .reduce((acc, movement) => {
      const concept = movement.concept || 'Egreso';
      acc[concept] = (acc[concept] || 0) + toNumber(movement.amount);
      return acc;
    }, {});

  const totalNotasCredito = sales
    .filter((sale) => (sale.type || '').toLowerCase() === 'nota_credito')
    .reduce((acc, sale) => acc + Math.abs(toNumber(sale.amount ?? sale.total)), 0) || toNumber(report?.creditNotesTotal);

  const totalIngresos = Object.values(ingresosPorConcepto).reduce(
    (acc, amount) => acc + toNumber(amount),
    0
  );

  const totalVentas = Object.values(ventasPorMetodo).reduce(
    (acc, amount) => acc + toNumber(amount),
    0
  );

  const totalEgresos = Object.values(egresosPorConcepto).reduce(
    (acc, amount) => acc + toNumber(amount),
    0
  );

  const totalEgresosFinal = totalEgresos + totalNotasCredito;
  const totalGeneral = totalApertura + totalIngresos + totalVentas - totalEgresosFinal;

  return {
    totalApertura,
    ingresosPorConcepto,
    totalIngresos,
    ventasPorMetodo,
    totalVentas,
    egresosPorConcepto,
    totalEgresos,
    totalNotasCredito,
    totalEgresosFinal,
    totalGeneral,
    netoReal: totalGeneral
  };
}
