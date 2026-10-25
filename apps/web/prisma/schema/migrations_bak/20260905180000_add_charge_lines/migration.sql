-- CreateTable : lignes de charge (comme les lignes de facture)
CREATE TABLE "charge_lines" (
    "id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "prix_unitaire" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taux_tva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_ht" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_tva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_ttc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charge_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "charge_lines_charge_id_idx" ON "charge_lines"("charge_id");

-- AddForeignKey
ALTER TABLE "charge_lines" ADD CONSTRAINT "charge_lines_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE CASCADE;
