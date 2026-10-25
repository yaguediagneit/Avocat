export interface SignatureRequest {
  documentId: string;
  signataires: { email: string; prenom: string; nom: string }[];
  message?: string;
}

export interface SignatureResponse {
  demandeId: string;
  statut: "envoye" | "signe" | "refuse" | "expire";
  url?: string;
}

export async function requestSignature(
  input: SignatureRequest
): Promise<SignatureResponse> {
  // TODO: intégrer un prestataire de signature électronique qualifié
  console.log("Demande de signature pour", input.documentId, input.signataires);

  return {
    demandeId: `SIG-${Date.now()}`,
    statut: "envoye",
    url: "https://prestataire-signature.example/sign/xyz",
  };
}
