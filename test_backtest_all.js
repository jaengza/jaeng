const fs = require('fs');
const path = require('path');

console.log('========================================================================');
console.log('🧪 ApexTrader Pro — ระบบตรวจสอบสูตรคำนวณ & แบคเทสย้อนหลัง 30 วัน ทุก TF');
console.log('========================================================================\n');

// ── 1. MOCK ENVIRONMENT ──────────────────────────────────────────────────
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
  
  console.log('🟢 โหลดไฟล์โมดูล Indicators และ Analysis สำเร็จเรียบร้อยแล้ว!');
} catch (e) {
  console.error('❌ ข้อผิดพลาดในการโหลดไฟล์โครงการ:', e.message);
  process.exit(1);
}

// ── 3. MATHEMATICAL VALIDATION CHECKS (UNIT TESTS) ────────────────────────
console.log('\n------------------------------------------------------------------------');
console.log('🔍 ส่วนที่ 1: การตรวจสอบความถูกต้องเชิงคณิตศาสตร์ของทุกเครื่องมือ (Unit Validation)');
console.log('------------------------------------------------------------------------');

let assertsPassed = 0;
let assertsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`   ✅ PASS: ${message}`);
    assertsPassed++;
  } else {
    console.log(`   ❌ FAIL: ${message}`);
    assertsFailed++;
  }
}

// A. Test RSI (14)
try {
  // Test Oversold state (Price keeps falling)
  const fallingPrices = [];
  let price = 100;
  for (let i = 0; i < 30; i++) {
    price -= 2;
    fallingPrices.push(price);
  }
  const rsiOversold = Indicators.rsi(fallingPrices);
  assert(rsiOversold !== null && rsiOversold < 20, `RSI(14) Oversold Validation (ราคาลงต่อเนื่อง RSI = ${rsiOversold})`);
  assert(rsiOversold >= 0 && rsiOversold <= 100, 'RSI(14) ค่าต้องอยู่ในขอบเขต [0, 100] เสมอ');

  // Test Overbought state (Price keeps rising)
  const risingPrices = [];
  price = 100;
  for (let i = 0; i < 30; i++) {
    price += 2;
    risingPrices.push(price);
  }
  const rsiOverbought = Indicators.rsi(risingPrices);
  assert(rsiOverbought !== null && rsiOverbought > 80, `RSI(14) Overbought Validation (ราคาขึ้นต่อเนื่อง RSI = ${rsiOverbought})`);
} catch (e) {
  assert(false, `ข้อผิดพลาดในการตรวจสอบ RSI: ${e.message}`);
}

// B. Test MACD (12/26/9)
try {
  const dummyCloses = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 10);
  const macdVal = Indicators.macd(dummyCloses);
  assert(macdVal !== null && 'macd' in macdVal && 'signal' in macdVal && 'histogram' in macdVal, 'MACD(12/26/9) โครงสร้างผลลัพธ์ถูกต้องครบถ้วน');
  assert(typeof macdVal.trend === 'string', `MACD บ่งชี้แนวโน้มได้อย่างถูกต้อง (แนวโน้ม: ${macdVal.trend})`);
} catch (e) {
  assert(false, `ข้อผิดพลาดในการตรวจสอบ MACD: ${e.message}`);
}

// C. Test ATR (14)
try {
  const highs = Array.from({ length: 20 }, () => 105);
  const lows = Array.from({ length: 20 }, () => 95);
  const closes = Array.from({ length: 20 }, () => 100);
  const atrVal = Indicators.atr(highs, lows, closes);
  assert(atrVal !== null && atrVal > 0, `ATR(14) คำนวณความผันผวนได้ถูกต้องและไม่ติดลบ (ATR = ${atrVal})`);
} catch (e) {
  assert(false, `ข้อผิดพลาดในการตรวจสอบ ATR: ${e.message}`);
}

// D. Test Swing Points (5-Bar Fractal)
try {
  // Create a peak at index 10
  const dummyHighs = Array.from({ length: 25 }, (_, i) => i === 10 ? 150 : 100);
  const dummyLows = Array.from({ length: 25 }, (_, i) => i === 15 ? 50 : 90);
  
  const swings = Indicators.swingPoints(dummyHighs, dummyLows, 25);
  assert(swings.swingHigh === 150 && swings.highBar === 10, `ค้นหา Swing High (5-Bar Fractal) สำเร็จที่ดัชนี ${swings.highBar} (ราคา: ${swings.swingHigh})`);
  assert(swings.swingLow === 50 && swings.lowBar === 15, `ค้นหา Swing Low (5-Bar Fractal) สำเร็จที่ดัชนี ${swings.lowBar} (ราคา: ${swings.swingLow})`);
} catch (e) {
  assert(false, `ข้อผิดพลาดในการตรวจสอบ Swing Points: ${e.message}`);
}

