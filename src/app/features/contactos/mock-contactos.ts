import { Contacto, WhatsAppMessage } from '../../shared/models/contacto.model';

const d = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

export const MOCK_CONTACTOS: Contacto[] = [
  {
    id: 'c1',
    name: 'María Fernanda Torres',
    phone: '+573001234567',
    whatsappLabel: 'LD | Paisajismo',
    businessTypes: ['paisajismo'],
    status: 'lead',
    location: { city: 'El Retiro', address: 'Vereda El Chagualo, Km 3' },
    notas: 'Interesada en diseño de jardín regenerativo para finca de 2 hectáreas.',
    kanbanCardId: 'k_mft',
    createdAt: d(30),
    lastMessageAt: d(1),
    lastSyncAt: d(1)
  },
  {
    id: 'c2',
    name: 'Carlos Andrés Restrepo',
    phone: '+573109876543',
    whatsappLabel: 'IN | Academia',
    businessTypes: ['academia'],
    status: 'interesado',
    location: { city: 'Medellín' },
    academiaHistory: {
      completedTalleres: [],
      interestedTalleres: ['t_permacultura_intro'],
      preferredSchedule: 'weekend'
    },
    notas: 'Preguntó por el próximo taller de introducción.',
    createdAt: d(15),
    lastMessageAt: d(2),
    lastSyncAt: d(2)
  },
  {
    id: 'c3',
    name: 'Lucía Gómez Salazar',
    phone: '+573156543210',
    whatsappLabel: 'CL | Paisajismo',
    businessTypes: ['paisajismo', 'academia'],
    status: 'cliente',
    location: { city: 'Rionegro', address: 'Urbanización Los Cedros, Casa 14' },
    kanbanCardId: 'k_lgs',
    academiaHistory: {
      completedTalleres: ['t_permacultura_intro', 't_agua'],
      interestedTalleres: [],
      preferredSchedule: 'weekday'
    },
    notas: 'Cliente recurrente. Proyecto de paisajismo finalizado. Interesada en más talleres.',
    createdAt: d(90),
    lastMessageAt: d(5),
    lastSyncAt: d(5)
  },
  {
    id: 'c4',
    name: 'Plantas y Semillas SAS',
    phone: '+574123456789',
    whatsappLabel: 'Proveedor',
    businessTypes: ['proveedor'],
    status: 'cliente',
    location: { city: 'La Ceja' },
    notas: 'Proveedor de plantas nativas. Contacto: Héctor Ríos.',
    createdAt: d(60),
    lastMessageAt: d(10),
    lastSyncAt: d(10)
  },
  {
    id: 'c5',
    name: 'Andrés Felipe Monsalve',
    phone: '+573204567890',
    whatsappLabel: 'NM',
    businessTypes: ['general'],
    status: 'nuevo_mensaje',
    location: { city: 'Envigado' },
    notas: '',
    createdAt: d(1),
    lastMessageAt: d(0),
    lastSyncAt: d(0)
  },
  {
    id: 'c6',
    name: 'Sofía Herrera',
    phone: '+573301122334',
    whatsappLabel: 'SR | Paisajismo',
    businessTypes: ['paisajismo'],
    status: 'sin_respuesta',
    location: { city: 'Guarne' },
    notas: 'Se envió propuesta hace 3 semanas. Sin respuesta.',
    createdAt: d(45),
    lastMessageAt: d(21),
    lastSyncAt: d(21)
  },
  {
    id: 'c7',
    name: 'Juan Pablo Cardona',
    phone: '+573508877665',
    whatsappLabel: 'IN | Paisajismo',
    businessTypes: ['paisajismo'],
    status: 'interesado',
    location: { city: 'Santa Elena', coordinates: { lat: 6.2143, lng: -75.5012 } },
    notas: 'Quiere presupuesto para jardín de agua. Tiene un lote de 500m².',
    createdAt: d(7),
    lastMessageAt: d(3),
    lastSyncAt: d(3)
  }
];

export const MOCK_MESSAGES: Record<string, WhatsAppMessage[]> = {
  'c1': [
    {
      id: 'm1',
      text: 'Hola! Vi su trabajo en Instagram, me interesa hacer un jardín en mi finca.',
      timestamp: d(30),
      fromContact: true,
      messageType: 'text'
    },
    {
      id: 'm2',
      text: 'Hola María Fernanda! Con gusto le ayudamos. ¿Cuántas hectáreas tiene la finca?',
      timestamp: new Date(d(30).getTime() + 1000 * 60 * 30),
      fromContact: false,
      messageType: 'text'
    },
    {
      id: 'm3',
      text: 'Tenemos 2 hectáreas en El Retiro. Queremos un diseño regenerativo.',
      timestamp: new Date(d(30).getTime() + 1000 * 60 * 60),
      fromContact: true,
      messageType: 'text'
    },
    {
      id: 'm4',
      text: 'Perfecto! Le enviamos una propuesta inicial esta semana.',
      timestamp: d(1),
      fromContact: false,
      messageType: 'text'
    }
  ],
  'c5': [
    {
      id: 'm10',
      text: 'Buenos días! ¿Hacen mantenimiento de jardines?',
      timestamp: d(0),
      fromContact: true,
      messageType: 'text'
    }
  ]
};
