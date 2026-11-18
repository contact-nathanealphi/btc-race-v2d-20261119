// Donchian-breakout BTC bot with a confirmation add (pyramiding), long only.
//
// The bot reads the hello, then one batch per 1-minute bar of CBBTC, and answers
// each batch with its orders. Every decision uses only bars the harness has
// already sent: the close and high of the bar that just closed and the bars
// before it. Orders fill at the next bar's open, so an entry decided on a
// breakout close is filled one minute later.
//
// Rules, all in exact integer (bigint) arithmetic on the bar prices:
//
//   - Entry: the close breaks above the highest high of the 40 bars before it,
//     plus a 0.1% margin. The first buy spends 94% of the cash. No entry is
//     taken on a bar past bar index 1420 (the window holds 1440 bars).
//   - Confirmation add: while holding, if the close breaks above the same
//     40-bar high plus margin again, one add spends all remaining cash. At
//     most one add per position, and never on a bar the bot exits on.
//   - Exit: the whole position is sold once it has been held 330 bars
//     (counted from the bar the entry filled on), or sooner if the close
//     falls more than 1.5% below the highest close since the entry (a
//     trailing stop). A sell the market refuses is sent again on the next
//     bar while its reason still holds.
//   - Every order caps its slippage at 100 bps past the close it was decided
//     on. No network, no clock, no randomness: the same bars give the same
//     orders, run after run.
//
// vendor/makefun-bars.ts is a byte-identical copy of the kit's SDK shim.

import { BPS, runBars, type BarsState, type Batch, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Breakout lookback: the highest high of this many bars before the decision bar. */
const LOOKBACK_BARS = 40;
/** Entry margin over the breakout high, in basis points. */
const MARGIN_BPS = 10n;
/** Bars held before the time exit, counted from the bar the entry filled on. */
const HOLD_BARS = 330;
/** Trailing stop: exit when the close is this far below the peak close since entry. */
const TRAIL_BPS = 150n;
/** Share of the cash the first buy spends, in basis points. */
const ENTRY_FRAC_BPS = 9400n;
/** Last bar index (0-based, counting the bars seen) on which an entry may be decided. */
const LAST_ENTRY_BAR = 1420;
/** Slippage cap on every order, past the close it was decided on. */
const MAX_SLIPPAGE_BPS = 100;

/** Closes and highs of the CBBTC bars seen so far, in bar order. */
const closes: bigint[] = [];
const highs: bigint[] = [];
/** Bar index the current position's entry filled on, -1 while flat. */
let entryFillBar = -1;
/** Highest close since the entry filled. */
let peakClose = 0n;
/** Confirmation adds spent on the current position (at most one). */
let addsDone = 0;
/** Whether the previous batch already held the position. */
let wasHolding = false;

/** Highest high of the LOOKBACK_BARS bars before bar `i` (bar `i` excluded). */
function priorHigh(i: number): bigint {
  let highest = highs[i - LOOKBACK_BARS];
  for (let k = i - LOOKBACK_BARS + 1; k < i; k++) {
    if (highs[k] > highest) highest = highs[k];
  }
  return highest;
}

await runBars({
  onBatch(state: BarsState, batch: Batch) {
    for (const bar of batch.bars) {
      if (bar.symbol !== SYMBOL) continue;
      closes.push(BigInt(bar.c));
      highs.push(BigInt(bar.h));
    }
    const held = state.positions.get(SYMBOL);
    const barIndex = closes.length - 1;
    if (held !== undefined && !wasHolding && barIndex >= 0) {
      // The entry fill was reported on this batch: the position is new.
      entryFillBar = barIndex;
      peakClose = closes[barIndex];
      addsDone = 0;
    }
    if (held === undefined) {
      entryFillBar = -1;
      addsDone = 0;
    }
    wasHolding = held !== undefined;
    // No fresh bar, or still warming up: nothing to decide on.
    if (batch.bars.every((bar) => bar.symbol !== SYMBOL) || state.warmingUp) return [];
    const close = closes[barIndex];
    const minNotional = BigInt(state.hello.fees.min_notional_quote_units);
    const orders: (BuyInput | SellInput)[] = [];
    if (held !== undefined) {
      if (close > peakClose) peakClose = close;
      const heldBars = barIndex - entryFillBar + 1;
      const timeExit = heldBars >= HOLD_BARS;
      const trailExit = close * BPS < peakClose * (BPS - TRAIL_BPS);
      if (timeExit || trailExit) {
        orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
      } else if (
        addsDone === 0 &&
        barIndex >= LOOKBACK_BARS &&
        state.cash >= minNotional &&
        close * BPS > priorHigh(barIndex) * (BPS + MARGIN_BPS)
      ) {
        // One confirmation add: the same breakout test as the entry, decided
        // while holding, spends all remaining cash (never on an exit bar).
        orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS });
        addsDone = 1;
      }
    } else if (barIndex >= LOOKBACK_BARS && barIndex <= LAST_ENTRY_BAR) {
      if (close * BPS > priorHigh(barIndex) * (BPS + MARGIN_BPS)) {
        const notional = (state.cash * ENTRY_FRAC_BPS) / BPS;
        if (notional >= minNotional) {
          orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS });
        }
      }
    }
    return orders;
  },
});
