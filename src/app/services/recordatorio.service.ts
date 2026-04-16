import { Injectable } from '@angular/core';
import { Cliente } from '../shared/models/cliente.model';

export type EstadoRecordatorio = 'vencido' | 'hoy' | 'pronto' | null;

@Injectable({ providedIn: 'root' })
export class RecordatorioService {

  /**
   * Returns the reminder status for a single client:
   *  - 'vencido'  → past due
   *  - 'hoy'      → due today
   *  - 'pronto'   → due tomorrow
   *  - null       → no active reminder
   */
  getEstado(cliente: Cliente): EstadoRecordatorio {
    const fecha = cliente.recordatorioFecha;
    if (!fecha) return null;

    const ahora = new Date();
    const hoyInicio = this.startOfDay(ahora);
    const hoyFin    = this.endOfDay(ahora);
    const mananaFin = this.endOfDay(this.addDays(ahora, 1));

    if (fecha < hoyInicio) return 'vencido';
    if (fecha <= hoyFin)   return 'hoy';
    if (fecha <= mananaFin) return 'pronto';
    return null;
  }

  /** Returns true when reminder warrants showing the top banner. */
  esBanner(cliente: Cliente): boolean {
    const estado = this.getEstado(cliente);
    return estado === 'vencido' || estado === 'hoy' || estado === 'pronto';
  }

  /** Returns true when reminder warrants showing a card badge. */
  esBadge(cliente: Cliente): boolean {
    return this.getEstado(cliente) !== null;
  }

  /** Filters list to clients that should appear in the banner. */
  getClientesBanner(clientes: Cliente[]): Cliente[] {
    return clientes.filter(c => this.esBanner(c));
  }

  /** Bootstrap badge class for a client's reminder state on the card. */
  badgeClass(cliente: Cliente): string {
    const estado = this.getEstado(cliente);
    if (estado === 'vencido') return 'bg-danger';
    if (estado === 'hoy')     return 'bg-warning text-dark';
    if (estado === 'pronto')  return 'bg-warning text-dark';
    return '';
  }

  /** Icon for reminder badge. */
  badgeIcon(cliente: Cliente): string {
    const estado = this.getEstado(cliente);
    if (estado === 'vencido') return '⚠️';
    if (estado === 'hoy')     return '🔔';
    if (estado === 'pronto')  return '🔔';
    return '';
  }

  /** Human-readable label for banner display. */
  bannerLabel(cliente: Cliente): string {
    const estado = this.getEstado(cliente);
    if (estado === 'vencido') return 'Vencido';
    if (estado === 'hoy')     return 'Hoy';
    if (estado === 'pronto')  return 'Mañana';
    return '';
  }

  private startOfDay(d: Date): Date {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
  }

  private endOfDay(d: Date): Date {
    const r = new Date(d);
    r.setHours(23, 59, 59, 999);
    return r;
  }

  private addDays(d: Date, n: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }
}
