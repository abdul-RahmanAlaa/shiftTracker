# Context — تطبيق إدارة ورديات نقل السن

مشروع Offline (Electron + React + SQLite) بيحل محل ملف `إدارة_ورديات_نقل_السن.xlsx` لإدارة الورديات (SH-xxxx) والنقلات (TRP-xxxx). **حجم البيانات الفعلي: ~2000 نقلة/سنة تقريبًا.**

## من هو المستخدم وإزاي يحب يشتغل

- Front-end developer، مش خبير backend.
- بيحب خطوات صغيرة متسلسلة (تسكات)، سؤال واحد بس لما يكون محتاج فعلاً، ومناقشة القرارات الكبيرة قبل ما تتحول لبرومبت.
- بيستخدم **GitHub Copilot (Agent mode)** جوه VS Code لكل الشغل (backend + UI مع بعض)، بيتاخد برومبت مفصّل حاجة واحدة كل مرة.
- **قاعدة تأكيد أساسية**: `typecheck`/`lint` نضاف ≠ الصفحة شغالة فعليًا. لازم اختبار يدوي حقيقي **في نافذة Electron نفسها** (مش في المتصفح بـ mock API — حصل قبل كده إن Copilot اختبر بـ Playwright على `localhost` من غير `window.api` حقيقي، وده لسه معلّق تأكيده الحقيقي).
- عند ظهور مشكلة وقت التشغيل: أول خطوة نص الخطأ من DevTools Console جوه التطبيق، مش تخمين.
- في نهاية كل برومبت لـ Copilot، بيتطلب منه يحدّث `shift-tracker-context.md` و`shift-app-todo.md` بنفسه (تعديل الأجزاء المتأثرة بس، من غير إعادة كتابة كاملة من غير داعي).
- Working conventions: كل prompt اللي بيتكتب لـ Copilot في المشروع لازم يكون بالإنجليزية. المستخدم بيتكلم باللهجة المصرية، لكن أي prompt موجه لـ Copilot لازم يكتب دائمًا بالإنجليزية.

## Workflow: roles and permissions

- Claude (Anthropic) هو الـ backend specialist في المشروع. Claude بيفحص الـ architecture، ويدوّر/يكتب/يراجع كل الـ backend code في `src/main` و`src/preload`، وهو اللي بقرر وقت ومينفع/هيتم تغيّر الـ backend وإزاي.
- Copilot (أنت) هو senior frontend engineer. نطاقك الأساسي هو `src/renderer` — components، pages، forms، styling، client-side logic.
- ممنوع تمامًا إنك تعدّل أي حاجة تحت `src/main` أو `src/preload` من المبادرة الشخصية، حتى لو المهمة بتبان محتاجة كده، ولو كان شيء صغير/تافه. لو المهمة بتحتاج تغيير backend، وقف وارجّعها للمستخدم بدل ما تعدّلها بنفسك — المستخدم هيجيب الـ backend change من Claude بشكل منفصل.
- الاستثناء الوحيد: لو الـ prompt بيشمل تغييرات ملفات backend صراحة (يعني Claude كاتب/موافق بالفعل على الـ backend change المحدد، وده موجود مباشرة داخل الـ prompt اللي عندك)، فإنت تطبق فقط اللي تم تحديده. ده تصريح واضح للمهمة دي فقط، مش إذن دائم — ما يطلعش على مهام لاحقة.
- القسمة دي موجودة لأن Copilot عنده أدوات IDE كاملة (search، multi-file edits، terminal، typecheck/lint) وده بيخليه ممتاز جدًا للتكرار السريع في الـ frontend، لكن تغييرات الـ backend في المشروع (schema، migrations، validation logic، IPC contracts) لازم تمر بمراجعة معماريّة موحّدة لتجنب الانحراف — والراعي دايم هو Claude.

## الـ Stack والـ Architecture

- Electron + electron-vite + React + TypeScript
- better-sqlite3، ملف واحد في `app.getPath('userData')/shift-tracker.db`
- shadcn/ui + Tailwind (classes بـ `gap` مش `space-*`) + react-hook-form + zod
- react-router-dom بـ HashRouter
- `Renderer ↔ IPC (preload) ↔ Main (use-case → repository → SQLite)`
- IPC contract موحّد: `{ ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }`
- ممنوع `any` أبدًا. مصدر واحد بس للـ validation: الـ Main process.

