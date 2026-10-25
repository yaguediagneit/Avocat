import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getPresignedDownloadUrl } from "@/lib/s3";
import { ProfilForm } from "@/components/profil-form";
import { SignatureUpload } from "./signature-upload";
import { PaginatedUl } from "@/components/pagination";

export default async function ProfilPage() {
  const session = await getSession();
  if (!session.userId || !session.mfaVerified) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      prenom: true,
      nom: true,
      email: true,
      titre: true,
      specialite: true,
      signatureKey: true,
      role: { select: { nom: true, estClient: true } },
    },
  });

  if (!user) redirect("/login");

  const signatureUrl = user.signatureKey
    ? await getPresignedDownloadUrl(user.signatureKey, 300).catch(() => null)
    : null;

  const employee = user.email
    ? await prisma.employee.findFirst({
        where: { email: user.email },
        select: { id: true },
      })
    : null;

  const signedPayrolls = employee
    ? await prisma.payroll.findMany({
        where: { employeeId: employee.id, signedDocumentUrl: { not: null } },
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
        select: { id: true, periodMonth: true, periodYear: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mon profil</h1>
        <p className="text-sm text-gray-600">
          Vos informations personnelles, votre mot de passe et votre signature.
        </p>
      </div>

      <ProfilForm
        initialUser={{
          prenom: user.prenom,
          nom: user.nom,
          titre: user.titre || "",
          specialite: user.specialite || "",
          email: user.email,
          role: user.role?.nom || "",
          isClient: user.role?.estClient || false,
        }}
      />

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Ma signature</h2>
        <p className="text-sm text-gray-600">
          Téléversez une image de votre signature. Elle pourra être apposée sur les
          documents et actes générés par la plateforme.
        </p>
        <SignatureUpload initialUrl={signatureUrl} />
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Mes bulletins signés</h2>
        {signedPayrolls.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun bulletin signé disponible.</p>
        ) : (
          <ul className="space-y-2">
            <PaginatedUl>
            {signedPayrolls.map((p) => (
              <li key={p.id} className="flex items-center justify-between border-b py-2">
                <span className="text-sm font-medium">{p.periodMonth}/{p.periodYear}</span>
                <Link
                  href={`/api/personnel/payrolls/${p.id}/download`}
                  target="_blank"
                  className="rounded-md bg-cabinet-100 px-3 py-1 text-sm font-medium text-cabinet-700 transition hover:bg-cabinet-200"
                >
                  Télécharger
                </Link>
              </li>
            ))}
            </PaginatedUl>
          </ul>
        )}
      </section>
    </div>
  );
}
