import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  CdkDragDrop, CdkDropList, CdkDrag,
  CdkDragPlaceholder, CdkDropListGroup
} from '@angular/cdk/drag-drop';
import { ClienteService } from '../../services/cliente.service';
import { Cliente, EstadoCliente, ESTADOS_CLIENTE } from '../../shared/models/cliente.model';
import { ClienteCardComponent } from './cliente-card/cliente-card.component';
import { ClienteModalComponent } from './cliente-modal/cliente-modal.component';

@Component({
  selector: 'app-tablero',
  imports: [
    CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder,
    ClienteCardComponent, ClienteModalComponent
  ],
  templateUrl: './tablero.component.html',
  styleUrl: './tablero.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableroComponent {
  private clienteService = inject(ClienteService);

  readonly columnas = ESTADOS_CLIENTE;
  private readonly clientesRaw = toSignal(this.clienteService.getClientes());
  readonly loading = computed(() => this.clientesRaw() === undefined);
  readonly clientes = computed(() => this.clientesRaw() ?? []);
  readonly columnaActiva = signal<EstadoCliente>('Contacto Inicial');
  readonly selectedCliente = signal<Cliente | null>(null);
  readonly showModal = signal(false);
  readonly error = signal<string | null>(null);

  readonly recordatoriosPendientes = computed(() => {
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    return this.clientes().filter(c => c.recordatorioFecha && c.recordatorioFecha <= hoy);
  });

  readonly clientesPorColumna = computed(() => {
    const map = new Map<EstadoCliente, Cliente[]>();
    for (const col of ESTADOS_CLIENTE) {
      map.set(col, []);
    }
    for (const c of this.clientes()) {
      map.get(c.estado)?.push(c);
    }
    return map;
  });

  openModal(cliente?: Cliente): void {
    this.selectedCliente.set(cliente ?? null);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.selectedCliente.set(null);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.closeModal();
    }
  }

  onDrop(event: CdkDragDrop<EstadoCliente>): void {
    if (event.previousContainer === event.container) return;
    const cliente: Cliente = event.item.data;
    const nuevoEstado: EstadoCliente = event.container.data;
    if (cliente.id) {
      this.clienteService.updateCliente(cliente.id, { estado: nuevoEstado }).catch(() => {
        this.error.set('Error al mover el cliente. Intente de nuevo.');
      });
    }
  }

  async onGuardar(event: { data: Partial<Cliente>; id?: string }): Promise<void> {
    try {
      this.error.set(null);
      if (event.id) {
        await this.clienteService.updateCliente(event.id, event.data);
      } else {
        await this.clienteService.addCliente(event.data);
      }
      this.closeModal();
    } catch {
      this.error.set('Error al guardar. Intente de nuevo.');
    }
  }

  async onEliminar(id: string): Promise<void> {
    try {
      this.error.set(null);
      await this.clienteService.deleteCliente(id);
      this.closeModal();
    } catch {
      this.error.set('Error al eliminar. Intente de nuevo.');
    }
  }
}