## Architecture: كل الـ lookups بقى ليها backend مخصص

مفيش generic factory مشترك خالص دلوقتي — `simpleLookup.ts` و`simpleLookupRepository.ts` القديمين **اتمسحوا بالكامل**. كل واحد من Driver, Client, Crusher, Contractor, Vehicle عنده `repository/xRepository.ts` + `use-cases/createX.ts` مخصص (create+list+update+delete سوا في نفس الملف). ده الـ pattern الثابت لأي entity جديدة كمان.

## نظام الـ Migration

`db.ts` بيستخدم `pragma('user_version')`. النسخة الحالية: **v6**. أي migration جديدة تتحط في نفس السلسلة: `SCHEMA` كامل (شامل كل الأعمدة) لأي تنصيب جديد (`0 → أحدث نسخة`)، وكل نسخة قديمة بتتصعّد بالتتابع (`1→2→3→4→5→6`، مش تقفز). أمثلة فعلية اتعملت:
- v3: `Trip.receipt_photo_path`
- v4: `TransportContractor.phone` (اختياري)
- v5: `Trip.stone_price` بقى nullable — احتاجت إعادة بناء ذرية لجدول Trip كامل (SQLite مبيدعمش `ALTER COLUMN` لتغيير nullability)، مع الحفاظ على البيانات والفهارس والـ views
- v6: `Shift.closing_photo_path` — صورة ورقة تقفيل الوردية، إجبارية قبل القفل

## Data Model (الحالة الحالية)

```sql
Vehicle(vehicle_no PK, trailer_no NOT NULL, contractor_id NOT NULL, default_cubic REAL NULL, owner_name TEXT NULL)
Driver(id PK, name UNIQUE NOT NULL, phone1 TEXT NULL, phone2 TEXT NULL)
Crusher(id PK, name UNIQUE NOT NULL, initial_price REAL NULL)
Client(id PK, name UNIQUE NOT NULL, initial_price REAL NULL)
TransportContractor(id PK, name UNIQUE NOT NULL, phone TEXT NULL)
Trip(..., stone_price REAL NULL, receipt_photo_path TEXT NULL)  -- stone_price بقى nullable للاستيراد التاريخي
Shift(..., closing_photo_path TEXT NULL)  -- إجباري قبل القفل، شرط backend حقيقي في closeShift
Ledger(id, entry_date, driver_id NULL, movement_type['عهدة'|'دفعة'|'اخرى'], amount, shift_id NULL, contractor_id NOT NULL, notes)
ClientPayment(id, entry_date, client_id, amount, notes)
Views: ShiftStats, TripAccounting  -- effective_client_cubic = client_cubic_reported - discount_qty
```

**قرار مهم يفرّق الـ Ledger عن ClientPayment**: العميل بس بيدفع (علاقة اتجاه واحد، فـ `ClientPayment` بسيط). المقاول/السائق العلاقة أعقد (عهدة سلفة + دفعة تسديد + اخرى)، فمحتاجين `Ledger` بنوع حركة. ده مش هيتغير — الحل لتسهيل الاستخدام هو تسهيل الوصول للـ Ledger من صفحات الحساب، مش دمج المفهومين في بعض.

**قرار متعمد ومهم حول `ClientPayment`**: `ClientPayment` لا يملك `shift_id` في الـ schema فعليًا، ولذلك لا ينطبق عليه أي قيد وردية. التعديل والمسح فيه تم تنفيذه مباشرة في الـ backend (`updateClientPayment` / `deleteClientPayment`) وواجهة المستخدم (`ClientAccountPage`)، بدون أي `disabled` أو تحقق مرتبط بالوردية. ده قرار معماري متعمد لا يغيّر سلوك `Ledger` الذي يحتاج القفل عند الوردية المقفولة.

**قرار صاحب السيارة**: `Vehicle.owner_name` مفهوش أي علاقة بـ `contractor_id`. حقل نصي اختياري بحت، من غير uniqueness.

