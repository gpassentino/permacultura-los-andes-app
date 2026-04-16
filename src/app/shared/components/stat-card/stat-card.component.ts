import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  imports: [],
  templateUrl: './stat-card.component.html',
  styleUrl: './stat-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatCardComponent {
  readonly label  = input.required<string>();
  readonly value  = input.required<string | number>();
  readonly icon   = input<string>('');
  readonly color  = input<'primary' | 'success' | 'warning' | 'info'>('primary');
}
