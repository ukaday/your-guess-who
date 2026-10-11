import type { Game, GamePlayer } from '../generated/prisma/client.js';

export type CreatedGameView = Pick<Game, 'id' | 'inviteCode' | 'status'>;

export type JoinedGameView = Pick<GamePlayer, 'gameId'>;

export function toCreatedGameView(game: Game): CreatedGameView {
    return {
        id: game.id,
        inviteCode: game.inviteCode,
        status: game.status,
    };
}

export function toJoinedGameView(player: GamePlayer): JoinedGameView {
    return { gameId: player.gameId };
}
