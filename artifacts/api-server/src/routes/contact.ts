import { Router } from "express";
import { db } from "@workspace/db";
import { contactSubmissionsTable, newsletterSubscribersTable } from "@workspace/db";
import { SubmitContactBody, SubscribeNewsletterBody } from "@workspace/api-zod";
import { createRateLimiter, requireTrustedRequestOrigin } from "../lib/security";

const router = Router();

const contactRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many contact submissions. Please try again later.",
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    return `${req.ip ?? "unknown"}:contact:${email || "anonymous"}`;
  },
});

const newsletterRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: "Too many newsletter attempts. Please try again later.",
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    return `${req.ip ?? "unknown"}:newsletter:${email || "anonymous"}`;
  },
});

router.post("/contact", contactRateLimit, async (req, res): Promise<void> => {
  if (!requireTrustedRequestOrigin(req, res)) {
    return;
  }

  const parsed = SubmitContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db.insert(contactSubmissionsTable).values(parsed.data);
  res.status(201).json({ success: true, message: "Thank you for reaching out. We will respond within 48 hours." });
});

router.post("/newsletter", newsletterRateLimit, async (req, res): Promise<void> => {
  if (!requireTrustedRequestOrigin(req, res)) {
    return;
  }

  const parsed = SubscribeNewsletterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    await db.insert(newsletterSubscribersTable).values(parsed.data);
    res.status(201).json({ success: true, message: "You are now subscribed to the Papi Foundation newsletter." });
  } catch {
    res.status(400).json({ success: false, message: "This email is already subscribed." });
  }
});

export default router;
