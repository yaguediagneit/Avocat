"use client";

import { useEffect } from "react";
import { CSRF_HEADER, readCsrfCookie, SAFE_METHODS } from "@/lib/csrf";

declare global {
  interface Window {
    __csrfFetchPatched?: boolean;
  }
}

function isSameOrigin(input: RequestInfo | URL): boolean {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Ajoute automatiquement l'en-tête `x-csrf-token` à toutes les requêtes `fetch`
 * same-origin non idempotentes (POST, PUT, PATCH, DELETE…). Évite de modifier
 * chaque appel `fetch` de l'application.
 */
export function CsrfProvider() {
  useEffect(() => {
    if (window.__csrfFetchPatched) return;
    window.__csrfFetchPatched = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (SAFE_METHODS.has(method) || !isSameOrigin(input)) {
        return originalFetch(input, init);
      }

      const token = readCsrfCookie();
      if (!token) return originalFetch(input, init);

      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!headers.has(CSRF_HEADER)) headers.set(CSRF_HEADER, token);
      return originalFetch(input, { ...init, headers });
    };
  }, []);

  return null;
}
