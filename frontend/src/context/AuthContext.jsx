import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const logout = useCallback(async () => {
    try {
      if (tokenStore.get()) {
        await api('/v1/auth/logout', { method: 'POST' }).catch(() => {});
      }
    } finally {
      tokenStore.set(null);
      setUser(null);
      setRoles([]);
      setTenant(null);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }

    api('/v1/auth/me')
      .then((data) => {
        const u = data.user || data;
        setUser(u);
        setRoles(data.roles || []);
        if (data.memberships && data.memberships[0]) {
          const m = data.memberships[0];
          setTenant({
            id: m.tenant_id,
            name: m.tenant_name,
            slug: m.tenant_slug,
          });
        }
      })
      .catch(() => {
        logout();
      })
      .finally(() => {
        setLoading(false);
      });
  }, [logout]);

  const login = useCallback(async (email, password, tenantDomain = null) => {
    const headers = {};
    if (tenantDomain) {
      headers['X-Tenant-Domain'] = tenantDomain.trim().toLowerCase();
    }

    const data = await api('/v1/auth/login', {
      method: 'POST',
      headers,
      body: { email, password },
    });

    const token = data.accessToken || data.token;
    tokenStore.set(token);

    const currentUser = data.user;
    setUser(currentUser);
    setRoles(data.roles || []);
    setTenant(data.tenant || null);

    return { user: currentUser, roles: data.roles || [], tenant: data.tenant || null };
  }, []);

  const value = useMemo(
    () => ({
      user,
      roles,
      tenant,
      loading,
      login,
      logout,
      isSuperAdmin: roles.includes('SuperAdmin'),
      isSchoolAdmin: roles.includes('SchoolAdmin'),
      isPrincipal: roles.includes('Principal'),
      isTeacher: roles.includes('Teacher'),
      isStudent: roles.includes('Student'),
      isParent: roles.includes('Parent'),
      isAccountant: roles.includes('Accountant'),
    }),
    [user, roles, tenant, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
