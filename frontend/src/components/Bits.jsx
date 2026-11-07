// Small presentational pieces shared across pages.

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner-wrap" role="status">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function StatusBadge({ status }) {
  const normalized = String(status || 'active').toLowerCase();
  const colors = {
    active: { bg: '#E8F5E9', text: '#2E7D32' },
    invited: { bg: '#FFF8E1', text: '#F57F17' },
    suspended: { bg: '#FFEBEE', text: '#C62828' },
    disabled: { bg: '#ECEFF1', text: '#546E7A' },
  };
  const style = colors[normalized] || colors.active;

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.2rem 0.6rem',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: style.bg,
        color: style.text,
        textTransform: 'capitalize',
      }}
    >
      {normalized}
    </span>
  );
}
