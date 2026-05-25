import type { Card } from '../generated/prisma/client.js';

export const selectSecretCards = (cards: Card[]) => {
    if (cards.length < 2) {
        throw new Error('Input card list contains less than two cards')
    }

    const shuffled = [...cards].sort(() => Math.random() - 0.5);

    return [shuffled[0], shuffled[1]];
};
