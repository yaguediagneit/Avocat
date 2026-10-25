import { getServerAuth } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { SectionTabs, SectionTabItem } from "@/components/section-tabs";

/// La section Dossiers regroupe en onglets les dossiers, les transactions et
/// les démarches administratives (toutes rattachées à un dossier).
export default async function DossiersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getServerAuth();
  const items: SectionTabItem[] = [{ href: "/cabinet/dossiers", label: "Dossiers" }];
  if (auth.estAdmin || hasPermission(auth.role, "transactions", "read")) {
    items.push({ href: "/cabinet/dossiers/transactions", label: "Transactions" });
  }
  if (auth.estAdmin || hasPermission(auth.role, "demarches", "read")) {
    items.push({ href: "/cabinet/dossiers/demarches", label: "Démarches adm." });
  }
  return (
    <div className="space-y-4">
      <SectionTabs items={items} />
      {children}
    </div>
  );
}
