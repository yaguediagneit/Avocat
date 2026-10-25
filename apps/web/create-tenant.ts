import { createTenant } from "./lib/tenant-manager";

async function main() {
  try {
    const tenant = await createTenant({
      slug: "default",
      raisonSociale: "Cabinet Défaut",
    });
    console.log(`TENANT_ID=${tenant.id}`);
    console.log(JSON.stringify(tenant, null, 2));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
