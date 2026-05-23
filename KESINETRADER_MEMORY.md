# KesineTrader PRO - System Memory & Architecture Mapping

เอกสารนี้ถูกจัดทำขึ้นเพื่อบันทึก "ความทรงจำ" ของระบบ โครงสร้างสถาปัตยกรรม (Mapping) และลำดับขั้นตอนการคิด (Workflow) ของ AI เพื่อใช้เป็นฐานข้อมูลหลักในการพัฒนาและอัพเกรดระบบในอนาคต

---

## 1. Project Overview (ภาพรวมระบบ)
**KesineTrader PRO** เป็น Web Application สำหรับวิเคราะห์กราฟเทคนิคอลอัตโนมัติ (Automated Technical Analysis Dashboard) รองรับสินทรัพย์เช่น XAUUSD, BTCUSDT, ETHUSDT, DXY
* **เป้าหมายหลัก:** ดึงข้อมูลราคาแบบ Real-time, คำนวณอินดิเคเตอร์, และสร้าง "แผนการเทรด (Auto Trade Plan)" พร้อมบอกความน่าจะเป็น (Win Probability) และจุดเข้า/ออก (Entry, SL, TP)

---

## 2. System Architecture & File Mapping (โครงสร้างไฟล์)
ระบบทำงานแบบ Client-side (Vanilla JS) โดยแบ่งการทำงานออกเป็นโมดูลหลักดังนี้:

* **`index.html`**: โครงสร้างหน้าเว็บ แบ่งเป็น 3 คอลัมน์หลัก (ซ้าย: เมนูและสัญญาณล่าสุด, กลาง: แผงวิเคราะห์, ขวา: แผงคำนวณความเสี่ยง/บันทึกแผน)
* **`css/style.css`**: ดีไซน์ระบบ (Dark Theme, Glassmorphism, Responsive UI)
* **`js/market.js`**: โมดูลจัดการข้อมูลราคา (Data Fetching)
  * โหลดข้อมูลจาก Binance API (สำหรับ Crypto)
  * โหลดข้อมูลจาก Yahoo Finance API (สำหรับ Forex/Gold/DXY)
  * มีระบบ Fallback Mock Data กรณี API ดึงไม่ได้หรือติด Timeout
* **`js/indicators.js`**: โมดูลคำนวณคณิตศาสตร์และสูตร Technical (Math Engine)
  * **Momentum:** RSI, MACD, EMA (20, 50, 200)
  * **Price Action (SMC):** Swing High/Low, Fibonacci (OTE 70.5%, 78.6%, 88.6%), Pivot Points, Order Blocks (OB), Fair Value Gaps (FVG)
  * **Scoring System:** `signalScore()` รวมคะแนนจากทุกตัวชี้วัด (เกณฑ์สัญญาณออก = 1.0 เพื่อความถี่สูง / High Frequency)
* **`js/analysis.js`**: โมดูลประสานงานและสร้างแผนเทรด (Core Brain)
  * `run()`: สั่งโหลดข้อมูล -> โยนให้ Indicators คำนวณ -> นำไปสร้างแผน
  * `buildTradePlan()`: สรุปจุดเข้า (Entry), Stop Loss (โครงสร้าง + ATR), Take Profit, และบวกคะแนนพิเศษจาก Fibo/SMC
  * `renderResults()`: วาด UI ลงหน้าจอ โดยแบ่งเป็นบล็อกย่อยๆ และครอบด้วย `try-catch` แยกอิสระเพื่อป้องกัน UI ล่มทั้งหมด
* **`js/app.js`**: โมดูลจัดการ User Interface (Controller)
  * จัดการการคลิกปุ่ม, เปลี่ยน Timeframe, อัพเดท Dashboard (Right Column) และ Risk Calculator

---

