import type { PrismaClient } from '../generated/prisma/client.js';

export const createCard = async (
    prisma: PrismaClient,
    userId: string,
    deckId: string,
    name: string,
    imageKey: string,
) => {
    const deck = await prisma.deck.findFirst({
        where: { id: deckId, ownerId: userId },
    });

    if (!deck) return null;

    return prisma.card.create({
        data: { name, imageKey, deckId },
    });
};

export const deleteCard = async (
    prisma: PrismaClient,
    userId: string,
    deckId: string,
    cardId: string,
) => {
    const { count } = await prisma.card.deleteMany({
        where: { id: cardId, deckId, deck: { ownerId: userId } },
    });

    return count > 0 ? true : null;
};

export const createCardService = (prisma: PrismaClient) => ({
    createCard: (
        userId: string,
        deckId: string,
        name: string,
        imageKey: string,
    ) => createCard(prisma, userId, deckId, name, imageKey),
    deleteCard: (userId: string, deckId: string, cardId: string) =>
        deleteCard(prisma, userId, deckId, cardId),
});
