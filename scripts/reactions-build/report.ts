import type { BuiltRule } from './validate.ts';

export function printReport(rules: BuiltRule[], warnings: string[]): void {
  const out = process.stdout;
  out.write(`reactions-build: ${rules.length} rule(s)\n`);
  const byCat = new Map<string, number>();
  for (const r of rules) byCat.set(r._category, (byCat.get(r._category) ?? 0) + 1);
  for (const [cat, n] of [...byCat.entries()].sort()) {
    out.write(`  - ${cat}: ${n}\n`);
  }
  if (warnings.length > 0) {
    out.write(`reactions-build: ${warnings.length} warning(s)\n`);
    for (const w of warnings) out.write(`  ! ${w}\n`);
  }
  out.write(
    `reactions-build: SMARTS RDKit-compile check DEFERRED ` +
      `(rule engine deferred — RDKit MinimalLib has no reaction API).\n`,
  );
}
