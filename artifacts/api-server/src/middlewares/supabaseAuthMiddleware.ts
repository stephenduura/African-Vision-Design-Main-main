import type { Request, RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";

export type SupabaseAuthRole = "admin" | "member";
export type SupabaseMemberType = "individual" | "organization" | "volunteer";

export type SupabaseRequestUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  memberType: SupabaseMemberType;
  role: SupabaseAuthRole;
  userMetadata: Record<string, unknown>;
  appMetadata: Record<string, unknown>;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: SupabaseRequestUser | null;
    }
  }
}

let supabaseAuthClient:
  | ReturnType<typeof createClient>
  | null = null;

function getSupabaseAuthClient() {
  if (supabaseAuthClient) {
    return supabaseAuthClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required for auth.");
  }

  supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAuthClient;
}

function getBearerToken(req: Request): string | null {
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string") {
    return null;
  }

  const trimmed = authorization.trim();
  if (!trimmed.startsWith("Bearer ")) {
    return null;
  }

  const token = trimmed.slice("Bearer ".length).trim();
  return token || null;
}

function getDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string {
  const metadata = user.user_metadata ?? {};
  const name = metadata["name"] ?? metadata["full_name"];
  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }

  return user.email?.split("@")[0] ?? "Member";
}

function getMemberType(user: {
  user_metadata?: Record<string, unknown> | null;
}): SupabaseMemberType {
  const raw = user.user_metadata?.["member_type"];
  return raw === "organization" || raw === "volunteer" ? raw : "individual";
}

function mapAuthUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
}): SupabaseRequestUser {
  const email = user.email?.trim() || "";
  const role = user.app_metadata?.["role"] === "admin" ? "admin" : "member";

  return {
    id: user.id,
    email,
    name: getDisplayName(user),
    avatarUrl:
      typeof user.user_metadata?.["avatar_url"] === "string" &&
      user.user_metadata["avatar_url"].trim()
        ? user.user_metadata["avatar_url"].trim()
        : null,
    memberType: getMemberType(user),
    role,
    userMetadata: { ...(user.user_metadata ?? {}) },
    appMetadata: { ...(user.app_metadata ?? {}) },
  };
}

async function resolveUserFromToken(token: string): Promise<SupabaseRequestUser | null> {
  const client = getSupabaseAuthClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return mapAuthUser(data.user);
}

export function supabaseAuthMiddleware(): RequestHandler {
  return async (req, _res, next) => {
    req.authUser = null;

    const token = getBearerToken(req);
    if (!token) {
      next();
      return;
    }

    try {
      req.authUser = await resolveUserFromToken(token);
    } catch {
      req.authUser = null;
    }

    next();
  };
}