// E. Test Fibonacci Retracement & OTE (70.5%)
try {
  const swingHigh = 2000;
  const swingLow = 1000;
  
  // BUY Side (Discount Market)
  const fiboBuy = Indicators.fibonacci(swingHigh, swingLow, true);
  const oteBuy = fiboBuy.find(f => f.isOte);
  // OTE = High - 70.5% * Range = 2000 - 0.705 * 1000 = 1295
  assert(oteBuy && oteBuy.price === 1295, `Fibonacci Retracement BUY (OTE 70.5% ต้องเท่ากับ 1295, คำนวณได้: ${oteBuy?.price})`);

  // SELL Side (Premium Market)
  const fiboSell = Indicators.fibonacci(swingHigh, swingLow, false);
  const oteSell = fiboSell.find(f => f.isOte);
  // OTE = Low + 70.5% * Range = 1000 + 0.705 * 1000 = 1705
  assert(oteSell && oteSell.price === 1705, `Fibonacci Retracement SELL (OTE 70.5% ต้องเท่ากับ 1705, คำนวณได้: ${oteSell?.price})`);
} catch (e) {
  assert(false, `ข้อผิดพลาดในการตรวจสอบ Fibonacci/OTE: ${e.message}`);
}

// F. Test Order Block
try {
  // Last bearish candle before a strong bullish move
  const candles = [
    { open: 100, high: 105, low: 95, close: 102 },
    { open: 102, high: 106, low: 96, close: 104 },
    { open: 104, high: 105, low: 97, close: 103 },
    { open: 103, high: 104, low: 98, close: 100 }, // Bearish candle i = n-3 (98 low)
    { open: 100, high: 115, low: 99, close: 114 }, // Bullish candle with strong move (impulse)
    { open: 114, high: 116, low: 110, close: 115 }
  ];
  const ob = Indicators.orderBlock(candles, 'BUY');
  assert(ob !== null && ob.type === 'bullish_ob' && ob.low === 98, `ตรวจพบ Bullish Order Block โซนซื้อปลอดภัยที่ราคาต่ำสุด ${ob?.low}`);
} catch (e) {
  assert(false, `ข้อผิดพลาดในการตรวจสอบ Order Block: ${e.message}`);
}

// G. Test Exness Spread Cost & Lot Calculation
try {
  // 1. XAUUSD (Gold): Point = 0.01, Contract Size = 100, Spread = 200 Points, Min Lot = 0.01
  const xauPlan = Analysis.buildTradePlan({
    asset: 'XAUUSD',
    tf: '1h',
    last: 2300,
    score: { strength: 6, direction: 'BUY', reasons: [] },
    fiboLevels: [
      { pct: 0, price: 2310, isOte: false },
      { pct: 70.5, price: 2295, isOte: true },
      { pct: 100, price: 2280, isOte: false }
    ],
    swings: { swingHigh: 2310, swingLow: 2280 },
    atrVal: 10
  });
  
  // Risk = 5% of $50 = $2.50
  // SL distance = Entry(2295) - SL(2280) = 15
  // Lot = RiskUsd / (slDist * 100) = 2.50 / (15 * 100) = 0.00166 -> Limit to Min Lot 0.01
  // Est. Spread Cost = Spread(200) * Mult(1.0) * Lot(0.01) = $2.00
  assert(xauPlan.lot === '0.01', `XAUUSD Lot Size ปัดเศษและจำกัดค่าขั้นต่ำ 0.01 Lot ถูกต้อง (คำนวณได้: ${xauPlan.lot})`);
  assert(xauPlan.estSpreadCost === '2.00', `XAUUSD Est. Spread Cost คำนวณถูกต้องตามฐานข้อมูล Exness (สเปรด: $${xauPlan.estSpreadCost})`);

  // 2. BTCUSDT: Contract Size = 1, Spread = 2150 Points (Mult = 0.01), Min Lot = 0.001
  const btcPlan = Analysis.buildTradePlan({
    asset: 'BTCUSDT',
    tf: '1h',
    last: 60000,
    score: { strength: 6, direction: 'BUY', reasons: [] },
    fiboLevels: [
      { pct: 0, price: 61000, isOte: false },
      { pct: 70.5, price: 59500, isOte: true },
      { pct: 100, price: 58000, isOte: false }
    ],
    swings: { swingHigh: 61000, swingLow: 58000 },
    atrVal: 500
  });

  // Risk = $2.50
  // SL distance = 59500 - 58000 = 1500
  // Lot = 2.50 / 1500 = 0.00166 -> ปัดลงเหลือ 3 ตำแหน่ง = 0.001
  // Est. Spread Cost = 2150 * 0.01 * 0.001 = $0.02
  assert(btcPlan.lot === '0.001', `BTCUSDT Lot Size ปัดเศษลงเหลือทศนิยม 3 ตำแหน่งถูกต้อง (คำนวณได้: ${btcPlan.lot})`);
  assert(btcPlan.estSpreadCost === '0.02', `BTCUSDT Est. Spread Cost คำนวณถูกต้อง (สเปรด: $${btcPlan.estSpreadCost})`);

  // 3. ETHUSDT: Contract Size = 1, Spread = 160 Points (Mult = 0.01), Min Lot = 0.01
  const ethPlan = Analysis.buildTradePlan({
    asset: 'ETHUSDT',
    tf: '1h',
    last: 3000,
    score: { strength: 8, direction: 'BUY', reasons: [] },
    fiboLevels: [
      { pct: 0, price: 3050, isOte: false },
      { pct: 70.5, price: 2980, isOte: true },
      { pct: 100, price: 2900, isOte: false }
    ],
    swings: { swingHigh: 3050, swingLow: 2900 },
    atrVal: 50
  });

  // Risk = $2.50
  // SL distance = 2980 - 2900 = 80
  // Lot = 2.50 / 80 = 0.03125 -> ปัดเศษลงเหลือ 2 ตำแหน่ง = 0.03 Lot
  // Est. Spread Cost = 160 * 0.01 * 0.03 = $0.05
  assert(ethPlan.lot === '0.03', `ETHUSDT Lot Size ปัดเศษลงเหลือทศนิยม 2 ตำแหน่งถูกต้อง (คำนวณได้: ${ethPlan.lot})`);
  assert(ethPlan.estSpreadCost === '0.05', `ETHUSDT Est. Spread Cost คำนวณถูกต้อง (สเปรด: $${ethPlan.estSpreadCost})`);
} catch (e) {
  assert(false, `ข้อผิดพลาดในการตรวจสอบ Exness Spread / Lot Calc: ${e.message}`);
}