## 3. Core Logic & Important Mechanisms (กลไกสำคัญที่ตกลงกันไว้)
1. **SASP Optimizer Warning System:**
   * **ปัญหาเดิม:** สัญญาณออกยากเกินไปถ้าตั้งเกณฑ์สูง แต่ถ้าตั้งเกณฑ์ต่ำ ผู้ใช้ก็ขาดทุนง่าย
   * **ทางแก้ปัจจุบัน:** ระบบจะออกสัญญาณได้ไว (Threshold = 1.0) แบบ High Frequency แต่จะ**มีระบบกรองมาคลุมอีกชั้น**
   * หากคะแนนรวม (Score) **ต่ำกว่า** เกณฑ์ SASP Sniper (เช่น 3.5) -> แจ้งเตือนสีส้ม (เสี่ยงสูง ให้ใช้ Price Action ช่วยตัดสินใจ)
   * หากคะแนนรวม **สูงกว่า** เกณฑ์ SASP Sniper -> แจ้งเตือนสีเขียว (🎯 SASP Sniper Verified)
2. **Transparent Reasoning (การแจกแจงเงื่อนไข):**
   * ผู้ใช้ต้องรู้ว่า "ทำไมถึงได้แผนเทรดนี้?"
   * ระบบจะ List แจกแจงเลยว่า: `RSI Oversold (+2)`, `MACD Rising (+1)`, `ทิศทางสอดคล้องกับ Bullish FVG (+1)`
3. **Safe Rendering (การวาดหน้าจอแบบปลอดภัย):**
   * ใช้ `container.innerHTML += ...` สลับกับ `try-catch` ทีละกล่อง 
   * หากกล่องไหนข้อมูลมีปัญหา (เช่น Fibo error) กล่องนั้นจะขึ้น Error สีแดง แต่กล่องอื่น (SMC, Trade Plan) จะยังแสดงผลได้ตามปกติ 100%

---

## 4. Tiered MTFA Architecture & Data Synchronization (ระบบ Timeframe และการซิงค์ราคา)
เพื่อแก้ปัญหาเรื่องการวิเคราะห์กราฟข้าม Timeframe และความคลาดเคลื่อนของราคาระหว่างเว็บแอปกับ MT5 ของโบรคเกอร์ ระบบได้วางกฎเกณฑ์ไว้ดังนี้:

1. **การจับคู่ Timeframe แบบขั้นบันได (Tiered Mapping):**
   * ระบบไม่อนุญาตให้กระโดดข้าม TF กว้างเกินไป (เช่น 1m ไป 1h จะกว้างเกินไป)
   * กฎการจับคู่: `1m->5m`, `5m->15m`, `15m->1h`, `1h->4h`, `4h->1d`, `1d->1w`
2. **การแบ่งแยกหน้าที่ของอินดิเคเตอร์อย่างเด็ดขาด:**
   * **HTF (กราฟใหญ่):** คำนวณ SMC (Swing High/Low, FVG, Order Block, Pivot Points) เพื่อหา "โครงสร้างและกำแพงราคา"
   * **LTF (กราฟเล็ก):** คำนวณ Momentum (RSI, MACD, EMA) เพื่อหา "จังหวะลั่นไก (Sniper Entry)"
3. **การคำนวณ Swing Points & Pivots ที่ถูกต้อง:**
   * **Swing Points:** ต้องกวาดหาจุดสูงสุด/ต่ำสุดแบบสัมบูรณ์ (Absolute Math.max/min) ในช่วง 100 แท่งล่าสุดของ HTF เพื่อหากรอบราคา (True Dealing Range) ที่กว้างสมจริง ไม่ใช่แค่ 5-bar fractal
   * **Pivot Points:** ห้ามคำนวณจากแท่งปัจจุบันเด็ดขาด ต้องใช้ High, Low, Close ของ **แท่งเทียนที่ปิดไปแล้ว (Previous Completed HTF Candle)** เสมอ
