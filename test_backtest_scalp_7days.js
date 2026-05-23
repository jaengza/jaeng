const fs = require('fs');
const path = require('path');

console.log('========================================================================');
console.log('⚡ kesineTrader Pro — ระบบแบคเทสย้อนหลัง 7 วันจำเพาะ (โหมดเทรดสั้นบัญชี Zero)');
console.log('========================================================================\n');

// ── 1. MOCK ENVIRONMENT ──────────────────────────────────────────────────
global.document = {
  getElementById: (id) => {
    if (id === 'r-balance') return { value: '50' };
    if (id === 'r-risk-pct') return { value: '5' }; // 5% risk ($2.50)
    if (id === 'an-scalping-mode') return { checked: true }; // เปิดโหมดเทรดสั้นสไนเปอร์
    if (id === 'r-acct-type') return { value: 'zero' }; // จำลองบัญชี Zero Spread
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

// ── 2. LOAD MODULES ──────────────────────────────────────────────────────
try {
  let indicatorsCode = fs.readFileSync(path.join(__dirname, 'js/indicators.js'), 'utf8');
  indicatorsCode = indicatorsCode.replace('const Indicators =', 'global.Indicators =');
  eval(indicatorsCode);
  
  let analysisCode = fs.readFileSync(path.join(__dirname, 'js/analysis.js'), 'utf8');
  analysisCode = analysisCode.replace('const Analysis =', 'global.Analysis =');
  analysisCode = analysisCode.replace(/this\.renderResults.*/, '// Render mocked');
  analysisCode = analysisCode.replace(/window\.App.*/, '// App mocked');
  eval(analysisCode);
  
  console.log('🟢 โหลดโมดูลคำนวณและวิเคราะห์ SMC/ICT สำเร็จเรียบร้อย!');
} catch (e) {
  console.error('❌ ข้อผิดพลาดในการโหลดไฟล์โมดูล:', e.message);
  process.exit(1);
}

// ── 3. DEFINE PATHS & UTILITIES ──────────────────────────────────────────
const DATA_DIR = 'G:/My Drive/04_ระบบเทรดและบอทเทรด/04_Legacy_Projects/botjaeng/3.Data/XAUUSD';
const timeframes = ['5m', '15m'];

function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`ไม่พบไฟล์ข้อมูล: ${filePath}`);
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

// ── 4. RUN SIMULATION ────────────────────────────────────────────────────
const backtestResults = {};
const fullTradeLogs = {};

timeframes.forEach(tf => {
  const filePath = path.join(DATA_DIR, tf === '5m' ? 'XAUUSDm_M5.csv' : 'XAUUSDm_M15.csv');
  let candles = [];
  try {
    candles = parseCSV(filePath);
  } catch (e) {
    console.error(`❌ ไม่สามารถโหลดข้อมูล TF ${tf}:`, e.message);
    return;
  }

  // กำหนดขอบเขต 7 วันสุดท้ายของชุดข้อมูล
  const lastCandle = candles[candles.length - 1];
  const endTime = lastCandle.time;
  const startTime = endTime - 7 * 24 * 60 * 60 * 1000; // 7 วันย้อนหลัง

  const startDateStr = new Date(startTime).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const endDateStr = new Date(endTime).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  // ค้นหาดัชนีเริ่มต้น
  let startIndex = -1;
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].time >= startTime) {
      startIndex = i;
      break;
    }
  }

  if (startIndex === -1) return;

  let balance = 50.00;
  const initialCapital = 50.00;
  const riskPct = 5.0; // เสี่ยง 5% ($2.50)
  
  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let activeTrade = null;
  let maxDrawdown = 0;
  let peakBalance = balance;
  let tradeLog = [];

  for (let i = startIndex; i < candles.length; i++) {
    const currentCandle = candles[i];

    // 1. ตรวจสอบออเดอร์ค้างอยู่
    if (activeTrade) {
      let resolved = false;
      let exitPrice = 0;
      let pnl = 0;
      let result = '';

      if (activeTrade.dir === 'BUY') {
        if (currentCandle.low <= activeTrade.sl) {
          exitPrice = activeTrade.sl;
          pnl = (exitPrice - activeTrade.entry) * 100 * activeTrade.lot;
          result = 'LOSS';
          resolved = true;
        } else if (currentCandle.high >= activeTrade.tp) {
          exitPrice = activeTrade.tp;
          pnl = (exitPrice - activeTrade.entry) * 100 * activeTrade.lot;
          result = 'WIN';
          resolved = true;
        }
      } else if (activeTrade.dir === 'SELL') {
        if (currentCandle.high >= activeTrade.sl) {
          exitPrice = activeTrade.sl;
          pnl = (activeTrade.entry - exitPrice) * 100 * activeTrade.lot;
          result = 'LOSS';
          resolved = true;
        } else if (currentCandle.low <= activeTrade.tp) {
          exitPrice = activeTrade.tp;
          pnl = (activeTrade.entry - exitPrice) * 100 * activeTrade.lot;
          result = 'WIN';
          resolved = true;
        }
      }

      if (resolved) {
        // 💎 คิดค่าธรรมเนียม Commission แบบบัญชี Zero คงที่ $0.07 ต่อ 0.01 lot ($7.00 ต่อ 1 lot เต็ม)
        const spreadCost = 7 * 1.0 * activeTrade.lot; 
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

    // 2. ค้นหาสัญญาณเทรดสั้น
    const history = candles.slice(0, i);
    if (history.length < 30) continue;

    const closes = history.map(c => c.close);
    const highs  = history.map(c => c.high);
    const lows   = history.map(c => c.low);
    const lastPrice = closes[closes.length - 1];

    let lookback = tf === '5m' ? 30 : 50;
    let threshold = 5; // กรองสัญญาณเข้มข้นสูงสุดสำหรับโหมดเทรดสั้น

    const rsiVal = Indicators.rsi(closes);
    const macdVal = Indicators.macd(closes);
    const emaData = Indicators.emaTrend(closes);
    const score = Indicators.signalScore({ rsi: rsiVal, macd: macdVal, emaTrend: emaData }, threshold);

    if (score.direction === 'NEUTRAL') continue;

    const swings = Indicators.swingPoints(highs, lows, Math.min(lookback, history.length));
    const fiboLevels = Indicators.fibonacci(swings.swingHigh, swings.swingLow, score.direction === 'BUY');
    const ob = Indicators.orderBlock(history, score.direction);
    const atrVal = Indicators.atr(highs, lows, closes) || (lastPrice * 0.003);

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

    // กรองขอบเขต SL เพื่อความปลอดภัย
    const slDist = Math.abs(plan.entry - plan.sl);
    const riskAtMinLotUsd = slDist * 100 * 0.01;
    const maxAllowedRiskUsd = tf === '5m' ? 3.50 : 10.00;
    if (riskAtMinLotUsd > maxAllowedRiskUsd) continue;

    // ตรวจสอบจังหวะ Trigger
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
      const riskUsd = initialCapital * riskPct / 100;
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
        riskUsd: riskUsd,
        entryTimeStr: currentCandle.timeStr
      };
    }
  }

  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const netProfit = balance - initialCapital;
  const netProfitPct = (netProfit / initialCapital) * 100;

  backtestResults[tf] = {
    'Timeframe': tf,
    'ช่วงแบคเทส': `${startDateStr} ถึง ${endDateStr}`,
    'เทรดทั้งหมด': totalTrades,
    'ชนะ (Win)': winningTrades,
    'แพ้ (Loss)': losingTrades,
    'Win Rate (%)': winRate.toFixed(2) + '%',
    'กำไรสุทธิ ($)': (netProfit >= 0 ? '+' : '') + '$' + netProfit.toFixed(2),
    'กำไรสุทธิ (%)': (netProfit >= 0 ? '+' : '') + netProfitPct.toFixed(2) + '%',
    'ยอดคงเหลือ': '$' + balance.toFixed(2)
  };

  fullTradeLogs[tf] = tradeLog;
});

