import type { BackgroundJob, JobType, MessageProcessingBatch } from "@/lib/store/types";

export function createBackgroundJob(input: {
  businessId: string;
  jobType: JobType;
  entityId: string;
  scheduledFor?: string;
  maxAttempts?: number;
}): BackgroundJob {
  const now = new Date().toISOString();
  return {
    id: `job_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    businessId: input.businessId,
    jobType: input.jobType,
    entityId: input.entityId,
    status: "pending",
    attemptCount: 0,
    maxAttempts: input.maxAttempts ?? 3,
    scheduledFor: input.scheduledFor ?? now,
    lockedAt: null,
    lockedBy: null,
    lockExpiresAt: null,
    lastError: null,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    failedAt: null
  };
}

export function createOrUpdateMessageBatch(input: {
  existing?: MessageProcessingBatch;
  businessId: string;
  conversationId: string;
  messageId: string;
  messageCreatedAt: string;
  debounceWindowSeconds: number;
}): MessageProcessingBatch {
  const processAfter = new Date(Date.now() + input.debounceWindowSeconds * 1000).toISOString();
  if (input.existing && ["pending", "processing"].includes(input.existing.status)) {
    return {
      ...input.existing,
      lastMessageAt: input.messageCreatedAt,
      processAfter,
      messageIds: Array.from(new Set([...input.existing.messageIds, input.messageId]))
    };
  }

  return {
    id: `batch_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    businessId: input.businessId,
    conversationId: input.conversationId,
    status: "pending",
    firstMessageAt: input.messageCreatedAt,
    lastMessageAt: input.messageCreatedAt,
    processAfter,
    messageIds: [input.messageId],
    agentRunId: null,
    createdAt: new Date().toISOString(),
    processedAt: null,
    failedAt: null
  };
}

export function acquireConversationLock(lockOwner: string, ttlSeconds = 120) {
  const now = new Date();
  return {
    processingLockAt: now.toISOString(),
    processingLockExpiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    lockedBy: lockOwner
  };
}
