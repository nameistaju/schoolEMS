import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="container section auth-wrap">
      <div className="card auth-card" style={{ maxWidth: '480px', margin: '0 auto', padding: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{title}</h1>
        {subtitle && <p className="muted" style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

const PRESET_SCHOOLS = [
  { label: 'Apex Academy', domain: 'apex.example' },
  { label: 'Horizon International', domain: 'horizon.example' },
  { label: 'Platform Administration (SuperAdmin)', domain: '' },
];

export function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '', tenantDomain: 'apex.example' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const fillCredentials = (email, password, tenantDomain) => {
    setForm({ email, password, tenantDomain });
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await login(form.email, form.password, form.tenantDomain || null);
      const displayName = res.user.fullName || res.user.name || res.user.email;
      const roleName = res.roles && res.roles.length > 0 ? ` (${res.roles[0]})` : '';
      toast(`Welcome back, ${displayName}${roleName}!`);
      nav(params.get('next') || '/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Sign in to SchoolEMS"
      subtitle="Access your school operations portal with verified tenant credentials"
    >
      <form onSubmit={submit} className="stack">
        <label>
          School Tenant Context
          <select
            value={form.tenantDomain}
            onChange={(e) => setForm({ ...form, tenantDomain: e.target.value })}
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
          >
            {PRESET_SCHOOLS.map((s) => (
              <option key={s.domain} value={s.domain}>
                {s.label} {s.domain ? `(${s.domain})` : '(No Tenant / Root)'}
              </option>
            ))}
          </select>
        </label>

        <label>
          Email Address
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="email"
            placeholder="e.g. admin@apex.example"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            autoComplete="current-password"
          />
        </label>

        {error && <div className="alert alert-error">{error}</div>}

        <button className="btn btn-red btn-lg btn-block" disabled={busy} type="submit">
          {busy ? 'Authenticating…' : 'Sign In'}
        </button>

        <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
          <p className="small muted" style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
            Quick Demo Accounts (Local Dev):
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-outline small"
              onClick={() => fillCredentials('admin@apex.example', 'DemoPassword@2026', 'apex.example')}
            >
              Apex Admin
            </button>
            <button
              type="button"
              className="btn btn-outline small"
              onClick={() => fillCredentials('admin@horizon.example', 'DemoPassword@2026', 'horizon.example')}
            >
              Horizon Admin
            </button>
            <button
              type="button"
              className="btn btn-outline small"
              onClick={() => fillCredentials('teacher@apex.example', 'DemoPassword@2026', 'apex.example')}
            >
              Apex Teacher
            </button>
            <button
              type="button"
              className="btn btn-outline small"
              onClick={() => fillCredentials('student@apex.example', 'DemoPassword@2026', 'apex.example')}
            >
              Apex Student
            </button>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-block small"
            style={{ marginTop: '0.5rem' }}
            onClick={() => fillCredentials('superadmin@schoolsaas.internal', 'SuperAdmin@2026', '')}
          >
            Platform SuperAdmin
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const toast = useToast();
  const nav = useNavigate();
  const [form, setForm] = useState({
    institutionName: '',
    contactName: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    toast('School onboarding inquiry received. A platform administrator will review your setup.');
    setTimeout(() => nav('/login'), 2000);
  };

  return (
    <AuthShell
      title="Register an Institution"
      subtitle="Onboard a new school, trust, or campus network onto SchoolEMS"
    >
      {submitted ? (
        <div className="alert alert-success" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <h3>Inquiry Submitted</h3>
          <p className="muted" style={{ margin: '0.5rem 0' }}>
            Your request for <strong>{form.institutionName}</strong> has been logged.
          </p>
          <p className="small">Redirecting to sign-in...</p>
        </div>
      ) : (
        <form onSubmit={submit} className="stack">
          <label>
            Institution / School Name
            <input
              required
              value={form.institutionName}
              onChange={upd('institutionName')}
              placeholder="e.g. Apex International Academy"
            />
          </label>
          <label>
            Primary Administrator Name
            <input
              required
              value={form.contactName}
              onChange={upd('contactName')}
              autoComplete="name"
            />
          </label>
          <label>
            Administrative Email
            <input
              type="email"
              required
              value={form.email}
              onChange={upd('email')}
              autoComplete="email"
              placeholder="admin@school.org"
            />
          </label>
          <label>
            Contact Phone
            <input
              value={form.phone}
              onChange={upd('phone')}
              inputMode="numeric"
              autoComplete="tel"
            />
          </label>
          <button className="btn btn-green btn-lg btn-block" type="submit">
            Submit Onboarding Request
          </button>
          <p className="center small">
            Already have an active school account? <Link to="/login">Sign In</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
