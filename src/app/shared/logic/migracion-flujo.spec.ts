import {
  ClienteLegacy,
  ContextoMigracion,
  elegirEtapaDesde,
  inferirTipoDocumento,
  inferirVersion,
  mapearCliente,
  mapearEtapas,
} from './migracion-flujo';
import { planServicios } from './servicios-flujo';

const AHORA = new Date(2026, 10, 17, 10, 0);

const ID_POR_TIPO = {
  asesoria_in_situ: 'svc-insitu',
  informe_vision:   'svc-conc',
  diseno_tecnico:   'svc-tec',
  ejecucion:        'svc-ejec',
  acompanamiento:   'svc-acomp',
  taller:           'svc-taller',
};

function ctx(over: Partial<ContextoMigracion> = {}): ContextoMigracion {
  return { servicioIdPorTipo: ID_POR_TIPO, codigosUsados: new Set(), ahora: AHORA, ...over };
}

function cliente(over: Partial<ClienteLegacy> = {}): ClienteLegacy {
  return {
    id: 'cli1', contactoId: 'con1', nombre: 'Horizontes', categoria: 'Diseño Conceptual',
    estado: 'Antes', municipio: 'El Retiro', notas: '', documentos: [], checklist: [],
    recordatorioFecha: null, recordatorioMensaje: '', creadoEn: new Date(2026, 0, 5),
    creadoPor: 'x@y.com', actualizadoEn: new Date(2026, 9, 1),
    ...over,
  };
}

describe('mapeo de etapas', () => {
  it.each([
    ['Antes',     'Diseño Conceptual', 'propuesta',  null],
    ['Antes',     'Implementación',    'propuesta',  null],
    ['Durante',   'Visita Técnica',    'diseno',     null],
    ['Durante',   'Diseño Conceptual', 'diseno',     null],
    ['Durante',   'Diseño Técnico',    'diseno',     null],
    ['Durante',   'Implementación',    'entregado',  'en_obra'],
    ['Después',   'Diseño Técnico',    'entregado',  null],
    ['Después',   'Implementación',    'entregado',  'mantenimiento'],
    ['Completo',  'Diseño Conceptual', 'portafolio', null],
    ['Completo',  'Implementación',    'portafolio', 'ejecucion_cerrada'],
    ['Archivado', 'Visita Técnica',    'archivado',  null],
    ['Archivado', 'Implementación',    'archivado',  'ejecucion_cerrada'],
  ] as const)('%s + %s → %s / %s', (estado, categoria, flujo, ejec) => {
    const r = mapearEtapas(estado, categoria);
    expect(r.etapaFlujo).toBe(flujo);
    expect(r.etapaEjecucion).toBe(ejec);
    expect(r.revisarEtapa).toBe(false);
  });

  it('Durante + Indefinido u Otro → diseno, marcado revisar', () => {
    expect(mapearEtapas('Durante', 'Indefinido')).toEqual({ etapaFlujo: 'diseno', etapaEjecucion: null, revisarEtapa: true });
    expect(mapearEtapas('Durante', 'Otro')).toEqual({ etapaFlujo: 'diseno', etapaEjecucion: null, revisarEtapa: true });
  });

  it('estado desconocido → propuesta, marcado revisar', () => {
    expect(mapearEtapas('Raro', 'Otro')).toEqual({ etapaFlujo: 'propuesta', etapaEjecucion: null, revisarEtapa: true });
    expect(mapearEtapas(undefined, undefined).revisarEtapa).toBe(true);
  });
});

describe('categoría → servicio', () => {
  it.each([
    ['Visita Técnica', ['svc-insitu']],
    ['Diseño Conceptual', ['svc-conc']],
    ['Diseño Técnico', ['svc-tec']],
    ['Implementación', ['svc-ejec']],
  ])('%s → %j', (categoria, ids) => {
    const r = mapearCliente(cliente({ categoria }), ctx());
    expect(r.proyecto.servicioIds).toEqual(ids);
    expect(r.proyecto.revisar).not.toContain('servicios');
  });

  it('Indefinido u Otro → lista vacía y revisar', () => {
    for (const categoria of ['Indefinido', 'Otro', undefined]) {
      const r = mapearCliente(cliente({ categoria }), ctx());
      expect(r.proyecto.servicioIds).toEqual([]);
      expect(r.proyecto.revisar).toContain('servicios');
    }
  });
});

