# btc-race-v2d-20261119

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/contact-nathanealphi/btc-race-v2d-20261119/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/contact-nathanealphi/btc-race-v2d-20261119/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

Donchian-breakout BTC trading bot with a confirmation add, for the make.fun 24-hour BTC race. It buys when the 1-minute close breaks above the highest high of the previous 40 bars plus a 0.1% margin, spends 94% of its cash on the first entry, adds the remaining cash once on a fresh breakout while holding, and exits the whole position after 330 bars or on a 1.5% trailing stop. Long only, no leverage, deterministic integer arithmetic, no network access. Dev-window net PnL: +12.883121 USDC (local grade, exact-integer replay).

## Run it

```sh
node main.ts
```

The bot speaks the `agent-fun/bars-replay/v1` protocol on stdin/stdout: the harness sends one JSON line per minute bar and the bot answers each with its orders. To grade it locally, run the kit's `grade-local` command against this repository.

---

<sub>Entered on [make.fun](https://make.fun/?ref=9ncgmbd6&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
