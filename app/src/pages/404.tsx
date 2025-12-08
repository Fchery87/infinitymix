export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ letterSpacing: '0.2em', color: '#6b7280', textTransform: 'uppercase' }}>404</p>
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Page not found</h1>
        <p style={{ color: '#9ca3af' }}>The page you are looking for does not exist.</p>
      </div>
    </div>
  );
}
