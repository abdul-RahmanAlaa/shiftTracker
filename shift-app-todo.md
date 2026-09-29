# TODO — تطبيق إدارة ورديات نقل السن

آخر تحديث: بدء مبادرة i18n وإضافة الإعداد الأساسي للـ renderer.

## 🚩 أولوية قصوى: Full i18n migration — إزالة كل النصوص المضمّنة

1. [x] Scope audit (read-only، ضمن التاسك دي)
2. [x] Install and configure i18next + react-i18next (renderer only، ضمن التاسك دي؛ لغة ثابتة `ar` ومن غير language detector)
3. [ ] Extract renderer strings into translation files، صفحة/قسم واحد في كل تاسك (تسكات مستقبلية)
4. [ ] Backend enum/status value rewrite to English + translation layer للعرض (تاسك مستقبلي، Claude ينفذه)

### Renderer extraction checklist (file size, smallest first)

- [ ] `LedgerEntryDetailsContent.tsx` (1,276 bytes)
- [ ] `date-picker.tsx` (1,737 bytes)
- [ ] `AccountsPage.tsx` (2,250 bytes)
- [ ] `AllTripsPage.tsx` (2,357 bytes)
- [ ] `SettingsPage.tsx` (2,441 bytes)
- [ ] `TripDetailsContent.tsx` (3,051 bytes)
- [ ] `App.tsx` (3,108 bytes)
- [x] `dialog.tsx` (3,308 bytes)
- [x] `FloatingWindow.tsx` (3,477 bytes)
- [x] `AccountTables.tsx` (5,314 bytes)
- [x] `CreateShiftForm.tsx` (5,856 bytes)
- [x] `ImportPage.tsx` (6,266 bytes)
- [x] `ContractorsSettings.tsx` (7,185 bytes)
- [x] `DriversSettings.tsx` (7,499 bytes)
- [x] `ClientsSettings.tsx` (7,925 bytes)
- [x] `CrushersSettings.tsx` (8,018 bytes)
- [x] `LedgerEntryForm.tsx` (9,271 bytes)
- [x] `ClientAccountPage.tsx` (9,359 bytes)
- [ ] `AllMovementsPage.tsx` (9,538 bytes)
- [ ] `ReceiptPhoto.tsx` (11,872 bytes)
- [ ] `VehiclesSettings.tsx` (12,430 bytes)
- [ ] `DataTable.tsx` (13,219 bytes)
- [ ] `DriverHistoryPage.tsx` (16,261 bytes)
- [ ] `ContractorAccountPage.tsx` (16,627 bytes)
- [ ] `ShiftsPage.tsx` (16,889 bytes)
- [ ] `AddTripPage.tsx` (23,354 bytes)

## ✅ موجود في الكود ومؤكد

### Backend والبيانات
- [x] Schema كامل (Driver/Client/Crusher/Contractor/Vehicle/Shift/Trip/Ledger/ClientPayment) + Views: ShiftStats, TripAccounting
- [x] Migration chain كامل حتى v6 (v3 صورة النقلة، v4 هاتف المقاول، v5 stone_price nullable، v6 صورة تقفيل الوردية)
- [x] CRUD كامل لـ Driver/Client/Crusher/Contractor/Vehicle، كل واحد بـ repository + use-case مخصص
- [x] دورة الوردية والنقلة: فتح/قفل/تعديل/مسح، مع منع القفل لو عدد النقلات مش مطابق، وbackup تلقائي عند القفل
- [x] صورة ورقة تقفيل الوردية إجبارية قبل القفل (شرط backend في `closeShift` + تعطيل الزرار في الـ UI)
- [x] صور: إيصال النقلة + ورقة تقفيل الوردية (`photoStorage.ts` kind-based، `ReceiptPhoto.tsx` مشترك)
- [x] Ledger: create + update + delete، مع قفل التعديل/المسح لو الوردية مقفولة
- [x] ClientPayment: create + update + delete (من غير قيد وردية لأنه مالوش shift_id)
- [x] الحسابات: getContractorAccount, getDriverHistory, getClientAccount (مع totalCubic)
- [x] CSV import كامل (PapaParse + validation + transaction + backup)، والملف التاريخي (~450 صف) اتاستورد بنجاح
- [x] preload و IPC متطابقين تمامًا (مفيش دالة يتيمة في أي اتجاه)

### UI
- [x] `DataTable` عام (sorting + multi-select filters + row selection + sum) على: Ledger، الورديات، كل النقلات، الحسابات، الإعدادات
- [x] فورمات الإعدادات الخمس + فتح/تعديل وردية + إضافة/تعديل دفعة عميل: كلها Dialog
- [x] `AddTripPage`: فورم النقلة مكشوف على الصفحة (استثناء متعمد)
- [x] `LedgerEntryForm.tsx` مشترك؛ إضافة حركة من حساب المقاول مع `contractorId` مقفول، ومن سجل السائق مع `driverId` مقفول و`contractorId` مطلوب ومختار يدويًا
- [x] `FloatingWindow` + `FloatingWindowsProvider`، مستخدمة في AllTripsPage وLedgerPage
- [x] زرار "تفاصيل" لكل حركة في LedgerPage (`LedgerEntryDetailsContent`)
- [x] تعديل/مسح حركات Ledger في LedgerPage وContractorAccountPage وDriverHistoryPage
- [x] تعديل/مسح دفعات العميل في ClientAccountPage
- [x] `ImportPage`: رفع CSV + نموذج + ملخص + أخطاء الصفوف
- [x] `space-*` اتشالت بالكامل واتبدلت بـ `gap`، والـ activity log القديم اتشال

