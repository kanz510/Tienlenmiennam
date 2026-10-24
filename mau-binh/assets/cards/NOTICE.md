# Card artwork — source and license

The 53 SVG files in this directory are the card artwork used by the
Mau Binh standalone game (`mau-binh/index.html`).

## Source

- Project: OpenDecks — public-domain / CC0 playing cards
- Repository: https://github.com/hhonbo/OpenDecks-Public-Domain-and-CC0-Playing-Cards
- Upstream credits (per that project's README): court cards and the ornate
  Ace of Spades from vector-playing-cards (public domain); suit pips from
  Singularity Deck Pips (CC0); rank letters/numbers from Complete Guyenne
  Deck (CC0); card backs from Playing Cards Back Vector SVG (CC0).

## License

All assets are **public domain / CC0 1.0 Universal**. They may be used,
copied, modified, merged, published, distributed and sold for commercial
or non-commercial purposes, without permission and without attribution
(credit is appreciated but not legally required). The full CC0 legal text
is in `LICENSE-CC0.txt` next to this file.

Note: "OpenDecks" is a trademarked name belonging to that project. This
game only bundles the artwork files; it does not use the OpenDecks name
as its own brand.

## What is bundled here

- 52 card faces: 13 ranks (ace, 2–10, jack, queen, king) × 4 suits
  (spades, clubs, diamonds, hearts).
- 1 card back: the blue back (`back_blue.svg`).
- Total: 53 files. Jokers, the red back and PNG versions from upstream
  are NOT bundled (the game does not use them).

## File naming

Upstream files are named like `ace of spades.svg` (with spaces). They are
bundled here byte-for-byte identical, only renamed to snake_case
(`ace_of_spades.svg`) so the game can reference them with plain relative
URLs that work on GitHub Pages without percent-encoding. Content was not
modified, recolored or recompressed.

## Mapping used by the game

- `cardAssetUrl(id)` → `assets/cards/<rank>_of_<suit>.svg`
  (rank: ace, 2–10, jack, queen, king; suit: spades, clubs, diamonds, hearts)
- `cardBackAssetUrl` → `assets/cards/back_blue.svg`
