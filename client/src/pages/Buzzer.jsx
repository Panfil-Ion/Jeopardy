import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import socket from '../socket.js';

export default function Buzzer() {
  const [searchParams] = useSearchParams();
  const teamId = searchParams.get('team');

  const [gameState, setGameState] = useState(null);
  const [buzzerQueue, setBuzzerQueue] = useState([]);
  const [buzzed, setBuzzed] = useState(false);
  const wakeLockRef = useRef(null);

  // Device lock: one team per device/browser
  const deviceTeamKey = 'buzzer_device_team';

  const registeredKey = useMemo(() => `buzzer_registered_${teamId}`, [teamId]);
  const tokenKey = useMemo(() => `buzzer_team_token_${teamId}`, [teamId]);

  const [registered, setRegistered] = useState(
    () => (teamId ? Boolean(localStorage.getItem(`buzzer_registered_${teamId}`)) : false)
  );

  const [teamNameInput, setTeamNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [regError, setRegError] = useState('');
  const [regChecking, setRegChecking] = useState(false);

  const deviceTeam = teamId ? localStorage.getItem(deviceTeamKey) : null;
  const deviceLockedToOtherTeam = Boolean(deviceTeam && teamId && deviceTeam !== teamId);

  function logoutDevice() {
    const existing = localStorage.getItem(deviceTeamKey);
    if (existing) {
      localStorage.removeItem(`buzzer_registered_${existing}`);
      localStorage.removeItem(`buzzer_team_token_${existing}`);
    }
    localStorage.removeItem(deviceTeamKey);
  }

  // Wake Lock API
  useEffect(() => {
    if (!registered) return;

    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('Wake lock failed:', err?.message || err);
      }
    }

    requestWakeLock();

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') requestWakeLock();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) wakeLockRef.current.release().catch(() => {});
    };
  }, [registered]);

  // Socket listeners (only when registered)
  useEffect(() => {
    if (!registered) return;

    function onGameState(state) {
      setGameState(state);
      setBuzzerQueue(state.buzzerQueue || []);
      if (!state.buzzersActive) setBuzzed(false);
    }

    function onBuzzerUpdate(queue) {
      setBuzzerQueue(queue);
    }

    function onBuzzerActivated() {
      setBuzzed(false);
      setGameState(prev => (prev ? { ...prev, buzzersActive: true } : prev));
    }

    function onBuzzerDeactivated() {
      setBuzzed(false);
      setBuzzerQueue([]);
      setGameState(prev => (prev ? { ...prev, buzzersActive: false } : prev));
    }

    function onScoreUpdate(teams) {
      setGameState(prev => (prev ? { ...prev, teams } : prev));
    }

    function onQuestionClose() {
      setBuzzed(false);
      setBuzzerQueue([]);
      setGameState(prev => (prev ? { ...prev, buzzersActive: false, buzzerQueue: [] } : prev));
    }

    function onBuzzDenied({ teamId: deniedTeamId, reason }) {
      if (deniedTeamId !== teamId) return;
      if (reason === 'unauthorized') {
        // Another phone logged in OR server restarted (tokens lost).
        localStorage.removeItem(registeredKey);
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(deviceTeamKey);
        setRegistered(false);
        setRegError('❌ Sesiunea ta a expirat sau alt dispozitiv s-a logat pe această echipă. Introdu parola din nou.');
      }
    }

    socket.on('game_state', onGameState);
    socket.on('buzzer_update', onBuzzerUpdate);
    socket.on('buzzer_activated', onBuzzerActivated);
    socket.on('buzzer_deactivated', onBuzzerDeactivated);
    socket.on('score_update', onScoreUpdate);
    socket.on('question_close', onQuestionClose);
    socket.on('buzz_denied', onBuzzDenied);

    socket.emit('request_state');

    return () => {
      socket.off('game_state', onGameState);
      socket.off('buzzer_update', onBuzzerUpdate);
      socket.off('buzzer_activated', onBuzzerActivated);
      socket.off('buzzer_deactivated', onBuzzerDeactivated);
      socket.off('score_update', onScoreUpdate);
      socket.off('question_close', onQuestionClose);
      socket.off('buzz_denied', onBuzzDenied);
    };
  }, [registered, teamId, registeredKey, tokenKey]);

  if (!teamId) {
    return (
      <div style={styles.error}>
        <h1 style={styles.errorTitle}>❌ Missing Team ID</h1>
        <p style={styles.errorText}>
          Open this page as: <code>/buzzer?team=team1</code>
        </p>
      </div>
    );
  }

  // If this device is already locked to another team -> block
  if (deviceLockedToOtherTeam) {
    return (
      <div style={styles.passwordPage}>
        <h1 style={styles.passwordTitle}>Acces restricționat</h1>
        <p style={styles.passwordSubtitle}>
          Telefonul este logat pe: <strong style={{ color: '#FFD700' }}>{deviceTeam}</strong>
        </p>
        <p style={styles.passwordSubtitle}>
          Pentru a intra pe <strong style={{ color: '#FFD700' }}>{teamId}</strong>, trebuie să schimbi echipa.
        </p>

        <button
          type="button"
          style={styles.passwordBtn}
          onClick={() => {
            logoutDevice();
            setRegError('');
            setTeamNameInput('');
            setPasswordInput('');
            setRegistered(false);
          }}
        >
          Schimbă echipa (logout)
        </button>
      </div>
    );
  }

  // Login form (server-enforced)
  async function handleRegisterSubmit(e) {
    e.preventDefault();

    const name = teamNameInput.trim();
    const pass = passwordInput.trim();
    if (!name || !pass) {
      setRegError('⚠️ Completează ambele câmpuri.');
      return;
    }

    setRegChecking(true);
    setRegError('');

    try {
      const res = await fetch('/api/team-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, teamName: name, password: pass }),
      });

      const data = await res.json();

      if (data.ok && data.token) {
        // lock device to this team
        localStorage.setItem(deviceTeamKey, teamId);

        // store "registered" + token
        localStorage.setItem(registeredKey, name);
        localStorage.setItem(tokenKey, data.token);

        setRegistered(true);

        // request fresh state and reload as fallback (mobile)
        socket.emit('request_state');
        setTimeout(() => window.location.reload(), 800);
      } else {
        setRegError(`❌ ${data.error || 'Login eșuat'}`);
      }
    } catch {
      setRegError('❌ Eroare de conexiune. Încearcă din nou.');
    } finally {
      setRegChecking(false);
    }
  }

  if (!registered) {
    return (
      <div style={styles.passwordPage}>
        <h1 style={styles.passwordTitle}>Înregistrare Echipă</h1>
        <p style={styles.passwordSubtitle}>
          Slot: <strong style={{ color: '#FFD700' }}>{teamId}</strong>
        </p>
        <form onSubmit={handleRegisterSubmit} style={styles.passwordForm}>
          <input
            type="text"
            value={teamNameInput}
            onChange={e => setTeamNameInput(e.target.value)}
            placeholder="Numele echipei tale"
            style={styles.passwordInput}
            autoFocus
            autoComplete="off"
          />
          <input
            type="password"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            placeholder="Parola echipei"
            style={styles.passwordInput}
            autoComplete="current-password"
          />
          {regError && <div style={styles.passwordError}>{regError}</div>}
          <button type="submit" style={styles.passwordBtn} disabled={regChecking}>
            {regChecking ? '...' : 'Înregistrează-te'}
          </button>
        </form>
      </div>
    );
  }

  if (!gameState) {
    return <div style={styles.loading}>Se încarcă jocul…</div>;
  }

  const team = gameState.teams.find(t => t.id === teamId);

  // ✅ Fix: no infinite "Se conectează..."
  // If server doesn't have the team, force re-login.
  if (!team) {
    localStorage.removeItem(registeredKey);
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(deviceTeamKey);
    return (
      <div style={styles.passwordPage}>
        <h1 style={styles.passwordTitle}>Reînregistrare necesară</h1>
        <p style={styles.passwordSubtitle}>
          Serverul nu găsește echipa <strong style={{ color: '#FFD700' }}>{teamId}</strong> (posibil restart).
        </p>
        <button type="button" style={styles.passwordBtn} onClick={() => window.location.reload()}>
          Reîncarcă
        </button>
      </div>
    );
  }

  const buzzersActive = gameState.buzzersActive;
  const myPosition = buzzerQueue.findIndex(e => e.teamId === teamId);
  const amFirst = myPosition === 0;
  const firstTeam = buzzerQueue[0] ? gameState.teams.find(t => t.id === buzzerQueue[0].teamId) : null;

  function handleBuzz() {
    if (!buzzersActive || buzzed) return;

    const token = localStorage.getItem(tokenKey);
    if (!token) {
      // no token -> force relogin
      localStorage.removeItem(registeredKey);
      localStorage.removeItem(deviceTeamKey);
      setRegistered(false);
      setRegError('❌ Token lipsă. Introdu parola din nou.');
      return;
    }

    socket.emit('buzz', { teamId, token, timestamp: Date.now() });
    setBuzzed(true);
  }

  let statusEl = null;
  let btnDisabled = !buzzersActive || buzzed;
  let btnStyle = { ...styles.buzzBtn };

  if (!buzzersActive && !buzzed) {
    btnStyle = { ...btnStyle, ...styles.buzzBtnDisabled };
    statusEl = <p style={styles.statusWaiting}>⏸ Waiting for buzzers to activate...</p>;
  } else if (buzzed && amFirst) {
    statusEl = <div style={styles.statusFirst}>🎉 YOU&apos;RE FIRST!</div>;
    btnStyle = { ...btnStyle, ...styles.buzzBtnFirst };
  } else if (buzzed && myPosition > 0) {
    statusEl = (
      <div style={styles.statusNotFirst}>
        ❌ {firstTeam ? firstTeam.name.toUpperCase() : 'ANOTHER TEAM'} WAS FIRST
      </div>
    );
    btnStyle = { ...btnStyle, ...styles.buzzBtnWaiting };
  } else if (buzzed) {
    statusEl = <p style={styles.statusWaiting}>⏳ WAITING...</p>;
    btnStyle = { ...btnStyle, ...styles.buzzBtnWaiting };
  } else if (buzzersActive) {
    statusEl = (
      <p style={{ color: '#4caf50', fontSize: '18px', textAlign: 'center' }}>
        🔔 BUZZERS ACTIVE — TAP NOW!
      </p>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.teamName}>{team.name}</h1>
        <div style={styles.score}>
          Score:{' '}
          <span style={{ color: team.score < 0 ? '#ff6b6b' : '#FFD700' }}>
            {team.score < 0 ? `-$${Math.abs(team.score)}` : `$${team.score}`}
          </span>
        </div>
      </div>

      <div style={styles.center}>
        <button style={btnStyle} onClick={handleBuzz} disabled={btnDisabled}>
          {buzzed ? (amFirst ? '🎉 FIRST!' : '⏳') : 'BUZZ'}
        </button>
      </div>

      <div style={styles.statusArea}>
        {statusEl}
        {myPosition >= 0 && (
          <p style={{ color: '#aaa', textAlign: 'center', fontSize: '16px' }}>
            Position in queue: #{myPosition + 1}
          </p>
        )}
      </div>
    </div>
  );
}

