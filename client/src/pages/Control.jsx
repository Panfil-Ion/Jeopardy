import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import socket from '../socket.js';
import Board from '../components/Board.jsx';
import Scoreboard from '../components/Scoreboard.jsx';
import BuzzerQueue from '../components/BuzzerQueue.jsx';
import QuestionModal from '../components/QuestionModal.jsx';

const CONTROL_PASSWORD = import.meta.env.VITE_CONTROL_PASSWORD;

export default function Control() {
  const [searchParams] = useSearchParams();
  const pass = searchParams.get('pass');
  const [authorized, setAuthorized] = useState(null); // null = checking
  const [gameState, setGameState] = useState(null);
  const [deductPoints, setDeductPoints] = useState(false);
  const [adjustAmounts, setAdjustAmounts] = useState({});

  // Password check
  useEffect(() => {
    fetch(`/api/check-password?pass=${encodeURIComponent(pass || '')}`)
      .then(r => r.json())
      .then(data => setAuthorized(data.ok))
      .catch(() => setAuthorized(false));
  }, [pass]);

  // Always set up socket listeners (independent of auth state)
  useEffect(() => {
    function onGameState(state) {
      setGameState(state);
    }
    function onBuzzerUpdate(queue) {
      setGameState(prev => prev ? { ...prev, buzzerQueue: queue } : prev);
    }
    function onScoreUpdate(teams) {
      setGameState(prev => prev ? { ...prev, teams } : prev);
    }
    function onQuestionOpen(question) {
      setGameState(prev => prev ? { ...prev, currentQuestion: question, answerRevealed: false } : prev);
    }
    function onQuestionClose() {
      setGameState(prev => prev ? { ...prev, currentQuestion: null, answerRevealed: false, timerActive: false } : prev);
    }
    function onAnswerRevealed() {
      setGameState(prev => prev ? { ...prev, answerRevealed: true } : prev);
    }
    function onBuzzerActivated() {
      setGameState(prev => prev ? { ...prev, buzzersActive: true } : prev);
    }
    function onBuzzerDeactivated() {
      setGameState(prev => prev ? { ...prev, buzzersActive: false } : prev);
    }
    function onTimerStart({ seconds }) {
      setGameState(prev => prev ? { ...prev, timerActive: true, timerSeconds: seconds } : prev);
    }
    function onTimerStop() {
      setGameState(prev => prev ? { ...prev, timerActive: false } : prev);
    }

    socket.on('game_state', onGameState);
    socket.on('buzzer_update', onBuzzerUpdate);
    socket.on('score_update', onScoreUpdate);
    socket.on('question_open', onQuestionOpen);
    socket.on('question_close', onQuestionClose);
    socket.on('answer_revealed', onAnswerRevealed);
    socket.on('buzzer_activated', onBuzzerActivated);
    socket.on('buzzer_deactivated', onBuzzerDeactivated);
    socket.on('timer_start', onTimerStart);
    socket.on('timer_stop', onTimerStop);

    // Request current state in case we missed the initial event
    socket.emit('request_state');

    return () => {
      socket.off('game_state', onGameState);
      socket.off('buzzer_update', onBuzzerUpdate);
      socket.off('score_update', onScoreUpdate);
      socket.off('question_open', onQuestionOpen);
      socket.off('question_close', onQuestionClose);
      socket.off('answer_revealed', onAnswerRevealed);
      socket.off('buzzer_activated', onBuzzerActivated);
      socket.off('buzzer_deactivated', onBuzzerDeactivated);
      socket.off('timer_start', onTimerStart);
      socket.off('timer_stop', onTimerStop);
    };
  }, []);

  if (authorized === null) {
    return <div style={styles.loading}>Checking access...</div>;
  }

  if (!authorized) {
    return (
      <div style={styles.denied}>
        <h1 style={styles.deniedTitle}>🔒 Access Denied</h1>
        <p style={styles.deniedText}>Invalid or missing password.</p>
        <p style={styles.deniedText}>Use <code style={styles.code}>/control?pass=YOUR_PASSWORD</code></p>
      </div>
    );
  }

  if (!gameState) {
    return <div style={styles.loading}>Connecting to server...</div>;
  }

  const { currentQuestion, buzzersActive, buzzerQueue, teams, questions, answerRevealed, timerActive } = gameState;
  const firstInQueue = buzzerQueue[0];

  function handleSelectQuestion(questionId) {
    socket.emit('select_question', { questionId });
  }

  function handleJudge(correct) {
    if (!firstInQueue) return;
    socket.emit('judge_answer', { correct, teamId: firstInQueue.teamId, deductPoints: !correct && deductPoints });
  }

  function handleAdjustScore(teamId, delta) {
    socket.emit('adjust_score', { teamId, delta });
  }

  function getAdjustAmount(teamId) {
    return parseInt(adjustAmounts[teamId] || 100, 10) || 100;
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>🎮 GAME MASTER CONTROL</h1>

      <div style={styles.layout}>
        {/* Left: Board */}
        <div style={styles.leftCol}>
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📋 Question Board</h2>
            <Board questions={questions} onSelectQuestion={handleSelectQuestion} isControl={true} />
          </div>
        </div>

        {/* Right: Controls */}
        <div style={styles.rightCol}>

          {/* Current Question Panel */}
          {currentQuestion ? (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>
                {currentQuestion.isPracticalTask
                  ? '🔧 PRACTICAL TASK'
                  : '❓ Current Question'}
                <span style={{ ...styles.pointsBadge, background: currentQuestion.isPracticalTask ? '#b85c00' : '#060ce9' }}>
                  ${currentQuestion.points}
                </span>
              </h2>
              <div style={styles.questionBox}>
                <div style={styles.questionCat}>{currentQuestion.category}</div>
                <div style={styles.questionText}>{currentQuestion.question}</div>
                <div style={styles.answerBox}>
                  <strong style={{ color: '#4caf50' }}>✅ ANSWER:</strong>
                  <div style={styles.answerText}>{currentQuestion.answer}</div>
                </div>
              </div>

              {/* Judge buttons */}
              {firstInQueue && (
                <div style={styles.judgeSection}>
                  <div style={styles.activeTeam}>
                    Answering: <strong style={{ color: '#FFD700' }}>
                      {teams.find(t => t.id === firstInQueue.teamId)?.name}
                    </strong>
                  </div>
                  <div style={styles.judgeRow}>
                    <button style={styles.correctBtn} onClick={() => handleJudge(true)}>
                      ✅ Correct (+${currentQuestion.points})
                    </button>
                    <button style={styles.wrongBtn} onClick={() => handleJudge(false)}>
                      ❌ Wrong {deductPoints ? `(-$${currentQuestion.points})` : ''}
                    </button>
                  </div>
                  <label style={styles.deductLabel}>
                    <input
                      type="checkbox"
                      checked={deductPoints}
                      onChange={e => setDeductPoints(e.target.checked)}
                    />
                    {' '}Deduct points on wrong answer
                  </label>
                </div>
              )}

              {/* Timer controls */}
              <div style={styles.controlRow}>
                <button style={styles.btn} onClick={() => socket.emit('start_timer', { seconds: 15 })}>
                  ▶️ Start Timer (15s)
                </button>
                <button style={{ ...styles.btn, background: '#555' }} onClick={() => socket.emit('stop_timer')}>
                  ⏹ Stop Timer
                </button>
              </div>

              {/* Buzzer controls */}
              <div style={styles.controlRow}>
                <button
                  style={{ ...styles.btn, background: buzzersActive ? '#555' : '#1a5c1a' }}
                  onClick={() => socket.emit('activate_buzzers')}
                  disabled={buzzersActive}
                >
                  🔔 Activate Buzzers
                </button>
                <button style={{ ...styles.btn, background: '#7a1a1a' }} onClick={() => socket.emit('reset_buzzers')}>
                  🔇 Reset Buzzers
                </button>
              </div>

              {/* Reveal & Next */}
              <div style={styles.controlRow}>
                {!answerRevealed && (
                  <button style={{ ...styles.btn, background: '#1a3a7a' }} onClick={() => socket.emit('reveal_answer')}>
                    👁 Reveal Answer
                  </button>
                )}
                {buzzerQueue.length > 1 && (
                  <button style={{ ...styles.btn, background: '#5a3a00' }} onClick={() => socket.emit('next_team')}>
                    ➡️ Next Team
                  </button>
                )}
                <button style={{ ...styles.btn, background: '#555' }} onClick={() => socket.emit('close_question')}>
                  ✕ Close Question
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>❓ No Active Question</h2>
              <p style={{ color: '#aaa' }}>Click a question on the board to open it.</p>
            </div>
          )}

          {/* Buzzer Queue */}
          <div style={styles.section}>
            <BuzzerQueue queue={buzzerQueue} teams={teams} />
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
              <button style={{ ...styles.btn, flex: 1, background: buzzersActive ? '#555' : '#1a5c1a' }}
                onClick={() => socket.emit('activate_buzzers')}>
                🔔 Activate Buzzers
              </button>
              <button style={{ ...styles.btn, flex: 1, background: '#7a1a1a' }}
                onClick={() => socket.emit('reset_buzzers')}>
                🔇 Reset Buzzers
              </button>
            </div>
          </div>

          {/* Scoreboard + Manual Adjust */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🏆 Scores & Adjustments</h2>
            <div style={styles.scoreList}>
              {[...teams].sort((a, b) => b.score - a.score).map(team => (
                <div key={team.id} style={styles.scoreRow}>
                  <span style={styles.scoreTeamName}>{team.name}</span>
                  <span style={{ ...styles.scoreValue, color: team.score < 0 ? '#ff6b6b' : '#FFD700' }}>
                    {team.score < 0 ? `-$${Math.abs(team.score)}` : `$${team.score}`}
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={adjustAmounts[team.id] || 100}
                    onChange={e => setAdjustAmounts(prev => ({ ...prev, [team.id]: e.target.value }))}
                    style={styles.adjustInput}
                  />
                  <button style={{ ...styles.smallBtn, background: '#1a5c1a' }}
                    onClick={() => handleAdjustScore(team.id, getAdjustAmount(team.id))}>
                    +
                  </button>
                  <button style={{ ...styles.smallBtn, background: '#7a1a1a' }}
                    onClick={() => handleAdjustScore(team.id, -getAdjustAmount(team.id))}>
                    −
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Reset game */}
          <div style={styles.section}>
            <button
              style={{ ...styles.btn, background: '#3a0000', width: '100%', color: '#ff6b6b' }}
              onClick={() => {
                if (window.confirm('Reset the entire game? This cannot be undone.')) {
                  socket.emit('reset_game');
                }
              }}
            >
              🔄 Reset Entire Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  loading: {
    minHeight: '100vh',
    background: '#111',
    color: '#FFD700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontFamily: '"Arial Black", Arial, sans-serif',
  },
  denied: {
    minHeight: '100vh',
    background: '#111',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '40px',
  },
  deniedTitle: {
    color: '#f44336',
    fontSize: '48px',
    fontFamily: '"Arial Black", Arial, sans-serif',
  },
  deniedText: {
    color: '#aaa',
    fontSize: '18px',
    fontFamily: 'Arial, sans-serif',
  },
  code: {
    background: '#222',
    padding: '2px 8px',
    borderRadius: '4px',
    color: '#FFD700',
    fontFamily: 'monospace',
  },
  page: {
    minHeight: '100vh',
    background: '#111',
    color: 'white',
    padding: '12px',
    fontFamily: '"Arial Black", Arial, sans-serif',
  },
  title: {
    color: '#FFD700',
    fontSize: '28px',
    marginBottom: '16px',
    letterSpacing: '2px',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 420px',
    gap: '16px',
    alignItems: 'start',
  },
  leftCol: {},
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  section: {
    background: '#1a1a2e',
    border: '2px solid #000080',
    borderRadius: '8px',
    padding: '14px',
  },
  sectionTitle: {
    color: '#FFD700',
    fontSize: '16px',
    marginBottom: '10px',
    letterSpacing: '1px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  pointsBadge: {
    color: '#FFD700',
    border: '1px solid #FFD700',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '14px',
    marginLeft: 'auto',
  },
  questionBox: {
    background: '#060c30',
    borderRadius: '6px',
    padding: '12px',
    marginBottom: '12px',
  },
  questionCat: {
    color: '#FFD700',
    fontSize: '12px',
    letterSpacing: '2px',
    marginBottom: '6px',
    textTransform: 'uppercase',
  },
  questionText: {
    color: 'white',
    fontSize: '15px',
    lineHeight: 1.5,
    marginBottom: '10px',
  },
  answerBox: {
    background: '#0a2a0a',
    borderRadius: '4px',
    padding: '8px',
    border: '1px solid #4caf50',
  },
  answerText: {
    color: 'white',
    marginTop: '4px',
    fontSize: '14px',
    lineHeight: 1.5,
  },
  judgeSection: {
    marginBottom: '10px',
  },
  activeTeam: {
    color: 'white',
    marginBottom: '8px',
    fontSize: '14px',
  },
  judgeRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '6px',
  },
  correctBtn: {
    flex: 1,
    background: '#1a5c1a',
    color: 'white',
    border: 'none',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: '"Arial Black", Arial, sans-serif',
    fontWeight: 'bold',
  },
  wrongBtn: {
    flex: 1,
    background: '#7a1a1a',
    color: 'white',
    border: 'none',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: '"Arial Black", Arial, sans-serif',
    fontWeight: 'bold',
  },
  deductLabel: {
    color: '#aaa',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
  },
  controlRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
    flexWrap: 'wrap',
  },
  btn: {
    background: '#060ce9',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: '"Arial Black", Arial, sans-serif',
    fontWeight: 'bold',
    flex: 1,
    minWidth: '120px',
  },
  scoreList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  scoreRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px',
    background: '#0d0d3a',
    borderRadius: '4px',
  },
  scoreTeamName: {
    flex: 1,
    color: 'white',
    fontSize: '13px',
  },
  scoreValue: {
    fontWeight: 'bold',
    fontSize: '14px',
    minWidth: '60px',
    textAlign: 'right',
    fontFamily: '"Arial Black", Arial, sans-serif',
  },
  adjustInput: {
    width: '70px',
    padding: '4px',
    borderRadius: '4px',
    border: '1px solid #444',
    background: '#222',
    color: 'white',
    fontSize: '13px',
    textAlign: 'center',
  },
  smallBtn: {
    background: '#555',
    color: 'white',
    border: 'none',
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '18px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '"Arial Black", Arial, sans-serif',
  },
};
