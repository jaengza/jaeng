const fs = require('fs');
const path = require('path');

console.log('========================================================================');
console.log('🧪 kesineTrader Pro — ระบบวิเคราะห์สถิติภายใต้เงินทุนทุนเหมาะสม ($500.00)');
console.log('========================================================================\n');

// ── 1. MOCK ENVIRONMENT ───────────────────────────────────────────────────
global.document = {
  getElementById: (id) => {
    if (id === 'r-balance') return { value: '500' }; // Capital = $500.00
    if (id === 'r-risk-pct') return { value: '5' };   // Risk = 5% ($25.00)
    return null;
  }
};
global.window = {};
global.Market = {
  closes(candles) { return candles.map(c => c.close); },
  highs(candles)  { return candles.map(c => c.high); },
  lows(candles)   { return candles.map(c => c.low); },
  prices: { dxy: 104.50, dxyPct: -0.25 }
};

// ── 2. LOAD ACTIVE COMPUTATIONAL MODULES ──────────────────────────────────
try {
  let indicatorsCode = fs.readFileSync(path.join(__dirname, 'js/indicators.js'), 'utf8');
  indicatorsCode = indicatorsCode.replace('const Indicators =', 'global.Indicators =');
  eval(indicatorsCode);
  
  let analysisCode = fs.readFileSync(path.join(__dirname, 'js/analysis.js'), 'utf8');
  analysisCode = analysisCode.replace('const Analysis =', 'global.Analysis =');
  analysisCode = analysisCode.replace(/this\.renderResults.*/, '// Render mocked');
  analysisCode = analysisCode.replace(/window\.App.*/, '// App mocked');
  eval(analysisCode);
  
  console.log('🟢 โหลดโมดูล Indicators และ Analysis สำเร็จ!');
} catch (e) {
  console.error('❌ Error loading modules:', e.message);
  process.exit(1);
}

// ── 3. DATA PREPARATION ───────────────────────────────────────────────────
const DATA_DIR = 'G:/My Drive/04_ระบบเทรดและบอทเทรด/04_Legacy_Projects/botjaeng/3.Data/XAUUSD';
const candles15m = parseCSV(path.join(DATA_DIR, 'XAUUSDm_M15.csv'));

function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const headers = lines[0].trim().split(',');
  const candles = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < headers.length) continue;
    
    const candle = {};
    for (let j = 0; j < headers.length; j++) {
      const val = parts[j];
      if (headers[j] === 'time') {
        candle.timeStr = val;
        candle.time = new Date(val.replace(' ', 'T')).getTime();
      } else {
        candle[headers[j]] = parseFloat(val);
      }
    }
    candles.push(candle);
  }
  candles.sort((a, b) => a.time - b.time);
  return candles;
}

// ── 4. RUN GRID SEARCH / OPTIMIZER ────────────────────────────────────────
const scoreThresholds = [2, 3, 4];
const fiboLevelsOptions = [0.705, 0.618, 0.50];
const breakevenOptions = [null, 1.0, 1.5];

const sweepResults = [];

console.log('\n🔎 เริ่มทดสอบกริดพารามิเตอร์บน TF 15m (ด้วยทุน $500.00)...');

const lastCandle = candles15m[candles15m.length - 1];
const endTime = lastCandle.time;
const startTime = endTime - 45 * 24 * 60 * 60 * 1000;

let startIndex = -1;
for (let i = 0; i < candles15m.length; i++) {
  if (candles15m[i].time >= startTime) {
    startIndex = i;
    break;
  }
}

