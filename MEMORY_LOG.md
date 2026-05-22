# 🧠 MEMORY LOG — kesineTrader (Conversation bea42f85)
> บันทึกความทรงจำโปรเจกต์ฉบับสมบูรณ์ | อัปเดตล่าสุด: 2026-05-22T15:00 ICT  
> **Conversation ID:** `bea42f85-bb7d-4f76-8140-91ebf4ea92c3`  
> **Path โปรเจกต์:** `G:\My Drive\jaeng\`  
> **Corpus:** `jaengza/jaeng`  
> 📖 **คู่มือนักพัฒนา (Workflow):** [WORKFLOW.md](file:///g:/My%20Drive/jaeng/WORKFLOW.md)

---

## 🎯 โปรเจกต์คืออะไร (Project Identity)

**ชื่อ:** kesineTrader  
**ประเภท:** Premium Trading Dashboard WebApp (Offline/Local Build)  
**Stack:** Vanilla HTML5 + CSS3 + ES6 JavaScript (ไม่มี framework หนัก)  
**เป้าหมาย:** เครื่องมือวางแผนเทรดตามกลยุทธ์ ICT (Inner Circle Trader) รองรับ XAUUSD, BTCUSDT  
**Theme:** Dark Cyberpunk Glassmorphism (ดำลึก + สีฟ้านีออน + ทอง)

---

## 📂 โครงสร้างไฟล์ทั้งหมด (File Structure)

```
G:\My Drive\jaeng\
├── index.html              # โครงสร้างหน้าเว็บหลัก Layout ทั้งหมด (19,443 bytes)
├── css/
│   └── style.css           # ระบบ CSS ทั้งหมด: Design System, Glassmorphism, Responsive
├── js/
│   ├── app.js              # Entry point: โหลด, นาฬิกา, สลับเมนูแท็บ, bindChart()
│   ├── analysis.js         # Auto-Planner: วิเคราะห์ Confluence + Signal Score + แสดงผล
│   ├── calculator.js       # คำนวณ Position Size / Lot / Risk / Spread Cost
│   ├── indicators.js       # คณิตศาสตร์เชิงเทคนิค: RSI, MACD, ATR, Fibo, Swing, OB, FVG
│   └── market.js           # API: ราคาสด XAU/BTC/ETH/DXY, OHLCV Cache, News Feed แปลไทย
├── backtest_3months.js     # Script Node.js: Backtest จำลองย้อนหลัง 3 เดือน
├── test_backtest_all.js    # Script Node.js: Unit Test + Backtest 30 วัน ทุก TF (v3.9)
├── test_analysis.js        # Script Node.js: Unit Test อื่นๆ
├── working_memory.md       # เอกสารสถาปัตยกรรมโปรเจกต์ (อ่านก่อนเสมอ)
├── MEMORY_LOG.md           # ไฟล์นี้ — บันทึกประวัติการพัฒนาทั้งหมด 👈
├── HOW_IT_WORKS.md         # คำอธิบายการทำงานของระบบ
└── deploy.bat              # Script Deploy
```

---

## 🗓️ ประวัติการพัฒนา (Development Timeline)

### ✅ Version 3.6 — ระบบเริ่มต้น (Before This Conversation)
- WebApp Trading Dashboard ทำงานพื้นฐานได้
- ดึงราคา XAUUSD (ทองคำ) และ DXY (Dollar Index) แบบ Polling
- วิเคราะห์ Fibonacci OTE, RSI, ICT Structure
- มีปุ่มเลือก Timeframe: `5m`, `15m`, `1h`, `4h`

---

### ✅ Version 3.7 — เพิ่ม ETH + ระบบคำนวณ Spread Cost (Exness Standard)

**คำขอจากผู้ใช้:**
1. สอบถามว่าความเร็วดึงข้อมูลกราฟทองและ DXY เป็นอย่างไร
2. ขอเพิ่ม **ETHUSDT** เข้าระบบ
3. ขอปรับสูตรคำนวณ Lot Size แต่ละคู่เงิน + เพิ่ม Spread Cost Display

**สิ่งที่ทำ:**
- เพิ่ม ETHUSDT ในทุกส่วน (Price Display, Dropdown, Analysis, Calculator)
- ใช้ **Binance API** ดึงราคา ETH แบบ WebSocket + Polling fallback
- ติดตั้งสูตรคำนวณ Spread Cost มาตรฐาน Exness ใน `calculator.js` และ `analysis.js`

**ค่าคงที่ Exness ที่ตั้งไว้ (สำคัญมาก):**

| สินทรัพย์ | Point | Contract Size | Spread เฉลี่ย | Lot Multiplier |
|---|---|---|---|---|
| XAUUSD | 0.01 | 100 | 200 Points | 1.0 |
| BTCUSDT | 0.01 | 1 | 2,150 Points | 0.01 |
| ETHUSDT | 0.01 | 1 | 160 Points | 0.01 |
| FOREX | 0.0001 | 100,000 | 15 Points | 10.0 |

**สูตรคำนวณ Spread Cost:**
```
Spread Cost (USD) = Spread (Points) × Point Size × Contract Size × Lot Size
```

**ตัวอย่าง XAUUSD 0.01 Lot สเปรด 20 Points:**
```
= 20 × 0.01 × 100 × 0.01 = $0.20
```

---

### ✅ Version 3.8 — เพิ่มช่วงเวลา 1d / 1w + ปรับปุ่ม TF

**คำขอจากผู้ใช้:**
- ขอเพิ่มปุ่มเลือก TF: **1 วัน (1d)** และ **1 สัปดาห์ (1w)**
- ปุ่มต้องดูง่าย ขนาดเหมาะสม

**สิ่งที่ทำ:**

1. **แก้ `js/app.js` — `bindChart()`:**
   - ลบ `parseInt()` ออกจาก interval mapper
   - ทำให้ส่ง string `'D'` (Daily) และ `'W'` (Weekly) ไปยัง TradingView widget ได้โดยตรง
   - ก่อนหน้านี้ `'D'` โดน `parseInt()` แปลงเป็น `NaN` ทำให้กราฟว่าง

2. **แก้ `js/market.js` — Yahoo & Binance Mapping:**
   - Yahoo Finance: `'1w'` → `'1wk'`, ดึงประวัติ **5 ปี (`5y`)**
   - Binance: รองรับ `'1w'` interval, mock data ใช้ ms = `604,800,000`

3. **ปรับ CSS ปุ่ม TF:**
   - `.ctrl-tf`, `.tf-pill`: `padding: 7px 15px`, `min-height: 36px`, `border-radius: 6px`, `font-size: 0.78rem`, `font-weight: 700`
   - ถอด `1m` ออก → เหลือ 6 ปุ่ม: `5m`, `15m`, `1h`, `4h`, `1d`, `1w`
   - ปุ่มสมมาตรบนมือถือ (Mobile-First)

### ✅ Version 4.1 — กู้คืนการโหลดราคาและใช้งาน ETHUSDT สมบูรณ์แบบ + อัปโหลดขึ้นระบบออนไลน์ทันที

**คำขอจากผู้ใช้:**
- เอากลับมา (ETH) แล้วอัฟโหลดให้ออนไลน์เลย

**สิ่งที่ทำ:**
- กู้คืนระบบข้อมูลตลาด ETHUSDT ใน `js/market.js` โดยเปิดใช้งาน REST API และ WebSocket เพื่อดึงราคาสดจริงจาก Binance อีกครั้ง
- นำปุ่มสินทรัพย์ ETH/USD กลับคืนสู่ UI ทั้ง 4 จุดใน `index.html`: Header Assets, Dropdown Selector ใน Auto-Analysis, ปุ่มสลับใน Chart Panel, และ Asset Option ใน Risk Calculator
- ปลดคอมเมนต์ฟังก์ชันใน `js/app.js` (บรรทัดที่ 153-160) เพื่อให้ราคาสดของ ETH อัปเดตและแสดงผลบน Dashboard การ์ดราคาหลักได้สมบูรณ์
- อัปเดตการรองรับ ETHUSDT ในไฟล์ `session_state.json` (เพิ่มกลับใน `assets_supported` และกำหนด Exness Constants: minLot: 0.01, contractValue: 1, avgSpreadPts: 160)
- รันชุดคำสั่งทดสอบระบบ `test_backtest_all.js` ในเครื่อง Local ผ่านฉลุย 17/17 ข้อทดสอบ ยืนยันความถูกต้องของสูตรคำนวณและขนาด Lot ขั้นต่ำ
- ดำเนินการ Deploy อัปโหลดขึ้นระบบออนไลน์บน Git (`git push origin main`) สำเร็จ 100% เพื่อให้ออนไลน์พร้อมใช้งานทันที
- รันสคริปต์ `backup_now.ps1` เพื่อทำสำรองข้อมูล (Backup) ทุกไฟล์โครงการย้อนหลังเข้าไดเรกทอรี Google Drive โดยอัตโนมัติ

---

### ✅ Version 4.0 — เปลี่ยนชื่อเป็น kesineTrader + ปรับล็อตต่ำสุด 0.01 + ปิดโหลดราคา ETH (ล่าสุด)

**คำขอจากผู้ใช้:**
1. แก้ไขชื่อโปรแกรมเป็น **kesineTrader**
2. กำหนดล็อตต่ำสุดเป็น **0.01** เท่านั้น (สำหรับทุกสินทรัพย์)
3. ปิดการโหลดข้อมูลราคาของ **ETH (ETHUSDT)** และเอาออกจากหน้า UI

**สิ่งที่ทำ:**
- เปลี่ยนชื่อแบรนด์และสัญกรณ์ต่างๆ ในหน้าจอ, CSS และ JS เป็น **kesineTrader** ทั้งหมด
- ปรับปรุงสูตรและตรรกะใน `js/calculator.js` และ `js/analysis.js` ให้สินทรัพย์ทุกตัวมี `minLot` ขั้นต่ำสุดคือ **0.01** และแสดงผลทศนิยม Lot เป็น 2 ตำแหน่งทั่วทั้งระบบ
- แก้ไขโมดูล `js/market.js` ให้ระงับการทำงาน WebSocket และ REST API ของ ETHUSDT (ไม่โหลดข้อมูลราคา ETH ตามคำขอ)
- ซ่อนและลบตัวเลือก ETH/USDT, กราฟ ETH, และปุ่มแสดงราคา ETH ออกจากหน้าเว็บ `index.html` เพื่อความสะอาดตา
- ปรับปรุง Assertions ในไฟล์ทดสอบ `test_backtest_all.js` ให้ตรงกับพฤติกรรม Lot ต่ำสุดของ BTCUSDT ใหม่ (0.01 และสเปรดค่าจริง $0.21) และทดสอบรัน Unit Test ผ่าน 100% (17/17 ผ่านฉลุย)

---

### ✅ Version 3.9 — Backtest 30 วัน + แก้บั๊กล็อต + ฐานทุน $50
...
(ดูประวัติรุ่นเก่าในเวอร์ชันก่อนหน้านี้ได้)

**คำขอจากผู้ใช้:**
1. ทดสอบระบบแบคเทสย้อนหลัง ทุก TF 30 วัน
2. ตรวจสอบความถูกต้องในการคำนวณทุกเครื่องมือ
3. **ขอให้ใช้เงินเริ่มต้น $50 ในการคำนวณ**

**บั๊กที่ค้นพบและแก้ไข (Critical Bug Fix):**

ปัญหา: `Math.floor(lot * scale) / scale` ถูกทำก่อนการตรวจสอบ `minLot`  
→ ทำให้ล็อตดิบ เช่น `0.00166` โดนปัดเป็น `0` แล้วค่อยเช็ค `lot > 0 && lot < minLot`  
→ เงื่อนไขไม่ผ่าน ระบบแสดง `--` แทนที่จะแสดง `0.01`

**การแก้ไข (ใน `js/analysis.js` และ `js/calculator.js`):**
```javascript
// ❌ แบบเดิม (บั๊ก)
lot = Math.floor(rawLot * scale) / scale;
if (lot > 0 && lot < minLot) lot = minLot;

