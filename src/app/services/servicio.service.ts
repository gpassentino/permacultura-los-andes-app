import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore, collection, collectionData, docData,
  addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy, where, getDocs, limit, writeBatch
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, map } from 'rxjs';
import {
  Servicio, FirestoreServicio, TipoServicio, PrecioServicio,
} from '../shared/models/servicio.model';

const SEED_SERVICIOS: Omit<Servicio, 'id' | 'creadoEn' | 'actualizadoEn' | 'creadoPor'>[] = [
  {
    tipo: 'asesoria_online',
    nombre: 'Asesoría Online',
    descripcion: 'Consulta rápida por videollamada para resolver dudas puntuales sobre tu proyecto. Ideal para clientes fuera de Antioquia.',
    queIncluye: '• Videollamada de hasta 1 hora con Andrés\n• Recomendaciones técnicas iniciales\n• Orientación sobre próximos pasos',
    queHaceElNegocio: 'Preparar revisión de fotos/planos enviados por el cliente antes de la llamada. Tomar notas durante la sesión y enviar resumen por WhatsApp.',
    precio: { modo: 'fijo', valor: 300_000 },
    componentes: [],
    activo: true,
    orden: 1,
  },
  {
    tipo: 'asesoria_in_situ',
    nombre: 'Asesoría In-Situ',
    descripcion: 'Recorrido de medio día por tu terreno con Andrés. Para clientes dentro de Antioquia que necesitan una primera lectura del lugar.',
    queIncluye: '• Visita de medio día al terreno\n• Lectura del sitio: agua, suelos, vegetación, microclimas\n• Recomendaciones iniciales en campo\n• Resumen por WhatsApp posterior',
    queHaceElNegocio: 'Agendar día/hora con cliente. Llevar metro, cámara, GPS. Tomar fotos y notas en campo. Coordinar transporte.',
    precio: { modo: 'fijo', valor: 500_000 },
    componentes: [],
    activo: true,
    orden: 2,
  },
  {
    tipo: 'informe_vision',
    nombre: 'Informe de Visión / Conceptual',
    descripcion: 'Entregable maestro que reciben todos los clientes después de la asesoría inicial. Define la visión integral del proyecto y la hoja de ruta por fases.',
    queIncluye: '• Análisis técnico: hidrología, zonificación, estratificación (bosque comestible), suelos, interconexión de ideas\n• Hoja de ruta: definición de fases y etapas de desarrollo\n• Documento entregable que sirve como base para siguientes etapas',
    queHaceElNegocio: 'Sintetizar hallazgos de la asesoría. Estructurar narrativa del proyecto. Definir orden lógico de fases para ejecución escalonada.',
    precio: { modo: 'rango', min: 500_000, max: 700_000 },
    componentes: [],
    activo: true,
    orden: 3,
  },
  {
    tipo: 'fase_ruta1',
    nombre: 'Ruta 1 — Implementación por Fase',
    descripcion: 'Para clientes pequeños/medianos (fincas, hogares). Ejecución escalonada paso a paso. El diseño detallado se incluye en el presupuesto de cada fase. Pago: 50% anticipo por fase aceptada.',
    queIncluye: '• Informe presupuestal detallado de la fase\n• Diseño detallado de la fase\n• Dirección de obra\n• Ejecución (obra)',
    queHaceElNegocio: 'Levantar presupuesto desglosado por los 5 rubros (Diseño, Dirección de Obra, Mano de Obra, Insumos, Logística). Coordinar jardineros, proveedores y transportes. Supervisar ejecución en campo.',
    precio: { modo: 'rango', min: 0, max: 0 },
    componentes: [],
    activo: true,
    orden: 4,
  },
  {
    tipo: 'gran_escala_ruta2',
    nombre: 'Ruta 2 — Diseño Gran Escala',
    descripcion: 'Para grandes lotes, parques y parcelaciones comerciales. Enfoque en precisión técnica y cumplimiento normativo. Tarifa: $5.000 COP/m².',
    queIncluye: '• Planos técnicos ejecutivos\n• Levantamiento topográfico\n• Trabajo coordinado con dibujantes profesionales\n• Cronograma de obra de largo aliento\n• Presupuesto global del proyecto',
    queHaceElNegocio: 'Coordinar con Sofi (dibujante) y equipo técnico. Procesar datos topográficos. Producir planos ejecutivos. Estructurar cronograma extenso.',
    precio: { modo: 'por_m2', valorPorM2: 5_000 },
    componentes: [],
    activo: true,
    orden: 5,
  },
];

