import { getServerAuth } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { SectionTabs, SectionTabItem } from "@/components/section-tabs";

/// Sous-navigation de l'onglet Transactions (anciens items du menu déroulant).
export default async function TransactionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getServerAuth();
  const items: SectionTabItem[] = [
    { href: "/cabinet/dossiers/transactions", label: "Transactions" },
    { href: "/cabinet/dossiers/transactions/biens", label: "Biens" },
  ];
  if (auth.estAdmin || hasPermission(auth.role, "parametres", "write")) {
    items.push({ href: "/cabinet/dossiers/transactions/parametrage", label: "Types & modèles" });
  }
  return (
    <div className="space-y-4">
      <SectionTabs items={items} variant="sub" />
      {children}
    </div>
  );
}
