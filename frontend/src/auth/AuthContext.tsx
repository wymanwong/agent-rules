import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, getToken, setToken } from '../api';
import { clearAssignmentMetaCache, warmAssignmentMeta } from '../tickets/assignmentMetaCache';

export type UserRole = 'EndUser' | 'IT' | 'Admin';

export interface User {
  id: number;
  name: string;
  email: string;
  department: string | null;
  role: UserRole;
  team_id: number | null;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<User | null>('/auth/me');
      if (!me) {
        setToken(null);
        setUser(null);
        clearAssignmentMetaCache();
      } else {
        setUser(me);
        if (me.role === 'IT' || me.role === 'Admin') warmAssignmentMeta();
      }
    } catch {
      setToken(null);
      setUser(null);
      clearAssignmentMetaCache();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      json: { email, password },
    });
    setToken(res.token);
    setUser(res.user);
    if (res.user.role === 'IT' || res.user.role === 'Admin') warmAssignmentMeta();
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    clearAssignmentMetaCache();
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshMe }),
    [user, loading, login, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
