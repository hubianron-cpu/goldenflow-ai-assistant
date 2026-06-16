import { readPilotEnvironment } from "@/lib/pilot/env";
import type { GoldenFlowCRMAdapter, MockCRMResult } from "./adapter";
import type { GoldenFlowConversationSummaryPayload, GoldenFlowLeadPayload, GoldenFlowTaskPayload } from "./types";

export class GoldenFlowCRMHttpAdapter implements GoldenFlowCRMAdapter {
  private env = readPilotEnvironment();

  private async post(path: string, payload: unknown, idempotencyKey: string): Promise<MockCRMResult> {
    if (this.env.GOLDENFLOW_CRM_INTEGRATION_ENABLED !== "true") {
      return { ok: true, mode: "mock", idempotencyKey, message: `CRM sync blocked by kill switch for ${path}.` };
    }
    if (!this.env.GOLDENFLOW_CRM_API_BASE_URL || !this.env.GOLDENFLOW_CRM_API_KEY) {
      return { ok: true, mode: "mock", idempotencyKey, message: `CRM API credentials missing for ${path}; action should remain pending.` };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.env.GOLDENFLOW_CRM_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.env.GOLDENFLOW_CRM_API_BASE_URL}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.env.GOLDENFLOW_CRM_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      return { ok: true, mode: "mock", idempotencyKey, message: `CRM HTTP adapter reached ${path} with status ${response.status}.` };
    } finally {
      clearTimeout(timeout);
    }
  }

  createLead(payload: GoldenFlowLeadPayload, idempotencyKey: string) {
    return this.post("/api/external/leads", payload, idempotencyKey);
  }
  async healthCheck() {
    return { ok: true as const, mode: "mock" as const, message: this.env.safeToStart ? "CRM HTTP adapter configuration is structurally valid." : this.env.errors.join("; ") };
  }
  updateLead(payload: GoldenFlowLeadPayload, idempotencyKey: string) {
    return this.post("/api/external/leads/update", payload, idempotencyKey);
  }
  updateLeadStatus(externalLeadId: string, status: string, idempotencyKey: string) {
    return this.post("/api/external/leads/status", { externalLeadId, status }, idempotencyKey);
  }
  updateLeadTemperature(externalLeadId: string, temperature: GoldenFlowLeadPayload["temperature"], idempotencyKey: string) {
    return this.post("/api/external/leads/temperature", { externalLeadId, temperature }, idempotencyKey);
  }
  createFollowUpTask(payload: GoldenFlowTaskPayload, idempotencyKey: string) {
    return this.post("/api/external/tasks", payload, idempotencyKey);
  }
  sendConversationSummary(payload: GoldenFlowConversationSummaryPayload, idempotencyKey: string) {
    return this.post("/api/external/conversation-summaries", payload, idempotencyKey);
  }
  async getLeadByPhone(externalBusinessId: string, phone: string) {
    return { ok: true as const, mode: "mock" as const, message: `CRM lookup contract only: ${externalBusinessId}/${phone}` };
  }
  async findLeadByPhone(externalBusinessId: string, phone: string) {
    return this.getLeadByPhone(externalBusinessId, phone);
  }
  async getLeadByExternalId(externalLeadId: string) {
    return { ok: true as const, mode: "mock" as const, message: `CRM lookup contract only: ${externalLeadId}` };
  }
  async getBusinessConfiguration(externalBusinessId: string) {
    return { ok: true as const, mode: "mock" as const, message: `CRM business config contract only: ${externalBusinessId}` };
  }
  syncLeadActivity(payload: Record<string, unknown>, idempotencyKey: string) {
    return this.post("/api/external/lead-activities", payload, idempotencyKey);
  }
  appendLeadActivity(payload: Record<string, unknown>, idempotencyKey: string) {
    return this.syncLeadActivity(payload, idempotencyKey);
  }
}
