import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isSuperAdmin } from "@/lib/superadmin";
import { publicPrisma } from "@/lib/prisma";
import Link from "next/link";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export default async function SuperadminOverviewPage() {
  const session = await getSession();

  if (!session.userId || !session.mfaVerified || !(await isSuperAdmin(session.email || ""))) {
    redirect("/login");
  }

  const total = await publicPrisma.tenant.count();
  const actifs = await publicPrisma.tenant.count({ where: { actif: true } });
  const inactifs = await publicPrisma.tenant.count({ where: { actif: false } });
  const expirés = await publicPrisma.tenant.count({
    where: { actif: true, finAbonnement: { lt: new Date() } },
  });

  const plans = await publicPrisma.plan.findMany({
    include: { _count: { select: { tenants: true } } },
    orderBy: { ordre: "asc" },
  });

  const lastTenants = await publicPrisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, slug: true, raisonSociale: true, actif: true, finAbonnement: true, createdAt: true, plan: { select: { nom: true, code: true } } },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Vue d&apos;ensemble</h1>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "TOTAL TENANTS", value: total },
          { label: "ACTIFS", value: actifs, color: "text-emerald-400" },
          { label: "SUSPENDUS", value: inactifs, color: "text-amber-400" },
          { label: "EXPIRÉS", value: expirés, color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">{s.label}</p>
            <p className={`mt-2 text-3xl font-bold ${s.color || ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">{p.code}</p>
            <p className="mt-2 text-2xl font-bold">{p._count.tenants}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/60">Derniers tenants créés</h2>
        <div className="space-y-3">
          {lastTenants.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/30 text-sm font-semibold">
                  {t.raisonSociale.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-medium">{t.raisonSociale}</p>
                  <p className="text-xs text-white/50">{t.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {t.plan && (
                  <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-200">
                    {t.plan.code}
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.actif ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/20 text-red-200"}`}>
                  {t.actif ? "ACTIF" : "INACTIF"}
                </span>
                <Link href={`/superadmin/tenants/${t.id}`} className="text-xs text-purple-300 hover:underline">
                  Voir
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