## preload API

`src/preload/index.ts` و`index.d.ts` مرجعيين ومتزامنين بالكامل — مش هيتكرر تفصيلهم هنا. نقطة لازم نفتكرها: `getClientAccount` بيرجع `payments` (مش `entries` زي `ContractorAccount`). تم تحديث القنوات أيضًا بـ `updateClientPayment` و`deleteClientPayment` للتوافق مع الـ UI، مع الحفاظ على قاعدة: `ClientPayment` لا يملك `shift_id` وبالتالي لا يقيد بالوردية.

## هيكل الملفات الفعلي (بعد آخر مراجعة)

```
src/main/
  db.ts                        — SCHEMA v6 + migration chain كامل
  photoStorage.ts               — معمم (kind-based: trip/shift)، تخزين userData/docs/{kind}s/{id}.jpg
  repository/  — driverRepository, clientRepository, crusherRepository, contractorRepository,
                  vehicleRepository, shiftRepository, tripRepository, ledgerRepository, accountsRepository
  use-cases/   — createDriver/createClient/createCrusher/createContractor (كل واحد create+list+update+delete)،
                  createVehicle، createShift، closeShift، createTrip (+update/delete)، createLedgerEntry،
                  createClientPayment، getAccounts، tripPhoto (save/delete/get)، shiftPhoto (save/delete/get)،
                  csvImport (PapaParse + transaction)

src/preload/  — index.ts + index.d.ts، مكتمل ومتزامن

src/renderer/src/
  App.tsx                       — routes + navbar (الـ navbar ثابت، من غير أي تعديل اختفاء/sticky؛ route `/ledger` حذف، وAccountsPage هو نقطة الدخول الرئيسية)
  components/
    DataTable.tsx                — جدول عام: sorting + multi-select filters بالـ popover + row selection
                                    + sum اختياري + actions column. عن قصد من غير تحديد خلايا فردية بالسحب.
    LedgerEntryForm.tsx           — فورم Ledger مشترك للإضافة، مع قفل اختياري للمقاول أو السائق
    CreateShiftForm.tsx          — shared (createShiftSchema, CreateShiftValues, CreateShiftForm)، بقى Dialog
    ReceiptPhoto.tsx              — مكوّن مشترك لصور النقلة وورقة تقفيل الوردية (رفع/crop/rotate/ضغط/thumbnail/lightbox/delete)
    FloatingWindow.tsx           — نافذة عائمة جوه نفس صفحة React (react-rnd: سحب/تحجيم/تصغير/تكبير/إغلاق)
                                    عبر FloatingWindowsProvider/useFloatingWindows فوق الـ Router في App.tsx.
                                    مستخدمة حاليًا في AllTripsPage/TripDetailsContent، وكمان AllMovementsPage/LedgerEntryDetailsContent.
                                    قرار محسوم: تفضل جوه نفس النافذة، مش BrowserWindow منفصل (اتناقش وتأجل).
    LedgerEntryDetailsContent.tsx — مكوّن read-only لعرض تفاصيل الحركة في FloatingWindow، ويعرض: التاريخ، نوع الحركة،
                                    المبلغ، اسم المقاول، اسم السائق لو موجود، الوردية لو موجودة، والملاحظات.
    ui/
      dialog.tsx                 — Radix @radix-ui/react-dialog
      checkbox.tsx                — Radix @radix-ui/react-checkbox (لـ DataTable)
      (باقي shadcn primitives)
  pages/
    AddTripPage.tsx               — ✅ فورم النقلة فاضل مكشوف على الصفحة (استثناء متعمد من نمط Dialog)
    ShiftsPage.tsx                 — ✅ DataTable للورديات + للنقلات، فتح/تعديل/مسح بـ Dialog، ورفع ورقة التقفيل قبل الإغلاق
                                      ⏳ هيتحول لصفحات مستقلة (/shifts/open, /shifts/close, /shifts/:shiftId) + breadcrumb
    accounts/
      AllMovementsPage.tsx            — ✅ DataTable + Dialog "إضافة حركة" + زرار "تفاصيل" في كل صف يفتح `FloatingWindow` باستخدام `LedgerEntryDetailsContent` في `src/renderer/src/components/`.
                                      Rendered as the fourth section inside AccountsPage under the label "كل الحركات".
      AccountsPage.tsx               — side-menu: مقاول / سائق / عميل / كل الحركات
      ContractorAccountPage.tsx      — ✅ DataTable + Dialog "إضافة حركة" بمقاول مقفول
      DriverHistoryPage.tsx           — ✅ DataTable + Dialog "إضافة حركة" بسائق مقفول ومقاول مطلوب حر
      ClientAccountPage.tsx            — ✅ DataTable + totalCubic + Dialog "إضافة دفعة"
      AccountTables.tsx                 — shared (AccountCard, AccountSummary, LedgerEntriesTable...)
    SettingsPage.tsx + settings/         — ✅ الخمسة كلهم Dialog + RHF + zod
    AllTripsPage.tsx                      — ✅ DataTable + FloatingWindow للتفاصيل
    ImportPage.tsx                         — ✅ رفع CSV + نموذج + ملخص + أخطاء صفوف
```

