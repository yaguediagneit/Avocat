import { getServerAuth } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { SectionTabs, SectionTabItem } from "@/components/section-tabs";

/// Sous-navigation de l'onglet Démarches adm. (anciens items du menu déroulant).
export default async function DemarchesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getServerAuth();
  const items: SectionTabItem[] = [
    { href: "/cabinet/dossiers/demarches", label: "Démarches" },
    { href: "/cabinet/dossiers/demarches/demandeurs", label: "Demandeurs" },
    { href: "/cabinet/dossiers/demarches/parcelles", label: "Parcelles" },
  ];
  if (auth.estAdmin || hasPermission(auth.role, "parametres", "write")) {
    items.push({ href: "/cabinet/dossiers/demarches/parametrage", label: "Paramétrage" });
  }
  return (
    <div className="space-y-4">
      <SectionTabs items={items} variant="sub" />
      {children}
    </div>
  );
}
