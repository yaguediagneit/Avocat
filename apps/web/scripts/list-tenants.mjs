import dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
try {
  const tenants = await p.tenant.findMany();
  console.log(JSON.stringify(tenants, null, 2));
} catch (e) {
  console.error(e);
} finally {
  await p.$disconnect();
}
