import { getPrisma } from "./prisma.js";

export type MetricsFlushDeltas = {
  tunnels: number;
  requests: number;
  bytes: bigint;
  todayDevTokens?: Set<string>;
};

export type StatsSummary = {
  success: boolean;
  data: {
    active_tunnels: number;
    today: {
      date: string;
      tunnels_opened: number;
      requests_routed: number;
      bytes_transferred: number;
      active_developers: number;
    };
    all_time: {
      total_tunnels: number;
      total_requests: number;
      total_bytes: number;
    };
  };
};

export async function flushMetrics(deltas: MetricsFlushDeltas): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;

  const today = new Date().toISOString().split("T")[0];
  const devCount = deltas.todayDevTokens ? deltas.todayDevTokens.size : 0;

  try {
    await prisma.$transaction([
      prisma.dailyMetric.upsert({
        where: { date: today },
        create: {
          date: today,
          tunnelsOpened: deltas.tunnels,
          requestsRouted: BigInt(deltas.requests),
          bytesTransferred: deltas.bytes,
          activeDevelopers: devCount,
        },
        update: {
          tunnelsOpened: { increment: deltas.tunnels },
          requestsRouted: { increment: BigInt(deltas.requests) },
          bytesTransferred: { increment: deltas.bytes },
          activeDevelopers: devCount,
        },
      }),
      prisma.systemMetric.upsert({
        where: { id: "global" },
        create: {
          id: "global",
          totalTunnels: BigInt(deltas.tunnels),
          totalRequests: BigInt(deltas.requests),
          totalBytes: deltas.bytes,
        },
        update: {
          totalTunnels: { increment: BigInt(deltas.tunnels) },
          totalRequests: { increment: BigInt(deltas.requests) },
          totalBytes: { increment: deltas.bytes },
        },
      }),
    ]);
  } catch (err) {
    console.error("[tunnel-plugin] Failed to flush metrics to database:", err);
    throw err;
  }
}

export async function getStatsSummary(
  activeTunnelsCount: number,
  currentDeltas?: MetricsFlushDeltas,
): Promise<StatsSummary> {
  const prisma = getPrisma();
  const today = new Date().toISOString().split("T")[0];

  let dbDaily: {
    tunnelsOpened: number;
    requestsRouted: bigint;
    bytesTransferred: bigint;
    activeDevelopers: number;
  } | null = null;

  let dbSystem: {
    totalTunnels: bigint;
    totalRequests: bigint;
    totalBytes: bigint;
  } | null = null;

  if (prisma) {
    try {
      [dbDaily, dbSystem] = await Promise.all([
        prisma.dailyMetric.findUnique({ where: { date: today } }),
        prisma.systemMetric.findUnique({ where: { id: "global" } }),
      ]);
    } catch (err) {
      console.error("[tunnel-plugin] Error fetching stats from database:", err);
    }
  }

  const deltaTunnels = currentDeltas?.tunnels ?? 0;
  const deltaRequests = currentDeltas?.requests ?? 0;
  const deltaBytes = currentDeltas?.bytes ?? 0n;
  const devCount = currentDeltas?.todayDevTokens?.size ?? 0;

  const todayTunnels = (dbDaily?.tunnelsOpened ?? 0) + deltaTunnels;
  const todayRequests = Number(
    (dbDaily?.requestsRouted ?? 0n) + BigInt(deltaRequests),
  );
  const todayBytes = Number((dbDaily?.bytesTransferred ?? 0n) + deltaBytes);
  const todayDevs = Math.max(dbDaily?.activeDevelopers ?? 0, devCount);

  const allTimeTunnels = Number(
    (dbSystem?.totalTunnels ?? 0n) + BigInt(deltaTunnels),
  );
  const allTimeRequests = Number(
    (dbSystem?.totalRequests ?? 0n) + BigInt(deltaRequests),
  );
  const allTimeBytes = Number((dbSystem?.totalBytes ?? 0n) + deltaBytes);

  return {
    success: true,
    data: {
      active_tunnels: activeTunnelsCount,
      today: {
        date: today,
        tunnels_opened: todayTunnels,
        requests_routed: todayRequests,
        bytes_transferred: todayBytes,
        active_developers: todayDevs,
      },
      all_time: {
        total_tunnels: allTimeTunnels,
        total_requests: allTimeRequests,
        total_bytes: allTimeBytes,
      },
    },
  };
}
