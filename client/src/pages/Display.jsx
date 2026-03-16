import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import socket from '../socket.js';
import Board from '../components/Board.jsx';
import Scoreboard from '../components/Scoreboard.jsx';
import BuzzerQueue from '../components/BuzzerQueue.jsx';
import QuestionModal from '../components/QuestionModal.jsx';
import AdminPasswordGate from '../components/AdminPasswordGate.jsx';

// Audio setup
function createAudio(src) {
  const audio = new Audio(src);
  audio.preload = 'auto';
  return audio;
}

export default function Display() {
  const [authorized, setAuthorized] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [flashOverlay, setFlashOverlay] = useState(null);

  // TIMER: now purely server-driven (no local setInterval)
  const [timerSeconds, setTimerSeconds] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  const [timerTotalSeconds, setTimerTotalSeconds] = useState(15);

  const prevQueueLengthRef = useRef(0);
  const audios = useRef({});

  function unlockAudio() {
    audios.current.buzzer = createAudio('/sounds/buzzer.mp3');
    audios.current.correct = createAudio('/sounds/correct.mp3');
    audios.current.wrong = createAudio('/sounds/wrong.mp3');

    Object.values(audios.current).forEach(a => {
      a.volume = 0.01;
      a.play().catch(() => {});
      setTimeout(() => {
        a.pause();
        a.currentTime = 0;
        a.volume = 1;
      }, 100);
    });

    setAudioUnlocked(true);
  }

  function playSound(name) {
    const audio = audios.current[name];
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  useEffect(() => {
    function onGameState(state) {
      setGameState(state);
    }

    function onBuzzerUpdate(queue) {
      const prevLen = prevQueueLengthRef.current;
      if (audioUnlocked && queue.length > prevLen) {
        playSound('buzzer');
      }
      prevQueueLengthRef.current = queue.length;

      setGameState(prev => (prev ? { ...prev, buzzerQueue: queue } : prev));
    }

    function onScoreUpdate(teams) {
      setGameState(prev => (prev ? { ...prev, teams } : prev));
    }

    function onQuestionOpen(question) {
      setGameState(prev => (prev ? { ...prev, currentQuestion: question, answerRevealed: false } : prev));
      // Hide timer until server starts it
      setTimerActive(false);
      setTimerSeconds(null);
    }

    function onQuestionClose() {
      setGameState(prev => (prev ? { ...prev, currentQuestion: null, answerRevealed: false } : prev));
      setTimerActive(false);
      setTimerSeconds(null);
    }

    function onAnswerResult({ correct }) {
      if (audioUnlocked) playSound(correct ? 'correct' : 'wrong');
      if (correct) {
        confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 }, zIndex: 2000 });
        setFlashOverlay('correct');
      } else {
        setFlashOverlay('wrong');
      }
      setTimeout(() => setFlashOverlay(null), 1500);
    }

    function onAnswerRevealed() {
      setGameState(prev => (prev ? { ...prev, answerRevealed: true } : prev));
    }

    function onBuzzerActivated() {
      setGameState(prev => (prev ? { ...prev, buzzersActive: true } : prev));
    }

    function onBuzzerDeactivated() {
      setGameState(prev => (prev ? { ...prev, buzzersActive: false } : prev));
    }

    // SERVER-DRIVEN TIMER EVENTS
    function onTimerStart({ seconds }) {
      const s = Number(seconds) || 15;
      setTimerTotalSeconds(s);
      setTimerSeconds(s);
      setTimerActive(true);
    }

    function onTimerTick({ secondsLeft }) {
      setTimerSeconds(Number.isFinite(secondsLeft) ? secondsLeft : 0);
      setTimerActive(true);
    }

    function onTimerStop() {
      setTimerActive(false);
      setTimerSeconds(null);
    }

    socket.on('game_state', onGameState);
    socket.on('buzzer_update', onBuzzerUpdate);
    socket.on('score_update', onScoreUpdate);
    socket.on('question_open', onQuestionOpen);
    socket.on('question_close', onQuestionClose);
    socket.on('answer_result', onAnswerResult);
    socket.on('answer_revealed', onAnswerRevealed);
    socket.on('buzzer_activated', onBuzzerActivated);
    socket.on('buzzer_deactivated', onBuzzerDeactivated);

    socket.on('timer_start', onTimerStart);
    socket.on('timer_tick', onTimerTick);
    socket.on('timer_stop', onTimerStop);

    socket.emit('request_state');

    return () => {
      socket.off('game_state', onGameState);
      socket.off('buzzer_update', onBuzzerUpdate);
      socket.off('score_update', onScoreUpdate);
      socket.off('question_open', onQuestionOpen);
      socket.off('question_close', onQuestionClose);
      socket.off('answer_result', onAnswerResult);
      socket.off('answer_revealed', onAnswerRevealed);
      socket.off('buzzer_activated', onBuzzerActivated);
      socket.off('buzzer_deactivated', onBuzzerDeactivated);

      socket.off('timer_start', onTimerStart);
      socket.off('timer_tick', onTimerTick);
      socket.off('timer_stop', onTimerStop);
    };
  }, [audioUnlocked]);

  if (!authorized) {
    return <AdminPasswordGate onAuthorized={() => setAuthorized(true)} />;
  }

  if (!audioUnlocked) {
    return (
      <div style={styles.startScreen}>
        <h1 style={styles.startTitle}>🎮 JEOPARDY LIVE</h1>
        <p style={styles.startSubtitle}>Click to enable audio and start the game</p>
        <button style={styles.startBtn} onClick={unlockAudio}>
          🎮 Start Game
        </button>
      </div>
    );
  }

  if (!gameState) {
    return <div style={styles.loading}>Connecting to server...</div>;
  }

  const showQuestionTimer =
    !!gameState.currentQuestion &&
    !gameState.currentQuestion.isPracticalTask &&
    timerSeconds !== null;

  return (
    <div style={styles.page}>
      {flashOverlay && (
        <div
          style={{
            ...styles.flashOverlay,
            background: flashOverlay === 'correct' ? 'rgba(76, 175, 80, 0.5)' : 'rgba(244, 67, 54, 0.5)',
          }}
        />
      )}

      {gameState.currentQuestion && (
        <QuestionModal
          question={gameState.currentQuestion}
          answerRevealed={gameState.answerRevealed}
          isControl={false}
          timerSeconds={showQuestionTimer ? timerSeconds : null}
          timerTotalSeconds={timerTotalSeconds}
          timerActive={timerActive}
        />
      )}

      <div style={styles.layout}>
        <div style={styles.boardSection}>
          <h1 style={styles.title}>JEOPARDY</h1>
          <Board questions={gameState.questions} onSelectQuestion={null} isDisplay={true} hidesPractice={true} />
        </div>

        <div style={styles.sidePanel}>
          <BuzzerQueue queue={gameState.buzzerQueue} teams={gameState.teams} large />
          <div style={{ marginTop: '16px' }}>
            <Scoreboard teams={gameState.teams} large />
          </div>
          {gameState.buzzersActive && <div style={styles.buzzersActiveIndicator}>🔔 BUZZERS ACTIVE</div>}
        </div>
      </div>
    </div>
  );
}