scoreThresholds.forEach(scoreTh => {
  fiboLevelsOptions.forEach(fiboEnt => {
    breakevenOptions.forEach(be => {
      
      let balance = 500.00;
      const initialCapital = 500.00;
      const riskPct = 5.0;
      
      let totalTrades = 0;
      let winningTrades = 0;
      let losingTrades = 0;
      let breakevenTrades = 0;
      let activeTrade = null;
      let maxDrawdown = 0;
      let peakBalance = balance;
      
      // Simulation Loop
      for (let i = startIndex; i < candles15m.length; i++) {
        const currentCandle = candles15m[i];
        
        // 1. Manage Active Trade
        if (activeTrade) {
          let resolved = false;
          let exitPrice = 0;
          let pnl = 0;
          let result = '';
          
          // Check for Breakeven triggering
          if (be !== null && !activeTrade.breakevenTriggered && activeTrade.entryTimeStr !== currentCandle.timeStr) {
            if (activeTrade.dir === 'BUY') {
              if (currentCandle.high >= activeTrade.entry + (activeTrade.slDist * be)) {
                activeTrade.sl = activeTrade.entry;
                activeTrade.breakevenTriggered = true;
              }
            } else if (activeTrade.dir === 'SELL') {
              if (currentCandle.low <= activeTrade.entry - (activeTrade.slDist * be)) {
                activeTrade.sl = activeTrade.entry;
                activeTrade.breakevenTriggered = true;
              }
            }
          }
          
          if (activeTrade.dir === 'BUY') {
            // Hit Stop Loss
            if (currentCandle.low <= activeTrade.sl) {
              exitPrice = activeTrade.sl;
              pnl = (exitPrice - activeTrade.entry) * 100 * activeTrade.lot;
              result = activeTrade.breakevenTriggered ? 'BREAKEVEN' : 'LOSS';
              resolved = true;
            } 
            // Hit Take Profit
            else if (currentCandle.high >= activeTrade.tp) {
              exitPrice = activeTrade.tp;
              pnl = (exitPrice - activeTrade.entry) * 100 * activeTrade.lot;
              result = 'WIN';
              resolved = true;
            }
          } else if (activeTrade.dir === 'SELL') {
            // Hit Stop Loss
            if (currentCandle.high >= activeTrade.sl) {
              exitPrice = activeTrade.sl;
              pnl = (activeTrade.entry - exitPrice) * 100 * activeTrade.lot;
              result = activeTrade.breakevenTriggered ? 'BREAKEVEN' : 'LOSS';
              resolved = true;
            } 
            // Hit Take Profit
            else if (currentCandle.low <= activeTrade.tp) {
              exitPrice = activeTrade.tp;
              pnl = (activeTrade.entry - exitPrice) * 100 * activeTrade.lot;
              result = 'WIN';
              resolved = true;
            }
          }
          
          if (resolved) {
            const spreadCost = activeTrade.spreadPoints * 0.01 * 100 * activeTrade.lot;
            const netPnL = pnl - spreadCost;
            
            balance += netPnL;
            if (result === 'WIN') winningTrades++;
            else if (result === 'LOSS') losingTrades++;
            else breakevenTrades++;
            
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
        
        // 2. Scan Signals
        const history = candles15m.slice(0, i);
        if (history.length < 30) continue;
        
        const closes = history.map(c => c.close);
        const highs  = history.map(c => c.high);
        const lows   = history.map(c => c.low);
        const lastPrice = closes[closes.length - 1];
        
        const rsiVal = Indicators.rsi(closes);
        const macdVal = Indicators.macd(closes);
        const emaData = Indicators.emaTrend(closes);
        
        let scoreVal = 0;
        if (rsiVal !== null) {
          if (rsiVal < 35) scoreVal += 2;
          else if (rsiVal < 45) scoreVal += 1;
          else if (rsiVal > 65) scoreVal -= 2;
          else if (rsiVal > 55) scoreVal -= 1;
        }
        if (macdVal) {
          if (macdVal.cross === 'golden') scoreVal += 3;
          else if (macdVal.cross === 'death') scoreVal -= 3;
          else if (macdVal.trend === 'bull') scoreVal += 1;
          else if (macdVal.trend === 'bear') scoreVal -= 1;
          if (macdVal.histogram > 0) scoreVal += 0.5;
          else scoreVal -= 0.5;
        }
        if (emaData) {
          scoreVal += emaData.score;
        }
        
        const dir = scoreVal >= scoreTh ? 'BUY' : scoreVal <= -scoreTh ? 'SELL' : 'NEUTRAL';
        if (dir === 'NEUTRAL') continue;
        
        const swings = Indicators.swingPoints(highs, lows, Math.min(100, history.length));
        const fiboLevels = Indicators.fibonacci(swings.swingHigh, swings.swingLow, dir === 'BUY');
        const ob = Indicators.orderBlock(history, dir);
        const atrVal = Indicators.atr(highs, lows, closes) || (lastPrice * 0.003);
        
        const rng = swings.swingHigh - swings.swingLow;
        let entryPrice = lastPrice;
        if (dir === 'BUY') {
          entryPrice = swings.swingHigh - fiboEnt * rng;
        } else {
          entryPrice = swings.swingLow + fiboEnt * rng;
        }
        
        const baseSL = ob ? (dir === 'BUY' ? Math.min(swings.swingLow, ob.low) : Math.max(swings.swingHigh, ob.high)) : (dir === 'BUY' ? swings.swingLow : swings.swingHigh);
        let sl = baseSL;
        
        if (dir === 'BUY') {
          if (entryPrice - sl < atrVal * 0.5) sl = entryPrice - atrVal * 1.5;
        } else {
          if (sl - entryPrice < atrVal * 0.5) sl = entryPrice + atrVal * 1.5;
        }
        
        let tp = dir === 'BUY' ? swings.swingHigh : swings.swingLow;
        if (dir === 'BUY' && tp <= entryPrice) tp = entryPrice + atrVal * 3;
        if (dir === 'SELL' && tp >= entryPrice) tp = entryPrice - atrVal * 3;
        
        let triggered = false;
        if (dir === 'BUY') {
          if (currentCandle.low <= entryPrice && currentCandle.high >= entryPrice) triggered = true;
        } else {
          if (currentCandle.high >= entryPrice && currentCandle.low <= entryPrice) triggered = true;
        }
        
        if (triggered) {
          const riskUsd = initialCapital * riskPct / 100; // $25.00
          const slDist = Math.abs(entryPrice - sl);
          
          let lotVal = slDist > 0 ? riskUsd / (slDist * 100) : 0.01;
          if (lotVal < 0.01) lotVal = 0.01;
          lotVal = Math.floor(lotVal * 100) / 100;
          
          activeTrade = {
            id: ++totalTrades,
            dir: dir,
            entry: entryPrice,
            sl: sl,
            tp: tp,
            lot: lotVal,
            slDist: slDist,
            breakevenTriggered: false,
            spreadPoints: currentCandle.spread,
            riskUsd: riskUsd,
            entryTimeStr: currentCandle.timeStr
          };
        }
      }
      
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
      const netProfit = balance - initialCapital;
      
      sweepResults.push({
        scoreTh,
        fiboEnt: (fiboEnt * 100).toFixed(1) + '%',
        breakeven: be === null ? 'None' : be.toFixed(1) + 'x',
        trades: totalTrades,
        wins: winningTrades,
        losses: losingTrades,
        be: breakevenTrades,
        winRate: winRate.toFixed(2) + '%',
        netProfit: (netProfit >= 0 ? '+' : '') + '$' + netProfit.toFixed(2),
        endingBalance: '$' + balance.toFixed(2),
        maxDrawdown: maxDrawdown.toFixed(2) + '%',
        rawProfit: netProfit
      });
      
    });
  });
});

sweepResults.sort((a, b) => b.rawProfit - a.rawProfit);

console.log('\n📊 ตารางเปรียบเทียบผลลัพธ์พารามิเตอร์ที่ดีที่สุดภายใต้เงินทุนที่เหมาะสม ($500.00):');
console.table(sweepResults.slice(0, 15));
console.log('========================================================================\n');
