import { randomUUID } from "node:crypto";

export function generateToken(): string {
  return `exp_live_${randomUUID().replace(/-/g, "")}`;
}
