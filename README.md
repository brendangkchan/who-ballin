# Who Ballin

**Who Ballin** is a web application designed to help you quickly discover which NBA players are currently standing out—or struggling—based on a variety of performance factors. Track who's hot, who's not, and see real comparisons beyond basic stat lines.

## Features

- **See which NBA players are playing well or poorly**
- Compare individual performance to:
  - Season and career averages
  - Recent trends (last month, last 10 games)
  - Other players with similar position, role, and salary
- Insightful data to help spot breakouts, slumps, or underrated performers

## Use Cases

- Fans wanting to know which players are rising or falling in form
- Fantasy basketball players tracking streaks, value picks, and matchups
- Analysts and enthusiasts digging into player over/under performance

## How it Works

Who Ballin analyzes up-to-date NBA data, taking into account:
- Overall season and career stats
- Recent game logs (month, last 10 games)
- Similarity comparisons using player position, salary, and on-court role

## Get Started

Open the app and start exploring which NBA players are truly ballin right now!

## NPM Scripts

| Script | What it does | When to use it |
|--------|----------------|----------------|
| **`npm run dev`** | Starts the Next.js development server with hot reload. | Daily development. Run this to work on the app locally. |
| **`npm run build`** | Creates an optimized production build of the app. | Before deploying or running in production. |
| **`npm run start`** | Serves the production build (run after `npm run build`). | Local production-style testing or self-hosting. |
| **`npm run lint`** | Runs ESLint on the codebase. | Before committing or to catch style/quality issues. |
| **`npm run test`** | Runs the test suite once (Vitest). | Before committing or in CI. |
| **`npm run test:watch`** | Runs tests in watch mode; re-runs on file changes. | While developing to get immediate feedback. |
| **`npm run populate-reference`** | Fetches [NBA_Player_IDs.csv](https://github.com/djblechn-su/nba-player-team-ids) from GitHub, parses it, and overwrites `scripts/nba-name-to-id-reference.json` with `first_name`, `last_name`, and `nba_id` for headshot lookups. | When you want to refresh the list of players that can have NBA headshots (e.g. after adding a new data source). Optional: set `POPULATE_REFERENCE_SOURCE=./path/to/file.csv` to use a local CSV. |
| **`npm run build-map`** | Fetches all players from the Ball Don’t Lie API (with checkpoint/resume and rate limiting), matches them to the reference by name, and writes `src/lib/nba-player-id-map.json` (BDL id → NBA id) so the app can show headshots. Requires `BALLDONTLIE_API_KEY` in `.env.local`. | After changing the reference (e.g. after `populate-reference`) or when the map is missing/out of date. If rate-limited or interrupted, run again to resume. |

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
