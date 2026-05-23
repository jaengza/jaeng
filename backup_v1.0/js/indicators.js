/* ==========================================================================
   kesineTrader Pro — Technical Indicator Calculations
   All computed client-side from raw OHLCV data
   ========================================================================== */

const Indicators = {

  /* ── EMA (Exponential Moving Average) ───────────────────────────────────── */
  ema(values, period) {
    if (!values || values.length < period) return null;
    const k = 2 / (period + 1);
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
    }
    return ema;
  },

  emaArray(values, period) {
    if (!values || values.length < period) return [];
    const k = 2 / (period + 1);
    const result = [];
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    result.push(ema);
    for (let i = period; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
      result.push(ema);
    }
    return result;
  },

  /* ── RSI (Relative Strength Index, 14-period) ───────────────────────────── */
  rsi(closes, period = 14) {
    if (!closes || closes.length < period + 2) return null;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      avgGain = (avgGain * (period - 1) + Math.max(0, diff)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(0, -diff)) / period;
    }
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
  },

  rsiSignal(rsi) {
    if (rsi === null) return { label: 'N/A', type: 'neut' };
    if (rsi < 25)  return { label: 'Oversold (BUY)', type: 'bull' };
    if (rsi < 40)  return { label: 'ย่อตัว (Weak Sell)', type: 'bull' };
    if (rsi < 55)  return { label: 'Neutral', type: 'neut' };
    if (rsi < 70)  return { label: 'ดีดตัว (Weak Buy)', type: 'bear' };
    return { label: 'Overbought (SELL)', type: 'bear' };
  },

  /* ── MACD (12/26/9) ─────────────────────────────────────────────────────── */
  macd(closes, fast = 12, slow = 26, signal = 9) {
    if (!closes || closes.length < slow + signal + 5) return null;
    const ema12 = this.emaArray(closes, fast);
    const ema26 = this.emaArray(closes, slow);
    const offset = ema12.length - ema26.length;
    const macdLine = ema26.map((v, i) => ema12[i + offset] - v);
    const signalLine = this.emaArray(macdLine, signal);
    const offset2 = macdLine.length - signalLine.length;
    const histogram = signalLine.map((s, i) => macdLine[i + offset2] - s);
    const last = histogram.length - 1;
    const prev = histogram.length - 2;
    return {
      macd:      macdLine[macdLine.length - 1],
      signal:    signalLine[signalLine.length - 1],
      histogram: histogram[last],
      prevHist:  histogram[prev],
      trend:     histogram[last] > histogram[prev] ? 'bull' : 'bear',
      cross:     (macdLine[macdLine.length - 2] < signalLine[signalLine.length - 2] &&
                  macdLine[macdLine.length - 1] >= signalLine[signalLine.length - 1]) ? 'golden'
               : (macdLine[macdLine.length - 2] > signalLine[signalLine.length - 2] &&
                  macdLine[macdLine.length - 1] <= signalLine[signalLine.length - 1]) ? 'death'
               : 'none',
      histBars:  histogram.slice(-12)
    };
  },

  /* ── ATR (Average True Range) ───────────────────────────────────────────── */
  atr(highs, lows, closes, period = 14) {
    if (!highs || highs.length < period + 1) return null;
    const trs = [];
    for (let i = 1; i < highs.length; i++) {
      trs.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i]  - closes[i - 1])
      ));
    }
    return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  },

  /* ── Auto Swing High/Low (Major Dealing Range for SMC) ──────── */
  swingPoints(highs, lows, lookback = 100) {
    const n = highs.length;
    // We want the major dealing range over the lookback period
    const actualLookback = Math.min(lookback, n);
    const hSlice = highs.slice(-actualLookback);
    const lSlice = lows.slice(-actualLookback);

    const swingHigh = Math.max(...hSlice);
    const swingLow  = Math.min(...lSlice);

    // Find the bar index (relative to the whole array)
    const highBar = n - actualLookback + hSlice.indexOf(swingHigh);
    const lowBar  = n - actualLookback + lSlice.indexOf(swingLow);

    return {
      swingHigh,
      swingLow,
      highBar,
      lowBar
    };
  },

  /* ── Directional Fibonacci Retracement Levels ──────────────────────────── */
  fibonacci(swingHigh, swingLow, isBuy = true) {
    const rng = swingHigh - swingLow;
    if (isBuy) {
      // Bullish Trend (Discount Market): Measure retracement from High down to Low.
      // 0% is at Swing High, 100% is at Swing Low. OTE (70.5%) lies in the Discount Area.
      return [
        { pct: 0,     label: '0%',    price: swingHigh,              isOte: false },
        { pct: 23.6,  label: '23.6%', price: swingHigh - 0.236 * rng,  isOte: false },
        { pct: 38.2,  label: '38.2%', price: swingHigh - 0.382 * rng,  isOte: false },
        { pct: 50,    label: '50%',   price: swingHigh - 0.500 * rng,  isOte: false },
        { pct: 61.8,  label: '61.8%', price: swingHigh - 0.618 * rng,  isOte: false },
        { pct: 70.5,  label: '70.5%', price: swingHigh - 0.705 * rng,  isOte: true  }, // OTE
        { pct: 78.6,  label: '78.6%', price: swingHigh - 0.786 * rng,  isOte: false },
        { pct: 100,   label: '100%',  price: swingLow,               isOte: false }
      ];
    } else {
      // Bearish Trend (Premium Market): Measure retracement from Low up to High.
      // 0% is at Swing Low, 100% is at Swing High. OTE (70.5%) lies in the Premium Area.
      return [
        { pct: 0,     label: '0%',    price: swingLow,               isOte: false },
        { pct: 23.6,  label: '23.6%', price: swingLow + 0.236 * rng,   isOte: false },
        { pct: 38.2,  label: '38.2%', price: swingLow + 0.382 * rng,   isOte: false },
        { pct: 50,    label: '50%',   price: swingLow + 0.500 * rng,   isOte: false },
        { pct: 61.8,  label: '61.8%', price: swingLow + 0.618 * rng,   isOte: false },
        { pct: 70.5,  label: '70.5%', price: swingLow + 0.705 * rng,   isOte: true  }, // OTE
        { pct: 78.6,  label: '78.6%', price: swingLow + 0.786 * rng,   isOte: false },
        { pct: 100,   label: '100%',  price: swingHigh,              isOte: false }
      ];
    }
  },

  /* ── Pivot Points (Standard) ────────────────────────────────────────────── */
  pivots(high, low, close) {
    const pp = (high + low + close) / 3;
    return {
      r3: high + 2*(pp - low),
      r2: pp + (high - low),
      r1: 2*pp - low,
      pp,
      s1: 2*pp - high,
      s2: pp - (high - low),
      s3: low - 2*(high - pp)
    };
  },

  /* ── ICT: Order Block Detection ─────────────────────────────────────────── */
  orderBlock(candles, direction) {
    if (!candles || candles.length < 5) return null;
    const n = candles.length;
    // Increased lookback from 30 to 200 to capture deeper historical Order Blocks
    const lookback = Math.min(200, n - 2);

    if (direction === 'BUY') {
      // Last bearish candle before a strong bullish impulse
      for (let i = n - 3; i >= n - lookback; i--) {
        const c  = candles[i];
        const c1 = candles[i + 1];
        const isBearish    = c.close < c.open;
        const nextBullish  = c1.close > c1.open;
        const strongMove   = (c1.close - c1.open) > (c.open - c.close) * 0.5;
        if (isBearish && nextBullish && strongMove) {
          return { high: c.high, low: c.low, mid: (c.high + c.low) / 2, type: 'bullish_ob', barIdx: i };
        }
      }
    } else {
      // Last bullish candle before a strong bearish impulse
      for (let i = n - 3; i >= n - lookback; i--) {
        const c  = candles[i];
        const c1 = candles[i + 1];
        const isBullish    = c.close > c.open;
        const nextBearish  = c1.close < c1.open;
        const strongMove   = (c1.open - c1.close) > (c.close - c.open) * 0.5;
        if (isBullish && nextBearish && strongMove) {
          return { high: c.high, low: c.low, mid: (c.high + c.low) / 2, type: 'bearish_ob', barIdx: i };
        }
      }
    }
    return null;
  },

  /* ── ICT: Fair Value Gap (FVG) ──────────────────────────────────────────── */
  fairValueGaps(candles, lookback = 50) {
    const fvgs = [];
    const start = Math.max(2, candles.length - lookback);
    for (let i = start; i < candles.length; i++) {
      const c1 = candles[i - 2];
      const c3 = candles[i];
      // 0.01% tolerance to account for Yahoo Finance / MT5 Broker discrepancies
      const tolerance = c1.close * 0.0001; 
      
      // Bullish FVG: gap between c1.high and c3.low (with tolerance for slight overlaps)
      if (c3.low > c1.high - tolerance) {
        fvgs.push({ top: c3.low, bottom: c1.high, type: 'bullish', barIdx: i });
      }
      // Bearish FVG: gap between c1.low and c3.high (with tolerance)
      if (c3.high < c1.low + tolerance) {
        fvgs.push({ top: c1.low, bottom: c3.high, type: 'bearish', barIdx: i });
      }
    }
    return fvgs.slice(-3);
  },

  /* ── EMA Trend (20/50/200) ──────────────────────────────────────────────── */
  emaTrend(closes) {
    const ema20  = this.ema(closes, 20);
    const ema50  = this.ema(closes, 50);
    const ema200 = this.ema(closes, 200);
    
    let trend = 'neut';
    let score = 0;
    const last = closes[closes.length - 1];

    if (ema20 && ema50 && ema200) {
      if (last > ema20 && ema20 > ema50 && ema50 > ema200) {
        trend = 'bull';
        score = 2; // Perfect Uptrend alignment
      } else if (last < ema20 && ema20 < ema50 && ema50 < ema200) {
        trend = 'bear';
        score = -2; // Perfect Downtrend alignment
      } else if (last > ema20 && ema20 > ema50) {
        trend = 'bull';
        score = 1; // Short-term Uptrend
      } else if (last < ema20 && ema20 < ema50) {
        trend = 'bear';
        score = -1; // Short-term Downtrend
      }
    } else if (ema20 && ema50) {
      // Fallback if we don't have enough data for 200 EMA
      if (last > ema20 && ema20 > ema50) {
        trend = 'bull';
        score = 1;
      } else if (last < ema20 && ema20 < ema50) {
        trend = 'bear';
        score = -1;
      }
    }

    return {
      ema20, ema50, ema200,
      trend,
      score
    };
  },

  /* ── Composite Signal Score ─────────────────────────────────────────────── */
  signalScore({ rsi, macd, emaTrend }, threshold = 2.0) {
    let score = 0;
    let reasons = [];

    // RSI
    if (rsi !== null) {
      if (rsi < 35) { score += 2; reasons.push('RSI Oversold (+2)'); }
      else if (rsi < 45) { score += 1; reasons.push('RSI Weak (+1)'); }
      else if (rsi > 65) { score -= 2; reasons.push('RSI Overbought (-2)'); }
      else if (rsi > 55) { score -= 1; reasons.push('RSI Strong (-1)'); }
    }

    // MACD
    if (macd) {
      if (macd.cross === 'golden') { score += 3; reasons.push('MACD Golden Cross (+3)'); }
      else if (macd.cross === 'death') { score -= 3; reasons.push('MACD Death Cross (-3)'); }
      else if (macd.trend === 'bull') { score += 1; reasons.push('MACD Rising (+1)'); }
      else if (macd.trend === 'bear') { score -= 1; reasons.push('MACD Falling (-1)'); }
      if (macd.histogram > 0) score += 0.5;
      else score -= 0.5;
    }

    // EMA Trend
    if (emaTrend) {
      score += emaTrend.score;
      if (emaTrend.trend === 'bull') reasons.push(`Above EMAs (+${emaTrend.score})`);
      else if (emaTrend.trend === 'bear') reasons.push(`Below EMAs (${emaTrend.score})`);
    }

    const direction = score >= threshold ? 'BUY' : score <= -threshold ? 'SELL' : 'NEUTRAL';
    const strength  = Math.min(10, Math.abs(score));
    const type      = score >= threshold ? 'bull' : score <= -threshold ? 'bear' : 'neut';

    return { score: parseFloat(score.toFixed(1)), direction, strength, type, reasons };
  }
};
