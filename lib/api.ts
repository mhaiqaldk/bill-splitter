import "server-only";

/** Every error response is { success: false, error, code }. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown, context: string): Response {
  if (error instanceof ApiError) {
    return Response.json({ success: false, error: error.message, code: error.code }, { status: error.status });
  }
  // Details stay in the server log; the client gets a generic message.
  console.error(`[${context}]`, error);
  return Response.json(
    { success: false, error: "Something went wrong on our side. Try again.", code: "INTERNAL" },
    { status: 500 },
  );
}

/**
 * Best-effort in-memory rate limit (per server instance). Enough to stop a
 * casual visitor from burning OpenRouter credits; set a hard cap in the
 * OpenRouter dashboard as the real safety net.
 */
const hits = new Map<string, number[]>();
let dayStart = Date.now();
let dayCount = 0;

export function rateLimit(ip: string, { perWindow = 8, windowMs = 10 * 60_000, perDay = 300 } = {}): void {
  const now = Date.now();
  if (now - dayStart > 86_400_000) {
    dayStart = now;
    dayCount = 0;
  }
  if (dayCount >= perDay) {
    throw new ApiError(429, "DAILY_LIMIT", "Scanning is resting for today. You can still type the items in.");
  }
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= perWindow) {
    throw new ApiError(429, "RATE_LIMITED", "That's a lot of scans. Wait a few minutes, or type the items in.");
  }
  recent.push(now);
  hits.set(ip, recent);
  dayCount++;
  if (hits.size > 5000) hits.clear();
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
