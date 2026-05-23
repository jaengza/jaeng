const fs = require('fs');
const path = require('path');

// Load Indicators module from main codebase
let indicatorsCode = fs.readFileSync(path.join(__dirname, '../js/indicators.js'), 'utf8');
// Evaluate the indicators block and expose the Indicators object
const Indicators = eval(indicatorsCode + '; Indicators;');

/**
 * Runs a standalone high-performance backtest simulation for a given parameter set
 * @param {Array} candles - Array of candle data
 * @param {Object} params - Optimizer sweep parameters
 */
function runSimulation(candles, params) {
  const {
    asset,
    tf,
    threshold,
    fiboLevel,
    atrMultiplier,
    capital = 50.00,
    riskPct = 5.0,
    acctType = 'standard'
  } = params;

  // Find start index for the simulation (last 7 days of the dataset to keep it focused and fast)
  const lastCandle = candles[candles.length - 1];
  const endTime = lastCandle.time;
  const startTime = endTime - 7 * 24 * 60 * 60 * 1000; // 7 days in ms

  let startIndex = -1;
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].time >= startTime) {
      startIndex = i;
      break;
    }
  }
  if (startIndex === -1) {
    startIndex = Math.max(30, candles.length - 2016); // Fallback: last 2016 M5 candles (~7 days)
  }

  let balance = capital;
  const initialCapital = capital;
  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let activeTrade = null;
  let pendingOrder = null;
  let peakBalance = balance;
  let maxDrawdown = 0;
  const tradeLog = [];

  // Point Multipliers & Contract values
  let multiplier = 10;
  if (asset === 'XAUUSD') multiplier = 100;
  else if (asset === 'BTCUSD' || asset === 'ETHUSD') multiplier = 1;

  // Spread and Commission details (Exness Standard Account)
  let spreadVal = 10;
  let spreadMult = 1.0;

  if (acctType === 'zero') {
    if (asset === 'XAUUSD') {
      spreadVal = 7;
      spreadMult = 1.0;
    } else {
      spreadVal = 70; // $0.007 equivalent per 0.01 lot for crypto
      spreadMult = 0.01;
    }
  } else {
    // Standard Exness Account
    if (asset === 'XAUUSD') {
      spreadVal = 25; // 25 Points ($0.25 per 0.01 lot)
      spreadMult = 1.0;
    } else if (asset === 'BTCUSD') {
      spreadVal = 2150; // $0.215 per 0.01 lot
      spreadMult = 0.01;
    } else if (asset === 'ETHUSD') {
      spreadVal = 160; // $0.016 per 0.01 lot
      spreadMult = 0.01;
    }
  }

  const spreadCostPerLot = spreadVal * spreadMult;

  // Simulation Loop
  for (let i = startIndex; i < candles.length; i++) {
    const currentCandle = candles[i];

    // 1. Process active trade
    if (activeTrade) {
      let resolved = false;
      let exitPrice = 0;
      let pnl = 0;
      let result = '';

      if (activeTrade.dir === 'BUY') {
        if (currentCandle.low <= activeTrade.sl) {
          exitPrice = activeTrade.sl;
          pnl = (exitPrice - activeTrade.entry) * multiplier * activeTrade.lot;
          result = 'LOSS';
          resolved = true;
        } else if (currentCandle.high >= activeTrade.tp) {
          exitPrice = activeTrade.tp;
          pnl = (exitPrice - activeTrade.entry) * multiplier * activeTrade.lot;
          result = 'WIN';
          resolved = true;
        }
      } else if (activeTrade.dir === 'SELL') {
        if (currentCandle.high >= activeTrade.sl) {
          exitPrice = activeTrade.sl;
          pnl = (activeTrade.entry - exitPrice) * multiplier * activeTrade.lot;
          result = 'LOSS';
          resolved = true;
        } else if (currentCandle.low <= activeTrade.tp) {
          exitPrice = activeTrade.tp;
          pnl = (activeTrade.entry - exitPrice) * multiplier * activeTrade.lot;
          result = 'WIN';
          resolved = true;
        }
      }

      if (resolved) {
        const spreadCost = spreadCostPerLot * activeTrade.lot;
        const netPnL = pnl - spreadCost;
        balance += netPnL;

        if (result === 'WIN') winningTrades++;
        else losingTrades++;

        tradeLog.push({
          id: ++totalTrades,
          dir: activeTrade.dir,
          entry: activeTrade.entry,
          sl: activeTrade.sl,
          tp: activeTrade.tp,
          exit: exitPrice,
          lot: activeTrade.lot,
          result: result,
          rawPnL: pnl,
          spreadCost: spreadCost,
          netPnL: netPnL,
          entryTimeStr: activeTrade.entryTimeStr,
          exitTimeStr: currentCandle.timeStr
        });

        activeTrade = null;

        if (balance <= 0) {
          balance = 0;
          maxDrawdown = 100;
          break;
        }
      }

      if (balance > peakBalance) peakBalance = balance;
      const dd = ((peakBalance - balance) / peakBalance) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;

      continue; // Skip scanning since we had an active trade
    }

    // 2. Process pending order trigger
    if (pendingOrder) {
      let triggered = false;
      if (pendingOrder.dir === 'BUY') {
        if (currentCandle.low <= pendingOrder.entry && currentCandle.high >= pendingOrder.entry) {
          triggered = true;
        }
      } else if (pendingOrder.dir === 'SELL') {
        if (currentCandle.high >= pendingOrder.entry && currentCandle.low <= pendingOrder.entry) {
          triggered = true;
        }
      }

      if (triggered) {
        activeTrade = {
          dir: pendingOrder.dir,
          entry: pendingOrder.entry,
          sl: pendingOrder.sl,
          tp: pendingOrder.tp,
          lot: pendingOrder.lot,
          entryTimeStr: currentCandle.timeStr
        };
        pendingOrder = null;

        // Check if trade resolves inside the trigger candle
        let resolved = false;
        let exitPrice = 0;
        let pnl = 0;
        let result = '';

        if (activeTrade.dir === 'BUY') {
          if (currentCandle.low <= activeTrade.sl) {
            exitPrice = activeTrade.sl;
            pnl = (exitPrice - activeTrade.entry) * multiplier * activeTrade.lot;
            result = 'LOSS';
            resolved = true;
          } else if (currentCandle.high >= activeTrade.tp) {
            exitPrice = activeTrade.tp;
            pnl = (exitPrice - activeTrade.entry) * multiplier * activeTrade.lot;
            result = 'WIN';
            resolved = true;
          }
        } else if (activeTrade.dir === 'SELL') {
          if (currentCandle.high >= activeTrade.sl) {
            exitPrice = activeTrade.sl;
            pnl = (activeTrade.entry - exitPrice) * multiplier * activeTrade.lot;
            result = 'LOSS';
            resolved = true;
          } else if (currentCandle.low <= activeTrade.tp) {
            exitPrice = activeTrade.tp;
            pnl = (activeTrade.entry - exitPrice) * multiplier * activeTrade.lot;
            result = 'WIN';
            resolved = true;
          }
        }

        if (resolved) {
          const spreadCost = spreadCostPerLot * activeTrade.lot;
          const netPnL = pnl - spreadCost;
          balance += netPnL;

          if (result === 'WIN') winningTrades++;
          else losingTrades++;

          tradeLog.push({
            id: ++totalTrades,
            dir: activeTrade.dir,
            entry: activeTrade.entry,
            sl: activeTrade.sl,
            tp: activeTrade.tp,
            exit: exitPrice,
            lot: activeTrade.lot,
            result: result,
            rawPnL: pnl,
            spreadCost: spreadCost,
            netPnL: netPnL,
            entryTimeStr: activeTrade.entryTimeStr,
            exitTimeStr: currentCandle.timeStr
          });

          activeTrade = null;

          if (balance <= 0) {
            balance = 0;
            maxDrawdown = 100;
            break;
          }
        }

        if (balance > peakBalance) peakBalance = balance;
        const dd = ((peakBalance - balance) / peakBalance) * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;

        continue;
      }

      // Check for pending order expiration or invalidation
      let invalidated = false;
      if (pendingOrder.dir === 'BUY') {
        if (currentCandle.high >= pendingOrder.tp || currentCandle.low <= pendingOrder.sl) {
          invalidated = true;
        }
      } else {
        if (currentCandle.low <= pendingOrder.tp || currentCandle.high >= pendingOrder.sl) {
          invalidated = true;
        }
      }

      if (!invalidated) {
        pendingOrder.candlesLeft--;
        if (pendingOrder.candlesLeft <= 0) invalidated = true;
      }

      if (invalidated) {
        pendingOrder = null;
      }
    }

    // 3. Scan for new signal
    const history = candles.slice(0, i);
    if (history.length < 30) continue;

    const sliceLen = Math.min(300, history.length);
    const historySlice = history.slice(-sliceLen);
    const closes = historySlice.map(c => c.close);
    const highs = historySlice.map(c => c.high);
    const lows = historySlice.map(c => c.low);
    const lastPrice = closes[closes.length - 1];

    const rsiVal = Indicators.rsi(closes);
    const macdVal = Indicators.macd(closes);
    const emaTrend = Indicators.emaTrend(closes);
    const score = Indicators.signalScore({ rsi: rsiVal, macd: macdVal, emaTrend }, threshold);

    if (score.direction === 'NEUTRAL') continue;

    const lookback = tf === '5m' ? 30 : 50;
    const swings = Indicators.swingPoints(highs, lows, Math.min(lookback, historySlice.length));
    const fiboLevels = Indicators.fibonacci(swings.swingHigh, swings.swingLow, score.direction === 'BUY');
    const ob = Indicators.orderBlock(historySlice, score.direction);
    const atr = Indicators.atr(highs, lows, closes) || (lastPrice * 0.003);

    // Build plan based on custom parameters
    const dir = score.direction;
    const fiboLvl = fiboLevels ? fiboLevels.find(f => Math.abs(f.pct - fiboLevel) < 0.2) : null;
    const entryPrice = fiboLvl ? fiboLvl.price : lastPrice;
    let slPrice = null;
    let tpPrice = null;

    if (dir === 'BUY') {
      const structuralLow = ob ? Math.min(swings.swingLow, ob.low) : swings.swingLow;
      slPrice = structuralLow;
      if (entryPrice - slPrice < atr * 1.0 || slPrice >= entryPrice) {
        slPrice = entryPrice - atr * atrMultiplier;
      }
      tpPrice = swings.swingHigh;
      if (tpPrice <= entryPrice) {
        tpPrice = entryPrice + atr * 3;
      }
    } else {
      const structuralHigh = ob ? Math.max(swings.swingHigh, ob.high) : swings.swingHigh;
      slPrice = structuralHigh;
      if (slPrice - entryPrice < atr * 1.0 || slPrice <= entryPrice) {
        slPrice = entryPrice + atr * atrMultiplier;
      }
      tpPrice = swings.swingLow;
      if (tpPrice >= entryPrice) {
        tpPrice = entryPrice - atr * 3;
      }
    }

    const slDist = Math.abs(entryPrice - slPrice);
    const riskUsd = balance * riskPct / 100;
    const riskAtMinLotUsd = slDist * multiplier * 0.01;

    // Strict capital preservation check (TF max allowed risk)
    const maxAllowedRiskUsd = tf === '5m' ? 4.50 : 12.00;
    if (riskAtMinLotUsd > maxAllowedRiskUsd) continue;

    // Calculate Lot Size
    let lotVal = slDist > 0 ? riskUsd / (slDist * multiplier + spreadCostPerLot) : 0.01;
    if (lotVal < 0.01) lotVal = 0.01;
    lotVal = Math.floor(lotVal * 100) / 100;

    pendingOrder = {
      dir,
      entry: entryPrice,
      sl: slPrice,
      tp: tpPrice,
      lot: lotVal,
      candlesLeft: tf === '5m' ? 20 : 12
    };
  }

  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const netProfit = balance - initialCapital;
  const netProfitPct = (netProfit / initialCapital) * 100;

  // Custom Fitness Score combining profitability, risk management, and execution frequency
  // Fitness = NetProfit% * WinRate% * (100% - Drawdown%) * (Trades factor)
  const tradesFactor = totalTrades >= 2 ? 1.0 : (totalTrades === 1 ? 0.3 : 0.0);
  const fitness = netProfitPct * (winRate / 100) * ((100 - maxDrawdown) / 100) * tradesFactor;

  return {
    trades: totalTrades,
    win: winningTrades,
    loss: losingTrades,
    winRate: winRate.toFixed(1) + '%',
    netProfit: netProfit.toFixed(2),
    netProfitPct: netProfitPct.toFixed(1) + '%',
    maxDrawdown: maxDrawdown.toFixed(1) + '%',
    finalBalance: balance.toFixed(2),
    fitness: parseFloat(fitness.toFixed(4)),
    tradeLog
  };
}

module.exports = {
  Indicators,
  runSimulation
};
