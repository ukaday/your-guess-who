import { describe, expect, it } from 'vitest';
import { errorToMessage } from '../../src/utils/error-to-message.js';

describe('errorToMessage', () => {
    it('returns message for Error instance', () => {
        const result = errorToMessage(new Error('something went wrong'));

        expect(result).toBe('something went wrong');
    });

    it('returns string representation for non-Error', () => {
        const result = errorToMessage('raw string error');

        expect(result).toBe('raw string error');
    });
});
