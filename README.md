# MUSEGOD Agent Studio

A wallet-connected studio for discovering MUSEGOD NFTs and using each NFT's onchain soul as an AI agent prompt. This is an independent companion site; collection ownership, art, soul, and prompt come from the [official MUSEGOD API](https://musegod.org/docs).

## Run locally

1. Install Node.js 20.19+.
2. Run `npm install`.
3. Create `.env.local` from `.env.example`.
4. Create a Privy app at [dashboard.privy.io](https://dashboard.privy.io), enable **Wallet** login, and add `http://localhost:5173` and your production domain to its allowed origins.
5. Put the **public App ID** in `.env.local` as `VITE_PRIVY_APP_ID=...`. Never put the Privy App Secret in a `VITE_` variable.
6. Run `npm run dev`.

The app displays a setup notice when the App ID is absent. The App ID is required for live wallet connection; it is intentionally not committed.

## How wallet verification works

Privy wallet login authenticates the user. The studio then asks for a second, explicit `personal_sign` signature with a random nonce, timestamp, wallet address, and site origin. `viem` checks ordinary wallet signatures locally and falls back to Robinhood Chain verification for smart wallets. No transaction, approval, delegation, or gas is involved. Verification state lives only in the current page session. Private APIs verify the Privy access token, linked wallet, and current onchain NFT owner on the server; the local signature alone does not grant private access.

The selected wallet's Muses are read from `GET https://musegod.org/api/v1/muses?owner=...`, with pagination. Detail views use `GET /api/v1/muses/{id}` and the official `/muse/{id}.txt` adoption prompt. The UI distinguishes an empty collection from an API error. Ownership can be delayed by the official API's roughly one-minute cache. Agent missions, working styles, and private notes are stored in this browser's `localStorage`, keyed by wallet and muse ID; they do not sync across devices or update the NFT.

## Use an NFT as an agent

1. Connect and verify the wallet holding a MUSEGOD NFT.
2. Open **My muses** and choose a character.
3. Read its onchain soul and traits.
4. Press **Copy agent prompt** and paste it as the opening instruction in ChatGPT, Claude, or a compatible agent tool.
5. Set a mission and working style in the Agent Workspace, save it, then use **Copy with mission** to combine your task with the official prompt. For a programmatic agent, use the public `/muse/<id>.txt` prompt or `/muse/<id>.json` registration file documented by MUSEGOD.

Copying a prompt gives the AI a character. It does not grant access to the NFT, wallet, or private keys. The official [MUSEGOD agents guide](https://musegod.org/docs) explains ERC-8004 identity and its onchain SOUL.md record.

## Build and checks

`npm run build` produces a static `dist/` directory suitable for Vercel, Netlify, or other static hosts. Set `VITE_PRIVY_APP_ID` in the host's build environment and add the deployed origin to the Privy dashboard. `npm test` runs logic tests.

## Source and scope

- Official collection and agent API: <https://musegod.org/docs>
- Privy wallet authentication: <https://docs.privy.io/authentication/user-authentication/login-methods/wallet>
- Privy message signing: <https://docs.privy.io/wallets/using-wallets/ethereum/sign-a-message>

This project never asks for a seed phrase or private key and does not execute NFT or token transactions.

## New pages

- `/utilize` is the owner guide: connect and verify, read a muse's soul, copy its adoption prompt, reuse it in an AI tool, and follow the official Flock, Musebook, or Terrakin setup.
- `/musegod` summarizes the token, NFT collection, and weekly muse pot. It fetches market, drop, collectors, offering, burns, pot, and sales figures directly from the public official API when opened. The Refresh button updates all sources; missing endpoint data is marked `N/D` rather than estimated.

The Musegod page also shows the USD equivalent of all tokens burned at the latest available token price, the 5% NFT creator-royalty route, and the official burn and sale feeds. It refreshes those two feeds every minute while the tab is visible. The burn API caches about 15 seconds; the OpenSea-backed sales source reads at most once per minute. A sale does not prove its royalty was paid, so the feed does not attribute a specific burn or pot deposit to a specific sale. The USD equivalent is **not** historical USD spent on burns.

The navigation uses browser history, so these pages support direct links and Back/Forward. `vercel.json` maps those paths to the static application entry point. Contract addresses and program descriptions come from the [official documentation](https://musegod.org/docs); changing market figures come from the [official market endpoint](https://musegod.org/api/v1/market). The independent site does not submit token or NFT transactions.

## Intelligence Studio

The new routes are `/intelligence`, `/agent-identity`, `/agent/<museId>`, and `/developer`. The existing `/musegod` page now has Overview, Token & burns, NFT intelligence, Weekly pot, and Flock tabs. Market and NFT charts use only records returned by the official sources. The NFT tab loads the official 999-Muse collection on demand for tier counts, owner concentration, and name/ID search. Flock is read through a small server proxy because its API does not permit browser CORS; the proxy removes unneeded fields such as join material. Firework (#242) is the default research personality; its soul is loaded from the official Muse API. The token market adapter uses [DexScreener token-pairs](https://docs.dexscreener.com/api/reference) for Ethereum, Base, Avalanche, and Solana. On Robinhood Chain, the official `$MUSEGOD` contract uses the official aggregate market API; pool address and liquidity remain N/A because that source does not provide them. Other Robinhood Chain tokens and Hyperliquid display an explicit unsupported market-data status until verified adapters are added. Missing holder, security, smart-money, cluster, and historical data is marked unavailable.

Public data and agent profiles work without signing in. Private watchlists, settings, reports, and AI research require a Privy session and current Muse ownership checked by the server through Robinhood Chain's `ownerOf` contract call. The official API supplies Muse metadata and soul; onchain ownership takes precedence if its cache lags a transfer. If RPC fails, private access pauses rather than using a stale owner. Private data is keyed by the Privy user ID; buying the NFT does not transfer a previous owner's notes or reports. The original My Muses browser-local workspace remains available.

### Vercel configuration

Set these in **Vercel Project → Settings → Environment Variables** for Production and Preview as needed, then redeploy:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_PRIVY_APP_ID` | Build and server | Public Privy app ID; already used for wallet login. |
| `PRIVY_APP_SECRET` | Server only | Privy user lookup and access-token verification. |
| `OPENAI_API_KEY` | Server only | AI research. |
| `OPENAI_MODEL` | Server only | A model enabled on your OpenAI account that supports Responses structured outputs. |
| `FIREBASE_PROJECT_ID` | Server only | Firestore project ID. |
| `FIREBASE_CLIENT_EMAIL` | Server only | Firebase service account email. |
| `FIREBASE_PRIVATE_KEY` | Server only | Firebase service account private key. Paste the multiline value into Vercel or use literal `\n` separators. |

The backend is in `api/intelligence/` and uses Node.js Vercel Functions. Never prefix server secrets with `VITE_`, commit real values, or expose them in the browser. Add the deployed domain and localhost to Privy's allowed origins. The app presents setup errors for missing OpenAI or Firebase credentials; public analytics remains usable.

For local full-stack development use `vercel dev` after linking the project and providing local environment variables. Plain `npm run dev` serves the Vite frontend only, so `/api/intelligence/*` is available on Vercel but not on the Vite dev server by itself.

### Firebase setup

1. Create a Firebase project and Firestore database in **Native mode**. Choose a region close to the Vercel Functions region you will use.
2. In Firebase **Project settings → Service accounts**, generate a service account key and place its project ID, client email, and private key into the three Vercel variables above. Keep the JSON file out of Git.
3. Install the Firebase CLI, sign in, then run `firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID` from this repository. `firebase.json` points to the supplied indexes and deny-all browser rules. The watchlist query uses `ownerId` + `museId`; report history additionally sorts by `createdAt` descending.
4. Keep direct browser access to private collections denied. Firebase Admin runs only in Vercel Functions and bypasses these Firestore rules after the function has verified the Privy user and current NFT owner.

The server creates `agentConfigurations`, `watchlistItems`, `researchReports`, `researchRuns`, and `researchQuotas` on first use. The quota is five research runs per Privy user per UTC day and at least 60 seconds between runs. The research endpoint validates the input, selects one liquidity pool, loads the official soul, uses structured OpenAI output, checks cited URLs against supplied sources, and persists the report. Run results can be exported as Markdown or printed to PDF. Failed provider, authentication, or setup states do not silently generate invented analysis.

Schedules can be requested in settings but **do not run automatically**. No Cron endpoint is deployed yet. Watchlist thresholds can be checked on the Intelligence page, with triggered alerts shown there; background monitoring and notifications are not active. The site does not trade, post to X, submit Flock answers, claim pot rewards, or hold wallet private keys.
