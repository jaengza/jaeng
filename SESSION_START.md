# 🚀 SESSION START PROTOCOL — ApexTrader Hub
> **อ่านไฟล์นี้ทุกครั้งที่เริ่ม Session ใหม่**  
> เวอร์ชัน: v1.0 | สร้าง: 2026-05-22

---

## 📋 CHECKLIST สำหรับ AI (ทำทุกครั้งที่ผู้ใช้เปิดโปรแกรม)

เมื่อผู้ใช้พิมพ์ว่า **"เริ่มงาน"** หรือ **"check"** หรือ **"session start"**  
ให้ AI ทำตาม Step เหล่านี้โดยอัตโนมัติ:

### ✅ STEP 1 — ระบุเครื่องที่ใช้งาน
```powershell
$env:COMPUTERNAME
```
เปรียบเทียบกับทะเบียนเครื่อง:
| ชื่อเครื่อง | ชื่อเรียก | สถานะ |
|---|---|---|
| `LAPTOP-NHPCPQ9G` | Notebook หลัก (เครื่อง 1) | ✅ ลงทะเบียนแล้ว |
| *(เครื่อง 2 — ยังไม่ได้ลงทะเบียน)* | Notebook สำรอง | ⏳ รอลงทะเบียน |

> หากพบชื่อเครื่องใหม่ → บันทึกลงทะเบียนด้านบนทันที

---

### ✅ STEP 2 — ตรวจสอบ Google Drive Sync
```powershell
# ตรวจสอบว่า G:\ ยัง Mount อยู่
Test-Path "G:\My Drive\jaeng"

# ดูเวลาแก้ไขล่าสุดของไฟล์หลัก
Get-ChildItem "G:\My Drive\jaeng" -File | Sort-Object LastWriteTime -Descending | Select-Object Name, LastWriteTime -First 10
```
ผลลัพธ์ที่ต้องการ:
- `Test-Path` → `True` (Google Drive Mount ปกติ)
- ไฟล์สำคัญมีวันแก้ไขล่าสุดตรงกับ Session ก่อนหน้า

---

### ✅ STEP 3 — ตรวจสอบ Version และ Integrity
```powershell
# เช็คว่าไฟล์สำคัญครบ
$files = @("index.html","css/style.css","js/app.js","js/market.js","js/indicators.js","js/analysis.js","js/calculator.js","MEMORY_LOG.md","WORKFLOW.md","SESSION_START.md")
$base = "G:\My Drive\jaeng"
$files | ForEach-Object {
  $path = Join-Path $base $_
  [PSCustomObject]@{
    File = $_
    Exists = Test-Path $path
    Size = if (Test-Path $path) { (Get-Item $path).Length } else { 0 }
  }
} | Format-Table
```
ต้องผ่าน: ทุกไฟล์ต้อง `Exists = True`

---

### ✅ STEP 4 — อ่านสถานะล่าสุดจาก session_state.json
```powershell
Get-Content "G:\My Drive\jaeng\session_state.json" | ConvertFrom-Json
```
แสดง: เครื่องล่าสุดที่บันทึก, วันที่, version, งานที่ค้างอยู่

---

### ✅ STEP 5 — รัน Unit Test ตรวจสอบ (ถ้ามีการแก้โค้ด)
```powershell
cd "G:\My Drive\jaeng"
node test_backtest_all.js
```
ต้องผ่าน: 17/17 ✅

---

### ✅ STEP 6 — อัปเดต session_state.json
บันทึกว่า Session นี้เริ่มจากเครื่องไหน เวลาอะไร

---

## 📢 รายงานสรุป Session Start ที่ AI ต้องบอกผู้ใช้

```
✅ Session เริ่มต้นสำเร็จ
━━━━━━━━━━━━━━━━━━━━━━━━━━
🖥️  เครื่อง:      [ชื่อเครื่อง]
📅  วันที่:       [วันเวลา]
☁️  Google Drive: [✅ Sync / ⚠️ ไม่พบ]
📁  ไฟล์ครบ:      [X/10]
🧪  Unit Test:    [17/17 ✅ / หรือ ERROR]
📝  Version:      v3.9
🔧  งานค้าง:      [รายการถ้ามี / ไม่มี]
━━━━━━━━━━━━━━━━━━━━━━━━━━
พร้อมทำงานครับ!
```

---

## ⚠️ กรณีพบปัญหา

| ปัญหา | วิธีแก้ |
|---|---|
| `G:\` ไม่พบ | เปิด Google Drive Desktop ก่อน แล้วรอ Sync |
| ไฟล์ไม่ครบ | รัน `git status` ดูว่าไฟล์ไหนหาย |
| Unit Test ไม่ผ่าน | ดู error → แก้ใน Module ที่เกี่ยวข้อง |
| เครื่องใหม่ไม่จำ | ลงทะเบียนชื่อเครื่องใน Step 1 |

---

*📅 สร้างโดย Antigravity AI | 2026-05-22*
