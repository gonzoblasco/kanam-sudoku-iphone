import { generatePuzzle } from './src/core/generator.ts';
for (const d of ['facil', 'medio', 'dificil'] as const) {
  const t0 = Date.now();
  const r = generatePuzzle(d, { seed: 42, maxAttempts: 1000 });
  const ms = Date.now() - t0;
  const givens = r.puzzle.filter(v => v !== 0).length;
  console.log(d.padEnd(7), '| vacias:', String(81 - givens).padStart(2), '| tier:', r.rating.maxTier, '| solved:', r.rating.solved, '| steps:', r.rating.steps, '| matched:', r.matched, '| ms:', ms, '|', JSON.stringify(r.rating.techniqueCounts));
}
