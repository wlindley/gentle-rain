import type { BotRunRecord, TournamentSummary } from '../simulation';

export interface LeaderboardPanelProps {
  readonly records: readonly BotRunRecord[];
  readonly tournamentSummaries: readonly TournamentSummary[];
  readonly tournamentSeed: number | null;
  readonly onClearHistory: () => void;
}

const pct = (rate: number): string => `${(rate * 100).toFixed(1)}%`;

export function LeaderboardPanel({
  records,
  tournamentSummaries,
  tournamentSeed,
  onClearHistory,
}: LeaderboardPanelProps) {
  const rankedRecords = [...records].sort((a, b) => b.meanScore - a.meanScore);

  return (
    <section className="panel" aria-label="Bot leaderboard and comparison">
      {tournamentSummaries.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h2>
            Head-to-Head Comparison {tournamentSeed !== null ? `(Seed ${tournamentSeed})` : ''}
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank & Bot</th>
                  <th>Games</th>
                  <th>Win %</th>
                  <th>Mean</th>
                  <th>Median</th>
                  <th>p95</th>
                  <th>p99</th>
                  <th>Max</th>
                  <th>Avg Blooms</th>
                </tr>
              </thead>
              <tbody>
                {tournamentSummaries.map(({ bot, stats }, index) => (
                  <tr key={bot.id}>
                    <td>#{index + 1} {bot.name}</td>
                    <td>{stats.totalGames.toLocaleString()}</td>
                    <td>{pct(stats.winRate)}</td>
                    <td>{stats.meanScore.toFixed(2)}</td>
                    <td>{stats.medianScore.toFixed(1)}</td>
                    <td>{stats.p95Score}</td>
                    <td>{stats.p99Score}</td>
                    <td>{stats.maxScore}</td>
                    <td>{stats.meanBlooms.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Saved Bot Runs (localStorage)</h2>
        <button type="button" disabled={records.length === 0} onClick={onClearHistory}>
          Clear History
        </button>
      </div>

      {rankedRecords.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.88rem' }}>
          No saved runs yet. Complete a simulation or click &ldquo;Compare All Bots&rdquo; to record results.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Bot</th>
                <th>Games</th>
                <th>Seed</th>
                <th>Win %</th>
                <th>Mean</th>
                <th>Median</th>
                <th>p95</th>
                <th>p99</th>
                <th>Max</th>
              </tr>
            </thead>
            <tbody>
              {rankedRecords.map((rec) => (
                <tr key={rec.id}>
                  <td>{rec.botName}</td>
                  <td>{rec.totalGames.toLocaleString()}</td>
                  <td>{rec.baseSeed ?? 'random'}</td>
                  <td>{pct(rec.winRate)}</td>
                  <td>{rec.meanScore.toFixed(2)}</td>
                  <td>{rec.medianScore.toFixed(1)}</td>
                  <td>{rec.p95Score}</td>
                  <td>{rec.p99Score}</td>
                  <td>{rec.maxScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
