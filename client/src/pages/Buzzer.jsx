import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import socket from "../socket.js";

export default function Buzzer() {

  const [searchParams] = useSearchParams();
  const teamId = searchParams.get("team");

  const [gameState, setGameState] = useState(null);
  const [buzzerQueue, setBuzzerQueue] = useState([]);
  const [buzzed, setBuzzed] = useState(false);

  const wakeLockRef = useRef(null);

  const registeredKey = `buzzer_registered_${teamId}`;

  const [registered, setRegistered] = useState(
    () => teamId ? Boolean(localStorage.getItem(`buzzer_registered_${teamId}`)) : false
  );

  const [teamNameInput, setTeamNameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  const [regError, setRegError] = useState("");
  const [regChecking, setRegChecking] = useState(false);

  // ===============================
  // SOCKET CONNECT / RECONNECT
  // ===============================

  useEffect(() => {

    function onConnect() {
      console.log("Connected:", socket.id);
      socket.emit("request_state");
    }

    function onDisconnect() {
      console.log("Disconnected");
      setGameState(null);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (socket.connected) {
      socket.emit("request_state");
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };

  }, []);

  // ===============================
  // STATE RETRY (IMPORTANT)
  // ===============================

  useEffect(() => {

    if (!registered) return;

    const interval = setInterval(() => {

      if (!gameState && socket.connected) {
        socket.emit("request_state");
      }

    }, 2000);

    return () => clearInterval(interval);

  }, [registered, gameState]);

  // ===============================
  // WAKE LOCK
  // ===============================

  useEffect(() => {

    if (!registered) return;

    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch (err) {
        console.warn("WakeLock error", err);
      }
    }

    requestWakeLock();

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);

      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };

  }, [registered]);

  // ===============================
  // GAME SOCKET EVENTS
  // ===============================

  useEffect(() => {

    if (!registered) return;

    function onGameState(state) {
      setGameState(state);
      setBuzzerQueue(state.buzzerQueue || []);
      if (!state.buzzersActive) setBuzzed(false);
    }

    function onBuzzerUpdate(queue) {
      setBuzzerQueue(queue);
    }

    function onBuzzerActivated() {
      setBuzzed(false);
      setGameState(prev => prev ? { ...prev, buzzersActive: true } : prev);
    }

    function onBuzzerDeactivated() {
      setBuzzed(false);
      setBuzzerQueue([]);
      setGameState(prev => prev ? { ...prev, buzzersActive: false } : prev);
    }

    function onScoreUpdate(teams) {
      setGameState(prev => prev ? { ...prev, teams } : prev);
    }

    function onQuestionClose() {
      setBuzzed(false);
      setBuzzerQueue([]);
      setGameState(prev => prev ? { ...prev, buzzersActive: false } : prev);
    }

    socket.on("game_state", onGameState);
    socket.on("buzzer_update", onBuzzerUpdate);
    socket.on("buzzer_activated", onBuzzerActivated);
    socket.on("buzzer_deactivated", onBuzzerDeactivated);
    socket.on("score_update", onScoreUpdate);
    socket.on("question_close", onQuestionClose);

    socket.emit("request_state");

    return () => {
      socket.off("game_state", onGameState);
      socket.off("buzzer_update", onBuzzerUpdate);
      socket.off("buzzer_activated", onBuzzerActivated);
      socket.off("buzzer_deactivated", onBuzzerDeactivated);
      socket.off("score_update", onScoreUpdate);
      socket.off("question_close", onQuestionClose);
    };

  }, [registered]);

  // ===============================
  // TEAM ID CHECK
  // ===============================

  if (!teamId) {
    return (
      <div style={styles.error}>
        <h1 style={styles.errorTitle}>❌ Missing Team ID</h1>
        <p style={styles.errorText}>
          Open page as <code>/buzzer?team=team1</code>
        </p>
      </div>
    );
  }

  // ===============================
  // LOADING STATES
  // ===============================

  if (!socket.connected) {
    return <div style={styles.loading}>Connecting to server...</div>;
  }

  if (!gameState) {
    return <div style={styles.loading}>Loading game...</div>;
  }

  const team = gameState.teams.find(t => t.id === teamId);

  if (!team) {
    return <div style={styles.loading}>Se conectează la server...</div>;
  }

  // ===============================
  // BUZZER
  // ===============================

  const buzzersActive = gameState.buzzersActive;

  const myPosition = buzzerQueue.findIndex(e => e.teamId === teamId);

  const amFirst = myPosition === 0;

  const firstTeam = buzzerQueue[0]
    ? gameState.teams.find(t => t.id === buzzerQueue[0].teamId)
    : null;

  function handleBuzz() {

    if (!socket.connected) return;

    if (!buzzersActive || buzzed) return;

    socket.emit("buzz", {
      teamId,
      timestamp: Date.now()
    });

    setBuzzed(true);
  }

  let statusEl = null;
  let btnDisabled = !buzzersActive || buzzed;

  let btnStyle = { ...styles.buzzBtn };

  if (!buzzersActive && !buzzed) {
    btnStyle = { ...btnStyle, ...styles.buzzBtnDisabled };
    statusEl = <p style={styles.statusWaiting}>⏸ Waiting...</p>;
  }

  else if (buzzed && amFirst) {
    statusEl = <div style={styles.statusFirst}>🎉 YOU'RE FIRST!</div>;
    btnStyle = { ...btnStyle, ...styles.buzzBtnFirst };
  }

  else if (buzzed && myPosition > 0) {
    statusEl = (
      <div style={styles.statusNotFirst}>
        ❌ {firstTeam ? firstTeam.name.toUpperCase() : "ANOTHER TEAM"} WAS FIRST
      </div>
    );
  }

  else if (buzzersActive) {
    statusEl = (
      <p style={{ color: "#4caf50", fontSize: "18px", textAlign: "center" }}>
        🔔 BUZZERS ACTIVE
      </p>
    );
  }

  return (
    <div style={styles.page}>

      <div style={styles.header}>
        <h1 style={styles.teamName}>{team.name}</h1>

        <div style={styles.score}>
          Score:
          <span style={{ color: team.score < 0 ? "#ff6b6b" : "#FFD700" }}>
            {team.score < 0
              ? `-$${Math.abs(team.score)}`
              : `$${team.score}`}
          </span>
        </div>
      </div>

      <div style={styles.center}>
        <button
          style={btnStyle}
          onClick={handleBuzz}
          disabled={btnDisabled}
        >
          {buzzed ? (amFirst ? "🎉 FIRST!" : "⏳") : "BUZZ"}
        </button>
      </div>

      <div style={styles.statusArea}>

        {statusEl}

        {myPosition >= 0 && (
          <p style={{ color: "#aaa", fontSize: "16px" }}>
            Position in queue: #{myPosition + 1}
          </p>
        )}

      </div>

    </div>
  );

}

const styles = {
  loading: {
    minHeight: "100vh",
    background: "#060ce9",
    color: "#FFD700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px"
  },

  page: {
    minHeight: "100vh",
    background: "#060ce9",
    display: "flex",
    flexDirection: "column",
    padding: "20px",
    gap: "20px"
  },

  header: {
    textAlign: "center"
  },

  teamName: {
    color: "#FFD700",
    fontSize: "42px"
  },

  score: {
    color: "white",
    fontSize: "24px"
  },

  center: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },

  buzzBtn: {
    width: "300px",
    height: "300px",
    borderRadius: "50%",
    background: "#e53935",
    color: "white",
    fontSize: "64px",
    border: "6px solid #b71c1c"
  },

  buzzBtnDisabled: {
    background: "#333",
    border: "6px solid #555",
    color: "#666"
  },

  buzzBtnFirst: {
    background: "#FFD700",
    border: "6px solid #FFA000",
    color: "#000"
  },

  statusArea: {
    minHeight: "80px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },

  statusFirst: {
    color: "#FFD700",
    fontSize: "36px"
  },

  statusNotFirst: {
    color: "#f44336",
    fontSize: "22px"
  },

  statusWaiting: {
    color: "#aaa",
    fontSize: "22px"
  }
};
