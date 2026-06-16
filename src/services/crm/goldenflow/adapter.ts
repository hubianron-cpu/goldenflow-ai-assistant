import type { GoldenFlowConversationSummaryPayload, GoldenFlowLeadPayload, GoldenFlowTaskPayload } from "./types";

export interface GoldenFlowCRMAdapter {
  healthCheck(): Promise<MockCRMResult>;
  createLead(payload: GoldenFlowLeadPayload, idempotencyKey: string): Promise<MockCRMResult>;
  updateLead(payload: GoldenFlowLeadPayload, idempotencyKey: string): Promise<MockCRMResult>;
  updateLeadStatus(externalLeadId: string, status: string, idempotencyKey: string): Promise<MockCRMResult>;
  updateLeadTemperature(externalLeadId: string, temperature: GoldenFlowLeadPayload["temperature"], idempotencyKey: string): Promise<MockCRMResult>;
  createFollowUpTask(payload: GoldenFlowTaskPayload, idempotencyKey: string): Promise<MockCRMResult>;
  sendConversationSummary(payload: GoldenFlowConversationSummaryPayload, idempotencyKey: string): Promise<MockCRMResult>;
  findLeadByPhone(externalBusinessId: string, phone: string): Promise<MockCRMResult>;
  getLeadByPhone(externalBusinessId: string, phone: string): Promise<MockCRMResult>;
  getLeadByExternalId(externalLeadId: string): Promise<MockCRMResult>;
  getBusinessConfiguration(externalBusinessId: string): Promise<MockCRMResult>;
  appendLeadActivity(payload: Record<string, unknown>, idempotencyKey: string): Promise<MockCRMResult>;
  syncLeadActivity(payload: Record<string, unknown>, idempotencyKey: string): Promise<MockCRMResult>;
}

export type MockCRMResult = {
  ok: true;
  mode: "mock";
  idempotencyKey?: string;
  message: string;
};

function mock(message: string, idempotencyKey?: string): MockCRMResult {
  return { ok: true, mode: "mock", idempotencyKey, message };
}

export const goldenFlowCRMAdapter: GoldenFlowCRMAdapter = {
  async healthCheck() {
    return mock("Mock only: GoldenFlow CRM adapter health check is ready.");
  },
  async createLead(_payload, idempotencyKey) {
    return mock("Mock only: GoldenFlow CRM lead creation contract is ready.", idempotencyKey);
  },
  async updateLead(_payload, idempotencyKey) {
    return mock("Mock only: GoldenFlow CRM lead update contract is ready.", idempotencyKey);
  },
  async updateLeadStatus(_externalLeadId, _status, idempotencyKey) {
    return mock("Mock only: GoldenFlow CRM status update contract is ready.", idempotencyKey);
  },
  async updateLeadTemperature(_externalLeadId, _temperature, idempotencyKey) {
    return mock("Mock only: GoldenFlow CRM temperature update contract is ready.", idempotencyKey);
  },
  async createFollowUpTask(_payload, idempotencyKey) {
    return mock("Mock only: GoldenFlow CRM follow-up task contract is ready.", idempotencyKey);
  },
  async sendConversationSummary(_payload, idempotencyKey) {
    return mock("Mock only: GoldenFlow CRM conversation summary contract is ready.", idempotencyKey);
  },
  async findLeadByPhone(_externalBusinessId, _phone) {
    return mock("Mock only: GoldenFlow CRM lead lookup by phone is ready.");
  },
  async getLeadByPhone(_externalBusinessId, _phone) {
    return mock("Mock only: GoldenFlow CRM lead lookup by phone is ready.");
  },
  async getLeadByExternalId(_externalLeadId) {
    return mock("Mock only: GoldenFlow CRM lead lookup by external ID is ready.");
  },
  async getBusinessConfiguration(_externalBusinessId) {
    return mock("Mock only: GoldenFlow CRM business configuration contract is ready.");
  },
  async appendLeadActivity(_payload, idempotencyKey) {
    return mock("Mock only: GoldenFlow CRM lead activity append contract is ready.", idempotencyKey);
  },
  async syncLeadActivity(_payload, idempotencyKey) {
    return mock("Mock only: GoldenFlow CRM lead activity sync contract is ready.", idempotencyKey);
  }
};
