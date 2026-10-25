-- CreateTable
CREATE TABLE "account_mappings" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "journal_code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_accounts" (
    "id" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "class" INTEGER NOT NULL,
    "sub_class" INTEGER NOT NULL,
    "account_type" TEXT NOT NULL DEFAULT 'ACTIF',
    "level" INTEGER NOT NULL DEFAULT 1,
    "parent_id" TEXT,
    "solde_initial" INTEGER NOT NULL DEFAULT 0,
    "solde_actuel" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_auxiliary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_entries" (
    "id" TEXT NOT NULL,
    "journal_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "libelle" TEXT NOT NULL,
    "total_debit" INTEGER NOT NULL DEFAULT 0,
    "total_credit" INTEGER NOT NULL DEFAULT 0,
    "is_validated" BOOLEAN NOT NULL DEFAULT false,
    "validated_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "idempotency_key" TEXT,
    "tenant_id" TEXT NOT NULL,

    CONSTRAINT "accounting_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_entry_lines" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "debit" INTEGER NOT NULL DEFAULT 0,
    "credit" INTEGER NOT NULL DEFAULT 0,
    "libelle" TEXT,
    "third_party_type" TEXT,
    "third_party_id" TEXT,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" TEXT NOT NULL,

    CONSTRAINT "accounting_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_exercises" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_journals" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "journal_type" TEXT NOT NULL DEFAULT 'OD',
    "default_debit_account_id" TEXT,
    "default_credit_account_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_taxes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "account_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_taxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" TEXT,
    "details" JSONB,
    "adresseIp" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_logs" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "call_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "channel" TEXT NOT NULL DEFAULT 'telephone',
    "contact_name" TEXT,
    "structure" TEXT,
    "subject" TEXT,
    "notes" TEXT,
    "client_id" TEXT,
    "employee_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_amortissements" (
    "id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "cumul" INTEGER NOT NULL DEFAULT 0,
    "vnc" INTEGER NOT NULL DEFAULT 0,
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    "accounting_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charge_amortissements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "account_code" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charge_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_lines" (
    "id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "prix_unitaire" INTEGER NOT NULL DEFAULT 0,
    "taux_tva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_ht" INTEGER NOT NULL DEFAULT 0,
    "total_tva" INTEGER NOT NULL DEFAULT 0,
    "total_ttc" INTEGER NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charge_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charges" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "charge_date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "total_ht" INTEGER,
    "tax_amount" INTEGER,
    "tva_rate_id" TEXT,
    "payment_method" TEXT NOT NULL,
    "description" TEXT,
    "supplier_name" TEXT,
    "supplier_invoice_ref" TEXT,
    "attachment_key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMP(3),
    "accounting_entry_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tva_enabled" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dossier_id" TEXT,
    "tache_id" TEXT,
    "mission_huissier_id" TEXT,
    "amortissement_start_date" TIMESTAMP(3),
    "immobilisation_account_code" TEXT,
    "immobilisation_mode" TEXT,
    "immobilisation_months" INTEGER,
    "immobilisation_rate" DOUBLE PRECISION,
    "is_immobilisation" BOOLEAN NOT NULL DEFAULT false,
    "monthly_payment" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_cloture" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "coche" BOOLEAN NOT NULL DEFAULT false,
    "cochePar" TEXT,
    "cocheLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_cloture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_requests" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'nouvelle',
    "client_id" TEXT,
    "requester_name" TEXT,
    "requester_phone" TEXT,
    "requester_email" TEXT,
    "request_date" TIMESTAMP(3),
    "response_status" TEXT,
    "response_date" TIMESTAMP(3),
    "response_detail" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "raisonSociale" TEXT NOT NULL,
    "identifiant" TEXT,
    "adresse" TEXT,
    "coordonnees" JSONB,
    "representants" JSONB,
    "billingInfo" JSONB,
    "consentements" JSONB,
    "documentsAdmin" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commentaires_dossier" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "auteurId" TEXT NOT NULL,
    "auteurNom" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'commentaire',
    "luPar" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commentaires_dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conflits_interet" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "dossierConflitId" TEXT NOT NULL,
    "typeConflit" TEXT NOT NULL,
    "details" JSONB,
    "statut" TEXT NOT NULL DEFAULT 'detecte',
    "validePar" TEXT,
    "dateVerification" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conflits_interet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_formalities" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_cours',
    "due_date" TIMESTAMP(3),
    "completed_date" TIMESTAMP(3),
    "dossier_id" TEXT,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "court_formalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverage_requests" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "insured_employee_id" TEXT NOT NULL,
    "dependent_id" TEXT,
    "contract_id" TEXT NOT NULL,
    "quote_id" TEXT,
    "provider_id" TEXT NOT NULL,
    "date_soins_prevue" TIMESTAMP(3) NOT NULL,
    "montant_estime" INTEGER NOT NULL,
    "taux_demande" DOUBLE PRECISION NOT NULL,
    "montant_pris_en_charge_estime" INTEGER NOT NULL DEFAULT 0,
    "montant_employe_estime" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "date_envoi" TIMESTAMP(3),
    "date_reponse" TIMESTAMP(3),
    "date_expiration" TIMESTAMP(3),
    "commentaire_assureur" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coverage_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "s3KeyChiffre" TEXT NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "versionCourante" INTEGER NOT NULL DEFAULT 1,
    "publieClient" BOOLEAN NOT NULL DEFAULT false,
    "datePublication" TIMESTAMP(3),
    "dateExpiration" TIMESTAMP(3),
    "creePar" TEXT NOT NULL,
    "validePar" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statutValidation" TEXT NOT NULL DEFAULT 'brouillon',
    "relecteurId" TEXT,
    "dateRelecture" TIMESTAMP(3),
    "circuitValidation" JSONB,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "partageExterne" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossier_collaborateurs" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleRACI" TEXT NOT NULL,
    "discipline" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tacheAttendue" JSONB,

    CONSTRAINT "dossier_collaborateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossiers" (
    "id" TEXT NOT NULL,
    "referenceInterne" TEXT NOT NULL,
    "typeAffaire" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "partiesAdverses" JSONB,
    "juridictionId" TEXT,
    "avocatResponsableId" TEXT NOT NULL,
    "huissierResponsableId" TEXT,
    "collaborateurs" JSONB,
    "dateOuverture" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "niveauConfidentialite" INTEGER NOT NULL DEFAULT 1,
    "statut" TEXT NOT NULL DEFAULT 'Nouveau',
    "dateEcheance" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createurId" TEXT,
    "partageClient" BOOLEAN NOT NULL DEFAULT false,
    "natureMission" JSONB NOT NULL,

    CONSTRAINT "dossiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossiers_immobiliers" (
    "dossierId" TEXT NOT NULL,
    "adresseBien" TEXT,
    "titreFoncier" TEXT,
    "natureBien" TEXT,
    "proprietaire" TEXT,
    "occupant" TEXT,
    "montantLitige" INTEGER,
    "expertId" TEXT,
    "notaireId" TEXT,
    "documentsPropriete" JSONB,

    CONSTRAINT "dossiers_immobiliers_pkey" PRIMARY KEY ("dossierId")
);

-- CreateTable
CREATE TABLE "employee_dependents" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "insured_employee_id" TEXT,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "sexe" TEXT,
    "date_naissance" TIMESTAMP(3),
    "lien_familial" TEXT NOT NULL,
    "numero_adherent" TEXT,
    "date_debut_couverture" TIMESTAMP(3),
    "date_fin_couverture" TIMESTAMP(3),
    "taux_particulier" DOUBLE PRECISION,
    "plafond_particulier" INTEGER,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "justificatif_path" TEXT,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_dependents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_history" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_insurance_payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "date_paiement" TIMESTAMP(3) NOT NULL,
    "mode_paiement" TEXT NOT NULL,
    "reference_paiement" TEXT,
    "recu_path" TEXT,
    "received_by" TEXT NOT NULL,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_insurance_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_leave_settings" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "jours_par_mois" DOUBLE PRECISION,
    "date_debut_acquisition" TIMESTAMP(3),
    "autoriser_anticipation" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_leave_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employee_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "position" TEXT,
    "department" TEXT,
    "hire_date" TIMESTAMP(3) NOT NULL,
    "contract_type" TEXT NOT NULL,
    "base_salary" INTEGER NOT NULL,
    "cnss_number" TEXT,
    "ipres_number" TEXT,
    "bank_account" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "marital_status" TEXT NOT NULL,
    "nb_children" INTEGER NOT NULL DEFAULT 0,
    "tax_shares" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "contract_end_date" TIMESTAMP(3),
    "regime" TEXT NOT NULL DEFAULT 'general',
    "manager_id" TEXT,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evenements" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT,
    "type" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "lieu" TEXT,
    "participants" JSONB,
    "estPublicClient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "commentaires" JSONB,
    "createurId" TEXT,

    CONSTRAINT "evenements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facture_lines" (
    "id" TEXT NOT NULL,
    "facture_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "prix_unitaire" INTEGER NOT NULL DEFAULT 0,
    "taux_tva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_ht" INTEGER NOT NULL DEFAULT 0,
    "total_tva" INTEGER NOT NULL DEFAULT 0,
    "total_ttc" INTEGER NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facture_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factures" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT,
    "clientId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "honoraires" JSONB,
    "debours" INTEGER,
    "frais" INTEGER,
    "totalTtc" INTEGER NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'Brouillon',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "designation" TEXT,
    "intervenants" JSONB,
    "libelle" TEXT,
    "date_echeance" TIMESTAMP(3),
    "date_emission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_ht" INTEGER NOT NULL DEFAULT 0,
    "total_tva" INTEGER NOT NULL DEFAULT 0,
    "tva_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tva_rate_id" TEXT,
    "accounting_entry_id" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "mission_huissier_id" TEXT,
    "tache_id" TEXT,

    CONSTRAINT "factures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hearings" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "dossier_id" TEXT,
    "attendees" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planifie',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hearings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "date_jour" DATE NOT NULL,
    "libelle" TEXT NOT NULL,
    "national" BOOLEAN NOT NULL DEFAULT true,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_contracts" (
    "id" TEXT NOT NULL,
    "insurer_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3) NOT NULL,
    "type_couverture" TEXT NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "taux_general" DOUBLE PRECISION NOT NULL,
    "montant_avance" INTEGER NOT NULL DEFAULT 0,
    "date_paiement_avance" TIMESTAMP(3),
    "mode_paiement_avance" TEXT,
    "reference_paiement_avance" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "conditions" TEXT,
    "document_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_period_closures" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "periode_debut" TIMESTAMP(3) NOT NULL,
    "periode_fin" TIMESTAMP(3) NOT NULL,
    "total_factures" INTEGER NOT NULL DEFAULT 0,
    "total_part_employes" INTEGER NOT NULL DEFAULT 0,
    "total_paye_employes" INTEGER NOT NULL DEFAULT 0,
    "total_part_cabinet" INTEGER NOT NULL DEFAULT 0,
    "total_avances" INTEGER NOT NULL DEFAULT 0,
    "solde_a_payer" INTEGER NOT NULL DEFAULT 0,
    "credit_a_reporter" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'ouverte',
    "valide_par" TEXT,
    "date_validation" TIMESTAMP(3),
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_period_closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_quotes" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "insured_employee_id" TEXT NOT NULL,
    "dependent_id" TEXT,
    "contract_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "date_devis" TIMESTAMP(3) NOT NULL,
    "date_validite" TIMESTAMP(3),
    "type_soin" TEXT NOT NULL,
    "montant_total" INTEGER NOT NULL,
    "taux_applique" DOUBLE PRECISION NOT NULL,
    "part_cabinet_estimee" INTEGER NOT NULL DEFAULT 0,
    "part_employe_estimee" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "document_path" TEXT,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insured_employees" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "numero_adherent" TEXT,
    "date_adhesion" TIMESTAMP(3) NOT NULL,
    "date_fin_couverture" TIMESTAMP(3),
    "formule" TEXT,
    "taux_particulier" DOUBLE PRECISION,
    "plafond_individuel" INTEGER,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insured_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurer_payments" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "type_paiement" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "date_paiement" TIMESTAMP(3) NOT NULL,
    "mode_paiement" TEXT NOT NULL,
    "reference_paiement" TEXT,
    "justificatif_path" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurer_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurers" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "telephone" TEXT,
    "telephone_secondaire" TEXT,
    "email" TEXT,
    "site_web" TEXT,
    "reference_interne" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "observations" TEXT,
    "manager_nom" TEXT,
    "manager_fonction" TEXT,
    "manager_telephone" TEXT,
    "manager_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_approvals" (
    "id" TEXT NOT NULL,
    "leave_request_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "ancien_statut" TEXT NOT NULL,
    "nouveau_statut" TEXT NOT NULL,
    "commentaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_policies" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "jours_par_mois" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "debut_acquisition" TEXT NOT NULL DEFAULT 'embauche',
    "autoriser_anticipation" BOOLEAN NOT NULL DEFAULT false,
    "compter_samedi" BOOLEAN NOT NULL DEFAULT true,
    "compter_dimanche" BOOLEAN NOT NULL DEFAULT false,
    "exclure_jours_feries" BOOLEAN NOT NULL DEFAULT true,
    "autoriser_report" BOOLEAN NOT NULL DEFAULT false,
    "duree_report_mois" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "approver_id" TEXT,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "nombre_jours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "motif" TEXT,
    "justificatif" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "commentaire_validation" TEXT,
    "submitted_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_transactions" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_request_id" TEXT,
    "periode_debut" DATE NOT NULL,
    "periode_fin" DATE NOT NULL,
    "type_transaction" TEXT NOT NULL,
    "nombre_jours" DOUBLE PRECISION NOT NULL,
    "libelle" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "deduit_solde_conge" BOOLEAN NOT NULL DEFAULT false,
    "necessite_justificatif" BOOLEAN NOT NULL DEFAULT false,
    "necessite_validation" BOOLEAN NOT NULL DEFAULT true,
    "remuneree" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mails" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "mail_date" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "structure" TEXT,
    "contact" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'recu',
    "dossier_id" TEXT,
    "signataire_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "dossier_label" TEXT,

    CONSTRAINT "mails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_invoices" (
    "id" TEXT NOT NULL,
    "reference_interne" TEXT NOT NULL,
    "numero_facture" TEXT,
    "insured_employee_id" TEXT NOT NULL,
    "dependent_id" TEXT,
    "contract_id" TEXT NOT NULL,
    "coverage_request_id" TEXT,
    "provider_id" TEXT NOT NULL,
    "date_soins" TIMESTAMP(3) NOT NULL,
    "date_facture" TIMESTAMP(3) NOT NULL,
    "type_soin" TEXT NOT NULL,
    "montant_total" INTEGER NOT NULL,
    "taux_applique" DOUBLE PRECISION NOT NULL,
    "part_cabinet" INTEGER NOT NULL DEFAULT 0,
    "part_employe" INTEGER NOT NULL DEFAULT 0,
    "montant_paye_employe" INTEGER NOT NULL DEFAULT 0,
    "reste_a_payer_employe" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "statut_paiement_employe" TEXT NOT NULL DEFAULT 'non_paye',
    "justificatif_path" TEXT,
    "commentaire" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_providers" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "type_prestataire" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_email_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_email_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missing_documents" (
    "id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "type_document" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'manquant',
    "relance_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missing_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions_architecte" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "typeActe" TEXT NOT NULL,
    "architecteId" TEXT NOT NULL,
    "adresseSignification" TEXT,
    "destinataire" TEXT,
    "datePrevue" TIMESTAMP(3),
    "fraisDeplacement" INTEGER,
    "debours" INTEGER,
    "dateTentative" TIMESTAMP(3),
    "dateRemise" TIMESTAMP(3),
    "resultat" TEXT,
    "preuveRemiseKey" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'En préparation',
    "retourKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "missions_architecte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions_clerc" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "typeActe" TEXT NOT NULL,
    "clercId" TEXT NOT NULL,
    "adresseSignification" TEXT,
    "destinataire" TEXT,
    "datePrevue" TIMESTAMP(3),
    "fraisDeplacement" INTEGER,
    "debours" INTEGER,
    "dateTentative" TIMESTAMP(3),
    "dateRemise" TIMESTAMP(3),
    "resultat" TEXT,
    "preuveRemiseKey" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'En préparation',
    "retourKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "missions_clerc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions_conseiller_juridique" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "typeActe" TEXT NOT NULL,
    "conseillerJuridiqueId" TEXT NOT NULL,
    "adresseSignification" TEXT,
    "destinataire" TEXT,
    "datePrevue" TIMESTAMP(3),
    "fraisDeplacement" INTEGER,
    "debours" INTEGER,
    "dateTentative" TIMESTAMP(3),
    "dateRemise" TIMESTAMP(3),
    "resultat" TEXT,
    "preuveRemiseKey" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'En préparation',
    "retourKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "missions_conseiller_juridique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions_huissier" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "typeActe" TEXT NOT NULL,
    "huissierId" TEXT NOT NULL,
    "adresseSignification" TEXT,
    "destinataire" TEXT,
    "datePrevue" TIMESTAMP(3),
    "fraisDeplacement" INTEGER,
    "debours" INTEGER,
    "dateTentative" TIMESTAMP(3),
    "dateRemise" TIMESTAMP(3),
    "resultat" TEXT,
    "preuveRemiseKey" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'En préparation',
    "retourKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "missions_huissier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dossierId" TEXT,
    "type" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severite" TEXT NOT NULL DEFAULT 'info',
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "luLe" TIMESTAMP(3),
    "dateDeclenchement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements" (
    "id" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "datePaiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" TEXT NOT NULL,
    "reference" TEXT,
    "preuveKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accounting_entry_id" TEXT,

    CONSTRAINT "paiements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametres" (
    "id" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_lines" (
    "id" TEXT NOT NULL,
    "payroll_id" TEXT NOT NULL,
    "rubric_id" TEXT NOT NULL,
    "rubric_code" TEXT NOT NULL,
    "rubric_label" TEXT NOT NULL,
    "rubric_type" TEXT NOT NULL,
    "calc_type" TEXT NOT NULL,
    "rate_or_amount" DOUBLE PRECISION NOT NULL,
    "base_amount" INTEGER NOT NULL,
    "computed_amount" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_rubrics" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "calc_type" TEXT NOT NULL,
    "rate_or_amount" DOUBLE PRECISION NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_rubrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrolls" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "base_salary" INTEGER NOT NULL,
    "gross_salary" INTEGER NOT NULL,
    "total_gains" INTEGER NOT NULL,
    "total_deductions" INTEGER NOT NULL,
    "total_cotisations" INTEGER NOT NULL,
    "css_base" INTEGER NOT NULL,
    "css_rate" DOUBLE PRECISION NOT NULL,
    "css_amount" INTEGER NOT NULL,
    "css_employer_amount" INTEGER NOT NULL,
    "ipres_base" INTEGER NOT NULL,
    "ipres_rate" DOUBLE PRECISION NOT NULL,
    "ipres_amount" INTEGER NOT NULL,
    "ipres_employer_amount" INTEGER NOT NULL,
    "irpp_taxable_base" INTEGER NOT NULL,
    "irpp_shares" DOUBLE PRECISION NOT NULL,
    "irpp_amount" INTEGER NOT NULL,
    "net_salary" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "paid_at" TIMESTAMP(3),
    "accounting_entry_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "total_employer_cost" INTEGER NOT NULL,
    "signed_document_url" TEXT,

    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions_dossier" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "niveau" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_missions" (
    "id" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "provider_name" TEXT NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'a_faire',
    "amount" INTEGER,
    "due_date" TIMESTAMP(3),
    "completed_date" TIMESTAMP(3),
    "dossier_id" TEXT,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "estAdmin" BOOLEAN NOT NULL DEFAULT false,
    "estClient" BOOLEAN NOT NULL DEFAULT false,
    "niveauConfidentialiteMax" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialites" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "selectionnee" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specialites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tache_templates" (
    "id" TEXT NOT NULL,
    "specialiteId" TEXT NOT NULL,
    "workflowEtapeId" TEXT,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "delaiJours" INTEGER NOT NULL DEFAULT 0,
    "roleAttendu" TEXT NOT NULL DEFAULT 'any',
    "priorite" TEXT NOT NULL DEFAULT 'moyenne',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contenuDocument" TEXT,
    "wordTemplateKey" TEXT,

    CONSTRAINT "tache_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taches" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "responsableId" TEXT NOT NULL,
    "createurId" TEXT NOT NULL,
    "echeance" TIMESTAMP(3),
    "priorite" TEXT NOT NULL DEFAULT 'moyenne',
    "statut" TEXT NOT NULL DEFAULT 'En cours',
    "checklist" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "commentaires" JSONB,

    CONSTRAINT "taches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tva_rates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tva_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "types_documents_specialite" (
    "id" TEXT NOT NULL,
    "specialiteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "obligatoire" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "types_documents_specialite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "mfaSecret" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "derniereConnexion" TIMESTAMP(3),
    "derniereIp" TEXT,
    "appareils" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT,
    "signatureKey" TEXT,
    "specialite" TEXT,
    "titre" TEXT,
    "calendar_token" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versions_document" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "s3KeyChiffre" TEXT NOT NULL,
    "numeroVersion" INTEGER NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "versions_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_specialite" (
    "id" TEXT NOT NULL,
    "specialiteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "estInitial" BOOLEAN NOT NULL DEFAULT false,
    "estFinal" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "statutDossier" TEXT,

    CONSTRAINT "workflow_specialite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_mappings_code_key" ON "account_mappings"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_accounts_account_code_key" ON "accounting_accounts"("account_code" ASC);

-- CreateIndex
CREATE INDEX "accounting_accounts_class_idx" ON "accounting_accounts"("class" ASC);

-- CreateIndex
CREATE INDEX "accounting_accounts_is_active_idx" ON "accounting_accounts"("is_active" ASC);

-- CreateIndex
CREATE INDEX "accounting_accounts_parent_id_idx" ON "accounting_accounts"("parent_id" ASC);

-- CreateIndex
CREATE INDEX "accounting_accounts_sub_class_idx" ON "accounting_accounts"("sub_class" ASC);

-- CreateIndex
CREATE INDEX "accounting_entries_is_validated_idx" ON "accounting_entries"("is_validated" ASC);

-- CreateIndex
CREATE INDEX "accounting_entries_reference_idx" ON "accounting_entries"("reference" ASC);

-- CreateIndex
CREATE INDEX "accounting_entries_tenant_id_entry_date_idx" ON "accounting_entries"("tenant_id" ASC, "entry_date" ASC);

-- CreateIndex
CREATE INDEX "accounting_entries_tenant_id_exercise_id_idx" ON "accounting_entries"("tenant_id" ASC, "exercise_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_entries_tenant_id_idempotency_key_key" ON "accounting_entries"("tenant_id" ASC, "idempotency_key" ASC);

-- CreateIndex
CREATE INDEX "accounting_entries_tenant_id_idx" ON "accounting_entries"("tenant_id" ASC);

-- CreateIndex
CREATE INDEX "accounting_entries_tenant_id_journal_id_idx" ON "accounting_entries"("tenant_id" ASC, "journal_id" ASC);

-- CreateIndex
CREATE INDEX "accounting_entry_lines_tenant_id_account_id_idx" ON "accounting_entry_lines"("tenant_id" ASC, "account_id" ASC);

-- CreateIndex
CREATE INDEX "accounting_entry_lines_tenant_id_entry_id_idx" ON "accounting_entry_lines"("tenant_id" ASC, "entry_id" ASC);

-- CreateIndex
CREATE INDEX "accounting_entry_lines_tenant_id_idx" ON "accounting_entry_lines"("tenant_id" ASC);

-- CreateIndex
CREATE INDEX "accounting_exercises_status_idx" ON "accounting_exercises"("status" ASC);

-- CreateIndex
CREATE INDEX "accounting_exercises_year_idx" ON "accounting_exercises"("year" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_journals_code_key" ON "accounting_journals"("code" ASC);

-- CreateIndex
CREATE INDEX "accounting_journals_is_active_idx" ON "accounting_journals"("is_active" ASC);

-- CreateIndex
CREATE INDEX "accounting_journals_journal_type_idx" ON "accounting_journals"("journal_type" ASC);

-- CreateIndex
CREATE INDEX "accounting_taxes_code_idx" ON "accounting_taxes"("code" ASC);

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "audit_logs_entite_entiteId_idx" ON "audit_logs"("entite" ASC, "entiteId" ASC);

-- CreateIndex
CREATE INDEX "call_logs_call_date_idx" ON "call_logs"("call_date" ASC);

-- CreateIndex
CREATE INDEX "call_logs_client_id_idx" ON "call_logs"("client_id" ASC);

-- CreateIndex
CREATE INDEX "call_logs_direction_idx" ON "call_logs"("direction" ASC);

-- CreateIndex
CREATE INDEX "call_logs_employee_id_idx" ON "call_logs"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "charge_amortissements_charge_id_idx" ON "charge_amortissements"("charge_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "charge_amortissements_charge_id_numero_key" ON "charge_amortissements"("charge_id" ASC, "numero" ASC);

-- CreateIndex
CREATE INDEX "charge_amortissements_due_date_idx" ON "charge_amortissements"("due_date" ASC);

-- CreateIndex
CREATE INDEX "charge_amortissements_is_posted_idx" ON "charge_amortissements"("is_posted" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "charge_categories_code_key" ON "charge_categories"("code" ASC);

-- CreateIndex
CREATE INDEX "charge_lines_charge_id_idx" ON "charge_lines"("charge_id" ASC);

-- CreateIndex
CREATE INDEX "charges_category_id_idx" ON "charges"("category_id" ASC);

-- CreateIndex
CREATE INDEX "charges_charge_date_idx" ON "charges"("charge_date" ASC);

-- CreateIndex
CREATE INDEX "charges_dossier_id_idx" ON "charges"("dossier_id" ASC);

-- CreateIndex
CREATE INDEX "charges_mission_huissier_id_idx" ON "charges"("mission_huissier_id" ASC);

-- CreateIndex
CREATE INDEX "charges_tache_id_idx" ON "charges"("tache_id" ASC);

-- CreateIndex
CREATE INDEX "checklist_cloture_dossierId_idx" ON "checklist_cloture"("dossierId" ASC);

-- CreateIndex
CREATE INDEX "client_requests_client_id_idx" ON "client_requests"("client_id" ASC);

-- CreateIndex
CREATE INDEX "client_requests_status_idx" ON "client_requests"("status" ASC);

-- CreateIndex
CREATE INDEX "client_requests_type_idx" ON "client_requests"("type" ASC);

-- CreateIndex
CREATE INDEX "commentaires_dossier_createdAt_idx" ON "commentaires_dossier"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "commentaires_dossier_dossierId_idx" ON "commentaires_dossier"("dossierId" ASC);

-- CreateIndex
CREATE INDEX "conflits_interet_dossierConflitId_idx" ON "conflits_interet"("dossierConflitId" ASC);

-- CreateIndex
CREATE INDEX "conflits_interet_dossierId_idx" ON "conflits_interet"("dossierId" ASC);

-- CreateIndex
CREATE INDEX "conflits_interet_statut_idx" ON "conflits_interet"("statut" ASC);

-- CreateIndex
CREATE INDEX "court_formalities_dossier_id_idx" ON "court_formalities"("dossier_id" ASC);

-- CreateIndex
CREATE INDEX "court_formalities_status_idx" ON "court_formalities"("status" ASC);

-- CreateIndex
CREATE INDEX "court_formalities_type_idx" ON "court_formalities"("type" ASC);

-- CreateIndex
CREATE INDEX "coverage_requests_contract_id_idx" ON "coverage_requests"("contract_id" ASC);

-- CreateIndex
CREATE INDEX "coverage_requests_insured_employee_id_idx" ON "coverage_requests"("insured_employee_id" ASC);

-- CreateIndex
CREATE INDEX "coverage_requests_provider_id_idx" ON "coverage_requests"("provider_id" ASC);

-- CreateIndex
CREATE INDEX "coverage_requests_quote_id_idx" ON "coverage_requests"("quote_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "coverage_requests_reference_key" ON "coverage_requests"("reference" ASC);

-- CreateIndex
CREATE INDEX "coverage_requests_statut_idx" ON "coverage_requests"("statut" ASC);

-- CreateIndex
CREATE INDEX "dossier_collaborateurs_dossierId_idx" ON "dossier_collaborateurs"("dossierId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "dossier_collaborateurs_dossierId_userId_key" ON "dossier_collaborateurs"("dossierId" ASC, "userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "dossiers_referenceInterne_key" ON "dossiers"("referenceInterne" ASC);

-- CreateIndex
CREATE INDEX "employee_dependents_employee_id_idx" ON "employee_dependents"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "employee_dependents_insured_employee_id_idx" ON "employee_dependents"("insured_employee_id" ASC);

-- CreateIndex
CREATE INDEX "employee_dependents_statut_idx" ON "employee_dependents"("statut" ASC);

-- CreateIndex
CREATE INDEX "employee_history_employee_id_field_changed_at_idx" ON "employee_history"("employee_id" ASC, "field" ASC, "changed_at" ASC);

-- CreateIndex
CREATE INDEX "employee_insurance_payments_invoice_id_idx" ON "employee_insurance_payments"("invoice_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "employee_leave_settings_employee_id_key" ON "employee_leave_settings"("employee_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code" ASC);

-- CreateIndex
CREATE INDEX "facture_lines_facture_id_idx" ON "facture_lines"("facture_id" ASC);

-- CreateIndex
CREATE INDEX "factures_mission_huissier_id_idx" ON "factures"("mission_huissier_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "factures_numero_key" ON "factures"("numero" ASC);

-- CreateIndex
CREATE INDEX "factures_tache_id_idx" ON "factures"("tache_id" ASC);

-- CreateIndex
CREATE INDEX "hearings_date_idx" ON "hearings"("date" ASC);

-- CreateIndex
CREATE INDEX "hearings_dossier_id_idx" ON "hearings"("dossier_id" ASC);

-- CreateIndex
CREATE INDEX "hearings_status_idx" ON "hearings"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_jour_key" ON "holidays"("date_jour" ASC);

-- CreateIndex
CREATE INDEX "insurance_contracts_date_debut_date_fin_idx" ON "insurance_contracts"("date_debut" ASC, "date_fin" ASC);

-- CreateIndex
CREATE INDEX "insurance_contracts_insurer_id_idx" ON "insurance_contracts"("insurer_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "insurance_contracts_reference_key" ON "insurance_contracts"("reference" ASC);

-- CreateIndex
CREATE INDEX "insurance_contracts_statut_idx" ON "insurance_contracts"("statut" ASC);

-- CreateIndex
CREATE INDEX "insurance_period_closures_contract_id_idx" ON "insurance_period_closures"("contract_id" ASC);

-- CreateIndex
CREATE INDEX "insurance_period_closures_statut_idx" ON "insurance_period_closures"("statut" ASC);

-- CreateIndex
CREATE INDEX "insurance_quotes_contract_id_idx" ON "insurance_quotes"("contract_id" ASC);

-- CreateIndex
CREATE INDEX "insurance_quotes_insured_employee_id_idx" ON "insurance_quotes"("insured_employee_id" ASC);

-- CreateIndex
CREATE INDEX "insurance_quotes_provider_id_idx" ON "insurance_quotes"("provider_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "insurance_quotes_reference_key" ON "insurance_quotes"("reference" ASC);

-- CreateIndex
CREATE INDEX "insured_employees_contract_id_idx" ON "insured_employees"("contract_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "insured_employees_employee_id_contract_id_key" ON "insured_employees"("employee_id" ASC, "contract_id" ASC);

-- CreateIndex
CREATE INDEX "insured_employees_employee_id_idx" ON "insured_employees"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "insured_employees_statut_idx" ON "insured_employees"("statut" ASC);

-- CreateIndex
CREATE INDEX "insurer_payments_contract_id_idx" ON "insurer_payments"("contract_id" ASC);

-- CreateIndex
CREATE INDEX "insurer_payments_statut_idx" ON "insurer_payments"("statut" ASC);

-- CreateIndex
CREATE INDEX "insurer_payments_type_paiement_idx" ON "insurer_payments"("type_paiement" ASC);

-- CreateIndex
CREATE INDEX "leave_approvals_actor_id_idx" ON "leave_approvals"("actor_id" ASC);

-- CreateIndex
CREATE INDEX "leave_approvals_leave_request_id_idx" ON "leave_approvals"("leave_request_id" ASC);

-- CreateIndex
CREATE INDEX "leave_requests_date_debut_idx" ON "leave_requests"("date_debut" ASC);

-- CreateIndex
CREATE INDEX "leave_requests_employee_id_idx" ON "leave_requests"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "leave_requests_statut_idx" ON "leave_requests"("statut" ASC);

-- CreateIndex
CREATE INDEX "leave_transactions_employee_id_idx" ON "leave_transactions"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "leave_transactions_type_transaction_idx" ON "leave_transactions"("type_transaction" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_code_key" ON "leave_types"("code" ASC);

-- CreateIndex
CREATE INDEX "mails_direction_idx" ON "mails"("direction" ASC);

-- CreateIndex
CREATE INDEX "mails_dossier_id_idx" ON "mails"("dossier_id" ASC);

-- CreateIndex
CREATE INDEX "mails_mail_date_idx" ON "mails"("mail_date" ASC);

-- CreateIndex
CREATE INDEX "mails_signataire_id_idx" ON "mails"("signataire_id" ASC);

-- CreateIndex
CREATE INDEX "mails_status_idx" ON "mails"("status" ASC);

-- CreateIndex
CREATE INDEX "medical_invoices_contract_id_idx" ON "medical_invoices"("contract_id" ASC);

-- CreateIndex
CREATE INDEX "medical_invoices_coverage_request_id_idx" ON "medical_invoices"("coverage_request_id" ASC);

-- CreateIndex
CREATE INDEX "medical_invoices_dependent_id_idx" ON "medical_invoices"("dependent_id" ASC);

-- CreateIndex
CREATE INDEX "medical_invoices_insured_employee_id_idx" ON "medical_invoices"("insured_employee_id" ASC);

-- CreateIndex
CREATE INDEX "medical_invoices_provider_id_idx" ON "medical_invoices"("provider_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "medical_invoices_reference_interne_key" ON "medical_invoices"("reference_interne" ASC);

-- CreateIndex
CREATE INDEX "medical_invoices_statut_idx" ON "medical_invoices"("statut" ASC);

-- CreateIndex
CREATE INDEX "mfa_email_codes_email_idx" ON "mfa_email_codes"("email" ASC);

-- CreateIndex
CREATE INDEX "mfa_email_codes_expires_at_idx" ON "mfa_email_codes"("expires_at" ASC);

-- CreateIndex
CREATE INDEX "missing_documents_dossier_id_idx" ON "missing_documents"("dossier_id" ASC);

-- CreateIndex
CREATE INDEX "missing_documents_status_idx" ON "missing_documents"("status" ASC);

-- CreateIndex
CREATE INDEX "notifications_dossierId_idx" ON "notifications"("dossierId" ASC);

-- CreateIndex
CREATE INDEX "notifications_userId_lu_idx" ON "notifications"("userId" ASC, "lu" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "parametres_categorie_code_key" ON "parametres"("categorie" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "parametres_categorie_idx" ON "parametres"("categorie" ASC);

-- CreateIndex
CREATE INDEX "payroll_lines_payroll_id_idx" ON "payroll_lines"("payroll_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_rubrics_code_key" ON "payroll_rubrics"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "payrolls_employee_id_period_year_period_month_key" ON "payrolls"("employee_id" ASC, "period_year" ASC, "period_month" ASC);

-- CreateIndex
CREATE INDEX "provider_missions_dossier_id_idx" ON "provider_missions"("dossier_id" ASC);

-- CreateIndex
CREATE INDEX "provider_missions_profession_idx" ON "provider_missions"("profession" ASC);

-- CreateIndex
CREATE INDEX "provider_missions_status_idx" ON "provider_missions"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "roles_nom_key" ON "roles"("nom" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "specialites_code_key" ON "specialites"("code" ASC);

-- CreateIndex
CREATE INDEX "tache_templates_specialiteId_idx" ON "tache_templates"("specialiteId" ASC);

-- CreateIndex
CREATE INDEX "tache_templates_workflowEtapeId_idx" ON "tache_templates"("workflowEtapeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tva_rates_code_key" ON "tva_rates"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "types_documents_specialite_specialiteId_code_key" ON "types_documents_specialite"("specialiteId" ASC, "code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_calendar_token_key" ON "users"("calendar_token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_specialite_specialiteId_code_key" ON "workflow_specialite"("specialiteId" ASC, "code" ASC);

-- AddForeignKey
ALTER TABLE "accounting_accounts" ADD CONSTRAINT "accounting_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "accounting_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "accounting_exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "accounting_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_entry_lines" ADD CONSTRAINT "accounting_entry_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounting_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_entry_lines" ADD CONSTRAINT "accounting_entry_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "accounting_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journals" ADD CONSTRAINT "accounting_journals_default_credit_account_id_fkey" FOREIGN KEY ("default_credit_account_id") REFERENCES "accounting_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journals" ADD CONSTRAINT "accounting_journals_default_debit_account_id_fkey" FOREIGN KEY ("default_debit_account_id") REFERENCES "accounting_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_amortissements" ADD CONSTRAINT "charge_amortissements_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_lines" ADD CONSTRAINT "charge_lines_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "charge_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_mission_huissier_id_fkey" FOREIGN KEY ("mission_huissier_id") REFERENCES "missions_huissier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_tache_id_fkey" FOREIGN KEY ("tache_id") REFERENCES "taches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_tva_rate_id_fkey" FOREIGN KEY ("tva_rate_id") REFERENCES "tva_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_cloture" ADD CONSTRAINT "checklist_cloture_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commentaires_dossier" ADD CONSTRAINT "commentaires_dossier_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflits_interet" ADD CONSTRAINT "conflits_interet_dossierConflitId_fkey" FOREIGN KEY ("dossierConflitId") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflits_interet" ADD CONSTRAINT "conflits_interet_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_requests" ADD CONSTRAINT "coverage_requests_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "insurance_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_requests" ADD CONSTRAINT "coverage_requests_dependent_id_fkey" FOREIGN KEY ("dependent_id") REFERENCES "employee_dependents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_requests" ADD CONSTRAINT "coverage_requests_insured_employee_id_fkey" FOREIGN KEY ("insured_employee_id") REFERENCES "insured_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_requests" ADD CONSTRAINT "coverage_requests_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "medical_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_requests" ADD CONSTRAINT "coverage_requests_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "insurance_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_collaborateurs" ADD CONSTRAINT "dossier_collaborateurs_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_dependents" ADD CONSTRAINT "employee_dependents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_dependents" ADD CONSTRAINT "employee_dependents_insured_employee_id_fkey" FOREIGN KEY ("insured_employee_id") REFERENCES "insured_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_history" ADD CONSTRAINT "employee_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_insurance_payments" ADD CONSTRAINT "employee_insurance_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "medical_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_leave_settings" ADD CONSTRAINT "employee_leave_settings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_leave_settings" ADD CONSTRAINT "employee_leave_settings_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "leave_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evenements" ADD CONSTRAINT "evenements_createurId_fkey" FOREIGN KEY ("createurId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evenements" ADD CONSTRAINT "evenements_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facture_lines" ADD CONSTRAINT "facture_lines_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_mission_huissier_id_fkey" FOREIGN KEY ("mission_huissier_id") REFERENCES "missions_huissier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_tache_id_fkey" FOREIGN KEY ("tache_id") REFERENCES "taches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_tva_rate_id_fkey" FOREIGN KEY ("tva_rate_id") REFERENCES "tva_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_contracts" ADD CONSTRAINT "insurance_contracts_insurer_id_fkey" FOREIGN KEY ("insurer_id") REFERENCES "insurers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_period_closures" ADD CONSTRAINT "insurance_period_closures_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "insurance_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_quotes" ADD CONSTRAINT "insurance_quotes_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "insurance_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_quotes" ADD CONSTRAINT "insurance_quotes_dependent_id_fkey" FOREIGN KEY ("dependent_id") REFERENCES "employee_dependents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_quotes" ADD CONSTRAINT "insurance_quotes_insured_employee_id_fkey" FOREIGN KEY ("insured_employee_id") REFERENCES "insured_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_quotes" ADD CONSTRAINT "insurance_quotes_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "medical_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insured_employees" ADD CONSTRAINT "insured_employees_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "insurance_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insured_employees" ADD CONSTRAINT "insured_employees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurer_payments" ADD CONSTRAINT "insurer_payments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "insurance_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approvals" ADD CONSTRAINT "leave_approvals_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_transactions" ADD CONSTRAINT "leave_transactions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_transactions" ADD CONSTRAINT "leave_transactions_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_invoices" ADD CONSTRAINT "medical_invoices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "insurance_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_invoices" ADD CONSTRAINT "medical_invoices_coverage_request_id_fkey" FOREIGN KEY ("coverage_request_id") REFERENCES "coverage_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_invoices" ADD CONSTRAINT "medical_invoices_dependent_id_fkey" FOREIGN KEY ("dependent_id") REFERENCES "employee_dependents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_invoices" ADD CONSTRAINT "medical_invoices_insured_employee_id_fkey" FOREIGN KEY ("insured_employee_id") REFERENCES "insured_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_invoices" ADD CONSTRAINT "medical_invoices_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "medical_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions_architecte" ADD CONSTRAINT "missions_architecte_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions_clerc" ADD CONSTRAINT "missions_clerc_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions_conseiller_juridique" ADD CONSTRAINT "missions_conseiller_juridique_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions_huissier" ADD CONSTRAINT "missions_huissier_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "factures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_payroll_id_fkey" FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "payroll_rubrics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tache_templates" ADD CONSTRAINT "tache_templates_specialiteId_fkey" FOREIGN KEY ("specialiteId") REFERENCES "specialites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tache_templates" ADD CONSTRAINT "tache_templates_workflowEtapeId_fkey" FOREIGN KEY ("workflowEtapeId") REFERENCES "workflow_specialite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taches" ADD CONSTRAINT "taches_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "types_documents_specialite" ADD CONSTRAINT "types_documents_specialite_specialiteId_fkey" FOREIGN KEY ("specialiteId") REFERENCES "specialites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versions_document" ADD CONSTRAINT "versions_document_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_specialite" ADD CONSTRAINT "workflow_specialite_specialiteId_fkey" FOREIGN KEY ("specialiteId") REFERENCES "specialites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
