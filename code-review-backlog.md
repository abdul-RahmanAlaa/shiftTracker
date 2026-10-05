# Code Review: Shift Tracker

## 1. Snapshot and Status Authority

هذا التقرير أُعدّ على snapshot أقدم من source الحالي. الحالات المكتوبة تحت كل بند أدناه هي المرجع الحالي، وتتقدم على أي ادعاء عن "الحالة الحالية" داخل نص المراجعة الأصلي. نص المشكلات والحلول يحتفظ بملاحظات المراجعة كما وردت؛ لا يُفهم منه أن كل مشكلة ما زالت قائمة.

## 2. Findings B1–B11

### B1. مستحيل تضيف نقلة من الـ UI (وtypecheck بيفشل)

**Original problem text**

- `createTrip` في main بيطلب `materialTypeId`، و`d.ts` والـ preload معلنينه required.
- لكن `tripSchema` في `AddTripPage` مفيهوش الحقل، ومفيش `<FormField>` لاختيار الصنف.
- `ResourceState` مفيهاش `materialTypes`، و`AddTripPage` مبتحمّلهاش أصلًا.
- `ShiftDetailPage` بتستخدم `materialTypes` و`materialTypeId` في 4 أماكن من غير ما تكون معرّفة، وده سبب أخطاء TS الستة.
- النتيجة: الرسالة بتتكتب في الـ trip log بس، لأن `error.field in values` بتفشل، فالمستخدم مش بيشوف خطأ جنب أي حقل.

**Proposed fix**

ضيف `materialTypeId: z.number().int().positive(...)` في `tripSchema`، وحقل Select في `TripForm`، و`materialTypes` في `ResourceState`. حمّلها في `AddTripPage` بـ `listMaterialTypes()`. ضيفها في `defaultValues` وفي reset بتاع التعديل. ضيف عمود "الصنف" في AllTrips وTripDetails (الـ API راجع `materialTypeName` أصلًا). شغّل `npm run typecheck` لحد ما يبقى 0 أخطاء.

**Status:** Fixed, manually verified.

### B2. تعديل عميل أو مقاول من الإعدادات بيمسح الرصيد الافتتاحي والموقع

**Original problem text**

- `ClientsSettings` بتبعت `{id, name, initialPrice}` بس، و`ContractorsSettings` بتبعت `{id, name, phone}`.
- `updateClient` و`updateContractor` بيعملوا `openingBalance ?? 0` و`openingBalanceDate ?? null`، و`updateClient` كمان `location ?? null`. فأي تعديل في الاسم بيصفّر الرصيد.
- وكمان مفيش أي حقل في الـ UI لإدخال الرصيد الافتتاحي أو الموقع. يعني كشف الحساب شغال، بس الـ opening row دايمًا صفر.

**Proposed fix**

فرّق بين `undefined = سيب القيمة` و`null = امسحها`، وفي الـ SQL استخدم `COALESCE(@x, col)` للحقول اللي ماجتش. ضيف حقول `openingBalance` (رقم) و`openingBalanceDate` (DatePicker) و`location` للفورمين، وحمّلهم في `startEditing`. ضيف اختبار: edit بدون الحقول مايغيّرش الرصيد.

**Status:** Fixed in code; manually verified by user. Client and contractor update use cases preserve omitted values.

### B3. صفحتين تفاصيل بتعرض بيانات غلط بسبب مقارنة بقيم عربي قديمة

**Original problem text**

- `TripDetailsContent` بتقارن `crusherReceiptStatus === 'قيمة'` و`'مفيش (متأكد)'`. القيم المخزنة بقت `PROVIDED`/`CONFIRMED_MISSING`، فكل نقلة بتظهر "مش معروف".
- `LedgerEntryDetailsContent` بتقارن `'عهدة'`/`'دفعة'`. النتيجة إن `ADVANCE` و`PAYMENT` بيظهروا "اخرى".
- دي كمان الـ 4 سطور العربي الوحيدة الباقية hardcoded في الـ renderer.
- كمان `recipientNameStatus` بيستخدم label مفتاح `receiptStatuses.value` ("قيمة")، وده خلط دلالي.

