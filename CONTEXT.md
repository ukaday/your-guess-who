# Your Guess Who

A two-player online Guess Who. One player creates a Game from a Deck they own,
the other joins with an Invite code, and each tries to name the other's Secret
card first.

## Language

**User**:
An account. Identity lives in Cognito; the local database mirrors the Cognito
sub and nothing else.
_Avoid_: account, player (when the account itself is meant)

**Player**:
A User's participation in one Game. A User is a Player twice over if they are in
two Games.
_Avoid_: participant, opponent (that is a role, not a thing)

**Game**:
One contest between two Players over one Deck.
_Avoid_: match, session, room

**Deck**:
A set of Cards owned by one User. A Game is played over exactly one Deck, and a
Deck may be reused across Games.
_Avoid_: set, collection, board

**Card**:
One face in a Deck — a name and an image.

**Secret card**:
The Card a Player must have named to win. Each Player is dealt one at the start
of a Game, and it is visible to that Player alone.
_Avoid_: chosen card, target, answer

**Board**:
The Cards a Player still considers possible. Distinct from the Deck, which never
changes during a Game.

**Elimination**:
A Player ruling a Card out on their own Board. Private — no other Player learns
which Cards have been eliminated, or how many.
_Avoid_: flip, discard, remove

**Turn**:
A Player's opportunity to act. A Turn ends when the Player says so, not when
they eliminate a Card — a single Turn may eliminate many Cards, or none.

**Invite code**:
The short string a second Player uses to join a Game. Distinct from the Game's
id: the code is for humans to pass along, the id addresses the Game once joined.
