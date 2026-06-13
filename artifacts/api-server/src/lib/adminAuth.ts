import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import type { SupabaseRequestUser } from "../middlewares/supabaseAuthMiddleware";

function getAdminUserIds(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function getRequestUser(req: Request): SupabaseRequestUser | null {
  return req.authUser ?? null;
}

async function isAdminByProfile(userId: string): Promise<boolean> {
  const [profile] = await db
    .select({ role: profilesTable.role })
    .from(profilesTable)
    .where(eq(profilesTable.id, userId));
  return profile?.role === "admin";
}

export async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const user = getRequestUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  const adminUserIds = getAdminUserIds();
  if (adminUserIds.size > 0) {
    if (!adminUserIds.has(user.id)) {
      res.status(403).json({ error: "Forbidden" });
      return false;
    }

    return true;
  }

  if (process.env.NODE_ENV === "production") {
    try {
      if (!(await isAdminByProfile(user.id))) {
        res.status(403).json({ error: "Admin access is not configured" });
        return false;
      }
      return true;
    } catch {
      res.status(403).json({ error: "Admin access is not configured" });
      return false;
    }
  }

  return true;
}
