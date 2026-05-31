import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyPassword, verifySession } from "@/lib/auth";

// ── Route classification ──────────────────────────────────────────────────────

const PUBLIC_EXACT = new Set(["/login", "/api/telegram/webhook"]);
const PUBLIC_PREFIX = ["/api/auth/", "/api/webhooks/"] as const;

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIX.some(p => pathname.startsWith(p));
}

// ── Deny helpers ──────────────────────────────────────────────────────────────

function toLogin(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  const from = req.nextUrl.pathname;
  url.pathname = "/login";
  // Preserve the original destination for post-login redirect.
  // Only set `from` for non-root, non-login paths to keep URLs clean.
  if (from && from !== "/" && from !== "/login") {
    url.searchParams.set("from", from);
  }
  return NextResponse.redirect(url);
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const authSecret = process.env.AUTH_SECRET ?? "";
  const dashPassword = process.env.DASHBOARD_PASSWORD ?? "";
  const isApiRoute = pathname.startsWith("/api/");

  // ── Authorization: Bearer CRON_SECRET — Vercel cron jobs ────────────────────
  // Vercel automatically attaches this header when CRON_SECRET is set in the
  // project environment.  Check it before the cookie path so cron invocations
  // never hit the browser-redirect logic.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader === `Bearer ${cronSecret}`) return NextResponse.next();
  }

  // ── x-api-secret: programmatic access (CLI, cron, server-to-server) ────────
  // Header presence triggers this branch exclusively — we don't fall through
  // to the cookie check so an invalid header always yields a hard 401.
  const apiSecret = req.headers.get("x-api-secret");
  if (apiSecret !== null) {
    if (!dashPassword) return isApiRoute ? unauthorized() : toLogin(req);
    const ok = await verifyPassword(apiSecret, dashPassword);
    return ok ? NextResponse.next() : isApiRoute ? unauthorized() : toLogin(req);
  }

  // ── Session cookie: browser access ───────────────────────────────────────
  if (authSecret) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (token && (await verifySession(token, authSecret))) {
      return NextResponse.next();
    }
  }

  return isApiRoute ? unauthorized() : toLogin(req);
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals and static assets.
    // A path containing a dot (e.g. favicon.ico, image.png) is treated as
    // a static asset and skipped.
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)",
  ],
};
