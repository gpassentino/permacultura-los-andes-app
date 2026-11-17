import {
  agregarAlHistorial,
  aplicarMovimiento,
  aplicarSiguienteFase,
  avisosAlMover,
  diasEnEtapa,
  diasEntre,
  estaEstancado,
  PATRON_CODIGO,
  proximoPasoVencido,
  sugerirCodigo,
} from './flujo';
import { EntradaHistorial, ProyectoFlujo } from '../models/proyecto-flujo.model';
import { formatoCOP, formatoHa } from '../utils/formato';

const AHORA = new Date(2026, 10, 17, 10, 0); // 17 nov 2026, 10:00
const haceDias = (n: number) => new Date(2026, 10, 17 - n, 15, 0);

function proyecto(over: Partial<ProyectoFlujo> = {}): ProyectoFlujo {
  return {
    contactoId: 'c1',
    codigo: 'PLA-HRZ',
    nombreProyecto: 'Horizontes',
    etapaFlujo: 'contacto',
    etapaFlujoDesde: haceDias(0),
    etapaEjecucion: null,
    servicioIds: [],
    visitaTecnica: 'no_aplica',
    documentos: [],
    historial: [],
    creadoEn: haceDias(30),
    creadoPor: '',
    actualizadoEn: haceDias(0),
    ...over,
  };
}

describe('formato', () => {
  it('formatea pesos colombianos', () => {
    expect(formatoCOP(24_000_000)).toBe('$24.000.000');
    expect(formatoCOP(1234.6)).toBe('$1.235');
    expect(formatoCOP(0)).toBe('$0');
    expect(formatoCOP(-500_000)).toBe('-$500.000');
  });
  it('formatea hectáreas con coma decimal', () => {
    expect(formatoHa(4.2)).toBe('4,2 ha');
    expect(formatoHa(12)).toBe('12 ha');
  });
});

describe('días en la etapa', () => {
  it('cuenta días de calendario, no horas', () => {
    expect(diasEntre(new Date(2026, 10, 16, 23, 59), new Date(2026, 10, 17, 0, 1))).toBe(1);
    expect(diasEntre(AHORA, AHORA)).toBe(0);
  });
  it('nunca es negativo', () => {
    expect(diasEntre(new Date(2026, 10, 20), AHORA)).toBe(0);
  });
  it('usa etapaFlujoDesde en el carril de diseño', () => {
    expect(diasEnEtapa(proyecto({ etapaFlujoDesde: haceDias(12) }), AHORA)).toBe(12);
  });
  it('usa etapaEjecucionDesde en el carril de ejecución y null si no hay carril', () => {
    const p = proyecto({ etapaEjecucion: 'en_obra', etapaEjecucionDesde: haceDias(5) });
    expect(diasEnEtapa(p, AHORA, 'ejecucion')).toBe(5);
    expect(diasEnEtapa(proyecto(), AHORA, 'ejecucion')).toBeNull();
  });
});

describe('alertas de estancamiento', () => {
  it.each([
    ['propuesta', 15, false],
    ['propuesta', 16, true],
    ['contrato', 11, true],
    ['diseno', 45, false],
    ['diseno', 46, true],
    ['revision', 21, true],
  ] as const)('%s con %i días → %s', (etapa, dias, esperado) => {
    expect(estaEstancado(proyecto({ etapaFlujo: etapa, etapaFlujoDesde: haceDias(dias) }), AHORA)).toBe(esperado);
  });

  it('contacto > 7 días solo si no hay próximo paso', () => {
    const viejo = { etapaFlujo: 'contacto' as const, etapaFlujoDesde: haceDias(8) };
    expect(estaEstancado(proyecto(viejo), AHORA)).toBe(true);
    expect(estaEstancado(proyecto({ ...viejo, proximoPaso: { texto: 'Llamar' } }), AHORA)).toBe(false);
    expect(estaEstancado(proyecto({ ...viejo, proximoPaso: { texto: '  ' } }), AHORA)).toBe(true);
  });

  it('etapas sin umbral nunca se estancan', () => {
    expect(estaEstancado(proyecto({ etapaFlujo: 'entregado', etapaFlujoDesde: haceDias(400) }), AHORA)).toBe(false);
    expect(estaEstancado(proyecto({ etapaFlujo: 'archivado', etapaFlujoDesde: haceDias(400) }), AHORA)).toBe(false);
  });

  it('acepta umbrales configurables', () => {
    const p = proyecto({ etapaFlujo: 'propuesta', etapaFlujoDesde: haceDias(3) });
    expect(estaEstancado(p, AHORA, { propuesta: 2 })).toBe(true);
  });
});

