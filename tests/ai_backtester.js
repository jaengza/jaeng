const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. Load the actual JavaScript Indicators engine used in the web app
const indicatorsPath = path.join(__dirname, '../js/indicators.js');
const indicatorsCode = fs.readFileSync(indicatorsPath, 'utf8');
const Indicators = eval(indicatorsCode + '; Indicators;');

// Helper: Run Python Bridge
function fetchMT5Data(symbol, tf, limit) {
    console.log(`Fetching ${limit} candles of ${symbol} (${tf}) from MT5...`);
    try {
        const out = execSync(`python mt5_bridge.py ${symbol} ${tf} ${limit}`, { cwd: __dirname });
        return JSON.parse(out.toString());
    } catch (err) {
        console.error("Error fetching MT5 data:", err.message);
        process.exit(1);
    }
}

// 2. The Backtest Runner
function runBacktest(symbol, tf, candles, isolationMode = 'COMPOSITE', saspThreshold = 3.5, targetFibo = 70.5, atrMult = 1.5) {
    let totalTrades = 0;
    let wins = 0;
    let losses = 0;
    let totalRREarned = 0;
    
    // We need at least 250 candles for EMA200 and accurate MACD/RSI warmup
    const warmup = 250; 
    
    for (let i = warmup; i < candles.length - 1; i++) {
        const history = candles.slice(i - warmup, i + 1);
        const currentCandle = history[history.length - 1];
        const lastPrice = currentCandle.close;
        
        const closes = history.map(c => c.close);
        const highs = history.map(c => c.high);
        const lows = history.map(c => c.low);
        
        // Calculate Indicators
        const rsiVal = Indicators.rsi(closes);
        const macdVal = Indicators.macd(closes);
        const emaData = Indicators.emaTrend(closes);
        const atrVal = Indicators.atr(highs, lows, closes);
        const swings = Indicators.swingPoints(highs, lows, 100);
        
        let score = { direction: 'NEUTRAL', strength: 0 };
        
        if (isolationMode === 'COMPOSITE') {
            score = Indicators.signalScore({ rsi: rsiVal, macd: macdVal, emaTrend: emaData }, 1.0);
        } else if (isolationMode === 'RSI') {
            if (rsiVal < 35) score = { direction: 'BUY', strength: 5 };
            else if (rsiVal > 65) score = { direction: 'SELL', strength: 5 };
        } else if (isolationMode === 'MACD') {
            if (macdVal.cross === 'golden') score = { direction: 'BUY', strength: 5 };
            else if (macdVal.cross === 'death') score = { direction: 'SELL', strength: 5 };
        } else if (isolationMode === 'EMA') {
            if (emaData.trend === 'bull') score = { direction: 'BUY', strength: 5 };
            else if (emaData.trend === 'bear') score = { direction: 'SELL', strength: 5 };
        }
        
        const fiboLevels = Indicators.fibonacci(swings.swingHigh, swings.swingLow, score.direction === 'BUY');
        const ob = Indicators.orderBlock(history, score.direction);
        const fvgs = Indicators.fairValueGaps(history);
        
        if (isolationMode === 'SMC') {
            // Override score based PURELY on SMC (OB + FVG)
            score = { direction: 'NEUTRAL', strength: 0 };
            if (ob && fvgs && fvgs.length > 0) {
                const recentFvg = fvgs[fvgs.length - 1];
                if (ob.type === 'bullish_ob' && recentFvg.type === 'bullish') score = { direction: 'BUY', strength: 5 };
                if (ob.type === 'bearish_ob' && recentFvg.type === 'bearish') score = { direction: 'SELL', strength: 5 };
            }
        }
        
        if (score.direction === 'NEUTRAL') continue;
        
        // Evaluate SASP Enhancements for COMPOSITE mode
        const ote = fiboLevels ? fiboLevels.find(f => Math.abs(f.pct - targetFibo) < 0.2) : null;
        if (isolationMode === 'COMPOSITE') {
            if (ote && Math.abs(lastPrice - ote.price) <= (atrVal * 1.5)) score.strength += 1.0;
            if (ob && ((score.direction === 'BUY' && ob.type === 'bullish_ob') || (score.direction === 'SELL' && ob.type === 'bearish_ob'))) score.strength += 1.0;
            if (fvgs && fvgs.length > 0) {
                const recentFvg = fvgs[fvgs.length - 1];
                if ((score.direction === 'BUY' && recentFvg.type === 'bullish') || (score.direction === 'SELL' && recentFvg.type === 'bearish')) score.strength += 1.0;
            }
            if (score.strength < saspThreshold) continue;
        }
        
        // Create Trade Plan
        let entry = lastPrice, sl = null, tp = null;
        if (score.direction === 'BUY') {
            entry = ote ? ote.price : lastPrice;
            const baseSL = ob ? Math.min(swings.swingLow, ob.low) : swings.swingLow;
            sl = baseSL;
            if (entry - sl < atrVal * atrMult || sl >= entry) sl = entry - atrVal * atrMult;
            tp = swings.swingHigh;
            if (tp <= entry) tp = entry + atrVal * 3;
        } else {
            entry = ote ? ote.price : lastPrice;
            const baseSL = ob ? Math.max(swings.swingHigh, ob.high) : swings.swingHigh;
            sl = baseSL;
            if (sl - entry < atrVal * atrMult || sl <= entry) sl = entry + atrVal * atrMult;
            tp = swings.swingLow;
            if (tp >= entry) tp = entry - atrVal * 3;
        }
        
        const slDist = Math.abs(entry - sl);
        const tpDist = Math.abs(tp - entry);
        const rr = slDist > 0 ? (tpDist / slDist) : 0;
        
        if (rr < 1.0) continue; // Skip bad Risk/Reward setups
        
        // SIMULATE TRADE EXECUTION (Look into future candles)
        let tradeResult = 'PENDING';
        for (let j = i + 1; j < candles.length; j++) {
            const future = candles[j];
            if (score.direction === 'BUY') {
                if (future.low <= sl) { tradeResult = 'LOSS'; break; }
                if (future.high >= tp) { tradeResult = 'WIN'; break; }
            } else {
                if (future.high >= sl) { tradeResult = 'LOSS'; break; }
                if (future.low <= tp) { tradeResult = 'WIN'; break; }
            }
        }
        
        if (tradeResult === 'WIN') {
            wins++;
            totalRREarned += rr;
            totalTrades++;
            // Skip forward to avoid duplicate overlapping trades
            i += 10; 
        } else if (tradeResult === 'LOSS') {
            losses++;
            totalRREarned -= 1; // Lost 1R
            totalTrades++;
            i += 10;
        }
    }
    
    // Print Results
    const winRate = totalTrades > 0 ? (wins / totalTrades * 100).toFixed(2) : 0;
    console.log(`\n=== RESULTS ===`);
    console.log(`Total Valid Signals: ${totalTrades}`);
    console.log(`Wins: ${wins} | Losses: ${losses}`);
    console.log(`Win Rate: ${winRate}%`);
    console.log(`Net RR Earned: ${totalRREarned.toFixed(2)} R`);
    console.log(`Expectancy per Trade: ${(totalTrades > 0 ? totalRREarned / totalTrades : 0).toFixed(2)} R`);
    console.log(`===============\n`);
    
    return { winRate, totalRREarned, totalTrades };
}

function main() {
    const symbol = process.argv[2] || 'XAUUSD';
    const tf = process.argv[3] || '15m';
    const limit = parseInt(process.argv[4]) || 2000;
    
    // 1. Fetch data
    const candles = fetchMT5Data(symbol, tf, limit);
    
    // 2. ISOLATED INDICATOR SWEEP
    console.log("\nStarting Isolated Indicator Sweep...");
    console.log("=====================================");
    const modes = ['RSI', 'MACD', 'EMA', 'SMC', 'COMPOSITE'];
    
    let report = [];
    
    for (let mode of modes) {
        console.log(`\n\n>>> Testing Mode: ${mode} <<<`);
        // We use a high threshold for composite in this test to compare
        const res = runBacktest(symbol, tf, candles, mode, 3.5, 78.6, 1.5);
        report.push({
            Mode: mode,
            WinRate: res.winRate + '%',
            Trades: res.totalTrades,
            RR_Earned: res.totalRREarned.toFixed(2) + ' R'
        });
    }
    
    console.log(`\n🏆 ISOLATED INDICATOR PERFORMANCE FOR ${symbol} ${tf} 🏆`);
    console.table(report);
}

main();
