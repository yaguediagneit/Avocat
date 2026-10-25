import { z } from "zod";

/// Schémas partagés du module « Transactions & contrats ».
/// Ils vivent hors des fichiers de route : Next.js n'autorise dans
/// `route.ts` que les exports de handlers HTTP.

const uuid = z.string().uuid();
const dateStr = z.string().optional().nullable();

export const transactionSchema = z.object({
  typeId: uuid,
  sousType: z.string().optional().nullable(),
  dossierId: uuid,
  objet: z.string().optional().nullable(),
  priorite: z.enum(["BASSE", "NORMALE", "HAUTE", "URGENTE"]).default("NORMALE"),
  // Conditions financières
  prix: z.number().int().optional().nullable(),
  devise: z.string().default("XOF"),
  loyer: z.number().int().optional().nullable(),
  depotGarantie: z.number().int().optional().nullable(),
  avanceLoyer: z.number().int().optional().nullable(),
  echeancier: z.array(z.record(z.string(), z.any())).optional().nullable(),
  conditionsSuspensives: z.string().optional().nullable(),
  jourEcheanceLoyer: z.number().int().optional().nullable(),
  // Circuit notarial / foncier
  notaireNom: z.string().optional().nullable(),
  notaireEtude: z.string().optional().nullable(),
  notaireContact: z.string().optional().nullable(),
  mandatSigne: z.boolean().optional(),
  documentMandatId: uuid.optional().nullable(),
  etatDroitsReelsObtenu: z.boolean().optional(),
  depotConservationLe: dateStr,
  mutationInscrite: z.boolean().optional(),
  mutationInscriteLe: dateStr,
  documentMutationId: uuid.optional().nullable(),
  // Bail
  dateEffet: dateStr,
  dateFin: dateStr,
  dureeMois: z.number().int().optional().nullable(),
  renouvellement: z.string().optional().nullable(),
  droitDeLouerVerifie: z.boolean().optional(),
  etatLieuxEntreeFait: z.boolean().optional(),
  etatLieuxSortieFait: z.boolean().optional(),
  // Bail — conditions financières détaillées
  chargesMensuelles: z.number().int().optional().nullable(),
  chargesMode: z.enum(["FIXE", "POURCENTAGE", "INCLUSES"]).optional().nullable(),
  chargesIncluses: z.boolean().optional(),
  modePaiementLoyer: z.enum(["VIREMENT", "ESPECES", "CHEQUE", "PRELEVEMENT", "MOBILE_MONEY"]).optional().nullable(),
  clausesParticulieres: z.array(z.string()).optional().nullable(),
  // Mandat — type et commission de l'intermédiaire
  typeMandat: z.enum(["GESTION", "LOCATION", "SIMPLE", "EXCLUSIF", "AUTRE"]).optional().nullable(),
  commissionType: z.enum(["POURCENTAGE", "FIXE"]).optional().nullable(),
  commissionValeur: z.number().optional().nullable(),
  commissionBase: z.string().optional().nullable(),
  // Vente — décomposition financière
  honorairesAgence: z.number().int().optional().nullable(),
  tva: z.number().int().optional().nullable(),
  taxesMunicipales: z.number().int().optional().nullable(),
  fraisNotaire: z.number().int().optional().nullable(),
  netVendeur: z.number().int().optional().nullable(),
  /// Générer l'échéancier de loyers à la création (baux).
  genererEcheances: z.boolean().optional(),
  // Général
  qualification: z.record(z.string(), z.any()).optional().nullable(),
  signaturePrevue: dateStr,
  acteSigneLe: dateStr,
  documentActeId: uuid.optional().nullable(),
  remisAuClientLe: dateStr,
  responsableId: uuid.optional().nullable(),
  assistanteId: uuid.optional().nullable(),
  honoraires: z.number().int().optional(),
  debours: z.number().int().optional(),
  avancesRecues: z.number().int().optional(),
  // Rattachements au moment de la création
  biensIds: z.array(uuid).optional(),
  parties: z
    .array(
      z.object({
        role: z.string().min(1),
        demandeurId: uuid.optional().nullable(),
        clientId: uuid.optional().nullable(),
        nomLibre: z.string().optional().nullable(),
        qualite: z.string().optional().nullable(),
      })
    )
    .optional(),
});

