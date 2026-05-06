import type { PrismaClient } from '../generated/prisma/client.js';

export const listDecks = async (prisma: PrismaClient, userId: string) => {
    return prisma.deck.findMany({
        where: { ownerId: userId },
    });
};

export const createDeck = async (
    prisma: PrismaClient,
    userId: string,
    deckName: string,
) => {
    return prisma.deck.create({
        data: { name: deckName, ownerId: userId },
    });
};

export const getDeck = async (
    prisma: PrismaClient,
    userId: string,
    deckId: string,
) => {
    return prisma.deck.findFirst({
        where: { id: deckId, ownerId: userId },
        include: { cards: true },
    });
};

export const renameDeck = async (
    prisma: PrismaClient,
    userId: string,
    deckId: string,
    name: string,
) => {
    const { count } = await prisma.deck.updateMany({
        where: { id: deckId, ownerId: userId },
        data: { name },
    });

    return count > 0 ? true : null;
};

export const deleteDeck = async (
    prisma: PrismaClient,
    userId: string,
    deckId: string,
) => {
    const { count } = await prisma.deck.deleteMany({
        where: { id: deckId, ownerId: userId },
    });

    return count > 0 ? true : null;
};

export const createDeckService = (prisma: PrismaClient) => ({
    listDecks: (userId: string) => listDecks(prisma, userId),
    createDeck: (userId: string, name: string) => createDeck(prisma, userId, name),
    getDeck: (userId: string, deckId: string) => getDeck(prisma, userId, deckId),
    renameDeck: (userId: string, deckId: string, name: string) => renameDeck(prisma, userId, deckId, name),
    deleteDeck: (userId: string, deckId: string) => deleteDeck(prisma, userId, deckId),
});
