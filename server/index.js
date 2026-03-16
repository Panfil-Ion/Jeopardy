const express = require('express');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const { loadState, saveState, resetState } = require('./gameState');
const { addBuzz, resetQueue, nextTeam } = require('./buzzerManager');
const { adjustScore, addPoints, subtractPoints } = require('./scoreManager');

const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1231';

const TEAM_PASSWORDS = {
  team1: process.env.TEAM1_PASSWORD || 'echipa1',
  team2: process.env.TEAM2_PASSWORD || 'echipa2',
  team3: process.env.TEAM3_PASSWORD || 'echipa3',
  team4: process.env.TEAM4_PASSWORD || 'echipa4',
  team5: process.env.TEAM5_PASSWORD || 'echipa5',
  team6: process.env.TEAM6_PASSWORD || 'echipa6',
  team7: process.env.TEAM7_PASSWORD || 'echipa7',
  team8: process.env.TEAM8_PASSWORD || 'echipa8',
  team9: process.env.TEAM9_PASSWORD || 'echipa9',
  team10: process.env.TEAM10_PASSWORD || 'echipa10',
};

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Load or initialize game state
let state = loadState();

// Serve React build in production
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// ===============================
// RATE LIMITER
// ===============================
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;

function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  entry.count += 1;
  rateLimitMap.set(ip, entry);

  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ ok: false, error: 'Too many requests' });
  }
  next();
}

// ===============================
// TEAM AUTH + OWNER LOCK
// ===============================
// One device owns a team at a time.
// Another device can only take over with force=true + correct password.
const teamOwner = new Map(); // teamId -> { deviceId, token, issuedAt }

function issueToken() {
  return crypto.randomBytes(24).toString('hex');
}

function setOwner(teamId, deviceId) {
  const token = issueToken();
  teamOwner.set(teamId, { deviceId, token, issuedAt: Date.now() });
  return token;
}

function getOwner(teamId) {
  return teamOwner.get(teamId) || null;
}

function validateTeamToken(teamId, deviceId, token) {
  const owner = teamOwner.get(teamId);
  if (!owner) return false;
  return owner.deviceId === deviceId && owner.token === token;
}

// ===============================
// ADMIN PASSWORD CHECK
// ===============================
app.get('/api/check-password', rateLimitMiddleware, (req, res) => {
  const { pass } = req.query;
  if (pass === ADMIN_PASSWORD) res.json({ ok: true });
  else res.status(403).json({ ok: false });
});

app.post('/api/check-password', rateLimitMiddleware, (req, res) => {
  const { pass } = req.body;
  if (pass === ADMIN_PASSWORD) res.json({ ok: true });
  else res.status(403).json({ ok: false });
});

// ===============================
// TEAM LOGIN (LOCKED)
// ===============================
app.post('/api/team-login', rateLimitMiddleware, (req, res) => {
  const { teamId, password, teamName, deviceId, force } = req.body;

  if (!deviceId) return res.status(400).json({ ok: false, error: 'Missing deviceId' });

  const expected = TEAM_PASSWORDS[teamId];
  if (!expected) return res.status(404).json({ ok: false, error: 'Team slot not found' });
  if (password !== expected) return res.status(403).json({ ok: false, error: 'Wrong password' });

  const existingOwner = getOwner(teamId);

  // If team is owned by another device and no force takeover -> deny
  if (existingOwner && existingOwner.deviceId !== deviceId && !force) {
    return res.status(409).json({
      ok: false,
      error: 'Team already in use on another device',
      code: 'TEAM_IN_USE',
    });
  }

  // Ensure team exists in state (auto-register if missing)
  if (!state.teams.find(t => t.id === teamId)) {
    const name = (teamName || '').trim() || teamId;
    state.teams.push({ id: teamId, name, score: 0 });
    saveState(state);
    io.emit('game_state', state);
  } else {
    const name = (teamName || '').trim();
    if (name) {
      state.teams = state.teams.map(t => (t.id === teamId ? { ...t, name } : t));
      saveState(state);
      io.emit('game_state', state);
    }
  }

  // Set/replace owner (also works for same device re-login)
  const token = setOwner(teamId, deviceId);

  // notify clients (optional)
  io.emit('team_owner_changed', { teamId });

  res.json({ ok: true, token });
});

// Optional: release team (nice to have)
app.post('/api/team-logout', rateLimitMiddleware, (req, res) => {
  const { teamId, deviceId, token } = req.body;
  const owner = getOwner(teamId);
  if (!owner) return res.json({ ok: true });

  if (owner.deviceId === deviceId && owner.token === token) {
    teamOwner.delete(teamId);
    io.emit('team_owner_changed', { teamId });
    return res.json({ ok: true });
  }

  return res.status(403).json({ ok: false, error: 'Unauthorized' });
});

// ===============================
// UPDATE QUESTIONS
// ===============================
app.post('/api/update-questions', express.json(), rateLimitMiddleware, (req, res) => {
  const { questions, pass } = req.body;
  if (pass !== ADMIN_PASSWORD) return res.status(403).json({ ok: false, error: 'Unauthorized' });
  if (!Array.isArray(questions)) return res.status(400).json({ ok: false });
  state.questions = questions;
  saveQuestionsToFile(questions);
  saveState(state);
  io.emit('game_state', state);
  res.json({ ok: true });
});

// ===============================
// SPA FALLBACK
// ===============================

const spaIndexFile = path.join(publicDir, 'index.html');
const spaIndexContent = fs.existsSync(spaIndexFile) ? fs.readFileSync(spaIndexFile, 'utf8') : null;