**Proposed fix**

اعمل switch على القيم الإنجليزي. اعمل helper واحد `labelForReceiptStatus(t, v)` و`labelForMovementType(t, v)` تستخدمه كل الصفحات.

**Status:** Open. Current `TripDetailsContent` and `LedgerEntryDetailsContent` still compare the stored enums to Arabic strings.

### B4. مفاتيح i18n ناقصة: صفحة أنواع الأصناف بتظهر مفاتيح خام

**Original problem text**

- 8 مفاتيح مستخدمة في الكود وغير موجودة في `ar.json`: `materialTypesSettings.*` (7) و`settingsPage.sections.materialTypes`.
- i18next بيعرض اسم المفتاح نفسه.
- زرار القائمة الجانبية وكل نص في الصفحة هيظهر `materialTypesSettings.addButton` وكده.
- الحل الأصلي كمان لاحظ 6 مفاتيح ميتة تتشال: `addTrip.attachmentsTitle` و`common.notAvailable` و`receiptPhoto.change` و`shifts.checkingAttachments` و`shifts.columns.receiptPhoto` و`shifts.selectDriver`.

**Proposed fix**

ضيف المفاتيح الناقصة. ضيف script (أو اختبار) بيفشل لو في `t('...')` مفتاحه مش في الـ JSON. احذف المفاتيح الستة الميتة المذكورة بعد التحقق من عدم استخدامها.

**Status:** Missing material-type translations are present in the current locale and the page uses them; fixed, manually verified per task status. Remaining work is open: the six listed unused keys remain in `ar.json`, and no missing-key check script/test exists.

### B5. إعادة استخدام id النقلة بتورّث مرفقات نقلة اتمسحت

**Original problem text**

- `deleteTrip` مبيمسحش الـ `Attachment` (مفيش FK من `Attachment` لـ `Trip`)، ولا ملف الصورة.
- `getNextTripId` بيحسب `MAX+1`. لو مسحت آخر نقلة (مثلًا `TRP-0005`)، النقلة الجديدة ياخدوا نفس الـ id.
- سيناريو: النقلة الجديدة تطلع جاهزة بمرفقات النقلة المحذوفة. شرط "كل نقلة لها مستند" في `closeShift` بيعدّي من غير ما حد يرفع مستند فعلي.

**Proposed fix**

في `deleteTrip` امسح الصور والـ rows في transaction واحدة. والأفضل نهائيًا: مفتاح داخلي `INTEGER AUTOINCREMENT` للنقلة، والـ `TRP-xxxx` عمود للعرض. على الأقل استخدم جدول counters أو `sqlite_sequence` عشان الـ id مايتكررش أبدًا.

**Status:** Fixed in code; manually verified by user. `TripIdCounter` issues monotonic IDs. The trip and attachment rows are deleted in one SQLite transaction; photo files are unlinked immediately after that transaction, so filesystem deletion itself is not part of the SQLite transaction.

### B6. addAttachment / getAttachmentPhoto: مفيش تحقق وفيه path traversal

**Original problem text**

1. `getAttachmentPhoto({photoPath})` بياخد path من الـ renderer ويعمل `join(userData, photoPath)`. باث زي `../../../...` بيقرا أي ملف على الجهاز ويرجّعه base64. محتاج XSS عشان يتستغل، بس ده بالظبط "الثقة في الـ renderer" اللي القيد المعماري بيمنعها.
2. بيعمل `insertAttachment` الأول بـ `photoPath: ''`، وبعدين يكتب الملف. لو الكتابة فشلت أو الـ base64 باظ، فضل row بمسار فاضي.
3. `closeShift` بيشوف وجود row من نوع `CLOSING_SHEET` بس. يعني row بملف مفقود بيعدّي الشرط.
4. `entityType` و`kind` غير متحقق منهم runtime. تقدر ترفق `CLOSING_SHEET` على `TRIP`. الـ entity مش بيتأكد إنها موجودة.
5. مفيش حد لحجم الـ base64. ومسموح تضيف أو تمسح مرفقات على وردية مقفولة، وده بيكسر ضمان "المقفول لا يتعدل".

**Proposed fix**

