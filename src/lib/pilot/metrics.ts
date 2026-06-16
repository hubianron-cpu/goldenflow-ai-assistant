import type { PilotUsageCounters } from "@/lib/store/types";

export function updateDraftEditRate(counters: PilotUsageCounters) {
  const approved = counters.draftsApproved || 0;
  return approved > 0 ? Number((counters.draftsEdited / approved).toFixed(2)) : 0;
}
