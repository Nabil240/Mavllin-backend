import { describe, it, expect } from 'vitest';
import { BdtCurrencyPipe } from './bdt.pipe';

describe('BdtCurrencyPipe', () => {
  const pipe = new BdtCurrencyPipe();

  it('should transform positive integer to ৳ format', () => {
    expect(pipe.transform(1250)).toBe('৳1,250');
    expect(pipe.transform(2850)).toBe('৳2,850');
  });

  it('should support string number inputs', () => {
    expect(pipe.transform('4200')).toBe('৳4,200');
  });

  it('should format with decimals when showDecimals is true', () => {
    expect(pipe.transform(1250.5, true)).toBe('৳1,250.50');
    expect(pipe.transform(0, true)).toBe('৳0.00');
  });

  it('should handle null, undefined, empty string and NaN gracefully', () => {
    expect(pipe.transform(null)).toBe('৳0');
    expect(pipe.transform(undefined)).toBe('৳0');
    expect(pipe.transform('')).toBe('৳0');
    expect(pipe.transform('invalid')).toBe('৳0');
  });
});
