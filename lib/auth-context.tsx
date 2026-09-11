'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  authToken: string | null;
  loading: boolean;
  isSupabase: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  signOut: () => Promise<void>;
  loginAsDemoUser: (name: string, email: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_USER_KEY = 'appointment_board_user';
const LOCAL_STORAGE_TOKEN_KEY = 'appointment_board_token';

// Preset demo users for convenient switching and instant testing
export const DEMO_USERS: Array<{ name: string; email: string; role: string }> = [
  { name: 'Alex Rivera', email: 'alex.rivera@appointment.io', role: 'Team Lead' },
  { name: 'Dr. Sarah Chen', email: 'sarah.chen@clinic.internal', role: 'Physician' },
  { name: 'Jordan Hayes', email: 'jordan.hayes@consulting.biz', role: 'Strategist' },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (isSupabaseConfigured) {
        const supabase = getSupabaseClient();
        if (supabase) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user && mounted) {
              setUser({
                id: session.user.id,
                email: session.user.email || 'user@example.com',
                name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
              });
              setAuthToken(session.access_token);
            }

            // Listen for auth state changes
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
              if (!mounted) return;
              if (session?.user) {
                setUser({
                  id: session.user.id,
                  email: session.user.email || 'user@example.com',
                  name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
                });
                setAuthToken(session.access_token);
              } else {
                setUser(null);
                setAuthToken(null);
              }
            });

            return () => {
              subscription.unsubscribe();
            };
          } catch (err) {
            console.error('Error initializing Supabase Auth:', err);
          }
        }
      }

      // Fallback: check localStorage for local/demo user session
      try {
        const savedUserStr = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
        const savedToken = localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);
        if (savedUserStr && mounted) {
          const parsed = JSON.parse(savedUserStr);
          setUser(parsed);
          setAuthToken(savedToken || parsed.id);
        } else if (mounted) {
          // Default to the first demo user so users have immediate access
          const defaultUser: AuthUser = {
            id: 'user-alex-demo-id',
            name: DEMO_USERS[0].name,
            email: DEMO_USERS[0].email,
          };
          setUser(defaultUser);
          setAuthToken(defaultUser.id);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(defaultUser));
          localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, defaultUser.id);
        }
      } catch (e) {
        console.warn('LocalStorage error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!email.trim() || !password) {
      return { success: false, error: 'Email and password are required.' };
    }

    if (isSupabaseConfigured) {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          return { success: false, error: error.message };
        }

        if (data.session && data.user) {
          const authUser: AuthUser = {
            id: data.user.id,
            email: data.user.email || email.trim(),
            name: data.user.user_metadata?.name || email.trim().split('@')[0],
          };
          setUser(authUser);
          setAuthToken(data.session.access_token);
          return { success: true };
        }
      }
    }

    // Local / Dev Fallback: Deterministic simulated account
    const simulatedId = `local-${email.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const localUser: AuthUser = {
      id: simulatedId,
      email: email.trim(),
      name: email.trim().split('@')[0],
    };
    setUser(localUser);
    setAuthToken(simulatedId);
    try {
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(localUser));
      localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, simulatedId);
    } catch {}

    return { success: true };
  };

  const signUp = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; message?: string }> => {
    if (!email.trim() || !password) {
      return { success: false, error: 'Email and password are required.' };
    }
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    if (isSupabaseConfigured) {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              name: email.trim().split('@')[0],
            },
          },
        });

        if (error) {
          return { success: false, error: error.message };
        }

        if (data.session && data.user) {
          const authUser: AuthUser = {
            id: data.user.id,
            email: data.user.email || email.trim(),
            name: data.user.user_metadata?.name || email.trim().split('@')[0],
          };
          setUser(authUser);
          setAuthToken(data.session.access_token);
          return { success: true, message: 'Account created and signed in successfully!' };
        }

        return {
          success: true,
          message: 'Account created! Please check your email inbox to confirm your registration if email confirmations are enabled.',
        };
      }
    }

    // Local / Dev Fallback:
    const simulatedId = `local-${email.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const localUser: AuthUser = {
      id: simulatedId,
      email: email.trim(),
      name: email.trim().split('@')[0],
    };
    setUser(localUser);
    setAuthToken(simulatedId);
    try {
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(localUser));
      localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, simulatedId);
    } catch {}

    return { success: true, message: 'Account registered and signed in successfully!' };
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    }

    setUser(null);
    setAuthToken(null);
    try {
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
      localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
    } catch {}
  };

  const loginAsDemoUser = (name: string, email: string) => {
    const simulatedId = `demo-${email.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const demoUser: AuthUser = {
      id: simulatedId,
      name,
      email,
    };
    setUser(demoUser);
    setAuthToken(simulatedId);
    try {
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(demoUser));
      localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, simulatedId);
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authToken,
        loading,
        isSupabase: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        loginAsDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
