import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

const { mockUser } = vi.hoisted(() => ({
  mockUser: vi.fn(),
}));

vi.mock('@angular/fire/auth', () => ({
  Auth: class {},
  user: (...args: unknown[]) => mockUser(...args),
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class {},
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

describe('authGuard', () => {
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockAuthService: { isAuthorized: ReturnType<typeof vi.fn>; user$: Observable<unknown> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter = { navigate: vi.fn().mockResolvedValue(true) };
    mockAuthService = { isAuthorized: vi.fn(), user$: of(null) };

    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: {} },
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuthService },
      ],
    });
  });

  function runGuard(): Promise<boolean> {
    const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
    return firstValueFrom(result as any);
  }

  it('should redirect to /login when no user', async () => {
    mockUser.mockReturnValue(of(null));
    const allowed = await runGuard();
    expect(allowed).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should redirect to /login when user has no email', async () => {
    mockUser.mockReturnValue(of({ email: null }));
    const allowed = await runGuard();
    expect(allowed).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should redirect to /login when user is not authorized', async () => {
    mockUser.mockReturnValue(of({ email: 'bad@test.com' }));
    mockAuthService.isAuthorized.mockResolvedValue(false);
    const allowed = await runGuard();
    expect(allowed).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should allow access when user is authorized', async () => {
    mockUser.mockReturnValue(of({ email: 'good@test.com' }));
    mockAuthService.isAuthorized.mockResolvedValue(true);
    const allowed = await runGuard();
    expect(allowed).toBe(true);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });
});
