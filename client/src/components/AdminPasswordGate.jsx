import { useState, useEffect, useRef } from 'react';

export default function AdminPasswordGate({ onAuthorized }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const onAuthorizedRef = useRef(onAuthorized);

  // Keep ref up to date without re-triggering the effect
  useEffect(() => {
    onAuthorizedRef.current = onAuthorized;
  });

  // Check sessionStorage on mount — skip login if already authorized this session
  useEffect(() => {
    if (sessionStorage.getItem('admin_authorized') === 'true') {
      onAuthorizedRef.current();
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/check-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pass: input.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem('admin_authorized', 'true');
        // Store password in sessionStorage so the Editor can re-use it for save calls.
        // This is acceptable given the password was previously fully visible in the URL.
        sessionStorage.setItem('admin_password', input.trim());
        onAuthorizedRef.current(input.trim());
      } else {
        setError('❌ Parolă greșită. Încearcă din nou.');
        setInput('');
      }
    } catch {
      setError('❌ Eroare de conexiune.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <h1 style={styles.title}>🔒 ADMIN ACCESS</h1>
        <input
          type="password"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Introdu parola..."
          style={styles.input}
          autoFocus
          disabled={loading}
        />
        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? 'Se verifică...' : 'Intră'}
        </button>
        {error && <p style={styles.error}>{error}</p>}
      </form>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#060ce9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    color: '#FFD700',
    fontSize: '48px',
    fontFamily: '"Arial Black", Arial, sans-serif',
    textShadow: '3px 3px 6px #000',
    letterSpacing: '2px',
    textAlign: 'center',
    margin: 0,
  },
  input: {
    border: '3px solid #FFD700',
    background: '#1a1a4a',
    color: 'white',
    fontSize: '24px',
    padding: '16px 20px',
    borderRadius: '10px',
    textAlign: 'center',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  },
  button: {
    background: '#FFD700',
    color: '#060ce9',
    border: 'none',
    fontSize: '28px',
    fontFamily: '"Arial Black", Arial, sans-serif',
    padding: '18px',
    borderRadius: '10px',
    cursor: 'pointer',
    width: '100%',
    fontWeight: 'bold',
    letterSpacing: '1px',
  },
  error: {
    color: '#ff6b6b',
    fontSize: '20px',
    fontFamily: 'Arial, sans-serif',
    textAlign: 'center',
    margin: 0,
  },
};
