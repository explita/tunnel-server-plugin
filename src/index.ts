import { requestOtp } from "./request.js";
import { verifyOtp } from "./verify.js";
import { issueInstantToken } from "./issue.js";
import { validateToken } from "./validate.js";
import {
  sendOTP,
  getOtpHtml,
  type SendOtpOptions,
  type SmtpOptions,
} from "./lib/mailer.js";
import {
  flushMetrics,
  getStatsSummary,
  type MetricsFlushDeltas,
  type StatsSummary,
} from "./lib/metrics.js";

export type TunnelPluginOptions = SendOtpOptions & {
  internalSecret?: string;
  metricsCollector?: {
    setPersister?: (persister: {
      flush: (deltas: MetricsFlushDeltas) => Promise<void>;
      getStats: (
        activeCount: number,
        deltas?: MetricsFlushDeltas,
      ) => Promise<StatsSummary>;
    }) => void;
    getActiveTunnelsCount?: () => number;
    getSnapshot?: () => MetricsFlushDeltas;
    getStats?: (activeCount: number) => Promise<StatsSummary> | StatsSummary;
  };
};

export function registerTunnelPlugin(app: any, options?: TunnelPluginOptions) {
  if (process.env.DATABASE_URL) {
    // 1. Auth & Token endpoints
    app.register(
      async (instance: any) => {
        instance.post("/request-otp", async (req: any, reply: any) => {
          return requestOtp(req, reply, options);
        });

        instance.post("/verify-otp", async (req: any, reply: any) => {
          return verifyOtp(req, reply);
        });

        instance.post("/issue", async (req: any, reply: any) => {
          return issueInstantToken(req, reply);
        });
      },
      { prefix: "/_api/token" },
    );

    // 2. Hook metrics persistence into collector if provided
    if (options?.metricsCollector?.setPersister) {
      options.metricsCollector.setPersister({
        flush: flushMetrics,
        getStats: getStatsSummary,
      });
    }
  }

  // 3. Stats endpoint
  app.get(
    "/_api/stats",
    {
      onRequest: async (req: any, reply: any) => {
        const secret = req.headers["x-internal-secret"];
        const expected = options?.internalSecret || process.env.INTERNAL_SECRET;
        if (expected && secret !== expected) {
          return reply.code(401).send({ error: "Unauthorized" });
        }
      },
    },
    async () => {
      const activeCount =
        options?.metricsCollector?.getActiveTunnelsCount?.() ?? 0;
      const snapshot = options?.metricsCollector?.getSnapshot?.();
      return getStatsSummary(activeCount, snapshot);
    },
  );
}

export {
  sendOTP,
  getOtpHtml,
  requestOtp,
  verifyOtp,
  issueInstantToken,
  validateToken,
  flushMetrics,
  getStatsSummary,
  type SendOtpOptions,
  type SmtpOptions,
  type MetricsFlushDeltas,
  type StatsSummary,
};
