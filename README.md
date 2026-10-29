# PM Office 3D 🏢

เกมจำลองการบริหารโปรเจกต์แบบ 3D — แจกงาน คุมงบ คุมเวลา ดูแลคน
สร้างด้วย **Vite + Three.js** (Vanilla JS, ไม่มี framework)

## เริ่มต้น

```bash
npm install
npm run dev       # เปิด http://localhost:5173 (hot reload)
npm run build     # build ไปที่ dist/
npm run preview   # ลองเปิดไฟล์ที่ build แล้ว
```

ต้องใช้ Node.js 18 ขึ้นไป

## โครงสร้างไฟล์

```
pm-office-3d/
├─ index.html              # HTML ของ HUD / panel / modal ทั้งหมด
├─ src/
│  ├─ main.js              # ตัวเกม: ฉาก 3D, ระบบเกม, event, UI, burndown, shop
│  ├─ data/levels.js       # ข้อมูลด่าน (ทีม, งาน, dependency, งบ, วัน)
│  ├─ audio.js             # เสียงประกอบ + เพลง lo-fi (Web Audio สังเคราะห์)
│  ├─ utils.js             # helper เล็ก ๆ ($, clamp, fmt ...)
│  └─ style.css            # สไตล์ทั้งหมด
├─ standalone/
│  └─ pm-office-3d.html    # เวอร์ชันไฟล์เดียว เปิดในเบราว์เซอร์ได้เลย (โหลด Three.js จาก CDN)
└─ vite.config.js
```

## main.js แบ่ง section ไว้ (ค้นหาด้วย `/* =====`)

| Section | มีอะไร |
|---|---|
| `SAVE / STARS / UPGRADES` | localStorage, ภารกิจดาว `OBJ` / `LOBJ`, รายการอัปเกรด `UPG`, ราคา `UCOST` |
| `3D SCENE` | ห้อง, โต๊ะ, ตัวละคร, ของตกแต่งจากอัปเกรด (`buildUpgradeDecor`) |
| `GAME STATE` | `newGame`, การแจกงาน, ปุ่ม action, `sim()` (หัวใจของเกม), `EVENTS` |
| `burndown` | กราฟ SVG ตอนจบ + insight อัตโนมัติ |
| `UI RENDER` | Kanban, รายชื่อทีม, HUD |
| `LOOP` | animation ตัวละคร, label ลอย, PM เดิน |
| `START` | หน้าเลือกด่าน + ร้านอัปเกรด |

## ปรับ balance ตรงไหน

- **ความเร็วเกม:** `DAY_SEC` (วินาทีต่อ 1 วัน) บนสุดของ `main.js`
- **ความเร็วทำงาน:** ฟังก์ชัน `rate()` — skill, ขวัญ, ความเครียด, งานข้ามสาย, OT
- **ความเครียด / ขวัญ / บั๊ก:** ใน `sim()` (ค่า `risk`, `m.stress += ...`)
- **คะแนน / เกรด:** ใน `endGame()`
- **เหตุการณ์สุ่ม:** array `EVENTS` — แต่ละอันมี `make()` คืน `{icon,title,text,choices,lesson}`

## ทดสอบเร็ว ๆ ผ่าน Console

```js
__pm.newGame(0)          // เริ่มด่าน index 0
__pm.sim(1)              // เดินเวลา 1 วัน
__pm.S                   // ดู state ทั้งหมด
__pm.SAVE().coins = 999  // เสกเหรียญไว้ทดสอบร้านอัปเกรด
```

## Deploy

`npm run build` แล้วอัปโหลดโฟลเดอร์ `dist/` ขึ้น Vercel / Netlify / GitHub Pages ได้เลย
(ตั้งค่า `base: './'` ไว้แล้ว วางในโฟลเดอร์ย่อยก็ใช้ได้)

## หมายเหตุ

- ล็อก `three@0.128.0` ไว้ให้ตรงกับเวอร์ชันที่เขียนเกม ถ้าอัปเป็นเวอร์ชันใหม่ (r155 ขึ้นไป) แสงจะเปลี่ยน ต้องปรับ intensity ของ light ใหม่
- ข้อมูลเหรียญ ดาว และอัปเกรดเก็บใน `localStorage` key `pmoffice3d-save`
