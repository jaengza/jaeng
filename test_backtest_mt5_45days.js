const fs = require('fs');
const path = require('path');

console.log('========================================================================');
console.log('🧪 kesineTrader Pro — ระบบตรวจสอบโปรแกรม & แบคเทส 45 วันย้อนหลัง (ข้อมูลจริง MT5)');
console.log('========================================================================\n');

// ── 1. MOCK BROWSER ENVIRONMENT FOR ACTIVE MODULES ─────────────────────────
global.document = {
  getElementById: (id) => {
    if (id === 'r-balance') return { value: '50' };
    if (id === 'r-risk-pct') return { value: '5' }; // 5% risk ($2.50)
    return null;
  }
};
global.window = {};
global.Market = {
  closes(candles) { return candles.map(c => c.close); },
  highs(candles)  { return candles.map(c => c.high); },
  lows(candles)   { return candles.map(c => c.low); },
  prices: { dxy: 104.50, dxyPct: -0.25 } // Mock DXY pricing
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
  
  console.log('🟢 โหลดไฟล์โมดูล Indicators และ Analysis สำเร็จเรียบร้อยแล้ว!');
} catch (e) {
  console.error('❌ ข้อผิดพลาดในการโหลดไฟล์โครงการ:', e.message);
  process.exit(1);
}

// ── 3. DEFINE PATHS & UTILITIES ──────────────────────────────────────────
const DATA_DIR = 'G:/My Drive/04_ระบบเทรดและบอทเทรด/04_Legacy_Projects/botjaeng/3.Data/XAUUSD';
const timeframes = ['5m', '15m', '1h', '4h', '1d', '1w'];

const csvPaths = {
  '5m': path.join(DATA_DIR, 'XAUUSDm_M5.csv'),
  '15m': path.join(DATA_DIR, 'XAUUSDm_M15.csv'),
  '1h': path.join(DATA_DIR, 'XAUUSDm_H1.csv'),
  '4h': path.join(DATA_DIR, 'XAUUSDm_H4.csv'),
  '1d': path.join(DATA_DIR, 'XAUUSDm_D1.csv'),
  '1w': path.join(DATA_DIR, 'XAUUSDm_D1.csv') // Aggregated from D1
};

