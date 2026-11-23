# A Gentle Rain — Official Game Rules Reference

This document is the authoritative rules specification for our TypeScript implementation of **A Gentle Rain**. All engine logic, bot interfaces, and boundary tests must conform to these rules.

---

## 1. Components

1. **8 Flower Colors**:
   - `red`, `orange`, `white`, `yellow`, `pink`, `blue`, `purple`, `black`
2. **8 Flower Tokens**:
   - Exactly **1** circular flower token of each of the 8 colors.
   - All 8 tokens start unplayed in the supply.
3. **28 Square Pond Tiles**:
   - Defined in [`pond-tiles.json`](./pond-tiles.json).
   - Each tile has **4 distinct colors**, one half-flower on each of its 4 edges (never a repeated color on the same tile).
   - Every tile has a unique cyclic ordering of its 4 edge colors (all 28 tiles are distinct up to 90° rotation).
   - Across the full 28-tile deck, each of the 8 colors appears on exactly 14 edges (`28 × 4 / 8 = 14`).
   - Physically, the four corners of each tile have quarter-circle cutouts so that when 4 tiles meet in a 2×2 square, their cutouts form a circular pond opening that holds 1 flower token.

### Tile JSON & Coordinate Conventions

- **JSON Edge Order**: Each entry `[c0, c1, c2, c3]` in [`pond-tiles.json`](./pond-tiles.json) lists edge colors **clockwise starting from the Left (West) edge**:
  - index `0` → **West** (Left)
  - index `1` → **North** (Top)
  - index `2` → **East** (Right)
  - index `3` → **South** (Bottom)
- **Tile Rotation**: A tile may be rotated in 90° clockwise steps `r ∈ {0, 1, 2, 3}`:
  - At rotation `r`, the edge facing direction `d ∈ {0: West, 1: North, 2: East, 3: South}` has color `edges[(d - r + 4) % 4]`.
- **Board Grid**: Unbounded 2D integer grid `(x, y)` where:
  - West is `(x - 1, y)`, North is `(x, y - 1)`, East is `(x + 1, y)`, South is `(x, y + 1)`.
- **2×2 Corner Intersection Coordinates**: Identified by `CornerCoord(cx, cy)`, representing the shared interior vertex of the 4 tiles:
  - NW: `(cx, cy)`
  - NE: `(cx + 1, cy)`
  - SW: `(cx, cy + 1)`
  - SE: `(cx + 1, cy + 1)`

---

## 2. Setup

1. Place all 8 flower tokens in the unplayed supply.
2. Shuffle all 28 pond tiles uniformly at random to form the face-down draw pile.
3. Draw the top tile from the draw pile and place it at `(0, 0)` with rotation `0`.
   - **27 tiles** remain in the draw pile.

---

## 3. Turn Structure

While the game has not ended, repeat the following steps:

### Step 1: Draw a Pond Tile
Draw the top pond tile from the draw pile.

### Step 2: Determine Valid Placements
A placement `(x, y, rotation)` is **valid** if and only if:
1. Grid cell `(x, y)` is currently empty.
2. At least one of the 4 orthogonally adjacent cells (`West`, `North`, `East`, `South`) already contains a placed tile.
3. For **every** orthogonally adjacent placed tile, the touching edge color of the drawn tile (at `rotation`) **matches** the touching edge color of the neighbor tile (completing a full flower across that edge).

### Step 3: Place or Discard
- **If at least one valid placement exists**: The player/bot chooses one valid `(x, y, rotation)` and places the tile on the board.
- **If NO valid placement exists** (for any empty frontier cell and any of the 4 rotations): The drawn tile is **discarded** out of play, and the turn ends.

### Step 4: Bloom Resolution (2×2 Intersections)
After placing a tile at `(x, y)`, inspect the up to 4 surrounding 2×2 corners:
`(x - 1, y - 1)`, `(x, y - 1)`, `(x - 1, y)`, `(x, y)`.

A corner `(cx, cy)` is **newly completed** if all 4 tiles `(cx, cy)`, `(cx + 1, cy)`, `(cx, cy + 1)`, `(cx + 1, cy + 1)` are now on the board.

For each newly completed corner `(cx, cy)`:
- Identify the **adjacent flower colors** formed along the 4 interior seams meeting at that corner:
  1. Top seam: `tile(cx, cy).East` (= `tile(cx + 1, cy).West`)
  2. Right seam: `tile(cx + 1, cy).South` (= `tile(cx + 1, cy + 1).North`)
  3. Bottom seam: `tile(cx, cy + 1).East` (= `tile(cx + 1, cy + 1).West`)
  4. Left seam: `tile(cx, cy).South` (= `tile(cx, cy + 1).North`)
  - *(Note: two opposite seams may share a color, so there are 2 to 4 distinct colors touching a corner.)*
- **Eligible tokens**: The subset of those adjacent colors whose flower token is still unplayed in the supply.
- **Placing tokens**:
  - If 1 or more eligible tokens exist, place **1** eligible flower token at corner `(cx, cy)` and remove that color from the unplayed supply. (If multiple eligible colors exist, the player/bot chooses which one.)
  - If **0** eligible tokens remain (all adjacent flower colors were already placed earlier), no flower token can be placed at that corner; it remains empty.
  - **Simultaneous completions**: If a single tile placement completes 2 (or up to 4) corners simultaneously, the player/bot places a flower token in **each** newly completed corner that can receive a distinct eligible unplayed token. Because two newly completed corners may share an eligible color, the player/bot chooses the joint assignment across all newly completed corners; the engine enforces maximality so that no newly completed corner is left unbloomed while an eligible unplayed color for that corner remains unused.

---

## 4. End of Game & Scoring

### End Conditions
The game ends **immediately** as soon as either condition holds:
1. **Victory (All 8 Blossoms Placed)**: All 8 flower tokens have been placed on the board. *(Remaining tiles in the draw pile are not drawn.)*
2. **Deck Exhausted**: The draw pile has 0 tiles remaining after the current drawn tile has been placed (and any resulting blooms resolved) or discarded.

### Final Score
$$\text{Score} = (\text{Number of Flower Tokens Placed}) + (\text{Number of Unplayed Tiles Remaining in the Draw Pile})$$

- **Win (`placedFlowers === 8`)**: Score is `8 + remainingDrawPileCount` (minimum `8`, theoretical maximum `8 + (28 - 14) = 22` or higher depending on compact 8-bloom geometry).
- **Loss (`placedFlowers < 8`)**: Draw pile is empty (`0` unplayed tiles), so score is `placedFlowers` (`0` to `7`).
- **Discarded tiles** were already drawn and therefore do **not** count as unplayed tiles.

---

## 5. Information Rules for Bots

To reflect a fair human player (including perfect memory / card counting):
- A bot **MAY** inspect:
  - All placed tiles, their positions/rotations, and all placed flower tokens.
  - The current drawn tile and its pre-computed valid placements.
  - All unplayed flower token colors.
  - The count of remaining tiles in the draw pile.
  - The list of discarded tiles and the set of remaining unseen tiles (computed from the known 28-tile deck minus placed, current, and discarded tiles).
- A bot **MUST NOT** inspect the hidden draw order of the remaining draw pile.
