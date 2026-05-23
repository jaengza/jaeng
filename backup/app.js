/* ==========================================================================
   kesineTrader — Main App Coordinator v3.0
   ========================================================================== */

const App = {
  currentPanel: 'dashboard',
  currentAsset: 'XAUUSD',
  currentTF: '5m',

  init() {
    this.startClock();
    this.bindNavigation();
    this.bindAssets();
    this.bindGlobalTF();
    this.bindAnalysis();
    this.bindChart();
    this.bindQuickAnalyze();

    // Init modules
    Market.init();
    Market.onPriceUpdate(prices => this.onPrices(prices));

    Calculator.init();

    // Load TV widgets
    this.loadMainChart('FX_IDC:XAUUSD', 5);
  },

  /* ── Clock ────────────────────────────────────────────────────────────────── */
  startClock() {
    const update = () => {
      const now = new Date();
      const el  = document.getElementById('live-clock');
      if (el) el.textContent = now.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
    };
    update();
    setInterval(update, 1000);
  },

  /* ── Panel Navigation ─────────────────────────────────────────────────────────── */
  bindNavigation() {
    document.querySelectorAll('.bnav-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const panel = e.currentTarget.dataset.panel;
        this.switchPanel(panel);
      });
    });
  },

  switchPanel(panelName) {
    // Hide all
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('panel-active'));
    document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));

    // Show target
    const target = document.getElementById(`panel-${panelName}`);
    if (target) target.classList.add('panel-active');

    const navBtn = document.getElementById(`bn-${panelName}`);
    if (navBtn) navBtn.classList.add('active');

    this.currentPanel = panelName;
  },

  /* ── Asset Tabs ───────────────────────────────────────────────────────────────── */
  bindAssets() {
    document.querySelectorAll('.asset-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.asset-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const asset = e.currentTarget.dataset.asset;
        this.currentAsset = asset;
        // Sync analysis asset selector
        const sel = document.getElementById('an-asset');
        if (sel) sel.value = asset;
        // Auto-run analysis if already on analysis panel
        if (this.currentPanel === 'analysis') this.runAnalysis();
      });
    });
  },

  /* ── Global TF ───────────────────────────────────────────────────────────────── */
  bindGlobalTF() {
    document.querySelectorAll('.tf-pill').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.tf-pill').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentTF = e.currentTarget.dataset.tf;
        // Sync analysis TF
        document.querySelectorAll('.ctrl-tf').forEach(b => {
          b.classList.toggle('active', b.dataset.tf === this.currentTF);
        });
      });
    });

    // Analysis panel TF buttons
    document.querySelectorAll('.ctrl-tf').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.ctrl-tf').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentTF = e.currentTarget.dataset.tf;
        // Sync header TF
        document.querySelectorAll('.tf-pill').forEach(b => {
          b.classList.toggle('active', b.dataset.tf === this.currentTF);
        });
      });
    });
  },

  /* ── Analysis Controls ────────────────────────────────────────────────────────── */
  bindAnalysis() {
    document.getElementById('btn-run-analysis')?.addEventListener('click', () => this.runAnalysis());
    document.getElementById('an-asset')?.addEventListener('change', e => {
      this.currentAsset = e.target.value;
    });
  },

  async runAnalysis() {
    const asset = document.getElementById('an-asset')?.value || this.currentAsset;
    const tf    = document.querySelector('.ctrl-tf.active')?.dataset.tf || this.currentTF;
    const btn   = document.getElementById('btn-run-analysis');
    const txt   = document.getElementById('btn-run-text');

    if (btn) btn.classList.add('loading');
    if (txt) txt.textContent = '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c...';

    // MTFA Logic: Tiered HTF (Higher Timeframe) Mapping
    let htf = '1h';
    switch (tf) {
      case '1m':  htf = '5m';  break;
      case '5m':  htf = '15m'; break;
      case '15m': htf = '1h';  break;
      case '1h':  htf = '4h';  break;
      case '4h':  htf = '1d';  break;
      case '1d':  htf = '1w';  break;
      case '1w':  htf = '1M';  break; // Fallback
      default:    htf = '1h';
    }

    const brokerPriceInput = document.getElementById('an-broker-price');
    const brokerPrice = brokerPriceInput && brokerPriceInput.value ? parseFloat(brokerPriceInput.value) : null;

    await Analysis.run(asset, tf, htf, brokerPrice);

    if (btn) btn.classList.remove('loading');
    if (txt) txt.textContent = '\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34';
  },

  bindQuickAnalyze() {
    document.getElementById('btn-quick-analyze')?.addEventListener('click', () => {
      this.switchPanel('analysis');
      setTimeout(() => this.runAnalysis(), 100);
    });
  },

  /* ── Price updates ──────────────────────────────────────────────────────────── */
  onPrices(prices) {
    // Dashboard chips
    if (prices.xau > 0) {
      this.updateChip('xau-price', prices.xau, 2, 'text-gold');
      this.updateChip('xau-change', prices.xauPct, null, null, '%');
      this.updateChip('h-xau-price', prices.xau, 2);
    }
    if (prices.btc > 0) {
      this.updateChip('btc-price', prices.btc, 0);
      this.updateChip('btc-change', prices.btcPct, null, null, '%');
      this.updateChip('h-btc-price', prices.btc, 0);
    }
    // ETH chip updating enabled
    if (prices.eth > 0) {
      this.updateChip('eth-price', prices.eth, 2, 'text-purple');
      this.updateChip('eth-change', prices.ethPct, null, null, '%');
      this.updateChip('h-eth-price', prices.eth, 2);
    }
    if (prices.dxy > 0) {
      this.updateChip('dxy-price', prices.dxy, 3, 'text-blue');
      this.updateChip('dxy-change', prices.dxyPct, null, null, '%');
      this.updateChip('h-dxy-price', prices.dxy, 3);
    }
  },

  updateChip(id, value, dec, extraClass, suffix = '') {
    const el = document.getElementById(id);
    if (!el) return;
    const oldNum = parseFloat(el.dataset.lastVal || 0);
    let display;
    if (dec !== null) {
      const isDxy = id.includes('dxy');
      const prefix = isDxy ? '' : '$';
      display = `${prefix}${parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}${suffix}`;
    } else {
      const sign = value >= 0 ? '+' : '';
      display = `${sign}${parseFloat(value).toFixed(2)}${suffix}`;
      el.className = `chip-change ${value >= 0 ? 'up' : 'down'}`;
    }
    el.textContent = display;
    el.dataset.lastVal = value;
    if (extraClass) el.classList.add(extraClass);
    // Flash
    if (oldNum > 0 && dec !== null) {
      const flashClass = value > oldNum ? 'flash-up' : value < oldNum ? 'flash-down' : '';
      if (flashClass) {
        el.classList.add(flashClass);
        setTimeout(() => el.classList.remove(flashClass), 500);
      }
    }
  },

  /* ── Chart Panel ────────────────────────────────────────────────────────────── */
  bindChart() {
    document.querySelectorAll('.chart-sym-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.chart-sym-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const symbol   = e.currentTarget.dataset.symbol;
        const interval = document.querySelector('.chart-tf-btn.active')?.dataset.interval || '5';
        this.loadMainChart(symbol, interval);
      });
    });

    document.querySelectorAll('.chart-tf-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.chart-tf-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const symbol   = document.querySelector('.chart-sym-btn.active')?.dataset.symbol || 'FX_IDC:XAUUSD';
        const interval = e.currentTarget.dataset.interval;
        this.loadMainChart(symbol, interval);
      });
    });
  },

  loadMainChart(symbol, interval) {
    const el = document.getElementById('tv-main-chart');
    if (!el) return;
    el.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'tradingview-widget-container__widget';
    el.appendChild(div);
    const s = document.createElement('script');
    s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    s.async = true;
    s.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: String(interval),
      timezone: 'Asia/Bangkok',
      theme: 'dark',
      style: '1',
      locale: 'th',
      enable_publishing: false,
      allow_symbol_change: false,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_side_toolbar: false,
      backgroundColor: 'rgba(5,8,16,1)',
      gridColor: 'rgba(255,255,255,0.04)',
      studies: ['RSI@tv-basicstudies', 'MACD@tv-basicstudies']
    });
    div.appendChild(s);
  },



  /* ── Dashboard: Update Signal Cards ──────────────────────────────────────────── */
  updateDashboardSignals(result) {
    const el = document.getElementById('signal-cards');
    if (!el || !result) return;
    const { rsiVal, macdVal, emaData, score, plan } = result;
    const asset = Analysis.state.asset;
    const tf    = Analysis.state.tf;
    const fmt   = v => v !== null && v !== undefined ? parseFloat(v).toFixed((asset === 'XAUUSD' || asset === 'ETHUSDT') ? 2 : (asset === 'DXY' ? 3 : 0)) : '--';

    el.innerHTML = `
      <div class="signal-row">
        <div class="signal-card ${rsiVal < 35 ? 'bullish' : rsiVal > 65 ? 'bearish' : 'neutral'}">
          <span class="signal-label">RSI (14)</span>
          <span class="signal-value">${rsiVal !== null ? rsiVal.toFixed(1) : '--'}</span>
          <span class="signal-desc">${rsiVal < 35 ? 'Oversold' : rsiVal > 65 ? 'Overbought' : 'Neutral'}</span>
        </div>
        <div class="signal-card ${macdVal?.trend || 'neutral'}">
          <span class="signal-label">MACD</span>
          <span class="signal-value">${macdVal ? (macdVal.histogram > 0 ? '▲' : '▼') : '--'}</span>
          <span class="signal-desc">${macdVal?.cross !== 'none' ? (macdVal.cross === 'golden' ? 'Golden Cross' : 'Death Cross') : (macdVal?.trend === 'bull' ? 'Bullish' : 'Bearish')}</span>
        </div>
        <div class="signal-card" style="padding: 10px; justify-content: flex-start; gap: 6px; ${emaData?.trend === 'bull' ? 'background: rgba(46, 213, 115, 0.1); border-color: var(--green);' : emaData?.trend === 'bear' ? 'background: rgba(255, 71, 87, 0.1); border-color: var(--red);' : 'background: rgba(255,255,255,0.05); border-color: var(--border);'}">
          <span class="signal-label" style="margin-bottom: 2px;">EMA Trend (All TFs)</span>
          <div style="display: flex; gap: 4px; justify-content: space-between; width: 100%;">
            ${['1m','5m','15m','1h','4h','1d'].map(t => {
              const td = result.multiEmaTrend?.[t];
              if(!td) return `<div style="flex:1; text-align:center; font-size:0.6rem; color:var(--text-3);">-</div>`;
              const isSelected = t === tf;
              const tClass = td.trend === 'bull' ? (isSelected ? 'color: #000;' : 'color: var(--green);') : td.trend === 'bear' ? (isSelected ? 'color: #000;' : 'color: var(--red);') : (isSelected ? 'color: #000;' : 'color: var(--text-3);');
              const tIcon = td.trend === 'bull' ? '⬆' : td.trend === 'bear' ? '⬇' : '↔';
              return `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; padding: 4px 0; border-radius: 4px; ${isSelected ? 'background: var(--cyan); box-shadow: 0 0 5px var(--cyan);' : 'background: rgba(0,0,0,0.3);'}">
                <span style="font-size: 0.6rem; ${isSelected ? 'color: #000; font-weight: bold;' : 'color: var(--text-2);'}">${t}</span>
                <span style="font-size: 0.75rem; font-weight: bold; ${tClass}">${tIcon}</span>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
      ${plan && plan.dir !== 'NEUTRAL' ? `
      <!-- 🛡️ SASP OPTIMIZER FILTER WARNING -->
      ${(Analysis.state.saspParams && score.strength < Analysis.state.saspParams.saspThreshold) ? `
      <div style="background: rgba(255, 159, 67, 0.1); border-left: 3px solid var(--gold); padding: 8px; border-radius: 4px; margin-bottom: 12px; font-size: 0.75rem;">
        <strong style="color: var(--gold);">⚠️ SASP Optimizer Warning</strong><br>
        <span style="color: var(--text-2);">ความแรงสัญญาณ (${score.strength.toFixed(1)}) ต่ำกว่าเกณฑ์แนะนำ (${(Analysis.state.saspParams?.saspThreshold || 3.5).toFixed(1)}) แผนนี้จึงมีความเสี่ยงสูง</span>
        <div style="margin-top: 6px; background: rgba(0,0,0,0.2); padding: 6px; border-radius: 4px;">
          <strong style="color: var(--text-1); margin-bottom: 2px; display: block;">เงื่อนไขที่เข้า (${plan.dir}):</strong>
          <ul style="margin: 0; padding-left: 16px; list-style-type: disc;">
            ${(score.reasons || []).length > 0 ? (score.reasons || []).map(reason => `<li style="${reason.includes('-') && !reason.includes('(-') ? 'color:var(--red)' : 'color:var(--green)'}">${reason}</li>`).join('') : '<li>--</li>'}
          </ul>
        </div>
      </div>` : `
      <div style="background: rgba(46, 213, 115, 0.1); border-left: 3px solid var(--green); padding: 8px; border-radius: 4px; margin-bottom: 12px; font-size: 0.75rem;">
        <strong style="color: var(--green);">🎯 SASP Sniper Verified</strong><br>
        <span style="color: var(--text-2);">ความแรงสัญญาณ (${score.strength.toFixed(1)}) ผ่านเกณฑ์แนะนำ (${(Analysis.state.saspParams?.saspThreshold || 3.5).toFixed(1)}) สถิติแม่นยำสูง</span>
        <div style="margin-top: 6px; background: rgba(0,0,0,0.2); padding: 6px; border-radius: 4px;">
          <strong style="color: var(--text-1); margin-bottom: 2px; display: block;">เงื่อนไขที่เข้า (${plan.dir}):</strong>
          <ul style="margin: 0; padding-left: 16px; list-style-type: disc;">
            ${(score.reasons || []).length > 0 ? (score.reasons || []).map(reason => `<li style="${reason.includes('-') && !reason.includes('(-') ? 'color:var(--red)' : 'color:var(--green)'}">${reason}</li>`).join('') : '<li>--</li>'}
          </ul>
        </div>
      </div>`}

      <div class="trade-plan-card">
        <div class="plan-banner ${plan.dir.toLowerCase()}">
          <div class="plan-dir ${plan.dir.toLowerCase()}">${plan.dir === 'BUY' ? '\u2b06' : '\u2b07'} ${plan.dir}</div>
          <div class="plan-asset-tf"><span>${asset}</span><span>${tf}</span></div>
          <div class="plan-rr-badge">R:R ${plan.rr}:1</div>
        </div>
        <div class="plan-prices">
          <div class="plan-price-cell"><span class="plan-price-lbl">TP</span><span class="plan-price-val tp">${fmt(plan.tp)}</span></div>
          <div class="plan-price-cell"><span class="plan-price-lbl">ENTRY</span><span class="plan-price-val entry">${fmt(plan.entry)}</span></div>
          <div class="plan-price-cell"><span class="plan-price-lbl">SL</span><span class="plan-price-val sl">${fmt(plan.sl)}</span></div>
        </div>
        <div class="plan-actions">
          <button class="plan-btn-use" onclick="App.useAnalysisPlan()">\u0e43\u0e0a\u0e49\u0e43\u0e19 Risk Calc</button>
          <button class="plan-btn-save" onclick="App.saveCurrentPlan()">&uml;\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e41\u0e1c\u0e19</button>
        </div>
      </div>` : ''}
    `;
  },

  useAnalysisPlan(isShort = false) {
    const result = Analysis.state.result;
    if (!result?.plan) { this.toast('\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c\u0e01\u0e48\u0e2d\u0e19', 'error'); return; }
    let p = result.plan;
    if (isShort && p.shortPlan) {
      p = { ...p, ...p.shortPlan, prob: p.shortPlan.prob };
    }
    Calculator.populateFromPlan(p, Analysis.state.asset);
  },

  saveCurrentPlan(isShort = false) {
    const result = Analysis.state.result;
    if (!result?.plan) return;
    let p = result.plan;
    if (p.dir === 'NEUTRAL') { this.toast('\u0e44\u0e21\u0e48\u0e21\u0e35\u0e41\u0e1c\u0e19 (Neutral)', 'error'); return; }
    if (isShort && p.shortPlan) {
      p = { ...p, ...p.shortPlan, prob: p.shortPlan.prob };
    }
    Calculator.populateFromPlan(p, Analysis.state.asset);
    Calculator.saveTrade();
  },

  /* ── Toast ──────────────────────────────────────────────────────────────────── */
  toast(msg, type = 'info') {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
