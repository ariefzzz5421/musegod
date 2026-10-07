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

Privy wallet login authenticates the user. The studio then asks for a second, explicit `personal_sign` signature with a random nonce, timestamp, wallet address, and site origin. `viem` checks ordinary wallet signatures locally and falls back to Robinhood Chain verification for smart wallets. No transaction, approval, delegation, or gas is involved. Verification state lives only in the current page session. The app does **not** use this local check as server authorization; if private APIs or persistent cloud profiles are added, verify Privy access tokens and wallet identity on the server.

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