// ✅ แบบใหม่ (ถูกต้อง)
const rawLot = riskUsd / (slDist * contractValue);
if (rawLot > 0 && rawLot < minLot) {
  lot = minLot; // ล็อคขั้นต่ำก่อนปัดเศษ
} else {
  lot = Math.floor(rawLot * scale) / scale;
}
```

**Lot Minimum แต่ละสินทรัพย์:**
- XAUUSD: `minLot = 0.01`, `scale = 100`
- BTCUSDT: `minLot = 0.001`, `scale = 1000`
- ETHUSDT: `minLot = 0.01`, `scale = 100`
- FOREX: `minLot = 0.01`, `scale = 100`

**ไฟล์ที่สร้างใหม่:**
- `test_backtest_all.js` — Unit Test 17 รายการ + Backtest 30 วัน ทุก TF

**ผลการตรวจสอบ Unit Test (17/17 ผ่าน 100%):**

| เครื่องมือ | ผลทดสอบ |
|---|---|
| RSI(14) | ✅ ดาวน์ → 0, อัพ → 100, อยู่ใน [0,100] |
| MACD(12/26/9) | ✅ macd, signal, histogram ถูกต้อง |
| ATR(14) | ✅ ค่าความผันผวนไม่ติดลบ |
| Swing Points | ✅ High idx:10 ราคา 150, Low idx:15 ราคา 50 |
| Fibonacci OTE | ✅ BUY: 1295, SELL: 1705 (จาก H=2000, L=1000) |
| ICT Order Block | ✅ ตรวจ Bullish OB ราคาต่ำสุด 98 ถูกต้อง |
| Spread Cost XAUUSD | ✅ $2.5 risk, SL=15 → 0.01 Lot, Spread=$2.00 |
| Spread Cost BTCUSDT | ✅ $2.5 risk, SL=1500 → 0.001 Lot, Spread=$0.02 |
| Spread Cost ETHUSDT | ✅ $2.5 risk, SL=80 → 0.03 Lot, Spread=$0.05 |

**ผลการ Backtest 30 วัน (ฐานทุนคงที่ $50, ความเสี่ยง 5% = $2.50/ไม้):**

| TF | เทรด | ชนะ | แพ้ | Win Rate | กำไรสุทธิ | พอร์ต | Max DD |
|---|---|---|---|---|---|---|---|
| 5m | 496 | 354 | 141 | 71.37% | +$769.33 | $819.33 | 8.93% |
| 15m | 253 | 207 | 45 | 81.82% | +$529.23 | $579.23 | 8.72% |
| 1h | 43 | 29 | 13 | 67.44% | +$41.52 | $91.52 | 22.15% |
| 4h | 1 | 0 | 1 | 0% | -$2.50 | $47.50 | 5% |
| 1d | 2 | 0 | 1 | 0% | -$2.50 | $47.50 | 5% |
| 1w | 1 | 0 | 1 | 0% | -$2.50 | $47.50 | 5% |

---

## ⚙️ การตั้งค่าระบบทั้งหมด (System Configuration)

### API Sources
| ข้อมูล | แหล่ง | วิธี |
|---|---|---|
| BTC ราคาสด | Binance WebSocket | `wss://stream.binance.com` tick |
| ETH ราคาสด | Binance WebSocket | เดียวกัน |
| XAUUSD ราคาสด | Yahoo Finance / Proxy | Polling ทุก 15 วินาที |
| DXY ราคาสด | Yahoo Finance / Proxy | Polling ทุก 15 วินาที |
| OHLCV Candles | Yahoo (XAU/DXY) + Binance (BTC/ETH) | On-demand + Cache 15s |
| News Feed | CryptoNews / GNews API | Polling + แปลไทย AI |

