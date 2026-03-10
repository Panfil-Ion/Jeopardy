function addBuzz(queue, teamId) {
  const alreadyInQueue = queue.some(entry => entry.teamId === teamId);
  if (alreadyInQueue) return queue;

  const newEntry = { teamId, serverTimestamp: Date.now() };
  const updated = [...queue, newEntry];
  updated.sort((a, b) => a.serverTimestamp - b.serverTimestamp);
  return updated;
}

function resetQueue() {
  return [];
}

function nextTeam(queue) {
  if (queue.length === 0) return [];
  return queue.slice(1);
}

module.exports = { addBuzz, resetQueue, nextTeam };
