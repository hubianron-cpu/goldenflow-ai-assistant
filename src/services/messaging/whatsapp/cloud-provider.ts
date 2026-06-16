import crypto from "node:crypto";
import { readPilotEnvironment } from "@/lib/pilot/env";
import { normalizePhoneNumber } from "./phone";
import type { WhatsAppProvider, WhatsAppProviderEvent, WhatsAppSendResult, WhatsAppStatusUpdate, WhatsAppWebhookVerificationInput } from "./types";

export class WhatsAppCloudProvider implements WhatsAppProvider {
  private env = readPilotEnvironment();

  verifyWebhookChallenge(input: WhatsAppWebhookVerificationInput) {
    if (input.mode === "subscribe" && input.token && input.token === this.env.WHATSAPP_VERIFY_TOKEN) {
      return input.challenge;
    }
    return null;
  }

  validateWebhookSignature(rawBody: string, signature: string | null) {
    if (!this.env.WHATSAPP_APP_SECRET) return this.env.APP_ENV !== "production";
    if (!signature?.startsWith("sha256=")) return false;
    const expected = `sha256=${crypto.createHmac("sha256", this.env.WHATSAPP_APP_SECRET).update(rawBody).digest("hex")}`;
    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  parseIncomingWebhook(payload: unknown): WhatsAppProviderEvent[] {
    const body = payload as {
      entry?: Array<{
        id?: string;
        changes?: Array<{
          value?: {
            metadata?: { display_phone_number?: string; phone_number_id?: string };
            messages?: Array<{
              id: string;
              from: string;
              timestamp?: string;
              type?: string;
              text?: { body?: string };
              context?: { id?: string };
            }>;
          };
        }>;
      }>;
    };

    return (body.entry ?? []).flatMap((entry) =>
      (entry.changes ?? []).flatMap((change) =>
        (change.value?.messages ?? []).map((message) => ({
          externalEventId: `${entry.id ?? "entry"}:${message.id}`,
          externalMessageId: message.id,
          externalConversationId: normalizePhoneNumber(message.from),
          senderPhone: message.from,
          receiverPhone: change.value?.metadata?.display_phone_number ?? change.value?.metadata?.phone_number_id ?? "",
          messageType: (message.type as WhatsAppProviderEvent["messageType"]) ?? "unknown",
          text: message.text?.body ?? "",
          providerTimestamp: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString(),
          replyToMessageId: message.context?.id ?? null,
          rawPayloadReference: `wa:${message.id}`
        }))
      )
    );
  }

  normalizeIncomingMessage(event: WhatsAppProviderEvent, businessId: string) {
    return {
      provider: "whatsapp_cloud" as const,
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

  async sendTextMessage(to: string, text: string, idempotencyKey: string): Promise<WhatsAppSendResult> {
    if (this.env.WHATSAPP_SENDING_ENABLED !== "true") {
      return { ok: false, provider: "whatsapp_cloud", externalMessageId: null, status: "blocked", error: "WHATSAPP_SENDING_ENABLED is false." };
    }
    if (!this.env.WHATSAPP_ACCESS_TOKEN || !this.env.WHATSAPP_PHONE_NUMBER_ID) {
      return { ok: false, provider: "whatsapp_cloud", externalMessageId: null, status: "blocked", error: "Missing WhatsApp Cloud credentials." };
    }

    const response = await fetch(`${this.env.WHATSAPP_API_BASE_URL}/${this.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizePhoneNumber(to).replace("+", ""),
        type: "text",
        text: { preview_url: false, body: text },
        client_ref: idempotencyKey
      })
    });
    if (!response.ok) {
      return { ok: false, provider: "whatsapp_cloud", externalMessageId: null, status: "failed", error: `WhatsApp send failed: ${response.status}` };
    }
    const payload = (await response.json()) as { messages?: Array<{ id?: string }> };
    return { ok: true, provider: "whatsapp_cloud", externalMessageId: payload.messages?.[0]?.id ?? null, status: "sent" };
  }

  processMessageStatusUpdate(payload: unknown): WhatsAppStatusUpdate[] {
    const body = payload as { entry?: Array<{ changes?: Array<{ value?: { statuses?: Array<{ id: string; status: WhatsAppStatusUpdate["status"]; timestamp?: string }> } }> }> };
    return (body.entry ?? []).flatMap((entry) =>
      (entry.changes ?? []).flatMap((change) =>
        (change.value?.statuses ?? []).map((status) => ({
          externalMessageId: status.id,
          status: status.status,
          providerTimestamp: status.timestamp ? new Date(Number(status.timestamp) * 1000).toISOString() : new Date().toISOString()
        }))
      )
    );
  }

  async getMessageStatus() {
    return "queued" as const;
  }

  async markMessageAsRead() {
    return false;
  }

  normalizePhoneNumber(phone: string) {
    return normalizePhoneNumber(phone);
  }

  mapProviderError(error: unknown) {
    return error instanceof Error ? error.message : "Unknown WhatsApp Cloud error";
  }

  async healthCheck() {
    return { ok: this.env.safeToStart, mode: "real" as const, message: this.env.safeToStart ? "WhatsApp Cloud configuration is structurally valid." : this.env.errors.join("; ") };
  }
}