### Caching System (ใน `market.js`)
- **ohlcvCache**: เก็บข้อมูลแท่งเทียน 15 วินาที → ถ้าเรียกซ้ำในช่วงนั้น ตอบจาก cache ทันที (~1ms)
- **News Cache**: เก็บใน `localStorage` ผูกกับ News ID → แปลครั้งเดียว ใช้ไปเรื่อยๆ

### Timeout Settings
- Proxy/Network: **2.5 วินาที** (AbortController)
- API อื่น: **2.0 วินาที**
- เมื่อ timeout: แสดง Fallback / Simulated Data แทน

### Timeframes ที่รองรับ
`5m`, `15m`, `1h`, `4h`, `1d`, `1w`

---

## 🎨 Design System (CSS Variables)

```css
--bg-base: #06080c                      /* พื้นหลังดำลึกพรีเมียม */
--bg-panel: rgba(13,17,26,0.65)         /* กระจกขุ่น blur 16px */
--accent-cyan: #00f2fe                   /* ฟ้านีออน (แรงบันดาลใจ) */
--accent-gold: #f5a623                   /* ทองอร่าม (TP/สำคัญ) */
--accent-emerald: #10b981               /* เขียว TP/กำไร */
--accent-red: #f43f5e                    /* แดง SL/ขาดทุน */
```

