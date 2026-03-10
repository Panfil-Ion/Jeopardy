function adjustScore(teams, teamId, delta) {
  return teams.map(team =>
    team.id === teamId
      ? { ...team, score: team.score + delta }
      : team
  );
}

function addPoints(teams, teamId, points) {
  return adjustScore(teams, teamId, points);
}

function subtractPoints(teams, teamId, points) {
  return adjustScore(teams, teamId, -points);
}

module.exports = { adjustScore, addPoints, subtractPoints };
