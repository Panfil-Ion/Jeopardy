import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import socket from '../socket.js';

export default function Buzzer() {
  const [searchParams] = useSearchParams();
  const teamId = searchParams.get('team');

  const [gameState, setGameState] = useState(null);
  const [buzzerQueue, setBuzzerQueue] = useState([]);
  const [buzzed, setBuzzed] = useState(false);
  const wakeLockRef = useRef(null);

  // Wake Lock API
  useEffect(() => {
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          console.log('Wake lock acquired');
        }
      } catch (err) {
        console.warn('Wake lock failed:', err.message);
      }
    }

    requestWakeLock();

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    function onGameState(state) {
      setGameState(state);
      setBuzzerQueue(state.buzzerQueue || []);
      if (!state.buzzersActive) {
        setBuzzed(false);
      }
    }

    function onBuzzerUpdate(queue) {
      setBuzzerQueue(queue);
    }

    function onBuzzerActivated() {
      setBuzzed(false);
      setGameState(prev => prev ? { ...prev, buzzersActive: true } : prev);
    }

    function onBuzzerDeactivated() {
      setBuzzed(false);
      setBuzzerQueue([]);
      setGameState(prev => prev ? { ...prev, buzzersActive: false } : prev);
    }

    function onScoreUpdate(teams) {
      setGameState(prev => prev ? { ...prev, teams } : prev);
    }

    function onQuestionClose() {
      setBuzzed(false);
      setBuzzerQueue([]);
      setGameState(prev => prev ? { ...prev, buzzersActive: false, buzzerQueue: [] } : prev);
    }

    socket.on('game_state', onGameState);
    socket.on('buzzer_update', onBuzzerUpdate);
    socket.on('buzzer_activated', onBuzzerActivated);
    socket.on('buzzer_deactivated', onBuzzerDeactivated);
    socket.on('score_update', onScoreUpdate);
    socket.on('question_close', onQuestionClose);

    socket.emit('request_state');

    return () => {
      socket.off('game_state', onGameState);
      socket.off('buzzer_update', onBuzzerUpdate);
      socket.off('buzzer_activated', onBuzzerActivated);
      socket.off('buzzer_deactivated', onBuzzerDeactivated);
      socket.off('score_update', onScoreUpdate);
      socket.off('question_close', onQuestionClose);
    };
  }, []);

  if (!teamId) {
    return (
      <div style={styles.error}>
        <h1 style={styles.errorTitle}>❌ Missing Team ID</h1>
        <p style={styles.errorText}>Open this page as: <code>/buzzer?team=team1</code></p>
      </div>
    );
  }

  if (!gameState) {
    return <div style={styles.loading}>Connecting...</div>;
  }

  const team = gameState.teams.find(t => t.id === teamId);

  if (!team) {
    return (
      <div style={styles.error}>
        <h1 style={styles.errorTitle}>❌ Invalid Team ID</h1>
        <p style={styles.errorText}>Team <strong>"{teamId}"</strong> not found.</p>
        <p style={styles.errorText}>Valid IDs: team1, team2, team3, team4, team5, team6</p>
      </div>
    );
  }

  const buzzersActive = gameState.buzzersActive;
  const myPosition = buzzerQueue.findIndex(e => e.teamId === teamId);
  const amFirst = myPosition === 0;
  const firstTeam = buzzerQueue[0] ? gameState.teams.find(t => t.id === buzzerQueue[0].teamId) : null;

  function handleBuzz() {
    if (!buzzersActive || buzzed) return;
    socket.emit('buzz', { teamId, timestamp: Date.now() });
    setBuzzed(true);
  }

  // Determine button/status state
  let statusEl = null;
  let btnDisabled = !buzzersActive || buzzed;
  let btnStyle = { ...styles.buzzBtn };

  if (!buzzersActive && !buzzed) {
    btnStyle = { ...btnStyle, ...styles.buzzBtnDisabled };
    statusEl = <p style={styles.statusWaiting}>⏸ Waiting for buzzers to activate...</p>;
  } else if (buzzed && amFirst) {
    statusEl = <div style={styles.statusFirst}>🎉 YOU'RE FIRST!</div>;
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
    statusEl = <p style={{ color: '#4caf50', fontSize: '18px', textAlign: 'center' }}>🔔 BUZZERS ACTIVE — TAP NOW!</p>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.teamName}>{team.name}</h1>
        <div style={styles.score}>
          Score: <span style={{ color: team.score < 0 ? '#ff6b6b' : '#FFD700' }}>
            {team.score < 0 ? `-$${Math.abs(team.score)}` : `$${team.score}`}
          </span>
        </div>
      </div>

      <div style={styles.center}>
        <button
          style={btnStyle}
          onClick={handleBuzz}
          disabled={btnDisabled}
        >
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
  header: {
    textAlign: 'center',
  },
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
  center: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
