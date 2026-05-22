/* ==========================================================================
   ApexTrader Pro — Risk & Position Size Calculator
   ========================================================================== */

const Calculator = {
  tradeLog: [],
  LOG_KEY: 'apextrader_log_v3',

  init() {
    this.tradeLog = this.loadLog();
    this.renderLog();
    this.bindEvents();
  },

  bindEvents() {
    // Direction toggle
    document.getElementById('r-buy-btn')?.addEventListener('click', () => {
      document.getElementById('r-buy-btn').classList.add('active');
      document.getElementById('r-sell-btn').classList.remove('active');
    });
    document.getElementById('r-sell-btn')?.addEventListener('click', () => {
      document.getElementById('r-sell-btn').classList.add('active');
      document.getElementById('r-buy-btn').classList.remove('active');
    });

    // Risk % quick buttons
    document.querySelectorAll('.rpct-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const el = document.getElementById('r-risk-pct');
        if (el) el.value = btn.getAttribute('data-v');
        this.calculate();
      });
    });

    // Calculate
    document.getElementById('btn-calc-risk')?.addEventListener('click', () => this.calculate());

    // Auto-calc on input change
    ['r-balance','r-risk-pct','r-entry','r-sl','r-tp'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.calculate());
    });

    // Save
    document.getElementById('btn-save-trade')?.addEventListener('click', () => this.saveTrade());
  },

  calculate() {
    const balance  = parseFloat(document.getElementById('r-balance')?.value) || 50;
    const riskPct  = parseFloat(document.getElementById('r-risk-pct')?.value) || 5;
    const entry    = parseFloat(document.getElementById('r-entry')?.value) || 0;
    const sl       = parseFloat(document.getElementById('r-sl')?.value) || 0;
    const tp       = parseFloat(document.getElementById('r-tp')?.value) || 0;
    const asset    = document.getElementById('r-asset')?.value || 'XAUUSD';
    const isBuy    = document.getElementById('r-buy-btn')?.classList.contains('active');

    if (!balance || !entry || !sl) return;

    const riskUsd  = balance * riskPct / 100;
    const slDist   = Math.abs(entry - sl);
    const tpDist   = Math.abs(tp - entry);
    const rr       = tpDist > 0 && slDist > 0 ? (tpDist / slDist) : 0;

    // Lot calculation per asset type
    let lot = 0;
    if (asset === 'XAUUSD') {
      // Gold: 1 lot = 100 oz, pip = $0.01, pip value = $1 per 0.01 move per 0.01 lot
      // Simplified: risk / (slDist * 100) = lot in standard lots (100 oz)
      lot = slDist > 0 ? riskUsd / (slDist * 100) : 0;
      if (lot > 0 && lot < 0.01) {
        lot = 0.01; // Minimum lot size for XAUUSD is 0.01
      }
    } else if (asset === 'BTCUSDT') {
      lot = slDist > 0 ? riskUsd / slDist : 0;
      if (lot > 0 && lot < 0.001) {
        lot = 0.001; // Minimum lot size for BTC
      }
    } else {
      // Forex: 1 pip = $10 for 1 standard lot (rough approximation)
      lot = slDist > 0 ? riskUsd / (slDist * 10) : 0;
      if (lot > 0 && lot < 0.01) {
        lot = 0.01; // Minimum lot size for Forex
      }
    }

    const tpUsd = lot > 0 && tpDist > 0 ? (tpDist * lot * (asset === 'XAUUSD' ? 100 : 1)) : (rr * riskUsd);

    // Show results
    const resultsEl = document.getElementById('risk-results');
    if (resultsEl) resultsEl.style.display = 'block';

    const priceDec = asset === 'XAUUSD' ? 2 : (asset === 'DXY' ? 3 : 0);
    this.setEl('rr-tp-price',   tp    ? tp.toFixed(priceDec) : '--');
    this.setEl('rr-entry-price', entry ? entry.toFixed(priceDec) : '--');
    this.setEl('rr-sl-price',   sl    ? sl.toFixed(priceDec) : '--');
    this.setEl('rr-tp-pnl',     tp ? `+$${tpUsd.toFixed(2)}` : '--');
    this.setEl('rr-sl-pnl',     `-$${riskUsd.toFixed(2)}`);
    this.setEl('r-rr',          rr > 0 ? `${rr.toFixed(2)} : 1` : '--');
    this.setEl('r-lot',         lot > 0 ? `${lot.toFixed(3)} lot` : '--');
    this.setEl('r-risk-usd',    `-$${riskUsd.toFixed(2)}`);
    this.setEl('r-reward-usd',  tp ? `+$${tpUsd.toFixed(2)}` : '--');

    // Color R:R
    const rrEl = document.getElementById('r-rr');
    if (rrEl) {
      rrEl.className = 'result-value highlight';
      if (rr >= 2) rrEl.style.color = 'var(--green)';
      else if (rr >= 1) rrEl.style.color = 'var(--gold)';
      else rrEl.style.color = 'var(--red)';
    }

    return { balance, riskPct, entry, sl, tp, asset, lot, riskUsd, tpUsd, rr, isBuy };
  },

  setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  },

  /* Populate from Analysis result */
  populateFromPlan(plan, asset) {
    if (!plan || plan.dir === 'NEUTRAL') return;
    const assetEl = document.getElementById('r-asset');
    if (assetEl) assetEl.value = asset;

    const buyBtn  = document.getElementById('r-buy-btn');
    const sellBtn = document.getElementById('r-sell-btn');
    if (plan.dir === 'BUY') {
      buyBtn?.classList.add('active');
      sellBtn?.classList.remove('active');
    } else {
      sellBtn?.classList.add('active');
      buyBtn?.classList.remove('active');
    }

    ['r-entry', 'r-sl', 'r-tp'].forEach((id, i) => {
      const val = [plan.entry, plan.sl, plan.tp][i];
      const el  = document.getElementById(id);
      if (el && val) el.value = parseFloat(val).toFixed(asset === 'XAUUSD' ? 2 : (asset === 'DXY' ? 3 : 2));
    });

    this.calculate();
    App.switchPanel('risk');
    App.toast('ใส่แผนการเทรดแล้ว', 'success');
  },

  saveTrade() {
    const data = this.calculate();
    if (!data) { App.toast('กรอกข้อมูลให้ครบก่อน', 'error'); return; }

    const entry = {
      id:      Date.now(),
      asset:   data.asset,
      dir:     data.isBuy ? 'BUY' : 'SELL',
      entry:   data.entry,
      sl:      data.sl,
      tp:      data.tp,
      lot:     data.lot,
      rr:      data.rr,
      risk:    data.riskUsd,
      reward:  data.tpUsd,
      date:    new Date().toLocaleDateString('th-TH', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
    };

    this.tradeLog.unshift(entry);
    if (this.tradeLog.length > 50) this.tradeLog.pop();
    this.saveLog();
    this.renderLog();
    App.toast('บันทึกแผนแล้ว', 'success');
  },

  renderLog() {
    const el    = document.getElementById('trade-log');
    const count = document.getElementById('log-count');
    if (!el) return;
    if (count) count.textContent = `${this.tradeLog.length} รายการ`;
    if (!this.tradeLog.length) {
      el.innerHTML = '<div class="log-empty">ยังไม่มีแผนการเทรด</div>';
      return;
    }
    el.innerHTML = this.tradeLog.map(t => `
      <div class="log-item" data-id="${t.id}">
        <span class="log-dir ${t.dir.toLowerCase()}">${t.dir}</span>
        <div class="log-info">
          <div class="log-asset">${t.asset}</div>
          <div class="log-prices">E: ${parseFloat(t.entry).toFixed(t.asset === 'XAUUSD' ? 2 : (t.asset === 'DXY' ? 3 : 2))} | SL: ${parseFloat(t.sl).toFixed(t.asset === 'XAUUSD' ? 2 : (t.asset === 'DXY' ? 3 : 2))} | TP: ${parseFloat(t.tp || 0).toFixed(t.asset === 'XAUUSD' ? 2 : (t.asset === 'DXY' ? 3 : 2))}</div>
          <div class="log-date">${t.date} · R:R ${parseFloat(t.rr).toFixed(2)} · ${parseFloat(t.lot).toFixed(3)} lot</div>
        </div>
        <button class="log-delete" onclick="Calculator.deleteLog(${t.id})">×</button>
      </div>
    `).join('');
  },

  deleteLog(id) {
    this.tradeLog = this.tradeLog.filter(t => t.id !== id);
    this.saveLog();
    this.renderLog();
  },

  clearAllLogs() {
    if (confirm('คุณแน่ใจหรือไม่ที่จะล้างแผนการเทรดทั้งหมด?')) {
      this.tradeLog = [];
      this.saveLog();
      this.renderLog();
      App.toast('ล้างประวัติแผนทั้งหมดแล้ว', 'success');
    }
  },

  saveLog() {
    try { localStorage.setItem(this.LOG_KEY, JSON.stringify(this.tradeLog)); } catch {}
  },

  loadLog() {
    try {
      const d = localStorage.getItem(this.LOG_KEY);
      return d ? JSON.parse(d) : [];
    } catch { return []; }
  }
};

window.Calculator = Calculator;
