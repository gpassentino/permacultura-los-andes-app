import {
  Component, inject, signal, ChangeDetectionStrategy, OnInit
} from '@angular/core';

import { ServicioService } from '../../services/servicio.service';
import { ServiciosListComponent } from './servicios-list/servicios-list.component';
import { PortafolioListComponent } from './portafolio-list/portafolio-list.component';

type Tab = 'servicios' | 'portafolio';

@Component({
  selector: 'app-servicios',
  imports: [ServiciosListComponent, PortafolioListComponent],
  templateUrl: './servicios.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServiciosComponent implements OnInit {
  private servicioService = inject(ServicioService);

  readonly activeTab = signal<Tab>('servicios');
  readonly seedError = signal<string | null>(null);

  async ngOnInit() {
    try {
      await this.servicioService.seedIfEmpty();
    } catch (err) {
      console.error('No se pudo inicializar catálogo:', err);
      this.seedError.set('No se pudo inicializar el catálogo de servicios. Recarga la página.');
    }
  }
}