4. **Data Sourcing & Offset Calibration:**
   * **Gold (XAUUSD):** ดึงข้อมูลจาก Yahoo Finance สัญลักษณ์ `GC=F` (Gold Futures) ควบคู่กับ Proxy `corsproxy.io` เพราะโครงสร้างแท่งเทียน (Wicks/Bodies) คล้ายคลึงกับ Spot Gold บน MT5 มากที่สุด
   * **ระบบ Offset:** เนื่องจากแต่ละโบรคเกอร์มี Spread ไม่เท่ากัน ระบบจึงมีช่องให้กรอก "ราคา MT5 ปัจจุบัน" เพื่อหาค่าความต่าง (Offset) และทำการ Shift กราฟทั้ง 250 แท่งให้ขยับตรงกับ MT5 แบบเป๊ะ 100%

---

## 5. AI Workflow & Thought Process (ขั้นตอนการทำงานแบบเรียงลำดับความคิดของ AI)
เมื่อผู้ใช้แจ้งปัญหาหรือขอฟีเจอร์ใหม่ AI จะทำงานตามลำดับความคิด (Chain of Thought) ดังนี้:

1. **Understand & Diagnose (ทำความเข้าใจและวิเคราะห์ปัญหา):**
   * ผู้ใช้บอกว่า "จอขาว" หรือ "จบแค่ ICT" -> ประเมินว่าเกิดจาก Javascript Syntax Error, Runtime TypeError, หรือ HTML Parsing Error
2. **Trace Data Flow (ไล่สายน้ำของข้อมูล):**
   * เช็คตั้งแต่จุดกดปุ่ม (`app.js`) -> ดึงข้อมูล (`market.js`) -> คำนวณ (`indicators.js`) -> วาด UI (`analysis.js`) หาจุดที่สายน้ำขาด
3. **Mock & Isolate (จำลองและแยกส่วน):**
   * รันโค้ดจำลอง (Node.js script) ภายในใจเพื่อทดสอบสมมติฐานว่า Object ไหนที่เป็น `undefined`
4. **Incremental Implementation (แก้ไขแบบค่อยเป็นค่อยไป):**
   * เมื่อแก้ไขโค้ด จะหลีกเลี่ยงการรื้อใหม่ทั้งหมด แต่จะแทรก/ปรับเฉพาะจุด (ใช้ tools แบบระบุบรรทัด)
   * ใส่ระบบป้องกัน (Guard Clauses / Optional Chaining `?.` / Try-Catch) 
5. **Isolated Indicator Testing (การทดสอบแยกส่วนอินดิเคเตอร์ - *Standard Procedure*):**
   * เมื่อสร้างระบบหรือต้องการจูนค่า AI จะต้องใช้เครื่องมือ `ai_backtester.js` รันทดสอบแยกอินดิเคเตอร์ทีละตัว (เช่น แยกเทสต์เฉพาะ RSI, แยกเฉพาะ MACD, หรือแยกเฉพาะ SMC) 
   * ดึงข้อมูลจริงจาก MT5 มาทำ Backtest เสมอ เพื่อหาว่าอินดิเคเตอร์ตัวไหนทำงานได้ดีที่สุดใน Timeframe นั้นๆ ก่อนจะนำมาสรุปและประเมินค่าน้ำหนัก (Weighting) ใหม่
6. **Verify Syntax (ตรวจสอบความถูกต้อง):**
   * ใช้คำสั่ง `node -c` ตรวจสอบ Syntax ให้แน่ใจว่าไม่มีปีกกาตกหล่นก่อนส่งมอบให้ผู้ใช้
7. **Communicate (สื่อสารผลลัพธ์):**
   * สรุปผลลัพธ์เป็นภาษาที่เข้าใจง่าย แจ้งผู้ใช้อย่างชัดเจนว่าแก้อะไรไป และเหตุผลเบื้องหลังคืออะไร

---
*Last Updated: ${Current Version Checkpoint}*
*Backup Location: g:/My Drive/jaeng_stable_backup.zip*
