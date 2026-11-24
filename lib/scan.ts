import "server-only";
import { ApiError } from "./api";

export type ScannedItem = { name: string; qty: number; unit: number };

export type ScanResult = {
  place: string;
  items: ScannedItem[];
  /** amounts printed on the receipt, 0 when not printed */
  subtotal: number;
  discount: number;
  service: number;
  tax: number;
  taxLabel: string;
  total: number;
  model: string;
};

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // Vercel caps request bodies at ~4.5 MB

/** Accept only real JPEG / PNG / WebP files, checked by their first bytes. */
export function imageMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const ascii = String.fromCharCode(...bytes.slice(0, 12));
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
  return null;
}

const PROMPT = `You read restaurant and shop receipts, mostly from Indonesia.
Return ONLY a JSON object, no prose, in this exact shape:
{"place": string, "items": [{"name": string, "qty": number, "unit_price": number, "line_total": number}],
 "subtotal": number, "discount": number, "service": number, "tax": number, "tax_label": string, "total": number,
 "not_receipt": boolean}
Rules:
- Amounts are whole rupiah. In Indonesia "." groups thousands: "48.500" means 48500. "48,500" also means 48500.
- items: only things that were ordered. Never include subtotal, tax, service, discount, total, payment, cash, change, rounding or points lines.
- If a line shows "2 x 15.000  30.000", qty is 2, unit_price 15000, line_total 30000.
- Keep item names short and as printed. Fix obvious OCR noise.
- tax_label is how the receipt names tax, e.g. "PB1", "PPN", "Pajak Resto", or "Tax".
- Use 0 for anything not printed.
- If the image is not a receipt, return {"not_receipt": true, "items": []}.`;

const n = (v: unknown) => {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (typeof v === "string") {
    const d = v.replace(/[^\d]/g, "");
    return d ? Math.min(Number(d), 999_999_999) : 0;
  }
  return 0;
};

/** Free models sometimes wrap JSON in fences or prose; dig the object out. */
function extractJson(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new ApiError(502, "LLM_BAD_RESPONSE", "The scanner gave an unreadable answer.");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new ApiError(502, "LLM_BAD_RESPONSE", "The scanner gave an unreadable answer.");
  }
}

export function normalise(raw: Record<string, unknown>, model: string): ScanResult {
  if (raw.not_receipt === true) {
    throw new ApiError(422, "NOT_A_RECEIPT", "That doesn't look like a receipt. Try a sharper photo, flat and well lit.");
  }
  const items: ScannedItem[] = (Array.isArray(raw.items) ? raw.items : [])
    .slice(0, 100)
    .map((r) => {
      const it = (r ?? {}) as Record<string, unknown>;
      const qty = Math.max(1, Math.min(999, n(it.qty) || 1));
      const line = n(it.line_total);
      let unit = n(it.unit_price);
      // Trust the printed line total when the maths doesn't add up.
      if (line && (!unit || unit * qty !== line)) unit = Math.round(line / qty);
      return { name: String(it.name ?? "").trim().slice(0, 80), qty, unit };
    })
    .filter((it) => it.name && it.unit > 0);

  if (items.length === 0) {
    throw new ApiError(422, "NO_ITEMS", "Couldn't find any items on that photo. Try again closer, or type them in.");
  }
  return {
    place: String(raw.place ?? "").trim().slice(0, 60),
    items,
    subtotal: n(raw.subtotal),
    discount: n(raw.discount),
    service: n(raw.service),
    tax: n(raw.tax),
    taxLabel: String(raw.tax_label ?? "").trim().slice(0, 20),
    total: n(raw.total),
    model,
  };
}

async function callModel(model: string, dataUrl: string, key: string): Promise<ScanResult> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "Patungan",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[scan] ${model} -> ${res.status} ${body.slice(0, 300)}`);
    throw new ApiError(502, "LLM_FAILED", "The scanner is busy right now.");
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? "";
  return normalise(extractJson(text), model);
}

export async function scanReceipt(bytes: Uint8Array, mime: string): Promise<ScanResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new ApiError(503, "SCAN_NOT_CONFIGURED", "Scanning isn't set up yet. Type the items in for now.");

  const models = [
    process.env.OPENROUTER_VISION_MODEL || "google/gemma-4-31b-it:free",
    process.env.OPENROUTER_VISION_FALLBACK || "nvidia/nemotron-3.5-super-vl:free",
  ];
  const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;

  let last: unknown;
  for (const model of models) {
    // Two tries per model: free models often return broken JSON once.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callModel(model, dataUrl, key);
      } catch (e) {
        last = e;
        // A clear "not a receipt" answer won't change on retry.
        if (e instanceof ApiError && (e.code === "NOT_A_RECEIPT" || e.code === "NO_ITEMS")) throw e;
        if (e instanceof ApiError && e.code === "LLM_FAILED") break; // move on to the next model
      }
    }
  }
  if (last instanceof ApiError) throw last;
  console.error("[scan] all models failed", last);
  throw new ApiError(502, "LLM_FAILED", "The scanner couldn't read it this time. Try again, or type the items in.");
}