describe('próximo paso vencido', () => {
  it('es rojo solo si la fecha es anterior a hoy', () => {
    expect(proximoPasoVencido(proyecto({ proximoPaso: { texto: 'x', fecha: haceDias(1) } }), AHORA)).toBe(true);
    expect(proximoPasoVencido(proyecto({ proximoPaso: { texto: 'x', fecha: new Date(2026, 10, 17, 8) } }), AHORA)).toBe(false);
    expect(proximoPasoVencido(proyecto({ proximoPaso: { texto: 'x' } }), AHORA)).toBe(false);
    expect(proximoPasoVencido(proyecto(), AHORA)).toBe(false);
  });
});

describe('historial y movimientos', () => {
  const hist: EntradaHistorial[] = [
    { etapa: 'contacto', carril: 'diseno', desde: haceDias(10) },
    { etapa: 'en_obra', carril: 'ejecucion', desde: haceDias(4) },
  ];

  it('cierra solo la entrada abierta del mismo carril', () => {
    const r = agregarAlHistorial(hist, 'diseno', 'propuesta', AHORA);
    expect(r).toHaveLength(3);
    expect(r[0].hasta).toEqual(AHORA);
    expect(r[1].hasta).toBeUndefined();
    expect(r[2]).toEqual({ etapa: 'propuesta', carril: 'diseno', desde: AHORA });
    expect(hist[0].hasta).toBeUndefined(); // no muta
  });

  it('mover actualiza etapaFlujoDesde y agrega historial', () => {
    const c = aplicarMovimiento(proyecto({ historial: hist }), 'diseno', 'propuesta', AHORA)!;
    expect(c.etapaFlujo).toBe('propuesta');
    expect(c.etapaFlujoDesde).toEqual(AHORA);
    expect(c.historial!.at(-1)!.etapa).toBe('propuesta');
  });

  it('mover a la misma etapa no hace nada', () => {
    expect(aplicarMovimiento(proyecto(), 'diseno', 'contacto', AHORA)).toBeNull();
  });

  it('no_se_dio exige motivoCierre', () => {
    expect(() => aplicarMovimiento(proyecto(), 'diseno', 'no_se_dio', AHORA)).toThrow();
    const c = aplicarMovimiento(proyecto(), 'diseno', 'no_se_dio', AHORA, { motivoCierre: ' precio ' })!;
    expect(c.motivoCierre).toBe('precio');
  });

  it('al pasar a contrato activa el carril de ejecución si hay servicio de ejecución', () => {
    const p = proyecto({ etapaFlujo: 'propuesta', servicioIds: ['svc-ejec'] });
    const c = aplicarMovimiento(p, 'diseno', 'contrato', AHORA, { servicioIdsEjecucion: ['svc-ejec'] })!;
    expect(c.etapaEjecucion).toBe('por_programar');
    expect(c.etapaEjecucionDesde).toEqual(AHORA);
    expect(c.historial!.map(h => h.carril)).toEqual(['diseno', 'ejecucion']);
  });

  it('no reactiva el carril si ya estaba activo, ni sin servicio de ejecución', () => {
    const activo = proyecto({ etapaFlujo: 'propuesta', servicioIds: ['svc-ejec'], etapaEjecucion: 'en_obra' });
    expect(aplicarMovimiento(activo, 'diseno', 'contrato', AHORA, { servicioIdsEjecucion: ['svc-ejec'] })!.etapaEjecucion).toBeUndefined();
    const sinEjec = proyecto({ etapaFlujo: 'propuesta', servicioIds: ['svc-dis'] });
    expect(aplicarMovimiento(sinEjec, 'diseno', 'contrato', AHORA, { servicioIdsEjecucion: ['svc-ejec'] })!.etapaEjecucion).toBeUndefined();
  });

  it('mueve el carril de ejecución por separado', () => {
    const p = proyecto({ etapaFlujo: 'entregado', etapaEjecucion: 'por_programar', historial: hist });
    const c = aplicarMovimiento(p, 'ejecucion', 'en_obra', AHORA)!;
    expect(c.etapaEjecucion).toBe('en_obra');
    expect(c.etapaFlujo).toBeUndefined();
  });

  it('siguiente fase de diseño: mismo proyecto, agrega servicio y vuelve a diseno', () => {
    const p = proyecto({ etapaFlujo: 'entregado', servicioIds: ['svc-conc'] });
    const c = aplicarSiguienteFase(p, 'svc-tec', 'Diseño técnico', false, AHORA);
    expect(c.servicioIds).toEqual(['svc-conc', 'svc-tec']);
    expect(c.etapaFlujo).toBe('diseno');
    expect(c.historial!.at(-1)!.nota).toBe('Siguiente fase: Diseño técnico');
  });

  it('siguiente fase de ejecución: activa el carril sin tocar el de diseño', () => {
    const p = proyecto({ etapaFlujo: 'entregado', servicioIds: ['svc-tec'] });
    const c = aplicarSiguienteFase(p, 'svc-ejec', 'Ejecución', true, AHORA);
    expect(c.etapaEjecucion).toBe('por_programar');
    expect(c.etapaFlujo).toBeUndefined();
    expect(c.servicioIds).toContain('svc-ejec');
  });

  it('no duplica el servicio si ya estaba', () => {
    const p = proyecto({ servicioIds: ['svc-tec'] });
    expect(aplicarSiguienteFase(p, 'svc-tec', 'Diseño técnico', false, AHORA).servicioIds).toEqual(['svc-tec']);
  });
});

