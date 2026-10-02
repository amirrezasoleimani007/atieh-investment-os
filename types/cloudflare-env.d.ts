/** Minimal ambient declarations for the Cloudflare bindings configured by Sites. */
type D1Database = import("@miniflare/d1").D1Database;

interface Fetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

declare module "cloudflare:workers" {
  export const env: { DB?: D1Database };
}
