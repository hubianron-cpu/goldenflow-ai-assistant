import type { DeliveryStatus, NormalizedIncomingMessage } from "@/lib/store/types";

export type WhatsAppWebhookVerificationInput = {
  mode: string | null;
  token: string | null;
  challenge: string | null;
};

export type WhatsAppSendResult = {
  ok: boolean;
  provider: "whatsapp_cloud" | "mock_whatsapp";
  externalMessageId: string | null;
  status: DeliveryStatus;
  error?: string;
};

export interface WhatsAppProvider {
  verifyWebhookChallenge(input: WhatsAppWebhookVerificationInput): string | null;
  validateWebhookSignature(rawBody: string, signature: string | null): boolean;
  parseIncomingWebhook(payload: unknown): WhatsAppProviderEvent[];
  normalizeIncomingMessage(event: WhatsAppProviderEvent, businessId: string): NormalizedIncomingMessage;
  sendTextMessage(to: string, text: string, idempotencyKey: string): Promise<WhatsAppSendResult>;
  processMessageStatusUpdate(payload: unknown): WhatsAppStatusUpdate[];
  getMessageStatus(externalMessageId: string): Promise<DeliveryStatus>;
  markMessageAsRead(externalMessageId: string): Promise<boolean>;
  normalizePhoneNumber(phone: string): string;
  mapProviderError(error: unknown): string;
  healthCheck(): Promise<{ ok: boolean; mode: "mock" | "real"; message: string }>;
}

export type WhatsAppProviderEvent = {
  externalEventId: string;
  externalMessageId: string;
  externalConversationId: string;
  senderPhone: string;
  receiverPhone: string;
  messageType: NormalizedIncomingMessage["messageType"];
  text: string;
  providerTimestamp: string;
  replyToMessageId: string | null;
  rawPayloadReference: string;
};

export type WhatsAppStatusUpdate = {
  externalMessageId: string;
  status: DeliveryStatus;
  providerTimestamp: string;
};