## ✅ تم إنجازه

- [x] **دمج Ledger جوه AccountsPage** كقسم رابع "كل الحركات" وإلغاء `/ledger` من الـ navbar (القرار: الحسابات تبقى الـ main)
- [x] **سكرول داخلي للجداول**: ملك للمستخدم. لا يخص أي مهمة Copilot، والـ navbar ثابت من غير أي تعديل.

## ⏳ لسه ماتبدأش (بترتيب التنفيذ المقترح)

1. **صفحات مستقلة للورديات**: `/shifts/open` و`/shifts/close` و`/shifts/:shiftId` + breadcrumb، بدل الـ Dialog والجدول الموسّع
2. CSV export (مفيش حاليًا، فيه بس تنزيل نموذج الاستيراد)
3. توثيق رسمي لعملية الـ migration من الإكسل (خطوات + الحالات الشاذة)

## 🧹 دين تقني (من الجرد)

- [x] `npm run lint` بيفشل: تم توحيد الـ LF via `.gitattributes`، وتم إصلاح الـ 4 errors الحقيقية في الـ renderer. ما زال الـ repo في وضع warnings Prettier CRLF على ملفات قديمة، ولذا الـ warnings متبقية لكن بدون أخطاء.
- [x] `as any` في `LedgerPage.tsx` و`ContractorAccountPage.tsx` و`DriverHistoryPage.tsx` تم إزالتها باستخدام أنواع صريحة من `window.api`
- [x] `ImportPage.tsx` تم استبدال الـ `<Table>` اليدوي بـ `DataTable` مع نفس أعمدة الأخطاء

## ⚠️ محتاج اختبار يدوي حقيقي في نافذة Electron (مسؤوليتك إنت، Copilot مالوش وصول ليها)

- [ ] `DataTable` على بيانات حقيقية: فرز/فلاتر/تحديد/مجاميع في الصفحات اللي اتعممت عليها
- [ ] حفظ فعلي من كل Dialog جديد (فتح وردية، إضافة/تعديل حركة، إضافة/تعديل دفعة، تعديل نقلة)
- [ ] إضافة حركة من حساب المقاول (المقاول مقفول) ومن سجل السائق (السائق مقفول والمقاول مختار يدويًا)، والتأكد من تحديث الرصيد/الجدول فورًا
- [ ] تعديل/مسح حركات Ledger ودفعات العميل، وقفل الحركات المرتبطة بوردية مقفولة
- [ ] صورة إيصال النقلة: رفع/crop/rotate/lightbox/مسح، وقراءتها من disk بعد إعادة تشغيل التطبيق
- [ ] تأثير `space→gap` بصريًا في الصفحات اللي بتستخدم `calendar.tsx` و`card.tsx`

## 💭 قرارات اتناقشت وأُجّلت أو اترفضت عمدًا

- **FloatingWindow كنافذة Electron منفصلة (BrowserWindow)**: مؤجلة. العيوب (state منفصل، IPC لكل تحديث، ذاكرة، lifecycle) أكبر من الفايدة من غير سيناريو حقيقي زي شاشتين.
- **Navbar بيختفي بالسكرول**: مرفوض. الحل هو سكرول داخلي للجداول.
- **Caching للأرقام المحسوبة**: مرفوض. الخطر (أرقام قديمة) أكبر من الفايدة، و`SUM()` وقت الطلب سريع كفاية.
- **Lazy loading / virtualization للجداول**: مؤجل لحد ما نقرب من كام ألف صف تراكمي (~2000 نقلة/سنة، مش مشكلة دلوقتي).

## ملاحظات ثابتة

- `old_shift_no` في CSV للتجميع فقط، مش بيتخزن كـ Shift id
- أسماء السائق/الكسارة/العميل/العربية لازم تكون موجودة قبل أي استيراد CSV
- الورديات المستوردة بتتحفظ "مفتوحة" ليراجعها المستخدم ويقفلها يدويًا
- تكرار `(crusher_id, crusher_receipt_no)` مرفوض بقيد قاعدة البيانات
- `effective_client_cubic` = `client_cubic_reported - discount_qty`
- صاحب السيارة (`ownerName`) مستقل تمامًا عن مقاول النقل (`contractorId`)
- `Ledger` (عهدة/دفعة/اخرى) هو المصدر الوحيد لفلوس المقاول والسائق، مختلف عمدًا عن `ClientPayment` البسيط
- عدم دعم تحديد خلايا فردية بالسحب في `DataTable` مقصود

