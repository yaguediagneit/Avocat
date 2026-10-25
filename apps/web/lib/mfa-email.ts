import { PrismaClient } from "@prisma/client";
import { createHash, randomInt, timingSafeEqual } from "crypto";
import { sendEmail } from "./mailer";
import { rateLimit, resetRateLimit } from "./rate-limit";

const EXPIRY_MINUTES = 10;
/** Nombre maximal de tentatives de vérification par email/purpose sur la durée de validité. */
const MAX_VERIFY_ATTEMPTS = 5;
/** Nombre maximal d'envois par email/purpose sur 15 minutes. */
const MAX_SEND_PER_WINDOW = 5;

type Purpose = "login" | "password-reset";

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function attemptsKey(email: string, purpose: Purpose) {
  return `mfa-verify:${purpose}:${email.toLowerCase()}`;
}

export class MfaRateLimitError extends Error {
  constructor(public retryAfter: number) {
    super("Trop de tentatives. Veuillez réessayer plus tard.");
    this.name = "MfaRateLimitError";
  }
}

export async function createAndSendMfaCode(
  prisma: PrismaClient,
  email: string,
  purpose: Purpose
) {
  const sendLimit = await rateLimit(`mfa-send:${purpose}:${email.toLowerCase()}`, {
    limit: MAX_SEND_PER_WINDOW,
    windowMs: 15 * 60 * 1000,
  });
  if (!sendLimit.ok) throw new MfaRateLimitError(sendLimit.retryAfter);

  // Invalider les anciens codes
  await prisma.mfaEmailCode.updateMany({
    where: { email, purpose, used: false },
    data: { used: true },
  });

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

  await prisma.mfaEmailCode.create({
    data: { email, code: hashCode(code), purpose, expiresAt },
  });

  // Un nouveau code remet à zéro le compteur de tentatives
  await resetRateLimit(attemptsKey(email, purpose));

  await sendEmail(
    email,
    "Code de vérification",
    `Votre code de vérification est : ${code}. Il est valable ${EXPIRY_MINUTES} minutes.`,
    `<p>Votre code de vérification est : <strong>${code}</strong></p><p>Il est valable ${EXPIRY_MINUTES} minutes.</p>`
  );

  return code;
}

export async function verifyMfaCode(
  prisma: PrismaClient,
  email: string,
  code: string,
  purpose: Purpose
) {
  const attempts = await rateLimit(attemptsKey(email, purpose), {
    limit: MAX_VERIFY_ATTEMPTS,
    windowMs: EXPIRY_MINUTES * 60 * 1000,
  });
  if (!attempts.ok) throw new MfaRateLimitError(attempts.retryAfter);

  const record = await prisma.mfaEmailCode.findFirst({
    where: {
      email,
      purpose,
      used: false,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return false;

  const expected = Buffer.from(record.code, "utf8");
  const provided = Buffer.from(hashCode(code), "utf8");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return false;
  }

  await prisma.mfaEmailCode.update({
    where: { id: record.id },
    data: { used: true },
  });
  await resetRateLimit(attemptsKey(email, purpose));

  return true;
}
