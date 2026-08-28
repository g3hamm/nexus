import QRCode from "qrcode";
import { generateTotpSecret, sealSecret, totpProvisioningUri } from "@nexus/auth";
import { NexusError, asAdminId } from "@nexus/core";
import { container } from "@/server/container";
import { env } from "@/server/env";
import { errorResponse, ok } from "@/server/http";
import { requireAdmin } from "@/server/session";

export const runtime = "nodejs";

/**
 * Starts enrolment: a fresh secret and the URI an authenticator app reads.
 *
 * Writes the secret but does not enable anything. Enabling waits for a
 * verified code, so abandoning this page halfway leaves the account exactly
 * as it was rather than locked.
 */
export async function POST() {
  try {
    const claims = await requireAdmin();
    const adminId = asAdminId(claims.subject);

    const c = container();
    const existing = await c.admins.mfaFor(adminId);
    if (existing?.enabledAt) {
      throw NexusError.conflict(
        "Two-factor authentication is already on. Turn it off first to re-enrol.",
      );
    }

    const admin = await c.admins.findById(adminId);
    if (!admin) throw NexusError.notFound("Admin", adminId);

    const secret = generateTotpSecret();
    await c.admins.beginMfaEnrolment(
      adminId,
      sealSecret(secret, env().NEXUS_SESSION_SECRET),
    );

    const uri = totpProvisioningUri(secret, admin.email);

    // Rendered server-side as SVG so the QR library never reaches the browser
    // bundle, and so the page needs no canvas.
    const qrSvg = await QRCode.toString(uri, {
      type: "svg",
      margin: 1,
      // Plain black on transparent, so it inherits the page in either theme
      // and stays scannable.
      color: { dark: "#000000", light: "#ffffff" },
    });

    return ok({ secret, uri, qrSvg });
  } catch (error) {
    return errorResponse(error);
  }
}
