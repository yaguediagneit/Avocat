export interface UserSession {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  mfaVerified: boolean;
}

export interface CreateDossierInput {
  referenceInterne: string;
  typeAffaire: string;
  natureMission: string[];
  clientId: string;
  avocatResponsableId: string;
  statut?: string;
}

export interface DossierListItem {
  id: string;
  referenceInterne: string;
  typeAffaire: string;
  statut: string;
  client: { raisonSociale: string };
}
