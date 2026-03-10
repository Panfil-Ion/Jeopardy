const express = require('express');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const { loadState, saveState, resetState } = require('./gameState');
const { addBuzz, resetQueue, nextTeam } = require('./buzzerManager');
const { adjustScore, addPoints, subtractPoints } = require('./scoreManager');

const PORT = process.env.PORT || 3001;
const CONTROL_PASSWORD = process.env.CONTROL_PASSWORD || '1234';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// Load or initialize game state
let state = loadState();

// Serve React build in production
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Simple in-memory rate limiter for the password endpoint
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20; // max 20 attempts per minute per IP

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

// Password check endpoint (rate limited)
app.get('/api/check-password', rateLimitMiddleware, (req, res) => {
  const { pass } = req.query;
  if (pass === CONTROL_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(403).json({ ok: false });
  }
});

// Check at startup whether the SPA index.html exists and cache its contents
const spaIndexFile = path.join(publicDir, 'index.html');
const spaIndexContent = fs.existsSync(spaIndexFile) ? fs.readFileSync(spaIndexFile, 'utf8') : null;

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  if (spaIndexContent) {
    res.setHeader('Content-Type', 'text/html');
    res.send(spaIndexContent);
  } else {
    res.status(404).send('Client not built. Run: npm run build');
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current state to newly connected client
  socket.emit('game_state', state);

  // Client can re-request state at any time
  socket.on('request_state', () => {
    socket.emit('game_state', state);
  });

  // GM selects a question
  socket.on('select_question', ({ questionId }) => {
    const question = state.questions.find(q => q.id === questionId);
    if (!question || question.used) return;

    state.currentQuestion = question;
    state.answerRevealed = false;
    state.buzzersActive = false;
    state.buzzerQueue = resetQueue();
    state.timerActive = false;
    saveState(state);

    io.emit('question_open', question);
    io.emit('buzzer_update', state.buzzerQueue);
    io.emit('game_state', state);
  });

  // GM closes question without judging
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

  // GM activates buzzers
  socket.on('activate_buzzers', () => {
    state.buzzersActive = true;
    state.buzzerQueue = resetQueue();
    saveState(state);

    io.emit('buzzer_activated');
    io.emit('buzzer_update', state.buzzerQueue);
    io.emit('game_state', state);
  });

  // GM resets buzzers
  socket.on('reset_buzzers', () => {
    state.buzzersActive = false;
    state.buzzerQueue = resetQueue();
    saveState(state);

    io.emit('buzzer_deactivated');
    io.emit('buzzer_update', state.buzzerQueue);
    io.emit('game_state', state);
  });

  // Team buzzes in
  socket.on('buzz', ({ teamId, timestamp }) => {
    if (!state.buzzersActive) return;

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

  // GM judges answer
  socket.on('judge_answer', ({ correct, teamId, deductPoints }) => {
    if (!state.currentQuestion) return;

    const points = state.currentQuestion.points;

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
      if (deductPoints) {
        state.teams = subtractPoints(state.teams, teamId, points);
      }
      // Move to next team in queue
      state.buzzerQueue = nextTeam(state.buzzerQueue);
    }

    saveState(state);

    io.emit('answer_result', { correct, teamId });
    io.emit('score_update', state.teams);
    io.emit('buzzer_update', state.buzzerQueue);
    io.emit('game_state', state);

    if (correct) {
      io.emit('question_close');
    }
  });

  // GM adjusts score manually
  socket.on('adjust_score', ({ teamId, delta }) => {
    state.teams = adjustScore(state.teams, teamId, delta);
    saveState(state);

    io.emit('score_update', state.teams);
    io.emit('game_state', state);
  });

  // GM starts timer
  socket.on('start_timer', ({ seconds }) => {
    state.timerActive = true;
    state.timerSeconds = seconds || 15;
    saveState(state);

    io.emit('timer_start', { seconds: state.timerSeconds });
    io.emit('game_state', state);
  });

  // GM stops timer
  socket.on('stop_timer', () => {
    state.timerActive = false;
    saveState(state);

    io.emit('timer_stop');
    io.emit('game_state', state);
  });

  // GM reveals answer
  socket.on('reveal_answer', () => {
    state.answerRevealed = true;
    saveState(state);

    io.emit('answer_revealed');
    io.emit('game_state', state);
  });

  // GM moves to next team
  socket.on('next_team', () => {
    state.buzzerQueue = nextTeam(state.buzzerQueue);
    saveState(state);

    io.emit('buzzer_update', state.buzzerQueue);
    io.emit('game_state', state);
  });

  // GM resets the entire game
  socket.on('reset_game', () => {
    state = resetState();
    saveState(state);

    io.emit('game_state', state);
    io.emit('question_close');
    io.emit('buzzer_update', state.buzzerQueue);
    io.emit('score_update', state.teams);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Jeopardy server running on port ${PORT}`);
  console.log(`Control password: ${CONTROL_PASSWORD}`);
});