**ขนาด UI ที่ปรับแล้ว:**
- Input/Select: `padding: 14px 18px`, `font-size: 1.05rem`
- Button: `padding: 16px 20px`, `font-size: 1.05rem`, `border-radius: 12px`
- OTE Prices (TP/Entry/SL): `font-size: 1.35rem`, `font-weight: 800`
- TF Pills: `padding: 7px 15px`, `min-height: 36px`, `font-size: 0.78rem`

---

## 🧮 สูตรคำนวณสำคัญ (Key Formulas)

### 1. Fibonacci OTE Level
```
OTE Zone = 62.0% ถึง 79.0% ของ Swing (Fibonacci)
Entry ที่ใช้ = 70.5% (จุดกึ่งกลาง OTE)

BUY Entry  = SwingHigh - (SwingHigh - SwingLow) × 0.705
SELL Entry = SwingLow  + (SwingHigh - SwingLow) × 0.705
```

ตัวอย่าง (H=2000, L=1000):
- BUY OTE: `2000 - (1000 × 0.705) = 1295`
- SELL OTE: `1000 + (1000 × 0.705) = 1705`

### 2. Lot Size Calculation

**XAUUSD:**
```
rawLot = riskUsd / (slDist × 100)
if rawLot > 0 && rawLot < 0.01: lot = 0.01
else: lot = floor(rawLot × 100) / 100
```

