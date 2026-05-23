const fs = require('fs');
const path = require('path');

console.log('========================================================================');
console.log('⚡ SASP — ระบบแบคเทสย้อนหลัง 7 วัน สำหรับบัญชี Standard (XAUUSD, BTC, ETH)');
console.log('========================================================================\n');

// ── 1. MOCK ENVIRONMENT ──────────────────────────────────────────────────
global.document = {
  getElementById: (id) => {
    if (id === 'r-balance') return { value: '50' };
    if (id === 'r-risk-pct') return { value: '5' }; // 5% risk ($2.50)
    if (id === 'an-scalping-mode') return { checked: true }; // เปิดโหมดเทรดสั้นสไนเปอร์
    if (id === 'r-acct-type') return { value: 'standard' }; // บัญชี Standard 100%
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
  
  console.log('🟢 โหลดโมดูล SMC/ICT (Indicators & Analysis) SASP สำเร็จ!');
} catch (e) {
  console.error('❌ ข้อผิดพลาดในการโหลดไฟล์โมดูล:', e.message);
  process.exit(1);
}

// ── 3. DEFINE PATHS & UTILITIES ──────────────────────────────────────────
const DATA_BASE_DIR = 'G:/My Drive/04_ระบบเทรดและบอทเทรด/04_Legacy_Projects/botjaeng/3.Data';
const assets = ['XAUUSD', 'BTCUSD', 'ETHUSD'];
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
    const riskPct = 5.0; // 5% risk ($2.50)
    
    let totalTrades = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let activeTrade = null;
    let pendingOrder = null;
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

      // 1. ตรวจสอบสถานะออเดอร์เปิดอยู่ (Active Trade)
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
          // คำนวณค่าธรรมเนียมสเปรดจริงของบัญชี Standard ของ Exness
          let spreadCost = 0;
          if (asset === 'XAUUSD') {
            spreadCost = 25 * 1.0 * activeTrade.lot; // สเปรดเฉลี่ย 25 จุด ($0.25 ต่อ 0.01 lot)
          } else if (asset === 'BTCUSD') {
            spreadCost = 2150 * 0.01 * activeTrade.lot; // $0.215 ต่อ 0.01 lot
          } else if (asset === 'ETHUSD') {
            spreadCost = 160 * 0.01 * activeTrade.lot; // $0.016 ต่อ 0.01 lot
          }

          const netPnL = pnl - spreadCost;
          balance += netPnL;

          if (result === 'WIN') winningTrades++;
          else losingTrades++;

          tradeLog.push({
            id: ++totalTrades,
            asset: asset,
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
            exitTimeStr: currentCandle.timeStr,
            fiboPct: activeTrade.fiboPct
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

      // 2. ตรวจสอบและดำเนินการ Pending Limit Order
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
            entryTimeStr: currentCandle.timeStr,
            fiboPct: pendingOrder.fiboPct
          };
          pendingOrder = null;
          
          // ตรวจสอบการปิดทันทีในแท่งเดียวกัน (Same-candle fill & resolution)
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
            let spreadCost = 0;
            if (asset === 'XAUUSD') {
              spreadCost = 25 * 1.0 * activeTrade.lot;
            } else if (asset === 'BTCUSD') {
              spreadCost = 2150 * 0.01 * activeTrade.lot;
            } else if (asset === 'ETHUSD') {
              spreadCost = 160 * 0.01 * activeTrade.lot;
            }

            const netPnL = pnl - spreadCost;
            balance += netPnL;

            if (result === 'WIN') winningTrades++;
            else losingTrades++;

            tradeLog.push({
              id: ++totalTrades,
              asset: asset,
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
              exitTimeStr: currentCandle.timeStr,
              fiboPct: activeTrade.fiboPct
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

          continue; // ดำเนินการต่อแท่งถัดไป
        }

        // ตรวจสอบการยกเลิก Pending (Invalidation) เมื่อราคาวิ่งเลย TP หรือ SL ไปก่อนจะเกี่ยวติด
        let invalidated = false;
        if (pendingOrder.dir === 'BUY') {
          if (currentCandle.high >= pendingOrder.tp) {
            invalidated = true; // ราคาถึงเป้า TP โดยไม่เกี่ยวออเดอร์
          } else if (currentCandle.low <= pendingOrder.sl) {
            invalidated = true; // ราคาทะลุ SL ไปก่อน
          }
        } else if (pendingOrder.dir === 'SELL') {
          if (currentCandle.low <= pendingOrder.tp) {
            invalidated = true;
          } else if (currentCandle.high >= pendingOrder.sl) {
            invalidated = true;
          }
        }

        if (!invalidated) {
          pendingOrder.candlesLeft--;
          if (pendingOrder.candlesLeft <= 0) {
            invalidated = true; // หมดเวลาออเดอร์ Pending
          }
        }

        if (invalidated) {
          pendingOrder = null;
        }
      }

      // 3. ค้นหาสัญญาณเทรดใหม่ (Scan for New Signal)
      const history = candles.slice(0, i);
      if (history.length < 30) continue;

      const closes = history.map(c => c.close);
      const highs  = history.map(c => c.high);
      const lows   = history.map(c => c.low);
      const lastPrice = closes[closes.length - 1];

      // ใช้ threshold = 4 ตามที่ SASP ปรับจังหวะให้กระชับขึ้น
      let lookback = tf === '5m' ? 30 : 50;
      let threshold = 4.0; 

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
        asset: asset === 'BTCUSD' ? 'BTCUSDT' : (asset === 'ETHUSD' ? 'ETHUSDT' : asset),
        tf: tf,
        last: lastPrice,
        score,
        rsiVal,
        atrVal,
        fiboLevels,
        ob,
        swings
      });

      if (plan.dir === 'NEUTRAL' || plan.isOverRisk) continue;

      // สร้าง หรือ อัปเดต Pending Order ตัวใหม่
      let lotVal = parseFloat(plan.lot);
      if (isNaN(lotVal) || lotVal < 0.01) lotVal = 0.01;
      const fibPct = plan.safetyRecommendation.match(/Fibo\s*<b>(\d+\.?\d*)%<\/b>/)?.[1] || '70.5';

      pendingOrder = {
        dir: plan.dir,
        entry: plan.entry,
        sl: plan.sl,
        tp: plan.tp,
        lot: lotVal,
        fiboPct: fibPct,
        candlesLeft: tf === '5m' ? 20 : 12,
        setupTimeStr: currentCandle.timeStr
      };
    }

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const netProfit = balance - initialCapital;
    const netProfitPct = (netProfit / initialCapital) * 100;

    backtestSummary.push({
      'Asset': asset,
      'Timeframe': tf,
      'Account': 'STANDARD',
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

console.log('========================================================================');
console.log('📊 ตารางสรุปแบคเทสย้อนหลัง 7 วัน บัญชี Standard ด้วยระบบ SASP');
console.log('========================================================================');
console.table(backtestSummary);
console.log('========================================================================\n');

console.log('📜 ประวัติการเดินออเดอร์ของระบบ SASP (บัญชี Standard):');
console.log('------------------------------------------------------------------------');

if (allTradeLogs.length > 0) {
  allTradeLogs.forEach(t => {
    console.log(`   [${t.asset} TF ${t.netPnL >= 0 ? '🟢 WIN' : '🔴 LOSS'}] ${t.dir} | เข้า: ${t.entryTimeStr} @ \$${t.entry.toFixed(2)} | ออก: ${t.exitTimeStr} @ \$${t.exit.toFixed(2)}`);
    console.log(`            SL: \$${t.sl.toFixed(2)} | TP: \$${t.tp.toFixed(2)} | Lot: ${t.lot.toFixed(2)} | ระดับ Fibo: ${t.fiboPct}%`);
    console.log(`            กำไรดิบ: \$${(t.rawPnL >= 0 ? '+' : '') + t.rawPnL.toFixed(2)} | สเปรด Standard: -\$${t.spreadCost.toFixed(3)} | กำไรสุทธิ: \$${(t.netPnL >= 0 ? '+' : '') + t.netPnL.toFixed(2)}`);
    console.log('   ---------------------------------------------------------------------');
  });
} else {
  console.log('   (ไม่มีการเข้าออเดอร์เนื่องจากไม่เข้าเงื่อนไขตัวชี้วัดหรือความผันผวนสูงกว่าเกณฑ์ความปลอดภัย)');
}
console.log('========================================================================');
