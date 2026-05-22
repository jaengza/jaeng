/* ==========================================================================
   ApexTrader Pro — Auto Analysis Engine
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

  /* ── Run Full Auto-Analysis ──────────────────────────────────────────────── */
  async run(asset, tf) {
    if (this.state.loading) return;
    this.state.asset   = asset;
    this.state.tf      = tf;
    this.state.loading = true;

    this.showLoading();

    try {
      // 1. Fetch OHLCV data
      const candles = await Market.fetchOHLCV(asset, tf, 250);
      if (!candles || candles.length < 30) {
        throw new Error('ข้อมูลกราฟไม่เพียงพอ (ต้องการอย่างน้อย 30 แท่ง)');
      }
      
      // Sync last candle with actual live spot price to ensure calculations align with real-time reality
      let livePrice = 0;
      if (asset === 'XAUUSD') livePrice = Market.prices.xau;
      else if (asset === 'BTCUSDT') livePrice = Market.prices.btc;
      else if (asset === 'ETHUSDT') livePrice = Market.prices.eth;
      else if (asset === 'DXY') livePrice = Market.prices.dxy;

      if (livePrice > 0 && candles.length > 0) {
        const lastCandle = candles[candles.length - 1];
        lastCandle.close = livePrice;
        if (livePrice > lastCandle.high) lastCandle.high = livePrice;
        if (livePrice < lastCandle.low) lastCandle.low = livePrice;
      }
      
      this.state.candles = candles;

      // 2. Prepare arrays
      const closes = Market.closes(candles);
      const highs  = Market.highs(candles);
      const lows   = Market.lows(candles);
      const last   = closes[closes.length - 1];

      // 3. Calculate all indicators
      const rsiVal     = Indicators.rsi(closes);
      const macdVal    = Indicators.macd(closes);
      const emaData    = Indicators.emaTrend(closes);
      const atrVal     = Indicators.atr(highs, lows, closes);
      const swings     = Indicators.swingPoints(highs, lows, Math.min(100, candles.length));
      
      // Calculate signal score first to obtain the direction for Fibonacci calculation
      const score      = Indicators.signalScore({ rsi: rsiVal, macd: macdVal, emaTrend: emaData });
      
      // Pass direction into Fibonacci calculation: Buy is true, Sell is false
      const fiboLevels = Indicators.fibonacci(swings.swingHigh, swings.swingLow, score.direction === 'BUY');
      
      const pivotData  = Indicators.pivots(
        highs[highs.length - 1],
        lows[lows.length - 1],
        last
      );
      const ob         = Indicators.orderBlock(candles, score.direction);
      const fvgs       = Indicators.fairValueGaps(candles);

      // 4. Build trade plan
      const plan = this.buildTradePlan({
        asset, tf, last, score, rsiVal, macdVal, emaData,
        atrVal, swings, fiboLevels, pivotData, ob, fvgs
      });

      this.state.result = { rsiVal, macdVal, emaData, atrVal, swings, fiboLevels, pivotData, ob, fvgs, score, plan, last };

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
  buildTradePlan({ asset, tf, last, score, rsiVal, atrVal, fiboLevels, pivotData, ob, swings }) {
    const dir = score.direction;
    const atr = atrVal || (last * 0.003); // fallback: 0.3% of price
    const ote  = fiboLevels ? fiboLevels.find(f => f.isOte) : null; // 70.5% Fibo

    let entry = last, sl = null, tp = null;
    let slDist = 0, tpDist = 0, rr = 0, lotSize = 0, estSpreadCost = 0;

    if (dir !== 'NEUTRAL') {
      if (dir === 'BUY') {
        entry = ote ? ote.price : last;
        
        // Stop Loss structurally placed below Swing Low or the low of the Order Block
        const baseSL = ob ? Math.min(swings.swingLow, ob.low) : swings.swingLow;
        sl = baseSL;
        
        // Guard against extremely tight SL
        if (entry - sl < atr * 0.5) {
          sl = entry - atr * 1.5;
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
        
        // Guard against extremely tight SL
        if (sl - entry < atr * 0.5) {
          sl = entry + atr * 1.5;
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
        if (rawLot > 0 && rawLot < 0.001) {
          lotSize = 0.001;
        } else {
          lotSize = Math.floor(rawLot * 1000) / 1000;
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
    
    return { 
      dir, 
      entry, 
      sl, 
      tp, 
      rr: rr > 0 ? rr.toFixed(2) : '--', 
      lot: lotSize > 0 ? lotSize.toFixed(asset === 'BTCUSDT' ? 3 : 2) : '--', // Format based on asset type
      estSpreadCost: estSpreadCost > 0 ? estSpreadCost.toFixed(2) : '--', // Add estimated spread cost
      slPips: slDist > 0 ? slDist : null, 
      tpPips: tpDist > 0 ? tpDist : null, 
      atr, 
      reasons: score.reasons,
      prob: Math.round(baseProb),
      dxyReason
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

      <!-- ── ICT ANALYSIS ──────────────────────────────────────── -->
      <div class="indicator-group">
        <div class="ind-group-header">🎯 ICT Analysis</div>
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
            <span class="ict-item-value text-gold">${fmt(r.fiboLevels.find(f => f.isOte)?.price)}</span>
            <span class="ict-item-badge badge-neutral">OTE</span>
          </div>
          ${r.ob ? `
          <div class="ict-item">
            <span class="ict-item-label">Order Block (${r.ob.type === 'bullish_ob' ? 'Bullish' : 'Bearish'})</span>
            <span class="ict-item-value">${fmt(r.ob.low)} – ${fmt(r.ob.high)}</span>
            <span class="ict-item-badge ${r.ob.type === 'bullish_ob' ? 'badge-buy' : 'badge-sell'}">${r.ob.type === 'bullish_ob' ? 'BUY OB' : 'SELL OB'}</span>
          </div>` : ''}
          ${r.fvgs.length > 0 ? r.fvgs.slice(-1).map(fvg => `
          <div class="ict-item">
            <span class="ict-item-label">FVG (${fvg.type})</span>
            <span class="ict-item-value">${fmt(fvg.bottom)} – ${fmt(fvg.top)}</span>
            <span class="ict-item-badge ${fvg.type === 'bullish' ? 'badge-buy' : 'badge-sell'}">${fvg.type === 'bullish' ? '⬆ Gap' : '⬇ Gap'}</span>
          </div>`).join('') : ''}
        </div>
      </div>

      <!-- ── FIBONACCI LEVELS ──────────────────────────────────── -->
      <div class="indicator-group">
        <div class="ind-group-header">📐 Fibonacci Retracement</div>
        <div class="fibo-levels">
          ${r.fiboLevels.map(f => `
          <div class="fibo-row ${f.isOte ? 'ote-row' : ''}">
            <span class="fibo-pct ${f.isOte ? 'ote' : ''}">${f.label}${f.isOte ? ' ★' : ''}</span>
            <div class="fibo-track"><div class="fibo-bar" style="width:${f.pct}%"></div></div>
            <span class="fibo-price">${fmt(f.price)}</span>
          </div>`).join('')}
        </div>
      </div>

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
      </div>

      <!-- ── SIGNAL SCORE + TRADE PLAN ────────────────────────── -->
      <div class="indicator-group">
        <div class="ind-group-header">🤖 Auto Trade Plan</div>
        <div class="signal-score-box">
          <span class="score-label">Signal Score</span>
          <div class="score-value ${r.score.type}">${r.score.direction}</div>
          <div class="score-desc">${r.score.reasons.join(' · ') || 'สัญญาณผสม'}</div>
        </div>
        
        <!-- Win Probability & DXY Confluence -->
        <div class="prob-forecast-box">
          <div class="prob-header">
            <span class="prob-title">📊 ความน่าจะเป็นในการชนะ (Win Probability)</span>
            <span class="prob-value ${r.plan.prob >= 75 ? 'text-green' : r.plan.prob >= 55 ? 'text-gold' : 'text-red'}">${r.plan.prob}%</span>
          </div>
          <div class="prob-bar-container">
            <div class="prob-bar-fill" style="width: ${r.plan.prob}%; background: linear-gradient(90deg, ${r.plan.prob >= 75 ? 'var(--green)' : r.plan.prob >= 55 ? 'var(--gold)' : 'var(--red)'}, var(--cyan));"></div>
          </div>
          ${r.plan.dxyReason ? `
          <div class="dxy-correl-section">
            <div class="dxy-correl-title">💵 สหสัมพันธ์ดัชนีดอลลาร์ (DXY Correlation):</div>
            <div class="dxy-correl-desc">${r.plan.dxyReason}</div>
          </div>
          ` : ''}
        </div>

        ${r.plan.dir !== 'NEUTRAL' ? `
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
        <div class="plan-actions">
          <button class="plan-btn-use" onclick="App.useAnalysisPlan()">📋 ใช้ใน Risk Calc</button>
          <button class="plan-btn-save" onclick="App.saveCurrentPlan()">💾 บันทึกแผน</button>
        </div>` : `
        <div style="padding:16px;text-align:center;color:var(--text-2);font-size:0.8rem;">
          ⚠️ สัญญาณยังไม่ชัดเจน รอการยืนยันจาก Price Action หรือเปลี่ยน Timeframe
        </div>`}
      </div>
    `;
  },

  showLoading() {
    const el = document.getElementById('analysis-results');
    if (el) el.innerHTML = `
      <div class="analysis-empty">
        <div class="spinner"></div>
        <h3 id="btn-run-text">กำลังวิเคราะห์...</h3>
        <p>ดึงข้อมูลกราฟและคำนวณ RSI / MACD / Fibonacci / ICT</p>
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