console.log('========================================================================');
console.log('📊 สรุปผลลัพธ์แบคเทสเทรดสั้นทองคำย้อนหลัง 7 วันสุดท้าย (บัญชี Zero Spread)');
console.log('========================================================================');
console.table(Object.values(backtestResults));
console.log('========================================================================');

timeframes.forEach(tf => {
  const logs = fullTradeLogs[tf] || [];
  console.log(`\n📜 ประวัติการเดินออเดอร์สำหรับ TF ${tf} (${logs.length} ไม้):`);
  if (logs.length > 0) {
    logs.forEach(t => {
      console.log(`   [ไม้ #${t.id}] ${t.dir.padEnd(4)} | เข้า: ${t.entryTimeStr} @ \$${t.entry.toFixed(2)} | ออก: ${t.exitTimeStr} @ \$${t.exit.toFixed(2)}`);
      console.log(`            SL: \$${t.sl.toFixed(2)} | TP: \$${t.tp.toFixed(2)} | ล็อต: ${t.lot.toFixed(2)}`);
      console.log(`            กำไรดิบ: \$${(t.rawPnL >= 0 ? '+' : '') + t.rawPnL.toFixed(2)} | คอมมิชชั่น Zero: -\$${t.spreadCost.toFixed(2)} | กำไรสุทธิ: \$${(t.netPnL >= 0 ? '+' : '') + t.netPnL.toFixed(2)} | ผล: ${t.result === 'WIN' ? '🟢 WIN' : '🔴 LOSS'}`);
    });
  } else {
    console.log('   (ไม่มีการออกออเดอร์ในช่วงเวลาดังกล่าว เนื่องจากระบบคัดกรองความปลอดภัยอย่างเข้มงวด)');
  }
  console.log('------------------------------------------------------------------------');
});
