import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

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
        <span className="logo-en" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>School SaaS</span>
        <span className="logo-te" style={{ fontSize: '0.75rem', color: '#64748b' }}>Operations Portal</span>
      </span>
    </Link>
  );
}

function Header() {
  return (
    <header className="site-header">
      <div className="topbar" style={{ background: '#0f172a', color: '#94a3b8', fontSize: '0.8rem', padding: '0.4rem 1rem', textAlign: 'center' }}>
        <span>Enterprise Multi-Tenant School Management SaaS · Phase 1 Active</span>
      </div>
      <div className="header-main container" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo />
        <div className="header-actions">
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
            Environment: <strong>Development</strong>
          </span>
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
          <div className="footer-brand" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>School Management SaaS</div>
          <p className="small" style={{ color: '#94a3b8', lineHeight: 1.6 }}>
            Enterprise-grade multi-tenant educational management platform with complete data isolation and automated cloud operations.
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
        © {new Date().getFullYear()} School Management SaaS Platform · All tenant data is cryptographically and logically isolated.
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
