import type { FastifyRequest, FastifyReply } from "fastify";
import { parseRequestBody } from "@explita/infra-protocol";
import { cache } from "./lib/cache.js";
import { sendOTP, type SendOtpOptions } from "./lib/mailer.js";

export async function requestOtp(
  request: FastifyRequest,
  reply: FastifyReply,
  options?: SendOtpOptions,
) {
  const parsed = parseRequestBody<{ email?: string }>(request.body);
  const email = parsed.email?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply.code(400).send({
      success: false,
      error: "A valid email address is required",
    });
  }

  // Generate 6-digit OTP and store in cache with 10-minute TTL
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await cache.set(`otp:${email}`, otp, { ttl: "10m" });

  const sent = await sendOTP(email, otp, options);

  if (!sent) {
    return reply.code(500).send({
      success: false,
      error: "Failed to send OTP",
    });
  }

  return reply.code(200).send({
    success: true,
    email,
    message: "Verification code sent to your email",
  });
}
