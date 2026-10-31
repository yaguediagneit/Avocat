import { z } from "zod";

/**
 * Politique de mot de passe : 10 caractères minimum avec au moins une
 * minuscule, une majuscule, un chiffre et un caractère spécial.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_POLICY_MESSAGE =
  "Le mot de passe doit contenir au moins 10 caractères, dont une majuscule, une minuscule, un chiffre et un caractère spécial.";

const SPECIAL_CHAR = /[^A-Za-z0-9]/;

export function isPasswordCompliant(password: string): boolean {
  return (
    typeof password === "string" &&
    password.length >= PASSWORD_MIN_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    SPECIAL_CHAR.test(password)
  );
}

/** Schéma zod à utiliser dans toutes les routes acceptant un mot de passe. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE)
  .max(128)
  .refine(isPasswordCompliant, { message: PASSWORD_POLICY_MESSAGE });