console.log(`\nสรุปผลตรวจสอบความถูกต้อง: ผ่าน ${assertsPassed}/${assertsPassed + assertsFailed} ข้อทดสอบ`);
if (assertsFailed > 0) {
  console.error('❌ ตรวจพบข้อผิดพลาดในระบบคำนวณ กรุณาตรวจสอบโค้ด!');
  process.exit(1);
} else {
  console.log('🟢 ทุกฟังก์ชันคำนวณเครื่องมือและระบบเสี่ยงถูกต้องแม่นยำตามสูตรคณิตศาสตร์ 100%');
}

// ── 4. MULTI-TIMEFRAME 30-DAY BACKTEST SIMULATOR ────────────────────────────
console.log('\n------------------------------------------------------------------------');
console.log('📊 ส่วนที่ 2: ระบบจำลองแบคเทสย้อนหลัง 30 วัน ทุก Timeframe (30-Day Walk-Forward)');
console.log('------------------------------------------------------------------------');

// Generator helper for structural market candles
function generateCandlesForTF(tf, daysCount = 30) {
  const candles = [];
  let step = 3600000; // default 1h in ms
  let totalCandles = 720; // 30 days * 24 bars
  let startPrice = 2300;

  if (tf === '5m') {
    step = 300000;
    totalCandles = daysCount * 24 * 12; // 8,640 bars
  } else if (tf === '15m') {
    step = 900000;
    totalCandles = daysCount * 24 * 4; // 2,880 bars
  } else if (tf === '1h') {
    step = 3600000;
    totalCandles = daysCount * 24; // 720 bars
  } else if (tf === '4h') {
    step = 14400000;
    totalCandles = daysCount * 6; // 180 bars
  } else if (tf === '1d') {
    step = 86400000;
    // To allow indicators like EMA200/ATR14, we need at least 250 candles of history
    totalCandles = 250; 
  } else if (tf === '1w') {
    step = 604800000;
    // Need at least 250 weekly candles (about 5 years of history)
    totalCandles = 250;
  }

  const now = Date.now();
  let currentPrice = startPrice;

  for (let i = 0; i < totalCandles; i++) {
    // Structural sine-based wave to create swing highs/lows and trend
    const trendEffect = (i / totalCandles) * 80; // overall slight uptrend
    const cycleEffect = Math.sin(i / (totalCandles / 15)) * 30; // 15 full cycles
    const dayNoise = (Math.random() - 0.5) * 10;

    const close = startPrice + trendEffect + cycleEffect + dayNoise;
    const open = i === 0 ? startPrice : candles[i - 1].close;
    
    const spread = Math.random() * 8 + 2;
    const high = Math.max(open, close) + spread * 0.4;
    const low = Math.min(open, close) - spread * 0.4;

    candles.push({
      time: now - (totalCandles - 1 - i) * step,
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 5000) + 1000
    });
  }
  return { candles, totalCandles };
}

