import { Contacto } from '../../shared/models/contacto.model';

const d = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

export const MOCK_CONTACTOS: Contacto[] = [
  {
    id: 'c1',
    name: 'María Fernanda Torres',
    phone: '+573001234567',
    normalizedPhone: '+573001234567',
    businessTypes: ['paisajismo'],
    status: 'lead',
    location: { city: 'El Retiro', address: 'Vereda El Chagualo, Km 3' },
    notas: 'Interesada en diseño de jardín regenerativo para finca de 2 hectáreas.',
    kanbanCardIds: ['k_mft'],
    createdAt: d(30)
  },
  {
    id: 'c2',
    name: 'Carlos Andrés Restrepo',
    phone: '+573109876543',
    normalizedPhone: '+573109876543',
    businessTypes: ['academia'],
    status: 'interesado',
    location: { city: 'Medellín' },
    kanbanCardIds: [],
    academiaHistory: {
      completedTalleres: [],
      interestedTalleres: ['t_permacultura_intro'],
      preferredSchedule: 'weekend'
    },
    notas: 'Preguntó por el próximo taller de introducción.',
    createdAt: d(15)
  },
  {
    id: 'c3',
    name: 'Lucía Gómez Salazar',
    phone: '+573156543210',
    normalizedPhone: '+573156543210',
    businessTypes: ['paisajismo', 'academia'],
    status: 'cliente',
    location: { city: 'Rionegro', address: 'Urbanización Los Cedros, Casa 14' },
    kanbanCardIds: ['k_lgs'],
    academiaHistory: {
      completedTalleres: ['t_permacultura_intro', 't_agua'],
      interestedTalleres: [],
      preferredSchedule: 'weekday'
    },
    notas: 'Cliente recurrente. Proyecto de paisajismo finalizado. Interesada en más talleres.',
    createdAt: d(90)
  },
  {
    id: 'c4',
    name: 'Plantas y Semillas SAS',
    phone: '+574123456789',
    normalizedPhone: '+574123456789',
    businessTypes: ['proveedor'],
    status: 'cliente',
    location: { city: 'La Ceja' },
    kanbanCardIds: [],
    notas: 'Proveedor de plantas nativas. Contacto: Héctor Ríos.',
    createdAt: d(60)
  },
  {
    id: 'c5',
    name: 'Andrés Felipe Monsalve',
    phone: '+573204567890',
    normalizedPhone: '+573204567890',
    businessTypes: ['general'],
    status: 'interesado',
    location: { city: 'Envigado' },
    kanbanCardIds: [],
    notas: '',
    createdAt: d(1)
  },
  {
    id: 'c6',
    name: 'Sofía Herrera',
    phone: '+573301122334',
    normalizedPhone: '+573301122334',
    businessTypes: ['paisajismo'],
    status: 'sin_respuesta',
    location: { city: 'Guarne' },
    kanbanCardIds: [],
    notas: 'Se envió propuesta hace 3 semanas. Sin respuesta.',
    createdAt: d(45)
  },
  {
    id: 'c7',
    name: 'Juan Pablo Cardona',
    phone: '+573508877665',
    normalizedPhone: '+573508877665',
    businessTypes: ['paisajismo'],
    status: 'interesado',
    location: { city: 'Santa Elena', coordinates: { lat: 6.2143, lng: -75.5012 } },
    kanbanCardIds: [],
    notas: 'Quiere presupuesto para jardín de agua. Tiene un lote de 500m².',
    createdAt: d(7)
  }
];