const styles = {
  startScreen: {
    minHeight: '100vh',
    background: '#060ce9',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '30px',
  },
  startTitle: {
    color: '#FFD700',
    fontSize: '72px',
    fontFamily: '"Arial Black", Arial, sans-serif',
    textShadow: '4px 4px 8px #000',
    letterSpacing: '4px',
  },
  startSubtitle: {
    color: 'white',
    fontSize: '24px',
    fontFamily: 'Arial, sans-serif',
  },
  startBtn: {
    background: '#FFD700',
    color: '#060ce9',
    border: 'none',
    padding: '24px 64px',
    fontSize: '32px',
    fontFamily: '"Arial Black", Arial, sans-serif',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
    transition: 'transform 0.1s',
  },
  loading: {
    minHeight: '100vh',
    background: '#060ce9',
    color: '#FFD700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    fontFamily: '"Arial Black", Arial, sans-serif',
  },
  page: {
    minHeight: '100vh',
    background: '#060ce9',
    padding: '8px',
    position: 'relative',
    overflow: 'hidden',
  },
  flashOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 500,
    pointerEvents: 'none',
    transition: 'opacity 0.3s',
    animation: 'flash 1.5s ease-out forwards',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gap: '12px',
    width: '100%',
  },
  boardSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  title: {
    color: '#FFD700',
    textAlign: 'center',
    fontSize: 'clamp(32px, 5vw, 72px)',
    fontFamily: '"Arial Black", Arial, sans-serif',
    textShadow: '3px 3px 6px #000',
    letterSpacing: '6px',
    margin: '4px 0',
  },
  sidePanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  buzzersActiveIndicator: {
    background: '#1a5c1a',
    color: '#4caf50',
    border: '2px solid #4caf50',
    borderRadius: '8px',
    padding: '12px',
    textAlign: 'center',
    fontSize: '20px',
    fontWeight: 'bold',
    fontFamily: '"Arial Black", Arial, sans-serif',
    animation: 'pulse 1s infinite',
  },
};
