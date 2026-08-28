import "server-only";

import type { NextRequest } from "next/server";

/**
 * Where the request appears to come from, for choosing crisis resources.
 *
 * Read from the edge, used once, and thrown away. It is never written to the
 * database, never attached to a conversation, and never included in an alert
 * or an audit entry — a stored "this conversation came from Iran" beside an
 * encrypted transcript is exactly the kind of metadata this product is built
 * not to accumulate, and it would survive the transcript's own deletion.
 *
 * It is also frequently wrong: VPNs, satellite links, corporate egress in
 * another country. That is tolerable precisely because of what it is used
 * for. A wrong country means someone is offered a helpline in the wrong
 * place *alongside* an international directory that will route them
 * correctly. Nothing depends on it being right.
 */
export function countryFor(request: NextRequest): string | null {
  const header =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    null;

  if (!header) return null;

  const code = header.trim().toUpperCase();
  // Cloudflare uses XX for unknown and T1 for Tor. Neither is a place.
  if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return null;

  return code;
}
