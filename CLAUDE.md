@AGENTS.md

# Patungan (bill-splitter)

See README.md for features, commands and the API error table. Keep that table in sync when adding error codes.

## Notes
- Next.js 16 with Cache Components on: route files can't export `runtime` (Node is the default).
- Editor, SharedView and History read localStorage / the URL hash on first render, so they load through `components/client.tsx` with `ssr: false`.
- Money is whole rupiah everywhere. Use `allocate()` from `lib/money.ts` whenever an amount is divided, so the parts always add up.
- Design (60-30-10): cool thermal-white neutrals; one brand colour, deep green `brand`, used only for surfaces where the next action lives (phone bottom bar, desktop total panel, first-screen card, the friend's "You pay" card); sun-yellow `accent` only on the main button, which always sits on a `BrandCard`/brand surface. One accent button per screen.
- Person colours mean "who" only. The stamp red is only for LUNAS and destructive actions. Keep every text/background pair at WCAG AA or better.

## Security
- The only secret is `OPENROUTER_API_KEY`, used only in `lib/scan.ts` (server-only). Never use a `NEXT_PUBLIC_` name for it.
- `/api/scan` checks size and magic bytes and has a best-effort in-memory rate limit. A hard spending cap in the OpenRouter dashboard is the real safety net.
- Share links put the bill in the URL hash, so names and amounts never reach the server. The QRIS image stays in localStorage and is never put in the link.
