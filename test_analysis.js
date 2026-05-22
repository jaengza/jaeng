const fs = require('fs');
const path = require('path');

// ── Mock Browser Environment for Node.js Execution ──────────────────────
global.document = {
  getElementById: (id) => {
    if (id === 'r-balance') return { value: '10000' };
    if (id === 'r-risk-pct') return { value: '1' };
    return null;
  }
};
global.window = {};
global.Market = {
  prices: { xau: 4522.86, btc: 0, dxy: 104.50, dxyPct: -0.25 },
  closes(candles) { return candles.map(c => c.close); },
  highs(candles)  { return candles.map(c => c.high); },
  lows(candles)   { return candles.map(c => c.low); }
};

console.log('🔄 กำลังโหลดโมดูลและโค้ดคำนวณของ kesineTrader Pro...');

try {
  // Load Indicators module
  let indicatorsCode = fs.readFileSync(path.join(__dirname, 'js/indicators.js'), 'utf8');
  indicatorsCode = indicatorsCode.replace('const Indicators =', 'global.Indicators =');
  eval(indicatorsCode); 
  console.log('✅ โหลด js/indicators.js สำเร็จ');

  // Load Analysis module
  let analysisCode = fs.readFileSync(path.join(__dirname, 'js/analysis.js'), 'utf8');
  analysisCode = analysisCode.replace('const Analysis =', 'global.Analysis =');
  // Mock window.App and UI-specific calls inside run() to prevent Node errors during execution
  analysisCode = analysisCode.replace(/this\.renderResults.*/, '// Render mocked');
  analysisCode = analysisCode.replace(/window\.App.*/, '// App mocked');
  eval(analysisCode); 
  console.log('✅ โหลด js/analysis.js สำเร็จ');
} catch (e) {
  console.error('❌ ไม่สามารถโหลดไฟล์โครงการเพื่อรันการทดสอบได้:', e.message);
  process.exit(1);
}

// ── Generate Structural Mock Candles (Matching User's Real TradingView Chart) ──
function generateTradingViewMockCandles() {
  console.log('📦 กำลังสร้างประวัติแท่งเทียนย้อนหลัง 100 แท่ง โดยอิงตามระดับราคาจริงใน TradingView ของคุณ...');
  const candles = [];
  const now = Date.now();
  const step = 300000; // 5-minute step

  // Generate 100 candles designed to have verified 5-Bar Fractals
  for (let i = 0; i < 100; i++) {
    let open, high, low, close;

    if (i < 40) {
      // Phase 1: Price trending up towards Swing High at index 40
      open = 4505 + i * 0.4 + (Math.random() - 0.5) * 0.5;
      close = open + 0.3 + (Math.random() - 0.5) * 0.5;
      high = Math.max(open, close) + 0.2;
      low = Math.min(open, close) - 0.2;
    } else if (i === 40) {
      // 👑 SWING HIGH FRACTAL PILL (Targeting 4522.79)
      // Must be higher than index 38, 39, 41, 42
      open = 4521.50;
      close = 4522.00;
      high = 4522.79; // Swing High level from User's calculation
      low = 4520.80;
    } else if (i === 41) {
      open = 4522.00;
      close = 4519.50;
      high = 4522.20; // Lower than 4522.79
      low = 4518.00;
    } else if (i === 42) {
      open = 4519.50;
      close = 4517.00;
      high = 4520.00; // Lower than 4522.79
      low = 4516.20;
    } else if (i < 65) {
      // Phase 2: Price trending down towards Swing Low at index 65
      open = 4517.00 - (i - 42) * 0.2 + (Math.random() - 0.5) * 0.5;
      close = open - 0.15 + (Math.random() - 0.5) * 0.5;
      high = Math.max(open, close) + 0.2;
      low = Math.min(open, close) - 0.2;
    } else if (i === 65) {
      // 👑 SWING LOW FRACTAL PILL (Targeting 4514.66)
      // Must be lower than index 63, 64, 66, 67
      open = 4515.50;
      close = 4515.20;
      high = 4516.80;
      low = 4514.66; // Swing Low level from User's calculation
    } else if (i === 66) {
      open = 4515.20;
      close = 4517.10;
      high = 4518.00;
      low = 4515.00; // Higher than 4514.66
    } else if (i === 67) {
      open = 4517.10;
      close = 4518.80;
      high = 4519.50;
      low = 4516.50; // Higher than 4514.66
    } else {
      // Phase 3: Recovering and ending at the User's exact live price: 4522.86
      const progress = (i - 67) / (99 - 67);
      open = 4518.80 + progress * 3.5 + (Math.random() - 0.5) * 0.4;
      if (i === 99) {
        close = 4522.86; // Live spot price from TradingView screenshot
      } else {
        close = open + 0.1 + (Math.random() - 0.5) * 0.4;
      }
      high = Math.max(open, close) + 0.3;
      low = Math.min(open, close) - 0.2;
    }

    candles.push({
      time: now - (99 - i) * step,
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 800) + 200
    });
  }

  return candles;
}

