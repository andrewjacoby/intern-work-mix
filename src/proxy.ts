import { NextResponse, type NextRequest } from "next/server";

// Simple shared-password gate (HTTP Basic auth). Any username works; the password is DASHBOARD_PASSWORD.
export function proxy(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const supplied = decoded.slice(decoded.indexOf(":") + 1);
    if (supplied === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Intern Work Mix"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health|api/ingest).*)"] };
