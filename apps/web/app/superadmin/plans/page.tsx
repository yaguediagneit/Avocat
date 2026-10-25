import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isSuperAdmin } from "@/lib/superadmin";
import { publicPrisma } from "@/lib/prisma";
import { SuperadminPlansClient } from "./superadmin-plans-client";

export default async function SuperadminPlansPage() {
  const session = await getSession();

  if (!session.userId || !session.mfaVerified || !(await isSuperAdmin(session.email || ""))) {
    redirect("/login");
  }

  const plans = await publicPrisma.plan.findMany({
    orderBy: { ordre: "asc" },
    include: { _count: { select: { tenants: true } } },
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Superadmin — Plans</h1>
      <p className="text-sm text-gray-600">Gestion des forfaits SaaS.</p>
      <div className="mt-6">
        <SuperadminPlansClient initialPlans={JSON.parse(JSON.stringify(plans))} />
      </div>
    </div>
  );
}
