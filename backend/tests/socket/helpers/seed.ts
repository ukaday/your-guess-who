import { randomUUID } from 'crypto';
import { prisma } from '../../../src/lib/db.js';

export const seedLobbyGame = async function (): Promise<{
    gameId: string;
    player1Id: string;
    player2Id: string;
}> {
    const player1Id = randomUUID();
    const player2Id = randomUUID();

    await prisma.user.create({ data: { id: player1Id } });
    await prisma.user.create({ data: { id: player2Id } });

    const deck = await prisma.deck.create({
        data: {
            name: 'Test Deck',
            ownerId: player1Id,
            cards: {
                create: [
                    { name: 'Alice', imageKey: 'img/alice' },
                    { name: 'Bob', imageKey: 'img/bob' },
                ],
            },
        },
    });

    const game = await prisma.game.create({
        data: {
            inviteCode: randomUUID(),
            status: 'LOBBY',
            deckId: deck.id,
            players: {
                create: [{ userId: player1Id }, { userId: player2Id }],
            },
        },
    });

    return { gameId: game.id, player1Id, player2Id };
};

export const resetDb = async function (): Promise<void> {
    await prisma.gamePlayer.deleteMany();
    await prisma.game.deleteMany();
    await prisma.card.deleteMany();
    await prisma.deck.deleteMany();
    await prisma.user.deleteMany();
};
