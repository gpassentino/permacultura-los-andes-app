import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, user } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private injector = inject(Injector);

  readonly user$ = user(this.auth);

  async signInWithGoogle(): Promise<{ authorized: boolean }> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(this.auth, provider);
    const email = result.user.email!;

    const authorized = await this.isAuthorized(email);
    if (!authorized) {
      await signOut(this.auth);
      return { authorized: false };
    }

    await this.router.navigate(['/tablero']);
    return { authorized: true };
  }

  async isAuthorized(email: string): Promise<boolean> {
    return runInInjectionContext(this.injector, async () => {
      const docRef = doc(this.firestore, 'usuariosAutorizados', email);
      const snap = await getDoc(docRef);
      return snap.exists();
    });
  }

  async cerrarSesion(): Promise<void> {
    await signOut(this.auth);
    await this.router.navigate(['/login']);
  }
}
