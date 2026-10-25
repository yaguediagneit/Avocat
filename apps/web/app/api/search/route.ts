import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { emptySearchResults, searchAll, SEARCH_SCOPES, SearchScope } from "@/lib/search";

const VALID_SCOPES: readonly string[] = SEARCH_SCOPES;

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const rawScopes = searchParams.get("scopes");
  const scopes = rawScopes
    ? (rawScopes.split(",").filter((s) => VALID_SCOPES.includes(s as SearchScope)) as SearchScope[])
    : undefined;

  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 100);

  if (!q.trim()) {
    return NextResponse.json(emptySearchResults());
  }

  try {
    const results = await searchAll(
      {
        prisma: ctx.prisma,
        userId: ctx.userId,
        role: ctx.roleInfo,
        isClient: ctx.isClient,
        clientId: ctx.clientId,
      },
      { q, scopes, limit }
    );
    return NextResponse.json(results);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Erreur de recherche" }, { status: 500 });
  }
}
