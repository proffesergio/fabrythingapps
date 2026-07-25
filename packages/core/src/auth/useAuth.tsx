import React, { createContext, useContext, useEffect, useState } from 'react';
import { AxiosInstance } from 'axios';
import { jwtDecode } from 'jwt-decode';
import { TokenStore } from '../api/tokenStore';
import { login as doLogin } from './login';

type Session = { role: string; username: string };
type AuthState = { role: string | null; username: string | null; loading: boolean;
  signIn: (id: string, pw: string) => Promise<void>; signOut: () => Promise<void>; };

interface AccessClaims { role?: string; username?: string; }

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ api, store, children }:
  { api: AxiosInstance; store: TokenStore; children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const access = await store.getAccess();
        if (access) {
          try {
            const claims = jwtDecode<AccessClaims>(access);
            if (!cancelled) {
              setSession({ role: claims.role ?? '', username: claims.username ?? '' });
            }
          } catch {
            // Corrupt or undecodable stored token: treat as signed out.
          }
        }
      } catch {
        // getAccess() rejected (e.g. corrupted keystore entry): treat as signed out.
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store]);
  const signIn = async (id: string, pw: string) => {
    const res = await doLogin(api, id, pw);
    await store.setTokens(res.access, res.refresh);
    setSession({ role: res.role, username: res.username });
  };
  const signOut = async () => { await store.clear(); setSession(null); };
  return <Ctx.Provider value={{ role: session?.role ?? null, username: session?.username ?? null, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}
