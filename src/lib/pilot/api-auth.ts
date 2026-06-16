import type { NextRequest } from "next/server";
import { readPilotEnvironment } from "./env";

export function requirePilotAdmin(request: NextRequest) {
  const env = readPilotEnvironment();
  const configuredToken = process.env.PILOT_ADMIN_TOKEN;
  if (env.APP_ENV === "development" && !configuredToken) {
    return { allowed: true, reason: "development without PILOT_ADMIN_TOKEN" };
  }
  if (!configuredToken) {
    return { allowed: false, reason: "PILOT_ADMIN_TOKEN is required outside development" };
  }
  const headerToken = request.headers.get("x-pilot-admin-token");
  return headerToken === configuredToken
    ? { allowed: true, reason: "admin token accepted" }
    : { allowed: false, reason: "invalid or missing pilot admin token" };
}
