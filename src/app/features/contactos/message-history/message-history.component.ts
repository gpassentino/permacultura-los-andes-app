import {
  Component, inject, input, signal, computed, ChangeDetectionStrategy
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

import { ContactoService } from '../../../services/contacto.service';
import { WhatsAppMessage } from '../../../shared/models/contacto.model';

@Component({
  selector: 'app-message-history',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './message-history.component.html',
  styleUrl: './message-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageHistoryComponent {
  private contactoService = inject(ContactoService);

  readonly contactId = input.required<string>();

  private readonly messagesRaw = toSignal(
    toObservable(this.contactId).pipe(
      switchMap(id => this.contactoService.getMessages(id))
    )
  );

  readonly loading  = computed(() => this.messagesRaw() === undefined);
  readonly messages = computed(() => this.messagesRaw() ?? []);

  // ── Reply form ───────────────────────────────────────────────────────────────
  readonly replyText = new FormControl('', [Validators.required, Validators.minLength(1)]);
  readonly sending   = signal(false);
  readonly sendError = signal<string | null>(null);

  async sendReply(): Promise<void> {
    const text = this.replyText.value?.trim();
    if (!text || this.sending()) return;
    this.sending.set(true);
    this.sendError.set(null);
    try {
      await this.contactoService.addMessage(this.contactId(), {
        text,
        fromContact: false,
        messageType: 'text'
      });
      this.replyText.reset();
    } catch {
      this.sendError.set('Error al guardar el mensaje.');
    } finally {
      this.sending.set(false);
    }
  }

  // ── Display helpers ──────────────────────────────────────────────────────────

  messageTypeIcon(msg: WhatsAppMessage): string {
    const icons: Record<string, string> = {
      text:     '',
      image:    '🖼️',
      location: '📍',
      document: '📄'
    };
    return icons[msg.messageType] ?? '';
  }

  isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth()    === b.getMonth()    &&
           a.getDate()     === b.getDate();
  }

  showDateDivider(messages: WhatsAppMessage[], index: number): boolean {
    if (index === 0) return true;
    return !this.isSameDay(messages[index - 1].timestamp, messages[index].timestamp);
  }
}
