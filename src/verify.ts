import { randomUUID } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { parseRequestBody } from "@explita/infra-protocol";
import { cache } from "./lib/cache.js";
import { getPrisma } from "./lib/prisma.js";
import { generateToken } from "./lib/utils.js";

export async function verifyOtp(request: FastifyRequest, reply: FastifyReply) {
  const parsed = parseRequestBody<{ email?: string; otp?: string }>(
    request.body,
  );
  const email = parsed.email?.trim().toLowerCase();
  const otp = String(parsed.otp || "").trim();

  if (!email || !otp) {
    return reply.code(400).send({
      success: false,
      error: "Email and OTP code are both required",
    });
  }

  const storedOtp = await cache.get<string>(`otp:${email}`);
  if (!storedOtp || String(storedOtp).trim() !== otp) {
    return reply.code(400).send({
      success: false,
      error: "Invalid or expired verification code",
    });
  }

  // Clear consumed OTP
  await cache.del(`otp:${email}`);

  const token = generateToken();

  const prisma = getPrisma();
  if (prisma) {
    try {
      const developer = await prisma.developer.upsert({
        where: { email },
        create: { email },
        update: {},
      });

      await prisma.token.create({
        data: {
          token,
          developerId: developer.id,
        },
      });
    } catch (error) {
      console.error(
        "[tunnel-auth] Failed to persist developer/token in database:",
        error,
      );
      // Continue: cache still grants access even if DB write momentarily fails
    }
  }

  await cache.set(`token:verified:${token}`, token, { ttl: "7d" });

  return reply.code(200).send({
    success: true,
    email,
    token,
    message: "Verification successful",
  });
}
