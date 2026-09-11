'use client';

import React, { useState } from 'react';
import { useAuth, DEMO_USERS } from '@/lib/auth-context';
import { X, Lock, Mail, User, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'signup';
}

export function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const { signIn, signUp, loginAsDemoUser, isSupabase } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await signIn(email, password);
        if (!res.success) {
          setError(res.error || 'Login failed. Please check your credentials.');
        } else {
          onClose();
        }
      } else {
        const res = await signUp(email, password);
        if (!res.success) {
          setError(res.error || 'Sign up failed.');
        } else {
          setInfoMessage(res.message || 'Account created successfully!');
          setTimeout(() => {
            onClose();
          }, 1200);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSelect = (name: string, email: string) => {
    loginAsDemoUser(name, email);
    onClose();
  };

  return (
    <div
      id="auth-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="auth-modal-dialog"
        className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden text-stone-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-800/80 bg-stone-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-stone-100">
                {mode === 'login' ? 'Sign In to Appointment Board' : 'Create an Account'}
              </h2>
              <p className="text-xs text-stone-400">
                {isSupabase ? 'Protected by Supabase Auth' : 'Local Authentication Mode'}
              </p>
            </div>
          </div>
          <button
            id="auth-modal-close-btn"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-6 pt-5">
          <div className="flex p-1 bg-stone-950 border border-stone-800/80 rounded-xl">
            <button
              id="auth-tab-login"
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setInfoMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-stone-800 text-stone-100 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Sign In
            </button>
            <button
              id="auth-tab-signup"
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
                setInfoMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-stone-800 text-stone-100 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="flex items-start gap-2.5 p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-stone-300 mb-1.5">
              Email address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-9 pr-3.5 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-colors"
              />
            </div>
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-stone-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="auth-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-colors"
              />
            </div>
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-stone-950 font-semibold text-sm rounded-xl transition-all shadow-md shadow-amber-500/10 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Quick Demo Switcher Section */}
          <div className="pt-3 border-t border-stone-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                Or switch to a demo account
              </span>
              <span className="text-[10px] text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded">
                Instant Access
              </span>
            </div>
            <div className="space-y-1.5">
              {DEMO_USERS.map((dUser) => (
                <button
                  key={dUser.email}
                  type="button"
                  id={`demo-login-${dUser.email.replace(/[^a-z0-9]/g, '-')}`}
                  onClick={() => handleDemoSelect(dUser.name, dUser.email)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-stone-950/60 hover:bg-stone-800/60 border border-stone-800/60 rounded-xl text-xs text-left transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-stone-800 flex items-center justify-center text-stone-300 font-medium text-[11px]">
                      {dUser.name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-stone-200 group-hover:text-amber-400 transition-colors">
                        {dUser.name}
                      </p>
                      <p className="text-[10px] text-stone-500">{dUser.email}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-stone-400 bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded">
                    {dUser.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
