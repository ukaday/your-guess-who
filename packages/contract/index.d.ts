export type GameStatus = 'LOBBY' | 'ACTIVE' | 'FINISHED';

export type ClientEvents = {
    'game:join': (payload: GameJoinPayload, ack?: () => void) => void;
    'game:end-turn': () => void;
    'game:guess': (payload: GameGuessPayload) => void;
};

export type ServerEvents = {
    'game:started': (state: GameStartedPayload) => void;
    'game:error': (payload: GameErrorPayload) => void;
    'game:your-card': (payload: GameYourCardPayload) => void;
    'game:active-player-changed': (
        payload: GameActivePlayerChangedPayload,
    ) => void;
    'game:guess-wrong': (payload: GameGuessWrongPayload) => void;
    'game:over': (payload: GameOverPayload) => void;
    'game:opponent-disconnected': () => void;
    'game:opponent-reconnected': () => void;
};

export type GameJoinPayload = { gameId: string };
export type GameStartedPayload = {
    id: string;
    status: GameStatus;
    activePlayerId: string | null;
    players: { userId: string }[];
    deck: { cards: { id: string; name: string }[] };
};
export type GameErrorPayload = { message: string };
export type GameYourCardPayload = { cardId: string };
export type GameActivePlayerChangedPayload = { activePlayerId: string };
export type GameGuessPayload = { cardId: string };
export type GameGuessWrongPayload = {
    activePlayerId: string;
    guessedCardId: string;
};
export type GameOverPayload = { winnerId: string };

export type GameView = GameStartedPayload & {
    yourSecretCardId: string | null;
};
