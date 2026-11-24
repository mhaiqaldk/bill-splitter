# Patungan

Split a bill by what each person actually had. Scan the receipt, tap who had what, and get the fewest transfers, with tax and service split fairly, in rupiah.

## What it does

- **Scan a receipt.** A photo is shrunk in the browser and sent to `/api/scan`, which asks a vision model on OpenRouter to read the line items. You can always type items in by hand instead.
- **Itemised split.** Pick a name, then tap the items they had. Shared items split evenly, or by portions ("2 of 3 sate").
- **Fair extras.** Discount, service charge and tax (PB1 10%, PPN 11%, or the amount printed on the receipt) are split in proportion to each person's subtotal. A largest-remainder step keeps every share in whole rupiah while still adding up exactly to the receipt total.
- **Settle up.** Choose who paid (one or several people) and get the fewest transfers. Mark each one paid to stamp it *LUNAS*.
- **Share link.** The whole bill is compressed into the URL hash (`/s#…`). It never touches a server. Friends pick their name and see what they owe and where to pay.
- **History.** Bills are saved in `localStorage` on the device (latest 30).

## Run it

```bash
npm install
cp .env.example .env.local   # add OPENROUTER_API_KEY to enable scanning
npm run dev                  # http://localhost:3000
npm run lint && npx tsc --noEmit
npm run build
```

Without a key everything works except scanning, which shows a friendly "type the items in" message.

## API

`POST /api/scan` takes a multipart form field `image` (JPEG/PNG/WebP, max 4 MB).

Success: `{ success: true, place, items: [{ name, qty, unit }], subtotal, discount, service, tax, taxLabel, total, model }`

Errors always look like `{ success: false, error, code }`:

| Status | Code | When |
| --- | --- | --- |
| 400 | `BAD_REQUEST` / `FILE_MISSING` | no form or no image |
| 413 | `FILE_TOO_LARGE` | over 4 MB |
| 415 | `NOT_AN_IMAGE` | not a real JPEG/PNG/WebP (checked by its first bytes) |
| 422 | `NOT_A_RECEIPT` / `NO_ITEMS` | the model found nothing to split |
| 429 | `RATE_LIMITED` / `DAILY_LIMIT` | too many scans |
| 502 | `LLM_FAILED` / `LLM_BAD_RESPONSE` | the models failed or returned bad JSON |
| 503 | `SCAN_NOT_CONFIGURED` | `OPENROUTER_API_KEY` is not set |

## Code map

- `lib/money.ts`: Rupiah formatting and `allocate()` (largest remainder)
- `lib/split.ts`: per-person shares with extras
- `lib/settle.ts`: who paid, and the fewest transfers
- `lib/share.ts`: encodes and decodes the share link (decoding validates everything)
- `lib/scan.ts`, `lib/api.ts`: server-only scanning, error shape and rate limit
- `components/`: Editor (three steps), SharedView, History

Stack: Next.js 16 (App Router, Cache Components), React 19, Tailwind CSS 4, TypeScript.
