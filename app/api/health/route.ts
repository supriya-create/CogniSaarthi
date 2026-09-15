import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * A deliberately tiny reachability check.
 *
 * `navigator.onLine` only reports that the device has a network, not
 * that it can reach us — a tablet on Wi-Fi with no route out still says
 * true. The connectivity monitor confirms with this endpoint before
 * claiming to be online. It touches no database and returns no data, so
 * it stays cheap enough to call occasionally on a slow connection.
 */
export function GET() {
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
