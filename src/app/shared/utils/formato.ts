// Formato colombiano para cifras: $24.000.000 · 4,2 ha

const ENTERO_CO = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0, useGrouping: true });
const HA_CO     = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2, useGrouping: true });

/** $24.000.000 (pesos redondeados, sin decimales, punto de miles). */
export function formatoCOP(valor: number): string {
  const n = Math.round(valor);
  const signo = n < 0 ? '-' : '';
  return `${signo}$${ENTERO_CO.format(Math.abs(n))}`;
}

/** 4,2 ha */
export function formatoHa(valor: number): string {
  return `${HA_CO.format(valor)} ha`;
}
