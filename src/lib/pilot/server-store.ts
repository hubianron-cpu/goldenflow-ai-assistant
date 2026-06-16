import { initialState } from "@/lib/store/demo-data";
import type { AppState } from "@/lib/store/types";

const globalStore = globalThis as typeof globalThis & { __goldenflowPilotState?: AppState };

export function getPilotState() {
  if (!globalStore.__goldenflowPilotState) {
    globalStore.__goldenflowPilotState = structuredClone(initialState);
  }
  return globalStore.__goldenflowPilotState;
}

export function savePilotState(state: AppState) {
  globalStore.__goldenflowPilotState = state;
  return state;
}

export function resetPilotState() {
  globalStore.__goldenflowPilotState = structuredClone(initialState);
  return globalStore.__goldenflowPilotState;
}