app.get('*', (req, res) => {
  if (spaIndexContent) {
    res.setHeader('Content-Type', 'text/html');
    res.send(spaIndexContent);
  } else {
    res.status(404).send('Client not built. Run: npm run build');
  }
});

// ===============================
// SOCKET.IO
// ===============================
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.emit('game_state', state);

  socket.on('request_state', () => {
    socket.emit('game_state', state);
  });

  // inside io.on('connection', ...) replace/select_question handler with this guard:
socket.on('select_question', ({ questionId }) => {
  // NEW: do not allow selecting another question while one is open
  if (state.currentQuestion) return;

  const question = state.questions.find(q => q.id === questionId);
  if (!question || question.used) return;

  state.currentQuestion = question;
  state.answerRevealed = false;

  if (question.isPracticalTask) {
    state.buzzersActive = false;
    state.buzzerQueue = [];

    // NEW: initialize practical pending teams (persisted)
    state.practicalPendingTeamIds = (state.teams || []).map(t => t.id);
  } else {
    state.buzzersActive = true;
    state.buzzerQueue = resetQueue();
  }

  state.timerActive = false;
  saveState(state);

  io.emit('question_open', question);

  if (!question.isPracticalTask) {
    io.emit('buzzer_activated');
    io.emit('buzzer_update', state.buzzerQueue);
  }
  io.emit('game_state', state);
});

  socket.on('close_question', () => {
    if (state.currentQuestion) {
      state.questions = state.questions.map(q =>
        q.id === state.currentQuestion.id ? { ...q, used: true } : q
      );
    }
    state.currentQuestion = null;
    state.answerRevealed = false;
    state.buzzersActive = false;
    state.buzzerQueue = resetQueue();
    state.timerActive = false;
    saveState(state);

    io.emit('question_close');
    io.emit('game_state', state);
  });

  socket.on('activate_buzzers', () => {
    state.buzzersActive = true;
    state.buzzerQueue = resetQueue();
    saveState(state);

    io.emit('buzzer_activated');
    io.emit('buzzer_update', state.buzzerQueue);
    io.emit('game_state', state);
  });

  socket.on('reset_buzzers', () => {
    state.buzzersActive = false;
    state.buzzerQueue = resetQueue();
    saveState(state);

    io.emit('buzzer_deactivated');
    io.emit('buzzer_update', state.buzzerQueue);
    io.emit('game_state', state);
  });

  // TOKEN + OWNER protected buzz
  socket.on('buzz', ({ teamId, deviceId, token, timestamp }) => {
    if (!state.buzzersActive) return;

    if (!validateTeamToken(teamId, deviceId, token)) {
      socket.emit('buzz_denied', { teamId, reason: 'unauthorized' });
      return;
    }

    const team = state.teams.find(t => t.id === teamId);
    if (!team) return;

    const prevLength = state.buzzerQueue.length;
    state.buzzerQueue = addBuzz(state.buzzerQueue, teamId);

    if (state.buzzerQueue.length > prevLength) {
      saveState(state);
      io.emit('buzzer_update', state.buzzerQueue);
      io.emit('game_state', state);
    }
  });

  socket.on('judge_answer', ({ correct, teamId }) => {
    if (!state.currentQuestion) return;

    const points = state.currentQuestion.points;
    const isPractical = state.currentQuestion.isPracticalTask;

    if (correct) {
      state.teams = addPoints(state.teams, teamId, points);
      state.questions = state.questions.map(q =>
        q.id === state.currentQuestion.id ? { ...q, used: true } : q
      );
      state.currentQuestion = null;
      state.buzzersActive = false;
      state.buzzerQueue = resetQueue();
      state.answerRevealed = false;
      state.timerActive = false;
    } else {
      if (!isPractical) state.teams = subtractPoints(state.teams, teamId, points);
      state.buzzerQueue = nextTeam(state.buzzerQueue);
    }

    saveState(state);

    io.emit('answer_result', { correct, teamId });
    io.emit('score_update', state.teams);
    io.emit('buzzer_update', state.buzzerQueue);
    io.emit('game_state', state);

    if (correct) io.emit('question_close');
  });

  socket.on('adjust_score', ({ teamId, delta }) => {
    state.teams = adjustScore(state.teams, teamId, delta);
    saveState(state);

    io.emit('score_update', state.teams);
    io.emit('game_state', state);
  });

  socket.on('start_timer', ({ seconds }) => {
    state.timerActive = true;
    state.timerSeconds = seconds || 15;
    saveState(state);

    io.emit('timer_start', { seconds: state.timerSeconds });
    io.emit('game_state', state);
  });

  socket.on('stop_timer', () => {
    state.timerActive = false;
    saveState(state);

    io.emit('timer_stop');
    io.emit('game_state', state);
  });

  socket.on('reveal_answer', () => {
    state.answerRevealed = true;
    saveState(state);

    io.emit('answer_revealed');
    io.emit('game_state', state);
  });

  socket.on('next_team', () => {
    state.buzzerQueue = nextTeam(state.buzzerQueue);
    saveState(state);

    io.emit('buzzer_update', state.buzzerQueue);
    io.emit('game_state', state);
  });

  socket.on('reset_game', () => {
    state = resetState();
    saveState(state);

    io.emit('game_state', state);
    io.emit('question_close');
    io.emit('buzzer_update', state.buzzerQueue);
    io.emit('score_update', state.teams);

    teamOwner.clear();
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Jeopardy server running on port ${PORT}`);
  console.log(`Admin password: ${ADMIN_PASSWORD}`);
});
