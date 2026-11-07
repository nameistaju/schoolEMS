import React from 'react';

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid" style={{ gridTemplateColumns: '1fr', padding: '3.5rem 1rem' }}>
          <div className="hero-copy" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <p className="hero-te" style={{ letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.9rem', color: '#1565C0' }}>
              Enterprise Cloud Platform
            </p>
            <h1 style={{ fontSize: '2.5rem', lineHeight: '1.2', margin: '0.75rem 0' }}>
              Multi-Tenant School Management SaaS
            </h1>
            <p className="hero-sub" style={{ fontSize: '1.15rem', color: '#555', margin: '1rem auto 2rem' }}>
              A secure, cloud-native educational operations platform engineered for multi-school federations and campus networks with strict tenant isolation, role-based access control, and automated operations.
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: '#E3F2FD', color: '#0D47A1', borderRadius: '50px', fontSize: '0.9rem', fontWeight: 600 }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2E7D32', display: 'inline-block' }}></span>
              Phase 1: Multi-Tenant Foundation &amp; Identity Service Active
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2>Core Architectural Capabilities</h2>
          <p className="muted" style={{ maxWidth: '600px', margin: '0.5rem auto 0' }}>
            Engineered to support independent school trusts, campus networks, and distributed academic organizations on unified infrastructure.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.75rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🏫</div>
            <h3 style={{ margin: '0 0 0.5rem' }}>Multi-Tenant Isolation</h3>
            <p className="muted" style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
              PostgreSQL Row-Level Security (RLS) guarantees complete data segregation between independent schools and trusts at the database layer.
            </p>
          </div>

          <div className="card" style={{ padding: '1.75rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔐</div>
            <h3 style={{ margin: '0 0 0.5rem' }}>Asymmetric RS256 Auth</h3>
            <p className="muted" style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
              Cryptographic JWT isolation with RSA-2048 signing, automated refresh token family rotation, and session compromise detection.
            </p>
          </div>

          <div className="card" style={{ padding: '1.75rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>👥</div>
            <h3 style={{ margin: '0 0 0.5rem' }}>Hierarchical RBAC</h3>
            <p className="muted" style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
              Fine-grained access control across 7 canonical system roles with branch-level and tenant-wide operational scopes.
            </p>
          </div>

          <div className="card" style={{ padding: '1.75rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🌐</div>
            <h3 style={{ margin: '0 0 0.5rem' }}>Custom Domain Routing</h3>
            <p className="muted" style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
              Authoritative host-based tenant resolution supporting dedicated custom domains and branded subdomains per school.
            </p>
          </div>
        </div>
      </section>

      <section className="promise" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '3rem 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2>Platform Engineering Standards</h2>
            <p className="muted">Built following cloud-native best practices and automated GitOps workflows.</p>
          </div>
          <div className="promise-grid">
            <div className="promise-item">
              <div className="promise-icon">⚡</div>
              <h3>Automated CI/CD &amp; GitOps</h3>
              <p>Declarative Kubernetes deployments with ArgoCD, Terraform infrastructure as code, and canary rollouts.</p>
            </div>
            <div className="promise-item">
              <div className="promise-icon">📊</div>
              <h3>AIOps Telemetry</h3>
              <p>Prometheus metrics, distributed tracing, and autonomous Kira incident remediation engine.</p>
            </div>
            <div className="promise-item">
              <div className="promise-icon">🛡️</div>
              <h3>Security &amp; Audit</h3>
              <p>Immutable append-only audit logging for all administrative events, role changes, and member invitations.</p>
            </div>
            <div className="promise-item">
              <div className="promise-icon">🔄</div>
              <h3>High Availability</h3>
              <p>Resilient multi-container microservice mesh behind unified API gateway routing and circuit breaking.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
