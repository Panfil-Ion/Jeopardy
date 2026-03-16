export default function QuestionModal({
  question,
  answerRevealed,
  isControl = false,
  onClose,
  timerSeconds = null, // NEW
  timerActive = false, // NEW
}) {
  if (!question) return null;

  const showTimer = !question.isPracticalTask && timerSeconds !== null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* NEW: timer strip pinned to top edge of modal */}
        {showTimer && (
          <div style={styles.timerStrip}>
            <div style={styles.timerText}>
              ⏱ {timerSeconds}s {timerActive ? '' : '(paused)'}
            </div>
            <div style={styles.timerBarBg}>
              <div
                style={{
                  ...styles.timerBarFill,
                  width: `${Math.max(0, Math.min(100, (timerSeconds / 15) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}

        <div style={styles.header}>
          <span style={styles.category}>{question.category}</span>
          <span style={styles.points}>${question.points}</span>
          {question.isPracticalTask && <span style={styles.practicalBadge}>🔧 PRACTICAL TASK</span>}
        </div>

        <div style={styles.questionText}>{question.question}</div>

        {!question.isPracticalTask && (answerRevealed || isControl) && (
          <div style={styles.answerSection}>
            <div style={styles.answerLabel}>ANSWER:</div>
            <div style={styles.answerText}>{question.answer}</div>
          </div>
        )}

        {onClose && (
          <button onClick={onClose} style={styles.closeBtn}>
            ✕ Close
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modal: {
    position: 'relative',
    background: '#060ce9',
    border: '4px solid #FFD700',
    borderRadius: '12px',
    padding: '40px',
    maxWidth: '900px',
    width: '100%',
    textAlign: 'center',
    fontFamily: '"Arial Black", Arial, sans-serif',
    overflow: 'hidden',
  },

  // NEW timer styles
  timerStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    background: '#0d0d3a',
    borderBottom: '2px solid #FFD700',
    padding: '10px 16px',
  },
  timerText: {
    color: '#FFD700',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: '8px',
    fontSize: '18px',
  },
  timerBarBg: {
    width: '100%',
    height: '12px',
    background: '#1a1a4a',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  timerBarFill: {
    height: '100%',
    background: '#4caf50',
    borderRadius: '8px',
    transition: 'width 1s linear',
  },

  header: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '30px',
    flexWrap: 'wrap',
    marginTop: '20px', // gives space under timer strip
  },
  category: {
    color: '#FFD700',
    fontSize: 'clamp(18px, 3vw, 32px)',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '2px',
  },
  points: {
    color: '#FFD700',
    fontSize: 'clamp(24px, 4vw, 48px)',
    fontWeight: 'bold',
  },
  practicalBadge: {
    background: '#b85c00',
    color: '#FFD700',
    padding: '4px 14px',
    borderRadius: '20px',
    fontSize: 'clamp(12px, 2vw, 18px)',
    fontWeight: 'bold',
  },
  questionText: {
    color: 'white',
    fontSize: 'clamp(20px, 3.5vw, 52px)',
    lineHeight: 1.4,
    marginBottom: '30px',
    fontFamily: '"Arial Black", Arial, sans-serif',
  },
  answerSection: {
    background: '#0a0a2a',
    border: '2px solid #4caf50',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
  },
  answerLabel: {
    color: '#4caf50',
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '10px',
    letterSpacing: '2px',
  },
  answerText: {
    color: 'white',
    fontSize: 'clamp(16px, 2.5vw, 30px)',
    lineHeight: 1.4,
  },
  closeBtn: {
    background: '#555',
    color: 'white',
    border: 'none',
    padding: '10px 24px',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
    fontFamily: '"Arial Black", Arial, sans-serif',
  },
};
