import type { Card, Game, GamePlayer } from '../generated/prisma/client.js';
import type { GameStartedPayload } from '../types/socket.js';

export type GameWithPlayersAndDeck = Game & {
    players: GamePlayer[];
    deck: { cards: Card[] };
};

export function toGameStartedPayload(
    game: GameWithPlayersAndDeck,
): GameStartedPayload {
    return {
        id: game.id,
        status: game.status,
        activePlayerId: game.activePlayerId,
        players: game.players.map((player) => ({ userId: player.userId })),
        deck: {
            cards: game.deck.cards.map((card) => ({
                id: card.id,
                name: card.name,
            })),
        },
    };
}
