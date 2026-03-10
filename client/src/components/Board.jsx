export default function Board({ questions, onSelectQuestion, isControl = false }) {
  const categories = [...new Set(questions.map(q => q.category))];
  const pointValues = [100, 200, 300, 400, 500];

  return (
    <div style={styles.boardContainer}>
      <div style={styles.board}>
        {/* Category headers */}
        {categories.map(cat => (
          <div key={cat} style={styles.categoryHeader}>
            {cat.toUpperCase()}
          </div>
        ))}

        {/* Question cells */}
        {pointValues.map(points =>
          categories.map(cat => {
            const q = questions.find(q => q.category === cat && q.points === points);
            if (!q) return <div key={`${cat}_${points}`} style={styles.emptyCell} />;

            const isUsed = q.used;
            const isPractical = q.isPracticalTask;

            let cellStyle = { ...styles.cell };
            if (isUsed) {
              cellStyle = { ...cellStyle, ...styles.usedCell };
            } else if (isPractical) {
              cellStyle = { ...cellStyle, ...styles.practicalCell };
            }

            return (
              <div
                key={q.id}
                style={cellStyle}
                onClick={() => !isUsed && onSelectQuestion && onSelectQuestion(q.id)}
              >
                {isUsed ? (
                  <span style={styles.usedText}>—</span>
                ) : (
                  <>
                    <span style={styles.pointValue}>${points}</span>
                    {isPractical && (
                      <span style={styles.practicalBadge}>🔧 PRACTICE</span>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const styles = {
  boardContainer: {
    width: '100%',
    padding: '8px',
  },
  board: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '4px',
    width: '100%',
  },
  categoryHeader: {
    background: '#060ce9',
    color: 'white',
    textAlign: 'center',
    padding: '12px 4px',
    fontSize: 'clamp(12px, 2vw, 22px)',
    fontWeight: 'bold',
    border: '3px solid #000080',
    fontFamily: '"Arial Black", Arial, sans-serif',
    letterSpacing: '1px',
    minHeight: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cell: {
    background: '#060ce9',
    color: '#FFD700',
    textAlign: 'center',
    padding: '12px 4px',
    fontSize: 'clamp(18px, 3vw, 42px)',
    fontWeight: 'bold',
    border: '3px solid #000080',
    cursor: 'pointer',
    transition: 'background 0.15s',
    minHeight: '70px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '"Arial Black", Arial, sans-serif',
    userSelect: 'none',
  },
  usedCell: {
    background: '#1a1a4a',
    color: '#444',
    cursor: 'default',
    border: '3px solid #333',
  },
  practicalCell: {
    background: '#7a3a00',
    color: '#FFD700',
    border: '3px solid #b85c00',
  },
  pointValue: {
    display: 'block',
  },
  practicalBadge: {
    fontSize: 'clamp(8px, 1vw, 12px)',
    color: '#FFA500',
    fontWeight: 'normal',
    marginTop: '2px',
  },
  usedText: {
    color: '#444',
    fontSize: '24px',
  },
  emptyCell: {
    background: '#1a1a4a',
    border: '3px solid #333',
    minHeight: '70px',
  },
};