const styles = {
  passwordPage: {
    minHeight: '100vh',
    background: '#060ce9',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    padding: '30px',
  },
  passwordTitle: {
    color: '#FFD700',
    fontSize: '48px',
    fontFamily: '"Arial Black", Arial, sans-serif',
    letterSpacing: '2px',
    textShadow: '2px 2px 4px #000',
    textAlign: 'center',
  },
  passwordSubtitle: {
    color: 'white',
    fontSize: '20px',
    fontFamily: 'Arial, sans-serif',
    textAlign: 'center',
  },
  passwordForm: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    width: '100%',
    maxWidth: '340px',
  },
  passwordInput: {
    width: '100%',
    padding: '16px 20px',
    fontSize: '24px',
    borderRadius: '10px',
    border: '3px solid #FFD700',
    background: '#1a1a4a',
    color: 'white',
    textAlign: 'center',
    fontFamily: 'Arial, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
  },
  passwordError: {
    color: '#ff6b6b',
    fontSize: '20px',
    fontFamily: '"Arial Black", Arial, sans-serif',
    textAlign: 'center',
  },
  passwordBtn: {
    width: '100%',
    padding: '18px',
    fontSize: '28px',
    fontFamily: '"Arial Black", Arial, sans-serif',
    fontWeight: 'bold',
    background: '#FFD700',
    color: '#060ce9',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    letterSpacing: '2px',
  },
  loading: {
    minHeight: '100vh',
    background: '#060ce9',
    color: '#FFD700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    fontFamily: '"Arial Black", Arial, sans-serif',
  },
  error: {
    minHeight: '100vh',
    background: '#111',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '30px',
  },
  errorTitle: {
    color: '#f44336',
    fontSize: '36px',
    fontFamily: '"Arial Black", Arial, sans-serif',
    textAlign: 'center',
  },
  errorText: {
    color: '#aaa',
    fontSize: '18px',
    fontFamily: 'Arial, sans-serif',
    textAlign: 'center',
  },
  page: {
    minHeight: '100vh',
    background: '#060ce9',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    gap: '20px',
  },
  header: { textAlign: 'center' },
  teamName: {
    color: '#FFD700',
    fontSize: '42px',
    fontFamily: '"Arial Black", Arial, sans-serif',
    letterSpacing: '2px',
    textShadow: '2px 2px 4px #000',
  },
  score: {
    color: 'white',
    fontSize: '24px',
    fontFamily: 'Arial, sans-serif',
    marginTop: '8px',
  },
  center: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  buzzBtn: {
    width: 'min(70vw, 300px)',
    height: 'min(70vw, 300px)',
    borderRadius: '50%',
    background: '#e53935',
    color: 'white',
    border: '6px solid #b71c1c',
    fontSize: 'clamp(36px, 10vw, 72px)',
    fontFamily: '"Arial Black", Arial, sans-serif',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 -4px 12px rgba(0,0,0,0.3)',
    transition: 'transform 0.1s, box-shadow 0.1s',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    letterSpacing: '2px',
    textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
  },
  buzzBtnDisabled: {
    background: '#333',
    border: '6px solid #555',
    color: '#666',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  buzzBtnWaiting: {
    background: '#444',
    border: '6px solid #666',
    color: '#aaa',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  buzzBtnFirst: {
    background: '#FFD700',
    border: '6px solid #FFA000',
    color: '#000',
    boxShadow: '0 8px 32px rgba(255,215,0,0.6)',
  },
  statusArea: {
    minHeight: '80px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  statusFirst: {
    color: '#FFD700',
    fontSize: '36px',
    fontFamily: '"Arial Black", Arial, sans-serif',
    textAlign: 'center',
    letterSpacing: '2px',
    textShadow: '2px 2px 4px #000',
    animation: 'pulse 1s infinite',
  },
  statusNotFirst: {
    color: '#f44336',
    fontSize: '22px',
    fontFamily: '"Arial Black", Arial, sans-serif',
    textAlign: 'center',
    letterSpacing: '1px',
  },
  statusWaiting: {
    color: '#aaa',
    fontSize: '22px',
    fontFamily: '"Arial Black", Arial, sans-serif',
    textAlign: 'center',
  },
};
