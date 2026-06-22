/** Fraction (0..1) of a programme elapsed at `nowSecs`. Safe on bad input. */
export function elapsedFraction(
  startSecs: number,
  endSecs: number,
  nowSecs: number,
): number {
  if (
    !Number.isFinite(startSecs) ||
    !Number.isFinite(endSecs) ||
    !Number.isFinite(nowSecs) ||
    endSecs <= startSecs
  ) {
    return 0;
  }
  const f = (nowSecs - startSecs) / (endSecs - startSecs);
  return Math.max(0, Math.min(1, f));
}
