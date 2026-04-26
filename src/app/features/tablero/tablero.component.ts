import { Component, inject, signal, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  CdkDragDrop, CdkDropList, CdkDrag,
  CdkDragPlaceholder, CdkDropListGroup
} from '@angular/cdk/drag-drop';
import { ClienteService } from '../../services/cliente.service';
import { RecordatorioService } from '../../services/recordatorio.service';
import { Cliente, EstadoCliente, ESTADOS_CLIENTE } from '../../shared/models/cliente.model';
import { ClienteCardComponent } from '../../shared/components/cliente-card/cliente-card.component';
import { ClienteModalComponent } from './cliente-modal/cliente-modal.component';

@Component({
  selector: 'app-tablero',
  imports: [
    CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder,
    ClienteCardComponent, ClienteModalComponent
  ],
  templateUrl: './tablero.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableroComponent {
  private clienteService      = inject(ClienteService);
  private route               = inject(ActivatedRoute);
  readonly recordatorioService = inject(RecordatorioService);

  readonly columnas = ESTADOS_CLIENTE;

  private readonly clientesRaw = toSignal(this.clienteService.getClientes());
  private readonly queryParams = toSignal(this.route.queryParamMap);

  readonly loading  = computed(() => this.clientesRaw() === undefined);
  readonly clientes = computed(() => this.clientesRaw() ?? []);

  // Auto-open the modal for ?clienteId=xxx (deeplink from contact detail).
  // Fires once per navigation when both the data and the param are ready.
  private readonly autoOpenedFor = signal<string | null>(null);
  private readonly autoOpenEffect = effect(() => {
    const id = this.queryParams()?.get('clienteId');
    if (!id) { this.autoOpenedFor.set(null); return; }
    if (this.autoOpenedFor() === id) return;
    const cliente = this.clientes().find(c => c.id === id);
    if (cliente) {
      this.autoOpenedFor.set(id);
      this.openModal(cliente);
    }
  });

  readonly columnaActiva   = signal<EstadoCliente>('Contacto Inicial');
  readonly selectedCliente = signal<Cliente | null>(null);
  readonly showModal       = signal(false);
  readonly error           = signal<string | null>(null);

  // CDK touch drag: long-press delay before drag starts (ms)
  readonly touchDelay = 500;

  /** Clients with reminders: overdue, today, or tomorrow — shown in top banner */
  readonly recordatoriosBanner = computed(() =>
    this.recordatorioService.getClientesBanner(this.clientes())
  );

  readonly clientesPorColumna = computed(() => {
    const map = new Map<EstadoCliente, Cliente[]>();
    for (const col of ESTADOS_CLIENTE) map.set(col, []);
    for (const c of this.clientes()) map.get(c.estado)?.push(c);
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
