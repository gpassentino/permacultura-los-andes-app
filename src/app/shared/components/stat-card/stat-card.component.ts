import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  imports: [],
  templateUrl: './stat-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatCardComponent {
  readonly label  = input.required<string>();
  readonly value  = input.required<string | number>();
  readonly icon   = input<string>('');
  readonly color  = input<'primary' | 'success' | 'warning' | 'info' | 'danger'>('primary');
  /** Si es true, la tarjeta es un botón y emite `pulsar`. */
  readonly clickable = input(false);
  /** Resalta la tarjeta cuando su filtro está activo. */
  readonly active    = input(false);
  readonly pulsar    = output<void>();
}
