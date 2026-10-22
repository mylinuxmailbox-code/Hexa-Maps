'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Trash2, X } from 'lucide-react';
import { hexaApi } from '@/lib/api-client';
import { useMapStore } from '@/store/map-store';

export function AuthModal() {
  const queryClient = useQueryClient();
  const open = useMapStore((s) => s.authModalOpen);
  const setOpen = useMapStore((s) => s.setAuthModalOpen);
  const user = useMapStore((s) => s.user);
  const setUser = useMapStore((s) => s.setUser);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res =
        mode === 'register'
          ? await hexaApi.register({ email, password, displayName })
          : await hexaApi.login({ email, password });
      setUser(res.user);
      void queryClient.invalidateQueries({ queryKey: ['saved-places'] });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await hexaApi.logout();
    setUser(null);
    void queryClient.invalidateQueries({ queryKey: ['saved-places'] });
    setOpen(false);
  };

  const handleDeleteAccount = async () => {
    await hexaApi.deleteAccount();
    setUser(null);
    void queryClient.invalidateQueries({ queryKey: ['saved-places'] });
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {user ? 'Hexa Maps Account' : mode === 'login' ? 'Sign in to Hexa Maps' : 'Create Account'}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {user ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {user.displayName}
              </div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </div>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>

            <button
              type="button"
              onClick={() => void handleDeleteAccount()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
            >
              <Trash2 className="h-4 w-4" />
              Delete Account & All Saved Data
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Arjun Naik"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Password (min 8 characters)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-rose-500/10 p-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
            >
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            <div className="text-center text-xs text-slate-500">
              {mode === 'login' ? (
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="font-semibold text-amber-600 hover:underline dark:text-amber-400"
                >
                  Need an account? Register
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="font-semibold text-amber-600 hover:underline dark:text-amber-400"
                >
                  Already registered? Sign in
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
