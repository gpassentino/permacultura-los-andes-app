import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, user } from '@angular/fire/auth';
import { take, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  const authService = inject(AuthService);

  return user(auth).pipe(
    take(1),
    switchMap(async (u) => {
      if (!u?.email) {
        await router.navigate(['/login']);
        return false;
      }
      const authorized = await authService.isAuthorized(u.email);
      if (!authorized) {
        await router.navigate(['/login']);
        return false;
      }
      return true;
    })
  );
};
