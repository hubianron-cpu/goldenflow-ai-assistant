import { normalizePhoneNumber } from "./phone";
import type { WhatsAppProvider, WhatsAppProviderEvent, WhatsAppSendResult, WhatsAppStatusUpdate, WhatsAppWebhookVerificationInput } from "./types";

export class MockWhatsAppProvider implements WhatsAppProvider {
  verifyWebhookChallenge(input: WhatsAppWebhookVerificationInput) {
    return input.mode === "subscribe" && input.token ? input.challenge : null;
  }

  validateWebhookSignature(_rawBody?: string, _signature?: string | null) {
    return true;
  }

  parseIncomingWebhook(payload: unknown): WhatsAppProviderEvent[] {
    const data = payload as {
      event_id?: string;
      message_id?: string;
      from?: string;
      to?: string;
      text?: string;
      type?: string;
      timestamp?: string;
    };
    return [
      {
        externalEventId: data.event_id ?? `mock_event_${Date.now()}`,
        externalMessageId: data.message_id ?? `mock_msg_${Date.now()}`,
        externalConversationId: normalizePhoneNumber(data.from ?? "0501234567"),
        senderPhone: data.from ?? "0501234567",
        receiverPhone: data.to ?? "0500000000",
        messageType: (data.type as WhatsAppProviderEvent["messageType"]) ?? "text",
        text: data.text ?? "",
        providerTimestamp: data.timestamp ?? new Date().toISOString(),
        replyToMessageId: null,
        rawPayloadReference: "mock_payload"
      }
    ];
  }

  normalizeIncomingMessage(event: WhatsAppProviderEvent, businessId: string) {
    return {
      provider: "mock_whatsapp" as const,
      externalEventId: event.externalEventId,
      externalMessageId: event.externalMessageId,
      externalConversationId: event.externalConversationId,
      businessId,
      senderPhone: event.senderPhone,
      receiverPhone: event.receiverPhone,
      normalizedSenderPhone: normalizePhoneNumber(event.senderPhone),
      normalizedReceiverPhone: normalizePhoneNumber(event.receiverPhone),
      messageType: event.messageType,
      text: event.text,
      providerTimestamp: event.providerTimestamp,
      receivedAt: new Date().toISOString(),
      replyToMessageId: event.replyToMessageId,
      isSupported: event.messageType === "text",
      rawPayloadReference: event.rawPayloadReference
    };
  }

  async sendTextMessage(_to: string, _text: string, idempotencyKey: string): Promise<WhatsAppSendResult> {
    return {
      ok: true,
      provider: "mock_whatsapp",
      externalMessageId: `mock_out_${idempotencyKey.slice(0, 12)}`,
      status: "sent"
    };
  }

  processMessageStatusUpdate(payload: unknown): WhatsAppStatusUpdate[] {
    const data = payload as { message_id?: string; status?: WhatsAppStatusUpdate["status"]; timestamp?: string };
    return data.message_id ? [{ externalMessageId: data.message_id, status: data.status ?? "delivered", providerTimestamp: data.timestamp ?? new Date().toISOString() }] : [];
  }

  async getMessageStatus() {
    return "sent" as const;
  }

  async markMessageAsRead() {
    return true;
  }

  normalizePhoneNumber(phone: string) {
    return normalizePhoneNumber(phone);
  }

  mapProviderError(error: unknown) {
    return error instanceof Error ? error.message : "Unknown mock WhatsApp error";
  }

  async healthCheck() {
    return { ok: true, mode: "mock" as const, message: "Mock WhatsApp provider is available." };
  }
}
