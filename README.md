# SOLARA AI — by ARIO WEB3

**ILLUMINATE THE MARKET. INTELLIGENCE IN MOTION.**

A responsive, GitHub Pages-compatible educational crypto market dashboard. It includes public market data, OHLC candlesticks, volume when available, a Three.js network background, technical indicators, pivot-based support/resistance estimates, historical strategy simulations, a local paper portfolio, and an optional server-side AI endpoint.

## Included

- CoinGecko public market ticker and OHLC history.
- Candlestick chart, SMA(20), and volume histogram when volume observations are available.
- RSI(14), MACD(12,26,9), SMA(20), and simple realized-return volatility estimate.
- Swing-pivot support/resistance clustering.
- SMA crossover, RSI mean-reversion, and buy-and-hold educational backtest with fee/slippage assumptions.
- Virtual portfolio stored in the browser's local storage.
- Three.js animated network background with reduced-motion CSS support.
- Rules-based assistant by default, with optional server-side model endpoint.
- Mobile-friendly layout and GitHub Pages support.

## Publish on GitHub Pages (Android or desktop)

1. Download/extract this project folder.
2. Create a new GitHub repository named `solara-ai` under `arioweb3`. Do not overwrite NEXORA AI or CHAINPULSE.
3. Upload the files in this folder to the root of `solara-ai`.
4. In the repository, open **Settings → Pages**.
5. Choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then Save.
6. After GitHub finishes deploying, open `https://arioweb3.github.io/solara-ai/`.

## Optional real model integration (server-side only)

GitHub Pages is static and cannot safely store an AI API key. This repo includes a Cloudflare Worker template in `worker/`.

1. Create a Cloudflare Worker and paste the contents of `worker/index.js`.
2. Configure secrets/environment variables in the Worker dashboard:
   - `AI_API_KEY`: provider API key, stored as a secret.
   - `AI_API_URL`: compatible chat-completions endpoint.
   - `AI_MODEL`: model name supported by that endpoint.
   - `ALLOWED_ORIGIN`: deployed GitHub Pages origin, e.g. `https://arioweb3.github.io`.
3. Deploy the Worker and copy its HTTPS URL.
4. In `index.html`, add the following before `app.js`:
   ```html
   <script>window.SOLARA_AI_ENDPOINT = "https://YOUR-WORKER-URL";</script>
   ```
5. Use provider account controls and rate limits. Never commit a key to GitHub or put one in browser JavaScript.

The assistant sends the question and a small technical snapshot to the Worker. The Worker does not place orders.

## Data and reliability notes

- Market data is fetched from CoinGecko's public API. Public endpoints may rate-limit or change; a failed request is shown in the interface.
- CoinGecko's OHLC endpoint does not itself include volume. The app attempts to align market-chart total-volume observations to the candle times; if that data is unavailable, the volume pane may be empty.
- Technical indicators and pivot levels are educational estimates, not trading signals or guarantees.
- Backtest results are sensitive to the available time window, fees, slippage, and assumptions. This simple simulation is not a substitute for rigorous testing and does not model every real-world execution issue.

## Real trading

This project intentionally does **not** connect to exchanges, wallets, or live order endpoints. A static website should never hold exchange credentials. The included paper desk is a local educational simulation only.

## License

MIT — see `LICENSE`.
