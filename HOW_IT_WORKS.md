# ApexTrader Pro — คู่มือการทำงาน

> ระบบวิเคราะห์การเทรดอัตโนมัติ | XAUUSD · BTC · DXY

---

## 📁 โครงสร้างไฟล์

```
ApexTrader Pro/
├── index.html              ← หน้าหลัก (5 panels)
├── css/
│   └── style.css           ← Design system ทั้งหมด (variables, components, responsive)
└── js/
    ├── indicators.js       ← คำนวณ indicator ทั้งหมด (RSI/MACD/EMA/ATR/Fibo/ICT)
    ├── market.js           ← ดึงราคาสด + OHLCV data
    ├── analysis.js         ← Auto-analysis engine
    ├── calculator.js       ← Risk/Position size calculator
    ├── news.js             ← ระบบข่าว (cache + filter)
    └── app.js              ← Main coordinator
```

---

## 🚀 5 แผงหลัก (Panels)

| แผง | ID | เนื้อหา |
|-----|----|---------|
| 🏠 Dashboard | `panel-dashboard` | ราคาสด + Signal summary + แผนเทรดล่าสุด |
| 🔍 Analysis | `panel-analysis` | Auto-fetch OHLCV → คำนวณ indicator → แผนเทรด |
| 📈 Chart | `panel-chart` | TradingView chart + symbol/TF switcher |
| 💰 Risk | `panel-risk` | คำนวณ lot size + trade log |
| 📰 News | `panel-news` | ข่าว BTC/Gold/USD แบบ real-time |

---

## 📊 Technical Indicators (indicators.js)

| Indicator | Function | Parameters | Output |
|-----------|----------|-----------|--------|
| **RSI** | `Indicators.rsi(closes)` | period=14 | ค่า 0–100 + signal label |
| **MACD** | `Indicators.macd(closes)` | 12/26/9 | macd, signal, histogram, trend, cross |
| **EMA** | `Indicators.ema(values, period)` | 20/50/200 | ค่า EMA + trend direction |
| **ATR** | `Indicators.atr(h,l,c)` | period=14 | Average True Range (volatility) |
| **Fibonacci** | `Indicators.fibonacci(high, low)` | auto swing | 8 levels รวม OTE 70.5% |
| **Pivot Points** | `Indicators.pivots(h,l,c)` | standard | PP, R1, R2, R3, S1, S2, S3 |
| **Order Block** | `Indicators.orderBlock(candles, dir)` | ICT | Last opposite candle zone |
| **FVG** | `Indicators.fairValueGaps(candles)` | ICT | Fair Value Gap zones |
| **Signal Score** | `Indicators.signalScore({rsi,macd,ema})` | composite | BUY / SELL / NEUTRAL + score |

### RSI Interpretation
```
< 25  → Oversold (BUY signal)
25–40 → Weak (possible bounce)
40–55 → Neutral
55–70 → Strong (possible pullback)
> 70  → Overbought (SELL signal)
```

### MACD Signals
```
Golden Cross  → MACD line crosses above Signal line (BUY, +3 score)
Death Cross   → MACD line crosses below Signal line (SELL, -3 score)
Histogram +   → Bullish momentum
Histogram -   → Bearish momentum
```

### Composite Signal Score
```
Score ≥ +2  → BUY  (bullish bias)
Score ≤ -2  → SELL (bearish bias)
Otherwise   → NEUTRAL
```

---

## 📡 แหล่งข้อมูล (market.js)

| ข้อมูล | แหล่งหลัก | Fallback | อัพเดท |
|-------|----------|---------|-------|
| **BTC Price** | Binance WebSocket | Coinbase REST | Real-time (tick) |
| **XAU Price** | Coinbase `XAU-USD/spot` | Yahoo Finance GC=F | ทุก 15 วินาที |
| **BTC OHLCV** | Binance Klines API | — | เมื่อวิเคราะห์ |
| **XAU OHLCV** | Yahoo Finance `GC=F` | Simulated | เมื่อวิเคราะห์ |
| **News** | CryptoCompare API | Resource links | ทุก 10 นาที |
| **Chart** | TradingView Widget | — | Real-time |

### API Endpoints ที่ใช้
```
Coinbase:  https://api.coinbase.com/v2/prices/XAU-USD/spot
Binance WS: wss://stream.binance.com:9443/ws/btcusdt@ticker
Binance Klines: https://api.binance.com/api/v3/klines
Yahoo Finance: https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF
CryptoCompare: https://min-api.cryptocompare.com/data/v2/news/
```

---

## 🤖 Auto-Analysis Flow (analysis.js)

