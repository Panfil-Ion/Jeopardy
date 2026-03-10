export default function BuzzerQueue({ queue, teams, large = false }) {
  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : teamId;
  };

  if (queue.length === 0) {
    return (
      <div style={styles.container}>
        <h3 style={{ ...styles.title, fontSize: large ? '24px' : '16px' }}>🔔 BUZZER QUEUE</h3>
        <p style={{ color: '#666', textAlign: 'center', padding: '10px', fontSize: large ? '18px' : '13px' }}>
          No buzzes yet
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h3 style={{ ...styles.title, fontSize: large ? '24px' : '16px' }}>🔔 BUZZER QUEUE</h3>
      <div style={styles.list}>
        {queue.map((entry, index) => (
          <div
            key={entry.teamId}
            style={{
              ...styles.entry,
              ...(index === 0 ? styles.firstEntry : {}),
              fontSize: large ? (index === 0 ? '28px' : '20px') : (index === 0 ? '18px' : '14px'),
            }}
          >
            <span style={styles.position}>{index + 1}.</span>
            <span style={styles.teamName}>{getTeamName(entry.teamId)}</span>
            {index === 0 && <span style={styles.firstBadge}>⭐ FIRST!</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: '#0d0d3a',
    border: '2px solid #000080',
    borderRadius: '8px',
    padding: '12px',
    width: '100%',
  },
  title: {
    color: '#FFD700',
    marginBottom: '10px',
    textAlign: 'center',
    fontFamily: '"Arial Black", Arial, sans-serif',
    letterSpacing: '2px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  entry: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    background: '#1a1a4a',
    borderRadius: '4px',
    border: '1px solid #000080',
    color: 'white',
    fontWeight: 'bold',
    fontFamily: '"Arial Black", Arial, sans-serif',
  },
  firstEntry: {
    background: '#7a5a00',
    border: '2px solid #FFD700',
    color: '#FFD700',
  },
  position: {
    minWidth: '28px',
    color: '#aaa',
  },
  teamName: {
    flex: 1,
  },
  firstBadge: {
    fontSize: '14px',
    color: '#FFD700',
  },
};
