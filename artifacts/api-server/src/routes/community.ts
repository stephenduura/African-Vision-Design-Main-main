import { Router } from "express";
import { db } from "@workspace/db";
import { communityMembersTable } from "@workspace/db";
import { JoinCommunityBody } from "@workspace/api-zod";
import { desc } from "drizzle-orm";
import { createRateLimiter, requireTrustedRequestOrigin } from "../lib/security";
import {
  createLocalCommunityMember,
  getLocalCommunityStats,
  listLocalCommunityMembers,
} from "../lib/communityFallbackStore";

const router = Router();
let communityMode: "db" | "local" | null = null;
let communityModePromise: Promise<"db" | "local"> | null = null;
const allowLocalFallback =
  process.env.NODE_ENV !== "production" || process.env["COMMUNITY_FORCE_LOCAL"] === "1";
const communityJoinRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many community join attempts. Please try again later.",
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    return `${req.ip ?? "unknown"}:community-join:${email || "anonymous"}`;
  },
});

async function resolveCommunityMode(): Promise<"db" | "local"> {
  if (communityMode) return communityMode;
  if (!communityModePromise) {
    communityModePromise = (async () => {
      if (allowLocalFallback && process.env["COMMUNITY_FORCE_LOCAL"] === "1") {
        return "local";
      }

      const dbProbe = db
        .select({ id: communityMembersTable.id })
        .from(communityMembersTable)
        .limit(1)
        .then(() => "db" as const)
        .catch(() => (allowLocalFallback ? "local" as const : "db" as const));

      if (!allowLocalFallback) {
        return dbProbe;
      }

      const timeout = new Promise<"local">((resolve) => {
        setTimeout(() => resolve("local"), 1200);
      });

      return Promise.race([dbProbe, timeout]);
    })();
  }

  communityMode = await communityModePromise;
  return communityMode;
}

router.get("/community/stats", async (req, res): Promise<void> => {
  const storageMode = await resolveCommunityMode();
  if (storageMode === "local") {
    res.json(await getLocalCommunityStats());
    return;
  }

  try {
    const all = await db.select().from(communityMembersTable);
    const countries = new Set(all.map((m: any) => m.country)).size;
    const volunteers = all.filter((m: any) => m.memberType === "volunteer").length;
    const organizations = all.filter((m: any) => m.memberType === "organization").length;
    res.json({ totalMembers: all.length, countries, volunteers, organizations });
  } catch (error) {
    if (!allowLocalFallback) {
      (req as any).log?.error?.({ err: error }, "Community stats unavailable");
      res.status(503).json({ error: "Community service unavailable" });
      return;
    }
    communityMode = "local";
    res.json(await getLocalCommunityStats());
  }
});

router.get("/community/members", async (req, res): Promise<void> => {
  const storageMode = await resolveCommunityMode();
  if (storageMode === "local") {
    const members = await listLocalCommunityMembers();
    res.json(members.map((m: any) => ({ ...m, joinedAt: m.joinedAt.toISOString() })));
    return;
  }

  try {
    const members = await db
      .select()
      .from(communityMembersTable)
      .orderBy(desc(communityMembersTable.joinedAt));
    res.json(members.map((m: any) => ({ ...m, joinedAt: m.joinedAt.toISOString() })));
  } catch (error) {
    if (!allowLocalFallback) {
      (req as any).log?.error?.({ err: error }, "Community members unavailable");
      res.status(503).json({ error: "Community service unavailable" });
      return;
    }
    communityMode = "local";
    const members = await listLocalCommunityMembers();
    res.json(members.map((m: any) => ({ ...m, joinedAt: m.joinedAt.toISOString() })));
  }
});

router.post("/community/members", communityJoinRateLimit, async (req, res): Promise<void> => {
  if (!requireTrustedRequestOrigin(req, res)) {
    return;
  }

  const parsed = JoinCommunityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const storageMode = await resolveCommunityMode();
  if (storageMode === "local") {
    try {
      const member = await createLocalCommunityMember(parsed.data);
      res.status(201).json({ ...member, joinedAt: member.joinedAt.toISOString() });
    } catch (err) {
      if (err instanceof Error && err.message === "duplicate-email") {
        res.status(400).json({ error: "This email is already registered." });
        return;
      }
      throw err;
    }
    return;
  }
  try {
    const [member] = await db.insert(communityMembersTable).values(parsed.data).returning();
    res.status(201).json({ ...member, joinedAt: member.joinedAt.toISOString() });
  } catch (error) {
    if (!allowLocalFallback) {
      (req as any).log?.error?.({ err: error }, "Community join unavailable");
      res.status(503).json({ error: "Community service unavailable" });
      return;
    }
    communityMode = "local";
    try {
      const member = await createLocalCommunityMember(parsed.data);
      res.status(201).json({ ...member, joinedAt: member.joinedAt.toISOString() });
    } catch (err) {
      if (err instanceof Error && err.message === "duplicate-email") {
        res.status(400).json({ error: "This email is already registered." });
        return;
      }
      throw err;
    }
  }
});

export default router;
