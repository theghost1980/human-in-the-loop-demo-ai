import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

describe('loadEnv', () => {
  it('applies the defaults when nothing is set', () => {
    expect(loadEnv({})).toEqual({ NODE_ENV: 'development', PORT: 3001 });
  });

  it('coerces PORT from a string', () => {
    expect(loadEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('accepts a known NODE_ENV', () => {
    expect(loadEnv({ NODE_ENV: 'production' }).NODE_ENV).toBe('production');
  });

  it.each(['abc', '0', '70000', '3000.5', ''])('rejects PORT=%j', (PORT) => {
    expect(() => loadEnv({ PORT })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => loadEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('names the wrong variable but never echoes its value', () => {
    const leaked = 'super-secret-value';
    let message = '';
    try {
      loadEnv({ PORT: leaked, NODE_ENV: leaked });
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message).toContain('PORT');
    expect(message).toContain('NODE_ENV');
    expect(message).not.toContain(leaked);
  });
});
