import { elapsedFraction } from '../epgProgress';

describe('elapsedFraction', () => {
  it('is 0 before the programme starts', () => {
    expect(elapsedFraction(100, 200, 50)).toBe(0);
  });
  it('is 1 after the programme ends', () => {
    expect(elapsedFraction(100, 200, 300)).toBe(1);
  });
  it('is 0.5 at the midpoint', () => {
    expect(elapsedFraction(100, 200, 150)).toBeCloseTo(0.5);
  });
  it('is 0 for a zero- or negative-length programme', () => {
    expect(elapsedFraction(200, 200, 200)).toBe(0);
    expect(elapsedFraction(300, 200, 250)).toBe(0);
  });
  it('is 0 for non-finite input', () => {
    expect(elapsedFraction(NaN, 200, 150)).toBe(0);
  });
});
