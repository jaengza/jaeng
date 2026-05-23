/* ==========================================================================
   kesineTrader — Auto Analysis Engine
   Fetches OHLCV → runs all indicators → synthesizes trade plan
   ========================================================================== */

const Analysis = {
  state: {
    asset: 'XAUUSD',
    tf: '5m',
    candles: [],
    result: null,
    loading: false
  },

  /* ── Core Analysis Engine ────────────────────────────────────────────────── */
  async run(asset = 'XAUUSD', tf = '5m', htf = '1h', brokerPrice = null) {
    if (this.state.loading) return;
    this.state.asset = asset;
    this.state.tf = tf;
    this.state.htf = htf;
    this.state.loading = true;

    this.showLoading();

    try {
      // 1. Fetch OHLCV data for selected TF and HTF concurrently
      const [ltfCandles, htfCandles] = await Promise.all([
        Market.fetchOHLCV(asset, tf, 250),
        Market.fetchOHLCV(asset, htf, 250)
      ]);
      
      if (!ltfCandles || ltfCandles.length < 50 || !htfCandles || htfCandles.length < 50) {
        throw new Error('\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e01\u0e23\u0e32\u0e1f\u0e44\u0e21\u0e48\u0e40\u0e1e\u0e35\u0e22\u0e07\u0e1e\u0e2d (\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e19\u0e49\u0e2d\u0e22 50 \u0e41\u0e17\u0e48\u0e07 \u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e17\u0e31\u0e49\u0e07 LTF \u0e41\u0e25\u0e30 HTF)');
      }

      // 1.1 Fetch remaining multi-TF data sequentially to avoid proxy rate-limits
      const multiTfs = ['1m', '5m', '15m', '1h', '4h', '1d'];
      const multiTfCandlesList = [];
      for (const t of multiTfs) {
        if (t === tf) multiTfCandlesList.push(ltfCandles);
        else if (t === htf) multiTfCandlesList.push(htfCandles);
        else multiTfCandlesList.push(await Market.fetchOHLCV(asset, t, 200));
      }
      
      // Sync last candle with actual live spot price
      let livePrice = 0;
      if (asset === 'XAUUSD') livePrice = Market.prices.xau;
      else if (asset === 'BTCUSDT') livePrice = Market.prices.btc;
      else if (asset === 'ETHUSDT') livePrice = Market.prices.eth;
      else if (asset === 'DXY') livePrice = Market.prices.dxy;

      if (livePrice > 0) {
        const lastLTF = ltfCandles[ltfCandles.length - 1];
        lastLTF.close = livePrice;
        if (livePrice > lastLTF.high) lastLTF.high = livePrice;
        if (livePrice < lastLTF.low) lastLTF.low = livePrice;
        
        const lastHTF = htfCandles[htfCandles.length - 1];
        lastHTF.close = livePrice;
        if (livePrice > lastHTF.high) lastHTF.high = livePrice;
        if (livePrice < lastHTF.low) lastHTF.low = livePrice;
      }

      // 1.5. Offset Calibration
      if (brokerPrice !== null && brokerPrice > 0) {
        const referencePrice = livePrice > 0 ? livePrice : ltfCandles[ltfCandles.length - 1].close;
        const offset = brokerPrice - referencePrice;
        
        // Shift all LTF candles
        ltfCandles.forEach(c => {
          c.open += offset;
          c.high += offset;
          c.low += offset;
          c.close += offset;
        });

        // Shift all HTF candles
        htfCandles.forEach(c => {
          c.open += offset;
          c.high += offset;
          c.low += offset;
          c.close += offset;
        });

        console.log(`[Offset Calibration] Shifted all prices by ${offset.toFixed(3)} to match broker price ${brokerPrice}`);
      }
      
      this.state.candles = ltfCandles;

      // 2. Prepare arrays (LTF for Momentum, HTF for Structure)
      const closes = Market.closes(ltfCandles);
      const highs  = Market.highs(ltfCandles);
      const lows   = Market.lows(ltfCandles);
      const last   = closes[closes.length - 1];
      
      const htfHighs = Market.highs(htfCandles);
      const htfLows  = Market.lows(htfCandles);

      // 3. Calculate indicators
      // Momentum on LTF
      const rsiVal     = Indicators.rsi(closes);
      const macdVal    = Indicators.macd(closes);
      const emaData    = Indicators.emaTrend(closes);
      const atrVal     = Indicators.atr(highs, lows, closes);
      
      const multiEmaTrend = {};
      multiTfs.forEach((t, i) => {
        const candles = multiTfCandlesList[i];
        if (candles && candles.length >= 50) {
          let mCloses = Market.closes(candles);
          if (livePrice > 0 && brokerPrice === null) mCloses[mCloses.length - 1] = livePrice;
          if (brokerPrice !== null && brokerPrice > 0) {
            const referencePrice = livePrice > 0 ? livePrice : mCloses[mCloses.length - 1];
            const offset = brokerPrice - referencePrice;
            mCloses = mCloses.map(c => c + offset);
          }
          multiEmaTrend[t] = Indicators.emaTrend(mCloses);
        }
      });
      
      // Structure on HTF (SMC)
      const swings     = Indicators.swingPoints(htfHighs, htfLows, Math.min(100, htfCandles.length));
      
      // SASP Optimized Parameters
      let saspThreshold = 4.0, targetFibo = 70.5, atrMult = 1.5;
      if (asset === 'XAUUSD') {
        if (tf === '15m') { saspThreshold = 3.5; targetFibo = 88.6; atrMult = 2.2; }
        else { saspThreshold = 3.5; targetFibo = 70.5; atrMult = 1.5; }
      } else if (asset === 'BTCUSDT') {
        if (tf === '15m') { saspThreshold = 3.5; targetFibo = 78.6; atrMult = 2.2; }
        else { saspThreshold = 3.5; targetFibo = 88.6; atrMult = 2.5; }
      } else if (asset === 'ETHUSDT') {
        if (tf === '15m') { saspThreshold = 4.0; targetFibo = 70.5; atrMult = 1.5; }
        else { saspThreshold = 5.0; targetFibo = 88.6; atrMult = 2.2; }
      }

      // Calculate LTF signal score
      const score      = Indicators.signalScore({ rsi: rsiVal, macd: macdVal, emaTrend: emaData }, 1.0);
      
      // Fibo based on HTF Swings
      const fiboLevels = Indicators.fibonacci(swings.swingHigh, swings.swingLow, score.direction === 'BUY');
      
      this.state.saspParams = { saspThreshold, targetFibo, atrMult };
      
      // Pivots based on Previous Completed HTF Candle
      const prevHtf = htfCandles[htfCandles.length - 2];
      const pivotData  = Indicators.pivots(
        prevHtf.high,
        prevHtf.low,
        prevHtf.close
      );
      
      // SMC based on HTF
      const ob         = Indicators.orderBlock(htfCandles, score.direction);
      const fvgs       = Indicators.fairValueGaps(htfCandles);

      // 4. Build trade plan
      const plan = this.buildTradePlan({
        asset, tf, htf, last, score, rsiVal, macdVal, emaData,
        atrVal, swings, fiboLevels, pivotData, ob, fvgs
      });

      this.state.result = { rsiVal, macdVal, emaData, multiEmaTrend, atrVal, swings, fiboLevels, pivotData, ob, fvgs, score, plan, last };

      // 5. Render
      this.renderResults(this.state.result);

      // 6. Also update dashboard signal cards
      window.App && App.updateDashboardSignals(this.state.result);

    } catch (err) {
      this.showError(err.message);
    } finally {
      this.state.loading = false;
    }
  },

  /* ── Build Trade Plan from indicators ──────────────────────────────────── */
  buildTradePlan({ asset, tf, htf, last, score, rsiVal, macdVal, emaData, atrVal, fiboLevels, pivotData, ob, swings, fvgs }) {
    const dir = score.direction;
    const atr = atrVal || (last * 0.003); // fallback: 0.3% of price
    
    // Use SASP optimized params if available
    const targetFibo = this.state.saspParams ? this.state.saspParams.targetFibo : 70.5;
    const atrMult    = this.state.saspParams ? this.state.saspParams.atrMult : 1.5;

    // Find the exact Fibonacci level recommended by SASP
    const ote  = fiboLevels ? fiboLevels.find(f => Math.abs(f.pct - targetFibo) < 0.2) : null;

    let entry = last, sl = null, tp = null;
    let slDist = 0, tpDist = 0, rr = 0, lotSize = 0, estSpreadCost = 0;

    if (dir !== 'NEUTRAL') {
      // Add Fibo/SMC reasons to the score object so the UI can display them
      if (ote && Math.abs(last - ote.price) <= (atr * 1.5)) {
        score.reasons.push(`ราคาอยู่ในโซน ${targetFibo}% Fibo OTE (+1.0)`);
        score.strength += 1.0;
        score.score += (dir === 'BUY' ? 1.0 : -1.0);
      }
      if (ob && ((dir === 'BUY' && ob.type === 'bullish_ob') || (dir === 'SELL' && ob.type === 'bearish_ob'))) {
        score.reasons.push(`ได้รับการยืนยันจาก ${ob.type === 'bullish_ob' ? 'Bullish' : 'Bearish'} Order Block (+1.0)`);
        score.strength += 1.0;
        score.score += (dir === 'BUY' ? 1.0 : -1.0);
      }
      if (fvgs && fvgs.length > 0) {
        const recentFvg = fvgs[fvgs.length - 1];
        if ((dir === 'BUY' && recentFvg.type === 'bullish') || (dir === 'SELL' && recentFvg.type === 'bearish')) {
           score.reasons.push(`ทิศทางสอดคล้องกับ ${recentFvg.type === 'bullish' ? 'Bullish' : 'Bearish'} FVG (+1.0)`);
           score.strength += 1.0;
           score.score += (dir === 'BUY' ? 1.0 : -1.0);
        }
      }

      if (dir === 'BUY') {
        entry = ote ? ote.price : last;
        
        // Stop Loss structurally placed below Swing Low or the low of the Order Block
        const baseSL = ob ? Math.min(swings.swingLow, ob.low) : swings.swingLow;
        sl = baseSL;
        
        // SASP Guard against extremely tight SL using ATR Multiplier
        if (entry - sl < atr * atrMult || sl >= entry) {
          sl = entry - atr * atrMult;
        }
        
        // Take Profit targeted at Swing High (Buyside Liquidity)
        tp = swings.swingHigh;
        if (tp <= entry) {
          tp = entry + atr * 3;
        }
      } else {
        entry = ote ? ote.price : last;
        
        // Stop Loss structurally placed above Swing High or the high of the Order Block
        const baseSL = ob ? Math.max(swings.swingHigh, ob.high) : swings.swingHigh;
        sl = baseSL;
        
        // SASP Guard against extremely tight SL using ATR Multiplier
        if (sl - entry < atr * atrMult || sl <= entry) {
          sl = entry + atr * atrMult;
        }
        
        // Take Profit targeted at Swing Low (Sellside Liquidity)
        tp = swings.swingLow;
        if (tp >= entry) {
          tp = entry - atr * 3;
        }
      }

      slDist = Math.abs(entry - sl);
      tpDist = Math.abs(tp - entry);
      rr     = slDist > 0 ? (tpDist / slDist) : 0;

      // Auto lot-size (default $50 balance, 5% risk)
      const balance  = parseFloat(document.getElementById('r-balance')?.value || 50);
      const riskPct  = parseFloat(document.getElementById('r-risk-pct')?.value || 5);
      const riskUsd  = balance * riskPct / 100;
      
      // contract standardized sizing
      if (asset === 'XAUUSD') {
        // Gold: 1 standard lot = 100 oz. 0.01 lot moves $1 = $1 PnL
        const rawLot = slDist > 0 ? riskUsd / (slDist * 100) : 0;
        if (rawLot > 0 && rawLot < 0.01) {
          lotSize = 0.01;
        } else {
          lotSize = Math.floor(rawLot * 100) / 100;
        }
      } else if (asset === 'BTCUSDT') {
        const rawLot = slDist > 0 ? riskUsd / slDist : 0;
        if (rawLot > 0 && rawLot < 0.01) {
          lotSize = 0.01;
        } else {
          lotSize = Math.floor(rawLot * 100) / 100;
        }
      } else if (asset === 'ETHUSDT') {
        const rawLot = slDist > 0 ? riskUsd / slDist : 0;
        if (rawLot > 0 && rawLot < 0.01) {
          lotSize = 0.01;
        } else {
          lotSize = Math.floor(rawLot * 100) / 100;
        }
      } else {
        // Forex / others
        const rawLot = slDist > 0 ? riskUsd / (slDist * 10) : 0;
        if (rawLot > 0 && rawLot < 0.01) {
          lotSize = 0.01;
        } else {
          lotSize = Math.floor(rawLot * 100) / 100;
        }
      }

      // Calculate Estimated Spread Cost based on Exness averages and Contract Size
      let spreadVal = 15; // default Forex
      let spreadMult = 10.0;
      
      if (asset === 'XAUUSD') {
        spreadVal = 200;
        spreadMult = 1.0;
      } else if (asset === 'BTCUSDT' || asset === 'ETHUSDT') {
        spreadVal = asset === 'BTCUSDT' ? 2150 : 160;
        spreadMult = 0.01;
      } else if (asset === 'DXY') {
        spreadVal = 15;
        spreadMult = 1.0;
      }
      
      estSpreadCost = spreadVal * spreadMult * lotSize;
    }

    // 5. Probability Forecasting & DXY Gold Correlation Calculation
    let baseProb = 50; // Base success rate at 50%
    const scoreVal = score.strength || 0;
    baseProb += (scoreVal / 10) * 15; // Up to +15% based on Momentum Strength
    
    if (ote && dir !== 'NEUTRAL') {
      const distToOte = Math.abs(entry - ote.price) / entry;
      if (distToOte < 0.001) baseProb += 12; // Retracement aligns with 70.5% OTE: +12%
    }
    if (ob && dir !== 'NEUTRAL') baseProb += 8; // Order Block confluence: +8%
    
    let dxyReason = "";
    const dxy = Market.prices?.dxy || 0;
    const dxyPct = Market.prices?.dxyPct || 0;
    if (dxy > 0) {
      if (asset === 'XAUUSD') {
        if (dir === 'BUY') {
          if (dxyPct < 0) {
            baseProb += 15; // DXY weakening supports gold BUY (+15%)
            dxyReason = `ดัชนีดอลลาร์สหรัฐอ่อนค่า (${dxyPct.toFixed(3)}%) สนับสนุนการปรับตัวขึ้นของทองคำ`;
          } else {
            baseProb -= 10; // DXY strengthening pressures gold BUY (-10%)
            dxyReason = `ดัชนีดอลลาร์สหรัฐแข็งค่า (+${dxyPct.toFixed(3)}%) กดดันการปรับตัวขึ้นของทองคำ`;
          }
        } else if (dir === 'SELL') {
          if (dxyPct > 0) {
            baseProb += 15; // DXY strengthening supports gold SELL (+15%)
            dxyReason = `ดัชนีดอลลาร์สหรัฐแข็งค่า (+${dxyPct.toFixed(3)}%) ช่วยส่งเสริมการย่อตัวของทองคำ`;
          } else {
            baseProb -= 10; // DXY weakening pressures gold SELL (-10%)
            dxyReason = `ดัชนีดอลลาร์สหรัฐอ่อนค่า (${dxyPct.toFixed(3)}%) ขัดขวางการย่อตัวของทองคำ`;
          }
        } else {
          // NEUTRAL
          if (dxyPct < 0) {
            dxyReason = `ดัชนีดอลลาร์สหรัฐอ่อนค่า (${dxyPct.toFixed(3)}%) ในปัจจุบัน มีแนวโน้มหนุนหรือพยุงราคาทองคำในกรอบสะสม`;
          } else {
            dxyReason = `ดัชนีดอลลาร์สหรัฐแข็งค่า (+${dxyPct.toFixed(3)}%) ในปัจจุบัน อาจเพิ่มแรงกดดันกดทับราคาทองคำในกรอบสะสม`;
          }
        }
      } else if (asset === 'DXY') {
        if (dxyPct > 0) {
          dxyReason = `ดัชนีดอลลาร์สหรัฐเคลื่อนไหวแข็งค่าขึ้น (+${dxyPct.toFixed(3)}%) ส่งผลเชิงลบและกดดันราคาทองคำ XAUUSD โดยตรง`;
        } else {
          dxyReason = `ดัชนีดอลลาร์สหรัฐเคลื่อนไหวอ่อนค่าลง (${dxyPct.toFixed(3)}%) ส่งผลเชิงบวกและคอยสนับสนุนราคาทองคำ XAUUSD ให้แข็งแกร่ง`;
        }
      }
    }
    
    // Cap probability within realistic financial market constraints
    baseProb = Math.max(30, Math.min(95, baseProb));
    
    // --- Short-term Trade Plan Calculation ---
    let shortPlan = null;
    if (dir !== 'NEUTRAL') {
      // 1. Scalping Entry: Wait for a very small pullback (0.5 ATR) from the current live price
      const shortEntry = dir === 'BUY' ? last - (atr * 0.5) : last + (atr * 0.5);
      
      // 2. Tighter Stop Loss (e.g. 1.2 ATR from the shortEntry)
      const shortSLDist = atr * 1.2;
      const shortSL = dir === 'BUY' ? shortEntry - shortSLDist : shortEntry + shortSLDist;
      
      // 3. Take Profit (RR 1:1.5 to 1:2, let's use 1.5 for high win rate)
      const shortTPDist = shortSLDist * 1.5; 
      const shortTP = dir === 'BUY' ? shortEntry + shortTPDist : shortEntry - shortTPDist;
      const shortRR = 1.5;
      
      let shortLot = 0;
      const riskUsd  = (parseFloat(document.getElementById('r-balance')?.value || 50)) * (parseFloat(document.getElementById('r-risk-pct')?.value || 5)) / 100;
      
      if (asset === 'XAUUSD') {
        shortLot = shortSLDist > 0 ? riskUsd / (shortSLDist * 100) : 0;
      } else if (asset === 'BTCUSDT' || asset === 'ETHUSDT') {
        shortLot = shortSLDist > 0 ? riskUsd / shortSLDist : 0;
      } else {
        shortLot = shortSLDist > 0 ? riskUsd / (shortSLDist * 10) : 0;
      }
      shortLot = Math.floor(Math.max(0.01, shortLot) * 100) / 100;
      
      const shortProb = Math.max(30, Math.round(baseProb - 5)); // Slightly lower probability for scalping due to early entry
      
      shortPlan = {
        entry: shortEntry,
        sl: shortSL,
        tp: shortTP,
        rr: shortRR,
        lotSize: shortLot,
        distSL: shortSLDist,
        prob: shortProb
      };
    }
    
    return { 
      dir, 
      entry, 
      sl, 
      tp, 
      rr: rr > 0 ? rr.toFixed(2) : '--', 
      lot: lotSize > 0 ? lotSize.toFixed(2) : '--', 
      estSpreadCost: estSpreadCost > 0 ? estSpreadCost.toFixed(2) : '--', 
      slPips: slDist > 0 ? slDist : null, 
      tpPips: tpDist > 0 ? tpDist : null, 
      atr, 
      reasons: score.reasons,
      prob: Math.round(baseProb),
      dxyReason,
      shortPlan
    };
  },

  /* ── Render Results ─────────────────────────────────────────────────────── */
  renderResults(r) {
    const container = document.getElementById('analysis-results');
    if (!container) return;

    const dec = (this.state.asset === 'XAUUSD' || this.state.asset === 'ETHUSDT') ? 2 : (this.state.asset === 'DXY' ? 3 : 0);
    const fmt = v => (v !== null && v !== undefined) ? v.toFixed(dec) : '--';

    // RSI color
    const rsiColor = r.rsiVal < 35 ? 'bull' : r.rsiVal > 65 ? 'bear' : 'neut';

    // MACD
    const macdTrend = r.macdVal ? r.macdVal.trend : 'neut';
    const macdCross = r.macdVal?.cross !== 'none' ? `(${r.macdVal.cross === 'golden' ? '🟢 Golden Cross' : '🔴 Death Cross'})` : '';
    const macdBars  = r.macdVal?.histBars || [];

    // EMA labels
    const emaLabel = r.emaData.trend === 'bull' ? '📈 Uptrend' : r.emaData.trend === 'bear' ? '📉 Downtrend' : '↔ Sideways';

    // Score
    const planDir = r.plan.dir;
    const planClass = planDir === 'BUY' ? 'buy' : planDir === 'SELL' ? 'sell' : '';

    container.innerHTML = `
      <!-- ── INDICATOR GROUP: RSI + MACD + EMA ─────────────────── -->
      <div class="indicator-group">
        <div class="ind-group-header">📊 Momentum Indicators</div>
        <div class="ind-grid">
          <div class="ind-cell">
            <span class="ind-label">RSI (14)</span>
            <span class="ind-value ${rsiColor}">${r.rsiVal !== null ? r.rsiVal.toFixed(1) : '--'}</span>
            <span class="ind-sub">${Indicators.rsiSignal(r.rsiVal).label}</span>
            <div class="rsi-meter">
              <div class="rsi-fill" style="width:${r.rsiVal || 50}%; color:${r.rsiVal < 35 ? 'var(--green)' : r.rsiVal > 65 ? 'var(--red)' : 'var(--blue)'}; background:${r.rsiVal < 35 ? 'var(--green)' : r.rsiVal > 65 ? 'var(--red)' : 'var(--blue)'}"></div>
              <span class="rsi-mark" style="left:30%">30</span>
              <span class="rsi-mark" style="left:70%">70</span>
            </div>
          </div>
          <div class="ind-cell">
            <span class="ind-label">MACD (12/26/9)</span>
            <span class="ind-value ${macdTrend}">${r.macdVal ? (r.macdVal.histogram > 0 ? '▲ Bullish' : '▼ Bearish') : '--'}</span>
            <span class="ind-sub">${macdCross || (r.macdVal ? `Hist: ${r.macdVal.histogram.toFixed(2)}` : '')}</span>
            <div class="macd-bars">
              ${macdBars.map(v => `<div class="macd-bar ${v >= 0 ? 'pos' : 'neg'}" style="height:${Math.min(100, Math.abs(v / (Math.max(...macdBars.map(Math.abs)) || 1)) * 100)}%"></div>`).join('')}
            </div>
          </div>
          <div class="ind-cell full">
            <span class="ind-label">EMA Trend (20 / 50 / 200)</span>
            <span class="ind-value ${r.emaData.trend}">${emaLabel}</span>
            <span class="ind-sub">EMA20: ${r.emaData.ema20 ? fmt(r.emaData.ema20) : '--'} | EMA50: ${r.emaData.ema50 ? fmt(r.emaData.ema50) : '--'} | EMA200: ${r.emaData.ema200 ? fmt(r.emaData.ema200) : '--'}</span>
          </div>
        </div>
      </div>
    `;

    try {
      container.innerHTML += `
      <!-- ── SMC ANALYSIS ──────────────────────────────────────── -->
      <div class="indicator-group">
        ${window.App && window.App.simulatedDataWarning ? '<div style="background:var(--red);color:white;padding:10px;border-radius:8px;margin-bottom:15px;font-weight:bold;text-align:center;">⚠️ คำเตือน: เชื่อมต่อ API ล้มเหลว! ข้อมูลชุดนี้เป็นกราฟจำลอง (Simulated Data)</div>' : ''}
        <div class="ind-group-header">🎯 Smart Money Concepts <span style="font-size: 0.8em; color: var(--text-light); margin-left: 8px;">(อ้างอิงจากกราฟใหญ่ ${this.state.htf || this.state.tf})</span></div>
        <div class="ict-info">
          <div class="ict-item">
            <span class="ict-item-label">Swing High</span>
            <span class="ict-item-value">${fmt(r.swings.swingHigh)}</span>
            <span class="ict-item-badge badge-sell">Resistance</span>
          </div>
          <div class="ict-item">
            <span class="ict-item-label">Swing Low</span>
            <span class="ict-item-value">${fmt(r.swings.swingLow)}</span>
            <span class="ict-item-badge badge-buy">Support</span>
          </div>
          <div class="ict-item">
            <span class="ict-item-label">OTE Zone (70.5% Fibo)</span>
            <span class="ict-item-value text-gold">${r.fiboLevels && r.fiboLevels.length > 0 ? fmt(r.fiboLevels.find(f => f.isOte)?.price) : '--'}</span>
            <span class="ict-item-badge badge-neutral">OTE</span>
          </div>
          ${r.ob ? '<div class="ict-item"><span class="ict-item-label">Order Block (' + (r.ob.type === "bullish_ob" ? "Bullish" : "Bearish") + ')</span><span class="ict-item-value">' + fmt(r.ob.low) + ' – ' + fmt(r.ob.high) + '</span><span class="ict-item-badge ' + (r.ob.type === "bullish_ob" ? "badge-buy" : "badge-sell") + '">' + (r.ob.type === "bullish_ob" ? "BUY OB" : "SELL OB") + '</span></div>' : ''}
          ${r.fvgs && r.fvgs.length > 0 ? '<div class="ict-item"><span class="ict-item-label">FVG (' + r.fvgs[r.fvgs.length-1].type + ')</span><span class="ict-item-value">' + fmt(r.fvgs[r.fvgs.length-1].bottom) + ' – ' + fmt(r.fvgs[r.fvgs.length-1].top) + '</span><span class="ict-item-badge ' + (r.fvgs[r.fvgs.length-1].type === "bullish" ? "badge-buy" : "badge-sell") + '">' + (r.fvgs[r.fvgs.length-1].type === "bullish" ? "⬆ Gap" : "⬇ Gap") + '</span></div>' : ''}
        </div>
      </div>`;
    } catch(e) { container.innerHTML += '<div style="color:red">SMC Render Error: ' + e.message + '</div>'; }

    try {
      container.innerHTML += `
      <!-- ── FIBONACCI LEVELS ──────────────────────────────────── -->
      <div class="indicator-group">
        <div class="ind-group-header">📐 Fibonacci Retracement</div>
        <div class="fibo-levels">
          ${(r.fiboLevels || []).map(f => '<div class="fibo-row ' + (f.isOte ? "ote-row" : "") + '"><span class="fibo-pct ' + (f.isOte ? "ote" : "") + '">' + f.label + (f.isOte ? " ★" : "") + '</span><div class="fibo-track"><div class="fibo-bar" style="width:' + f.pct + '%"></div></div><span class="fibo-price">' + fmt(f.price) + '</span></div>').join('')}
        </div>
      </div>`;
    } catch(e) { container.innerHTML += '<div style="color:red">Fibo Render Error: ' + e.message + '</div>'; }

    try {
      container.innerHTML += `
      <!-- ── SUPPORT / RESISTANCE (Pivot Points) ───────────────── -->
      <div class="indicator-group">
        <div class="ind-group-header">📍 Support & Resistance (Pivot)</div>
        <div class="sr-levels">
          <div class="sr-row resistance"><span class="sr-label">R2 (Strong Resistance)</span><span class="sr-price">${fmt(r.pivotData.r2)}</span></div>
          <div class="sr-row resistance"><span class="sr-label">R1 (Resistance)</span><span class="sr-price">${fmt(r.pivotData.r1)}</span></div>
          <div class="sr-row pivot">     <span class="sr-label">PP (Pivot Point)</span><span class="sr-price">${fmt(r.pivotData.pp)}</span></div>
          <div class="sr-row support">   <span class="sr-label">S1 (Support)</span><span class="sr-price">${fmt(r.pivotData.s1)}</span></div>
          <div class="sr-row support">   <span class="sr-label">S2 (Strong Support)</span><span class="sr-price">${fmt(r.pivotData.s2)}</span></div>
        </div>
      </div>`;
    } catch(e) { container.innerHTML += '<div style="color:red">Pivot Render Error: ' + e.message + '</div>'; }

    try {
      container.innerHTML += `
      <!-- ── SIGNAL SCORE + TRADE PLAN ────────────────────────── -->
      <div class="indicator-group">
        <div class="ind-group-header">🤖 Auto Trade Plan</div>
        <div class="signal-score-box">
          <span class="score-label">Signal Score</span>
          <div class="score-value ${r.score.type}">${r.score.direction}</div>
          <div class="score-desc">${(r.score.reasons || []).join(' · ') || 'สัญญาณผสม'}</div>
        </div>
        
        <!-- DXY Confluence (Global) -->
        ${r.plan.dxyReason ? `
        <div class="prob-forecast-box" style="margin-top: 10px;">
          <div class="dxy-correl-section">
            <div class="dxy-correl-title">💵 สหสัมพันธ์ดัชนีดอลลาร์ (DXY Correlation):</div>
            <div class="dxy-correl-desc">${r.plan.dxyReason}</div>
          </div>
        </div>
        ` : ''}

        <!-- 🛡️ SASP OPTIMIZER FILTER WARNING -->
        ${(r.plan.dir !== 'NEUTRAL' && this.state.saspParams && r.score.strength < this.state.saspParams.saspThreshold) ? `
        <div style="background: rgba(255, 159, 67, 0.1); border-left: 3px solid var(--gold); padding: 12px; border-radius: 4px; margin-bottom: 16px;">
          <strong style="color: var(--gold); font-size: 0.85rem;">⚠️ SASP Optimizer Warning</strong>
          <p style="font-size: 0.8rem; color: var(--text-2); margin-top: 4px;">
            ความแรงสัญญาณปัจจุบัน (Score: ${r.score.strength.toFixed(1)}) ต่ำกว่าเกณฑ์สไนเปอร์ที่แนะนำ (${(this.state.saspParams?.saspThreshold || 3.5).toFixed(1)})<br>
            แผนเทรดนี้เป็นแบบ <strong>High Frequency</strong> (เสี่ยงสูง) โปรดพิจารณาจังหวะ Price Action ประกอบด้วย
          </p>
          <div style="margin-top: 8px; font-size: 0.75rem; color: var(--text-2); background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px;">
            <strong style="color: var(--text-1); margin-bottom: 4px; display: block;">เงื่อนไขที่สนับสนุนทิศทาง ${r.plan.dir}:</strong>
            <ul style="margin: 0; padding-left: 16px; list-style-type: disc;">
              ${(r.score.reasons || []).length > 0 ? (r.score.reasons || []).map(reason => `<li style="${reason.includes('-') && !reason.includes('(-') ? 'color:var(--red)' : 'color:var(--green)'}">${reason}</li>`).join('') : '<li>ไม่มีเงื่อนไขทางเทคนิคที่ชัดเจน</li>'}
            </ul>
          </div>
        </div>` : (r.plan.dir !== 'NEUTRAL' ? `
        <div style="background: rgba(46, 213, 115, 0.1); border-left: 3px solid var(--green); padding: 12px; border-radius: 4px; margin-bottom: 16px;">
          <strong style="color: var(--green); font-size: 0.85rem;">🎯 SASP Sniper Verified</strong>
          <p style="font-size: 0.8rem; color: var(--text-2); margin-top: 4px;">
            คะแนนความแรง ${r.score.strength.toFixed(1)} ผ่านเกณฑ์สไนเปอร์ที่แนะนำ (${(this.state.saspParams?.saspThreshold || 3.5).toFixed(1)}) มีความแม่นยำทางสถิติสูง
          </p>
          <div style="margin-top: 8px; font-size: 0.75rem; color: var(--text-2); background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px;">
            <strong style="color: var(--text-1); margin-bottom: 4px; display: block;">เงื่อนไขที่สนับสนุนทิศทาง ${r.plan.dir}:</strong>
            <ul style="margin: 0; padding-left: 16px; list-style-type: disc;">
              ${(r.score.reasons || []).length > 0 ? (r.score.reasons || []).map(reason => `<li style="${reason.includes('-') && !reason.includes('(-') ? 'color:var(--red)' : 'color:var(--green)'}">${reason}</li>`).join('') : '<li>ไม่มีเงื่อนไขทางเทคนิคที่ชัดเจน</li>'}
            </ul>
          </div>
        </div>` : '')}

        ${r.plan.dir !== 'NEUTRAL' ? `
        <!-- Main Plan Block -->
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 10px; margin-bottom: 5px;">
          <h4 style="color: var(--text-2); font-size: 0.85em; text-transform: uppercase; margin: 0;">แผนเทรดหลัก (Structure)</h4>
          <span style="font-size: 0.75em; color: ${r.plan.prob >= 75 ? 'var(--green)' : r.plan.prob >= 55 ? 'var(--gold)' : 'var(--red)'};">
            โอกาสชนะ: <strong>${r.plan.prob}%</strong>
          </span>
        </div>
        <div class="prob-bar-container" style="height: 4px; margin-bottom: 8px;">
          <div class="prob-bar-fill" style="width: ${r.plan.prob || 0}%; background: ${r.plan.prob >= 75 ? 'var(--green)' : r.plan.prob >= 55 ? 'var(--gold)' : 'var(--red)'};"></div>
        </div>
        <div class="plan-banner ${planClass}">
          <div class="plan-dir ${planClass}">${planDir === 'BUY' ? '⬆' : '⬇'} ${planDir}</div>
          <div class="plan-asset-tf"><span>${this.state.asset}</span><span>${this.state.tf}</span></div>
          <div class="plan-rr-badge">R:R ${r.plan.rr}:1</div>
        </div>
        <div class="plan-prices">
          <div class="plan-price-cell">
            <span class="plan-price-lbl">Take Profit</span>
            <span class="plan-price-val tp">${fmt(r.plan.tp)}</span>
            <span class="plan-price-pnl pnl-pos">+${r.plan.tpPips ? r.plan.tpPips.toFixed(2) : '--'}</span>
          </div>
          <div class="plan-price-cell">
            <span class="plan-price-lbl">Entry</span>
            <span class="plan-price-val entry">${fmt(r.plan.entry)}</span>
            <span class="plan-price-pnl" style="color:var(--text-3)">~ราคาปัจจุบัน</span>
          </div>
          <div class="plan-price-cell">
            <span class="plan-price-lbl">Stop Loss</span>
            <span class="plan-price-val sl">${fmt(r.plan.sl)}</span>
            <span class="plan-price-pnl pnl-neg">-${r.plan.slPips ? r.plan.slPips.toFixed(2) : '--'}</span>
          </div>
        </div>
        <div class="plan-lot-row" style="grid-template-columns: repeat(3, 1fr);">
          <div class="plan-lot-cell">
            <span class="plan-lot-label">ATR (Volatility)</span>
            <span class="plan-lot-value">${r.plan.atr ? r.plan.atr.toFixed(2) : '--'}</span>
          </div>
          <div class="plan-lot-cell">
            <span class="plan-lot-label">Suggested Lot</span>
            <span class="plan-lot-value" style="color: var(--cyan);">${r.plan.lot || '--'}</span>
          </div>
          <div class="plan-lot-cell" style="border-left: 1px solid var(--border);">
            <span class="plan-lot-label" style="color: #a78bfa;">Est. Spread Cost</span>
            <span class="plan-lot-value" style="color: #a78bfa; font-weight: 800;">$${r.plan.estSpreadCost || '--'}</span>
          </div>
        </div>
        <div class="plan-actions" style="margin-top: 10px; margin-bottom: 20px;">
          <button class="plan-btn-use" onclick="App.useAnalysisPlan()">📋 ใช้แผนหลัก</button>
          <button class="plan-btn-save" onclick="App.saveCurrentPlan()">💾 บันทึกแผนหลัก</button>
        </div>
        ` : `
        <div style="padding:16px;text-align:center;color:var(--text-2);font-size:0.8rem;">
          ⚠️ สัญญาณยังไม่ชัดเจน รอการยืนยันจาก Price Action หรือเปลี่ยน Timeframe
        </div>
        `}

        ${(r.plan.dir !== 'NEUTRAL' && r.plan.shortPlan) ? `
        <!-- Short Plan Block -->
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 20px; margin-bottom: 5px;">
          <h4 style="color: var(--cyan); font-size: 0.85em; text-transform: uppercase; margin: 0;">⚡ แผนเทรดสั้น (Scalping & Day Trade)</h4>
          <span style="font-size: 0.8em; color: ${r.plan.shortPlan.prob >= 75 ? 'var(--green)' : r.plan.shortPlan.prob >= 55 ? 'var(--gold)' : 'var(--red)'};">
            โอกาสชนะ: <strong>${r.plan.shortPlan.prob}%</strong>
          </span>
        </div>
        <div class="prob-bar-container" style="height: 4px; margin-bottom: 8px;">
          <div class="prob-bar-fill" style="width: ${r.plan.shortPlan.prob || 0}%; background: ${r.plan.shortPlan.prob >= 75 ? 'var(--green)' : r.plan.shortPlan.prob >= 55 ? 'var(--gold)' : 'var(--red)'};"></div>
        </div>
        <div class="plan-banner ${planClass}" style="border: 1px solid var(--cyan);">
          <div class="plan-dir ${planClass}">${planDir === 'BUY' ? '⬆' : '⬇'} ${planDir}</div>
          <div class="plan-asset-tf"><span style="color: var(--cyan)">${this.state.asset}</span><span>${this.state.tf}</span></div>
          <div class="plan-rr-badge" style="background: var(--cyan); color: #000;">R:R ${r.plan.shortPlan.rr}:1</div>
        </div>
        <div class="plan-prices">
          <div class="plan-price-cell">
            <span class="plan-price-lbl">Take Profit</span>
            <span class="plan-price-val tp">${fmt(r.plan.shortPlan.tp)}</span>
            <span class="plan-price-pnl pnl-pos">+${(r.plan.shortPlan.distSL * 1.5).toFixed(2)}</span>
          </div>
          <div class="plan-price-cell">
            <span class="plan-price-lbl">Entry</span>
            <span class="plan-price-val entry" style="color: var(--gold);">${fmt(r.plan.shortPlan.entry)}</span>
            <span class="plan-price-pnl" style="color:var(--text-3)">รอราคาย่อตื้นๆ</span>
          </div>
          <div class="plan-price-cell">
            <span class="plan-price-lbl">Stop Loss</span>
            <span class="plan-price-val sl">${fmt(r.plan.shortPlan.sl)}</span>
            <span class="plan-price-pnl pnl-neg">-${r.plan.shortPlan.distSL.toFixed(2)}</span>
          </div>
        </div>
        <div class="plan-lot-row" style="grid-template-columns: repeat(3, 1fr);">
          <div class="plan-lot-cell">
            <span class="plan-lot-label">ATR (Volatility)</span>
            <span class="plan-lot-value">${r.plan.atr ? r.plan.atr.toFixed(2) : '--'}</span>
          </div>
          <div class="plan-lot-cell">
            <span class="plan-lot-label">Suggested Lot (สายซิ่ง)</span>
            <span class="plan-lot-value" style="color: var(--cyan); font-size: 1.1em; font-weight: bold;">${r.plan.shortPlan.lotSize.toFixed(2)}</span>
          </div>
          <div class="plan-lot-cell" style="border-left: 1px solid var(--border);">
            <span class="plan-lot-label" style="color: #a78bfa;">Est. Spread Cost</span>
            <span class="plan-lot-value" style="color: #a78bfa; font-weight: 800;">$${(r.plan.estSpreadCost * (r.plan.shortPlan.lotSize / r.plan.lotSize)).toFixed(2)}</span>
          </div>
        </div>
        <div class="plan-actions" style="margin-top: 10px;">
          <button class="plan-btn-use" onclick="App.useAnalysisPlan(true)" style="background: rgba(0,210,255,0.1); color: var(--cyan); border-color: rgba(0,210,255,0.3);">📋 ใช้แผนสั้น</button>
          <button class="plan-btn-save" onclick="App.saveCurrentPlan(true)" style="background: var(--cyan); color: #000;">💾 บันทึกแผนสั้น</button>
        </div>
        ` : ''}
      </div>`;
    } catch(e) { container.innerHTML += '<div style="color:red">Trade Plan Render Error: ' + e.message + '</div>'; }
  },

  showLoading() {
    const el = document.getElementById('analysis-results');
    if (el) el.innerHTML = `
      <div class="analysis-empty">
        <div class="spinner"></div>
        <h3 id="btn-run-text">กำลังวิเคราะห์...</h3>
        <p>ดึงข้อมูลกราฟและประมวลผล Technical Indicators ทั้งหมด (โปรดรอสักครู่)</p>
      </div>`;
  },

  showError(msg) {
    const el = document.getElementById('analysis-results');
    if (el) el.innerHTML = `
      <div class="analysis-empty" style="border-color:rgba(255,71,87,0.3)">
        <div class="empty-icon">⚠️</div>
        <h3 style="color:var(--red)">วิเคราะห์ไม่สำเร็จ</h3>
        <p>${msg}</p>
        <p style="margin-top:8px;font-size:0.72rem;color:var(--text-3)">กด "วิเคราะห์อัตโนมัติ" เพื่อลองใหม่</p>
      </div>`;
  }
};