describe('mapearCliente', () => {
  it('conserva id, contacto y enlace al registro anterior; no copia datos de contacto', () => {
    const r = mapearCliente(cliente(), ctx({ proyectoFinancieroId: 'fin1' }));
    expect(r.id).toBe('cli1');
    expect(r.proyecto.contactoId).toBe('con1');
    expect(r.proyecto.clienteIdLegacy).toBe('cli1');
    expect(r.proyecto.proyectoFinancieroId).toBe('fin1');
    expect(r.proyecto).not.toHaveProperty('nombre');
    expect(r.proyecto).not.toHaveProperty('whatsapp');
  });

  it('nombre del proyecto desde el nombre del cliente, marcado revisar, y código sugerido', () => {
    const r = mapearCliente(cliente(), ctx());
    expect(r.proyecto.nombreProyecto).toBe('Horizontes');
    expect(r.proyecto.codigo).toBe('PLA-HRZ');
    expect(r.proyecto.revisar).toEqual(expect.arrayContaining(['nombre', 'codigo']));
  });

  it('códigos únicos entre registros del mismo lote', () => {
    const c = ctx();
    const a = mapearCliente(cliente({ id: 'a' }), c);
    const b = mapearCliente(cliente({ id: 'b' }), c);
    expect(a.proyecto.codigo).not.toBe(b.proyecto.codigo);
    expect(c.codigosUsados.size).toBe(2);
  });

  it('sin contactoId marca revisar contacto', () => {
    expect(mapearCliente(cliente({ contactoId: undefined }), ctx()).proyecto.revisar).toContain('contacto');
  });

  it('recordatorio → próximo paso', () => {
    const fecha = new Date(2026, 10, 20);
    expect(mapearCliente(cliente({ recordatorioMensaje: 'Enviar cotización', recordatorioFecha: fecha }), ctx()).proyecto.proximoPaso)
      .toEqual({ texto: 'Enviar cotización', fecha });
    expect(mapearCliente(cliente({ recordatorioFecha: fecha }), ctx()).proyecto.proximoPaso)
      .toEqual({ texto: 'Seguimiento', fecha });
    expect(mapearCliente(cliente(), ctx()).proyecto.proximoPaso).toBeUndefined();
  });

  it('notas y municipio se conservan; vacíos se omiten', () => {
    const r = mapearCliente(cliente({ notas: ' Lote con quebrada ' }), ctx());
    expect(r.proyecto.notas).toBe('Lote con quebrada');
    expect(r.proyecto.municipio).toBe('El Retiro');
    const v = mapearCliente(cliente({ municipio: '' }), ctx());
    expect(v.proyecto).not.toHaveProperty('municipio');
    expect(v.proyecto).not.toHaveProperty('notas');
  });

  it('historial: una entrada por carril activo', () => {
    const r = mapearCliente(cliente({ estado: 'Durante', categoria: 'Implementación' }), ctx());
    expect(r.proyecto.historial.map(h => [h.carril, h.etapa])).toEqual([['diseno', 'entregado'], ['ejecucion', 'en_obra']]);
    expect(r.proyecto.etapaEjecucionDesde).toEqual(r.proyecto.etapaFlujoDesde);
  });

  it('visita técnica', () => {
    expect(mapearCliente(cliente({ categoria: 'Diseño Técnico' }), ctx()).proyecto.visitaTecnica).toBe('no_aplica');
    expect(mapearCliente(cliente({ categoria: 'Visita Técnica', estado: 'Antes' }), ctx()).proyecto.visitaTecnica).toBe('pendiente');
    expect(mapearCliente(cliente({ categoria: 'Visita Técnica', estado: 'Después' }), ctx()).proyecto.visitaTecnica).toBe('hecha');
    expect(mapearCliente(cliente({
      categoria: 'Visita Técnica', estado: 'Durante',
      checklist: [{ texto: 'Tomar fotos', fase: 'durante', completado: true }],
    }), ctx()).proyecto.visitaTecnica).toBe('hecha');
  });

  it('no deja valores undefined (Firestore los rechaza)', () => {
    const r = mapearCliente(cliente(), ctx());
    const conUndefined = Object.entries(r.proyecto).filter(([, v]) => v === undefined);
    expect(conUndefined).toEqual([]);
  });
});

describe('fecha de inicio de la etapa', () => {
  it('Durante con fecha estimada de inicio pasada la usa', () => {
    const f = new Date(2026, 8, 1);
    expect(elegirEtapaDesde(cliente({ estado: 'Durante', fechaEstimadaInicio: f }), AHORA)).toEqual({ fecha: f, fuente: 'fechaEstimadaInicio' });
  });
  it('fecha estimada futura o en otro estado → última modificación', () => {
    const futura = new Date(2027, 0, 1);
    expect(elegirEtapaDesde(cliente({ estado: 'Durante', fechaEstimadaInicio: futura }), AHORA).fuente).toBe('actualizadoEn');
    expect(elegirEtapaDesde(cliente({ estado: 'Antes', fechaEstimadaInicio: new Date(2026, 1, 1) }), AHORA).fuente).toBe('actualizadoEn');
  });
  it('sin fechas → fecha de la migración', () => {
    expect(elegirEtapaDesde(cliente({ actualizadoEn: null }), AHORA)).toEqual({ fecha: AHORA, fuente: 'migracion' });
  });
});

