export default function Scoreboard({ teams, large = false }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);

  return (
    <div style={styles.container}>
      <h2 style={{ ...styles.title, fontSize: large ? '28px' : '18px' }}>🏆 SCOREBOARD</h2>
      <div style={styles.list}>
        {sorted.map((team, index) => (
          <div key={team.id} style={{ ...styles.row, background: index === 0 && team.score > 0 ? '#7a5a00' : '#1a1a4a' }}>
            <span style={{ ...styles.rank, fontSize: large ? '22px' : '14px' }}>
              {index === 0 && team.score > 0 ? '🥇' : `${index + 1}.`}
            </span>
            <span style={{ ...styles.name, fontSize: large ? '24px' : '16px' }}>{team.name}</span>
            <span style={{ ...styles.score, fontSize: large ? '28px' : '18px', color: team.score < 0 ? '#ff6b6b' : '#FFD700' }}>
              {team.score < 0 ? `-$${Math.abs(team.score)}` : `$${team.score}`}
            </span>
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
    textAlign: 'center',
    marginBottom: '10px',
    fontFamily: '"Arial Black", Arial, sans-serif',
    letterSpacing: '2px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #000080',
  },
  rank: {
    color: '#aaa',
    minWidth: '30px',
    fontWeight: 'bold',
  },
  name: {
    flex: 1,
    color: 'white',
    fontWeight: 'bold',
    fontFamily: '"Arial Black", Arial, sans-serif',
  },
  score: {
    fontWeight: 'bold',
    fontFamily: '"Arial Black", Arial, sans-serif',
    minWidth: '70px',
    textAlign: 'right',
  },
};
