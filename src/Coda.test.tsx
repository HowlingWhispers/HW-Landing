import { describe, expect, it } from 'vitest';
import { musicReturnFromHash, withoutFragmentParameter } from './Coda';

describe('Coda music OAuth fragments', () => {
  it('recognizes only supported music return states', () => {
    expect(musicReturnFromHash('#music=connected')).toBe('connected');
    expect(musicReturnFromHash('#music=failed')).toBe('failed');
    expect(musicReturnFromHash('#music=unknown')).toBeNull();
    expect(musicReturnFromHash('#invite=friend')).toBeNull();
  });

  it('removes only the requested fragment parameter', () => {
    expect(withoutFragmentParameter('#invite=friend&music=connected', 'music')).toBe('#invite=friend');
    expect(withoutFragmentParameter('#music=failed&view=room', 'music')).toBe('#view=room');
    expect(withoutFragmentParameter('#music=connected', 'music')).toBe('');
  });
});