غيّر `getAttachmentPhoto` لـ `{attachmentId}`، وجيب المسار من الـ DB فقط، وتأكد إن `resolve(path)` يبدأ بـ `userData/docs`. تحقق من `entityType` و`kind` بـ zod enum، وتحقق إن الـ entity موجودة وإن kind مناسب للنوع (`TRIP`→receipts، `SHIFT`→`CLOSING_SHEET`). ارفض لو الوردية المرتبطة `CLOSED`. حدد الحجم (مثلًا 5MB) وتأكد من magic bytes الـ JPEG. اعمل الكتابة كده: اكتب الملف أولًا بـ uuid، وبعدين `INSERT` بالمسار الكامل في transaction، ولو فشل امسح الملف. و`closeShift` يتأكد كمان إن الملف موجود فعلًا.

**Status:** Fixed in code; manually verified by user. Current implementation uses the `attachmentId` contract, a 5MB limit, JPEG magic-byte validation, safe attachment paths, entity/kind and entity-existence checks, closed-shift protection, and a file-exists check in `closeShift`. One approved renderer exception is the contract update in `AttachmentManager.tsx`. Note: implementation writes the attachment row before the file and removes the row if the file save fails; it does not use the proposed UUID-first sequence.

### B7. updateLedgerEntry وupdateClientPayment مش بيقدروا "يمسحوا" قيمة

**Original problem text**

- `driverId`: `input.driverId ?? existing.driverId` و`shiftId`: `input.shiftId ?? existing.shiftId` و`notes`: `input.notes ?? existing.notes`.
- لما المستخدم يختار "بدون وردية" أو "بدون سائق" أو يفضّي الملاحظات، الـ renderer بيبعت `undefined`، فالقيمة القديمة بترجع. التعديل بيبان إنه نجح وهو ماحصلش.
- `createClientPayment` و`createLedgerEntry` مبيلقطوش FK error (عميل أو سائق مش موجود)، فبيتعمل throw والـ IPC بيترفض.

**Proposed fix**

الـ update لازم يستبدل الكل (PUT semantics) من غير fallback للقيمة القديمة. وللـ nullable استخدم `null` صريحة في العقد. لقّط FK في الاتنين وارجع errors بالحقل.

**Status:** Fixed in code (PUT semantics for ledger/clientPayment updates; FK errors returned as field errors; finite non-zero amounts allow negatives); not manually tested. `Ledger.contractor_id` remains `NOT NULL` in the current schema, so updates derive it from a selected shift or require it when no shift is selected; clearing that column is not supported without a schema change.

### B8. Migrations: فجوات وخطر فشل

**Original problem text**

اتجرّب على SQLite حقيقي:

- `user_version` من 2 إلى 8، أو أكبر من 11، بيدخل فرع `else` ويطبع "Database up to date" من غير ما يعمل حاجة. لو الملف نسخة 5 هيكمل بـ schema ناقصة وهيفشل بعدين بأخطاء غامضة. ولو الملف أحدث من التطبيق (downgrade) برضه بيكمل وبيكتب فوقه.
- `migrateToV11` مش في transaction، و`user_version = 11` بيتكتب برّا أي transaction. لو الـ process اتقفل بين ALTER وآخر، الملف بيبقى نصه اتعدّل ونسخته لسه 10. مع الفتح اللاحق جربته: `duplicate column name: location`، والتطبيق مش هيفتح أبدًا بعدها.
- مفيش backup قبل الـ migration.
- ملاحظة أمانة: نسخة v9 القديمة اتعملت من معكوس الـ migration نفسه (ما عندي ملف حقيقي)، فده يثبت إن الـ SQL يشتغل على الشكل المتوقع، مش إن ملفاتك الفعلية بالشكل ده بالظبط. جرّب على نسخة من الداتا الحقيقية.

**Proposed fix in the original review**

مصفوفة migrations = `[{version, up(db)}]` مرتبة. loop يطبّق الكل من `current+1` لـ `LATEST` داخل `db.transaction` واحدة، و`user_version` يتكتب جواها. لو `current > LATEST` اعمل throw برسالة واضحة. لو مفيش path من النسخة اعمل throw. خد نسخة من الـ DB قبل أي migration. لف `initDatabase()` في try/catch يعرض `dialog.showErrorBox` ويقفل بدل crash صامت.

