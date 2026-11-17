import {
  agruparDiseno,
  agruparEjecucion,
  coincideTexto,
  FilaLista,
  filtrarProyectos,
  FILTROS_VACIOS,
  indicadores,
  ordenarFilas,
} from './tablero';
import { ProyectoFlujo } from '../models/proyecto-flujo.model';

const AHORA = new Date(2026, 10, 17, 10);
const hace = (n: number) => new Date(2026, 10, 17 - n, 9);

function p(id: string, over: Partial<ProyectoFlujo> = {}): ProyectoFlujo {
  return {
    id, contactoId: 'c', codigo: `PLA-${id.toUpperCase().padEnd(3, 'X').slice(0, 3)}`, nombreProyecto: id,
    etapaFlujo: 'propuesta', etapaFlujoDesde: hace(1), etapaEjecucion: null, servicioIds: [],
    visitaTecnica: 'no_aplica', documentos: [], historial: [], creadoEn: hace(10), creadoPor: '',
    actualizadoEn: hace(1), ...over,
  };
}

describe('búsqueda', () => {
  it('por nombre, código o contacto, sin tildes ni mayúsculas', () => {
    const x = { nombreProyecto: 'La María · Pereira', codigo: 'PLA-MPR' };
    expect(coincideTexto(x, 'Luis Gómez', 'maria')).toBe(true);
    expect(coincideTexto(x, 'Luis Gómez', 'pla-mpr')).toBe(true);
    expect(coincideTexto(x, 'Luis Gómez', 'GOMEZ')).toBe(true);
    expect(coincideTexto(x, 'Luis Gómez', 'horizontes')).toBe(false);
    expect(coincideTexto(x, '', '   ')).toBe(true);
  });
});

describe('filtros', () => {
  const lista = [
    p('a', { servicioIds: ['s1'] }),
    p('b', { servicioIds: ['s2'], etapaFlujoDesde: hace(30) }),
    p('c', { servicioIds: ['s1', 's2'] }),
  ];
  const nombre = () => '';

  it('sin filtros devuelve todo', () => {
    expect(filtrarProyectos(lista, FILTROS_VACIOS, nombre, AHORA)).toHaveLength(3);
  });
  it('por servicio', () => {
    expect(filtrarProyectos(lista, { ...FILTROS_VACIOS, servicioId: 's2' }, nombre, AHORA).map(x => x.id)).toEqual(['b', 'c']);
  });
  it('solo estancados', () => {
    expect(filtrarProyectos(lista, { ...FILTROS_VACIOS, soloEstancados: true }, nombre, AHORA).map(x => x.id)).toEqual(['b']);
  });
});

describe('agrupación', () => {
  it('agrupa por etapa de diseño, todas las etapas presentes, más días primero', () => {
    const m = agruparDiseno([
      p('a', { etapaFlujoDesde: hace(2) }),
      p('b', { etapaFlujoDesde: hace(9) }),
      p('c', { etapaFlujo: 'diseno' }),
    ], AHORA);
    expect(m.get('propuesta')!.map(x => x.id)).toEqual(['b', 'a']);
    expect(m.get('diseno')!.map(x => x.id)).toEqual(['c']);
    expect(m.get('archivado')).toEqual([]);
    expect(m.size).toBe(9);
  });

  it('el carril de ejecución solo incluye proyectos con etapaEjecucion', () => {
    const m = agruparEjecucion([
      p('a'),
      p('b', { etapaFlujo: 'entregado', etapaEjecucion: 'en_obra', etapaEjecucionDesde: hace(3) }),
    ], AHORA);
    expect(m.get('en_obra')!.map(x => x.id)).toEqual(['b']);
    expect([...m.values()].flat()).toHaveLength(1);
  });
});

describe('indicadores', () => {
  it('cuenta propuestas, diseño + revisión y estancados', () => {
    const r = indicadores([
      p('a'),
      p('b', { etapaFlujoDesde: hace(20) }),
      p('c', { etapaFlujo: 'diseno' }),
      p('d', { etapaFlujo: 'revision', etapaFlujoDesde: hace(25) }),
      p('e', { etapaFlujo: 'archivado', etapaFlujoDesde: hace(300) }),
    ], AHORA);
    expect(r).toEqual({ propuestasAbiertas: 2, enDiseno: 2, estancados: 2 });
  });
});

describe('orden de la lista', () => {
  const fila = (codigo: string, over: Partial<FilaLista> = {}): FilaLista => ({
    id: codigo, codigo, proyecto: codigo, contacto: '', etapa: 'propuesta', etapaEjecucion: null,
    servicios: '', dias: 0, proximoPaso: '', proximoPasoFecha: null, valor: null, pagado: null, ...over,
  });
  const filas = [
    fila('PLA-BBB', { dias: 5, etapa: 'diseno', proximoPasoFecha: new Date(2026, 10, 20) }),
    fila('PLA-AAA', { dias: 9, etapa: 'contacto' }),
    fila('PLA-CCC', { dias: 1, etapa: 'archivado', proximoPasoFecha: new Date(2026, 10, 18) }),
  ];

  it('por código', () => {
    expect(ordenarFilas(filas, 'codigo', true).map(f => f.codigo)).toEqual(['PLA-AAA', 'PLA-BBB', 'PLA-CCC']);
  });
  it('por días, descendente', () => {
    expect(ordenarFilas(filas, 'dias', false).map(f => f.dias)).toEqual([9, 5, 1]);
  });
  it('por etapa sigue el orden del flujo', () => {
    expect(ordenarFilas(filas, 'etapa', true).map(f => f.etapa)).toEqual(['contacto', 'diseno', 'archivado']);
  });
  it('por próximo paso: sin fecha al final', () => {
    expect(ordenarFilas(filas, 'proximoPaso', true).map(f => f.codigo)).toEqual(['PLA-CCC', 'PLA-BBB', 'PLA-AAA']);
  });
  it('no muta la lista original', () => {
    ordenarFilas(filas, 'dias', true);
    expect(filas[0].codigo).toBe('PLA-BBB');
  });
});
