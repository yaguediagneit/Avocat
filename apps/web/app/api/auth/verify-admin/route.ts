import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/prisma";
import { getRoleByName } from "@/lib/rbac";
import { enforceAuthRateLimit, resetAuthRateLimit } from "@/lib/rate-limit";

/**
 * POST — vérifie les identifiants admin sans créer de session.
 *
 * Utilisé pour déverrouiller les actions d'une tâche terminée.
 * Retourne { ok: true, estAdmin: true } si les credentials sont valides
 * et que l'utilisateur a le rôle admin.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
    }

    const limited = await enforceAuthRateLimit(req, "verify-admin", email);
    if (limited) return limited;

    const result = await verifyUser(email, password);
    if (!result) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }
    await resetAuthRateLimit(req, "verify-admin", email);

    // Vérifier que l'utilisateur est admin
    let estAdmin = false;
    try {
      const prisma = await getTenantPrisma(result.tenantId);
      const role = await getRoleByName(prisma, result.role);
      estAdmin = !!role?.estAdmin;
    } catch {
      // Fallback : vérifier le nom du rôle
      estAdmin = result.role?.toLowerCase() === "admin";
    }

    if (!estAdmin) {
      return NextResponse.json({ error: "Seul un administrateur peut réactiver les actions" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, estAdmin: true });
  } catch (e) {
    console.error("[auth/verify-admin] error", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