**Status:** Resolved by decision, not by the review's migration proposal. Migration chain removed; the app creates a fresh version-2 schema and refuses old database versions. A fresh DB is required. There is no backup before schema initialization; `closeShift` backup runs after closing and without try/catch, tracked separately as an open risk below.

### B9. فشل المسح بيتبلع من غير ولا رسالة (11 مكان) + مفيش معالجة لرفض الـ IPC

**Original problem text**

- كل handler للمسح (Clients/Contractors/Crushers/Drivers/MaterialTypes/Vehicles/Trip/Ledger×3/ClientPayment) بيعمل `if (result.ok) {...}` من غير `else`. لما FK يمنع المسح، main بيرجع رسالة "مستخدم في بيانات تانية"، والمستخدم مش بيشوف حاجة.
- فيه 5 catch بس في كل الـ renderer. أي throw من main بيخلي الـ Promise يترفض. مثلًا `AddTripPage` بيعمل `Promise.all(...).then(...)` من غير catch، فلو أي list فشل `resourceLoading` يفضل true للأبد.

**Proposed fix**

hook أو helper واحد `useApiAction/callApi(fn)` بيحوّل الرفض لـ `{ok:false}` ويعرض toast أو alert بالرسالة. خلّي كل delete يعرض `errors[0].message`. ضيف `ErrorBoundary` على مستوى App.

**Status:** Open. Current renderer still has delete handlers that only act on success and `AddTripPage` still uses a `Promise.all(...).then(...)` without a catch.

### B10. حوارات تعديل الحركة في صفحتي المقاول والسائق نسخة يدوية بتتجاهل القفل

**Original problem text**

- `ContractorAccountPage` و`DriverHistoryPage` بيستخدموا `LedgerEntryForm` المشترك للإضافة، لكن للتعديل بيكرروا ~200 سطر فورم يدوي (تقريبًا نفس بعض).
- النسخة اليدوية مفيهاش `lockedContractorId`/`lockedDriverId`، فتقدر تنقل حركة لمقاول تاني من صفحة المقاول الأول. وفي صفحة السائق تقدر تحفظ من غير مقاول، فيرفض main بعد ما المستخدم ضغط.

**Proposed fix**

استخدم `LedgerEntryForm` للإضافة والتعديل (زي AllMovementsPage بالظبط) ومرّر locked ids. امسح الـ 400 سطر المكررة.

**Status:** Open. Current source still uses `LedgerEntryForm` for create and duplicated manual edit forms in the contractor and driver account pages.

### B11. حاجات أصغر لكنها حقيقية

**Original problem text**

- `DataTable` سطر 321: لما الفلتر يرجّع صفر صفوف بيعرض `emptyMessage` الخام (ممكن `undefined`) بدل `resolvedEmptyMessage`، فالخلية فاضية في AllTrips والحسابات.
- `AccountSummary` بيعرض `{item.value}` من غير format، فممكن تشوف `0.30000000000000004` (اتأكدت من الـ float في SQLite وJS). استخدم نفس `formatNumber` بتاع `StatementsPage`.
- رصيد صفحة "الحسابات" مش بيشمل الرصيد الافتتاحي، لكن "كشف الحساب" بيشمله. نفس العميل هيطلع له رقمين مختلفين في شاشتين (بمجرد ما B2 يتصلح وتدخل رصيد افتتاحي).
- في كشف الحساب، `payments.description` و`notes` بياخدوا نفس قيمة `notes` للعميل، فبتظهر مرتين.

**Proposed fix**

استخدم `resolvedEmptyMessage` في حالة empty rows. نسّق أرقام `AccountSummary` باستخدام `formatNumber`. وحّد احتساب الرصيد الافتتاحي بين صفحة الحسابات وكشف الحساب. امنع تكرار ملاحظة الدفعة بين عمودي الوصف والملاحظات.

**Status:** Open. Current source still renders raw `emptyMessage` in the empty table state and raw `item.value` in `AccountSummary`; no source evidence was found that resolves the other reported discrepancies.

