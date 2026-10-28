/** Small id generator — stable, unique enough for a single-browser virtual OS. */
let counter = 0;

export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 1_000_000;
  const random = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36);
  return `${prefix}_${time}${random}${counter.toString(36)}`;
}

/** Deterministic ids for seeded demo content. */
export function seededUid(prefix: string, seed: string): string {
  return `${prefix}_${seed}`;
}
