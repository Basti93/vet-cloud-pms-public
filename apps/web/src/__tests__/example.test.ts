import { describe, it, expect } from 'vitest';

describe('Example Test Suite', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle strings', () => {
    const str = 'hello';
    expect(str).toBe('hello');
  });
});