@Injectable({ providedIn: 'root' })
export class ServicioService {
  private firestore = inject(Firestore);
  private auth      = inject(Auth);
  private injector  = inject(Injector);

  private col = collection(this.firestore, 'servicios');

  getServicios(): Observable<Servicio[]> {
    const q = query(this.col, orderBy('orden', 'asc'));
    return collectionData(q, { idField: 'id' }).pipe(
      map(docs => (docs as FirestoreServicio[]).map(d => this.fromFirestore(d)))
    );
  }

  getServicio(id: string): Observable<Servicio | undefined> {
    return docData(doc(this.firestore, 'servicios', id), { idField: 'id' }).pipe(
      map(d => d ? this.fromFirestore(d as FirestoreServicio) : undefined)
    );
  }

  async addServicio(data: Partial<Servicio>): Promise<string> {
    const email = this.auth.currentUser?.email ?? '';
    const ref = await runInInjectionContext(this.injector, () =>
      addDoc(this.col, {
        ...this.toFirestore(data),
        creadoPor:     email,
        creadoEn:      serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      })
    );
    return ref.id;
  }

  async updateServicio(id: string, updates: Partial<Servicio>): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'servicios', id), {
        ...this.toFirestore(updates),
        actualizadoEn: serverTimestamp(),
      })
    );
  }

  async deleteServicio(id: string): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      deleteDoc(doc(this.firestore, 'servicios', id))
    );
  }

  async seedIfEmpty(): Promise<void> {
    const result = await runInInjectionContext(this.injector, () =>
      getDocs(query(this.col, limit(1)))
    );
    if (!result.empty) return;

    const email = this.auth.currentUser?.email ?? '';
    await runInInjectionContext(this.injector, async () => {
      const batch = writeBatch(this.firestore);
      for (const seed of SEED_SERVICIOS) {
        const ref = doc(this.col);
        batch.set(ref, {
          ...seed,
          creadoPor:     email,
          creadoEn:      serverTimestamp(),
          actualizadoEn: serverTimestamp(),
        });
      }
      await batch.commit();
    });
  }

  private fromFirestore(d: FirestoreServicio): Servicio {
    return {
      id:               d.id,
      tipo:             d.tipo,
      nombre:           d.nombre,
      descripcion:      d.descripcion ?? '',
      queIncluye:       d.queIncluye ?? '',
      queHaceElNegocio: d.queHaceElNegocio ?? '',
      precio:           d.precio,
      componentes:      d.componentes ?? [],
      activo:           d.activo,
      orden:            d.orden ?? 0,
      creadoEn:         d.creadoEn?.toDate() ?? new Date(),
      actualizadoEn:    d.actualizadoEn?.toDate() ?? new Date(),
      creadoPor:        d.creadoPor ?? '',
    };
  }

  private toFirestore(s: Partial<Servicio>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (s.tipo !== undefined)             out['tipo']             = s.tipo;
    if (s.nombre !== undefined)           out['nombre']           = s.nombre;
    if (s.descripcion !== undefined)      out['descripcion']      = s.descripcion;
    if (s.queIncluye !== undefined)       out['queIncluye']       = s.queIncluye;
    if (s.queHaceElNegocio !== undefined) out['queHaceElNegocio'] = s.queHaceElNegocio;
    if (s.precio !== undefined)           out['precio']           = s.precio;
    if (s.componentes !== undefined)      out['componentes']      = s.componentes;
    if (s.activo !== undefined)           out['activo']           = s.activo;
    if (s.orden !== undefined)            out['orden']            = s.orden;
    return out;
  }
}
