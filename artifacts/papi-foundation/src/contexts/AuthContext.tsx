import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type AuthRole = "admin" | "member";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  memberSince: string;
  memberType: "individual" | "organization" | "volunteer";
  imageUrl: string | null;
  role: AuthRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  isLoaded: boolean;
  logout: () => void;
  signIn: (credentials: { email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  signUp: (details: { name: string; email: string; password: string; memberType: AuthUser["memberType"] }) => Promise<{ success: boolean; error?: string; requiresConfirmation?: boolean; message?: string }>;
  followProject: (projectId: number) => void;
  unfollowProject: (projectId: number) => void;
  isFollowing: (projectId: number) => boolean;
}

const fallbackAuthContext: AuthContextValue = {
  user: null,
  isAdmin: false,
  isLoaded: true,
  logout: () => {},
  signIn: async () => ({
    success: false,
    error: "Authentication is unavailable outside AuthProvider.",
  }),
  signUp: async () => ({
    success: false,
    error: "Authentication is unavailable outside AuthProvider.",
  }),
  followProject: () => {},
  unfollowProject: () => {},
  isFollowing: () => false,
};

const AuthContext = createContext<AuthContextValue>(fallbackAuthContext);

const ADMIN_USER_IDS = new Set(
  String(import.meta.env.VITE_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const ADMIN_EMAILS = new Set(
  String(import.meta.env.VITE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

const MEMBER_TYPES = new Set<AuthUser["memberType"]>([
  "individual",
  "organization",
  "volunteer",
]);

type ProfileRow = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  member_type: AuthUser["memberType"];
  role: AuthRole;
  updated_at: string;
};

function isAdminIdentity(userId: string, email: string): boolean {
  return ADMIN_USER_IDS.has(userId) || ADMIN_EMAILS.has(email.trim().toLowerCase());
}

function toRole(userId: string, email: string): AuthRole {
  return isAdminIdentity(userId, email) ? "admin" : "member";
}

function getDisplayName(user: User): string {
  return (
    (typeof user.user_metadata?.["name"] === "string" && user.user_metadata["name"].trim()) ||
    (typeof user.user_metadata?.["full_name"] === "string" && user.user_metadata["full_name"].trim()) ||
    user.email?.split("@")[0] ||
    "Member"
  );
}

function getMemberType(user: User): AuthUser["memberType"] {
  const value = user.user_metadata?.["member_type"];
  return typeof value === "string" && MEMBER_TYPES.has(value as AuthUser["memberType"])
    ? (value as AuthUser["memberType"])
    : "individual";
}

function mapUser(user: User): AuthUser {
  const email = user.email ?? "";
  return {
    id: user.id,
    name: getDisplayName(user),
    email,
    memberSince: user.created_at
      ? new Date(user.created_at).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    memberType: getMemberType(user),
    imageUrl:
      typeof user.user_metadata?.["avatar_url"] === "string" &&
      user.user_metadata["avatar_url"].trim()
        ? user.user_metadata["avatar_url"].trim()
        : null,
    role: toRole(user.id, email),
  };
}

function profileRowFromUser(user: AuthUser): ProfileRow {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.imageUrl,
    member_type: user.memberType,
    role: user.role,
    updated_at: new Date().toISOString(),
  };
}

function AuthShell({
  children,
  user,
  isLoaded,
  logout,
  signIn,
  signUp,
}: {
  children: ReactNode;
  user: AuthUser | null;
  isLoaded: boolean;
  logout: () => void;
  signIn: AuthContextValue["signIn"];
  signUp: AuthContextValue["signUp"];
}) {
  const [followed, setFollowed] = useState<number[]>([]);
  const storageKey = user ? `papi_followed_${user.id}` : null;

  useEffect(() => {
    if (!storageKey) {
      setFollowed([]);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      setFollowed(raw ? JSON.parse(raw) : []);
    } catch {
      setFollowed([]);
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: number[]) => {
      setFollowed(next);
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
    },
    [storageKey],
  );

  const followProject = (projectId: number) =>
    persist([...new Set([...followed, projectId])]);
  const unfollowProject = (projectId: number) =>
    persist(followed.filter((id) => id !== projectId));
  const isFollowing = (projectId: number) => followed.includes(projectId);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin: user?.role === "admin",
        isLoaded,
        logout,
        signIn,
        signUp,
        followProject,
        unfollowProject,
        isFollowing,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const user = session?.user ? mapUser(session.user) : null;

  const syncProfile = useCallback(
    async (nextUser: AuthUser) => {
      const { error } = await supabase.from("profiles").upsert(profileRowFromUser(nextUser));
      if (error) {
        // Keep auth functional even if profile syncing fails.
        console.warn("Profile sync skipped:", error.message);
      }
    },
    [supabase],
  );

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) {
          return;
        }
        if (error) {
          setSession(null);
        } else {
          setSession(data.session ?? null);
        }
        setIsLoaded(true);
      })
      .catch(() => {
        if (active) {
          setSession(null);
          setIsLoaded(true);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setAuthTokenGetter(null);
  }, [supabase]);

  const signIn: AuthContextValue["signIn"] = useCallback(
    async ({ email, password }) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.session) {
        setSession(data.session);
      }

      return { success: true };
    },
    [supabase],
  );

  const signUp: AuthContextValue["signUp"] = useCallback(
    async ({ name, email, password, memberType }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name.trim(),
            full_name: name.trim(),
            member_type: memberType,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.session) {
        setSession(data.session);
        await syncProfile(mapUser(data.session.user));
        return { success: true };
      }

      return {
        success: true,
        requiresConfirmation: true,
        message: "Check your email to confirm your account, then sign in.",
      };
    },
    [supabase, syncProfile],
  );

  useEffect(() => {
    if (!session?.access_token) {
      setAuthTokenGetter(null);
      return;
    }

    setAuthTokenGetter(() => session.access_token);

    return () => {
      setAuthTokenGetter(null);
    };
  }, [session?.access_token]);

  useEffect(() => {
    if (!isLoaded || !session?.user) {
      return;
    }

    void syncProfile(mapUser(session.user));
  }, [isLoaded, session?.user?.id, syncProfile]);

  return (
    <AuthShell
      user={user}
      isLoaded={isLoaded}
      logout={logout}
      signIn={signIn}
      signUp={signUp}
    >
      {children}
    </AuthShell>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx;
}