## 3. Risks and Traps

| Risk | Scenario | Proposed fix | Status |
| --- | --- | --- | --- |
| تغيير مقاول السيارة يعيد كتابة التاريخ (contractor snapshot on Shift) | حسابات المقاول بتعمل JOIN مع `Vehicle.contractor_id` الحالي. لو اتغير مقاول سيارة، كل النقلات القديمة، حتى في ورديات مقفولة، تنتقل لحساب المقاول الجديد. في المقابل `Ledger.contractor_id` ثابت وقت الإدخال، فالمحصلة تبقى غير متسقة. | ضيف `Shift.contractor_id` يتثبت وقت فتح الوردية واستخدمه في كل الحسابات، أو امنع تغيير المقاول لو للسيارة ورديات. | Open |
| الفلوس `REAL` (double) | جمع آلاف الصفوف بأسعار عشرية ممكن يطلع كسور زي `0.30000000000000004`، والرصيد النهائي ممكن يطلع `0.00000001` بدل صفر. | خزّن المبالغ بالقرش (`INTEGER`)، أو على الأقل قرّب كل خطوة في `buildStatement` وفي `SUM`. التكعيب ممكن يفضل `REAL`. | Open |
| الرصيد الافتتاحي والتاريخ | صف الافتتاحي بيتثبت أول الجدول، لكن الشحنات قبل `openingBalanceDate` بتتحسب برضه، فتتعد مرتين إذا كان الافتتاحي رصيدًا عند ذلك التاريخ. ومن غير تاريخ قد يظهر الافتتاحي بتاريخ أحدث من حركة أخرى. | قرر: ارفض/تجاهل الحركات قبل تاريخ الافتتاحي وبيّن ده، أو اعتبر الافتتاحي "قبل أي حاجة" وامنع التاريخ. وثّق القاعدة. | Open |
| معنى الإشارة للمقاول | الكود متسق ميكانيكيًا: كل شحنة تزود وكل دفعة تقلل. للعميل الموجب يعني مديون لينا؛ للمقاول الشحنة مستحق للمقاول، فالموجب يعني "إحنا مدينين له". `balanceClassName` يلوّن الموجب أخضر في الاثنين. | قرر اتجاه المقاول صراحة. إما اعكس الإشارة أو غيّر labels والألوان ووثّقها. الأفضل تثبيت sign في use-case وتسمية العمود "مستحق له/عليه". وثّق القاعدة في واجهة كشف حساب المقاول. | Open. StatementsPage has no sign explanation. |
| ترتيب نفس التاريخ | الشحنات تضاف قبل الدفعات و`Array.sort` مستقر، لذلك الشحنة تسبق الدفعة في نفس اليوم حاليًا بالمصادفة؛ المقارنة بـ `localeCompare`. | اعمل ترتيبًا صريحًا `(date, kindOrder, id)` بمقارنة `<` عادية بدل `localeCompare`. | Open |
| مفيش تحقق runtime من النوع/الصيغة في main | `ipcMain.handle(..., (_e, input) => fn(input))` يستقبل `input` غير موثوق. التحقق الحالي يسمح بقيم مثل `"abc"` أو السالب أو `NaN` أو تاريخ `"hello"`، ولا يتحقق من تواريخ النقلات ضمن مدة الوردية أو `endDate >= startDate`. | Zod schema لكل handler في main (shared مع renderer) وparse عند أول سطر. تحقق من تاريخ `YYYY-MM-DD` حقيقي ومن finite/nonnegative للأرقام حسب الحقل. | Open |
| عدم تطابق قواعد الصفر بين UI وmain | UI يسمح بـ0 لبعض المقاسات والأسعار، لكن main يرفض القيمة falsy بـ `!input.stonePrice` برسالة "مطلوب". المستخدم يرى "مطلوب" رغم إدخال 0. | قرر هل 0 مسموح، وضع القاعدة في schema موحد. | Open |
| قفل الوردية مش شامل | مرفقات الوردية المقفولة ممنوعة حاليًا حسب B6، لكن `createLedgerEntry` يقبل `shiftId` لوردية مقفولة بينما التعديل اللاحق ممنوع. لا يوجد use-case لتعديل الوردية أو إعادة فتحها. | قفل موحّد في use-case عبر helper مثل `assertShiftOpen`. أضف `updateShift` للمفتوحة و`reopenShift` بصلاحية/تسجيل. | Closed-shift ledger lock done; reopenShift done (REOPENED status + ShiftReopenLog); updateShift still open. |
| سيارة بورديتين مفتوحتين | الفحص الوحيد المذكور هو "سائق واحد = وردية واحدة"؛ سيارة بسائق مختلف يمكن أن تكون على ورديتين مفتوحتين بالتزامن. | تحقق في `createShift` وأضف partial unique index على `Shift(vehicle_no) WHERE status='OPEN'`، وللسائق أيضًا. | Open |
| `closeShift` ثم `backupDatabase()` | الإغلاق يُكتب ثم يبدأ backup. لو فشل النسخ بسبب القرص أو المجلد، IPC يترفض والواجهة قد لا تتقدم رغم أن الوردية أُغلقت. نسخ مجلد `docs` كل مرة يزيد مساحة النسخ، ولا توجد سياسة تقليم. | اجعل الإغلاق transaction، ونفّذ backup خارجها مع catch يرجع تحذيرًا بدل فشل الإغلاق. انسخ DB فقط أو استخدم نسخ صور تزايديًا، وضع سياسة احتفاظ بآخر N نسخ. | Open. Current code calls backup after closing without try/catch. |
| الصور Base64 عبر IPC | كل صف نقلة في `ShiftDetailPage` ينشئ `AttachmentManager` ويقرأ الصور كـ data URI؛ وردية فيها 40 نقلة قد تسبب عشرات استدعاءات IPC وعشرات MB بالذاكرة. | بروتوكول مخصص مثل `protocol.handle('att', ...)` لخدمة الصور عبر URL أو thumbnails صغيرة. استعلام واحد لعدد/thumbnail لكل نقلة بدل N+1. | Open |
| Race في صفحات الحساب | `ContractorAccountPage` و`DriverHistoryPage` و`ClientAccountPage` فيها awaits من غير إلغاء. التبديل السريع قد يعرض حساب الاسم الأول تحت الاسم الثاني. `StatementsPage` و`AttachmentManager` لديهما إلغاء. | استخدم نمط `cancelled` أو `requestVersion`. | Open |
| حاجات تغليف | `setAppUserModelId('com.electron')` مقابل `appId: com.electron.app`؛ بيانات author/homepage/publish boilerplate؛ `<title>Electron</title>`؛ و`html` بلا `lang/dir`؛ صلاحيات كاميرا/مايك mac غير لازمة. | وحّد appId، واضبط `<html lang="ar" dir="rtl">` والعنوان، ونظف بيانات النشر والصلاحيات. | Open |
| حاجات أمن صغيرة | `sandbox: false`؛ `setWindowOpenHandler` يفتح أي URL عبر `shell.openExternal` دون فحص protocol؛ لا يوجد `will-navigate` guard؛ و`electronAPI` يكشف ipcRenderer عامًا بما يتجاوز عقد `api` المخصص. الـ CSP مضبوط. | فعّل sandbox إذا كان preload لا يحتاج Node؛ اسمح بـ `https:` فقط؛ امنع التنقل؛ أزل electronAPI العام واكتفِ بعقد `api`. | Open |
| فهارس ناقصة | لا توجد indexes على `Trip(shift_id)`, `Trip(client_id)`, `Ledger(contractor_id/driver_id)`, `ClientPayment(client_id)`, و`Shift(status/driver_id)`. أثرها محدود حاليًا لكنه يزيد كلفة الحسابات مع نمو البيانات. | أضف indexes بسيطة في migration جديدة. | Open |

