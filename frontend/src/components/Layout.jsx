import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Logo() {
  return (
    <Link to="/" className="logo" aria-label="School Management Platform home">
      <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#0D47A1" />
        <path d="M32 14L12 25L32 36L52 25L32 14Z" fill="#FFFFFF" />
        <path d="M20 31.5V42C20 46 25 50 32 50C39 50 44 46 44 42V31.5L32 38L20 31.5Z" fill="#90CAF9" />
        <circle cx="52" cy="36" r="3" fill="#FFD54F" />
        <path d="M52 39V48" stroke="#FFD54F" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="logo-text">
        <span className="logo-en" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>SchoolEMS</span>
        <span className="logo-te" style={{ fontSize: '0.75rem', color: '#64748b' }}>Operations Portal</span>
      </span>
    </Link>
  );
}

function Header() {
  const { user, roles, tenant, logout } = useAuth();

  return (
    <header className="site-header">
      <div className="topbar" style={{ background: '#0f172a', color: '#94a3b8', fontSize: '0.8rem', padding: '0.4rem 1rem', textAlign: 'center' }}>
        <span>Enterprise Multi-Tenant School Management SaaS · Phase 1 Identity Active</span>
      </div>
      <div className="header-main container" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo />
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                  {user.fullName || user.name || user.email}
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                  {tenant && (
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {tenant.name} ·
                    </span>
                  )}
                  <span
                    style={{
                      background: '#E3F2FD',
                      color: '#0D47A1',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  >
                    {roles[0] || 'User'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline small"
                onClick={logout}
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Link
                to="/login"
                className="btn btn-outline small"
                style={{ fontSize: '0.85rem', padding: '0.35rem 0.85rem', textDecoration: 'none' }}
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="btn btn-red small"
                style={{ fontSize: '0.85rem', padding: '0.35rem 0.85rem', textDecoration: 'none' }}
              >
                Register School
              </Link>
            </div>
          )}
        </div>
      </div>
      <nav className="main-nav" style={{ borderTop: '1px solid #e2e8f0', background: '#ffffff' }}>
        <div className="container" style={{ display: 'flex', gap: '1.5rem', padding: '0.5rem 1rem' }}>
          <NavLink to="/" end style={{ textDecoration: 'none', color: '#0f172a', fontWeight: 600, fontSize: '0.95rem' }}>
            Platform Overview
          </NavLink>
        </div>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer" style={{ background: '#0f172a', color: '#cbd5e1', padding: '2.5rem 0 1.5rem', borderTop: '1px solid #1e293b' }}>
      <div className="container footer-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        <div>
          <div className="footer-brand" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>SchoolEMS SaaS</div>
          <p className="small" style={{ color: '#94a3b8', lineHeight: 1.6 }}>
            Enterprise-grade multi-tenant educational management platform with complete PostgreSQL Row-Level Security data isolation.
          </p>
        </div>
        <div>
          <h4 style={{ color: '#ffffff', fontSize: '0.9rem', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Architecture</h4>
          <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>PostgreSQL RLS Tenancy</span>
          <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Asymmetric RS256 Identity</span>
          <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem' }}>7 Canonical RBAC Roles</span>
        </div>
        <div>
          <h4 style={{ color: '#ffffff', fontSize: '0.9rem', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Security &amp; DevOps</h4>
          <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Append-Only Audit Logs</span>
          <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Kubernetes &amp; GitOps Mesh</span>
          <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem' }}>AIOps Autonomous Remediation</span>
        </div>
      </div>
      <div className="footer-bottom container" style={{ borderTop: '1px solid #1e293b', paddingTop: '1.25rem', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
        © {new Date().getFullYear()} SchoolEMS Platform · All tenant data is cryptographically and logically isolated.
      </div>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
