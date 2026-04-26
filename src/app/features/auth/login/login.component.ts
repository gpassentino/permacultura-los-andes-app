import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private authService = inject(AuthService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async signIn(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.authService.signInWithGoogle();
      if (!result.authorized) {
        this.error.set('Acceso no autorizado. Comuníquese con el administrador.');
      }
    } catch {
      this.error.set('Error al iniciar sesión. Por favor intente de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
