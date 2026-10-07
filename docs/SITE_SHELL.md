# Site shell and branding

The lobby and all seven games use a 1760px maximum page width, including horizontal gutters of 36px on desktop, 22px below 720px and 17px below 420px. This follows EraShuffle. Puzzle boards, readable forms and dialogs may use smaller inner bounds.

`src/ui/SiteShell.tsx` supplies the home/logo link, lobby link, storage controls and slim footer. The home link uses Vite's `BASE_URL`, so it returns to this game when served under `/atlasmaster/`. Lobby navigation points to `https://spillarena.no/`. Settings sit in the right-hand header slot. The lobby uses that slot for account and settings controls.

`src/ui/arena.css` contains the width, gutters and common shell styles, followed by game-specific adjustments. The components are vendored from SpillArena so each repository builds independently. Keep the common component and CSS rules synchronized when changing the shell; retain each game's theme adjustments.

## Cookies and storage

Every site uses the shared `src/account/ConsentDialog.tsx`, `consent.ts` and the `cookie-consent` key on the same origin. Settings and the footer can reopen the dialog. An undecided or declined choice keeps new optional data in memory. Accepting flushes that data to browser storage; declining removes the game's declared optional keys and keeps the current visit usable. The consent choice itself is remembered. The choice applies to the lobby and all games served on `spillarena.no`.

Storage controls show the same accept, decline, status and manage actions in English and Norwegian. Each game still explains its own stored data in the dialog.

## Branding and link previews

Page titles describe the game, without author or lobby suffixes. Author metadata and footer credit identify Emil Berglund / EmilB04. Canonical, Open Graph, Twitter and structured-data URLs use the public game URL. Favicons, touch icons and manifests resolve under the game's base path.

The editable preview source is `public/og-image.svg`; export it as `public/og-image.png` at 1200 × 675 after changing the artwork. Game marks are SVG, with 180px touch icons and 512px install icons exported from the same artwork.

## Project details

The compass mark returns to AtlasMaster. Region breadcrumbs sit in the centre of the navigation bar. Menu back buttons sit above the category, mode, pace and leaderboard headings; an active round keeps its give-up control on the right of the navigation bar. On narrow screens the breadcrumbs use a centred second row so they remain readable beside compact controls. The player profile is available at the top of Settings. Map, category and leaderboard containers use the wide site bounds; small forms remain compact.

## Validation

Production build and consent/component rendering checks passed. The checks cover storage before a choice, acceptance, decline, both interface languages, home/lobby links and the shared width/gutter tokens. Link-preview PNGs and SVGs were inspected and their metadata dimensions checked.

Full lint passes.

Browser checks passed for centred Norwegian breadcrumbs from 320px to 1920px and complete 17-place ocean rounds on desktop and phone, including touch input. API responses were stubbed during these local gameplay checks.
