"use client";

import { usePathname } from "next/navigation";

export function LogoutButton() {
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    // Navigation hard : invalide le Router Cache (payloads RSC côté client)
    // pour éviter qu'un nouvel utilisateur connecté voie les données du
    // précédent (layout /cabinet mis en cache par Next.js App Router).
    const isClient = pathname.startsWith("/client");
    window.location.href = isClient ? "/client/login" : "/login";
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-md border border-white/30 bg-white/5 px-3 py-1.5 text-sm text-white transition hover:bg-white/10"
    >
      Déconnexion
    </button>
  );
}
