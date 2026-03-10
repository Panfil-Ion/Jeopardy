# 🎮 Jeopardy Live

A complete, production-ready live Jeopardy game web application for student events. Works in real-time across multiple devices simultaneously via browser.

## Tech Stack

- **Backend**: Node.js + Express + Socket.io
- **Frontend**: React (Vite)
- **Real-time**: WebSockets via Socket.io
- **State persistence**: `game_state.json` (auto-saved, resumes on restart)

## Project Structure

```
/
├── server/
│   ├── index.js          # Main server (Express + Socket.io)
│   ├── gameState.js      # Game state manager + persistence
│   ├── buzzerManager.js  # Buzzer queue logic
│   └── scoreManager.js   # Score management
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Display.jsx   # /display – projector view
│   │   │   ├── Control.jsx   # /control – GM panel
│   │   │   └── Buzzer.jsx    # /buzzer – team phones
│   │   └── components/       # Board, Scoreboard, Timer, etc.
│   └── public/sounds/        # Audio files (buzzer, correct, wrong)
├── package.json
└── README.md
```

## Local Development Setup

### 1. Install dependencies

```bash
npm install
cd client && npm install && cd ..
```

### 2. Start development servers

```bash
npm run dev
```

This runs both the backend (port 3001) and the Vite dev server concurrently.

### 3. Open the interfaces

| Interface | URL | Used by |
|---|---|---|
| Projector Display | http://localhost:5173/display | Mac on projector |
| Game Master Panel | http://localhost:5173/control?pass=1234 | Organizer's PC |
| Team 1 Buzzer | http://localhost:5173/buzzer?team=team1 | Team 1 phone |
| Team 2 Buzzer | http://localhost:5173/buzzer?team=team2 | Team 2 phone |
| Team 3 Buzzer | http://localhost:5173/buzzer?team=team3 | Team 3 phone |
| Team 4 Buzzer | http://localhost:5173/buzzer?team=team4 | Team 4 phone |
| Team 5 Buzzer | http://localhost:5173/buzzer?team=team5 | Team 5 phone |
| Team 6 Buzzer | http://localhost:5173/buzzer?team=team6 | Team 6 phone |
| Team 7 Buzzer | http://localhost:5173/buzzer?team=team7 | Team 7 phone |
| Team 8 Buzzer | http://localhost:5173/buzzer?team=team8 | Team 8 phone |
| Team 9 Buzzer | http://localhost:5173/buzzer?team=team9 | Team 9 phone |
| Team 10 Buzzer | http://localhost:5173/buzzer?team=team10 | Team 10 phone |

## Configuration

### Teams & Questions

Edit `server/gameState.js`:

- **Teams**: Modify `DEFAULT_TEAMS` array (id, name, score)
- **Questions**: Modify `DEFAULT_QUESTIONS` array. Each question has:
  ```js
  {
    id: "unique_id",
    category: "Category Name",
    points: 100,           // 100, 200, 300, 400, or 500
    question: "...",
    answer: "...",
    isPracticalTask: false, // true = shown in orange with 🔧 badge
    used: false
  }
  ```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `CONTROL_PASSWORD` | `1234` | Password for /control panel |
| `TEAM1_PASSWORD` | `echipa1` | Password for Team 1 buzzer |
| `TEAM2_PASSWORD` | `echipa2` | Password for Team 2 buzzer |
| `TEAM3_PASSWORD` | `echipa3` | Password for Team 3 buzzer |
| `TEAM4_PASSWORD` | `echipa4` | Password for Team 4 buzzer |
| `TEAM5_PASSWORD` | `echipa5` | Password for Team 5 buzzer |
| `TEAM6_PASSWORD` | `echipa6` | Password for Team 6 buzzer |
| `TEAM7_PASSWORD` | `echipa7` | Password for Team 7 buzzer |
| `TEAM8_PASSWORD` | `echipa8` | Password for Team 8 buzzer |
| `TEAM9_PASSWORD` | `echipa9` | Password for Team 9 buzzer |
| `TEAM10_PASSWORD` | `echipa10` | Password for Team 10 buzzer |

## Production Build & Deployment

### Build the client

```bash
npm run build
```

This builds React into `server/public/`, which Express serves statically.

### Start production server

```bash
npm start
```

### Deploy to Railway / Render

1. Push code to GitHub
2. Create a new project on [Railway](https://railway.app) or [Render](https://render.com)
3. Set environment variables:
   - `PORT` (usually set automatically)
   - `CONTROL_PASSWORD` (change from default!)
4. Set build command: `npm install && npm run build`
5. Set start command: `npm start`

**Note**: Use a platform that supports **persistent WebSockets** (Railway and Render both do).

## Audio Sounds

Placeholder silent MP3 files are included. To use real sounds:

1. Replace the files in `client/public/sounds/`:
   - `buzzer.mp3` – played when any team buzzes in
   - `correct.mp3` – played on correct answer (+ confetti)
   - `wrong.mp3` – played on wrong answer

The audio system is already wired up. Replacing the files works immediately.

> **Important**: On the `/display` page, click the **"🎮 Start Game"** button once to unlock audio playback (required by Chrome/Safari autoplay policy).

## Game Flow

1. Open `/display` on the projector Mac, click **"🎮 Start Game"**
2. Open `/control?pass=1234` on the GM's PC
3. Each team leader opens `/buzzer?team=teamX` on their phone and enters their team password
4. GM clicks a question on the board to open it — **buzzers activate automatically**
5. Teams tap **BUZZ** on their phones
6. The display shows the buzzer queue (ordered by server timestamp)
7. GM clicks **✅ Correct** or **❌ Wrong** to judge
8. Correct: points awarded, question marked used, confetti plays
9. Wrong: optionally deduct points, move to next team in queue
10. GM clicks **🔇 Reset Buzzers** between attempts if needed

## Features

- ✅ 5×5 Jeopardy board (5 categories × 5 point values)
- ✅ Real-time WebSockets (Socket.io)
- ✅ Buzzer system with server-side timestamp ordering
- ✅ Buzzers auto-activate when GM opens a question
- ✅ Password-protected GM panel
- ✅ Password-protected team buzzer pages (per-team passwords via env vars)
- ✅ Wake Lock API on team phones (screen stays on)
- ✅ Auto-save game state + resume on restart
- ✅ Confetti animation on correct answer
- ✅ Sound effects (buzzer, correct, wrong)
- ✅ Answer timer (15 seconds countdown)
- ✅ Practical task questions — orange on GM panel only, hidden from students
- ✅ Manual score adjustment
- ✅ Answer reveal toggle
- ✅ Full game reset
- ✅ Supports up to 10 teams