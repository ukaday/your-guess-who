import type { GameStartedPayload } from '../types/socket.js';
import {
    toGameStartedPayload,
    type GameWithPlayersAndDeck,
} from './game-started-payload.js';

export type GameView = GameStartedPayload & {
    yourSecretCardId: string | null;
};

export function toGameView(
    game: GameWithPlayersAndDeck,
    userId: string,
): GameView {
    const ownPlayer = game.players.find((player) => player.userId === userId);

    return {
        ...toGameStartedPayload(game),
        yourSecretCardId: ownPlayer?.secretCardId ?? null,
    };
}
