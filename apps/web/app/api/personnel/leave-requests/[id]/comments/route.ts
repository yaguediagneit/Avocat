import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerAuth } from "@/lib/server-auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  const { id } = params;

  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    select: { id: true, createdBy: true, approverId: true, employeeId: true, employee: { select: { email: true } } },
  });
  if (!request) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  const me = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true },
  });
  const isEmployee =
    request.employeeId === auth.userId ||
    (me?.email ? me.email === request.employee.email : false);

  const canRead =
    auth.estAdmin ||
    request.approverId === auth.userId ||
    request.createdBy === auth.userId ||
    isEmployee;
  if (!canRead) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const comments = await prisma.leaveComment.findMany({
    where: { leaveRequestId: id },
    orderBy: { createdAt: "asc" },
  });

  const userIds = [...new Set(comments.map((c) => c.authorId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, prenom: true, nom: true },
  });
  const byUser = Object.fromEntries(users.map((u) => [u.id, u]));

  return NextResponse.json(comments.map((c) => ({ ...c, author: byUser[c.authorId] })));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  const { id } = params;
  const body = await req.json();

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "Commentaire vide" }, { status: 400 });
  }

  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    select: { id: true, createdBy: true, approverId: true, employeeId: true, employee: { select: { email: true } } },
  });
  if (!request) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  const me = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true },
  });
  const isEmployee =
    request.employeeId === auth.userId ||
    (me?.email ? me.email === request.employee.email : false);

  const canComment =
    auth.estAdmin ||
    request.approverId === auth.userId ||
    request.createdBy === auth.userId ||
    isEmployee;
  if (!canComment) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const comment = await prisma.leaveComment.create({
    data: {
      leaveRequestId: id,
      authorId: auth.userId,
      content,
    },
  });

  const author = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { prenom: true, nom: true },
  });

  return NextResponse.json({ ...comment, author }, { status: 201 });
}
