const fs = require('fs');
const path = require('path');

// ── Mock Browser Environment for Indicators Scope ───────────────────────
global.document = {
  getElementById: (id) => {
    if (id === 'r-balance') return { value: '50' };
    if (id === 'r-risk-pct') return { value: '5' };
    return null;
  }
};
global.window = {};
global.Market = {
  closes(candles) { return candles.map(c => c.close); },
  highs(candles)  { return candles.map(c => c.high); },
  lows(candles)   { return candles.map(c => c.low); },
  prices: { dxy: 104.50, dxyPct: -0.25 } // Mocked DXY price and daily percentage change
};

// Load calculation modules
try {
  let indicatorsCode = fs.readFileSync(path.join(__dirname, 'js/indicators.js'), 'utf8');
  indicatorsCode = indicatorsCode.replace('const Indicators =', 'global.Indicators =');
  eval(indicatorsCode);
  
  let analysisCode = fs.readFileSync(path.join(__dirname, 'js/analysis.js'), 'utf8');
  analysisCode = analysisCode.replace('const Analysis =', 'global.Analysis =');
  analysisCode = analysisCode.replace(/this\.renderResults.*/, '// Render mocked');
  analysisCode = analysisCode.replace(/window\.App.*/, '// App mocked');
  eval(analysisCode);
} catch (e) {
  console.error('❌ ไม่สามารถโหลดไฟล์โครงการได้:', e.message);
  process.exit(1);
}

// ── Generate 3 Months of Hourly candles (Mocking Real Market Behavior) ────
function generate3MonthsMockCandles() {
  console.log('📦 กำลังสร้างประวัติราคาทองคำ XAUUSD (1h) ย้อนหลัง 3 เดือนเชิงโครงสร้าง (2,160 แท่ง)...');
  const candles = [];
  const startPrice = 2320; // Start around 2320
  let currentPrice = startPrice;
  const now = Date.now();
  const step = 3600000; // 1-hour step

  for (let i = 0; i < 2160; i++) {
    // Generate structural macro-cycles using sine waves + macro trend + noise
    // Long term uptrend (representing the recent gold bull run)
    const macroTrend = (i / 2160) * 120; // +120 dollars over 3 months
    // Medium-term swing cycles (each cycle lasts approx. 6 days or 144 bars)
    const midCycle = Math.sin(i / 30) * 22; 
    // Small intraday cycles (approx. 24 bars)
    const dayCycle = Math.sin(i / 4) * 5;
    
    // Intraday volatility noise
    const noise = (Math.random() - 0.5) * 6;
    
    const close = startPrice + macroTrend + midCycle + dayCycle + noise;
    const open = i === 0 ? startPrice : candles[i - 1].close;
    
    // High/Low spread based on volatility
    const spread = Math.random() * 5 + 1;
    const high = Math.max(open, close) + spread * 0.4;
    const low = Math.min(open, close) - spread * 0.4;

    candles.push({
      time: now - (2159 - i) * step,
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 8000) + 2000
    });
  }
  return candles;
}

