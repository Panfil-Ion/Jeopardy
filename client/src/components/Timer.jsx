import { useState, useEffect, useRef } from 'react';
import socket from '../socket.js';

export default function Timer({ large = false }) {
  const [seconds, setSeconds] = useState(null);
  const [active, setActive] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    function onTimerStart({ seconds: s }) {
      setSeconds(s);
      setActive(true);
    }

    function onTimerStop() {
      setActive(false);
      setSeconds(null);
      clearInterval(intervalRef.current);
    }

    function onQuestionClose() {
      setActive(false);
      setSeconds(null);
      clearInterval(intervalRef.current);
    }

    socket.on('timer_start', onTimerStart);
    socket.on('timer_stop', onTimerStop);
    socket.on('question_close', onQuestionClose);

    return () => {
      socket.off('timer_start', onTimerStart);
      socket.off('timer_stop', onTimerStop);
      socket.off('question_close', onQuestionClose);
    };
  }, []);

  useEffect(() => {
    if (active && seconds !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [active]);

  if (seconds === null && !active) return null;

  const total = 15;
  const pct = seconds !== null ? (seconds / total) * 100 : 0;
  const color = seconds > 8 ? '#4caf50' : seconds > 4 ? '#ff9800' : '#f44336';

  return (
    <div style={{ ...styles.container, padding: large ? '16px' : '10px' }}>
      <div style={{ ...styles.label, fontSize: large ? '22px' : '14px' }}>
        ⏱ {seconds}s
      </div>
      <div style={styles.barBg}>
        <div
          style={{
            ...styles.barFill,
            width: `${pct}%`,
            background: color,
            transition: 'width 1s linear, background 0.3s',
          }}
        />
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: '#0d0d3a',
    border: '2px solid #000080',
    borderRadius: '8px',
    width: '100%',
  },
  label: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontFamily: '"Arial Black", Arial, sans-serif',
    textAlign: 'center',
    marginBottom: '8px',
  },
  barBg: {
    width: '100%',
    height: '16px',
    background: '#1a1a4a',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '8px',
  },
};
