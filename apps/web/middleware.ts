import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "./lib/session-options";
import { CSRF_COOKIE, CSRF_HEADER, generateCsrfToken, SAFE_METHODS, tokensMatch } from "./lib/csrf";

function isSuperAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.SUPERADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

/**
 * Vérification CSRF double-submit : ne s'applique qu'aux requêtes mutantes sur
 * `/api/*` portant un cookie de session (une requête sans cookie d'authentification
 * ne peut pas exploiter l'authentification ambiante).
 */
function checkCsrf(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/api/") || SAFE_METHODS.has(req.method.toUpperCase())) return null;
  if (!req.cookies.get(sessionOptions.cookieName)) return null;

  const cookieToken = req.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = req.headers.get(CSRF_HEADER);

  // Onglet ouvert avant la mise en place du cookie : on tolère si le navigateur
  // atteste une requête same-origin (en-tête non falsifiable par un site tiers).
  if (!cookieToken && req.headers.get("sec-fetch-site") === "same-origin") return null;

  if (!tokensMatch(cookieToken, headerToken)) {
    return NextResponse.json({ error: "Jeton CSRF invalide ou manquant" }, { status: 403 });
  }
  return null;
}

function ensureCsrfCookie(req: NextRequest, res: NextResponse) {
  if (req.cookies.get(CSRF_COOKIE)) return;
  res.cookies.set(CSRF_COOKIE, generateCsrfToken(), {
    httpOnly: false,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function middleware(req: NextRequest) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const res = await route(req);
  ensureCsrfCookie(req, res);
  return res;
}

async function route(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Routes publiques
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/client/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-mfa") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Lecture de la session (réponse temporaire, pas envoyée au client)
  const sessionRes = NextResponse.next();
  const session = await getIronSession<SessionData>(req, sessionRes, sessionOptions);

  // On clone les headers de la requête pour injecter le tenant
  const requestHeaders = new Headers(req.headers);
  const tenantId =
    session.tenantId ||
    (process.env.NODE_ENV !== "production" ? process.env.DEFAULT_TENANT_ID : undefined) ||
    "";
  if (tenantId) {
    requestHeaders.set("x-tenant-id", tenantId);
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  // Flux iCal public (abonnement Google/Outlook)
  if (pathname === "/api/calendrier/ical" && req.method === "GET") {
    return res;
  }

  // Superadmin : session MFA vérifiée + email dans SUPERADMIN_EMAILS
  if (pathname.startsWith("/superadmin") || pathname.startsWith("/api/superadmin")) {
    const authorized =
      !!session.userId && !!session.mfaVerified && !session.isClient && isSuperAdminEmail(session.email);
    if (!authorized) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Accès réservé au superadmin" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return res;
  }

  // Espace client
  if (pathname.startsWith("/client")) {
    if (!session.userId || !session.isClient) {
      return NextResponse.redirect(new URL("/client/login", req.url));
    }
    return res;
  }

  // Routes API partagées avec l'espace client : clé publique de chiffrement
  // (dépôt de documents) et téléchargement des documents publiés.
  const isClientSharedApi =
    pathname === "/api/keys" || /^\/api\/documents\/[^/]+\/download$/.test(pathname);
  if (session.isClient && isClientSharedApi) {
    if (!session.userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    return res;
  }

  // Dashboard et API cabinet
  if (
    pathname.startsWith("/cabinet") ||
    (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth") && !pathname.startsWith("/api/client"))
  ) {
    if (!session.userId || session.isClient || !session.mfaVerified) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return res;
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