// ── Backtest Simulator Engine ───────────────────────────────────────────
async function runBacktest() {
  try {
    const candles = generate3MonthsMockCandles();
    if (candles.length < 200) {
      console.error('❌ ข้อมูลประวัติราคาไม่เพียงพอสำหรับการทำ Backtest 3 เดือน');
      return;
    }
    
    const startDate = new Date(candles[0].time).toLocaleDateString('th-TH');
    const endDate = new Date(candles[candles.length - 1].time).toLocaleDateString('th-TH');
    
    console.log(`📊 โหลดข้อมูลสำเร็จ! ทั้งหมด ${candles.length} แท่งเทียนย้อนหลัง 3 เดือน`);
    console.log(`📅 ช่วงเวลาจำลอง: ${startDate} ถึง ${endDate}`);
    console.log('🔄 เริ่มต้นระบบจำลองกลยุทธ์ OTE + 5-Bar Fractal (Walk-forward Simulation)...');

    let balance = 50; // Starting Balance $50
    const riskPct = 5;   // Risk 5% per trade ($2.50 at start)
    
    let totalTrades = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let activeTrade = null;
    let maxDrawdown = 0;
    let peakBalance = balance;
    let tradeLog = [];

    // Walk forward simulation: Start after having at least 100 candles for indicators
    for (let i = 100; i < candles.length; i++) {
      const currentCandle = candles[i];
      
      // 1. If there's an active trade, check if it hits TP or SL in the current bar
      if (activeTrade) {
        if (activeTrade.dir === 'BUY') {
          // Check SL first (conservative approach)
          if (currentCandle.low <= activeTrade.sl) {
            // Hit Stop Loss
            const lossVal = activeTrade.riskUsd;
            balance -= lossVal;
            losingTrades++;
            tradeLog.push({ ...activeTrade, result: 'LOSS', exitPrice: activeTrade.sl, profitUsd: -lossVal, exitTime: currentCandle.time });
            activeTrade = null;
          } else if (currentCandle.high >= activeTrade.tp) {
            // Hit Take Profit
            const profitVal = activeTrade.riskUsd * activeTrade.rr;
            balance += profitVal;
            winningTrades++;
            tradeLog.push({ ...activeTrade, result: 'WIN', exitPrice: activeTrade.tp, profitUsd: profitVal, exitTime: currentCandle.time });
            activeTrade = null;
          }
        } else if (activeTrade.dir === 'SELL') {
          // Check SL first
          if (currentCandle.high >= activeTrade.sl) {
            // Hit Stop Loss
            const lossVal = activeTrade.riskUsd;
            balance -= lossVal;
            losingTrades++;
            tradeLog.push({ ...activeTrade, result: 'LOSS', exitPrice: activeTrade.sl, profitUsd: -lossVal, exitTime: currentCandle.time });
            activeTrade = null;
          } else if (currentCandle.low <= activeTrade.tp) {
            // Hit Take Profit
            const profitVal = activeTrade.riskUsd * activeTrade.rr;
            balance += profitVal;
            winningTrades++;
            tradeLog.push({ ...activeTrade, result: 'WIN', exitPrice: activeTrade.tp, profitUsd: profitVal, exitTime: currentCandle.time });
            activeTrade = null;
          }
        }
        
        // Track Peak and Drawdown
        if (balance > peakBalance) peakBalance = balance;
        const drawdown = ((peakBalance - balance) / peakBalance) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        
        continue; // Don't open new trade if one is active
      }

      // 2. Scan indicators on the history up to current candle (slice to avoid future leak)
      const history = candles.slice(0, i);
      const closes = history.map(c => c.close);
      const highs  = history.map(c => c.high);
      const lows   = history.map(c => c.low);
      const lastPrice = closes[closes.length - 1];

      const rsiVal = Indicators.rsi(closes);
      const macdVal = Indicators.macd(closes);
      const emaData = Indicators.emaTrend(closes);
      const score = Indicators.signalScore({ rsi: rsiVal, macd: macdVal, emaTrend: emaData });
      
      if (score.direction === 'NEUTRAL') continue;

      const swings = Indicators.swingPoints(highs, lows, 100);
      const fiboLevels = Indicators.fibonacci(swings.swingHigh, swings.swingLow, score.direction === 'BUY');
      const ote = fiboLevels.find(f => f.isOte);
      const ob = Indicators.orderBlock(history, score.direction);
      const atrVal = Indicators.atr(highs, lows, closes) || (lastPrice * 0.003);

      // 3. Generate Trade Plan
      const plan = Analysis.buildTradePlan({
        asset: 'XAUUSD',
        tf: '1h',
        last: lastPrice,
        score,
        rsiVal,
        atrVal,
        fiboLevels,
        pivotData: { r2: 0, r1: 0, pp: 0, s1: 0, s2: 0 }, // not needed for plan execution
        ob,
        swings
      });

      if (plan.dir === 'NEUTRAL') continue;

      // 4. Trigger Entry: If the price in current bar touches our OTE (or we enter near it)
      const entryPrice = plan.entry;
      let triggered = false;
      
      if (plan.dir === 'BUY') {
        // If price dips into or below our Entry limit
        if (currentCandle.low <= entryPrice && currentCandle.high >= entryPrice) {
          triggered = true;
        }
      } else {
        // If price spikes up into or above our Entry limit
        if (currentCandle.high >= entryPrice && currentCandle.low <= entryPrice) {
          triggered = true;
        }
      }

      if (triggered) {
        const riskUsd = balance * riskPct / 100;
        
        // Calculate Lot with minimum 0.01 limit
        const slDist = Math.abs(entryPrice - plan.sl);
        let lotVal = slDist > 0 ? riskUsd / (slDist * 100) : 0;
        if (lotVal > 0 && lotVal < 0.01) lotVal = 0.01;

        activeTrade = {
          id: ++totalTrades,
          dir: plan.dir,
          entry: entryPrice,
          sl: plan.sl,
          tp: plan.tp,
          lot: lotVal,
          rr: parseFloat(plan.rr),
          riskUsd,
          entryTime: currentCandle.time
        };
      }
    }

    // ── Print Backtest Report ──────────────────────────────────────────────
    console.log('\n=============================================================');
    console.log('📈 รายงานผลการทดสอบระบบย้อนหลัง 3 เดือน (Backtest Summary)');
    console.log('=============================================================');
    console.log(`💵 ทุนเริ่มต้นในการทดสอบ : \$50.00`);
    console.log(`💵 เงินทุนในพอร์ตปัจจุบัน : \$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`📈 กำไร/ขาดทุนสุทธิ     : \$${(balance - 50).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${((balance - 50) * 2).toFixed(2)}%)`);
    console.log(`🔥 ความเสี่ยงต่อไม้     : ${riskPct}% (\$${(2.5).toFixed(2)})`);
    console.log(`📊 จำนวนไม้เทรดทั้งหมด   : ${totalTrades} ไม้`);
    console.log(`🟢 ชนะออเดอร์ (Win)     : ${winningTrades} ไม้`);
    console.log(`🔴 แพ้ออเดอร์ (Loss)    : ${losingTrades} ไม้`);
    
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    console.log(`🏆 อัตราชนะ (Win Rate)  : ${winRate.toFixed(2)}%`);
    console.log(`📉 ยอดจมสูงสุด (Max DD)  : ${maxDrawdown.toFixed(2)}%`);
    console.log('=============================================================');

    if (tradeLog.length > 0) {
      console.log('\n📜 ประวัติออเดอร์ล่าสุด 5 รายการ:');
      tradeLog.slice(-5).forEach(t => {
        const date = new Date(t.entryTime).toLocaleDateString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        console.log(`   [${date}] ${t.dir.padEnd(4)} @ \$${t.entry.toFixed(2)} | SL: \$${t.sl.toFixed(2)} | TP: \$${t.tp.toFixed(2)} | R:R ${t.rr}:1 | Lot: ${t.lot.toFixed(2)} | ผล: ${t.result === 'WIN' ? '🟢 WIN (+$' + t.profitUsd.toFixed(2) + ')' : '🔴 LOSS (-$' + Math.abs(t.profitUsd).toFixed(2) + ')'}`);
      });
      console.log('=============================================================');
    }

  } catch (e) {
    console.error('❌ เกิดข้อผิดพลาดในการคำนวณย้อนหลัง 3 เดือน:', e.message);
  }
}

runBacktest();