const TRANSACTION_DATE_KEYS = [
  "depotConservationLe",
  "mutationInscriteLe",
  "dateEffet",
  "dateFin",
  "signaturePrevue",
  "acteSigneLe",
  "remisAuClientLe",
] as const;

export const transactionPatchSchema = transactionSchema.partial().omit({ dossierId: true });

export function transactionData(
  data: z.infer<typeof transactionSchema> | z.infer<typeof transactionPatchSchema>
) {
  const out: Record<string, unknown> = { ...data };
  delete out.biensIds;
  delete out.parties;
  delete out.genererEcheances;
  for (const k of TRANSACTION_DATE_KEYS) {
    if (k in data) out[k] = (data as Record<string, unknown>)[k] ? new Date((data as Record<string, unknown>)[k] as string) : null;
  }
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

export const transactionTransitionSchema = z.object({
  cible: z.string().min(1),
  motif: z.string().optional().nullable(),
});

export const transactionPartieSchema = z.object({
  role: z.string().min(1),
  demandeurId: uuid.optional().nullable(),
  clientId: uuid.optional().nullable(),
  nomLibre: z.string().optional().nullable(),
  coordonnees: z.string().optional().nullable(),
  qualite: z.string().optional().nullable(),
  representePar: z.string().optional().nullable(),
  ordre: z.number().int().optional(),
});

export const transactionPartiePatchSchema = transactionPartieSchema.partial().omit({ role: true });

export const transactionPieceSchema = z.object({
  code: z.string().min(1),
  libelle: z.string().min(1),
  categorie: z.string().min(1),
  niveau: z.enum(["OBLIGATOIRE", "CONDITIONNELLE", "FACULTATIVE"]).default("OBLIGATOIRE"),
  condition: z.string().optional().nullable(),
  partieConcernee: z.string().optional().nullable(),
  sourceAttendue: z.string().optional().nullable(),
  ordre: z.number().int().optional(),
});

export const transactionPiecePatchSchema = z.object({
  statut: z
    .enum(["NON_DEMANDEE", "DEMANDEE", "RECUE", "ILLISIBLE", "EXPIREE", "VALIDEE", "NON_APPLICABLE", "REJETEE"])
    .optional(),
  documentId: uuid.optional().nullable(),
  expireLe: dateStr,
  commentaire: z.string().optional().nullable(),
  visibleClient: z.boolean().optional(),
  niveau: z.enum(["OBLIGATOIRE", "CONDITIONNELLE", "FACULTATIVE"]).optional(),
});

export const transactionPaiementSchema = z.object({
  nature: z.string().min(1),
  libelle: z.string().optional().nullable(),
  montant: z.number().int().positive(),
  devise: z.string().default("XOF"),
  payeur: z.string().optional().nullable(),
  beneficiaire: z.string().optional().nullable(),
  mode: z.enum(["ESPECE", "VIREMENT", "CHEQUE", "MOBILE_MONEY", "SEQUESTRE", "AUTRE"]).optional().nullable(),
  date: dateStr,
  reference: z.string().optional().nullable(),
  documentId: uuid.optional().nullable(),
  rapproche: z.boolean().optional(),
  formaliteId: uuid.optional().nullable(),
});

export const transactionPaiementPatchSchema = transactionPaiementSchema.partial().omit({ nature: true, montant: true });

export const transactionFormaliteSchema = z.object({
  entite: z.string().min(1),
  bureau: z.string().optional().nullable(),
  objet: z.string().min(1),
  niveauObligation: z.enum(["OBLIGATOIRE", "CONDITIONNELLE", "RECOMMANDEE"]).default("CONDITIONNELLE"),
  statut: z
    .enum([
      "BROUILLON",
      "A_PREPARER",
      "PIECES_MANQUANTES",
      "PRET_A_DEPOT",
      "DEPOSE",
      "DEPOT_A_CONFIRMER",
      "COMPLEMENT_DEMANDE",
      "EN_INSTRUCTION",
      "RELANCE",
      "ACCEPTE",
      "REFUSE",
      "EXPIRE",
      "CLOTURE",
    ])
    .optional(),
  demarcheId: uuid.optional().nullable(),
  canalDepot: z.string().optional().nullable(),
  deposePar: z.string().optional().nullable(),
  dateDepot: dateStr,
  numeroRecepisse: z.string().optional().nullable(),
  quittance: z.string().optional().nullable(),
  echeanceReponse: dateStr,
  prochaineRelance: dateStr,
  decisionDate: dateStr,
  documentReponseId: uuid.optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const transactionFormalitePatchSchema = transactionFormaliteSchema.partial().omit({ entite: true, objet: true });

export function formaliteData(
  data: z.infer<typeof transactionFormaliteSchema> | z.infer<typeof transactionFormalitePatchSchema>
) {
  const out: Record<string, unknown> = { ...data };
  for (const k of ["dateDepot", "echeanceReponse", "prochaineRelance", "decisionDate"] as const) {
    if (k in data) out[k] = data[k] ? new Date(data[k] as string) : null;
  }
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

export const transactionEvenementSchema = z.object({
  type: z.string().min(1),
  date: dateStr,
  description: z.string().optional().nullable(),
  details: z.record(z.string(), z.any()).optional().nullable(),
});

export const bienSchema = z.object({
  nature: z.string().default("IMMEUBLE"),
  designation: z.string().min(1),
  adresse: z.string().optional().nullable(),
  quartier: z.string().optional().nullable(),
  commune: z.string().optional().nullable(),
  departement: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  superficie: z.number().optional().nullable(),
  uniteSuperficie: z.string().optional().nullable(),
  nbPieces: z.number().int().optional().nullable(),
  nbChambres: z.number().int().optional().nullable(),
  etage: z.string().optional().nullable(),
  equipements: z.string().optional().nullable(),
  referenceBien: z.string().optional().nullable(),
  typeDroit: z.string().optional().nullable(),
  referenceDroit: z.string().optional().nullable(),
  etatVerification: z
    .enum(["DECLARE", "PIECES_RECUES", "A_VERIFIER", "VERIFIE", "INCOHERENT"])
    .optional(),
  occupation: z.string().optional().nullable(),
  occupants: z.string().optional().nullable(),
  charges: z.string().optional().nullable(),
  loyerMensuel: z.number().int().optional().nullable(),
  parcelleId: uuid.optional().nullable(),
  proprietaireId: uuid.optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const bienPatchSchema = bienSchema.partial().omit({ designation: true });

export const transactionTypeSchema = z.object({
  code: z.string().min(1).optional(),
  libelle: z.string().min(1),
  famille: z.string().min(1),
  workflow: z.enum(["VENTE_TF", "BAIL", "GENERIQUE"]).default("GENERIQUE"),
  circuitPrincipal: z.string().optional().nullable(),
  bienRequis: z.boolean().optional(),
  notaireObligatoire: z.boolean().optional(),
  mutationFonciere: z.boolean().optional(),
  enregistrementAEvaluer: z.boolean().optional(),
  qualificationObligatoire: z.boolean().optional(),
  validationAvocat: z.boolean().optional(),
  sensible: z.boolean().optional(),
  nbExemplaires: z.number().int().optional(),
  delaiRelanceJours: z.number().int().optional(),
  avertissement: z.string().optional().nullable(),
  ordre: z.number().int().optional(),
  actif: z.boolean().optional(),
});

export const transactionTypePatchSchema = transactionTypeSchema.partial().omit({ libelle: true, famille: true });

export const transactionTypePieceSchema = z.object({
  code: z.string().min(1),
  libelle: z.string().min(1),
  categorie: z.string().min(1),
  niveau: z.enum(["OBLIGATOIRE", "CONDITIONNELLE", "FACULTATIVE"]).default("OBLIGATOIRE"),
  condition: z.string().optional().nullable(),
  partieConcernee: z.string().optional().nullable(),
  sourceAttendue: z.string().optional().nullable(),
  ordre: z.number().int().optional(),
  actif: z.boolean().optional(),
});

export const transactionDerogationSchema = z.object({
  pieceId: uuid,
  motif: z.string().min(5, "Le motif de la dérogation est obligatoire"),
});

export const transactionModeleSchema = z.object({
  code: z.string().min(1),
  titre: z.string().min(1),
  typeId: uuid.optional().nullable(),
  validationMinimale: z.string().optional().nullable(),
  contenu: z.string().min(1),
  ordre: z.number().int().optional(),
  actif: z.boolean().optional(),
});

export const transactionModelePatchSchema = transactionModeleSchema
  .partial()
  .omit({ code: true });

// ─── Échéances de loyer / reversements ───────────────────────────

export const ECHEANCE_NATURES = ["LOYER", "CHARGES", "REVERSEMENT_BAILLEUR", "AUTRE"] as const;
export const ECHEANCE_STATUTS = ["A_PERCEVOIR", "PARTIEL", "PAYE", "EN_RETARD", "ANNULE"] as const;

export const transactionEcheanceSchema = z.object({
  nature: z.enum(ECHEANCE_NATURES).default("LOYER"),
  /// Premier jour du mois de la période (YYYY-MM-DD) ou date d'échéance.
  periode: z.string().min(4),
  jourEcheance: z.number().int().min(1).max(31).optional().nullable(),
  montantDu: z.number().int().nonnegative(),
  montantPaye: z.number().int().nonnegative().optional(),
  beneficiaire: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  /// true → génère tout l'échéancier du bail (loyer + charges + reversement).
  generer: z.boolean().optional(),
});

export const transactionEcheancePatchSchema = z.object({
  montantDu: z.number().int().nonnegative().optional(),
  montantPaye: z.number().int().nonnegative().optional(),
  statut: z.enum(ECHEANCE_STATUTS).optional(),
  payeLe: dateStr,
  modePaiement: z.enum(["ESPECE", "VIREMENT", "CHEQUE", "MOBILE_MONEY", "AUTRE"]).optional().nullable(),
  beneficiaire: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  /// Enregistrer aussi un TransactionPaiement (traçabilité financière).
  enregistrerPaiement: z.boolean().optional(),
});

// ─── États des lieux ──────────────────────────────────────────────

export const ETAT_ELEMENT_STATUTS = ["NEUF", "BON", "MOYEN", "USE", "DEGRADE", "CASSE"] as const;

export const etatLieuxLigneSchema = z.object({
  objet: z.string().min(1),
  emplacement: z.string().optional().nullable(),
  typeElement: z.string().optional().nullable(),
  ordre: z.number().int().optional(),
  quantiteEntree: z.number().int().optional().nullable(),
  etatEntree: z.enum(ETAT_ELEMENT_STATUTS).optional().nullable(),
  obsEntree: z.string().optional().nullable(),
  quantiteSortie: z.number().int().optional().nullable(),
  etatSortie: z.enum(ETAT_ELEMENT_STATUTS).optional().nullable(),
  obsSortie: z.string().optional().nullable(),
});

export const etatLieuxSchema = z.object({
  typeLocation: z.enum(["VIDE", "MEUBLEE"]).default("VIDE"),
  statut: z.enum(["BROUILLON", "FINALISE_ENTREE", "FINALISE_SORTIE", "CLOTURE"]).default("BROUILLON"),
  dateEntree: dateStr,
  dateSortie: dateStr,
  nbCles: z.number().int().optional().nullable(),
  nbPieces: z.number().int().optional().nullable(),
  etage: z.string().optional().nullable(),
  surface: z.number().optional().nullable(),
  dependances: z.string().optional().nullable(),
  compteurEau: z.string().optional().nullable(),
  compteurElectricite: z.string().optional().nullable(),
  representant: z.string().optional().nullable(),
  observations: z.string().optional().nullable(),
  documentId: uuid.optional().nullable(),
  /// Remplacement complet des lignes du tableau entrée/sortie.
  lignes: z.array(etatLieuxLigneSchema).optional(),
});

export const etatLieuxPatchSchema = etatLieuxSchema.partial();

const ETAT_LIEUX_DATE_KEYS = ["dateEntree", "dateSortie"] as const;

export function etatLieuxData(
  data: z.infer<typeof etatLieuxSchema> | z.infer<typeof etatLieuxPatchSchema>
) {
  const out: Record<string, unknown> = { ...data };
  delete out.lignes;
  for (const k of ETAT_LIEUX_DATE_KEYS) {
    if (k in data) out[k] = (data as Record<string, unknown>)[k] ? new Date((data as Record<string, unknown>)[k] as string) : null;
  }
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}
