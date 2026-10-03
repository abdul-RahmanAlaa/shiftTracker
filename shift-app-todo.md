# TODO — تطبيق إدارة ورديات نقل السن

آخر تحديث: توحيد loading feedback للفورمات والجداول.

## 🚩 أولوية قصوى: Full i18n migration — إزالة كل النصوص المضمّنة

1. [x] Scope audit (read-only، ضمن التاسك دي)
2. [x] Install and configure i18next + react-i18next (renderer only، ضمن التاسك دي؛ لغة ثابتة `ar` ومن غير language detector)
3. [x] Extract renderer strings into translation files، صفحة/قسم واحد في كل تاسك؛ اكتمل استخراج الملفات المدرجة في القائمة، والـ Arabic regex الباقي في المصدر قيم enum/status ثابتة.
4. [x] Backend enum values اتنقلت للإنجليزية في `db.ts` v9: `Ledger.movement_type` و`Trip.crusher_receipt_status`، بنفس نمط `Trip.recipient_name_status` (v8) و`Shift.status` (v7)

### Renderer extraction checklist (file size, smallest first)

- [x] `LedgerEntryDetailsContent.tsx` (1,276 bytes)
- [x] `date-picker.tsx` (1,737 bytes)
- [x] `AccountsPage.tsx` (2,250 bytes)
- [x] `AllTripsPage.tsx` (2,357 bytes)
- [x] `SettingsPage.tsx` (2,441 bytes)
- [x] `TripDetailsContent.tsx` (3,051 bytes)
- [x] `App.tsx` (3,108 bytes)
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
- [x] `AllMovementsPage.tsx` (9,538 bytes)
- [x] `ReceiptPhoto.tsx` (11,872 bytes)
- [x] `VehiclesSettings.tsx` (12,430 bytes)
- [x] `DataTable.tsx` (13,219 bytes)
- [x] `DriverHistoryPage.tsx` (16,261 bytes)
- [x] `ContractorAccountPage.tsx` (16,627 bytes)
- [x] `ShiftsPage.tsx` (16,889 bytes)
- [x] `AddTripPage.tsx` (23,354 bytes)

## ✅ موجود في الكود ومؤكد

### Backend والبيانات
- [x] Schema v11 يشمل Attachment وMaterialType وحقول الرصيد الافتتاحي ومكان العميل و`Trip.material_type_id`، بالإضافة إلى الكيانات والحسابات والـ Views الحالية
- [x] قاعدة البيانات الحالية على `user_version = 11`؛ راجع `shift-tracker-context.md` لملاحظة فجوة migrations المعروفة بين الإصدارات 2 و8
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
- [x] فورمات الإعدادات الستة + فتح/تعديل وردية + إضافة/تعديل دفعة عميل: كلها Dialog
- [x] إعدادات `MaterialType`: CRUD عبر Dialog بنفس نمط إعدادات الكيانات الأخرى
- [x] حقول `location` / `openingBalance` / `openingBalanceDate` في إعدادات `Client`، وحقلا الرصيد الافتتاحي وتاريخه في إعدادات `Contractor`
- [x] حقل `materialTypeId` مطلوب في فورم إضافة/تعديل النقلة (`AddTripPage.tsx` و`ShiftDetailPage.tsx`)
- [x] `AddTripPage`: فورم النقلة مكشوف على الصفحة (استثناء متعمد)
- [x] `LedgerEntryForm.tsx` مشترك؛ إضافة حركة من حساب المقاول مع `contractorId` مقفول، ومن سجل السائق مع `driverId` مقفول و`contractorId` مطلوب ومختار يدويًا
- [x] `FloatingWindow` + `FloatingWindowsProvider`، مستخدمة في AllTripsPage وLedgerPage
- [x] زرار "تفاصيل" لكل حركة في LedgerPage (`LedgerEntryDetailsContent`)
- [x] تعديل/مسح حركات Ledger في LedgerPage وContractorAccountPage وDriverHistoryPage
- [x] تعديل/مسح دفعات العميل في ClientAccountPage
- [x] `ImportPage`: رفع CSV + نموذج + ملخص + أخطاء الصفوف
- [x] `space-*` اتشالت بالكامل واتبدلت بـ `gap`، والـ activity log القديم اتشال

## ✅ تم إنجازه

- [x] **قائمة وتفاصيل الورديات**: `/shifts` قائمة وDialogs للفتح والقفل، و`/shifts/:shiftId` فقط صفحة تفاصيل ونقلات. اختيار السائق حقل عادي داخل `CreateShiftForm`؛ ده نمط list→detail للكيانات المستقبلية.
- [x] **Loading feedback**: submit buttons تستخدم `formState.isSubmitting` مع spinner وتعطيل الإغلاق أثناء الحفظ؛ `DataTable` يستخدم `loading` لعرض Skeleton rows مع بقاء headers ظاهرة.
- [x] **دمج Ledger جوه AccountsPage** كقسم رابع "كل الحركات" وإلغاء `/ledger` من الـ navbar (القرار: الحسابات تبقى الـ main)
- [x] **سكرول داخلي للجداول**: ملك للمستخدم. لا يخص أي مهمة Copilot، والـ navbar ثابت من غير أي تعديل.

## ⏳ لسه ماتبدأش (بترتيب التنفيذ المقترح)

1. [ ] إعادة تسمية `AccountsPage` من "الحسابات" إلى "النقدية" أو "الخزينة": هذا فعلاً ليس صفحة حسابات حقيقية، بل سجل حركات نقدية/ميزان، والقرار ما اتنفذش لحد الآن.
2. [ ] المتبقي من statement feature في الـ renderer:
   - [ ] صفحة جديدة "كشف حساب" (client + contractor فقط، وdriver/crusher خارج النطاق حسب قرار المستخدم) تعرض جدول الرصيد المتدرج: صف الافتتاح، صفوف الخصوم/المصروفات، صفوف الدفع/الدفعيات، عمود الرصيد التراكمي.
