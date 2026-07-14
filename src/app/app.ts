import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from './features/auth/auth.service';
import { ContabilidadService } from './services/contabilidad.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  protected readonly authService          = inject(AuthService);
  private readonly contabilidadService    = inject(ContabilidadService);
  protected readonly user                 = toSignal(this.authService.user$);
  protected readonly esContabilidad       = computed(() =>
    this.contabilidadService.isAccountingUser(this.user()?.email)
  );
}
