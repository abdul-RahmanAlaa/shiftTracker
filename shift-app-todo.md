# TODO — تطبيق إدارة ورديات نقل السن

آخر تحديث: بعد جرد شامل للكود الفعلي (backend + preload + renderer). كل بند ✅ هنا متأكد من الكود، مش من الذاكرة.

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
- [x] `FloatingWindow` + `FloatingWindowsProvider`، مستخدمة في AllTripsPage وLedgerPage
- [x] زرار "تفاصيل" لكل حركة في LedgerPage (`LedgerEntryDetailsContent`)
- [x] تعديل/مسح حركات Ledger في LedgerPage وContractorAccountPage وDriverHistoryPage
- [x] تعديل/مسح دفعات العميل في ClientAccountPage
- [x] `ImportPage`: رفع CSV + نموذج + ملخص + أخطاء الصفوف
- [x] `space-*` اتشالت بالكامل واتبدلت بـ `gap`، والـ activity log القديم اتشال

## ❌ اتلغى بالغلط (رفضت تعديل، ومحتاج يترجع أو يتقرر)

- [ ] **سكرول داخلي للجداول**: الـ shell بارتفاع ثابت، و`DataTable` بـ `overflow-y-auto` و`thead` sticky. الـ navbar ما يتلمسش. (كان متكتب ✅ في التودو القديم بس مش موجود في الكود)
- [ ] **`LedgerEntryForm.tsx`**: مكوّن مشترك لإضافة حركة Ledger. حاليًا كل صفحة من التلاتة فيها فورم inline خاص بيها.
- [ ] **زرار "إضافة حركة" في ContractorAccountPage وDriverHistoryPage**: القرار اللي كان متفق عليه: `contractorId` مقفول في صفحة المقاول، و`driverId` مقفول في صفحة السائق، و`contractorId` يفضل Select حر في صفحة السائق. يتقرر لو لسه محتاجينه بعد دمج Ledger جوه Accounts.

## ⏳ لسه ماتبدأش (بترتيب التنفيذ المقترح)

1. **سكرول داخلي** (تعديل layout أساسي، الأفضل يتظبط الأول)
2. [x] **دمج Ledger جوه AccountsPage** كقسم رابع "كل الحركات" وإلغاء `/ledger` من الـ navbar (القرار: الحسابات تبقى الـ main)
3. **إضافة حركة** جوه صفحات المقاول والسائق (لو لسه محتاجينها بعد الدمج)
4. **صفحات مستقلة للورديات**: `/shifts/open` و`/shifts/close` و`/shifts/:shiftId` + breadcrumb، بدل الـ Dialog والجدول الموسّع
5. CSV export (مفيش حاليًا، فيه بس تنزيل نموذج الاستيراد)
6. توثيق رسمي لعملية الـ migration من الإكسل (خطوات + الحالات الشاذة)

## 🧹 دين تقني (من الجرد)

- [x] `npm run lint` بيفشل: تم توحيد الـ LF via `.gitattributes`، وتم إصلاح الـ 4 errors الحقيقية في الـ renderer. ما زال الـ repo في وضع warnings Prettier CRLF على ملفات قديمة، ولذا الـ warnings متبقية لكن بدون أخطاء.
- [x] `as any` في `LedgerPage.tsx` و`ContractorAccountPage.tsx` و`DriverHistoryPage.tsx` تم إزالتها باستخدام أنواع صريحة من `window.api`
- [x] `ImportPage.tsx` تم استبدال الـ `<Table>` اليدوي بـ `DataTable` مع نفس أعمدة الأخطاء

## ⚠️ محتاج اختبار يدوي حقيقي في نافذة Electron (مسؤوليتك إنت، Copilot مالوش وصول ليها)

- [ ] `DataTable` على بيانات حقيقية: فرز/فلاتر/تحديد/مجاميع في الصفحات اللي اتعممت عليها
- [ ] حفظ فعلي من كل Dialog جديد (فتح وردية، إضافة/تعديل حركة، إضافة/تعديل دفعة، تعديل نقلة)
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

## ✅ تم إنجازه في cleanup الحالي

- [x] ضبط خط النهاية إلى LF عبر `.gitattributes` لتقليل تنبيهات Prettier دون لمس الكود المنطقي
- [x] إزالة كل `as any` من `LedgerPage`, `ContractorAccountPage`, و`DriverHistoryPage` واستبدالها بأنواع صريحة مستقاة من `window.api`
- [x] استبدال جدول أخطاء الاستيراد اليدوي بـ `DataTable` في `ImportPage` مع الاحتفاظ بنفس الأعمدة والسلوك
- [x] دمج محتوى Ledger داخل AccountsPage كقسم رابع "كل الحركات" مع حذف طريق `/ledger` من الـ navbar
- [x] التحقق من `npm run typecheck` — ناجح بدون أخطاء TypeScript
- [x] السكرول الداخلي الآن ملك للمستخدم، ولا يُعد جزءًا من أي مهمة Copilot

## ⏳ ما لسه غير منجز

- [ ] أي تعديل في `src/main` أو `src/preload` لا يُسمح به في هذا النطاق، لأن المهمة Renderer-only فقط
- [ ] smoke test فعلي لـ Electron غير ممكن من هذه البيئة، لأننا لا نستطيع فتح نافذة التطبيق الحقيقية هنا
