import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ProfilForm } from "@/components/profil-form";

export default async function ClientProfilPage() {
  const session = await getSession();
  if (!session.userId || !session.mfaVerified) {
    redirect("/client/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { role: { select: { nom: true, estClient: true } } },
  });

  if (!user) {
    redirect("/client/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mon profil</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gérez vos informations personnelles et votre mot de passe.
        </p>
      </div>

      <ProfilForm
        initialUser={{
          prenom: user.prenom,
          nom: user.nom,
          titre: user.titre || "",
          specialite: user.specialite || "",
          email: user.email,
          role: user.role.nom,
          isClient: user.role.estClient,
        }}
      />
    </div>
  );
}
