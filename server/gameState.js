const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'game_state.json');
const QUESTIONS_FILE = path.join(__dirname, '..', 'questions.json');

const DEFAULT_QUESTIONS = [
  // JavaScript
  { id: 'js_1', category: 'JavaScript', points: 100, question: 'What keyword is used to declare a variable that cannot be reassigned?', answer: 'const', isPracticalTask: false, used: false },
  { id: 'js_2', category: 'JavaScript', points: 200, question: 'What does the "===" operator check compared to "=="?', answer: 'Strict equality – checks both value AND type, unlike == which does type coercion', isPracticalTask: false, used: false },
  { id: 'js_3', category: 'JavaScript', points: 300, question: 'What is a Promise in JavaScript?', answer: 'An object representing the eventual completion or failure of an asynchronous operation', isPracticalTask: false, used: false },
  { id: 'js_4', category: 'JavaScript', points: 400, question: 'Write a function that returns the sum of all numbers in an array using reduce()', answer: 'arr.reduce((acc, curr) => acc + curr, 0)', isPracticalTask: true, used: false },
  { id: 'js_5', category: 'JavaScript', points: 500, question: 'Explain the event loop in JavaScript and how it handles async code.', answer: 'The event loop monitors the call stack and callback queue, moving callbacks to the stack when it is empty, enabling non-blocking async operations', isPracticalTask: false, used: false },

  // Algorithms
  { id: 'alg_1', category: 'Algorithms', points: 100, question: 'What is the time complexity of binary search?', answer: 'O(log n)', isPracticalTask: false, used: false },
  { id: 'alg_2', category: 'Algorithms', points: 200, question: 'What data structure uses FIFO (First In, First Out)?', answer: 'Queue', isPracticalTask: false, used: false },
  { id: 'alg_3', category: 'Algorithms', points: 300, question: 'What is the worst-case time complexity of QuickSort?', answer: 'O(n²) – occurs when pivot is always the smallest or largest element', isPracticalTask: true, used: false },
  { id: 'alg_4', category: 'Algorithms', points: 400, question: 'Implement a function to check if a string is a palindrome', answer: 'str === str.split("").reverse().join("")', isPracticalTask: false, used: false },
  { id: 'alg_5', category: 'Algorithms', points: 500, question: 'Explain the difference between BFS and DFS graph traversal algorithms', answer: 'BFS uses a queue and explores level by level; DFS uses a stack/recursion and explores as deep as possible before backtracking', isPracticalTask: false, used: false },

  // Networking
  { id: 'net_1', category: 'Networking', points: 100, question: 'What does HTTP stand for?', answer: 'HyperText Transfer Protocol', isPracticalTask: false, used: false },
  { id: 'net_2', category: 'Networking', points: 200, question: 'What is the difference between TCP and UDP?', answer: 'TCP is connection-oriented and reliable (guarantees delivery); UDP is connectionless and faster but no delivery guarantee', isPracticalTask: false, used: false },
  { id: 'net_3', category: 'Networking', points: 300, question: 'What HTTP status code means "Not Found"?', answer: '404', isPracticalTask: false, used: false },
  { id: 'net_4', category: 'Networking', points: 400, question: 'What is a REST API? Name the 4 main HTTP methods used.', answer: 'Representational State Transfer – an architectural style using GET, POST, PUT/PATCH, DELETE', isPracticalTask: false, used: false },
  { id: 'net_5', category: 'Networking', points: 500, question: 'Configure a simple Express.js server that responds to GET /hello with "Hello World"', answer: 'const app = require("express")(); app.get("/hello", (req,res) => res.send("Hello World")); app.listen(3000)', isPracticalTask: true, used: false },

  // Databases
  { id: 'db_1', category: 'Databases', points: 100, question: 'What does SQL stand for?', answer: 'Structured Query Language', isPracticalTask: false, used: false },
  { id: 'db_2', category: 'Databases', points: 200, question: 'What is the difference between SQL and NoSQL databases?', answer: 'SQL databases are relational with fixed schema (tables); NoSQL are non-relational with flexible schema (documents, key-value, graphs, etc.)', isPracticalTask: true, used: false },
  { id: 'db_3', category: 'Databases', points: 300, question: 'What SQL keyword retrieves only unique values from a column?', answer: 'DISTINCT (SELECT DISTINCT ...)', isPracticalTask: false, used: false },
  { id: 'db_4', category: 'Databases', points: 400, question: 'Write a SQL query to find all users with score greater than 100, ordered by score descending', answer: 'SELECT * FROM users WHERE score > 100 ORDER BY score DESC', isPracticalTask: false, used: false },
  { id: 'db_5', category: 'Databases', points: 500, question: 'What is database indexing and why is it important for performance?', answer: 'An index is a data structure that speeds up data retrieval. It reduces full table scans but has write overhead. Essential for large tables on frequently queried columns', isPracticalTask: false, used: false },

  // DevOps
  { id: 'devops_1', category: 'DevOps', points: 100, question: 'What does CI/CD stand for?', answer: 'Continuous Integration / Continuous Delivery (or Deployment)', isPracticalTask: true, used: false },
  { id: 'devops_2', category: 'DevOps', points: 200, question: 'What is Docker and what problem does it solve?', answer: 'Docker is a containerization platform that packages apps with all dependencies, solving the "works on my machine" problem', isPracticalTask: false, used: false },
  { id: 'devops_3', category: 'DevOps', points: 300, question: 'What git command creates a new branch AND switches to it?', answer: 'git checkout -b <branch-name>  OR  git switch -c <branch-name>', isPracticalTask: false, used: false },
  { id: 'devops_4', category: 'DevOps', points: 400, question: 'Write a Dockerfile for a Node.js app that installs dependencies and starts with "npm start"', answer: 'FROM node:18-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nCMD ["npm","start"]', isPracticalTask: false, used: false },
  { id: 'devops_5', category: 'DevOps', points: 500, question: 'Explain the difference between horizontal and vertical scaling', answer: 'Vertical scaling = adding more resources (CPU/RAM) to one machine. Horizontal scaling = adding more machines/instances. Horizontal is preferred for high availability', isPracticalTask: false, used: false },
];