describe('documentos', () => {
  it.each([
    ['Contrato firmado', '', 'contrato'],
    ['Otrosí 1', '', 'otrosi'],
    ['Otro si plazo', '', 'otrosi'],
    ['Cotización diseño', '', 'cotizacion'],
    ['Presupuesto', '', 'cotizacion'],
    ['Acta visita', '', 'acta_visita'],
    ['Visita técnica fotos', '', 'acta_visita'],
    ['Informe v2', '', 'informe'],
    ['Dossier final', '', 'dossier'],
    ['', 'https://www.instagram.com/reel/abc/', 'reel'],
    ['Reel lanzamiento', '', 'reel'],
    ['Carpeta', 'https://drive.google.com/x/contrato_pla.pdf', 'contrato'],
    ['Fotos', 'https://drive.google.com/abc', 'otro'],
  ])('"%s" %s → %s', (label, url, tipo) => {
    expect(inferirTipoDocumento(label, url)).toBe(tipo);
  });

  it('infiere versión', () => {
    expect(inferirVersion('Informe v2')).toBe('v2');
    expect(inferirVersion('Informe V 3 final')).toBe('v3');
    expect(inferirVersion('Informe')).toBeUndefined();
  });

  it('asigna etapa por tipo y omite enlaces vacíos', () => {
    const r = mapearCliente(cliente({
      estado: 'Durante',
      documentos: [
        { label: 'Cotización', url: 'https://a' },
        { label: 'Fotos', url: 'https://b' },
        { label: 'Vacío', url: '  ' },
        { label: 'Informe v1', url: 'https://c' },
      ],
    }), ctx());
    expect(r.proyecto.documentos.map(d => [d.tipo, d.etapa, d.version ?? null])).toEqual([
      ['cotizacion', 'propuesta', null],
      ['otro', 'diseno', null],
      ['informe', 'revision', 'v1'],
    ]);
    expect(r.proyecto.documentos.map(d => d.id)).toEqual(['mig-1', 'mig-2', 'mig-3']);
  });
});

describe('plan de servicios', () => {
  const base = [
    { id: 's1', tipo: 'asesoria_online',   nombre: 'Asesoría Online', orden: 1 },
    { id: 's2', tipo: 'asesoria_in_situ',  nombre: 'Asesoría In-Situ', orden: 2 },
    { id: 's3', tipo: 'informe_vision',    nombre: 'Informe de Visión / Conceptual', orden: 3 },
    { id: 's4', tipo: 'fase_ruta1',        nombre: 'Ruta 1', orden: 4 },
    { id: 's5', tipo: 'gran_escala_ruta2', nombre: 'Ruta 2', orden: 5 },
  ];

  it('reutiliza In-Situ, renombra Informe de Visión conservando su id y crea solo lo que falta', () => {
    const p = planServicios(base);
    expect(p.idPorTipo['asesoria_in_situ']).toBe('s2');
    expect(p.idPorTipo['informe_vision']).toBe('s3');
    expect(p.renombrar).toEqual([{ id: 's3', de: 'Informe de Visión / Conceptual', a: 'Diseño conceptual' }]);
    expect(p.crear.map(s => s.tipo)).toEqual(['diseno_tecnico', 'ejecucion', 'acompanamiento', 'taller']);
    expect(p.crear.map(s => s.orden)).toEqual([6, 7, 8, 9]);
    expect(p.idPorTipo['taller']).toBe('nuevo:taller');
  });

  it('es idempotente: con todo creado no hace nada', () => {
    const completo = [
      ...base.map(s => s.id === 's3' ? { ...s, nombre: 'Diseño conceptual' } : s),
      { id: 's6', tipo: 'diseno_tecnico', nombre: 'Diseño técnico', orden: 6 },
      { id: 's7', tipo: 'ejecucion', nombre: 'Ejecución', orden: 7 },
      { id: 's8', tipo: 'acompanamiento', nombre: 'Acompañamiento', orden: 8 },
      { id: 's9', tipo: 'taller', nombre: 'Taller', orden: 9 },
    ];
    const p = planServicios(completo);
    expect(p.crear).toEqual([]);
    expect(p.renombrar).toEqual([]);
  });

  it('avisa de duplicados y usa el de menor orden', () => {
    const p = planServicios([...base, { id: 'dup', tipo: 'asesoria_in_situ', nombre: 'Otra', orden: 0 }]);
    expect(p.idPorTipo['asesoria_in_situ']).toBe('dup');
    expect(p.avisos.length).toBe(1);
  });
});
