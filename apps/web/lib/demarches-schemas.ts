import { z } from "zod";

/// Schémas partagés des fiches demandeur et parcelle (module démarches).
/// Ils vivent hors des fichiers de route : Next.js n'autorise dans
/// `route.ts` que les exports de handlers HTTP.

export const demandeurSchema = z.object({
  typePersonne: z.enum(["PHYSIQUE", "MORALE"]).default("PHYSIQUE"),
  civilite: z.string().optional().nullable(),
  nom: z.string().min(1),
  prenoms: z.string().optional().nullable(),
  dateNaissance: z.string().optional().nullable(),
  lieuNaissance: z.string().optional().nullable(),
  nationalite: z.string().optional().nullable(),
  profession: z.string().optional().nullable(),
  situationMatrimoniale: z.string().optional().nullable(),
  pieceIdentiteType: z.string().optional().nullable(),
  pieceIdentiteNumero: z.string().optional().nullable(),
  pieceIdentiteExpiration: z.string().optional().nullable(),
  raisonSociale: z.string().optional().nullable(),
  formeJuridique: z.string().optional().nullable(),
  ninea: z.string().optional().nullable(),
  rccm: z.string().optional().nullable(),
  siegeSocial: z.string().optional().nullable(),
  representantLegal: z.string().optional().nullable(),
  qualiteSignataire: z.string().optional().nullable(),
  piecePouvoir: z.string().optional().nullable(),
  adresse: z.string().optional().nullable(),
  commune: z.string().optional().nullable(),
  departement: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  telephone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  adresseCorrespondance: z.string().optional().nullable(),
  centreFiscal: z.string().optional().nullable(),
  numeroContribuable: z.string().optional().nullable(),
  exerciceFiscal: z.string().optional().nullable(),
  mandat: z.record(z.string(), z.any()).optional().nullable(),
  confidentialite: z.record(z.string(), z.any()).optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
});

export const demandeurPatchSchema = demandeurSchema.partial().extend({
  nom: z.string().min(1).optional(),
});

export function demandeurData(data: z.infer<typeof demandeurSchema> | z.infer<typeof demandeurPatchSchema>) {
  const out: Record<string, unknown> = { ...data };
  for (const k of ["dateNaissance", "pieceIdentiteExpiration"] as const) {
    if (k in data) out[k] = data[k] ? new Date(data[k] as string) : null;
  }
  if ("email" in data && !data.email) out.email = null;
  return out;
}

export const parcelleSchema = z.object({
  region: z.string().optional().nullable(),
  departement: z.string().optional().nullable(),
  commune: z.string().optional().nullable(),
  quartier: z.string().optional().nullable(),
  adresse: z.string().optional().nullable(),
  nicad: z.string().optional().nullable(),
  titreFoncier: z.string().optional().nullable(),
  typeDroit: z.string().optional().nullable(),
  referenceDroit: z.string().optional().nullable(),
  lot: z.string().optional().nullable(),
  bloc: z.string().optional().nullable(),
  ilot: z.string().optional().nullable(),
  numeroParcelle: z.string().optional().nullable(),
  section: z.string().optional().nullable(),
  superficie: z.number().optional().nullable(),
  uniteSuperficie: z.string().optional().nullable(),
  coordonnees: z.record(z.string(), z.any()).optional().nullable(),
  titulaires: z.array(z.record(z.string(), z.any())).optional().nullable(),
  origineDroit: z.string().optional().nullable(),
  dateActe: z.string().optional().nullable(),
  referencesEnregistrement: z.string().optional().nullable(),
  chargesInscriptions: z.string().optional().nullable(),
  usageActuel: z.string().optional().nullable(),
  usageProjete: z.string().optional().nullable(),
  referencesPlans: z.string().optional().nullable(),
  auteurPlans: z.string().optional().nullable(),
  etatVerification: z
    .enum(["DECLARE", "PIECES_RECUES", "A_VERIFIER", "VERIFIE", "INCOHERENT"])
    .optional(),
});

export const parcellePatchSchema = parcelleSchema.partial();

export function parcelleData(data: z.infer<typeof parcelleSchema> | z.infer<typeof parcellePatchSchema>) {
  const out: Record<string, unknown> = { ...data };
  if ("dateActe" in data) out.dateActe = data.dateActe ? new Date(data.dateActe) : null;
  for (const k of Object.keys(out)) {
    if (out[k] === undefined) delete out[k];
  }
  return out;
}
