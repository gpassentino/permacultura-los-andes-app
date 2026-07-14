import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, user } from '@angular/fire/auth';
import { take, switchMap } from 'rxjs';
import { ContabilidadService } from '../../services/contabilidad.service';

export const accountingGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  const contabilidadService = inject(ContabilidadService);

  return user(auth).pipe(
    take(1),
    switchMap(async (u) => {
      if (!u?.email || !contabilidadService.isAccountingUser(u.email)) {
        await router.navigate(['/tablero']);
        return false;
      }
      return true;
    })
  );
};
