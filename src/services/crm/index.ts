import type { Conversation, Lead } from "@/lib/store/types";
export * from "./goldenflow";

type CrmResult = {
  ok: true;
  mode: "mock";
  message: string;
};

function mockResult(message: string): CrmResult {
  return { ok: true, mode: "mock", message };
}

export async function createLeadInCRM(_lead: Lead) {
  return mockResult("Mock only: lead creation is ready for a future GoldenFlow CRM API.");
}

export async function updateLeadStatusInCRM(_leadId: string, _status: Lead["status"]) {
  return mockResult("Mock only: lead status update is ready for a future GoldenFlow CRM API.");
}

export async function createTaskInCRM(_businessId: string, _leadId: string, _title: string) {
  return mockResult("Mock only: task creation is ready for a future GoldenFlow CRM API.");
}

export async function sendConversationSummaryToCRM(_conversation: Conversation) {
  return mockResult("Mock only: conversation summary sync is ready for a future GoldenFlow CRM API.");
}

export async function getLeadDataFromCRM(_businessId: string, _leadId: string) {
  return mockResult("Mock only: lead data fetching is ready for a future GoldenFlow CRM API.");
}
