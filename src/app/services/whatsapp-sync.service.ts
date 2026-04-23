import { Injectable, inject } from '@angular/core';
import { ContactoService } from './contacto.service';
import { Contacto, WhatsAppLabel } from '../shared/models/contacto.model';

/**
 * WhatsAppSyncService — Phase 2 placeholder.
 *
 * Phase 2 will integrate with Make.com (formerly Integromat) webhooks
 * to sync contacts and messages from WhatsApp Business API.
 *
 * Planned architecture:
 *   WhatsApp Business → Make.com scenario → HTTP webhook → Firebase Function
 *   → WhatsAppSyncService.processWebhookPayload()
 */
@Injectable({ providedIn: 'root' })
export class WhatsAppSyncService {
  private contactoService = inject(ContactoService);

  // ── Phase 2: Webhook processing ───────────────────────────────────────────

  /**
   * Entry point for Make.com webhook payloads.
   * Will parse and route to the appropriate handler.
   */
  async processWebhookPayload(_payload: unknown): Promise<void> {
    // TODO (Phase 2): parse webhook, route to message/label/contact handler
    console.warn('[WhatsAppSyncService] processWebhookPayload not yet implemented (Phase 2)');
  }

  /**
   * Sync a new or updated WhatsApp contact.
   * Called when a contact's profile info changes.
   */
  async syncContact(_waId: string, _name: string, _phone: string): Promise<void> {
    // TODO (Phase 2): upsert contact by phone number
    console.warn('[WhatsAppSyncService] syncContact not yet implemented (Phase 2)');
  }

  /**
   * Sync an incoming WhatsApp message.
   * Finds the matching contact by phone, creates if not found, adds message.
   */
  async syncIncomingMessage(
    _phone: string,
    _text: string,
    _timestamp: Date,
    _mediaUrl?: string
  ): Promise<void> {
    // TODO (Phase 2): find/create contact, add message, update lastMessageAt
    console.warn('[WhatsAppSyncService] syncIncomingMessage not yet implemented (Phase 2)');
  }

  /**
   * Sync a WhatsApp label change to contact status + whatsappLabel field.
   * The label change triggers Kanban card creation for paisajismo leads.
   */
  async syncLabelChange(_phone: string, _newLabel: WhatsAppLabel): Promise<void> {
    // TODO (Phase 2):
    //   1. Find contact by phone
    //   2. Update contact.whatsappLabel
    //   3. Derive contact.status from label prefix
    //   4. If label === 'LD | Paisajismo' → contactoService.onLeadPaisajismoCreated()
    console.warn('[WhatsAppSyncService] syncLabelChange not yet implemented (Phase 2)');
  }

  /**
   * Sync a location message (from WhatsApp location share).
   * Updates contact.location.coordinates.
   */
  async syncLocationMessage(
    _phone: string,
    _lat: number,
    _lng: number
  ): Promise<void> {
    // TODO (Phase 2): update contact.location.coordinates
    console.warn('[WhatsAppSyncService] syncLocationMessage not yet implemented (Phase 2)');
  }

  // ── Phase 2: Status derivation ────────────────────────────────────────────

  /**
   * Derives Contacto.status from a WhatsApp label string.
   * NM → nuevo_mensaje, IN → interesado, LD → lead, CL → cliente, SR → sin_respuesta
   */
  labelToStatus(label: WhatsAppLabel): Contacto['status'] {
    if (label.startsWith('NM')) return 'nuevo_mensaje';
    if (label.startsWith('IN')) return 'interesado';
    if (label.startsWith('LD')) return 'lead';
    if (label.startsWith('CL')) return 'cliente';
    if (label.startsWith('SR')) return 'sin_respuesta';
    return 'nuevo_mensaje';
  }
}
