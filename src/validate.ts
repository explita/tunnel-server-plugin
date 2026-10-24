import { cache } from "./lib/cache.js";
import { getPrisma } from "./lib/prisma.js";

export async function validateToken(token: string): Promise<boolean> {
  if (!token || !process.env.DATABASE_URL) return false;

  // 1. Fast path: check Redis / in-memory cache
  try {
    const tokenExists = await cache.get(`token:verified:${token}`);
    if (tokenExists) {
      await cache.expire(`token:verified:${token}`, "7d").catch(() => {});
      return true;
    }
  } catch {
    // Ignore cache error and proceed to database fallback
  }

  // 2. Resilient fallback: check PostgreSQL in case Redis flushed or restarted
  const prisma = getPrisma();
  if (prisma) {
    try {
      const dbToken = await prisma.token.findFirst({
        where: {
          token,
          revokedAt: null,
        },
      });

      if (dbToken) {
        // Re-warm cache for subsequent requests
        await cache
          .set(`token:verified:${token}`, token, { ttl: "7d" })
          .catch(() => {});

        // Asynchronously update last active timestamp without blocking handshake
        prisma.token
          .update({
            where: { id: dbToken.id },
            data: { lastUsedAt: new Date() },
          })
          .catch(() => {});

        return true;
      }
    } catch (error) {
      console.error(
        "[tunnel-auth] Error validating token against database:",
        error,
      );
    }
  }

  return false;
}
