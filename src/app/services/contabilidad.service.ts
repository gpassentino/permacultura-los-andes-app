import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
  getDocs,
} from '@angular/fire/firestore';
import { Observable, from, map } from 'rxjs';
import {
  Proyecto,
  MunicipioViatico,
  Pago,
  Gasto,
  calcularResumen,
  presupuestoVacio,
  TASA_GASOLINA_POR_KM,
} from '../shared/models/proyecto.model';
import { CategoriaCliente } from '../shared/models/cliente.model';

const ACCOUNTING_EMAILS = ['gpassentino@gmail.com', 'anjuarci@gmail.com'];

@Injectable({ providedIn: 'root' })
export class ContabilidadService {
  private firestore = inject(Firestore);

  // ── Authorization check ─────────────────────────────────────
  isAccountingUser(email: string | null | undefined): boolean {
    return !!email && ACCOUNTING_EMAILS.includes(email);
  }

  // ── Proyectos ───────────────────────────────────────────────
  getProyectos(): Observable<Proyecto[]> {
    const ref = query(
      collection(this.firestore, 'proyectos'),
      orderBy('actualizadoEn', 'desc')
    );
    return collectionData(ref, { idField: 'id' }).pipe(
      map(docs => docs.map(d => this.mapProyecto(d as any)))
    );
  }

  getProyecto(id: string): Observable<Proyecto | undefined> {
    const ref = doc(this.firestore, 'proyectos', id);
    return docData(ref, { idField: 'id' }).pipe(
      map(d => d ? this.mapProyecto(d as any) : undefined)
    );
  }

  getProyectoByClienteId(clienteId: string): Observable<Proyecto | undefined> {
    // We query all and filter client-side since there's one proyecto per clienteId
    return this.getProyectos().pipe(
      map(list => list.find(p => p.clienteId === clienteId))
    );
  }

  async crearProyecto(
    clienteId: string,
    contactoId: string,
    nombreCliente: string,
    categoria: CategoriaCliente
  ): Promise<string> {
    const ref = doc(collection(this.firestore, 'proyectos'));
    const now = serverTimestamp();
    const presupuesto = presupuestoVacio(categoria);
    const proyecto: any = {
      clienteId,
      contactoId,
      nombreCliente,
      categoria,
      estadoPago: 'sin_presupuesto',
      presupuesto,
      pagos: [],
      gastos: [],
      resumen: calcularResumen(presupuesto, [], []),
      creadoEn: now,
      actualizadoEn: now,
    };
    await setDoc(ref, proyecto);
    return ref.id;
  }

  async resetearPresupuesto(proyectoId: string, categoria: CategoriaCliente, pagos: Pago[], gastos: Gasto[]): Promise<void> {
    const presupuesto = presupuestoVacio(categoria);
    const resumen = calcularResumen(presupuesto, pagos, gastos);
    await updateDoc(doc(this.firestore, 'proyectos', proyectoId), {
      presupuesto,
      resumen,
      estadoPago: 'sin_presupuesto',
      actualizadoEn: serverTimestamp(),
    });
  }

  async actualizarPresupuesto(proyectoId: string, presupuesto: any, pagos: Pago[], gastos: Gasto[]): Promise<void> {
    const resumen = calcularResumen(presupuesto, pagos, gastos);
    await updateDoc(doc(this.firestore, 'proyectos', proyectoId), {
      presupuesto,
      resumen,
      estadoPago: this.calcularEstadoPago(pagos, resumen.totalFacturado),
      actualizadoEn: serverTimestamp(),
    });
  }

  async agregarPago(proyectoId: string, proyecto: Proyecto, pago: Omit<Pago, 'id'>): Promise<void> {
    const id = doc(collection(this.firestore, '_')).id;
    const pagos = [...proyecto.pagos, { ...pago, id }];
    const resumen = calcularResumen(proyecto.presupuesto, pagos, proyecto.gastos);
    await updateDoc(doc(this.firestore, 'proyectos', proyectoId), {
      pagos,
      resumen,
      estadoPago: this.calcularEstadoPago(pagos, resumen.totalFacturado),
      actualizadoEn: serverTimestamp(),
    });
  }

  async eliminarPago(proyectoId: string, proyecto: Proyecto, pagoId: string): Promise<void> {
    const pagos = proyecto.pagos.filter(p => p.id !== pagoId);
    const resumen = calcularResumen(proyecto.presupuesto, pagos, proyecto.gastos);
    await updateDoc(doc(this.firestore, 'proyectos', proyectoId), {
      pagos,
      resumen,
      estadoPago: this.calcularEstadoPago(pagos, resumen.totalFacturado),
      actualizadoEn: serverTimestamp(),
    });
  }

  async agregarGasto(proyectoId: string, proyecto: Proyecto, gasto: Omit<Gasto, 'id'>): Promise<void> {
    const id = doc(collection(this.firestore, '_')).id;
    const gastos = [...proyecto.gastos, { ...gasto, id }];
    const resumen = calcularResumen(proyecto.presupuesto, proyecto.pagos, gastos);
    await updateDoc(doc(this.firestore, 'proyectos', proyectoId), {
      gastos,
      resumen,
      actualizadoEn: serverTimestamp(),
    });
  }

