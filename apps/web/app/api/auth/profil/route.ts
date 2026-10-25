import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import argon2 from "argon2";
import { getSessionFromRequest } from "@/lib/session";
import { getTenantPrisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const profilUpdateSchema = z
  .object({
    prenom: z.string().min(1).optional(),
    nom: z.string().min(1).optional(),
    titre: z.string().optional(),
    specialite: z.string().optional(),
    email: z.string().email().optional(),
    currentPassword: z.string().optional(),
    password: z.string().min(8).optional(),
  })
  .refine((d) => !d.password || Boolean(d.currentPassword), {
    message: "Le mot de passe actuel est requis pour changer de mot de passe.",
    path: ["currentPassword"],
  });

export async function GET(req: NextRequest) {
  const res = new NextResponse();
  const session = await getSessionFromRequest(req, res);

  if (!session.userId || !session.mfaVerified) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const prisma = await getTenantPrisma(session.tenantId || "");
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { role: { select: { nom: true, estClient: true } } },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    return NextResponse.json(
      {
        id: user.id,
        prenom: user.prenom,
        nom: user.nom,
        titre: user.titre,
        specialite: user.specialite,
        email: user.email,
        role: user.role.nom,
        isClient: user.role.estClient,
      },
      { headers: res.headers }
    );
  } catch (error) {
    console.error("Get profil error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const res = new NextResponse();
  const session = await getSessionFromRequest(req, res);

  if (!session.userId || !session.mfaVerified) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = profilUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const prisma = await getTenantPrisma(session.tenantId || "");
    const currentUser = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!currentUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const { password, currentPassword, email, ...rest } = parsed.data;

    if (password) {
      const valid = await argon2.verify(currentUser.passwordHash, currentPassword || "");
      if (!valid) {
        return NextResponse.json(
          { error: "Le mot de passe actuel est incorrect." },
          { status: 403 }
        );
      }
    }

    if (email && email !== currentUser.email) {
      const existing = await prisma.user.findFirst({
        where: { email, id: { not: session.userId } },
      });
      if (existing) {
        return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
      }
    }

    const data: Record<string, unknown> = { ...rest };
    if (email) data.email = email;
    if (password) data.passwordHash = await hashPassword(password);

    const user = await prisma.user.update({
      where: { id: session.userId },
      data,
      include: { role: { select: { nom: true, estClient: true } } },
    });

    if (email && email !== session.email) {
      session.email = user.email;
      await session.save();
    }

    await logAudit(prisma, session.userId, "profil_updated", "user", user.id, {
      passwordChanged: Boolean(password),
    });

    return NextResponse.json(
      {
        id: user.id,
        prenom: user.prenom,
        nom: user.nom,
        titre: user.titre,
        specialite: user.specialite,
        email: user.email,
        role: user.role.nom,
        isClient: user.role.estClient,
      },
      { headers: res.headers }
    );
  } catch (error) {
    console.error("Update profil error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
