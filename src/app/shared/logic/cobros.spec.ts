import {
  anticipoPagado,
  desajusteConFacturado,
  estadoVisible,
  estaVencido,
  generarHitos,
  resumenCobro,
} from './cobros';
import { HitoCobro } from '../models/proyecto.model';

const AHORA = new Date(2026, 10, 17, 10, 0);

function hito(over: Partial<HitoCobro> = {}): HitoCobro {
  return {
    id: 'h', carril: 'diseno', concepto: 'Firma', monto: 1_000_000,
    fechaEsperada: null, estado: 'pendiente', orden: 0, ...over,
  };
}

function ids() {
  let n = 0;
  return () => `h${++n}`;
}

describe('vencido', () => {
  it('pendiente o con cuenta de cobro enviada, con fecha pasada', () => {
    expect(estaVencido(hito({ fechaEsperada: new Date(2026, 10, 16) }), AHORA)).toBe(true);
    expect(estaVencido(hito({ estado: 'cobrado', fechaEsperada: new Date(2026, 10, 16) }), AHORA)).toBe(true);
  });
  it('no vence hoy, ni sin fecha, ni pagado', () => {
    expect(estaVencido(hito({ fechaEsperada: new Date(2026, 10, 17) }), AHORA)).toBe(false);
    expect(estaVencido(hito(), AHORA)).toBe(false);
    expect(estaVencido(hito({ estado: 'pagado', fechaEsperada: new Date(2026, 0, 1) }), AHORA)).toBe(false);
  });
  it('estadoVisible devuelve vencido o el estado guardado', () => {
    expect(estadoVisible(hito({ estado: 'cobrado', fechaEsperada: new Date(2026, 0, 1) }), AHORA)).toBe('vencido');
    expect(estadoVisible(hito({ estado: 'cobrado' }), AHORA)).toBe('cobrado');
  });
});

describe('totales de pago', () => {
  const hitos = [
    hito({ id: 'a', monto: 5_000_000, estado: 'pagado' }),
    hito({ id: 'b', monto: 3_000_000, estado: 'cobrado', fechaEsperada: new Date(2026, 9, 1) }),
    hito({ id: 'c', monto: 2_000_000, carril: 'ejecucion', fechaEsperada: new Date(2026, 11, 1) }),
  ];

  it('contratado = suma de hitos; pagado = suma de pagos recibidos', () => {
    const r = resumenCobro(hitos, [{ monto: 5_000_000 }], AHORA);
    expect(r).toEqual({ contratado: 10_000_000, pagado: 5_000_000, porCobrar: 5_000_000, vencidos: 1, montoVencido: 3_000_000 });
  });

  it('cuenta pagos sin hito (registrados antes de los hitos)', () => {
    const r = resumenCobro(hitos, [{ monto: 5_000_000 }, { monto: 1_000_000 }], AHORA);
    expect(r.pagado).toBe(6_000_000);
    expect(r.porCobrar).toBe(4_000_000);
  });

  it('porCobrar nunca es negativo', () => {
    expect(resumenCobro(hitos, [{ monto: 20_000_000 }], AHORA).porCobrar).toBe(0);
  });

  it('por carril usa los hitos pagados del carril', () => {
    const r = resumenCobro(hitos, [{ monto: 999 }], AHORA, 'diseno');
    expect(r.contratado).toBe(8_000_000);
    expect(r.pagado).toBe(5_000_000);
    expect(r.porCobrar).toBe(3_000_000);
  });

  it('sin hitos ni pagos todo es cero', () => {
    expect(resumenCobro(undefined, undefined, AHORA)).toEqual({ contratado: 0, pagado: 0, porCobrar: 0, vencidos: 0, montoVencido: 0 });
  });

  it('desajuste con el total facturado', () => {
    expect(desajusteConFacturado(hitos, 10_000_000)).toBe(0);
    expect(desajusteConFacturado(hitos, 12_000_000)).toBe(-2_000_000);
    expect(desajusteConFacturado(undefined, 0)).toBe(0);
  });
});

describe('anticipo pagado', () => {
  it('con hitos, el primero del carril debe estar pagado', () => {
    const hs = [hito({ orden: 1, estado: 'pendiente' }), hito({ orden: 0, estado: 'pagado' })];
    expect(anticipoPagado(hs, [])).toBe(true);
    expect(anticipoPagado([hito({ orden: 0 }), hito({ orden: 1, estado: 'pagado' })], [])).toBe(false);
  });
  it('sin hitos, cuenta un pago de tipo anticipo', () => {
    expect(anticipoPagado([], [{ tipo: 'anticipo', monto: 100 }])).toBe(true);
    expect(anticipoPagado([], [{ tipo: 'otro', monto: 100 }])).toBe(false);
  });
});

describe('plantillas de plan de pagos', () => {
  it('50/50', () => {
    const hs = generarHitos('50_50', 10_000_000, 'diseno', ids());
    expect(hs.map(h => [h.concepto, h.monto])).toEqual([['Firma', 5_000_000], ['Entrega', 5_000_000]]);
    expect(hs.every(h => h.estado === 'pendiente' && h.fechaEsperada === null && h.carril === 'diseno')).toBe(true);
  });
  it('40/40/20', () => {
    const hs = generarHitos('40_40_20', 24_000_000, 'diseno', ids());
    expect(hs.map(h => [h.concepto, h.monto])).toEqual([
      ['Firma', 9_600_000], ['Entrega preliminar', 9_600_000], ['Entrega final', 4_800_000],
    ]);
  });
  it('la suma siempre cuadra con el total, aun con redondeo', () => {
    const hs = generarHitos('40_40_20', 1_000_001, 'diseno', ids());
    expect(hs.reduce((s, h) => s + h.monto, 0)).toBe(1_000_001);
    const vs = generarHitos('por_visita', 1_000_000, 'ejecucion', ids(), { numVisitas: 3 });
    expect(vs.map(h => h.concepto)).toEqual(['Visita 1', 'Visita 2', 'Visita 3']);
    expect(vs.reduce((s, h) => s + h.monto, 0)).toBe(1_000_000);
  });
  it('por visita sin número crea un hito', () => {
    expect(generarHitos('por_visita', 500_000, 'ejecucion', ids())).toHaveLength(1);
  });
  it('ids únicos y orden continuo desde ordenInicial', () => {
    const hs = generarHitos('40_40_20', 3_000_000, 'ejecucion', ids(), { ordenInicial: 2 });
    expect(new Set(hs.map(h => h.id)).size).toBe(3);
    expect(hs.map(h => h.orden)).toEqual([2, 3, 4]);
  });
});
