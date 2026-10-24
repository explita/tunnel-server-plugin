import { createCache } from "@explita/cache";

export const cache = createCache("_tunnel_auth:", { loggingEnabled: false });

cache.on("error", (err) => {
  console.warn("[tunnel-auth] Cache notice:", err?.message || err);
});
