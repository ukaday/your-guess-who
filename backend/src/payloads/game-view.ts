import type { GameView } from '@your-guess-who/contract';
import {
    toGameStartedPayload,
    type GameWithPlayersAndDeck,
} from './game-started-payload.js';

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