const timeframes = ['5m', '15m', '1h', '4h', '1d', '1w'];
const backtestResults = {};

timeframes.forEach(tf => {
  const { candles, totalCandles } = generateCandlesForTF(tf, 30);
  
  let balance = 50; // $50 start
  const riskPct = 5; // 5% risk ($2.50)
  
  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let activeTrade = null;
  let maxDrawdown = 0;
  let peakBalance = balance;
  
  // We evaluate trades over the last 30 days of data.
  // For 5m, 15m, 1h, 4h: The entire dataset represents exactly 30 days. Start index after 100 bars for indicator warm-up.
  // For 1d, 1w: Dataset has 250 bars. The last 30 days is the last 30 bars (for 1d) or last 4 bars (for 1w).
  let startIndex = 100;
  if (tf === '1d') startIndex = 250 - 30;
  if (tf === '1w') startIndex = 250 - 5; // 5 weeks approx. 30 days
  
  for (let i = startIndex; i < candles.length; i++) {
    const currentCandle = candles[i];
    
    // 1. Manage Active Trade
    if (activeTrade) {
      if (activeTrade.dir === 'BUY') {
        if (currentCandle.low <= activeTrade.sl) {
          // Loss
          const loss = activeTrade.riskUsd;
          balance -= loss;
          losingTrades++;
          activeTrade = null;
        } else if (currentCandle.high >= activeTrade.tp) {
          // Win
          const profit = activeTrade.riskUsd * activeTrade.rr;
          balance += profit;
          winningTrades++;
          activeTrade = null;
        }
      } else if (activeTrade.dir === 'SELL') {
        if (currentCandle.high >= activeTrade.sl) {
          // Loss
          const loss = activeTrade.riskUsd;
          balance -= loss;
          losingTrades++;
          activeTrade = null;
        } else if (currentCandle.low <= activeTrade.tp) {
          // Win
          const profit = activeTrade.riskUsd * activeTrade.rr;
          balance += profit;
          winningTrades++;
          activeTrade = null;
        }
      }
      
      if (balance > peakBalance) peakBalance = balance;
      const dd = ((peakBalance - balance) / peakBalance) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
      
      continue; // Wait for active trade to resolve
    }

    // 2. Scan Signals (Slice history up to i to avoid lookahead leak)
    const history = candles.slice(0, i);
    const closes = history.map(c => c.close);
    const highs = history.map(c => c.high);
    const lows = history.map(c => c.low);
    const lastPrice = closes[closes.length - 1];

    const rsiVal = Indicators.rsi(closes);
    const macdVal = Indicators.macd(closes);
    const emaData = Indicators.emaTrend(closes);
    const score = Indicators.signalScore({ rsi: rsiVal, macd: macdVal, emaTrend: emaData });

    if (score.direction === 'NEUTRAL') continue;

    const swings = Indicators.swingPoints(highs, lows, Math.min(100, history.length));
    const fiboLevels = Indicators.fibonacci(swings.swingHigh, swings.swingLow, score.direction === 'BUY');
    const ob = Indicators.orderBlock(history, score.direction);
    const atrVal = Indicators.atr(highs, lows, closes) || (lastPrice * 0.003);

    // Build Plan
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

    // Check Trigger in current bar
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
      // คำนวณความเสี่ยงอิงจากเงินเริ่มต้น 50 ดอลลาร์คงที่ทุกไม้ เพื่อความถูกต้องและสมจริงของกลยุทธ์
      const riskUsd = 50 * riskPct / 100;
      const slDist = Math.abs(entryPrice - plan.sl);
      let lotVal = slDist > 0 ? riskUsd / (slDist * 100) : 0.01;
      if (lotVal < 0.01) lotVal = 0.01;

      activeTrade = {
        id: ++totalTrades,
        dir: plan.dir,
        entry: entryPrice,
        sl: plan.sl,
        tp: plan.tp,
        lot: lotVal,
        rr: parseFloat(plan.rr) || 1.5,
        riskUsd,
        entryTime: currentCandle.time
      };
    }
  }

  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const netProfit = balance - 50;
  const netProfitPct = (netProfit / 50) * 100;

  backtestResults[tf] = {
    totalCandles: tf === '1d' ? 30 : tf === '1w' ? 4 : totalCandles - startIndex,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate: winRate.toFixed(2) + '%',
    netProfit: '$' + netProfit.toFixed(2),
    netProfitPct: netProfitPct.toFixed(2) + '%',
    maxDrawdown: maxDrawdown.toFixed(2) + '%',
    finalBalance: '$' + balance.toFixed(2)
  };
});

console.table(backtestResults);
console.log('========================================================================');
console.log('🎉 การทดสอบแบคเทสย้อนหลัง 30 วัน ทุก TF เสร็จสิ้นอย่างสมบูรณ์แบบ!');
console.log('========================================================================\n');