function loadQuestionsFromFile() {
  try {
    if (fs.existsSync(QUESTIONS_FILE)) {
      const raw = fs.readFileSync(QUESTIONS_FILE, 'utf8');
      const saved = JSON.parse(raw);
      if (Array.isArray(saved)) return saved;
    }
  } catch (err) {
    console.warn('Failed to load questions.json, using DEFAULT_QUESTIONS:', err.message);
  }
  return DEFAULT_QUESTIONS.map(q => ({ ...q }));
}

function saveQuestionsToFile(questions) {
  try {
    fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(questions, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save questions.json:', err.message);
  }
}

function createDefaultState() {
  return {
    round: 1,
    teams: [],
    questions: loadQuestionsFromFile().map(q => ({ ...q, used: false })), // reset used on new game
    currentQuestion: null,
    buzzersActive: false,
    buzzerQueue: [],
    answerRevealed: false,
    timerActive: false,
    timerSeconds: 15,
    practicalPendingTeamIds: [],
  };
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const saved = JSON.parse(raw);

      // backwards-compatible defaults:
      if (!Array.isArray(saved.questions)) saved.questions = loadQuestionsFromFile().map(q => ({ ...q, used: false }));
      if (!Array.isArray(saved.teams)) saved.teams = [];
      if (!Array.isArray(saved.buzzerQueue)) saved.buzzerQueue = [];
      if (!saved.practicalPendingTeamIds) saved.practicalPendingTeamIds = [];

      console.log('Game state loaded from file.');
      return saved;
    }
  } catch (err) {
    console.warn('Failed to load game_state.json, using default:', err.message);
  }
  return createDefaultState();
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save game state:', err.message);
  }
}

function resetState() {
  // IMPORTANT: reset using persisted questions.json (latest saved in editor)
  return createDefaultState();
}

module.exports = { loadState, saveState, resetState, saveQuestionsToFile };
