/* ==========================================================================
   kesineTrader — Risk & Position Size Calculator
   ========================================================================== */

const Calculator = {
  tradeLog: [],
  LOG_KEY: 'kesinetrader_log_v3',

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
      this.calculate();
    });
    document.getElementById('r-sell-btn')?.addEventListener('click', () => {
      document.getElementById('r-sell-btn').classList.add('active');
      document.getElementById('r-buy-btn').classList.remove('active');
      this.calculate();
    });

    // Risk % quick buttons (with touch support for instant mobile response)
    document.querySelectorAll('.rpct-btn').forEach(btn => {
      const handleRiskSelect = (e) => {
        e.preventDefault();
        const el = document.getElementById('r-risk-pct');
        if (el) {
          el.value = btn.getAttribute('data-v');
          this.calculate();
        }
      };
      btn.addEventListener('click', handleRiskSelect);
      btn.addEventListener('touchstart', handleRiskSelect, { passive: false });
    });

    // Calculate (manual click triggers validation alert)
    document.getElementById('btn-calc-risk')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.calculate(true);
    });
    document.getElementById('btn-calc-risk')?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.calculate(true);
    }, { passive: false });

    // Auto-calc on multiple input events for high mobile keyboard stability
    ['r-balance','r-risk-pct','r-entry','r-sl','r-tp', 'r-asset', 'r-spread'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        ['input', 'change', 'keyup', 'blur'].forEach(evtType => {
          el.addEventListener(evtType, () => this.calculate());
        });
      }
    });

    // Asset selection change listener to dynamically update Exness default spread values
    document.getElementById('r-asset')?.addEventListener('change', (e) => {
      const asset = e.target.value;
      const spreadEl = document.getElementById('r-spread');
      if (spreadEl) {
        if (asset === 'XAUUSD') spreadEl.value = 200;
        else if (asset === 'BTCUSDT') spreadEl.value = 2150;
        else if (asset === 'ETHUSDT') spreadEl.value = 160;
        else if (asset === 'DXY') spreadEl.value = 15;
        else spreadEl.value = 15; // Forex / others default
      }
      this.calculate();
    });

    // Save
    document.getElementById('btn-save-trade')?.addEventListener('click', () => this.saveTrade());
  },

  calculate(isManualClick = false) {
    const balanceVal  = document.getElementById('r-balance')?.value;
    const riskPctVal  = document.getElementById('r-risk-pct')?.value;
    const entryVal    = document.getElementById('r-entry')?.value;
    const slVal       = document.getElementById('r-sl')?.value;

    // Prevent immediate default value overrides while user is clearing inputs or typing decimals (e.g. 0.5)
    const balance  = (balanceVal !== "" && balanceVal !== undefined && !isNaN(parseFloat(balanceVal))) ? parseFloat(balanceVal) : 50;
    const riskPct  = (riskPctVal !== "" && riskPctVal !== undefined && !isNaN(parseFloat(riskPctVal))) ? parseFloat(riskPctVal) : 5;
    const entry    = (entryVal !== "" && entryVal !== undefined && !isNaN(parseFloat(entryVal))) ? parseFloat(entryVal) : 0;
    const sl       = (slVal !== "" && slVal !== undefined && !isNaN(parseFloat(slVal))) ? parseFloat(slVal) : 0;
    const tp       = parseFloat(document.getElementById('r-tp')?.value) || 0;
    const asset    = document.getElementById('r-asset')?.value || 'XAUUSD';
    const isBuy    = document.getElementById('r-buy-btn')?.classList.contains('active');

    // Validation for Manual Click
    if (isManualClick) {
      if (riskPctVal === "" || isNaN(parseFloat(riskPctVal)) || parseFloat(riskPctVal) <= 0) {
        App.toast('กรุณาระบุความเสี่ยง (%) ที่ถูกต้อง', 'warning');
        return;
      }
      if (!balanceVal || parseFloat(balanceVal) <= 0) {
        App.toast('กรุณาระบุจำนวนเงินทุนที่ถูกต้อง', 'warning');
        return;
      }
      if (!entryVal || parseFloat(entryVal) <= 0) {
        App.toast('กรุณาระบุราคาเข้าเทรด (Entry Price) ที่ถูกต้อง', 'warning');
        return;
      }
      if (!slVal || parseFloat(slVal) <= 0) {
        App.toast('กรุณาระบุราคาตัดขาดทุน (Stop Loss) ที่ถูกต้อง', 'warning');
        return;
      }
    }

    if (!balance || !entry || !sl) return;

    const riskUsd  = balance * riskPct / 100;
    const slDist   = Math.abs(entry - sl);
    const tpDist   = Math.abs(tp - entry);
    const rr       = tpDist > 0 && slDist > 0 ? (tpDist / slDist) : 0;

    // Lot calculation per asset type with raw precision check first
    let lot = 0;
    if (asset === 'XAUUSD') {
      // Gold: 1 lot = 100 oz, pip = $0.01, pip value = $1 per 0.01 move per 0.01 lot
      const rawLot = slDist > 0 ? riskUsd / (slDist * 100) : 0;
      if (rawLot > 0 && rawLot < 0.01) {
        lot = 0.01;
      } else {
        lot = Math.floor(rawLot * 100) / 100;
      }
    } else if (asset === 'BTCUSDT') {
      const rawLot = slDist > 0 ? riskUsd / slDist : 0;
      if (rawLot > 0 && rawLot < 0.01) {
        lot = 0.01;
      } else {
        lot = Math.floor(rawLot * 100) / 100;
      }
    } else if (asset === 'ETHUSDT') {
      const rawLot = slDist > 0 ? riskUsd / slDist : 0;
      if (rawLot > 0 && rawLot < 0.01) {
        lot = 0.01;
      } else {
        lot = Math.floor(rawLot * 100) / 100;
      }
    } else {
      // Forex: 1 pip = $10 for 1 standard lot
      const rawLot = slDist > 0 ? riskUsd / (slDist * 10) : 0;
      if (rawLot > 0 && rawLot < 0.01) {
        lot = 0.01;
      } else {
        lot = Math.floor(rawLot * 100) / 100;
      }
    }

    const tpUsd = lot > 0 && tpDist > 0 ? (tpDist * lot * (asset === 'XAUUSD' ? 100 : 1)) : (rr * riskUsd);

    // Exness Spread Cost Calculation
    let spreadMult = 10.0; // Forex default: 1 pip = 10 Points -> Point * Contract Size = 0.0001 * 100,000 = 10
    if (asset === 'XAUUSD') {
      spreadMult = 1.0; // Exness Gold: Point = 0.01, Contract Size = 100 -> Point * Contract Size = 1.0
    } else if (asset === 'BTCUSDT' || asset === 'ETHUSDT') {
      spreadMult = 0.01; // Exness Crypto: Point = 0.01, Contract Size = 1 -> Point * Contract Size = 0.01
    } else if (asset === 'DXY') {
      spreadMult = 1.0; // Point = 0.01, Contract Size = 100 -> Point * Contract Size = 1.0
    }

    const spreadVal = parseFloat(document.getElementById('r-spread')?.value) || 0;
    const spreadCost = spreadVal * spreadMult * lot;
    const netReward = tpUsd - spreadCost;

    // Show results
    const resultsEl = document.getElementById('risk-results');
    if (resultsEl) resultsEl.style.display = 'block';

    const priceDec = (asset === 'XAUUSD' || asset === 'ETHUSDT') ? 2 : (asset === 'DXY' ? 3 : 2);
    const lotDec = 2;

    this.setEl('rr-tp-price',   tp    ? tp.toFixed(priceDec) : '--');
    this.setEl('rr-entry-price', entry ? entry.toFixed(priceDec) : '--');
    this.setEl('rr-sl-price',   sl    ? sl.toFixed(priceDec) : '--');
    this.setEl('rr-tp-pnl',     tp ? `+$${tpUsd.toFixed(2)}` : '--');
    this.setEl('rr-sl-pnl',     `-$${riskUsd.toFixed(2)}`);
    this.setEl('r-rr',          rr > 0 ? `${rr.toFixed(2)} : 1` : '--');
    this.setEl('r-lot',         lot > 0 ? `${lot.toFixed(lotDec)} lot` : '--');
    this.setEl('r-risk-usd',    `-$${riskUsd.toFixed(2)}`);
    this.setEl('r-reward-usd',  tp ? `+$${tpUsd.toFixed(2)}` : '--');
    this.setEl('r-spread-cost', `-$${spreadCost.toFixed(2)}`);
    this.setEl('r-net-reward',  tp ? `$${netReward.toFixed(2)}` : '--');

    // Color Net Reward green if positive, red if negative
    const netRewardEl = document.getElementById('r-net-reward');
    if (netRewardEl && tp) {
      netRewardEl.style.color = netReward > 0 ? 'var(--gold)' : 'var(--red)';
    }

    // Color R:R
    const rrEl = document.getElementById('r-rr');
    if (rrEl) {
      rrEl.className = 'result-value highlight';
      if (rr >= 2) rrEl.style.color = 'var(--green)';
      else if (rr >= 1) rrEl.style.color = 'var(--gold)';
      else rrEl.style.color = 'var(--red)';
    }

    return { balance, riskPct, entry, sl, tp, asset, lot, riskUsd, tpUsd, rr, isBuy, spreadCost, netReward };
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
      if (el && val) el.value = parseFloat(val).toFixed((asset === 'XAUUSD' || asset === 'ETHUSDT') ? 2 : (asset === 'DXY' ? 3 : 2));
    });

    // Set Exness default spreads automatically during Auto-populate
    const spreadEl = document.getElementById('r-spread');
    if (spreadEl) {
      if (asset === 'XAUUSD') spreadEl.value = 200;
      else if (asset === 'BTCUSDT') spreadEl.value = 2150;
      else if (asset === 'ETHUSDT') spreadEl.value = 160;
      else if (asset === 'DXY') spreadEl.value = 15;
      else spreadEl.value = 15;
    }

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
      spread:  data.spreadCost,
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
      el.innerHTML = this.tradeLog.map(t => {
        const lotDec = 2;
        const priceDec = (t.asset === 'XAUUSD' || t.asset === 'ETHUSDT') ? 2 : (t.asset === 'DXY' ? 3 : 2);
        const spreadDisplay = t.spread !== undefined ? ` · Sp: -$${parseFloat(t.spread).toFixed(2)}` : '';
        return `
          <div class="log-item" data-id="${t.id}">
            <span class="log-dir ${t.dir.toLowerCase()}">${t.dir}</span>
            <div class="log-info">
              <div class="log-asset">${t.asset}</div>
              <div class="log-prices">E: ${parseFloat(t.entry).toFixed(priceDec)} | SL: ${parseFloat(t.sl).toFixed(priceDec)} | TP: ${parseFloat(t.tp || 0).toFixed(priceDec)}</div>
              <div class="log-date">${t.date} · R:R ${parseFloat(t.rr).toFixed(2)} · ${parseFloat(t.lot).toFixed(lotDec)} lot${spreadDisplay}</div>
            </div>
            <button class="log-delete" onclick="Calculator.deleteLog(${t.id})">×</button>
          </div>
        `;
      }).join('');
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
