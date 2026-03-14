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

    const interval = setInterval(() => {
      if (!gameState && socket.connected) {
        socket.emit("request_state");
      }
    }, 2000);

    return () => clearInterval(interval);

  }, [gameState]);

  // ===============================
  // WAKE LOCK
  // ===============================

  useEffect(() => {

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

  }, []);

  // ===============================
  // GAME SOCKET EVENTS
  // ===============================

  useEffect(() => {

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

  }, []);

  // ===============================
  // TEAM ID CHECK
  // ===============================

  if (!teamId) {
    return (
      <div style={styles.error}>
        <h1 style={styles.errorTitle}>❌ ID echipă lipsă</h1>
        <p style={styles.errorText}>
          Deschide pagina ca <code>/buzzer?team=team1</code>
        </p>
      </div>
    );
  }

  // ===============================
  // LOADING STATES
  // ===============================

  if (!socket.connected) {
    return <div style={styles.loading}>Se conectează la server...</div>;
  }

  if (!gameState) {
    return <div style={styles.loading}>Se încarcă jocul...</div>;
  }

  const team = gameState.teams.find(t => t.id === teamId);

  // ✅ FIX: arată un mesaj clar în loc de "Se conectează la server..."
  if (!team) {
    return (
      <div style={styles.error}>
        <h1 style={styles.errorTitle}>⚠️ Echipa nu a fost găsită</h1>
        <p style={styles.errorText}>
          ID-ul echipei <code style={{ background: "#333", padding: "2px 6px", borderRadius: 4 }}>{teamId}</code> nu există în joc.
        </p>
        <p style={styles.errorText}>
          Verifică link-ul sau contactează organizatorul.
        </p>
      </div>
    );
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
    statusEl = <p style={styles.statusWaiting}>⏸ Așteptați...</p>;
  }

  else if (buzzed && amFirst) {
    statusEl = <div style={styles.statusFirst}>🎉 PRIMUL!</div>;
    btnStyle = { ...btnStyle, ...styles.buzzBtnFirst };
  }

  else if (buzzed && myPosition > 0) {
    statusEl = (
      <div style={styles.statusNotFirst}>
        ❌ {firstTeam ? firstTeam.name.toUpperCase() : "ALTĂ ECHIPĂ"} A FOST PRIMA
      </div>
    );
  }

  else if (buzzersActive) {
    statusEl = (
      <p style={{ color: "#4caf50", fontSize: "18px", textAlign: "center" }}>
        🔔 BUZZERE ACTIVE
      </p>
    );
  }

  return (
    <div style={styles.page}>

      <div style={styles.header}>
        <h1 style={styles.teamName}>{team.name}</h1>

        <div style={styles.score}>
          Scor:
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
          {buzzed ? (amFirst ? "🎉 PRIMUL!" : "⏳") : "BUZZ"}
        </button>
      </div>

      <div style={styles.statusArea}>

        {statusEl}

        {myPosition >= 0 && (
          <p style={{ color: "#aaa", fontSize: "16px" }}>
            Poziție în coadă: #{myPosition + 1}
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

  error: {
    minHeight: "100vh",
    background: "#060ce9",
    color: "#FFD700",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    textAlign: "center"
  },

  errorTitle: {
    fontSize: "32px",
    marginBottom: "16px"
  },

  errorText: {
    color: "#ccc",
    fontSize: "18px",
    marginBottom: "8px"
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
