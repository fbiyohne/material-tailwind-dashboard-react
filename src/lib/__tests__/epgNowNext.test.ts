import { describe, expect, it } from '@jest/globals';
import type { EpgEntry } from '@/domain/models';
import { findNowNext } from '../epgNowNext';

const e = (id: string, start: number, end: number): EpgEntry => ({
  id,
  profileId: 'p',
  epgChannelId: 'c',
  title: id,
  description: null,
  start,
  end,
});

describe('findNowNext', () => {
  const list = [e('a', 100, 200), e('b', 200, 300), e('c', 300, 400)];

  it('finds the current and next programme', () => {
    const r = findNowNext(list, 250);
    expect(r.now?.id).toBe('b');
    expect(r.next?.id).toBe('c');
  });
  it('treats start as inclusive, end as exclusive', () => {
    expect(findNowNext(list, 200).now?.id).toBe('b');
    expect(findNowNext(list, 300).now?.id).toBe('c');
  });
  it('before the first: no now, next is the first', () => {
    const r = findNowNext(list, 50);
    expect(r.now).toBeNull();
    expect(r.next?.id).toBe('a');
  });
  it('after the last: no now, no next', () => {
    const r = findNowNext(list, 500);
    expect(r.now).toBeNull();
    expect(r.next).toBeNull();
  });
  it('handles an empty list', () => {
    expect(findNowNext([], 100)).toEqual({ now: null, next: null });
  });
  it('sorts unsorted input', () => {
    const r = findNowNext([e('c', 300, 400), e('a', 100, 200), e('b', 200, 300)], 150);
    expect(r.now?.id).toBe('a');
    expect(r.next?.id).toBe('b');
  });
});
