const PLACEHOLDER_HOSTS = new Set(["example.com", "localhost"]);

export function isValidSourceUrl(value) {
  if (!value || typeof value !== "string") return false;

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    if (PLACEHOLDER_HOSTS.has(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function normalizeStatus(status, content) {
  if (status === "ready" && typeof content === "string" && content.trim().length > 0) {
    return "ready";
  }
  return "unavailable";
}

export function fallbackContent(status) {
  if (status === "ready") return "";
  return "Full source content is currently unavailable. Please use the source link for original publication details.";
}