// ── Run Backtest & Technical Calculation Check ──────────────────────────
async function runTest() {
  try {
    const candles = generateTradingViewMockCandles();
    console.log(`📊 โหลดประวัติกราฟสำเร็จ! ทั้งหมด ${candles.length} แท่ง (5-Minute Interval)`);
    
    const closes = candles.map(c => c.close);
    const highs  = candles.map(c => c.high);
    const lows   = candles.map(c => c.low);
    const lastPrice = closes[closes.length - 1];

    console.log('\n=============================================================');
    console.log(`📈 เริ่มต้นการทดสอบคำนวณย้อนหลังบนราคาทองคำล่าสุด XAUUSD: \$${lastPrice.toFixed(2)}`);
    console.log('=============================================================');

    // 1. Test 5-Bar Fractal Swing Points
    const lookback = Math.min(100, candles.length);
    console.log(`🔍 1. รันการค้นหา 5-Bar Fractal Swing Points (Lookback = ${lookback})...`);
    const swings = Indicators.swingPoints(highs, lows, lookback);
    
    console.log(`   └─ confirmed Swing High : \$${swings.swingHigh.toFixed(2)} (ดัชนีแท่งในระบบ: ${swings.highBar})`);
    console.log(`   └─ confirmed Swing Low  : \$${swings.swingLow.toFixed(2)} (ดัชนีแท่งในระบบ: ${swings.lowBar})`);

    // Validation
    const isHighValid = swings.swingHigh === 4522.79;
    const isLowValid = swings.swingLow === 4514.66;
    console.log(`   └─ ตรวจจับ Swing High (เป้าหมาย 4522.79): ${isHighValid ? '🟢 ถูกต้องเป๊ะ 100%' : '❌ คลาดเคลื่อน'}`);
    console.log(`   └─ ตรวจจับ Swing Low  (เป้าหมาย 4514.66): ${isLowValid ? '🟢 ถูกต้องเป๊ะ 100%' : '❌ คลาดเคลื่อน'}`);

    // 2. Test Directional Fibonacci Retracement & OTE
    console.log(`🔍 2. รันการวัดทิศทางระดับ Fibonacci Retracement & Optimal Trade Entry (OTE 70.5%)...`);
    const rsiVal = Indicators.rsi(closes);
    const macdVal = Indicators.macd(closes);
    const emaData = Indicators.emaTrend(closes);
    const score = Indicators.signalScore({ rsi: rsiVal, macd: macdVal, emaTrend: emaData });
    const isBuy = score.direction === 'BUY' || score.direction === 'NEUTRAL'; // default to buy setup for evaluation if neutral
    
    console.log(`   ├─ ทิศทางตลาดปัจจุบันจากการวิเคราะห์: ${score.direction} (Strength: ${score.strength}/10)`);
    console.log(`   ├─ ค้นหา Fibo ระดับย่อตัวฝั่ง: ${isBuy ? 'BUY (Discount Market Setup)' : 'SELL (Premium Market Setup)'}`);
    
    const fiboLevels = Indicators.fibonacci(swings.swingHigh, swings.swingLow, isBuy);
    const ote = fiboLevels.find(f => f.isOte);

    console.log('   ├─ ตารางระดับ Fibonacci Retracement:');
    fiboLevels.forEach(f => {
      console.log(`   │   ├── ${f.label.padEnd(6)}: \$${f.price.toFixed(2)} ${f.isOte ? '★ [Optimal Trade Entry]' : ''}`);
    });

    // 3. Test Order Block & Technical Synthesis
    console.log(`🔍 3. รันตรรกะระบุโซนสถาบัน Order Block (OB) & Fair Value Gap (FVG)...`);
    const ob = Indicators.orderBlock(candles, score.direction === 'NEUTRAL' ? 'BUY' : score.direction);
    const fvgs = Indicators.fairValueGaps(candles);

    if (ob) {
      console.log(`   ├─ พบ Order Block (${ob.type}): \$${ob.low.toFixed(2)} - \$${ob.high.toFixed(2)}`);
    } else {
      console.log('   ├─ ไม่พบสัญญาณสะสมกำลังของสถาบัน (Order Block) ในช่วงนี้');
    }
    
    if (fvgs.length > 0) {
      console.log(`   ├─ ตรวจพบ Fair Value Gaps (FVG) ในรอบย้อนหลัง:`);
      fvgs.forEach((fvg, i) => {
        console.log(`   │   └── #${i + 1} (${fvg.type}): \$${fvg.bottom.toFixed(2)} - \$${fvg.top.toFixed(2)}`);
      });
    }

    // 4. Test Synthesis & Structural Trade Plan (TP/SL/RR/LOT)
    console.log(`🔍 4. รันระบบสร้างแผนเทรดอัตโนมัติ (Trade Plan Synthesis)...`);
    const plan = Analysis.buildTradePlan({
      asset: 'XAUUSD',
      tf: '5m',
      last: lastPrice,
      score: { direction: 'BUY', strength: 8, type: 'bull', reasons: ['EMA Uptrend', 'RSI Bullish', 'MACD Golden Cross'] },
      rsiVal,
      atrVal: Indicators.atr(highs, lows, closes),
      fiboLevels,
      pivotData: Indicators.pivots(highs[highs.length - 1], lows[lows.length - 1], lastPrice),
      ob,
      swings
    });

    if (plan.dir !== 'NEUTRAL') {
      console.log(`   ├─ แผนการเทรดที่แนะนำ: ${plan.dir}`);
      console.log(`   ├─ จุดเข้าซื้อ (Entry Price OTE): \$${plan.entry.toFixed(2)}`);
      console.log(`   ├─ จุดตัดขาดทุน (Structural SL) : \$${plan.sl.toFixed(2)}`);
      console.log(`   ├─ จุดทำกำไร (Structural TP)   : \$${plan.tp.toFixed(2)}`);
      console.log(`   ├─ ระยะตัดขาดทุน (SL Distance)  : \$${plan.slPips.toFixed(2)}`);
      console.log(`   ├─ อัตรากำไรต่อขาดทุน (Risk Reward): ${plan.rr} : 1`);
      console.log(`   ├─ พอร์ตตัวอย่าง: \$10,000 (ยอมรับความเสี่ยง 1% = \$100)`);
      console.log(`   ├─ ขนาดสัญญาที่แนะนำ (Suggested Lot): ${plan.lot} lot`);
      console.log(`   └─ ต้นทุนสเปรดโดยประมาณ Exness: \$${plan.estSpreadCost}`);

      // Verify Gold Contract rule: 0.01 lot moves $1 = $1 PnL
      const lotVal = parseFloat(plan.lot);
      const simulatedLoss = lotVal * plan.slPips * 100;
      console.log(`\n=============================================================`);
      console.log(`📊 พิสูจน์ความถูกต้องของความเสี่ยง (Gold Contract Rule Audit):`);
      console.log(`   └─ สิทธิการเปิดสัญญา: ${lotVal.toFixed(3)} lot`);
      console.log(`   └─ ระยะห่างราคาชน Stop Loss: \$${plan.slPips.toFixed(2)}`);
      console.log(`   └─ หากชน SL ความสูญเสียจริงจะเป็น: \$${simulatedLoss.toFixed(2)}`);
      console.log(`   └─ ตรวจสอบขีดจำกัด Lot ขั้นต่ำ (>= 0.01): ${lotVal >= 0.01 ? '🟢 ผ่าน (ถูกต้อง)' : '❌ ผิดพลาด'}`);
      console.log(`=============================================================`);
    } else {
      console.log('   └─ สถานะตลาดเป็นกลาง ไม่แนะนำให้เปิดออเดอร์ในแท่งนี้เพื่อความปลอดภัย');
    }

  } catch (e) {
    console.error('❌ เกิดข้อผิดพลาดในระหว่างการคำนวณย้อนหลัง:', e.message);
  }
}

runTest();
