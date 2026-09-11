import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseUrl.includes('placeholder')
);

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(authToken?: string): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  // If a specific auth token is provided (server-side user request),
  // create a client scoped with this user's token for RLS enforcement.
  if (authToken) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    });
  }

  // For browser client: maintain singleton with session persistence
  if (typeof window !== 'undefined') {
    if (!clientInstance) {
      clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    }
    return clientInstance;
  }

  // Server-side without specific user token
  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    });
  }

  return clientInstance;
}

export interface SupabaseHealthStatus {
  isConfigured: boolean;
  tableExists: boolean;
  error?: string;
  checkedAt: number;
  projectId?: string;
}

let healthCache: SupabaseHealthStatus | null = null;
const CACHE_TTL_MS = 25000; // 25 seconds cache

export function getSupabaseProjectId(): string | undefined {
  if (!supabaseUrl) return undefined;
  try {
    const host = new URL(supabaseUrl).hostname;
    return host.split('.')[0];
  } catch {
    return undefined;
  }
}

export async function checkSupabaseHealth(forceRefresh = false): Promise<SupabaseHealthStatus> {
  const now = Date.now();
  if (!forceRefresh && healthCache && (now - healthCache.checkedAt < CACHE_TTL_MS)) {
    return healthCache;
  }

  const projectId = getSupabaseProjectId();

  if (!isSupabaseConfigured) {
    healthCache = {
      isConfigured: false,
      tableExists: false,
      checkedAt: now,
      projectId,
    };
    return healthCache;
  }

  try {
    const client = getSupabaseClient();
    if (!client) {
      healthCache = {
        isConfigured: true,
        tableExists: false,
        error: 'Unable to initialize Supabase client.',
        checkedAt: now,
        projectId,
      };
      return healthCache;
    }

    const { error } = await client.from('appointments').select('id').limit(1);

    if (error) {
      const isMissingTable = error.code === 'PGRST205' || error.message?.toLowerCase().includes('schema cache');
      healthCache = {
        isConfigured: true,
        tableExists: false,
        error: isMissingTable
          ? "The 'appointments' table does not exist in your Supabase project. Run schema.sql in your Supabase SQL Editor to activate database persistence."
          : error.message,
        checkedAt: now,
        projectId,
      };
      return healthCache;
    }

    healthCache = {
      isConfigured: true,
      tableExists: true,
      checkedAt: now,
      projectId,
    };
    return healthCache;
  } catch (err: any) {
    healthCache = {
      isConfigured: true,
      tableExists: false,
      error: err?.message || 'Failed to connect to Supabase.',
      checkedAt: now,
      projectId,
    };
    return healthCache;
  }
}

export function resetSupabaseHealthCache() {
  healthCache = null;
}
