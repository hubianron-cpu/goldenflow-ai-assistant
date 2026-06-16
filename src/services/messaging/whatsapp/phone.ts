export function normalizePhoneNumber(phone: string, defaultCountry: "IL" | "US" | "unknown" = "IL") {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return `+${trimmed.replace(/[^\d]/g, "")}`;
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("972")) return `+${digits}`;
  if (defaultCountry === "IL" && digits.startsWith("0")) return `+972${digits.slice(1)}`;
  if (defaultCountry === "US" && digits.length === 10) return `+1${digits}`;
  return defaultCountry === "unknown" ? digits : `+${digits}`;
}