  async eliminarGasto(proyectoId: string, proyecto: Proyecto, gastoId: string): Promise<void> {
    const gastos = proyecto.gastos.filter(g => g.id !== gastoId);
    const resumen = calcularResumen(proyecto.presupuesto, proyecto.pagos, gastos);
    await updateDoc(doc(this.firestore, 'proyectos', proyectoId), {
      gastos,
      resumen,
      actualizadoEn: serverTimestamp(),
    });
  }

  private calcularEstadoPago(pagos: Pago[], totalFacturado: number): string {
    if (totalFacturado === 0) return 'sin_presupuesto';
    const cobrado = pagos.reduce((s, p) => s + p.monto, 0);
    if (cobrado <= 0) return 'presupuestado';
    if (cobrado >= totalFacturado) return 'pagado';
    return 'parcialmente_pagado';
  }

  // ── Municipios Viáticos ─────────────────────────────────────
  getMunicipios(): Observable<MunicipioViatico[]> {
    const ref = query(
      collection(this.firestore, 'municipiosViaticos'),
      orderBy('orden', 'asc')
    );
    return collectionData(ref, { idField: 'id' }) as Observable<MunicipioViatico[]>;
  }

  async actualizarMunicipio(municipio: MunicipioViatico): Promise<void> {
    const ref = doc(this.firestore, 'municipiosViaticos', municipio.id!);
    await updateDoc(ref, { ...municipio });
  }

  async seedMunicipiosIfEmpty(): Promise<void> {
    const ref = collection(this.firestore, 'municipiosViaticos');
    const snap = await getDocs(ref);
    if (!snap.empty) return;

    const seed: Omit<MunicipioViatico, 'id'>[] = [
      { nombre: 'Retiro',             kmIdaVuelta: 10,  numPeajesIdaVuelta: 0, costoPeajesTotalRT: 0,      tasaGasolinaPorKm: TASA_GASOLINA_POR_KM, gastoGasolina: 12_000,  total: 12_000,  orden: 1 },
      { nombre: 'Llanogrande',        kmIdaVuelta: 15,  numPeajesIdaVuelta: 0, costoPeajesTotalRT: 0,      tasaGasolinaPorKm: TASA_GASOLINA_POR_KM, gastoGasolina: 18_000,  total: 18_000,  orden: 2 },
      { nombre: 'Rionegro',           kmIdaVuelta: 20,  numPeajesIdaVuelta: 0, costoPeajesTotalRT: 0,      tasaGasolinaPorKm: TASA_GASOLINA_POR_KM, gastoGasolina: 24_000,  total: 24_000,  orden: 3 },
      { nombre: 'La Ceja',            kmIdaVuelta: 20,  numPeajesIdaVuelta: 0, costoPeajesTotalRT: 0,      tasaGasolinaPorKm: TASA_GASOLINA_POR_KM, gastoGasolina: 24_000,  total: 24_000,  orden: 4 },
      { nombre: 'Carmen de Víboral',  kmIdaVuelta: 45,  numPeajesIdaVuelta: 0, costoPeajesTotalRT: 0,      tasaGasolinaPorKm: TASA_GASOLINA_POR_KM, gastoGasolina: 54_000,  total: 54_000,  orden: 5 },
      { nombre: 'Santa Elena',        kmIdaVuelta: 50,  numPeajesIdaVuelta: 2, costoPeajesTotalRT: 27_000, tasaGasolinaPorKm: TASA_GASOLINA_POR_KM, gastoGasolina: 60_000,  total: 87_000,  orden: 6 },
      { nombre: 'Barbosa',            kmIdaVuelta: 80,  numPeajesIdaVuelta: 4, costoPeajesTotalRT: 67_600, tasaGasolinaPorKm: TASA_GASOLINA_POR_KM, gastoGasolina: 96_000,  total: 163_600, orden: 7 },
      { nombre: 'Fredonia',           kmIdaVuelta: 80,  numPeajesIdaVuelta: 4, costoPeajesTotalRT: 68_200, tasaGasolinaPorKm: TASA_GASOLINA_POR_KM, gastoGasolina: 96_000,  total: 164_200, orden: 8 },
      { nombre: 'Caldas',             kmIdaVuelta: 60,  numPeajesIdaVuelta: 4, costoPeajesTotalRT: 68_200, tasaGasolinaPorKm: TASA_GASOLINA_POR_KM, gastoGasolina: 72_000,  total: 140_200, orden: 9 },
    ];

    const batch = writeBatch(this.firestore);
    seed.forEach(m => {
      const d = doc(collection(this.firestore, 'municipiosViaticos'));
      batch.set(d, m);
    });
    await batch.commit();
  }

  // ── Firestore mapping helpers ───────────────────────────────
  private mapProyecto(raw: any): Proyecto {
    return {
      ...raw,
      creadoEn: raw.creadoEn instanceof Timestamp ? raw.creadoEn.toDate() : new Date(raw.creadoEn ?? Date.now()),
      actualizadoEn: raw.actualizadoEn instanceof Timestamp ? raw.actualizadoEn.toDate() : new Date(raw.actualizadoEn ?? Date.now()),
      pagos: (raw.pagos ?? []).map((p: any) => ({
        ...p,
        fecha: p.fecha instanceof Timestamp ? p.fecha.toDate() : (p.fecha ? new Date(p.fecha) : null),
      })),
    };
  }
}