3. [ ] `CSV export` (مفيش حاليًا، فيه بس تنزيل نموذج الاستيراد)
4. [ ] توثيق رسمي لعملية الـ migration من الإكسل (خطوات + الحالات الشاذة)

### ملاحظة حالة الـ statement في هذا snapshot

Backend `MaterialType` وstatement موجودان في المصدر مع IPC/preload APIs. المنجز في renderer هو CRUD إعدادات `MaterialType`، حقول العميل/المقاول الافتتاحية، وحقل نوع الصنف الإلزامي في إضافة/تعديل النقلة. صفحة "كشف حساب" نفسها ما زالت pending.

- Support more than one receipt photo per trip (currently one: `Trip.receipt_photo_path`). Real use case surfaced during manual testing: a trip can have a separate crusher receipt photo and a separate client receipt photo — right now only one slot exists. When we get to this: needs a backend decision first (either a second nullable path column on `Trip` for a second fixed slot, or a proper `Attachment` table with `trip_id` + `kind` if we might need more than two eventually) — this is a Claude/backend task, not something to implement on your own initiative. Not urgent, not scheduled yet.

## ❌ pending/undecided (ما تم حله ولا يتم التعامل معه كـ resolved)

- [ ] `LedgerEntryForm.tsx` — "اتلغى بالغلط" ما زال pending/undecided ولا يتم اعتبارنا أنه تم تنفيذ شيء فيه في هذا التحديث.
- [ ] أزرار "إضافة حركة" على `ContractorAccountPage` و`DriverHistoryPage` — لا يترتب عليها حل ولا إغلاق، وما زالت فكرة غير مقرّرة في هذا السياق.

## ⏳ ملاحظات التنفيذ التفاعلي / التوثيق

- [ ] إذا وصلت المشروع لأول نسخة shipped حقيقية، سيتم مسح سلسلة الـ migration بالكامل وبدء `v1` clean baseline بدل استمرار الـ historical migration experimental الحالي.
- [ ] في الـ backend الرمز الحالي، `Attachment` يحل محل حقلَي `Trip.receipt_photo_path` و`Shift.closing_photo_path`؛ APIs statement موجودة، بينما صفحة كشف الحساب في renderer لم تُنفذ بعد.

## 🧹 دين تقني (من الجرد)

- [x] `npm run lint` بيفشل: تم توحيد الـ LF via `.gitattributes`، وتم إصلاح الـ 4 errors الحقيقية في الـ renderer. ما زال الـ repo في وضع warnings Prettier CRLF على ملفات قديمة، ولذا الـ warnings متبقية لكن بدون أخطاء.
- [x] `as any` في `LedgerPage.tsx` و`ContractorAccountPage.tsx` و`DriverHistoryPage.tsx` تم إزالتها باستخدام أنواع صريحة من `window.api`
- [x] `ImportPage.tsx` تم استبدال الـ `<Table>` اليدوي بـ `DataTable` مع نفس أعمدة الأخطاء

## ⚠️ محتاج اختبار يدوي حقيقي في نافذة Electron (مسؤوليتك إنت، Copilot مالوش وصول ليها)

- [ ] إرسال أي فورم إعدادات يعطّل زر submit ويظهر spinner مؤقتًا.
- [ ] فتح صفحة فيها جدول يظهر skeleton rows قبل البيانات؛ قد يكون التحميل سريعًا جدًا محليًا مع SQLite.
- [ ] التأكد من عدم وجود layout jump/shift عند استبدال skeleton rows بالبيانات.
- [ ] Dialog فتح الوردية: السائق والسيارة وباقي الحقول ظاهرين معًا؛ الإنشاء يقفل Dialog ويحدث القائمة
- [ ] Dialog قفل الوردية: الصورة إلزامية؛ النجاح يقفل Dialog ويحدث القائمة
- [ ] النقر على صف وردية يفتح `/shifts/:shiftId` بتفاصيلها ونقلاتها؛ جرّب تعديل/مسح نقلة
- [ ] Breadcrumb صفحة التفاصيل يرجع إلى `/shifts`
- [ ] تجربة إنشاء وردية من `AddTripPage` والتحقق أن السائق المحدد مسبقًا موجود بحقل `CreateShiftForm`
- [ ] `DataTable` على بيانات حقيقية: فرز/فلاتر/تحديد/مجاميع في الصفحات اللي اتعممت عليها
- [ ] حفظ فعلي من كل Dialog جديد (فتح وردية، إضافة/تعديل حركة، إضافة/تعديل دفعة، تعديل نقلة)
- [ ] إضافة حركة من حساب المقاول (المقاول مقفول) ومن سجل السائق (السائق مقفول والمقاول مختار يدويًا)، والتأكد من تحديث الرصيد/الجدول فورًا
- [ ] تعديل/مسح حركات Ledger ودفعات العميل، وقفل الحركات المرتبطة بوردية مقفولة
- [ ] صورة إيصال النقلة: رفع/crop/rotate/lightbox/مسح، وقراءتها من disk بعد إعادة تشغيل التطبيق
- [ ] تأثير `space→gap` بصريًا في الصفحات اللي بتستخدم `calendar.tsx` و`card.tsx`

## 💭 قرارات اتناقشت وأُجّلت أو اترفضت عمدًا

- **Navbar بيختفي بالسكرول**: مرفوض. الحل هو سكرول داخلي للجداول.
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

