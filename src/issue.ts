import { randomUUID } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { parseRequestBody } from "@explita/infra-protocol";
import { cache } from "./lib/cache.js";
import { getPrisma } from "./lib/prisma.js";
import { generateToken } from "./lib/utils.js";

export async function issueInstantToken(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const parsed = parseRequestBody<{ ip?: string; machineId?: string }>(
    request.body,
  );

  const rawIp =
    parsed.ip ||
    (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (request.headers["x-real-ip"] as string)?.trim() ||
    (request.headers["cf-connecting-ip"] as string)?.trim() ||
    request.ip ||
    "127.0.0.1";

  // Sanitize IP
  const clientIp = rawIp.replace(/^::ffff:/, "").trim();

  // Extract optional machine ID or hostname
  const machineId = parsed.machineId?.trim();
  const identifier = machineId
    ? `m_${machineId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 36)}`
    : `ip_${clientIp.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;

  const syntheticEmail = `${identifier}@device.explita.local`;

  // Rate limit: max 30 instant issuances per hour per IP to prevent spamming
  const rateKey = `rate:token:issue:${clientIp}`;
  try {
    const attempts = await cache.get<number>(rateKey);
    if (attempts && attempts >= 30) {
      return reply.code(429).send({
        success: false,
        error: "Too many token requests from this IP. Please try again later.",
      });
    }
    await cache
      .set(rateKey, (attempts || 0) + 1, { ttl: "1h" })
      .catch(() => {});
  } catch {
    // Non-blocking if cache is temporarily unavailable
  }

  const prisma = getPrisma();
  if (prisma) {
    try {
      // 1. If this machine/IP already has an active unrevoked token, return it
      const existing = await prisma.developer.findUnique({
        where: { email: syntheticEmail },
        include: {
          tokens: {
            where: { revokedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (existing && existing.tokens.length > 0) {
        const existingToken = existing.tokens[0].token;
        await cache
          .set(`token:verified:${existingToken}`, existingToken, { ttl: "30d" })
          .catch(() => {});

        return reply.code(200).send({
          success: true,
          token: existingToken,
          message: "Existing active tunnel token retrieved",
        });
      }

      // 2. Issue a new token for this server / device
      const token = generateToken();
      await prisma.$transaction(async (trx) => {
        const developer = await trx.developer.upsert({
          where: { email: syntheticEmail },
          create: { email: syntheticEmail },
          update: {},
        });

        await trx.token.create({
          data: {
            token,
            developerId: developer.id,
          },
        });
      });

      await cache
        .set(`token:verified:${token}`, token, { ttl: "30d" })
        .catch(() => {});

      return reply.code(200).send({
        success: true,
        token,
        message: "Tunnel token issued successfully",
      });
    } catch (error) {
      console.error("[tunnel-auth] Error issuing instant token via DB:", error);
    }
  }

  // 3. Fallback: issue cached ephemeral token if DB is unavailable
  const fallbackToken = generateToken();
  await cache
    .set(`token:verified:${fallbackToken}`, fallbackToken, { ttl: "7d" })
    .catch(() => {});

  return reply.code(200).send({
    success: true,
    token: fallbackToken,
    message: "Tunnel token issued successfully",
  });
}