## 4. Technical Debt

كل البنود التالية Open كما في سجل المراجعة، حتى عندما يكون لبعضها تقدم منفصل موثق في ملفات أخرى.

1. **تعريفات مكررة:** نوع input/output معرّف في use-case ثم preload ثم `index.d.ts` (508 سطر)، من غير ربط. `api` في preload لا يستخدم `satisfies Api`، و`invoke` يرجع `Promise<any>` ضمنيًا. المقترح: `src/shared/ipc.ts` يحوي Zod schemas والـ types والـ channel map ويستخدمه main/preload/renderer.
2. **كود مكرر:** `UseCaseResult` منسوخ في 18 ملفًا، و`isSqliteError` في 8، وبلوك UNIQUE→رسالة متكرر نحو 15 مرة. المقترح: `main/lib/result.ts` و`main/lib/sqlite.ts` وhelpers مثل `ok()`/`fail()`.
3. **عدم اتساق repositories:** Driver/Client/Crusher بوسائط positional، وTrip/Ledger/Shift بـ object. `listVehicles` في `listRepository/listData` بدل vehicle repository/use-case، وVehicle الوحيدة المكسورة في نمط CRUD. `createVehicle` يرجع كائنًا ناقصًا و`deleteVehicle` يرجع كائنًا مفبركًا بـ nulls. ملفات `createX.ts` تحتوي list/update/delete. المقترح: object params موحد، ملف `xUseCases.ts`، وشكل واحد لكل entity.
4. **عدم اتساق التحقق بين entities:** Contractor/Driver/MaterialType يتحققون بـ `?.trim()` فقط، بينما Client/Crusher/Vehicle لديهم `validateX`. update/delete لبعض entities لا يتحققان من وجود id (update لمعرف مجهول قد يرجع ok). Vehicle لا يتحقق من `trailerNo` الموجب.
5. **أنواع بتكدّب:** `VehicleRow.trailerNo` nullable رغم أن العمود `NOT NULL` وd.ts يقول number. `ShiftFullRow` ناقصه `startDate/endDate` رغم أن SQL يرجعهما. `TripRow.crusherReceiptStatus` و`LedgerRow.movementType` معرفان `string` بدل union، ما اضطر renderer إلى casts. المقترح: union types من مصدر واحد.
6. **كثرة casts:** 29 cast في صفحات/مكونات renderer، منها 11 `as never`/`as LedgerEntryFormValues`. `NumberField` يستخدم `control as never` و`name as never`. لا يوجد `any` حرفيًا لكن `as never` له أثر مشابه. المقترح: جعل `NumberField` generic باستخدام `FieldPath<T>`.
7. **كود ميت:** `getDriverIdByName`, `getClientIdByName`, `getCrusherIdByName`, `getClientById`, `getContractorById`, `insertImportedShift`, `countAttachments`, `vehicleExists` (بقايا CSV). `papaparse` و`@types/papaparse` dependencies بلا استخدام. View `TripAccounting` معرّف وغير مستخدم. `ipcMain.on('ping')` وتعليقات القالب. `shift:listOpen/listOpenShifts` لا يستدعيها renderer. `@ts-ignore` في preload؛ الأفضل `@ts-expect-error`. Imports مكررة من نفس الملف في `index.ts` (getAccounts)، و`listData.ts`، و`getAccounts.ts`.
8. **منطق حساب مكرر:** `(client_cubic_reported - discount_qty) * client_price` مكتوب في `accountsRepository` و`statementRepository` (مرتين) و`listAllTrips`، مع وجود view `TripAccounting` المقصود أن يكون المصدر. المقترح: استخدام الـ view أو SQL fragment مشترك.
9. **الوثائق قديمة:** `app-context.md` يذكر migration v6، والملفات تذكر ImportPage وimportCsvData وCSV import كامل رغم عدم وجودها تحت `src`. `shift-tracker-context.md` كان يقول `user_version = 1` وSCHEMA v9 بينما source المشار إليه في المراجعة كان v11. ادعاء تطابق preload وIPC صحيح حسب المراجعة. المقترح: مصدر واحد للحقيقة وتوليد `app-file-tree.md` بسكريبت.
10. **أنماط renderer متضاربة:** ثلاث طرق للفورم؛ Client/Crusher يستخدمان string→transform و`{raw:true}` ثم parse يدويًا مرة ثانية، والباقي Zod بأرقام. بلوك loadX/useEffect مكرر في صفحات الإعدادات؛ dialog state مكرر ×6؛ `confirm()` الأصلي ×12؛ أعمدة جديدة كل render فتُحسب `useMemo` في DataTable من جديد ويظهر تحذير TanStack؛ وShiftDetailPage تجلب كل الورديات ثم تعمل find بدل `shift:get`. المقترحات: توحيد الفورم، hooks/components مشتركة، dialogs بدل confirm، تثبيت columns، واستخدام استعلام shift مباشر.
11. **ملاحظات إضافية صغيرة/بنية:**
   - Import دائري: `CreateShiftForm` يستورد `NumberField` من `AddTripPage` والعكس. انقل NumberField إلى `components/`.
   - رسائل Zod تُقيّم عند import عبر `i18n.t(...)` داخل module-level schemas؛ استخدم `z.config` أو `makeSchema(t)`.
   - رسائل main العربية hardcoded بلهجات مختلفة؛ وحّد اللهجة أو أرسل error codes ليترجمها renderer.
   - `common.columns.id` بالإنجليزية؛ `TableBody` عليه `max-h-full overflow-y-scroll` بلا أثر؛ بعض FloatingWindow تستقبل ReactNode ثابتًا وقد تعرض بيانات قديمة؛ وخلفية القالب تستخدم `wavy-lines.svg`.

