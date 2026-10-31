import { createHash, randomBytes } from "crypto";
import type { PrismaClient, User, UserInvitation } from "@prisma/client";

/**
 * Invitations utilisateur : l'administrateur ne choisit plus le mot de passe.
 * Un lien à usage unique est partagé (copié, WhatsApp, e-mail) ; le nouvel
 * utilisateur définit lui-même son mot de passe. Le token circule en clair
 * dans l'URL mais n'est stocké que haché (sha256).
 */

const INVITATION_TTL_HOURS = 72;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Crée une invitation et renvoie le token en clair (à mettre dans le lien). */
export async function createInvitation(
  prisma: PrismaClient,
  userId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 3600 * 1000);

  // Toute invitation encore valide de cet utilisateur est invalidée : un seul
  // lien actif à la fois.
  await prisma.userInvitation.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.userInvitation.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  return { token, expiresAt };
}

/** Vérifie un token et renvoie l'invitation + l'utilisateur, ou null. */
export async function verifyInvitation(
  prisma: PrismaClient,
  token: string
): Promise<(UserInvitation & { user: User }) | null> {
  const invitation = await prisma.userInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
    return null;
  }
  return invitation;
}

export function invitationUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/invitation/${token}`;
}
