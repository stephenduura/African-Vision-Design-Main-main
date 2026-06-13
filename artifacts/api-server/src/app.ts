import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import type { IncomingMessage, ServerResponse } from "http";
import { getAllowedOrigins } from "./lib/security";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";
import { supabaseAuthMiddleware } from "./middlewares/supabaseAuthMiddleware";

const app: Express = express();
const allowedOrigins = getAllowedOrigins();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: IncomingMessage) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: ServerResponse) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalized = origin.trim().replace(/\/$/, "");
      if (allowedOrigins.has(normalized)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  }),
);

// Stripe webhook MUST receive the raw body and therefore must be registered
// BEFORE express.json(). Do not move this below the JSON body parser.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res): Promise<void> => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0]! : signature;
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err) {
      req.log.error({ err }, "Stripe webhook processing failed");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

// Community image posts can carry data URLs, so the parser needs a higher
// limit than Express' tiny default payload size.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(supabaseAuthMiddleware());

app.use("/api", router);

export default app;
