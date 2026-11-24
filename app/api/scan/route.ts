import { ApiError, clientIp, errorResponse, rateLimit } from "@/lib/api";
import { MAX_IMAGE_BYTES, imageMime, scanReceipt } from "@/lib/scan";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > MAX_IMAGE_BYTES + 64 * 1024) {
      throw new ApiError(413, "FILE_TOO_LARGE", "That photo is too big. Try again (we shrink photos before sending).");
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "Send the photo as a form upload named 'image'.");
    }
    const file = form.get("image");
    if (!(file instanceof File) || file.size === 0) {
      throw new ApiError(400, "FILE_MISSING", "No photo received.");
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new ApiError(413, "FILE_TOO_LARGE", "That photo is too big. Try again (we shrink photos before sending).");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = imageMime(bytes);
    if (!mime) throw new ApiError(415, "NOT_AN_IMAGE", "That file isn't a JPEG, PNG or WebP photo.");

    // Count only real attempts, after the cheap checks pass.
    rateLimit(clientIp(req));

    const result = await scanReceipt(bytes, mime);
    return Response.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error, "scan");
  }
}
