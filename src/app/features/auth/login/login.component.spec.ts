import { TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { AuthService } from '../auth.service';

describe('LoginComponent', () => {
  let mockAuthService: { signInWithGoogle: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockAuthService = { signInWithGoogle: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should set loading during sign in', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;

    let resolveSignIn!: (v: { authorized: boolean }) => void;
    mockAuthService.signInWithGoogle.mockReturnValue(
      new Promise(resolve => { resolveSignIn = resolve; })
    );

    const promise = component.signIn();
    expect(component.loading()).toBe(true);

    resolveSignIn({ authorized: true });
    await promise;
    expect(component.loading()).toBe(false);
  });

  it('should set error when user is not authorized', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;

    mockAuthService.signInWithGoogle.mockResolvedValue({ authorized: false });
    await component.signIn();

    expect(component.error()).toBe('Acceso no autorizado. Comuníquese con el administrador.');
  });

  it('should set generic error on exception', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;

    mockAuthService.signInWithGoogle.mockRejectedValue(new Error('Network error'));
    await component.signIn();

    expect(component.error()).toBe('Error al iniciar sesión. Por favor intente de nuevo.');
    expect(component.loading()).toBe(false);
  });

  it('should clear previous error on new sign in attempt', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;

    mockAuthService.signInWithGoogle.mockResolvedValue({ authorized: true });
    component['error'].set('old error');

    await component.signIn();
    expect(component.error()).toBeNull();
  });
});
