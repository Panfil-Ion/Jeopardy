import { useState, useEffect } from 'react';
import socket from '../socket.js';
import AdminPasswordGate from '../components/AdminPasswordGate.jsx';

export default function Editor() {
  const [authorized, setAuthorized] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Password check replaced by AdminPasswordGate component

  // Load questions from game state
  useEffect(() => {
    if (!authorized) return;

    function onGameState(state) {
      setQuestions((state.questions || []).map(q => ({ ...q })));
    }

    socket.on('game_state', onGameState);
    socket.emit('request_state');

    return () => {
      socket.off('game_state', onGameState);
    };
  }, [authorized]);

  if (!authorized) {
    return <AdminPasswordGate onAuthorized={(pass) => { setAuthorized(true); setAdminPass(pass || sessionStorage.getItem('admin_password') || ''); }} />;
  }

  function updateQuestion(index, field, value) {
    setQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function addQuestion() {
    const newId = `q_${Date.now()}`;
    setQuestions(prev => [...prev, {
      id: newId,
      category: '',
      points: 100,
      question: '',
      answer: '',
      isPracticalTask: false,
      used: false,
    }]);
  }

  function deleteQuestion(index) {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/update-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions, pass: adminPass }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveMsg('✅ Saved successfully!');
      } else {
        setSaveMsg('❌ Save failed.');
      }
    } catch {
      setSaveMsg('❌ Connection error.');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  }

  function handleReset() {
    if (window.confirm('Reset the entire game to defaults? This cannot be undone.')) {
      socket.emit('reset_game');
      setSaveMsg('✅ Game reset to defaults.');
      setTimeout(() => setSaveMsg(''), 3000);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>🛠️ JEOPARDY EDITOR</h1>
        <div style={styles.headerActions}>
          {saveMsg && <span style={styles.saveMsg}>{saveMsg}</span>}
          <button style={{ ...styles.btn, background: '#1a5c1a' }} onClick={handleSave} disabled={saving}>
            {saving ? '💾 Saving...' : '💾 Save All'}
          </button>
          <button style={{ ...styles.btn, background: '#3a0000', color: '#ff6b6b' }} onClick={handleReset}>
            🔄 Reset to Defaults
          </button>
          <button style={{ ...styles.btn, background: '#060ce9' }} onClick={addQuestion}>
            ➕ Add Question
          </button>
        </div>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>Category</th>
              <th style={styles.th}>Points</th>
              <th style={styles.th}>Question</th>
              <th style={styles.th}>Answer</th>
              <th style={styles.th}>Practical</th>
              <th style={styles.th}>Used</th>
              <th style={styles.th}>Delete</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q, i) => (
              <tr key={q.id} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                <td style={styles.td}>
                  <span style={styles.idText}>{q.id}</span>
                </td>
                <td style={styles.td}>
                  <input
                    style={styles.input}
                    value={q.category}
                    onChange={e => updateQuestion(i, 'category', e.target.value)}
                    placeholder="Category"
                  />
                </td>
                <td style={styles.td}>
                  <select
                    style={styles.select}
                    value={q.points}
                    onChange={e => updateQuestion(i, 'points', Number(e.target.value))}
                  >
                    {[100, 200, 300, 400, 500].map(p => (
                      <option key={p} value={p}>${p}</option>
                    ))}
                  </select>
                </td>
                <td style={styles.td}>
                  <textarea
                    style={{ ...styles.textarea, width: '260px' }}
                    value={q.question}
                    onChange={e => updateQuestion(i, 'question', e.target.value)}
                    placeholder="Question text"
                    rows={3}
                  />
                </td>
                <td style={styles.td}>
                  {q.isPracticalTask ? (
                    <span style={styles.noAnswer}>— no answer —</span>
                  ) : (
                    <textarea
                      style={{ ...styles.textarea, width: '220px' }}
                      value={q.answer}
                      onChange={e => updateQuestion(i, 'answer', e.target.value)}
                      placeholder="Answer text"
                      rows={3}
                    />
                  )}
                </td>
                <td style={{ ...styles.td, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={q.isPracticalTask}
                    onChange={e => updateQuestion(i, 'isPracticalTask', e.target.checked)}
                    style={styles.checkbox}
                  />
                </td>
                <td style={{ ...styles.td, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={q.used}
                    onChange={e => updateQuestion(i, 'used', e.target.checked)}
                    style={styles.checkbox}
                  />
                </td>
                <td style={{ ...styles.td, textAlign: 'center' }}>
                  <button
                    style={styles.deleteBtn}
                    onClick={() => deleteQuestion(i)}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#111',
    color: 'white',
    padding: '16px',
    fontFamily: '"Arial Black", Arial, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '20px',
    borderBottom: '2px solid #FFD700',
    paddingBottom: '12px',
  },
  title: {
    color: '#FFD700',
    fontSize: '28px',
    letterSpacing: '2px',
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  saveMsg: {
    color: '#4caf50',
    fontSize: '16px',
    fontFamily: 'Arial, sans-serif',
  },
  btn: {
    background: '#060ce9',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: '"Arial Black", Arial, sans-serif',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    background: '#060ce9',
    color: '#FFD700',
    padding: '10px 12px',
    textAlign: 'left',
    letterSpacing: '1px',
    whiteSpace: 'nowrap',
    border: '1px solid #333',
  },
  td: {
    padding: '8px',
    verticalAlign: 'top',
    border: '1px solid #333',
  },
  trEven: {
    background: '#1a1a2e',
  },
  trOdd: {
    background: '#0d0d1f',
  },
  idText: {
    color: '#888',
    fontSize: '11px',
    fontFamily: 'monospace',
  },
  input: {
    width: '140px',
    padding: '6px 8px',
    background: '#222',
    color: 'white',
    border: '1px solid #444',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'Arial, sans-serif',
  },
  select: {
    width: '80px',
    padding: '6px 4px',
    background: '#222',
    color: '#FFD700',
    border: '1px solid #444',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: '"Arial Black", Arial, sans-serif',
  },
  textarea: {
    padding: '6px 8px',
    background: '#222',
    color: 'white',
    border: '1px solid #444',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'Arial, sans-serif',
    resize: 'vertical',
    lineHeight: 1.4,
  },
  noAnswer: {
    color: '#666',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    fontStyle: 'italic',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: '#FFD700',
  },
  deleteBtn: {
    background: '#3a0000',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: '16px',
  },
};
