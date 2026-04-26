import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, LOCALE_ID, signal } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';
import { BehaviorSubject } from 'rxjs';

import { MessageHistoryComponent } from './message-history.component';
import { ContactoService } from '../../../services/contacto.service';
import { WhatsAppMessage } from '../../../shared/models/contacto.model';

registerLocaleData(localeEsCO);

function makeMsg(overrides: Partial<WhatsAppMessage> = {}): WhatsAppMessage {
  return {
    id: 'm1',
    text: 'Hola',
    timestamp: new Date(2026, 3, 26, 10, 0, 0),
    fromContact: true,
    messageType: 'text',
    ...overrides,
  };
}

@Component({
  imports: [MessageHistoryComponent],
  template: `<app-message-history [contactId]="contactId()" />`,
})
class TestHost {
  contactId = signal('c1');
}

describe('MessageHistoryComponent', () => {
  let messagesSubject: BehaviorSubject<WhatsAppMessage[]>;
  let mockService: {
    getMessages: ReturnType<typeof vi.fn>;
    addMessage: ReturnType<typeof vi.fn>;
  };
  let fixture: ComponentFixture<TestHost>;

  function getComponent(): MessageHistoryComponent {
    return fixture.debugElement.children[0].componentInstance as MessageHistoryComponent;
  }

  beforeEach(async () => {
    messagesSubject = new BehaviorSubject<WhatsAppMessage[]>([]);
    mockService = {
      getMessages: vi.fn().mockReturnValue(messagesSubject),
      addMessage: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [TestHost],
      providers: [
        { provide: ContactoService, useValue: mockService },
        { provide: LOCALE_ID, useValue: 'es-CO' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  describe('loading', () => {
    it('is false once messages arrive', () => {
      const c = getComponent();
      expect(c.loading()).toBe(false);
    });
  });

  describe('messages stream', () => {
    it('subscribes with the provided contactId', () => {
      expect(mockService.getMessages).toHaveBeenCalledWith('c1');
    });

    it('exposes the latest emission', () => {
      messagesSubject.next([makeMsg({ id: 'a' }), makeMsg({ id: 'b' })]);
      fixture.detectChanges();
      const c = getComponent();
      expect(c.messages().length).toBe(2);
    });
  });

  describe('isSameDay', () => {
    it('returns true for two times on the same calendar day', () => {
      const c = getComponent();
      const a = new Date(2026, 3, 26, 9, 0);
      const b = new Date(2026, 3, 26, 22, 0);
      expect(c.isSameDay(a, b)).toBe(true);
    });

    it('returns false across midnight boundary', () => {
      const c = getComponent();
      const a = new Date(2026, 3, 26, 23, 59);
      const b = new Date(2026, 3, 27, 0, 1);
      expect(c.isSameDay(a, b)).toBe(false);
    });

    it('returns false for different months', () => {
      const c = getComponent();
      const a = new Date(2026, 2, 26);
      const b = new Date(2026, 3, 26);
      expect(c.isSameDay(a, b)).toBe(false);
    });
  });

  describe('showDateDivider', () => {
    it('always shows for index 0', () => {
      const c = getComponent();
      const msgs = [makeMsg(), makeMsg()];
      expect(c.showDateDivider(msgs, 0)).toBe(true);
    });

    it('hides for messages on the same day as the previous', () => {
      const c = getComponent();
      const msgs = [
        makeMsg({ timestamp: new Date(2026, 3, 26, 9, 0) }),
        makeMsg({ timestamp: new Date(2026, 3, 26, 14, 0) }),
      ];
      expect(c.showDateDivider(msgs, 1)).toBe(false);
    });

    it('shows when previous message was on a different day', () => {
      const c = getComponent();
      const msgs = [
        makeMsg({ timestamp: new Date(2026, 3, 25, 22, 0) }),
        makeMsg({ timestamp: new Date(2026, 3, 26, 9, 0) }),
      ];
      expect(c.showDateDivider(msgs, 1)).toBe(true);
    });
  });

  describe('messageTypeIcon', () => {
    it('returns icon by message type', () => {
      const c = getComponent();
      expect(c.messageTypeIcon(makeMsg({ messageType: 'image' }))).toBe('🖼️');
      expect(c.messageTypeIcon(makeMsg({ messageType: 'location' }))).toBe('📍');
      expect(c.messageTypeIcon(makeMsg({ messageType: 'document' }))).toBe('📄');
    });

    it('returns empty string for text', () => {
      const c = getComponent();
      expect(c.messageTypeIcon(makeMsg({ messageType: 'text' }))).toBe('');
    });
  });

  describe('sendReply', () => {
    it('calls addMessage with trimmed text and resets the input', async () => {
      const c = getComponent();
      c.replyText.setValue('  Hola  ');
      await c.sendReply();
      expect(mockService.addMessage).toHaveBeenCalledWith('c1', {
        text: 'Hola',
        fromContact: false,
        messageType: 'text',
      });
      expect(c.replyText.value).toBeNull();
      expect(c.sending()).toBe(false);
    });

    it('does nothing for empty/whitespace-only input', async () => {
      const c = getComponent();
      c.replyText.setValue('   ');
      await c.sendReply();
      expect(mockService.addMessage).not.toHaveBeenCalled();
    });

    it('skips when already sending', async () => {
      const c = getComponent();
      c.replyText.setValue('Hi');
      c.sending.set(true);
      await c.sendReply();
      expect(mockService.addMessage).not.toHaveBeenCalled();
    });

    it('sets sendError on failure and clears sending flag', async () => {
      mockService.addMessage.mockRejectedValue(new Error('fail'));
      const c = getComponent();
      c.replyText.setValue('Hola');
      await c.sendReply();
      expect(c.sendError()).toBe('Error al guardar el mensaje.');
      expect(c.sending()).toBe(false);
    });
  });
});