## أنماط تقنية ثابتة (لازم تتبع بنفس الطريقة في أي تسك جديدة)

**Dialog + zod transform لحقل رقمي اختياري (Input بيرجع string دايمًا)**: الفورم بيفضل شغال بالكامل على input strings (`useForm` من غير الاعتماد على تحويل نوع الـ output عبر الـ resolver في الـ generic)، والتحويل الفعلي من string لـ number/undefined بيحصل يدويًا وقت الـ submit بـ `schema.parse(values)` قبل ما تتبعت للـ `window.api`. (السبب: `FormField` من `react-hook-form` في النسخة المستخدمة مبتمررش نوع الـ output الثالث لـ `control` صح — جرّبنا التحويل جوه الـ resolver مباشرة وطلع type error/white screen).

**ملفات `.d.ts` طويلة**: الأضمن نص الملف كامل عند أكتر من تغيير، أو فروقات "قبل/بعد" واضحة بلوك بلوك — الاستبدال الجزئي المتفرق بيسهل يتلخبط.

## دروس مستفادة

- typecheck/lint نضاف ≠ الصفحة شغالة فعليًا — لازم اختبار يدوي في نافذة Electron الحقيقية
- اختبار Copilot بـ Playwright على المتصفح مش كافي — مفيش `window.api` حقيقي هناك (preload بس بيجي من Electron)
- Copilot ممكن يقع في مشاكل تقنية أثناء "apply patch" (تكرار محتوى بدل استبدال) — بيكتشفها ويصلحها بنفسه من الـ typecheck، سلوك مقبول
- قبل أي ميزة جديدة كبيرة (زي الصور قبل كده)، نناقش القرارات المعمارية الأول (فين تتخزن، جدول منفصل ولا عمود، إلخ) قبل ما نكتب أي كود

## قرارات UX اتناقشت وأُجّلت عمدًا (الجلسة الحالية)

- **Navbar بيختفي بالسكرول**: مرفوض، الـ navbar ثابت من غير أي تعديل. المشكلة الحقيقية كانت إن السكرول بيمشي على الصفحة كلها (body) بدل منطقة الداتا بس — الحل هو سكرول داخلي لكل قسم، مش لمس الـ navbar.
- **سكرول داخلي للجداول (لسه مش مطبق)**: اتعمل قبل كده بس اتلغى بالغلط لما رفضت تعديل تاني، والجرد الأخير أكد إنه مش موجود في الكود. القرار نفسه لسه سليم: الـ navbar ثابت من غير أي تعديل، والسكرول يبقى جوه منطقة الجدول بس مش على الصفحة كلها. المطلوب لما نعيده: `.app-shell`/`.app-main` بارتفاع ثابت (`height: 100vh` + `min-height: 0` + `overflow: hidden`)، وغلاف الجدول في `DataTable.tsx` بـ `flex-1 + overflow-y-auto`، و`thead` بـ `sticky top-0`.
- **FloatingWindow كـ Electron BrowserWindow منفصل فعليًا برّه التطبيق**: اتناقشت بالتفصيل — العيوب (مفيش مشاركة state تلقائية، محتاج IPC صريح لكل تحديث، ذاكرة إضافية لكل نافذة، إدارة lifecycle كاملة، أول ميزة multi-window في المشروع من غير pattern جاهز) أكبر من الفايدة من غير سيناريو استخدام حقيقي (زي الشغل على شاشتين). الوضع الحالي كافي.
- **Caching للأرقام المحسوبة (`balance`, `totalCubic`, إلخ)**: مرفوض. الخطر (تتنسى تتحدث) أكبر من فايدة الأداء على الحجم الحالي (`SUM()` وقت الطلب سريع كفاية).
- **Lazy loading / table virtualization**: مؤجل لحد ما نقرب من كام ألف صف تراكمي (~2000 نقلة/سنة، مش مشكلة دلوقتي).