## 5. Suggested Execution Order

1. B1 (typecheck وإضافة نقلة) وB4 (مفاتيح الترجمة) لأنهما يمنعان الاستخدام الأساسي. حالتهما الحالية وأي متبقي موضحان في Status أعلاه.
2. B2 + B8 لأنهما يتعلقان بسلامة البيانات ومصير قاعدة البيانات.
3. B5 + B6 لسلامة المرفقات وقفل الوردية.
4. B7 + B9 + B3 + B10 + B11 لسلوك الواجهة والتعديلات.
5. بعد ذلك المخاطر حسب الأولوية: contractor snapshot على الوردية، المبالغ بالقرش، تحقق Zod في main، وقرار إشارة المقاول.

## 6. Found while working
Issues discovered during other tasks. Do not fix here; schedule explicitly.
- `src/renderer/src/pages/ShiftDetailPage.tsx:245`: reopen log reason/history has no renderer viewer; severity medium.
- `src/renderer/src/pages/AddTripPage.tsx:229`: Add Trip still fetches only OPEN shifts; the REOPENED-only detail-page add path is fixed in code, not manually tested; severity medium.
- `src/main/use-cases/closeShift.ts:80`: re-closing after adding a trip to a reopened shift now accepts the re-entered reported count and still rejects mismatches; fixed in code, not manually tested; severity high.
- `src/renderer/src/pages/ShiftsPage.tsx:411`: reopened reported-count input allowed fractional steps and lacked a zero minimum; fixed in code, not manually tested; severity medium.
- `src/main/use-cases/closeShift.ts:46`: a CLOSED shift with `reportedTripCount` returned the count-eligibility error instead of the existing already-closed error; fixed in code, not manually tested; severity low.
- `src/renderer/src/pages/ShiftDetailPage.tsx:184,404`: non-trip-field errors from add-trip were dropped instead of shown in the dialog; fixed in code, not manually tested; severity medium.
- `src/main/use-cases/closeShift.ts:95`: backup still runs after the close transaction and can fail after the shift is already persisted as CLOSED; severity medium.
- `src/main/use-cases/getAccounts.ts:34,49`: no account-to-account transfer use case exists; feature idea, low.
- `src/main/db.ts:31,142`: Crusher is an entity, but no crusher/supplier account or supplier-payment table/use case exists; feature gap, low.
- `src/main/use-cases/getStatement.ts:89; src/main/repository/statementRepository.ts:69`: all contractor ledger movement types are subtracted uniformly; negative amounts reverse that effect regardless of ADVANCE/PAYMENT/OTHER; informational sign behavior, low. Signed account sums and table totals preserve negatives; no ABS/positive-amount filters or amount-based ordering were found.
- `src/main/use-cases/createLedgerEntry.ts:124,183-189`: create and update previously allowed some writes involving CLOSED shifts; the closed-shift ledger guard was added in this task; severity high.
