import type { AuditLog } from "@/lib/store/types";

export function createAuditLog(input: Omit<AuditLog, "id" | "createdAt">): AuditLog {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    ...input
  };
}