## استثناءات من الإكسل الأصلي (test cases للـ migration)

- تكرار وصل: TRP-0169 وTRP-0183 (كسارة "النور"، وصل 2927) — ولاحظنا تكرار حقيقي تاني وقت استيراد الملف الفعلي: وصل 6590 بصفين متطابقين جوه SH-0001، اتصحح يدويًا قبل إعادة الرفع
- 3 نقلات بتاريخ بعد نهاية الوردية: TRP-0089, TRP-0090 (SH-0007)، TRP-0296 (SH-0020)
- تكعيب يدوي: TRP-0106، SH-0011 (61.5 بدل 61)
- خصم: TRP-0292 — "خصم 5 متر جودة"

## قرارات تصميم محسومة (ثابتة، ملخص)

- سائق واحد = وردية مفتوحة واحدة بس، أكتر من سائق ممكن يبقى عنده وردية مفتوحة بنفس الوقت
- التكعيب: على مستوى Trip، افتراضي من Shift، قابل للتعديل. الخصم من جانب العميل بس
- تكرار (كسارة+وصل): UNIQUE مانع فعلي. مطابقة عدد النقلات مانعة لقفل الوردية
- تعديل/مسح Trip ممنوع لو الوردية مقفولة
- قفل الوردية ممنوع بدون صورة ورقة تقفيل مرفوعة — شرط backend حقيقي في `closeShift` (مش بس تعطيل زرار في الـ UI)، اتفحص يدويًا وشغال
- حساب السائق = سجل عهدة بس. حساب المقاول والعميل = أرصدة حقيقية
- `old_shift_no` في CSV للتجميع فقط، مش بيتخزن كـ id. الورديات المستوردة بتتحفظ "مفتوحة"

## دين تقني معروف

- ✅ اتصلح: `.gitattributes` بقى `* text=auto eol=lf` (كان `core.autocrlf=true` على Windows بيعارض `endOfLine: lf` بتاع Prettier). `npm run lint` بقى 0 errors و0 warnings بعد آخر تنظيف.
- ✅ اتصلح: الـ`as any` في `AllMovementsPage.tsx` و`ContractorAccountPage.tsx` و`DriverHistoryPage.tsx` اتشالت، بدّلناها بـ `Parameters<typeof window.api.updateLedgerEntry>[0]` / `Parameters<typeof window.api.createLedgerEntry>[0]`.
- ✅ اتصلح: `ImportPage.tsx` بقت بتستخدم `DataTable` بدل الـ`<Table>` اليدوي لأخطاء الاستيراد.
- ⏳ لسه باقي: مفيش CSV export حقيقي، فيه بس تنزيل نموذج الاستيراد.

## آخر جرد شامل للكود
تم جرد كامل للـ backend والـ preload والـ renderer، وبعده اتعمل تنظيف lint/typecheck كامل، ودُمجت Ledger جوه AccountsPage. الحالة الحالية: الـ backend والـ preload متطابقين بدون أي دالة يتيمة، والـ Ledger بقت قسم "كل الحركات" جوه Accounts. اتضاف `LedgerEntryForm.tsx` وزرار "إضافة حركة" لصفحتَي المقاول والسائق مع قفل الشخص المعروض وإعادة تحميل بيانات الصفحة بعد الحفظ. الباقي: السكرول الداخلي (ملك المستخدم، مش تاسك Copilot)، وصفحات الورديات المستقلة، وCSV export.
