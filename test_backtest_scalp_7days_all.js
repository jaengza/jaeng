const fs = require('fs');
const path = require('path');

console.log('========================================================================');
console.log('⚡ kesineTrader Pro — ระบบแบคเทสย้อนหลัง 7 วันจำเพาะ (3 สินทรัพย์: XAUUSD, BTC, ETH)');
console.log('========================================================================\n');

// ── 1. MOCK ENVIRONMENT ──────────────────────────────────────────────────
let currentAccountType = 'zero'; // จะเปลี่ยนตามลูปแบคเทส
global.document = {
  getElementById: (id) => {
    if (id === 'r-balance') return { value: '50' };
    if (id === 'r-risk-pct') return { value: '5' }; // 5% risk ($2.50)
    if (id === 'an-scalping-mode') return { checked: true }; // เปิดโหมดเทรดสั้นสไนเปอร์
    if (id === 'r-acct-type') return { value: currentAccountType };
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
  
  console.log('🟢 โหลดโมดูล SMC/ICT (Indicators & Analysis) สำเร็จ!');
} catch (e) {
  console.error('❌ ข้อผิดพลาดในการโหลดไฟล์โมดูล:', e.message);
  process.exit(1);
}

// ── 3. DEFINE PATHS & UTILITIES ──────────────────────────────────────────
const DATA_BASE_DIR = 'G:/My Drive/04_ระบบเทรดและบอทเทรด/04_Legacy_Projects/botjaeng/3.Data';
const assets = ['XAUUSD', 'BTCUSD', 'ETHUSD'];
const timeframes = ['5m', '15m'];
const accountTypes = ['standard', 'zero'];

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

// ── 4. RUN SIMULATION FOR ALL CONFIGURATIONS ─────────────────────────────
const backtestSummary = [];
const allTradeLogs = [];

assets.forEach(asset => {
  const assetFolder = asset;
  
  timeframes.forEach(tf => {
    // โหลดข้อมูล CSV
    const fileName = `${asset}m_${tf === '5m' ? 'M5' : 'M15'}.csv`;
    const filePath = path.join(DATA_BASE_DIR, assetFolder, fileName);
    
    let candles = [];
    try {
      candles = parseCSV(filePath);
    } catch (e) {
      console.warn(`⚠️ ไม่พบข้อมูลสำหรับ ${asset} TF ${tf} ที่เส้นทาง ${filePath} - ข้าม...`);
      return;
    }

    if (candles.length === 0) return;

    // หาเวลาเริ่มต้น-สิ้นสุด 7 วันสุดท้ายของชุดข้อมูลนั้นๆ
    const lastCandle = candles[candles.length - 1];
    const endTime = lastCandle.time;
    const startTime = endTime - 7 * 24 * 60 * 60 * 1000;

    const startDateStr = new Date(startTime).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const endDateStr = new Date(endTime).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

    let startIndex = -1;
    for (let i = 0; i < candles.length; i++) {
      if (candles[i].time >= startTime) {
        startIndex = i;
        break;
      }
    }
    if (startIndex === -1) return;

    // รันแบคเทสสำหรับบัญชีแต่ละประเภท
    accountTypes.forEach(acctType => {
      currentAccountType = acctType;
      
      let balance = 50.00;
      const initialCapital = 50.00;
      const riskPct = 5.0; // 5% risk ($2.50)
      
      let totalTrades = 0;
      let winningTrades = 0;
      let losingTrades = 0;
      let activeTrade = null;
      let maxDrawdown = 0;
      let peakBalance = balance;
      let tradeLog = [];

      // ตัวคูณมูลค่าจุด (Multiplier) และค่าสเปรด/คอมมิชชั่น
      let multiplier = 10;
      if (asset === 'XAUUSD') multiplier = 100;
      else if (asset === 'BTCUSD' || asset === 'ETHUSD') multiplier = 1;

      // ลูปข้อมูลแต่ละแท่ง
      for (let i = startIndex; i < candles.length; i++) {
        const currentCandle = candles[i];

        // 1. ตรวจสอบสถานะออเดอร์เปิดอยู่
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
            // คำนวณค่าธรรมเนียมจริง Exness
            let spreadCost = 0;
            if (acctType === 'zero') {
              if (asset === 'XAUUSD') {
                spreadCost = 7 * 1.0 * activeTrade.lot; // $0.07 commission for 0.01 lot
              } else {
                spreadCost = 70 * 0.01 * activeTrade.lot; // $0.007 commission for 0.01 lot (BTC/ETH)
              }
            } else {
              // บัญชีสแตนดาร์ด
              if (asset === 'XAUUSD') {
                spreadCost = 25 * 1.0 * activeTrade.lot; // สเปรดเฉลี่ย 25 จุด ($0.25 ต่อ 0.01 lot)
              } else if (asset === 'BTCUSD') {
                spreadCost = 2150 * 0.01 * activeTrade.lot; // $0.215 ต่อ 0.01 lot
              } else if (asset === 'ETHUSD') {
                spreadCost = 160 * 0.01 * activeTrade.lot; // $0.016 ต่อ 0.01 lot
              }
            }

            const netPnL = pnl - spreadCost;
            balance += netPnL;

            if (result === 'WIN') winningTrades++;
            else losingTrades++;

            tradeLog.push({
              id: ++totalTrades,
              asset: asset,
              acctType: acctType,
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

        // 2. ค้นหาสัญญาณเทรดใหม่
        const history = candles.slice(0, i);
        if (history.length < 30) continue;

        const closes = history.map(c => c.close);
        const highs  = history.map(c => c.high);
        const lows   = history.map(c => c.low);
        const lastPrice = closes[closes.length - 1];

        let lookback = tf === '5m' ? 30 : 50;
        let threshold = 5; // ระดับกรองสัญญาณเข้มงวดที่สุดสหรับการสไนเปอร์

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
          asset: asset === 'BTCUSD' ? 'BTCUSDT' : (asset === 'ETHUSD' ? 'ETHUSDT' : asset), // แปลงชื่อเพื่อรองรับ analysis.js
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

        // กรองความเสี่ยง
        const slDist = Math.abs(plan.entry - plan.sl);
        const riskAtMinLotUsd = slDist * multiplier * 0.01;
        const maxAllowedRiskUsd = tf === '5m' ? 3.50 : 10.00;
        if (riskAtMinLotUsd > maxAllowedRiskUsd) continue;

        // ตรวจสอบ trigger
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
          let lotVal = slDist > 0 ? riskUsd / (slDist * multiplier) : 0.01;
          if (lotVal < 0.01) lotVal = 0.01;
          lotVal = Math.floor(lotVal * 100) / 100;

          activeTrade = {
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

      backtestSummary.push({
        'Asset': asset,
        'Timeframe': tf,
        'Account': acctType.toUpperCase(),
        'Trades': totalTrades,
        'Win': winningTrades,
        'Loss': losingTrades,
        'WinRate': winRate.toFixed(1) + '%',
        'Net Profit': (netProfit >= 0 ? '+' : '') + '$' + netProfit.toFixed(2),
        'Profit %': (netProfit >= 0 ? '+' : '') + netProfitPct.toFixed(1) + '%',
        'Final Bal': '$' + balance.toFixed(2),
        'Max DD': maxDrawdown.toFixed(1) + '%'
      });

      if (tradeLog.length > 0) {
        allTradeLogs.push(...tradeLog);
      }
    });
  });
});

console.log('========================================================================');
console.log('📊 ตารางสรุปเปรียบเทียบผลลัพธ์แบคเทสย้อนหลัง 7 วัน (Standard VS Zero Spread)');
console.log('========================================================================');
console.table(backtestSummary);
console.log('========================================================================\n');

console.log('📜 ประวัติการเดินออเดอร์ของระบบสไนเปอร์เทรดสั้น (เฉพาะออเดอร์ที่มีการเดินจริง):');
console.log('------------------------------------------------------------------------');

if (allTradeLogs.length > 0) {
  // กรองเฉพาะบัญชี ZERO เพื่อแสดงเป็นตัวอย่างที่ดีที่สุดให้ผู้ใช้เห็นความคุ้มค่า
  const zeroLogs = allTradeLogs.filter(t => t.acctType === 'zero');
  if (zeroLogs.length > 0) {
    console.log('💎 บัญชี Zero Spread (คอมมิชชั่นต่ำพิเศษ):');
    zeroLogs.forEach(t => {
      console.log(`   [${t.asset} TF ${t.tf || '15m'}] ${t.dir.padEnd(4)} | เข้า: ${t.entryTimeStr} @ \$${t.entry.toFixed(2)} | ออก: ${t.exitTimeStr} @ \$${t.exit.toFixed(2)}`);
      console.log(`            SL: \$${t.sl.toFixed(2)} | TP: \$${t.tp.toFixed(2)} | ขนาดล็อต: ${t.lot.toFixed(2)} lot`);
      console.log(`            กำไรดิบ: \$${(t.rawPnL >= 0 ? '+' : '') + t.rawPnL.toFixed(2)} | คอมมิชชั่น: -\$${t.spreadCost.toFixed(3)} | กำไรสุทธิ: \$${(t.netPnL >= 0 ? '+' : '') + t.netPnL.toFixed(2)} | ผลลัพธ์: ${t.result === 'WIN' ? '🟢 WIN' : '🔴 LOSS'}`);
      console.log('   ---------------------------------------------------------------------');
    });
  }

  const standardLogs = allTradeLogs.filter(t => t.acctType === 'standard');
  if (standardLogs.length > 0) {
    console.log('\n🔸 บัญชี Standard (โดนผลกระทบจาก Spread):');
    standardLogs.forEach(t => {
      console.log(`   [${t.asset} TF ${t.tf || '15m'}] ${t.dir.padEnd(4)} | เข้า: ${t.entryTimeStr} @ \$${t.entry.toFixed(2)} | ออก: ${t.exitTimeStr} @ \$${t.exit.toFixed(2)}`);
      console.log(`            SL: \$${t.sl.toFixed(2)} | TP: \$${t.tp.toFixed(2)} | ขนาดล็อต: ${t.lot.toFixed(2)} lot`);
      console.log(`            กำไรดิบ: \$${(t.rawPnL >= 0 ? '+' : '') + t.rawPnL.toFixed(2)} | สเปรดเฉลี่ย: -\$${t.spreadCost.toFixed(3)} | กำไรสุทธิ: \$${(t.netPnL >= 0 ? '+' : '') + t.netPnL.toFixed(2)} | ผลลัพธ์: ${t.result === 'WIN' ? '🟢 WIN' : '🔴 LOSS'}`);
      console.log('   ---------------------------------------------------------------------');
    });
  }
} else {
  console.log('   (ไม่มีการเข้าออเดอร์ในทั้ง 3 สินทรัพย์เนื่องจากสภาวะความผันผวนสูงเกินระดับความปลอดภัย 5% หรือไม่เข้าเงื่อนไขตัวบ่งชี้เทคนิค)');
}
console.log('========================================================================');