**BTCUSDT:**
```
rawLot = riskUsd / (slDist × 1)
if rawLot > 0 && rawLot < 0.01: lot = 0.01
else: lot = floor(rawLot × 100) / 100
```

**FOREX:**
```
rawLot = riskUsd / (slDist × 10)
if rawLot > 0 && rawLot < 0.01: lot = 0.01
else: lot = floor(rawLot × 100) / 100
```

### 3. Spread Cost (Exness Standard)
```
Spread Cost (USD) = SpreadPoints × PointSize × ContractSize × Lot

XAUUSD:  Spread × 0.01 × 100 × Lot  = Spread × Lot      (เช่น 200pt × 0.01 Lot = $2.00)
BTCUSDT: Spread × 0.01 × 1   × Lot  = Spread × 0.01Lot  (เช่น 2150pt × 0.01 Lot = $0.21)
ETHUSDT: ปัจจุบันปิดการโหลดข้อมูลราคาและการเทรดในระบบเรียบร้อยแล้ว
```

### 4. Risk Management (ค่าเริ่มต้นที่ใช้)
```
เงินทุนเริ่มต้น (Fixed Base) = $50.00
ความเสี่ยงต่อไม้ = 5% = $2.50
Risk:Reward Ratio ขั้นต่ำ = 1:2
```

---

## 🔬 คำสั่ง Node.js สำหรับทดสอบระบบ

```powershell
# เข้าโฟลเดอร์
cd "g:\My Drive\jaeng"

# รัน Unit Test + Backtest ทุก TF
node test_backtest_all.js

# รัน Backtest จำลอง 3 เดือน
node backtest_3months.js

# รัน Unit Test อื่นๆ
node test_analysis.js
```

**ผลที่คาดหวังจาก `test_backtest_all.js`:**
- ✅ Unit Validation: 17/17 ผ่าน
- ✅ ตาราง Backtest 30 วัน ทุก TF (5m ถึง 1w)
- ✅ ไม่มี Error เรื่อง Lot = 0 หรือ undefined

---

## 🐛 บั๊กที่แก้แล้วในประวัติการสนทนา

| บั๊ก | ไฟล์ | เวอร์ชัน | สถานะ |
|---|---|---|---|
| Lot Size ปัดลงเป็น 0 ก่อนเช็ค minLot | `js/analysis.js`, `js/calculator.js` | v3.9 | ✅ แก้แล้ว |
| TradingView กราฟว่างเมื่อเลือก 1d/1w | `js/app.js` bindChart() | v3.8 | ✅ แก้แล้ว |
| ราคา DXY/XAU ล้นขอบบนมือถือ | `css/style.css` | v3.3 | ✅ แก้แล้ว |
| ปุ่ม DXY ตกขอบขวาบน mobile | `css/style.css` | v3.3 | ✅ แก้แล้ว |

---

## 📋 สถานะปัจจุบัน (Current Status)

**Version ล่าสุด:** v4.1  
**สถานะ:** ✅ ทุกระบบทำงานถูกต้อง Unit Test 17/17 ผ่าน  
**ระบบที่ทดสอบแล้ว:** RSI, MACD, ATR, Swing Points, Fibonacci OTE, ICT Order Block, Spread Cost, Lot Size, Backtest 30d All TF

**สินทรัพย์ที่รองรับ:**
- ✅ XAUUSD (ทองคำ)
- ✅ BTCUSDT (Bitcoin)
- ✅ ETHUSDT (Ethereum) — กู้คืนการโหลดข้อมูลราคาและฟังก์ชันการใช้งานแบบเรียลไทม์เรียบร้อยแล้ว

---

## 🔜 แนวทางพัฒนาต่อ (Future Roadmap)

- WebSocket เต็มรูปแบบแทน Polling (ใน `market.js`)
- บันทึกประวัติเทรดขึ้น Cloud / API ภายนอก
- เพิ่มสินทรัพย์อื่น เช่น GBPUSD, EURUSD
- Dashboard แสดง Performance Summary

---

*📅 บันทึกโดย Antigravity AI ณ วันที่ 2026-05-22T15:10 ICT*  
*🔍 ค้นหาด้วย keyword: kesineTrader, XAUUSD, BTCUSDT, ETHUSDT, Fibonacci, OTE, Exness, Lot, Spread, Backtest, v4.1*
