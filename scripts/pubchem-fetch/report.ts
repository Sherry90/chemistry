export interface ReportStats {
  total: number;
  successful: number;
  droppedParse: number;
  droppedEmbed: number;
  cacheHits: number;
  startedAt: number;
}

export function createStats(): ReportStats {
  return {
    total: 0,
    successful: 0,
    droppedParse: 0,
    droppedEmbed: 0,
    cacheHits: 0,
    startedAt: Date.now(),
  };
}

export function logProgress(
  stats: ReportStats,
  current: number,
  total: number,
  label: string,
): void {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  process.stdout.write(`\r[${pct.toString().padStart(3)}%] ${current}/${total} — ${label}   `);
}

export function logWarning(msg: string): void {
  process.stderr.write(`\nWARN: ${msg}\n`);
}

export function logError(msg: string): void {
  process.stderr.write(`\nERROR: ${msg}\n`);
}

export function printFinalReport(
  stats: ReportStats,
  dropped: ReadonlyArray<{ cid: number; reason: string; detail: string }>,
): void {
  const elapsedSec = ((Date.now() - stats.startedAt) / 1000).toFixed(1);
  console.log(`\n\n=== Compound Fetch Report ===`);
  console.log(`Total requested : ${stats.total}`);
  console.log(`Successful      : ${stats.successful}`);
  console.log(`Dropped (parse) : ${stats.droppedParse}`);
  console.log(`Dropped (embed) : ${stats.droppedEmbed}`);
  console.log(`Cache hits      : ${stats.cacheHits}`);
  console.log(`Elapsed         : ${elapsedSec}s`);

  if (dropped.length > 0) {
    console.log(`\nDropped entries:`);
    for (const d of dropped) {
      console.log(`  CID ${d.cid}: ${d.reason} — ${d.detail}`);
    }
  }
}
