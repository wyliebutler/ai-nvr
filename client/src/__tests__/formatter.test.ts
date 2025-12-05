import { describe, it, expect } from 'vitest';
import { formatTimestamp } from '../lib/formatter';

describe('formatTimestamp', () => {
    it('formats recorder filename timestamp correctly', () => {
        const input = '2023-12-25_14-30-00';
        // Note: verify expected locale string might vary by system/node locale, 
        // so checking for partial match or specific components is safer if locale is unknown.
        // Or mock the locale. For now let's just check it returns a string that contains the key numbers.
        const output = formatTimestamp(input);
        expect(output).toContain('2023');
        expect(output).toContain('12'); // or localized month
        expect(output).toContain('25');
    });

    it('handles invalid inputs gracefully (returns Invalid Date string usually)', () => {
        const output = formatTimestamp('invalid');
        expect(output).toBe('Invalid Date');
    });
});
