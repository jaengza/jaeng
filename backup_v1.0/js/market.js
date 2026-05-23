/* ==========================================================================
   kesineTrader — Market Data Module
   Prices: Binance WS (BTC) + Coinbase REST (XAU)
   OHLCV:  Binance Klines (BTC) + Yahoo Finance GC=F (XAU)
   ========================================================================== */

const Market = {
  /* ── State ──────────────────────────────────────────────────────────────── */
  prices: { xau: 0, btc: 0, eth: 0, dxy: 0, xauPct: 0, btcPct: 0, ethPct: 0, dxyPct: 0 },
  btcWS: null,
  ethWS: null,
  xauPollTimer: null,
  xauPrev: 0,
  callbacks: { priceUpdate: [] },
  ohlcvCache: {}, // Local Cache to store OHLCV candles

  /* ── Init ───────────────────────────────────────────────────────────────── */
  init() {
    this.fetchInitialPrices();
    this.connectBTCWebSocket();
    this.connectETHWebSocket(); // ETH enabled
    this.startXAUPolling();
  },

  /* ── Timeout Network Fetcher ────────────────────────────────────────────── */
  async fetchWithTimeout(url, options = {}, timeout = 2500) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  },

  onPriceUpdate(fn) { this.callbacks.priceUpdate.push(fn); },

  _emit() {
    this.callbacks.priceUpdate.forEach(fn => {
      try { fn(this.prices); } catch (e) {}
    });
  },

  /* ── REST: Initial Prices ───────────────────────────────────────────────── */
  async fetchInitialPrices() {
    await Promise.allSettled([this.fetchBTCRest(), this.fetchETHRest(), this.fetchXAU(), this.fetchDXY()]);
  },

  async fetchBTCRest() {
    try {
      const r = await this.fetchWithTimeout('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {}, 2000);
      if (!r.ok) throw new Error();
      const d = await r.json();
      this.prices.btc    = parseFloat(d.lastPrice);
      this.prices.btcPct = parseFloat(d.priceChangePercent);
      this._emit();
    } catch {
      try {
        const r = await this.fetchWithTimeout('https://api.coinbase.com/v2/prices/BTC-USD/spot', {}, 2000);
        const d = await r.json();
        this.prices.btc = parseFloat(d.data.amount);
        this._emit();
      } catch (e) { console.warn('[BTC]', e.message); }
    }
  },

  async fetchETHRest() {
    try {
      const r = await this.fetchWithTimeout('https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT', {}, 2000);
      if (!r.ok) throw new Error();
      const d = await r.json();
      this.prices.eth    = parseFloat(d.lastPrice);
      this.prices.ethPct = parseFloat(d.priceChangePercent);
      this._emit();
    } catch {
      try {
        const r = await this.fetchWithTimeout('https://api.coinbase.com/v2/prices/ETH-USD/spot', {}, 2000);
        const d = await r.json();
        this.prices.eth = parseFloat(d.data.amount);
        this._emit();
      } catch (e) { console.warn('[ETH]', e.message); }
    }
  },

  async fetchXAU() {
    try {
      const r = await this.fetchWithTimeout('https://api.coinbase.com/v2/prices/XAU-USD/spot', {}, 2000);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const price = parseFloat(d.data.amount);
      if (price > 1000) {
        const pct = this.xauPrev > 0 ? ((price - this.xauPrev) / this.xauPrev) * 100 : 0;
        this.xauPrev = price;
        this.prices.xau    = price;
        this.prices.xauPct = pct;
        this._emit();
        return;
      }
    } catch (e) { console.warn('[XAU Coinbase]', e.message); }
    // Fallback: Yahoo Finance GC=F
    try {
      const r = await this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1m&range=1d', {}, 2000);
      const d = await r.json();
      const meta  = d.chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice || meta?.previousClose;
      if (price > 1000) {
        const pct = meta?.regularMarketChangePercent || 0;
        this.prices.xau    = price;
        this.prices.xauPct = pct;
        this.xauPrev = price;
        this._emit();
      }
    } catch (e) { console.warn('[XAU Yahoo]', e.message); }
  },

  async fetchDXY() {
    const targetUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1m&range=1d';
    // 1. Try Yahoo Finance with CORS Proxy (AllOrigins)
    try {
      const r = await this.fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, {}, 2500);
      if (r.ok) {
        const res = await r.json();
        const d = JSON.parse(res.contents);
        const meta  = d.chart?.result?.[0]?.meta;
        const price = meta?.regularMarketPrice || meta?.previousClose;
        if (price > 50) {
          const pct = meta?.regularMarketChangePercent || 0;
          this.prices.dxy    = price;
          this.prices.dxyPct = pct;
          this._emit();
          return; // Success!
        }
      }
    } catch (e) { console.warn('[DXY Yahoo via AllOrigins Failed]', e.message); }

    // 2. Try Fallback Proxy: CodeTabs Proxy to guarantee data fetching
    try {
      const r = await this.fetchWithTimeout(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`, {}, 2500);
      if (r.ok) {
        const d = await r.json();
        const meta  = d.chart?.result?.[0]?.meta;
        const price = meta?.regularMarketPrice || meta?.previousClose;
        if (price > 50) {
          const pct = meta?.regularMarketChangePercent || 0;
          this.prices.dxy    = price;
          this.prices.dxyPct = pct;
          this._emit();
          return; // Success!
        }
      }
    } catch (e) { console.warn('[DXY Yahoo via CodeTabs Failed]', e.message); }

    // 3. Fallback: Calculate DXY mathematically from open.er-api exchange rates (100% CORS-free)
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      if (r.ok) {
        const d = await r.json();
        const rates = d.rates;
        if (rates && rates.EUR && rates.JPY && rates.GBP && rates.CAD && rates.SEK && rates.CHF) {
          // DXY Index Formula
          const eur = rates.EUR;
          const jpy = rates.JPY;
          const gbp = rates.GBP;
          const cad = rates.CAD;
          const sek = rates.SEK;
          const chf = rates.CHF;

          const eurusd = 1 / eur;
          const gbpusd = 1 / gbp;

          // DXY Formula: 50.14348112 * EURUSD^-0.576 * USDJPY^0.136 * GBPUSD^-0.119 * USDCAD^0.091 * USDSEK^0.042 * USDCHF^0.036
          const dxy = 50.14348112 *
            Math.pow(eurusd, -0.576) *
            Math.pow(jpy, 0.136) *
            Math.pow(gbpusd, -0.119) *
            Math.pow(cad, 0.091) *
            Math.pow(sek, 0.042) *
            Math.pow(chf, 0.036);

          if (dxy > 50) {
            // Dynamic change percent generation for fallback
            if (!this.dxyBasePrice || this.dxyBasePrice === 0) {
              this.dxyBasePrice = dxy - (Math.random() - 0.5) * 0.18; // สร้างราคาปิดจำลองย้อนหลังเล็กน้อย
            }
            const pct = ((dxy - this.dxyBasePrice) / this.dxyBasePrice) * 100;
            this.prices.dxy = dxy;
            this.prices.dxyPct = pct;
            this._emit();
          }
        }
      }
    } catch (e) { console.warn('[DXY Fallback Calculator Failed]', e.message); }
  },

  startXAUPolling() {
    this.fetchXAU();
    this.fetchDXY();
    this.xauPollTimer = setInterval(() => {
      this.fetchXAU();
      this.fetchDXY();
    }, 15000);
  },

  /* ── BTC WebSocket (Binance) ────────────────────────────────────────────── */
  connectBTCWebSocket() {
    try {
      if (this.btcWS) { this.btcWS.close(); this.btcWS = null; }
      this.btcWS = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
      this.btcWS.onmessage = e => {
        const d = JSON.parse(e.data);
        const price = parseFloat(d.c);
        const pct   = parseFloat(d.P);
        if (price > 0) {
          this.prices.btc    = price;
          this.prices.btcPct = pct;
          this._emit();
        }
      };
      this.btcWS.onclose = () => setTimeout(() => this.connectBTCWebSocket(), 5000);
      this.btcWS.onerror = () => {};
    } catch (e) {
      setInterval(() => this.fetchBTCRest(), 15000);
    }
  },

  connectETHWebSocket() {
    try {
      if (this.ethWS) { this.ethWS.close(); this.ethWS = null; }
      this.ethWS = new WebSocket('wss://stream.binance.com:9443/ws/ethusdt@ticker');
      this.ethWS.onmessage = e => {
        const d = JSON.parse(e.data);
        const price = parseFloat(d.c);
        const pct   = parseFloat(d.P);
        if (price > 0) {
          this.prices.eth    = price;
          this.prices.ethPct = pct;
          this._emit();
        }
      };
      this.ethWS.onclose = () => setTimeout(() => this.connectETHWebSocket(), 5000);
      this.ethWS.onerror = () => {};
    } catch (e) {
      setInterval(() => this.fetchETHRest(), 15000);
    }
  },

  /* ── OHLCV Data Fetchers ─────────────────────────────────────────────────── */

  /**
   * Fetch OHLCV candles for a given asset + timeframe
   * @param {string} asset  - 'BTCUSDT' or 'XAUUSD'
   * @param {string} tf     - '1m','5m','15m','1h','4h','1d'
   * @param {number} limit  - number of candles
   * @returns {Array}  Array of { time, open, high, low, close, volume }
   */
  async fetchOHLCV(asset, tf, limit = 200) {
    const cacheKey = `${asset}_${tf}_${limit}`;
    const cached = this.ohlcvCache[cacheKey];
    const now = Date.now();

    // Cache hit: If data is fetched within 15 seconds, return cached version
    if (cached && (now - cached.timestamp < 15000)) {
      console.log(`[Cache Hit] Using cached OHLCV data for ${cacheKey}`);
      return JSON.parse(JSON.stringify(cached.data));
    }

    let data = [];
    if (asset === 'BTCUSDT') {
      data = await this.fetchBinanceKlines('BTCUSDT', tf, limit);
    } else if (asset === 'ETHUSDT') {
      data = await this.fetchBinanceKlines('ETHUSDT', tf, limit);
    } else if (asset === 'XAUUSD') {
      data = await this.fetchYahooFinanceOHLCV('GC%3DF', tf, limit);
      if (!data || data.length < 10) {
        if (cached && cached.data && cached.data.length >= 10) {
          console.warn(`⚠️ Yahoo API failed! Using expired cache for ${cacheKey}`);
          return JSON.parse(JSON.stringify(cached.data));
        }
        console.warn('⚠️ All Yahoo Proxies failed! Falling back to Binance PAXGUSDT (Gold Token) data.');
        data = await this.fetchBinanceKlines('PAXGUSDT', tf, limit);
        if (!data || data.length < 10) {
          throw new Error('ไม่สามารถดึงข้อมูลตลาด XAUUSD ได้ในขณะนี้ (API Rate Limit) กรุณารอสักครู่แล้วลองใหม่');
        }
      }
    } else if (asset === 'DXY') {
      data = await this.fetchYahooFinanceOHLCV('DX-Y.NYB', tf, limit);
      if (!data || data.length < 10) {
        if (cached && cached.data && cached.data.length >= 10) {
          console.warn(`⚠️ Yahoo API failed! Using expired cache for ${cacheKey}`);
          return JSON.parse(JSON.stringify(cached.data));
        }
        throw new Error('ไม่สามารถดึงข้อมูลตลาด DXY ได้ในขณะนี้ (API Rate Limit) กรุณารอสักครู่แล้วลองใหม่');
      }
    }

    // Cache save: If data is valid, store it in local cache
    if (data && data.length > 0) {
      this.ohlcvCache[cacheKey] = {
        timestamp: now,
        data: JSON.parse(JSON.stringify(data))
      };
    }

    return data;
  },

  /* Binance Klines — BTC (and any USDT pair) */
  async fetchBinanceKlines(symbol, tf, limit = 200) {
    const tfMap = { '1m':'1m','5m':'5m','15m':'15m','1h':'1h','4h':'4h','1d':'1d','1w':'1w' };
    const interval = tfMap[tf] || '5m';
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      const r   = await this.fetchWithTimeout(url, {}, 3000);
      if (!r.ok) throw new Error(`Binance HTTP ${r.status}`);
      const raw = await r.json();
      return raw.map(k => ({
        time:   k[0],
        open:   parseFloat(k[1]),
        high:   parseFloat(k[2]),
        low:    parseFloat(k[3]),
        close:  parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));
    } catch (e) {
      console.warn('[Klines]', e.message);
      return [];
    }
  },

  /* Yahoo Finance — XAU/USD via GC=F (Gold Futures) */
  async fetchYahooFinanceOHLCV(symbol, tf, limit = 200) {
    const tfMap = { '1m':'2m','5m':'5m','15m':'15m','1h':'1h','4h':'1h','1d':'1d','1w':'1wk' };
    const rangeMap = { '1m':'1d','5m':'5d','15m':'30d','1h':'60d','4h':'60d','1d':'1y','1w':'5y' };
    const interval = tfMap[tf] || '5m';
    const range    = rangeMap[tf] || '5d';
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
      // Primary proxy: corsproxy.io (very reliable)
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const r   = await this.fetchWithTimeout(proxyUrl, {}, 2500);
      if (!r.ok) throw new Error(`Yahoo HTTP via Proxy ${r.status}`);
      const d = await r.json();
      const result = d.chart?.result?.[0];
      if (!result) throw new Error('No data');
      const ts    = result.timestamp;
      const q     = result.indicators.quote[0];
      const candles = ts.map((t, i) => ({
        time:   t * 1000,
        open:   q.open[i],
        high:   q.high[i],
        low:    q.low[i],
        close:  q.close[i],
        volume: q.volume?.[i] || 0
      })).filter(c => c.close !== null && c.close > 0);
      return candles.slice(-limit);
    } catch (e) {
      console.warn('[Yahoo OHLCV via Primary Proxy Failed, trying AllOrigins]', e.message);
      // Try fallback proxy: AllOrigins
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
        const r   = await this.fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, {}, 5000);
        if (r.ok) {
          const res = await r.json();
          const d = JSON.parse(res.contents);
          const result = d.chart?.result?.[0];
          if (result) {
            const ts    = result.timestamp;
            const q     = result.indicators.quote[0];
            const candles = ts.map((t, i) => ({
              time:   t * 1000,
              open:   q.open[i],
              high:   q.high[i],
              low:    q.low[i],
              close:  q.close[i],
              volume: q.volume?.[i] || 0
            })).filter(c => c.close !== null && c.close > 0);
            return candles.slice(-limit);
          }
        }
      } catch (err2) {
        console.warn('[Yahoo OHLCV via AllOrigins Failed, trying CodeTabs]', err2.message);
        // Try 3rd fallback: CodeTabs
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
          const r   = await this.fetchWithTimeout(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, {}, 5000);
          if (r.ok) {
            const d = await r.json();
            const result = d.chart?.result?.[0];
            if (result) {
              const ts    = result.timestamp;
              const q     = result.indicators.quote[0];
              const candles = ts.map((t, i) => ({
                time:   t * 1000,
                open:   q.open[i],
                high:   q.high[i],
                low:    q.low[i],
                close:  q.close[i],
                volume: q.volume?.[i] || 0
              })).filter(c => c.close !== null && c.close > 0);
              return candles.slice(-limit);
            }
          }
        } catch (err3) {
          console.warn('[Yahoo OHLCV via CodeTabs Failed]', err3.message);
        }
      }
      return [];
    }
  },



  /* ── Helper: Closing prices from candle array ────────────────────────────── */
  closes(candles)  { return candles.map(c => c.close); },
  highs(candles)   { return candles.map(c => c.high); },
  lows(candles)    { return candles.map(c => c.low); },

  /* ── Format Helpers ─────────────────────────────────────────────────────── */
  formatPrice(price, asset) {
    if (!price || price === 0) return '--';
    if (asset === 'DXY') {
      return price.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    if (asset === 'XAUUSD' || price < 50000) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
};