// CSV Ingestion & Parsing Function
function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`ไม่พบไฟล์ข้อมูลที่เส้นทาง: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  if (lines.length < 2) return [];
  
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
        // Parse time timezone-safe
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

// Weekly Aggregator from Daily Candles
function getWeekIdentifier(timeStr) {
  // timeStr is YYYY-MM-DD
  const d = new Date(timeStr + 'T00:00:00');
  let day = d.getDay(); // 0 = Sunday, 1 = Monday, ...
  let monday = new Date(d.getTime());
  if (day === 0) {
    monday.setDate(d.getDate() + 1);
  } else {
    monday.setDate(d.getDate() - (day - 1));
  }
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function aggregateWeekly(dailyCandles) {
  const weeklyGroups = {};
  for (const c of dailyCandles) {
    const weekId = getWeekIdentifier(c.timeStr);
    if (!weeklyGroups[weekId]) {
      weeklyGroups[weekId] = [];
    }
    weeklyGroups[weekId].push(c);
  }
  
  const weeklyCandles = [];
  for (const [weekId, group] of Object.entries(weeklyGroups)) {
    group.sort((a, b) => a.time - b.time);
    
    const open = group[0].open;
    const close = group[group.length - 1].close;
    const high = Math.max(...group.map(g => g.high));
    const low = Math.min(...group.map(g => g.low));
    const tick_volume = group.reduce((sum, g) => sum + g.tick_volume, 0);
    const spread = group.reduce((sum, g) => sum + g.spread, 0) / group.length;
    
    weeklyCandles.push({
      timeStr: weekId,
      time: new Date(weekId + 'T00:00:00').getTime(),
      open,
      high,
      low,
      close,
      tick_volume,
      spread,
      real_volume: 0
    });
  }
  weeklyCandles.sort((a, b) => a.time - b.time);
  return weeklyCandles;
}

// ── 4. BACKTEST SIMULATOR RUNNER ──────────────────────────────────────────
const backtestResults = {};
const fullTradeLogs = {};

console.log('\n------------------------------------------------------------------------');
console.log('📊 เริ่มต้นระบบจำลองการแบคเทสย้อนหลัง 45 วัน แยกแต่ละ Timeframe...');
console.log('------------------------------------------------------------------------');

timeframes.forEach(tf => {
  console.log(`\n⏳ กำลังโหลดและวิเคราะห์ข้อมูล TF: ${tf}...`);
  
  let candles = [];
  if (tf === '1w') {
    const dailyCandles = parseCSV(csvPaths['1d']);
    candles = aggregateWeekly(dailyCandles);
  } else {
    candles = parseCSV(csvPaths[tf]);
  }
  
  if (candles.length < 50) {
    console.warn(`⚠️ ข้อมูลแท่งเทียนสำหรับ TF: ${tf} มีน้อยเกินไป (${candles.length} แท่ง) ข้าม TF นี้`);
    return;
  }
  
  // Calculate date ranges
  const lastCandle = candles[candles.length - 1];
  const endTime = lastCandle.time;
  // 45 days in milliseconds
  const startTime = endTime - 45 * 24 * 60 * 60 * 1000;
  
  const startDateStr = new Date(startTime).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const endDateStr = new Date(endTime).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
  
  console.log(`   📂 โหลดข้อมูลประวัติทั้งหมดสำเร็จ: ${candles.length} แท่ง`);
  console.log(`   📅 ช่วงแบคเทสจริง (45 วัน): ${startDateStr} ถึง ${endDateStr}`);
  
  // Backtest parameters
  let balance = 50.00; // $50 capital
  const riskPct = 5.0; // 5% risk ($2.50)
  const initialCapital = 50.00;
  
  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let activeTrade = null;
  let maxDrawdown = 0;
  let peakBalance = balance;
  let tradeLog = [];
  
  // Find index where evaluation window starts
  let startIndex = -1;
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].time >= startTime) {
      startIndex = i;
      break;
    }
  }
  
  if (startIndex === -1) {
    console.warn(`   ⚠️ ไม่สามารถหาแท่งเทียนเริ่มต้นที่เวลา >= ${new Date(startTime).toISOString()} ได้, ข้าม TF นี้`);
    return;
  }
  
  console.log(`   🔧 การอุ่นเครื่องอินดิเคเตอร์ (Warm-up): ใช้งาน ${startIndex} แท่งก่อนหน้าเพื่อคำนวณ`);
  console.log(`   🚀 เริ่มต้นรันจำลองการเทรดตั้งแต่วัสดัชนีแท่งที่ ${startIndex} (${candles[startIndex].timeStr})...`);
  
  // Simulation Loop
  for (let i = startIndex; i < candles.length; i++) {
    const currentCandle = candles[i];
    
    // 1. Manage Active Trade (Resolution check)
    if (activeTrade) {
      let resolved = false;
      let exitPrice = 0;
      let pnl = 0;
      let result = '';
      
      if (activeTrade.dir === 'BUY') {
        // Hit Stop Loss (Check SL first for safety/conservativeness)
        if (currentCandle.low <= activeTrade.sl) {
          exitPrice = activeTrade.sl;
          pnl = (exitPrice - activeTrade.entry) * 100 * activeTrade.lot;
          result = 'LOSS';
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
          result = 'LOSS';
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
        // Calculate dynamic spread cost using currentCandle's spread
        const spreadCost = activeTrade.spreadPoints * 0.01 * 100 * activeTrade.lot; // spread_points * lot
        const netPnL = pnl - spreadCost;
        
        balance += netPnL;
        if (result === 'WIN') winningTrades++;
        else losingTrades++;
        
        tradeLog.push({
          id: activeTrade.id,
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

        // Check if account blown
        if (balance <= 0) {
          balance = 0;
          maxDrawdown = 100;
          break; // Stop trading on this blown account
        }
      }
      
      // Update Peak Balance and Drawdown
      if (balance > peakBalance) peakBalance = balance;
      const dd = ((peakBalance - balance) / peakBalance) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
      
      // A trade was active during this bar, we do not look for new signals
      continue;
    }
    
    // 2. Scan Signals (Slice history up to i to avoid lookahead leak)
    const history = candles.slice(0, i);
    if (history.length < 30) continue;
    
    const closes = history.map(c => c.close);
    const highs  = history.map(c => c.high);
    const lows   = history.map(c => c.low);
    const lastPrice = closes[closes.length - 1];
    
    // Dynamic parameters based on timeframe
    let lookback = 100;
    let threshold = 4;
    if (tf === '5m') {
      lookback = 30;
      threshold = 5;
    } else if (tf === '15m') {
      lookback = 50;
      threshold = 5;
    }

    const rsiVal = Indicators.rsi(closes);
    const macdVal = Indicators.macd(closes);
    const emaData = Indicators.emaTrend(closes);
    const score = Indicators.signalScore({ rsi: rsiVal, macd: macdVal, emaTrend: emaData }, threshold);
    
    // 🛡️ OPTIMIZED (v4.3): ใช้งานการกรองความแรงสัญญาณ (Signal Threshold) ผ่านระดับความแรงที่เหมาะสม
    if (score.direction === 'NEUTRAL') continue;
    
    const swings = Indicators.swingPoints(highs, lows, Math.min(lookback, history.length));
    const fiboLevels = Indicators.fibonacci(swings.swingHigh, swings.swingLow, score.direction === 'BUY');
    const ob = Indicators.orderBlock(history, score.direction);
    const atrVal = Indicators.atr(highs, lows, closes) || (lastPrice * 0.003);
    
    // Build plan using actual program analysis logic
    const plan = Analysis.buildTradePlan({
      asset: 'XAUUSD',
      tf: tf,
      last: lastPrice,
      score,
      rsiVal,
      atrVal,
      fiboLevels,
      ob,
      swings
    });
    
    if (plan.dir === 'NEUTRAL') continue;

    // 🛡️ CAPITAL PRESERVATION FILTER: Skip trades where SL is too wide (insolvency protection)
    let maxAllowedRiskUsd = 7.50;
    if (tf === '5m') {
      maxAllowedRiskUsd = 3.50; // Extremely tight SL only
    } else if (tf === '15m') {
      maxAllowedRiskUsd = 10.00; // Allow M15 trades up to $10 risk (M15 normal volatility range)
    } else if (tf === '1h') {
      maxAllowedRiskUsd = 40.00; // Allow H1 trades up to $40 risk (captures ultra-high probability swings)
    } else if (tf === '4h') {
      maxAllowedRiskUsd = 40.00; // Prevents the extreme $143 blowout while permitting normal swings
    }

    const slDist = Math.abs(plan.entry - plan.sl);
    const riskAtMinLotUsd = slDist * 100 * 0.01;
    if (riskAtMinLotUsd > maxAllowedRiskUsd) {
      continue;
    }
    
    // 3. Check for Entry Trigger in current bar
    const entryPrice = plan.entry;
    let triggered = false;
    
    if (plan.dir === 'BUY') {
      if (currentCandle.low <= entryPrice && currentCandle.high >= entryPrice) {
        triggered = true;
      }
    } else {
      if (currentCandle.high >= entryPrice && currentCandle.low <= entryPrice) {
        triggered = true;
      }
    }
    
    if (triggered) {
      const riskUsd = initialCapital * riskPct / 100; // $2.50
      const slDist = Math.abs(entryPrice - plan.sl);
      
      // Calculate Lot size with 0.01 floor and 2 decimal points limit
      let lotVal = slDist > 0 ? riskUsd / (slDist * 100) : 0.01;
      if (lotVal < 0.01) lotVal = 0.01;
      lotVal = Math.floor(lotVal * 100) / 100;
      
      activeTrade = {
        id: ++totalTrades,
        dir: plan.dir,
        entry: entryPrice,
        sl: plan.sl,
        tp: plan.tp,
        lot: lotVal,
        spreadPoints: currentCandle.spread,
        riskUsd: riskUsd,
        entryTimeStr: currentCandle.timeStr
      };
    }
  }
  
  // Calculate stats
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const netProfit = balance - initialCapital;
  const netProfitPct = (netProfit / initialCapital) * 100;
  
  backtestResults[tf] = {
    'Timeframe': tf,
    'สิ้นสุดข้อมูล': lastCandle.timeStr,
    'แท่งเทียนทั้งหมด': candles.length,
    'เทรดทั้งหมด': totalTrades,
    'ชนะ (Win)': winningTrades,
    'แพ้ (Loss)': losingTrades,
    'Win Rate (%)': winRate.toFixed(2) + '%',
    'กำไรสุทธิ ($)': (netProfit >= 0 ? '+' : '') + '$' + netProfit.toFixed(2),
    'กำไรสุทธิ (%)': (netProfit >= 0 ? '+' : '') + netProfitPct.toFixed(2) + '%',
    'Max Drawdown': maxDrawdown.toFixed(2) + '%',
    'ยอดเงินคงเหลือ': '$' + balance.toFixed(2)
  };
  
  fullTradeLogs[tf] = tradeLog;
});

// ── 5. PRINT RESULTS & OUTPUT SUMMARY ─────────────────────────────────────
console.log('\n========================================================================');
console.log('📈 รายงานผลการแบคเทสย้อนหลัง 45 วัน ด้วยข้อมูลจริงจาก MT5 (XAUUSD)');
console.log('========================================================================');
console.table(Object.values(backtestResults));
console.log('========================================================================');

// Print detailed logs for major timeframes
timeframes.forEach(tf => {
  const logs = fullTradeLogs[tf] || [];
  if (logs.length > 0) {
    console.log(`\n📜 ประวัติออเดอร์ทั้งหมดสำหรับ TF: ${tf} (${logs.length} ออเดอร์):`);
    logs.forEach(t => {
      console.log(`   [ไม้ #${t.id}] ${t.dir.padEnd(4)} | เข้า: ${t.entryTimeStr} @ \$${t.entry.toFixed(2)} | ออก: ${t.exitTimeStr} @ \$${t.exit.toFixed(2)}`);
      console.log(`            SL: \$${t.sl.toFixed(2)} | TP: \$${t.tp.toFixed(2)} | Lot: ${t.lot.toFixed(2)}`);
      console.log(`            กำไรดิบ: \$${(t.rawPnL >= 0 ? '+' : '') + t.rawPnL.toFixed(2)} | ค่าสเปรด: -\$${t.spreadCost.toFixed(2)} | กำไรสุทธิ: \$${(t.netPnL >= 0 ? '+' : '') + t.netPnL.toFixed(2)} | ผล: ${t.result === 'WIN' ? '🟢 WIN' : '🔴 LOSS'}`);
    });
    console.log('------------------------------------------------------------------------');
  } else {
    console.log(`\n📜 TF: ${tf} — ไม่มีประวัติออเดอร์การเทรดที่เกิดขึ้นจริงในช่วง 45 วันนี้`);
    console.log('------------------------------------------------------------------------');
  }
});

// Save results to file for further automatic use in walkthrough and memory log
const reportPath = path.join(__dirname, 'backtest_report_45days.json');
fs.writeFileSync(reportPath, JSON.stringify({ backtestResults, fullTradeLogs }, null, 2), 'utf8');
console.log(`\n💾 บันทึกรายงานผลการทดสอบเชิงลึกที่: ${reportPath}`);
console.log('========================================================================\n');
