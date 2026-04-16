import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { AuthService } from './auth.service';

const { mockSignInWithPopup, mockSignOut, mockUser, mockDoc, mockGetDoc } = vi.hoisted(() => ({
  mockSignInWithPopup: vi.fn(),
  mockSignOut: vi.fn(),
  mockUser: vi.fn(),
  mockDoc: vi.fn(),
  mockGetDoc: vi.fn(),
}));

vi.mock('@angular/fire/auth', () => ({
  Auth: class {},
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  user: (...args: unknown[]) => mockUser(...args),
  GoogleAuthProvider: class {},
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class {},
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

describe('AuthService', () => {
  let service: AuthService;
  let router: Router;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.mockReturnValue(of(null));
    mockSignOut.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
      ],
    });
    service = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('signInWithGoogle', () => {
    it('should navigate to /tablero when user is authorized', async () => {
      mockSignInWithPopup.mockResolvedValue({ user: { email: 'test@test.com' } });
      mockGetDoc.mockResolvedValue({ exists: () => true });

      const result = await service.signInWithGoogle();

      expect(result).toEqual({ authorized: true });
      expect(router.navigate).toHaveBeenCalledWith(['/tablero']);
    });

    it('should sign out and return unauthorized when user is not authorized', async () => {
      mockSignInWithPopup.mockResolvedValue({ user: { email: 'bad@test.com' } });
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await service.signInWithGoogle();

      expect(result).toEqual({ authorized: false });
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('isAuthorized', () => {
    it('should return true when document exists', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => true });
      expect(await service.isAuthorized('test@test.com')).toBe(true);
    });

    it('should return false when document does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      expect(await service.isAuthorized('nope@test.com')).toBe(false);
    });
  });

  describe('cerrarSesion', () => {
    it('should sign out and navigate to /login', async () => {
      await service.cerrarSesion();
      expect(mockSignOut).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
  });
});
