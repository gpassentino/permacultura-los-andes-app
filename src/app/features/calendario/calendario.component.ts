import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { fromEvent } from 'rxjs';

const CALENDAR_ID = 'institutopermaculturalosandes@gmail.com';
const TIMEZONE = 'America/Bogota';
const MOBILE_BREAKPOINT = 768;

type CalendarMode = 'AGENDA' | 'WEEK' | 'MONTH';

@Component({
  selector: 'app-calendario',
  templateUrl: './calendario.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarioComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  private readonly viewportWidth = signal(
    typeof window === 'undefined' ? 1024 : window.innerWidth
  );

  readonly isMobile = computed(() => this.viewportWidth() < MOBILE_BREAKPOINT);

  readonly mode = signal<CalendarMode | null>(null);

  private readonly effectiveMode = computed<CalendarMode>(() => {
    const override = this.mode();
    if (override) return override;
    return this.isMobile() ? 'AGENDA' : 'WEEK';
  });

  readonly embedUrl = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.buildUrl(this.effectiveMode()))
  );

  readonly openInGoogleUrl = computed(() =>
    `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(CALENDAR_ID)}`
  );

  constructor() {
    if (typeof window !== 'undefined') {
      fromEvent(window, 'resize')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.viewportWidth.set(window.innerWidth));
    }
  }

  setMode(mode: CalendarMode): void {
    this.mode.set(mode);
  }

  private buildUrl(mode: CalendarMode): string {
    const params = new URLSearchParams({
      src: CALENDAR_ID,
      ctz: TIMEZONE,
      hl: 'es',
      mode,
      showTitle: '0',
      showPrint: '0',
      showCalendars: '0',
      showTabs: '1',
      showTz: '0'
    });
    return `https://calendar.google.com/calendar/embed?${params.toString()}`;
  }
}
