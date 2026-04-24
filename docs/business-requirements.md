# Business Requirements

## Overview

Web-based multiplayer Guess Who with **custom decks** — any set of named, photo-backed cards. Two players connect real-time, each gets randomly assigned secret card from shared deck, take turns eliminating cards to identify opponent's card.

---

## User Accounts

- Register with username + password — no email, phone, or other personal data collected or stored
- Session persists across refreshes and restarts until explicit logout

---

## Deck Management

- User owns up to **5 decks**
- Each deck has exactly **24 cards**
- Each card has:
  - Display name — max length configurable constant (set at deploy time)
  - Image — compressed and cropped to configurable square pixel size (set at deploy time)
- Users can edit (rename, add/remove cards) and delete own decks
- Deck must have exactly 24 cards before use in game

---

## Game Flow

### Creating a Game

1. User selects completed deck, creates game
2. System generates short human-readable invite code
3. Creator waits on lobby screen showing invite code

### Joining a Game

1. Second user enters invite code on join screen
2. Both players placed into same game

### Card Assignment

- When both players in lobby, system randomly assigns each a secret card from deck
- Two players cannot get same card
- Neither player can choose own card

### Gameplay

Players alternate turns. Active player interacts with board — grid of all 24 cards still under consideration.

**Eliminating cards (standard turn)**:
1. Active player asks question out loud (real life — no in-app chat)
2. Based on opponent's verbal answer, active player selects one or more cards to eliminate
3. Click **Eliminate** to confirm — ends turn, passes to opponent

**Making a guess**:
1. Instead of eliminating, active player clicks **Guess Who?**
2. Select one remaining card from board
3. Click **Confirm**
4. Correct guess → **You Win** for guesser, **You Lose** for opponent
5. Wrong guess → guesser loses immediately (**You Lose** / **You Win**)
6. Game ends regardless of guess outcome

### Post-Game

- Both players see win or lose result screen
- Players can rematch (same deck, new random secret cards) or return to home screen