```
1. User กด "วิเคราะห์อัตโนมัติ"
        ↓
2. Market.fetchOHLCV(asset, tf, 250)
   → Binance Klines (BTC) หรือ Yahoo Finance (XAU)
        ↓
3. คำนวณ indicators ทั้งหมด:
   ├── RSI(14)
   ├── MACD(12/26/9)
   ├── EMA(20/50/200) + Trend
   ├── ATR(14)
   ├── Swing High/Low (100 bars)
   ├── Fibonacci levels (รวม OTE 70.5%)
   ├── Pivot Points
   ├── Order Block (ICT)
   └── Fair Value Gaps (ICT)
        ↓
4. signalScore() → BUY / SELL / NEUTRAL
        ↓
5. buildTradePlan():
   ├── Entry = OTE Zone (70.5% Fibonacci)
   ├── SL    = Order Block level (หรือ 1.5×ATR)
   ├── TP    = Swing High/Low (หรือ 3×ATR)
   └── Lot   = (Balance × Risk%) / SL_distance
        ↓
6. แสดงผลใน Analysis Panel
   + อัพเดท Dashboard Signal Cards
```

---

## 💰 Risk Calculator (calculator.js)

### สูตรคำนวณ Lot Size

**XAUUSD (Gold):**
```
Risk ($) = Balance × Risk%
Lot Size = Risk ($) / (SL Distance × 100)
```
*1 Standard Lot Gold = 100 oz, pip value ≈ $1 per pip per 0.01 lot*

**BTC:**
```
Lot Size = Risk ($) / SL Distance ($)
```

**Forex:**
```
Lot Size = Risk ($) / (SL Distance × 10)
```

### R:R Ratio
```
R:R = TP Distance / SL Distance
R:R ≥ 2:1 = ✅ ดี (สีเขียว)
R:R ≥ 1:1 = ⚠️ พอได้ (สีทอง)
R:R < 1:1 = ❌ ไม่ดี (สีแดง)
```

---

## 📰 News System (news.js)

- **Source:** CryptoCompare Free API (50,000 calls/month per IP)
- **Categories:** BTC, Gold, Market, Fiat, Trading
- **Cache:** localStorage TTL 10 นาที (ลด API calls)
- **Filter:** ทั้งหมด / BTC / GOLD / USD
- **Fallback:** ลิงก์ไปยัง Kitco, CoinDesk, DailyFX, FXStreet

---

## 📱 Responsive Design

| Device | Layout | Navigation |
|--------|--------|-----------|
| Mobile (< 768px) | 1 column | Bottom Nav 5 ปุ่ม |
| Tablet (768–1023px) | 2 columns | Bottom Nav |
| Desktop (≥ 1024px) | 3 columns | ทุก panel แสดงพร้อมกัน |

---

## 🔑 ICT Concepts ที่ใช้

### OTE (Optimal Trade Entry)
- ย่อว่า Optimal Trade Entry
- อยู่ที่ **70.5% Fibonacci retracement**
- หาจาก Swing High → Swing Low (100 candles ล่าสุด)
- เป็นจุด entry ที่ดีที่สุดใน ICT methodology

### Order Block (OB)
- **Bullish OB:** แท่งเทียน Bearish ก่อนที่จะมี Bullish impulse แรงๆ
- **Bearish OB:** แท่งเทียน Bullish ก่อนที่จะมี Bearish impulse แรงๆ
- ใช้เป็นแนวรับ/แนวต้านสำคัญ + ตั้ง SL

### Fair Value Gap (FVG)
- ช่องว่างระหว่างแท่งที่ 1 และแท่งที่ 3 (3-candle pattern)
- **Bullish FVG:** แท่ง 3 low > แท่ง 1 high
- **Bearish FVG:** แท่ง 3 high < แท่ง 1 low
- ราคามักกลับมา fill gap

---

## ⚠️ ข้อควรทราบ

> [!IMPORTANT]
> ระบบนี้เป็น **เครื่องมือช่วยวิเคราะห์เท่านั้น** ไม่ใช่คำแนะนำการลงทุน
> ควรใช้ประกอบการตัดสินใจร่วมกับ Price Action จริงบนกราฟ

> [!NOTE]
> XAU OHLCV ใช้ Yahoo Finance `GC=F` (Gold Futures) ซึ่งใกล้เคียงแต่ไม่ใช่ราคา Spot 100%
> ราคา XAU แบบ real-time ใช้ Coinbase `XAU-USD/spot` ซึ่งเป็นราคา spot จริง

> [!TIP]
> Timeframe แนะนำสำหรับ ICT: **5m, 15m** สำหรับ intraday | **1h, 4h** สำหรับ swing trade

---

## 🔄 Auto-Refresh Intervals

| ข้อมูล | ความถี่ |
|-------|--------|
| BTC Price | Real-time (Binance WS) |
| XAU Price | ทุก 15 วินาที |
| OHLCV / Analysis | เมื่อกดปุ่มเท่านั้น |
| News | ทุก 10 นาที |
| Clock | ทุก 1 วินาที |
