# Make joinGame check and insert atomically, it reads the player count then creates the GamePlayer row with no transaction so two users submitting the same invite code at once can both join and leave a game with three players

## Metadata

- Priority: B
- Created: 2026-11-13
- Due: 2027-01-10
- Projects: +backend
- Contexts: @sev2, @bug

## Task

```todo.txt
(B) 2026-11-13 Make joinGame check and insert atomically, it reads the player count then creates the GamePlayer row with no transaction so two users submitting the same invite code at once can both join and leave a game with three players +backend @sev2 @bug due:2027-01-10 note:projects/tuxedo-tasks/joingame-race-lets-a-third-player-into-a-game.md
```

## My notes

### The defect

`joinGame` in `services/games.ts` finds the `LOBBY` Game by Invite code, checks
`game.players.length >= 2` in application code, then calls
`gamePlayer.create`. The check and the insert are separate statements with no
transaction and no constraint behind them.

Two Users submitting the same Invite code at the same moment both read one
Player, both pass the check, and both get a `GamePlayer` row. The Game now has
three Players. The only database guard is the `(gameId, userId)` primary key,
which stops the same User joining twice and nothing else.

### Severity

`@sev2`: the Game is broken with no workaround for the people in it, and the
blast radius is that one Game. It needs two strangers to hold the same Invite
code and submit within the same few milliseconds, so it is not `@sev1`.

### What the game-start ticket already covers

The game-start ticket
(`make-game-start-atomic-against-concurrent-join.md`) refuses to start a Game
that does not have exactly two Players. After it lands, a three-Player Game is
stuck in `LOBBY` forever rather than started with one Player holding no Secret
card. This ticket removes the cause.

### Acceptance

- Two simultaneous joins on one Invite code produce exactly one new
  `GamePlayer` row; the other call is refused the same way a full Game is today.
- The guarantee comes from the database (transaction with a lock, or a
  conditional write), not from a read followed by a write.
- A test races two `joinGame` calls with `Promise.all` against the Postgres test
  database.

### Related

Surfaced on 2026-11-13 during the design session for the game-start ticket.