describe('avisos al mover', () => {
  const contrato = { id: 'd1', tipo: 'contrato' as const, etapa: 'contrato', url: 'x', fecha: AHORA };
  const informe  = { id: 'd2', tipo: 'informe' as const, etapa: 'revision', url: 'x', fecha: AHORA };

  it('a diseno sin contrato avisa', () => {
    expect(avisosAlMover(proyecto(), 'diseno', { esContabilidad: false }).avisos).toEqual(['Falta contrato o anticipo']);
  });
  it('a diseno con contrato: el anticipo solo cuenta para Contabilidad', () => {
    const p = proyecto({ documentos: [contrato] });
    expect(avisosAlMover(p, 'diseno', { esContabilidad: false, anticipoPagado: false }).avisos).toEqual([]);
    expect(avisosAlMover(p, 'diseno', { esContabilidad: true, anticipoPagado: false }).avisos).toEqual(['Falta contrato o anticipo']);
    expect(avisosAlMover(p, 'diseno', { esContabilidad: true, anticipoPagado: true }).avisos).toEqual([]);
  });
  it('a archivado con saldo avisa el monto, solo a Contabilidad', () => {
    expect(avisosAlMover(proyecto(), 'archivado', { esContabilidad: true, porCobrar: 1_500_000 }).avisos)
      .toEqual(['Quedan $1.500.000 por cobrar']);
    expect(avisosAlMover(proyecto(), 'archivado', { esContabilidad: false, porCobrar: 1_500_000 }).avisos).toEqual([]);
    expect(avisosAlMover(proyecto(), 'archivado', { esContabilidad: true, porCobrar: 0 }).avisos).toEqual([]);
  });
  it('a revision sin informe avisa', () => {
    expect(avisosAlMover(proyecto(), 'revision', { esContabilidad: false }).avisos).toEqual(['Adjunta el enlace del informe enviado']);
    expect(avisosAlMover(proyecto({ documentos: [informe] }), 'revision', { esContabilidad: false }).avisos).toEqual([]);
  });
  it('a portafolio ofrece crear la ficha si no está enlazada', () => {
    expect(avisosAlMover(proyecto(), 'portafolio', { esContabilidad: false }).ofrecerPortafolio).toBe(true);
    expect(avisosAlMover(proyecto({ portafolioProyectoId: 'pf1' }), 'portafolio', { esContabilidad: false }).ofrecerPortafolio).toBe(false);
  });
  it('a no_se_dio pide motivo', () => {
    expect(avisosAlMover(proyecto(), 'no_se_dio', { esContabilidad: false }).requiereMotivoCierre).toBe(true);
  });
});

describe('sugerirCodigo', () => {
  it('usa consonantes de una sola palabra', () => {
    expect(sugerirCodigo('Horizontes', new Set())).toBe('PLA-HRZ');
  });
  it('ignora tildes, signos y palabras vacías', () => {
    expect(sugerirCodigo('La María · Pereira', new Set())).toBe('PLA-MPR');
  });
  it('usa iniciales con tres palabras o más', () => {
    expect(sugerirCodigo('Finca Agua Clara Norte', new Set())).toBe('PLA-FAC');
  });
  it('evita códigos usados', () => {
    const usados = new Set(['PLA-HRZ']);
    const c = sugerirCodigo('Horizontes', usados);
    expect(c).not.toBe('PLA-HRZ');
    expect(c.startsWith('PLA-HR')).toBe(true);
  });
  it('siempre devuelve el patrón PLA-XXX, incluso sin nombre', () => {
    expect(sugerirCodigo('', new Set())).toMatch(PATRON_CODIGO);
    expect(sugerirCodigo('Ñ', new Set())).toMatch(PATRON_CODIGO);
    expect(sugerirCodigo('123', new Set())).toMatch(PATRON_CODIGO);
  });
  it('genera códigos únicos en lote', () => {
    const usados = new Set<string>();
    for (let i = 0; i < 300; i++) usados.add(sugerirCodigo('Horizontes', usados));
    expect(usados.size).toBe(300);
  });
});
