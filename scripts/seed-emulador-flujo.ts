/**
 * Siembra el EMULADOR con datos ficticios que cubren todos los casos de la
 * migración clientes → proyectosFlujo. Se niega a correr contra producción.
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx scripts/seed-emulador-flujo.ts
 */

import { admin, esEmulador, iniciarAdmin } from './lib/admin';

if (!esEmulador()) {
  console.error('ERROR: este script solo corre contra el emulador (define FIRESTORE_EMULATOR_HOST).');
  process.exit(1);
}

const ts = (y: number, m: number, d: number) => admin.firestore.Timestamp.fromDate(new Date(y, m - 1, d));

async function main(): Promise<void> {
  const db = iniciarAdmin();
  const batch = db.batch();

  // Catálogo como el de producción (5 entradas originales)
  const servicios = [
    ['s-online', 'asesoria_online', 'Asesoría Online', 1],
    ['s-insitu', 'asesoria_in_situ', 'Asesoría In-Situ', 2],
    ['s-vision', 'informe_vision', 'Informe de Visión / Conceptual', 3],
    ['s-ruta1', 'fase_ruta1', 'Ruta 1 — Implementación por Fase', 4],
    ['s-ruta2', 'gran_escala_ruta2', 'Ruta 2 — Diseño Gran Escala', 5],
  ] as const;
  for (const [id, tipo, nombre, orden] of servicios) {
    batch.set(db.collection('servicios').doc(id), {
      tipo, nombre, orden, activo: true, descripcion: '', queIncluye: '', queHaceElNegocio: '',
      precio: { modo: 'fijo', valor: 0 }, componentes: [], creadoPor: 'seed',
    });
  }

  const contactos = [
    ['k-ana', 'Ana Restrepo'], ['k-luis', 'Luis Gómez'], ['k-maria', 'María Pérez'], ['k-sofia', 'Sofía Mejía'],
  ];
  for (const [id, name] of contactos) {
    batch.set(db.collection('contacts').doc(id), {
      name, phone: '+573000000000', normalizedPhone: '+573000000000', businessTypes: ['paisajismo'],
      status: 'cliente', location: {}, kanbanCardIds: [],
    });
  }

  const base = {
    municipio: 'El Retiro', whatsapp: '+573000000000', notas: '', documentos: [], checklist: [],
    recordatorioFecha: null, recordatorioMensaje: '', fechaUltimoContacto: null, fechaEstimadaInicio: null,
    creadoPor: 'seed', creadoEn: ts(2026, 1, 10), actualizadoEn: ts(2026, 10, 1),
  };
  const clientes: [string, Record<string, unknown>][] = [
    ['c-antes-conc',  { contactoId: 'k-ana',   nombre: 'Horizontes', estado: 'Antes', categoria: 'Diseño Conceptual',
                        recordatorioFecha: ts(2026, 11, 20), recordatorioMensaje: 'Enviar cotización',
                        documentos: [{ label: 'Cotización v1', url: 'https://drive.google.com/a' }] }],
    ['c-antes-impl',  { contactoId: 'k-ana',   nombre: 'Horizontes obra', estado: 'Antes', categoria: 'Implementación' }],
    ['c-dur-visita',  { contactoId: 'k-luis',  nombre: 'La María · Pereira', estado: 'Durante', categoria: 'Visita Técnica',
                        checklist: [{ texto: 'Tomar fotos', fase: 'durante', completado: true }] }],
    ['c-dur-tec',     { contactoId: 'k-luis',  nombre: 'La María · Pereira', estado: 'Durante', categoria: 'Diseño Técnico',
                        fechaEstimadaInicio: ts(2026, 9, 15),
                        documentos: [{ label: 'Contrato firmado', url: 'https://drive.google.com/b' },
                                     { label: 'Informe v2', url: 'https://drive.google.com/c' }] }],
    ['c-dur-impl',    { contactoId: 'k-maria', nombre: 'Finca Agua Clara', estado: 'Durante', categoria: 'Implementación' }],
    ['c-dur-indef',   { contactoId: 'k-maria', nombre: 'Lote Llanogrande', estado: 'Durante', categoria: 'Indefinido',
                        notas: 'Pidió propuesta de agua' }],
    ['c-desp-impl',   { contactoId: 'k-sofia', nombre: 'Casa Sofía', estado: 'Después', categoria: 'Implementación' }],
    ['c-desp-conc',   { contactoId: 'k-sofia', nombre: 'Casa Sofía diseño', estado: 'Después', categoria: 'Diseño Conceptual',
                        documentos: [{ label: 'Dossier', url: 'https://drive.google.com/d' },
                                     { label: 'Fotos', url: 'https://drive.google.com/e' }] }],
    ['c-comp-impl',   { contactoId: 'k-ana',   nombre: 'Huerta Ana', estado: 'Completo', categoria: 'Implementación' }],
    ['c-comp-otro',   { contactoId: 'k-luis',  nombre: 'Taller Luis', estado: 'Completo', categoria: 'Otro',
                        documentos: [{ label: 'Reel', url: 'https://www.instagram.com/reel/x/' }] }],
    ['c-arch-visita', { contactoId: 'k-maria', nombre: 'Consulta María', estado: 'Archivado', categoria: 'Visita Técnica' }],
    ['c-arch-impl',   { contactoId: 'k-sofia', nombre: 'Jardín viejo', estado: 'Archivado', categoria: 'Implementación' }],
    ['c-sin-contacto',{ contactoId: '', nombre: 'Lead sin contacto', estado: 'Antes', categoria: 'Indefinido', actualizadoEn: null }],
  ];
  for (const [id, data] of clientes) batch.set(db.collection('clientes').doc(id), { ...base, ...data });

  batch.set(db.collection('proyectos').doc('fin-1'), {
    clienteId: 'c-dur-tec', contactoId: 'k-luis', nombreCliente: 'Luis Gómez', categoria: 'Diseño Técnico',
    estadoPago: 'parcialmente_pagado', pagos: [{ id: 'p1', tipo: 'anticipo', monto: 1_000_000, fecha: ts(2026, 9, 15), metodo: 'Transferencia', notas: '' }],
    gastos: [], resumen: { totalFacturado: 2_000_000, totalCobrado: 1_000_000, totalGastos: 0, utilidadBruta: 2_000_000, comisionEsteban: 0, utilidadAndres: 2_000_000 },
  });

  await batch.commit();
  console.log(`Emulador sembrado: ${servicios.length} servicios, ${contactos.length} contactos, ${clientes.length} clientes, 1 proyecto financiero.`);
}

main().catch(err => { console.error(err); process.exit(1); });
