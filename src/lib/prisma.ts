import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

let prismaInstance: PrismaClient | null = null;

export function getPrisma(): PrismaClient | null {
  if (prismaInstance) return prismaInstance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  try {
    const adapter = new PrismaPg({ connectionString });
    prismaInstance = new PrismaClient({ adapter });
    return prismaInstance;
  } catch (err) {
    console.warn(
      "[tunnel-auth] Warning: failed to initialize Prisma database client:",
      err,
    );
    return null;
  }
}
