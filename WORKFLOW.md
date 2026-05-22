# ⚡ ApexTrader Hub — WORKFLOW & DEVELOPER GUIDE
> **Version:** v3.9 | **อัปเดตล่าสุด:** 2026-05-22  
> **Conversation ID:** `bea42f85-bb7d-4f76-8140-91ebf4ea92c3`  
> **ไฟล์อ้างอิงร่วม:** [MEMORY_LOG.md](file:///g:/My%20Drive/jaeng/MEMORY_LOG.md) | [working_memory.md](file:///g:/My%20Drive/jaeng/working_memory.md)

---

## 📚 สารบัญ (Table of Contents)

0. [🖥️ Multi-Machine Setup & Backup Protocol](#-0-multi-machine-setup--backup-protocol) ← **อ่านก่อนทุกครั้ง**
1. [โครงสร้างโฟลเดอร์](#-1-โครงสร้างโฟลเดอร์)
2. [สถาปัตยกรรมระบบ (Mind Map)](#-2-สถาปัตยกรรมระบบ-mind-map)
3. [Data Flow — ข้อมูลไหลอย่างไร](#-3-data-flow--ข้อมูลไหลอย่างไร)
4. [Module Responsibilities — หน้าที่แต่ละไฟล์](#-4-module-responsibilities--หน้าที่แต่ละไฟล์)
5. [ขั้นตอนการแก้ไขโค้ด (Edit Workflow)](#-5-ขั้นตอนการแก้ไขโค้ด-edit-workflow)
6. [ขั้นตอนการเพิ่มฟีเจอร์ใหม่](#-6-ขั้นตอนการเพิ่มฟีเจอร์ใหม่)
7. [ขั้นตอนการเพิ่มสินทรัพย์ใหม่](#-7-ขั้นตอนการเพิ่มสินทรัพย์ใหม่)
8. [ขั้นตอนการทดสอบระบบ](#-8-ขั้นตอนการทดสอบระบบ)
9. [Design System & CSS Guide](#-9-design-system--css-guide)
10. [API & Data Sources](#-10-api--data-sources)
11. [แนวคิดการออกแบบ (Design Philosophy)](#-11-แนวคิดการออกแบบ-design-philosophy)
12. [Roadmap การพัฒนาต่อยอด](#-12-roadmap-การพัฒนาต่อยอด)
13. [Cheat Sheet คำสั่งที่ใช้บ่อย](#-13-cheat-sheet-คำสั่งที่ใช้บ่อย)

---

## 🖥️ 0. Multi-Machine Setup & Backup Protocol

> ⚠️ **ผู้ใช้มี 2 Notebooks — อ่านส่วนนี้ก่อนเริ่มงานทุกครั้ง**

### 0.1 ทะเบียนเครื่อง (Machine Registry)

| ลำดับ | Computer Name | ชื่อเรียก | OS | Google Drive Path | สถานะ |
|---|---|---|---|---|---|
| 1 | `LAPTOP-NHPCPQ9G` | Notebook หลัก | Windows 11 Home 26100 | `G:\My Drive\jaeng` | ✅ Active |
| 2 | *(ยังไม่ได้ลงทะเบียน)* | Notebook สำรอง | TBD | TBD | ⏳ Pending |

> เมื่อใช้เครื่อง 2 ครั้งแรก → AI จะบันทึก `COMPUTERNAME` ลงทะเบียนทันที

---

### 0.2 Protocol เริ่ม Session (ทำทุกครั้ง)

```
ขั้นตอนสำหรับ AI เมื่อผู้ใช้พิมพ์ "เริ่มงาน" หรือ "check":

STEP 1 → รัน: $env:COMPUTERNAME         (ระบุเครื่อง)
STEP 2 → รัน: Test-Path "G:\My Drive\jaeng"  (เช็ค GDrive)
STEP 3 → ตรวจไฟล์สำคัญ 11 ไฟล์ครบ
STEP 4 → อ่าน session_state.json         (ดูสถานะล่าสุด)
STEP 5 → รัน node test_backtest_all.js   (Unit Test ถ้ามีแก้โค้ด)
STEP 6 → อัปเดต session_state.json       (บันทึก Session ปัจจุบัน)
STEP 7 → รายงานสรุปให้ผู้ใช้
```

**ดูรายละเอียดเต็มได้ที่:** [SESSION_START.md](file:///g:/My%20Drive/jaeng/SESSION_START.md)

---

### 0.3 ระบบ Backup (Backup System)

```
ชั้นที่ 1 — Auto Sync (อัตโนมัติ):
  Google Drive Desktop ซิงค์ไฟล์ทุกการเปลี่ยนแปลงอัตโนมัติ
  ทั้ง 2 เครื่องดึงไฟล์จาก G:\My Drive\jaeng\ เดียวกัน

ชั้นที่ 2 — Snapshot Backup (รัน BACKUP_NOW.bat):
  สร้าง snapshot พร้อม timestamp → G:\My Drive\jaeng_backups\
  เก็บ 10 ชุดล่าสุด ลบเก่าอัตโนมัติ
  ซิงค์ขึ้น Google Drive ด้วย

ชั้นที่ 3 — AI Memory Files:
  MEMORY_LOG.md   → บันทึกทุก Version
  session_state.json → สถานะข้ามเครื่อง
  WORKFLOW.md     → ความรู้ทั้งหมด
```

### 0.4 ไฟล์สคริปต์ระบบ

| ไฟล์ | วิธีใช้ | เวลาที่ใช้ |
|---|---|---|
| [START_CHECK.bat](file:///g:/My%20Drive/jaeng/START_CHECK.bat) | ดับเบิลคลิก | ทุกครั้งที่เริ่มงาน |
| [BACKUP_NOW.bat](file:///g:/My%20Drive/jaeng/BACKUP_NOW.bat) | ดับเบิลคลิก | ก่อนปิดเครื่อง หรือหลังแก้โค้ดสำคัญ |
| [SESSION_START.md](file:///g:/My%20Drive/jaeng/SESSION_START.md) | AI อ่าน | AI ดูทุก Session |
| [session_state.json](file:///g:/My%20Drive/jaeng/session_state.json) | AI อ่าน/เขียน | AI อัปเดตทุก Session |

### 0.5 กระบวนการสับเปลี่ยนเครื่อง (Machine Switch Procedure)

```
เครื่อง 1 → เครื่อง 2:
  1. (เครื่อง 1) รัน BACKUP_NOW.bat
  2. (เครื่อง 1) รอ Google Drive ซิงค์เสร็จ (ดูไอคอน GDrive สีเขียว)
  3. (เครื่อง 2) เปิด Google Drive Desktop
  4. (เครื่อง 2) รัน START_CHECK.bat
  5. (เครื่อง 2) บอก AI: "เริ่มงาน" → AI ตรวจสอบทุกอย่าง
```

---



---

## 📁 1. โครงสร้างโฟลเดอร์

```
G:\My Drive\jaeng\                          ← ROOT โปรเจกต์
│
├── 📄 index.html                           ← หน้าเว็บหลัก (Entry Point)
│
├── 📁 css/
│   └── 📄 style.css                        ← CSS ทั้งหมดรวมอยู่ไฟล์เดียว
│
├── 📁 js/                                  ← Business Logic ทั้งหมด
│   ├── 📄 app.js          [COORDINATOR]    ← Entry point, Navigation, Event Binding
│   ├── 📄 market.js       [DATA LAYER]     ← API, WebSocket, Cache, OHLCV
│   ├── 📄 indicators.js   [MATH ENGINE]    ← RSI, MACD, ATR, Fibo, OB, FVG
│   ├── 📄 analysis.js     [BRAIN]          ← Confluence Engine + แสดงผล
│   └── 📄 calculator.js   [RISK TOOL]      ← Lot / Risk / Spread Cost
│
├── 📄 MEMORY_LOG.md       [AI MEMORY]     ← ประวัติการพัฒนาทุก Version ★
├── 📄 WORKFLOW.md         [AI GUIDE]      ← คู่มือนักพัฒนาฉบับนี้ ★
├── 📄 SESSION_START.md    [AI PROTOCOL]   ← ขั้นตอน Session Check สำหรับ AI ★
├── 📄 session_state.json  [STATE FILE]    ← สถานะล่าสุดข้ามเครื่อง ★
│
├── 📄 START_CHECK.bat     [SYSTEM]        ← ดับเบิลคลิกเพื่อเริ่ม Session Check
├── 📄 BACKUP_NOW.bat      [SYSTEM]        ← ดับเบิลคลิกเพื่อ Backup ทันที
├── 📄 session_check.ps1   [SYSTEM]        ← PowerShell Script ตรวจสอบ Session
├── 📄 backup_now.ps1      [SYSTEM]        ← PowerShell Script Backup
│
├── 📄 working_memory.md                    ← สถาปัตยกรรมและ Config
├── 📄 HOW_IT_WORKS.md                      ← อธิบายการทำงานฉบับย่อ
├── 📄 README.md                            ← คำอธิบายพื้นฐาน
│
├── 📄 backtest_3months.js  [TEST]          ← Backtest จำลอง 3 เดือน
├── 📄 test_backtest_all.js [TEST]          ← Unit Test 17 รายการ + Backtest 30 วัน
├── 📄 test_analysis.js     [TEST]          ← Unit Test ชุดอื่น
│
├── 📄 deploy.bat                           ← Script Deploy
├── 📁 node_modules/                        ← Dependencies (อย่าแก้ไข)
└── 📁 (jaeng_backups อยู่นอก folder นี้)  ← G:\My Drive\jaeng_backups\
```

> **★ ไฟล์สำคัญสำหรับ AI** — อ่านทุกครั้งก่อนเริ่มงาน

### 🔑 กฎการจัดไฟล์
| กฎ | รายละเอียด |
|---|---|
| ❌ ห้ามสร้างไฟล์ JS นอกโฟลเดอร์ `js/` | ยกเว้น Test Scripts ที่ root |
| ❌ ห้ามสร้างไฟล์ CSS นอกโฟลเดอร์ `css/` | |
| ✅ Test Files วางที่ root เสมอ | `test_*.js` หรือ `backtest_*.js` |
| ✅ Docs วางที่ root เสมอ | `*.md` |
| ✅ CSS ทั้งหมดอยู่ใน `style.css` เดียว | ไม่แยกไฟล์ |

---

## 🧠 2. สถาปัตยกรรมระบบ (Mind Map)

```
                        ┌─────────────────────────────────────┐
                        │         ApexTrader Hub              │
                        │    Premium Trading Dashboard        │
                        └──────────────┬──────────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
    ┌─────────▼──────────┐  ┌──────────▼─────────┐  ┌──────────▼──────────┐
    │  📊 Auto-Planner   │  │  📰 AI News Feed   │  │  🧮 Risk Calculator │
    │  (ICT Strategy)    │  │  (Thai Translation)│  │  (Position Sizing)  │
    └─────────┬──────────┘  └──────────┬─────────┘  └──────────┬──────────┘
              │                        │                        │
    ┌─────────▼──────────┐  ┌──────────▼─────────┐  ┌──────────▼──────────┐
    │  indicators.js     │  │   market.js         │  │  calculator.js      │
    │  ─────────────     │  │  ─────────────      │  │  ──────────────     │
    │  • RSI(14)         │  │  • Binance WS (BTC) │  │  • Lot Sizing       │
    │  • MACD(12/26/9)   │  │  • Binance WS (ETH) │  │  • Risk % Calc      │
    │  • ATR(14)         │  │  • Yahoo Poll (XAU) │  │  • Spread Cost      │
    │  • Swing Points    │  │  • Yahoo Poll (DXY) │  │  • SL/TP Distance   │
    │  • Fibonacci OTE   │  │  • OHLCV Cache 15s  │  │  • Net Profit Est.  │
    │  • Order Block     │  │  • News + AI Trans  │  │                     │
    │  • Fair Value Gap  │  │  • localStorage     │  │                     │
    │  • EMA Trend       │  │    News Cache       │  │                     │
    └─────────┬──────────┘  └──────────┬─────────┘  └─────────────────────┘
              │                        │
    ┌─────────▼──────────────────────▼─┐
    │             analysis.js           │
    │  ────────────────────────────     │
    │  • รับ OHLCV จาก market.js       │
    │  • เรียก indicators.js คำนวณ     │
    │  • Confluence Score (0-100)       │
    │  • สร้าง Trade Plan (BUY/SELL)   │
    │  • คำนวณ Lot + Spread Cost        │
    │  • Render ICT Card + Fibo Scale   │
    └─────────┬──────────────────────-─┘
              │
    ┌─────────▼──────────┐
    │      app.js         │
    │  ────────────────   │
    │  • Init ทุก Module  │
    │  • Navigation       │
    │  • Asset Selector   │
    │  • TF Selector      │
    │  • TradingView Sync │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │  index.html (DOM)  │
    │  + style.css (UI)  │
    └────────────────────┘
```

---

## 🔄 3. Data Flow — ข้อมูลไหลอย่างไร

### 3.1 ราคา Real-Time (Price Flow)
```
[Binance WebSocket]          [Yahoo Finance API]
  BTCUSDT tick                 XAU=F / DXY Polling
  ETHUSDT tick                 ทุก 15 วินาที
        │                             │
        └──────────┬──────────────────┘
                   ▼
           [market.js]
           Market.prices = { xau, btc, eth, dxy, ...pct }
                   │
                   ▼  Market._emit()
           [app.js]
           App.onPrices(prices)
                   │
         ┌─────────┴──────────┐
         ▼                    ▼
   [Header Chips]      [Right Drawer]
   ราคาสดทุกสินทรัพย์  mini-btc, mini-xau
```

### 3.2 การวิเคราะห์ Auto-Planner (Analysis Flow)
```
ผู้ใช้กดปุ่ม [วิเคราะห์]
         │
         ▼
[analysis.js] Analysis.run(asset, tf)
         │
         ▼
[market.js] Market.fetchOHLCV(asset, tf, 250 candles)
         │
    ┌────┴────────────────────────────────────┐
    │  เช็ค ohlcvCache (TTL 15 วินาที)        │
    │  HIT → คืน cache ทันที (~1ms)           │
    │  MISS → ดึง API (timeout 2.5s) → cache  │
    └────┬────────────────────────────────────┘
         │
         ▼
  Sync lastCandle.close = livePrice (ราคาสด)
         │
         ▼
[indicators.js] คำนวณทุกตัว:
  • closes[], highs[], lows[]
  • RSI → trend, oversold/overbought
  • MACD → momentum, crossover
  • ATR(14) → SL distance
  • SwingPoints → High/Low structure
  • Fibonacci OTE → entry 70.5%
  • OrderBlock → support/resistance
  • EMA Trend → direction confirmation
         │
         ▼
[analysis.js] Confluence Engine
  • นับสัญญาณทับซ้อน (score 0-100)
  • ตัดสิน BUY / SELL / WAIT
  • คำนวณ TP, Entry (OTE), SL
  • คำนวณ Lot Size (จาก Risk $50 base)
  • คำนวณ Spread Cost (Exness formula)
         │
         ▼
[DOM Render] แสดงผล:
  • ICT Smart Card (ซ้าย)
  • Fibonacci Scale (ขวา)
  • Confluence Badge
  • Spread Cost Display
```

### 3.3 Calculator Flow (Risk Panel)
```
ผู้ใช้กรอก: Asset, Balance, Risk%, SL Distance
         │
         ▼
[calculator.js] Calculator.compute()
         │
  ┌──────┴──────────────────────────────┐
  │ 1. riskUsd = balance × (risk/100)   │
  │ 2. rawLot = riskUsd / (slDist × CV) │
  │ 3. if rawLot < minLot → use minLot  │
  │ 4. else → floor(rawLot × scale)     │
  │ 5. spreadCost = spread × pt × CS × lot │
  └──────┬──────────────────────────────┘
         │
         ▼
[DOM] แสดง: Lot Size, Spread Cost, Net Profit
```

---

## 📦 4. Module Responsibilities — หน้าที่แต่ละไฟล์

### 📄 `js/app.js` — Coordinator
```
หน้าที่: จุดเริ่มต้น และ Orchestrator หลัก
├── App.init()          → เรียก init ทุก module
├── startClock()        → นาฬิกาเรียลไทม์
├── bindNavigation()    → สลับ Panel (Dashboard/Planner/Calculator/News)
├── bindAssets()        → เปลี่ยนสินทรัพย์ (XAU/BTC/ETH/DXY)
├── bindGlobalTF()      → เลือก Timeframe (5m/15m/1h/4h/1d/1w)
├── bindChart()         → ซิงค์ TradingView Widget
├── bindAnalysis()      → กดปุ่มวิเคราะห์ → เรียก Analysis.run()
├── loadMainChart()     → โหลด TradingView Embed
└── onPrices()          → รับราคาจาก Market._emit() → อัปเดต DOM

⚠️ สิ่งที่ห้ามทำใน app.js:
  - ห้ามคำนวณ Math ใดๆ (ไปไว้ indicators.js)
  - ห้ามยุ่ง API (ไปไว้ market.js)
  - ห้าม hardcode ราคา/ค่าคงที่
```

### 📄 `js/market.js` — Data Layer
```
หน้าที่: ดึงและจัดการข้อมูลตลาดทั้งหมด
├── Market.init()           → เปิด WebSocket + เริ่ม Polling
├── connectBTCWebSocket()   → Binance WS สำหรับ BTC
├── connectETHWebSocket()   → Binance WS สำหรับ ETH
├── startXAUPolling()       → Poll Yahoo Finance ทุก 15s
├── fetchXAU()              → ราคาทองคำ (Yahoo/Proxy fallback)
├── fetchDXY()              → DXY Dollar Index
├── fetchOHLCV(asset,tf,n)  → ดึงแท่งเทียน OHLCV (+ cache)
├── ohlcvCache{}            → Cache 15 วินาที
├── fetchWithTimeout()      → AbortController wrapper
├── closes(candles)         → แปลง candle[] → close[]
├── highs(candles)          → แปลง candle[] → high[]
└── lows(candles)           → แปลง candle[] → low[]

ค่า State สำคัญ:
  Market.prices = { xau, btc, eth, dxy, xauPct, btcPct, ethPct, dxyPct }
```

### 📄 `js/indicators.js` — Math Engine (Pure Functions)
```
หน้าที่: คณิตศาสตร์เทคนิค (ไม่มี DOM, ไม่มี API)
├── ema(values, period)         → EMA ค่าเดียว
├── emaArray(values, period)    → EMA เป็น Array
├── rsi(closes, period=14)      → RSI 0-100
├── macd(closes)                → { macd, signal, histogram }
├── atr(candles, period=14)     → Average True Range
├── swingPoints(highs,lows)     → { swingHigh{idx,price}, swingLow{idx,price} }
├── fibonacci(high,low,dir)     → ระดับ Fibo ทั้งหมด (0%, 23.6%...100%)
├── oteLevel(high,low,dir)      → จุดเข้า OTE 70.5%
├── orderBlock(candles,dir)     → Order Block ล่าสุด
├── fairValueGap(candles)       → FVG zones
└── emaTrend(closes)            → 'bullish'/'bearish'/'neutral'

⚠️ กฎ Pure Functions:
  - รับ Input → คืน Output เท่านั้น
  - ห้าม fetch, ห้ามยุ่ง DOM, ห้าม setState
```

### 📄 `js/analysis.js` — Brain
```
หน้าที่: ประสาน indicators + market + แสดงผล Trade Plan
├── Analysis.run(asset, tf)     → Entry Point หลัก
├── buildPlan(candles, asset)   → สร้าง Trade Plan Object
│   ├── เรียก Indicators ทุกตัว
│   ├── Confluence Score (0-100)
│   ├── ตัดสิน BUY/SELL/WAIT
│   ├── คำนวณ Entry (OTE), TP, SL
│   ├── คำนวณ Lot Size
│   └── คำนวณ Spread Cost
├── renderICTCard(plan)         → แสดง Smart Card ฝั่งซ้าย
├── renderFiboScale(plan)       → แสดง Fibonacci Scale ฝั่งขวา
├── showLoading() / hideLoading() → UI state
└── handleError(err)            → แสดง Error message

⚠️ Lot Size Logic (v3.9 Bug-Fixed):
  rawLot คำนวณก่อน → เช็ค minLot → ค่อย floor()
```

### 📄 `js/calculator.js` — Risk Tool
```
หน้าที่: เครื่องมือคำนวณความเสี่ยงสำหรับผู้ใช้
├── Calculator.init()           → Bind input events
├── compute()                   → คำนวณทั้งหมดเมื่อ input เปลี่ยน
├── calcLot(asset,risk,sl)      → Lot Size per asset
├── calcSpread(asset,lot)       → Spread Cost (Exness formula)
├── saveToHistory()             → บันทึกแผนเทรด
└── renderHistory()             → แสดงประวัติแผน

ค่าคงที่ Exness ที่ต้องรู้:
  XAUUSD:  minLot=0.01, CV=100,      spread≈200pts
  BTCUSDT: minLot=0.001, CV=1,       spread≈2150pts
  ETHUSDT: minLot=0.01, CV=1,        spread≈160pts
  FOREX:   minLot=0.01, CV=10(pip$), spread≈15pts
```

---

## ✏️ 5. ขั้นตอนการแก้ไขโค้ด (Edit Workflow)

### Step-by-Step: แก้ไขทุกครั้ง

```
STEP 1: อ่านไฟล์ MEMORY_LOG.md
        → เข้าใจ version ปัจจุบันและสิ่งที่ทำไปแล้ว

STEP 2: ระบุว่าแก้ใน Module ไหน
        → ดู "Module Responsibilities" ในหัวข้อ 4

STEP 3: อ่านไฟล์เป้าหมาย (view_file)
        → ดูโค้ดที่จะแก้ก่อนลงมือเสมอ

STEP 4: แก้ไขโค้ด
        → ใช้ replace_file_content (แก้จุดเดียว)
        → ใช้ multi_replace_file_content (แก้หลายจุด)

STEP 5: รัน Unit Test ตรวจสอบ
        → node test_backtest_all.js
        → ต้องผ่าน 17/17

STEP 6: อัปเดต MEMORY_LOG.md
        → บันทึก bug ที่แก้, feature ที่เพิ่ม, version ใหม่
```

### 🚦 Decision Tree: แก้ไฟล์ไหน?

```
ต้องการแก้อะไร?
│
├─ ราคาสด / API / WebSocket / Cache
│   └─→ แก้ js/market.js
│
├─ สูตรคณิตศาสตร์ (RSI, MACD, Fibo, Swing, OB)
│   └─→ แก้ js/indicators.js
│
├─ ตรรกะวิเคราะห์ / Confluence / แสดงผล ICT Card
│   └─→ แก้ js/analysis.js
│
├─ คำนวณ Lot / Risk / Spread Cost (Risk Panel)
│   └─→ แก้ js/calculator.js
│
├─ Navigation / Asset Selector / TF Selector / TradingView
│   └─→ แก้ js/app.js
│
├─ สีสัน / ขนาด / Layout / Responsive / Animation
│   └─→ แก้ css/style.css
│
└─ HTML Structure / Panel / Button เพิ่มใหม่
    └─→ แก้ index.html
```

---

## 🆕 6. ขั้นตอนการเพิ่มฟีเจอร์ใหม่

### Template: เพิ่ม Panel ใหม่
```
1. index.html
   └─ เพิ่ม <div id="panel-XXX" class="panel"> ... </div>
   └─ เพิ่ม <button class="bnav-btn" data-panel="XXX"> ในเมนู

2. js/app.js
   └─ ถ้าต้องการ logic พิเศษ เพิ่มใน bindNavigation() หรือ switchPanel()

3. css/style.css
   └─ เพิ่ม style สำหรับ #panel-XXX

4. js/XXX.js (ถ้าต้องการ Module ใหม่)
   └─ สร้างตาม pattern: const XXX = { init() {}, ... }
   └─ เรียก XXX.init() ใน app.js > App.init()
```

### Template: เพิ่ม Indicator ใหม่
```
1. js/indicators.js
   └─ เพิ่ม function ใหม่ตาม pattern Pure Function:
      newIndicator(closes, period) {
        // คำนวณ
        return result;
      }

2. js/analysis.js > buildPlan()
   └─ เรียก Indicators.newIndicator(closes, period)
   └─ นำผลลัพธ์เข้า Confluence Score
   └─ แสดงผลใน renderICTCard()

3. test_backtest_all.js
   └─ เพิ่ม Unit Test สำหรับ indicator ใหม่
   └─ รัน: node test_backtest_all.js → ต้องผ่าน
```

---

## 💱 7. ขั้นตอนการเพิ่มสินทรัพย์ใหม่

ตัวอย่าง: เพิ่ม **GBPUSD**

```
STEP 1: js/market.js
   ├─ เพิ่ม prices.gbp = 0
   ├─ สร้าง fetchGBP() → เรียก Yahoo Finance 'GBPUSD=X'
   ├─ เพิ่มใน fetchInitialPrices()
   └─ แก้ fetchOHLCV() ให้รองรับ case 'GBPUSD'

STEP 2: js/analysis.js
   ├─ เพิ่ม else if (asset === 'GBPUSD') livePrice = Market.prices.gbp
   └─ แก้ buildPlan() ให้รองรับ asset ใหม่

STEP 3: js/calculator.js
   └─ เพิ่ม case 'GBPUSD' ใน calcLot():
      minLot = 0.01
      CV = 10  (pip value = $10 per lot per pip)
      spread ≈ 15 points

STEP 4: index.html
   └─ เพิ่ม <button class="asset-btn" data-asset="GBPUSD">GBPUSD</button>
   └─ เพิ่ม Price Chip ใน Header

STEP 5: js/app.js
   └─ เพิ่มใน bindAssets() หรือ onPrices() ตามต้องการ

STEP 6: test_backtest_all.js
   └─ เพิ่ม test case สำหรับ GBPUSD Lot + Spread
   └─ รัน: node test_backtest_all.js
```

---

## 🧪 8. ขั้นตอนการทดสอบระบบ

### 8.1 Unit Test & Backtest
```powershell
# เข้าโฟลเดอร์
cd "g:\My Drive\jaeng"

# Unit Test ครบ 17 รายการ + Backtest 30 วัน ทุก TF
node test_backtest_all.js
# ✅ คาดหวัง: ผ่าน 17/17, ตาราง Backtest ครบ 5m → 1w

# Backtest จำลอง 3 เดือน
node backtest_3months.js
# ✅ คาดหวัง: รายงานกำไร/ขาดทุน ครบ 3 เดือน

# Unit Test ชุดอื่น
node test_analysis.js
```

### 8.2 สิ่งที่ต้องตรวจสอบหลังแก้โค้ด
```
Checklist:
[ ] Lot Size ไม่เป็น 0 หรือ undefined ในทุกกรณี
[ ] Spread Cost แสดงผลเป็นตัวเลข USD ที่สมเหตุสมผล
[ ] RSI อยู่ในกรอบ [0, 100] เสมอ
[ ] OTE Entry อยู่ใน Fibonacci 62%-79% zone
[ ] Order Block ไม่ return undefined
[ ] Backtest: Win Rate > 60% ใน 5m และ 15m
[ ] Max Drawdown < 15% ใน 5m และ 15m
[ ] กราฟ TradingView โหลดได้ทุก TF (5m, 15m, 1h, 4h, 1d, 1w)
[ ] ราคาสดอัปเดตบน Header Chips
[ ] Mobile Responsive: ไม่มีอะไรล้นขอบจอ
```

### 8.3 เกณฑ์ผ่าน/ไม่ผ่าน
| เครื่องมือ | เกณฑ์ผ่าน |
|---|---|
| Unit Test | 17/17 (100%) |
| Backtest 5m Win Rate | > 65% |
| Backtest 15m Win Rate | > 75% |
| Backtest Max DD (5m/15m) | < 15% |
| Lot Size (XAUUSD $50 base) | ≥ 0.01 เสมอ |
| Spread Cost (XAUUSD 0.01 Lot) | ~$2.00 |

---

## 🎨 9. Design System & CSS Guide

### 9.1 CSS Variables (ใช้เสมอ ห้าม hardcode สี)
```css
/* พื้นหลัง */
--bg-base:    #06080c          /* ดำลึกสุด */
--bg-panel:   rgba(13,17,26,0.65) /* Glassmorphism panel */
--bg-card:    rgba(20,25,40,0.8)  /* Card */

/* สีหลัก */
--accent-cyan:    #00f2fe    /* ฟ้านีออน — ราคา, Link */
--accent-gold:    #f5a623    /* ทอง — TP, สำคัญ */
--accent-emerald: #10b981    /* เขียว — TP, กำไร, ผ่าน */
--accent-red:     #f43f5e    /* แดง — SL, ขาดทุน, Error */
--accent-purple:  #a78bfa    /* ม่วง — Spread Cost */

/* Text */
--text-primary:   #e8eaf0
--text-secondary: #8892a4
--text-muted:     #4a5568
```

### 9.2 CSS Structure ใน style.css
```
style.css (ลำดับหมวด):
│
├── 1. :root Variables          (CSS Custom Properties)
├── 2. Reset & Base             (* { box-sizing }, body, etc.)
├── 3. Layout                   (Header, Main, Sidebar, Footer)
├── 4. Navigation               (.bnav-btn, .bnav-icon)
├── 5. Panels                   (#panel-dashboard, #panel-planner, etc.)
├── 6. Components               (.card, .chip, .badge, .btn)
├── 7. Auto-Planner             (.ict-card, .fibo-scale, .ctrl-tf)
├── 8. Calculator               (.risk-panel, .calc-result)
├── 9. News Feed                (.news-card, .news-badge)
├── 10. Right Drawer            (.right-drawer, .mini-news)
├── 11. TF Buttons              (.tf-pill, .chart-tf-btn, .ctrl-tf)
├── 12. Animations              (@keyframes, transitions)
└── 13. Responsive              (@media queries)
```

### 9.3 TF Button Specs (v3.8)
```css
.tf-pill, .ctrl-tf button {
  padding: 7px 15px;
  min-height: 36px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 700;
}
/* Active state: cyan glow */
/* Inactive: ghost border */
```

---

## 🌐 10. API & Data Sources

### 10.1 ราคา Real-Time
| สินทรัพย์ | API | ประเภท | Interval |
|---|---|---|---|
| BTCUSDT | `wss://stream.binance.com/ws/btcusdt@ticker` | WebSocket | Tick |
| ETHUSDT | `wss://stream.binance.com/ws/ethusdt@ticker` | WebSocket | Tick |
| XAUUSD | Yahoo Finance `GC=F` (via proxy) | REST Poll | 15 วินาที |
| DXY | Yahoo Finance `DX-Y.NYB` (via proxy) | REST Poll | 15 วินาที |

### 10.2 OHLCV Historical Data
| สินทรัพย์ | API | TF ที่ใช้ | Max Candles |
|---|---|---|---|
| BTCUSDT | `api.binance.com/api/v3/klines` | 1m,5m,15m,1h,4h,1d,1w | 1000 |
| ETHUSDT | `api.binance.com/api/v3/klines` | เดียวกัน | 1000 |
| XAUUSD | Yahoo Finance `GC=F` (1wk → 5y history) | 1m,5m,15m,1h,4h,1d,1w | ~250 |
| DXY | Yahoo Finance `DX-Y.NYB` | เดียวกัน | ~250 |

### 10.3 Timeout & Fallback Policy
```
Proxy/Yahoo:  timeout = 2.5 วินาที → Fallback: Simulated Data
Binance REST: timeout = 2.0 วินาที → Fallback: ราคาเดิม
WebSocket:    auto-reconnect เมื่อ disconnect
Cache TTL:    15 วินาที (ohlcvCache object ใน market.js)
```

### 10.4 News Feed
```
Source:  CryptoNews / GNews API (English)
Process: fetch → แปล Title+Body → Google Translate client bridge
Cache:   localStorage ผูกกับ News ID (ถาวร ไม่มี TTL)
Display: ข่าวภาษาอังกฤษก่อน → fade-in ภาษาไทยเมื่อแปลเสร็จ
```

---

## 💡 11. แนวคิดการออกแบบ (Design Philosophy)

### 11.1 หลักการหลัก 5 ข้อ
```
1. OFFLINE-FIRST
   → WebApp ต้องทำงานได้แม้อินเทอร์เน็ตช้า
   → ใช้ Cache + Fallback ทุกจุด
   → ไม่มี Server-side dependency

2. MOBILE-FIRST RESPONSIVE
   → ออกแบบสำหรับจอมือถือก่อน
   → ขยายสู่ Desktop
   → Touch-friendly: min-height 36px, font ≥ 0.75rem

3. ICT STRATEGY ACCURACY
   → ทุกสูตรคำนวณต้องผ่าน Unit Test
   → OTE Zone = 62%-79% Fibonacci เสมอ
   → Risk:Reward ≥ 1:2 เสมอ

4. ZERO FRAMEWORK
   → ไม่ใช้ React, Vue, Angular
   → Vanilla JS Module Pattern (const Module = { ... })
   → เหตุผล: เบา, เร็ว, ไม่มี dependency issues

5. PREMIUM UI/UX
   → Dark Cyberpunk + Glassmorphism
   → Micro-animations ทุกจุดโต้ตอบ
   → สีใช้ CSS Variable (ห้าม hardcode)
```

### 11.2 Pattern การเขียนโค้ด
```javascript
// ✅ Module Pattern ที่ใช้ทั่วโปรเจกต์
const ModuleName = {
  state: { ... },          // State ส่วนตัว

  init() { ... },          // เริ่มต้น (เรียกครั้งเดียวจาก app.js)

  async fetchSomething() { // Async Methods
    try { ... }
    catch (err) { this.handleError(err); }
  },

  _privateHelper() { ... } // Underscore = private convention
};
```

---

## 🚀 12. Roadmap การพัฒนาต่อยอด

### Phase 1 — Short Term (ทำได้เลย)
```
[ ] เพิ่มสินทรัพย์ Forex: GBPUSD, EURUSD, USDJPY
[ ] เพิ่ม Pivot Points (Daily/Weekly) ใน indicators.js
[ ] เพิ่มปุ่ม "Copy Trade Plan" → clipboard
[ ] Dark/Light Mode Toggle
[ ] เพิ่ม Alert เสียงเมื่อสัญญาณ Confluence สูง
```

### Phase 2 — Medium Term
```
[ ] WebSocket เต็มรูปแบบ (แทน Polling XAU/DXY)
    → ใช้ Tradesparq / Polygon.io API
[ ] Journal / Trade History (บันทึกใน IndexedDB)
    → ดูสถิติย้อนหลังได้
[ ] Multi-Asset Dashboard (ดูทุกสินทรัพย์พร้อมกัน)
[ ] Custom Alert System (Email / Line Notify)
[ ] Session Timer: Asia / London / NY Session Highlight
```

### Phase 3 — Long Term
```
[ ] PWA (Progressive Web App) — ใช้ได้ Offline 100%
[ ] Cloud Sync (Firebase) — บันทึกแผนเทรดข้ามเครื่อง
[ ] AI Signal Scoring (ใช้ LLM ประเมิน confluence)
[ ] Backtesting UI — รัน Backtest ผ่านหน้าเว็บ (ไม่ต้อง Node.js)
[ ] Multi-Account Portfolio Tracker
[ ] Telegram Bot Integration → รับสัญญาณผ่าน Telegram
```

### Mind Map: การต่อยอด
```
                     [ApexTrader Hub v3.9]
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
    [More Assets]    [More Features]    [Infrastructure]
          │                 │                 │
    ┌─────┴────┐      ┌─────┴─────┐     ┌─────┴────┐
    │ GBPUSD   │      │ Pivot Pts │     │ WebSocket│
    │ EURUSD   │      │ Sessions  │     │ (XAU/DXY)│
    │ USDJPY   │      │ Alerts    │     │ PWA      │
    │ NASDAQ   │      │ Journal   │     │ Firebase │
    │ SPX500   │      │ Portfolio │     │ Telegram │
    └──────────┘      └───────────┘     └──────────┘
```

---

## 📋 13. Cheat Sheet คำสั่งที่ใช้บ่อย

### 🚀 เริ่ม Session / Backup
```powershell
# เริ่ม Session Check (ทุกครั้งที่เปิดโปรเจกต์)
powershell -ExecutionPolicy Bypass -File "G:\My Drive\jaeng\session_check.ps1"

# หรือดับเบิลคลิกไฟล์นี้ได้เลย:
# START_CHECK.bat

# Backup ทันที (ก่อนปิดเครื่อง / หลังแก้โค้ดสำคัญ)
powershell -ExecutionPolicy Bypass -File "G:\My Drive\jaeng\backup_now.ps1"
# หรือดับเบิลคลิก: BACKUP_NOW.bat
```

### 🧪 รัน Test
```powershell
cd "g:\My Drive\jaeng"
node test_backtest_all.js    # Unit Test 17/17 + Backtest 30d ALL TF
node backtest_3months.js     # Backtest 3 เดือน
node test_analysis.js        # Unit Test ชุดอื่น
```

### 🔍 ค้นหาโค้ด
```powershell
# หา keyword ทุกไฟล์ JS
Select-String -Path "g:\My Drive\jaeng\js\*.js" -Pattern "keyword"

# หา function เฉพาะไฟล์
Select-String -Path "g:\My Drive\jaeng\js\market.js" -Pattern "fetchOHLCV"
```

### 📌 Key Locations สำคัญ
| ต้องการอะไร | ดูที่ไหน | บรรทัดประมาณ |
|---|---|---|
| Session Protocol | `SESSION_START.md` | ทั้งหมด |
| สถานะเครื่อง | `session_state.json` | ทั้งหมด |
| ประวัติ Version | `MEMORY_LOG.md` | ทั้งหมด |
| สูตร Lot Size (analysis) | `js/analysis.js` | ~150-195 |
| สูตร Lot Size (calculator) | `js/calculator.js` | ~110-151 |
| OHLCV Fetcher + Cache | `js/market.js` | ~150-250 |
| bindChart() TradingView | `js/app.js` | ~100-150 |
| Fibonacci OTE | `js/indicators.js` | ~150-200 |
| CSS TF Buttons | `css/style.css` | ค้นหา `.ctrl-tf` |

### 💱 ค่าคงที่ Exness
```
XAUUSD:  minLot=0.01, CV=100,  spread=200pts  → $2.00 per 0.01 lot
BTCUSDT: minLot=0.001, CV=1,   spread=2150pts → $0.02 per 0.001 lot
ETHUSDT: minLot=0.01, CV=1,    spread=160pts  → $0.05 per 0.03 lot
FOREX:   minLot=0.01, CV=10,   spread=15pts   → $0.15 per 0.1 lot

ฐานทุนคำนวณ (Fixed): $50.00
ความเสี่ยงต่อไม้:     5% = $2.50
```

---

## 🔗 ไฟล์อ้างอิงทั้งหมด

### AI Memory & Protocol Files
| ไฟล์ | วัตถุประสงค์ |
|---|---|
| [WORKFLOW.md](file:///g:/My%20Drive/jaeng/WORKFLOW.md) | คู่มือนักพัฒนาฉบับสมบูรณ์ (ไฟล์นี้) |
| [MEMORY_LOG.md](file:///g:/My%20Drive/jaeng/MEMORY_LOG.md) | ประวัติการพัฒนาทุก Version |
| [SESSION_START.md](file:///g:/My%20Drive/jaeng/SESSION_START.md) | Protocol ตรวจสอบทุก Session |
| [session_state.json](file:///g:/My%20Drive/jaeng/session_state.json) | สถานะล่าสุดข้ามเครื่อง |

### System Scripts
| ไฟล์ | วิธีใช้ | เวลาที่ใช้ |
|---|---|---|
| [START_CHECK.bat](file:///g:/My%20Drive/jaeng/START_CHECK.bat) | ดับเบิลคลิก | **ทุกครั้งที่เริ่มงาน** |
| [BACKUP_NOW.bat](file:///g:/My%20Drive/jaeng/BACKUP_NOW.bat) | ดับเบิลคลิก | ก่อนปิดเครื่อง / หลังแก้โค้ด |
| [session_check.ps1](file:///g:/My%20Drive/jaeng/session_check.ps1) | PS1 Script | เรียกจาก START_CHECK.bat |
| [backup_now.ps1](file:///g:/My%20Drive/jaeng/backup_now.ps1) | PS1 Script | เรียกจาก BACKUP_NOW.bat |

### Source Code Files
| ไฟล์ | วัตถุประสงค์ |
|---|---|
| [js/app.js](file:///g:/My%20Drive/jaeng/js/app.js) | Coordinator |
| [js/market.js](file:///g:/My%20Drive/jaeng/js/market.js) | Data Layer |
| [js/indicators.js](file:///g:/My%20Drive/jaeng/js/indicators.js) | Math Engine |
| [js/analysis.js](file:///g:/My%20Drive/jaeng/js/analysis.js) | Brain |
| [js/calculator.js](file:///g:/My%20Drive/jaeng/js/calculator.js) | Risk Tool |
| [css/style.css](file:///g:/My%20Drive/jaeng/css/style.css) | Design System |
| [test_backtest_all.js](file:///g:/My%20Drive/jaeng/test_backtest_all.js) | Unit Test + Backtest |

---

*📅 อัปเดตโดย Antigravity AI | 2026-05-22T14:25 ICT*  
*🔍 Keywords: Workflow, Session, Backup, Multi-Machine, Module, API, Lot, Fibo, OTE, Exness, Backtest, Roadmap, CSS*
