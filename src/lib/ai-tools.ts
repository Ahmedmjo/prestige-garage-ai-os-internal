/**
 * 🤖 Prestige AI Assistant — Tools Layer (Function Calling)
 * ═══════════════════════════════════════════════════════════════
 * هذا الملف هو "الجسر" بين الذكاء الاصطناعي (Llama) وقاعدة البيانات الحقيقية.
 * كل دالة هنا تكتب مباشرة في نفس الجداول والمنطق المستخدم في الـ API الحالي
 * (services, employees, stock, rolls) — لا توجد أي إضافات منفصلة أو بيانات وهمية.
 *
 * مبدأ التصميم: الذكاء الاصطناعي لا يُنفّذ الكتابة مباشرة أبداً.
 * هو فقط "يقترح" استدعاء أداة (tool call) → نبني ملخص عربي واضح →
 * ننتظر تأكيد المستخدم → عندها فقط تُنفَّذ executeTool() الفعلية.
 * هذا يمنع أي كتابة خاطئة في البيانات المالية.
 */
import { db } from '@/lib/db'
import { unifyServiceType } from '@/lib/i18n'
import { generateServiceCode } from '@/lib/service-codes'
import { normalizeStockName, generateStockCode, recalcStockStatus, manageStockAlerts, findStockItem } from '@/lib/stock-utils'

// ─────────────────────────────────────────────────────────────
// 1) تعريفات الأدوات بصيغة OpenAI-compatible (تدعمها Groq و OpenRouter)
// ─────────────────────────────────────────────────────────────
export const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_service',
      description: 'تسجيل خدمة جديدة (بوليش/نانو/ديتيلنج/عزل حراري/بروتيكشن) في سجل الخدمات الرئيسي. يُنشئ عمولة تلقائية للفني إذا طُلب ذلك.',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'اسم العميل' },
          carType: { type: 'string', description: 'نوع السيارة' },
          plate: { type: 'string', description: 'رقم اللوحة (اختياري)' },
          serviceType: { type: 'string', description: 'نوع الخدمة مثل بوليش، نانو سيراميك، ديتيلنج، عزل حراري، بروتيكشن' },
          price: { type: 'number', description: 'سعر الخدمة بالجنيه' },
          technician: { type: 'string', description: 'اسم الفني المنفّذ (اختياري)' },
          commissionAmount: { type: 'number', description: 'مبلغ عمولة الفني إن وُجد (اختياري)' },
          paymentMethod: { type: 'string', description: 'طريقة الدفع: نقدي/فيزا/تحويل (اختياري)' },
          date: { type: 'string', description: 'تاريخ الخدمة بصيغة YYYY-MM-DD (اختياري، افتراضياً اليوم)' },
          notes: { type: 'string', description: 'ملاحظات إضافية (اختياري)' },
        },
        required: ['serviceType', 'price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_employee',
      description: 'إضافة موظف جديد بمرتبه الأساسي الثابت إلى جدول الموظفين.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'اسم الموظف' },
          baseSalary: { type: 'number', description: 'المرتب الأساسي الثابت الشهري' },
          jobTitle: { type: 'string', description: 'المسمى الوظيفي (اختياري)' },
          phone: { type: 'string', description: 'رقم الهاتف (اختياري)' },
          hireDate: { type: 'string', description: 'تاريخ التعيين YYYY-MM-DD (اختياري)' },
          notes: { type: 'string', description: 'ملاحظات (اختياري)' },
        },
        required: ['name', 'baseSalary'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_attendance',
      description: 'تسجيل حضور أو غياب أو إجازة لموظف واحد في تاريخ معين.',
      parameters: {
        type: 'object',
        properties: {
          employeeName: { type: 'string', description: 'اسم الموظف' },
          date: { type: 'string', description: 'التاريخ YYYY-MM-DD' },
          status: { type: 'string', enum: ['ح', 'غ', 'إ', 'ر'], description: 'ح=حضور، غ=غياب، إ=إجازة رسمية، ر=إجازة أسبوعية' },
          notes: { type: 'string', description: 'ملاحظات (اختياري)' },
        },
        required: ['employeeName', 'date', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'batch_attendance',
      description: 'تسجيل حضور/غياب لكل الموظفين النشطين في يوم واحد دفعة واحدة. استخدمها عندما يطلب المستخدم تسجيل الجميع (مثل "سجل حضور كل الموظفين اليوم" أو "الكل حضور ما عدا فلان غياب"). الاستثناءات بصيغة map بسيط: {اسم الموظف: حالته}.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'التاريخ YYYY-MM-DD' },
          defaultStatus: { type: 'string', enum: ['ح', 'غ', 'إ', 'ر'], description: 'الحالة الافتراضية لكل الموظفين (ح=حضور، غ=غياب، إ=إجازة، ر=راحة أسبوعية)' },
          exceptions: {
            type: 'object',
            description: 'استثناءات بصيطة {اسم_الموظف: حالته}. مثال: {"أحمد السيد": "غ"}. اتركها فارغة {} إذا لم توجد.',
            additionalProperties: { type: 'string', enum: ['ح', 'غ', 'إ', 'ر'] },
          },
        },
        required: ['date', 'defaultStatus'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_advance',
      description: 'تسجيل سلفة مالية لموظف — تُخصم من صافي مرتبه.',
      parameters: {
        type: 'object',
        properties: {
          employeeName: { type: 'string', description: 'اسم الموظف' },
          amount: { type: 'number', description: 'مبلغ السلفة' },
          date: { type: 'string', description: 'التاريخ YYYY-MM-DD (اختياري، افتراضياً اليوم)' },
          notes: { type: 'string', description: 'ملاحظات (اختياري)' },
        },
        required: ['employeeName', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_penalty',
      description: 'تسجيل جزاء/خصم على موظف — يُخصم من صافي مرتبه.',
      parameters: {
        type: 'object',
        properties: {
          employeeName: { type: 'string', description: 'اسم الموظف' },
          amount: { type: 'number', description: 'مبلغ الجزاء' },
          reason: { type: 'string', description: 'سبب الجزاء' },
          date: { type: 'string', description: 'التاريخ YYYY-MM-DD (اختياري، افتراضياً اليوم)' },
        },
        required: ['employeeName', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_stock_item',
      description: 'إضافة صنف خامة جديد غير موجود مسبقاً في المخزون (بوليش/ديتيلنج/نانو/أدوات).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'اسم الخامة بالضبط' },
          category: { type: 'string', enum: ['detailing', 'polish', 'nano', 'tools'], description: 'فئة الخامة' },
          unit: { type: 'string', description: 'وحدة القياس: ml، pack، unit، liter' },
          currentQty: { type: 'number', description: 'الكمية الافتتاحية الحالية' },
          minLevel: { type: 'number', description: 'الحد الأدنى للتنبيه' },
          unitPrice: { type: 'number', description: 'سعر الوحدة' },
        },
        required: ['name', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stock_movement',
      description: 'تسجيل استلام أو سحب كمية من خامة موجودة بالفعل في المخزون. يُفضّل تمرير itemCode (من snapshot الخامات) لضمان الربط الصحيح. إن لم يُعرف الكود، مرّر itemName كما هو مسجل بالضبط. ابحث دائماً في snapshot الخامات قبل إنشاء صنف جديد.',
      parameters: {
        type: 'object',
        properties: {
          itemCode: { type: 'string', description: 'كود الخامة (مثل STL-001) — مُفضّل لضمان الربط الصحيح. من snapshot الخامات.' },
          itemName: { type: 'string', description: 'اسم الخامة كما هو مسجل في جدول المخزون (يُستخدم إن لم يُعرف الكود)' },
          movementType: { type: 'string', enum: ['استلام', 'سحب'], description: 'نوع الحركة' },
          quantity: { type: 'number', description: 'الكمية' },
          unitPrice: { type: 'number', description: 'سعر الوحدة (اختياري، يستخدم السعر المسجل إن لم يُذكر)' },
          notes: { type: 'string', description: 'ملاحظات (اختياري)' },
          deliveryNote: { type: 'string', description: 'رقم إذن التسليم (اختياري)' },
        },
        required: ['movementType', 'quantity'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_roll',
      description: 'إضافة رول جديد (PPF أو عزل حراري) إلى جدول الرولات.',
      parameters: {
        type: 'object',
        properties: {
          brand: { type: 'string', description: 'الماركة مثل Hexis, 3M Scotchgard, SunTek' },
          type: { type: 'string', description: 'النوع' },
          model: { type: 'string', description: 'الموديل (اختياري)' },
          width: { type: 'number', description: 'العرض بالسم (اختياري)' },
          totalLength: { type: 'number', description: 'الطول الكلي بالمتر' },
          price: { type: 'number', description: 'سعر الرول' },
          supplier: { type: 'string', description: 'المورد مثل البنا أو محسن (اختياري)' },
          rollCategory: { type: 'string', enum: ['ppf', 'thermal_long', 'thermal_short'], description: 'فئة الرول' },
          purchaseDate: { type: 'string', description: 'تاريخ الشراء YYYY-MM-DD (اختياري)' },
        },
        required: ['brand', 'type', 'totalLength', 'rollCategory'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'roll_consumption',
      description: 'تسجيل استهلاك (سحب) من رول موجود بالفعل بالكود، لسيارة عميل. يخصم تلقائياً من الرصيد المتبقي للرول. يدعم البحث الجزئي للأكواد: لو مرّرت كود ناقص مثل "HXS" سيبحث عن أقرب رول مطابق. يدعم رقم أمر الشغل (OB) ونوع الحركة.',
      parameters: {
        type: 'object',
        properties: {
          rollCode: { type: 'string', description: 'كود الرول بالضبط أو جزء منه (مثل HXS-BF-001 أو فقط HXS). لو متعدد، سيطلب التوضيح.' },
          metersUsed: { type: 'number', description: 'الأمتار المستخدمة' },
          waste: { type: 'number', description: 'الهدر بالمتر (اختياري)' },
          clientName: { type: 'string', description: 'اسم العميل (اختياري)' },
          carType: { type: 'string', description: 'نوع السيارة (اختياري)' },
          plateNumber: { type: 'string', description: 'رقم اللوحة (اختياري)' },
          usageArea: { type: 'string', description: 'جهة الاستخدام في السيارة (اختياري، مثل Front Fender)' },
          workOrder: { type: 'string', description: 'رقم أمر الشغل (OB) مثل OB-0020 (اختياري)' },
          technician: { type: 'string', description: 'اسم الفني (اختياري)' },
          notes: { type: 'string', description: 'ملاحظات (اختياري)' },
          transactionType: { type: 'string', description: 'نوع الحركة (اختياري، افتراضياً "استهلاك")' },
        },
        required: ['rollCode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'batch_waste',
      description: 'تسجيل هالك (بواقي/هدر) لعدة رولات دفعة واحدة. استخدم هذه الأداة عندما يطلب المستخدم "سجل هالك لكل الرولات أقل من X متر" أو "سجل البواقي". كل عنصر في المصفوفة يمثل رول واحد بقيمة الهالك الخاصة به. يخصم من رصيد كل رول تلقائياً.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'قائمة الرولات وقيم الهالك لكل رول',
            items: {
              type: 'object',
              properties: {
                rollCode: { type: 'string', description: 'كود الرول' },
                waste: { type: 'number', description: 'قيمة الهالك بالمتر' },
              },
              required: ['rollCode', 'waste'],
            },
          },
          workOrder: { type: 'string', description: 'رقم أمر الشغل (OB) واحد لكل الرولات (اختياري — استخدمه لو عاوز نفس OB للكل)' },
          startWorkOrder: { type: 'string', description: 'رقم أمر الشغل الأول (OB-XXXX) — كل رول ياخد OB مستقل متسلسل: الأول startWorkOrder، التاني اللي بعده، إلخ. استخدمه لما المستخدم يقول "كل رول OB مستقل" أو "كل رول بعملية منفصلة".' },
          notes: { type: 'string', description: 'ملاحظات عامة (اختياري)' },
        },
        required: ['items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_customer',
      description: 'إضافة عميل جديد بشكل مستقل إلى قاعدة العملاء (بدون خدمة مرتبطة به الآن).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'اسم العميل' },
          phone: { type: 'string', description: 'رقم الهاتف (اختياري)' },
          address: { type: 'string', description: 'العنوان (اختياري)' },
          notes: { type: 'string', description: 'ملاحظات (اختياري)' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_supplier',
      description: 'إضافة مورد جديد (لرولات PPF أو خامات).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'اسم المورد' },
          phone: { type: 'string', description: 'رقم الهاتف (اختياري)' },
          notes: { type: 'string', description: 'ملاحظات (اختياري)' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_offer',
      description: 'إضافة عرض ترويجي جديد بخصم على خدمة معينة أو كل الخدمات، بفترة زمنية محددة.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'عنوان العرض' },
          discountType: { type: 'string', enum: ['percentage', 'fixed'], description: 'نوع الخصم: نسبة أو مبلغ ثابت' },
          discountValue: { type: 'number', description: 'قيمة الخصم' },
          serviceType: { type: 'string', description: 'نوع الخدمة المشمولة بالعرض (اختياري، فارغ = كل الخدمات)' },
          startDate: { type: 'string', description: 'تاريخ بداية العرض YYYY-MM-DD' },
          endDate: { type: 'string', description: 'تاريخ نهاية العرض YYYY-MM-DD' },
          notes: { type: 'string', description: 'ملاحظات (اختياري)' },
        },
        required: ['title', 'discountValue', 'startDate', 'endDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_service',
      description: 'حذف خدمة من سجل الخدمات. مرّر serviceCode (مثل DET001) أو serviceId. سيتم حذف العمولة المرتبطة إن وُجدت.',
      parameters: {
        type: 'object',
        properties: {
          serviceCode: { type: 'string', description: 'كود الخدمة (مثل DET001, THF001)' },
          serviceId: { type: 'string', description: 'معرّف الخدمة (اختياري إن لم يُعرف الكود)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_stock_item',
      description: 'حذف خامة من المخزون. مرّر itemCode (مثل STL-001) أو itemId. احذر: سيتم حذف الخامة وحركاتها.',
      parameters: {
        type: 'object',
        properties: {
          itemCode: { type: 'string', description: 'كود الخامة (مثل STL-001)' },
          itemId: { type: 'string', description: 'معرّف الخامة (اختياري)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_stock_invoice',
      description: 'تسجيل فاتورة شراء خامات (بعدة بنود) للمورد — للحصر المالي. تنشئ الفاتورة + بنودها + حركات الاستلام تلقائياً في transaction واحد. استخدمها عندما يذكر المستخدم "فاتورة خامات" أو "فاتورة شراء" أو تعدد بنود الشراء.',
      parameters: {
        type: 'object',
        properties: {
          supplierName: { type: 'string', description: 'اسم المورد (اختياري)' },
          invoiceDate: { type: 'string', description: 'تاريخ الفاتورة YYYY-MM-DD (اختياري، افتراضياً اليوم)' },
          discount: { type: 'number', description: 'الخصم بالإجمالي (اختياري)' },
          notes: { type: 'string', description: 'ملاحظات (اختياري)' },
          items: {
            type: 'array',
            description: 'بنود الفاتورة — كل بند: خامة + كمية + سعر وحدة',
            items: {
              type: 'object',
              properties: {
                itemCode: { type: 'string', description: 'كود الخامة (مثل STL-001) — مُفضّل إن وُجد في snapshot' },
                itemName: { type: 'string', description: 'اسم الخامة (يُستخدم إن لم يُعرف الكود، أو لإنشاء صنف جديد)' },
                quantity: { type: 'number', description: 'الكمية' },
                unitPrice: { type: 'number', description: 'سعر الوحدة' },
                notes: { type: 'string', description: 'ملاحظات (اختياري)' },
              },
              required: ['itemName', 'quantity', 'unitPrice'],
            },
          },
        },
        required: ['items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pay_salary',
      description: 'صرف مرتب موظف فعلياً لشهر معين (عملية مالية نهائية تُسجَّل في سجل المرتبات ولا تُنفَّذ إلا بتأكيد صريح من المستخدم). استخدمها فقط لو طلب المستخدم صراحة "اصرف"/"ادفع" مرتب موظف — أما مجرد السؤال عن قيمة المرتب فهو استعلام عادي بدون استدعاء أي أداة.',
      parameters: {
        type: 'object',
        properties: {
          employeeName: { type: 'string', description: 'اسم الموظف' },
          amount: { type: 'number', description: 'صافي المبلغ المطلوب صرفه — احسبه من بيانات القسم (المرتب الثابت + العمولات - السلفيات - الجزاءات) لنفس الشهر' },
          month: { type: 'number', description: 'رقم الشهر 1-12 (اختياري، افتراضياً الشهر الحالي)' },
          year: { type: 'number', description: 'السنة (اختياري، افتراضياً السنة الحالية)' },
        },
        required: ['employeeName', 'amount'],
      },
    },
  },
] as const

export type ToolName = typeof AI_TOOLS[number]['function']['name']

// ─────────────────────────────────────────────────────────────
// 2) ملخصات عربية واضحة قبل التنفيذ (تُعرض للمستخدم للتأكيد)
// ─────────────────────────────────────────────────────────────
export function summarizeToolCall(name: string, args: any): string {
  const num = (n: any) => Number(n || 0).toLocaleString('en-US')
  switch (name) {
    case 'create_service':
      return `📝 تسجيل خدمة جديدة:\n• النوع: ${args.serviceType}\n• السعر: ${num(args.price)} ج.م\n${args.clientName ? `• العميل: ${args.clientName}\n` : ''}${args.carType ? `• السيارة: ${args.carType}\n` : ''}${args.technician ? `• الفني: ${args.technician}\n` : ''}${args.commissionAmount ? `• عمولة الفني: ${num(args.commissionAmount)} ج.م\n` : ''}هل أؤكد التسجيل؟`
    case 'add_employee':
      return `👷 إضافة موظف جديد:\n• الاسم: ${args.name}\n• المرتب الأساسي: ${num(args.baseSalary)} ج.م\n${args.jobTitle ? `• الوظيفة: ${args.jobTitle}\n` : ''}هل أؤكد الإضافة؟`
    case 'record_attendance': {
      const map: any = { 'ح': 'حضور', 'غ': 'غياب', 'إ': 'إجازة رسمية', 'ر': 'إجازة أسبوعية' }
      return `📅 تسجيل حضور:\n• الموظف: ${args.employeeName}\n• التاريخ: ${args.date}\n• الحالة: ${map[args.status] || args.status}\nهل أؤكد؟`
    }
    case 'batch_attendance': {
      const map: any = { 'ح': 'حضور', 'غ': 'غياب', 'إ': 'إجازة رسمية', 'ر': 'إجازة أسبوعية' }
      const excs = args.exceptions && typeof args.exceptions === 'object' ? args.exceptions : {}
      const excNames = Object.keys(excs)
      let excText = ''
      if (excNames.length > 0) {
        excText = '\n• الاستثناءات:\n' + excNames.map(name => `   - ${name}: ${map[excs[name]] || excs[name]}`).join('\n')
      }
      return `📅 تسجيل حضور جماعي:\n• التاريخ: ${args.date}\n• الحالة الافتراضية للجميع: ${map[args.defaultStatus] || args.defaultStatus}${excText}\nهل أؤكد التسجيل لكل الموظفين النشطين؟`
    }
    case 'record_advance':
      return `💵 تسجيل سلفة:\n• الموظف: ${args.employeeName}\n• المبلغ: ${num(args.amount)} ج.م\nستُخصم من صافي المرتب. هل أؤكد؟`
    case 'record_penalty':
      return `⚠️ تسجيل جزاء:\n• الموظف: ${args.employeeName}\n• المبلغ: ${num(args.amount)} ج.م\n${args.reason ? `• السبب: ${args.reason}\n` : ''}ستُخصم من صافي المرتب. هل أؤكد؟`
    case 'add_stock_item':
      return `📦 إضافة صنف خامة جديد:\n• الاسم: ${args.name}\n• الفئة: ${args.category}\n• الكمية الافتتاحية: ${num(args.currentQty || 0)} ${args.unit || 'ml'}\nهل أؤكد الإضافة؟`
    case 'stock_movement':
      return `📦 ${args.movementType === 'سحب' ? 'سحب' : 'استلام'} خامة:\n• الصنف: ${args.itemName}\n• الكمية: ${num(args.quantity)}\nهل أؤكد؟`
    case 'add_roll':
      return `🎞️ إضافة رول جديد:\n• الماركة: ${args.brand} ${args.type}\n• الطول: ${num(args.totalLength)} م\n• الفئة: ${args.rollCategory}\nهل أؤكد الإضافة؟`
    case 'roll_consumption': {
      const parts: string[] = [`🎞️ سحب من رول:`, `• الكود: ${args.rollCode}`, `• الأمتار: ${num(args.metersUsed)}`]
      if (args.waste) parts.push(`• الهالك: ${num(args.waste)}م`)
      if (args.clientName) parts.push(`• العميل: ${args.clientName}`)
      if (args.carType) parts.push(`• السيارة: ${args.carType}`)
      if (args.plateNumber) parts.push(`• اللوحة: ${args.plateNumber}`)
      if (args.usageArea) parts.push(`• جهة الاستخدام: ${args.usageArea}`)
      if (args.workOrder) parts.push(`• أمر الشغل: ${args.workOrder}`)
      if (args.technician) parts.push(`• الفني: ${args.technician}`)
      if (args.transactionType && args.transactionType !== 'استهلاك') parts.push(`• نوع الحركة: ${args.transactionType}`)
      parts.push('هل أؤكد السحب؟')
      return parts.join('\n')
    }
    case 'batch_waste': {
      const items = Array.isArray(args.items) ? args.items : []
      const startOB = args.startWorkOrder as string | undefined
      // Parse the starting OB number for sequential display
      let obNum: number | null = null
      if (startOB) {
        const m = startOB.match(/OB[-\s]*(\d+)/i)
        if (m) obNum = parseInt(m[1], 10)
      }
      const lines = items.map((it: any, i: number) => {
        const obLabel = obNum !== null
          ? `OB-${String(obNum + i).padStart(4, '0')}`
          : (args.workOrder || '—')
        return `${i + 1}. ${it.rollCode} — هالك ${num(it.waste)}م — ${obLabel}`
      })
      const parts: string[] = [
        `🎞️ تسجيل هالك لـ ${items.length} رول:`,
        ...lines,
      ]
      if (obNum !== null) {
        parts.push(`• كل رول OB مستقل (من ${startOB} إلى OB-${String(obNum + items.length - 1).padStart(4, '0')})`)
      } else if (args.workOrder) {
        parts.push(`• أمر الشغل: ${args.workOrder}`)
      }
      parts.push('هل أؤكد تسجيل الهالك للكل؟')
      return parts.join('\n')
    }
    case 'create_customer':
      return `🧑‍💼 إضافة عميل جديد:\n• الاسم: ${args.name}\n${args.phone ? `• الهاتف: ${args.phone}\n` : ''}هل أؤكد الإضافة؟`
    case 'create_supplier':
      return `🚚 إضافة مورد جديد:\n• الاسم: ${args.name}\n${args.phone ? `• الهاتف: ${args.phone}\n` : ''}هل أؤكد الإضافة؟`
    case 'create_offer':
      return `🏷️ إضافة عرض جديد:\n• العنوان: ${args.title}\n• الخصم: ${num(args.discountValue)}${args.discountType === 'fixed' ? ' ج.م' : '%'}\n• من ${args.startDate} إلى ${args.endDate}\nهل أؤكد الإضافة؟`
    case 'delete_service':
      return `🗑️ حذف خدمة:\n• الكود: ${args.serviceCode || args.serviceId}\nسيتم حذف الخدمة والعمولة المرتبطة. لا يمكن التراجع. هل أؤكد الحذف؟`
    case 'delete_stock_item':
      return `🗑️ حذف خامة:\n• الكود: ${args.itemCode || args.itemId}\nسيتم حذف الخامة وحركاتها. لا يمكن التراجع. هل أؤكد الحذف؟`
    case 'create_stock_invoice': {
      const items: any[] = Array.isArray(args.items) ? args.items : []
      const total = items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0)
      const itemsText = items.map((i: any, idx: number) => `   ${idx + 1}. ${i.itemName}${i.itemCode ? ` (${i.itemCode})` : ''} — ${num(i.quantity)} × ${num(i.unitPrice)} = ${num((Number(i.quantity) || 0) * (Number(i.unitPrice) || 0))} ج.م`).join('\n')
      return `🧾 فاتورة شراء خامات:\n${args.supplierName ? `• المورد: ${args.supplierName}\n` : ''}• التاريخ: ${args.invoiceDate || 'اليوم'}\n• عدد البنود: ${items.length}\n• الإجمالي: ${num(total)} ج.م${args.discount ? `\n• الخصم: ${num(args.discount)} ج.م` : ''}${args.discount ? `\n• الصافي: ${num(total - Number(args.discount))} ج.م` : ''}\n• البنود:\n${itemsText}\nسيتم تسجيل حركات الاستلام تلقائياً. هل أؤكد؟`
    }
    case 'pay_salary': {
      const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
      const now = new Date()
      const m = Number(args.month) || (now.getMonth() + 1)
      const y = Number(args.year) || now.getFullYear()
      return `💰 صرف مرتب:\n• الموظف: ${args.employeeName}\n• الشهر: ${monthNames[m - 1]} ${y}\n• الصافي: ${num(args.amount)} ج.م\nهذه عملية مالية نهائية وستُسجَّل باسمك. هل أؤكد الصرف؟`
    }
    default:
      return `تأكيد تنفيذ العملية: ${name}؟`
  }
}

// ─────────────────────────────────────────────────────────────
// 3) التنفيذ الفعلي — نفس منطق الـ API routes الحالية بالضبط
// ─────────────────────────────────────────────────────────────
export async function executeTool(name: string, args: any, context?: { userId?: string; userName?: string }): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    switch (name) {
      case 'create_service': {
        let code = args.code
        if (!code) {
          // استخدم مولّد الأكواد الموحد (DET001, POL001, THF001...)
          code = await generateServiceCode(args.serviceType)
        }
        const unifiedType = unifyServiceType(args.serviceType) || 'أخرى'

        // ربط تلقائي بالعميل: يدور بالاسم، ولو مش موجود ينشئ سجل عميل جديد بكود
        let customerId: string | null = null
        if (args.clientName) {
          let customer = await db.customer.findFirst({ where: { name: args.clientName } })
          if (!customer) {
            const custCount = await db.customer.count()
            customer = await db.customer.create({
              data: { code: `CUS-${String(custCount + 1).padStart(4, '0')}`, name: args.clientName, phone: args.clientPhone || null },
            })
          }
          customerId = customer.id
        }

        const service = await db.service.create({
          data: {
            code,
            date: args.date ? new Date(args.date) : new Date(),
            plate: args.plate || null,
            clientName: args.clientName || null,
            customerId,
            carType: args.carType || null,
            serviceType: unifiedType,
            serviceCategory: unifiedType,
            price: Number(args.price) || 0,
            paymentMethod: args.paymentMethod || null,
            technician: args.technician || null,
            notes: args.notes || null,
          },
        })
        if (args.technician && args.commissionAmount && Number(args.commissionAmount) > 0) {
          const emp = await db.employee.findUnique({ where: { name: args.technician } })
          if (emp) {
            const d = new Date(service.date)
            await db.commission.create({
              data: {
                employeeId: emp.id,
                employeeName: emp.name,
                date: d,
                month: d.getMonth() + 1,
                year: d.getFullYear(),
                clientName: service.clientName,
                carType: service.carType,
                serviceType: unifiedType,
                serviceCategory: unifiedType,
                amount: Number(args.commissionAmount),
                notes: `عمولة خدمة ${service.code}`,
              },
            })
          }
        }
        return { success: true, message: `✅ تم تسجيل الخدمة بكود ${service.code} بنجاح.`, data: service }
      }

      case 'add_employee': {
        const emp = await db.employee.create({
          data: {
            name: args.name,
            baseSalary: Number(args.baseSalary) || 0,
            phone: args.phone || null,
            hireDate: args.hireDate ? new Date(args.hireDate) : null,
            jobTitle: args.jobTitle || null,
            status: 'نشط',
            notes: args.notes || null,
          },
        })
        return { success: true, message: `✅ تم إضافة الموظف "${emp.name}" بنجاح.`, data: emp }
      }

      case 'record_attendance': {
        const emp = await findEmployeeByName(args.employeeName)
        if (!emp) return { success: false, message: `❌ لم يتم العثور على موظف باسم "${args.employeeName}".` }
        const d = new Date(args.date)
        const att = await db.attendance.upsert({
          where: { employeeId_date: { employeeId: emp.id, date: d } },
          create: {
            employeeId: emp.id, employeeName: emp.name, date: d,
            status: args.status, month: d.getMonth() + 1, year: d.getFullYear(), notes: args.notes || null,
          },
          update: { status: args.status, notes: args.notes || null },
        })
        return { success: true, message: `✅ تم تسجيل حضور "${emp.name}" بتاريخ ${args.date}.`, data: att }
      }

      case 'batch_attendance': {
        // تسجيل جماعي لكل الموظفين النشطين مع دعم الاستثناءات (map: name → status)
        const d = new Date(args.date)
        const month = d.getMonth() + 1
        const year = d.getFullYear()
        const defaultStatus = args.defaultStatus || 'ح'
        // exceptions بصيغة map: { "اسم الموظف": "حالة" }
        const exceptions: Record<string, string> = (args.exceptions && typeof args.exceptions === 'object' && !Array.isArray(args.exceptions)) ? args.exceptions : {}

        // جلب كل الموظفين النشطين
        const activeEmployees = await db.employee.findMany({ where: { status: 'نشط' } })
        if (activeEmployees.length === 0) {
          return { success: false, message: '❌ لا يوجد موظفون نشطون للتسجيل.' }
        }

        let created = 0, updated = 0
        const results: string[] = []
        for (const emp of activeEmployees) {
          // تحديد الحالة: استثناء إن وُجد، وإلا الافتراضية
          const status = exceptions[emp.name] || defaultStatus
          const existing = await db.attendance.findUnique({
            where: { employeeId_date: { employeeId: emp.id, date: d } },
          })
          if (existing) {
            await db.attendance.update({
              where: { id: existing.id },
              data: { status, month, year },
            })
            updated++
          } else {
            await db.attendance.create({
              data: {
                employeeId: emp.id, employeeName: emp.name, date: d,
                status, month, year,
              },
            })
            created++
          }
          results.push(`${emp.name}=${status}`)
        }

        const map: any = { 'ح': 'حضور', 'غ': 'غياب', 'إ': 'إجازة', 'ر': 'راحة' }
        const excNames = Object.keys(exceptions)
        const excSummary = excNames.length > 0
          ? ` (استثناءات: ${excNames.map(n => `${n}=${map[exceptions[n]]||exceptions[n]}`).join('، ')})`
          : ''
        return {
          success: true,
          message: `✅ تم تسجيل الحضور الجماعي بتاريخ ${args.date} لـ ${activeEmployees.length} موظف نشط (جديد: ${created}، تحديث: ${updated})${excSummary}.`,
          data: { total: activeEmployees.length, created, updated, results },
        }
      }

      case 'record_advance': {
        const emp = await findEmployeeByName(args.employeeName)
        if (!emp) return { success: false, message: `❌ لم يتم العثور على موظف باسم "${args.employeeName}".` }
        const d = args.date ? new Date(args.date) : new Date()
        const adv = await db.advance.create({
          data: {
            employeeId: emp.id, employeeName: emp.name, date: d,
            amount: Number(args.amount) || 0, notes: args.notes || null,
            month: d.getMonth() + 1, year: d.getFullYear(),
          },
        })
        return { success: true, message: `✅ تم تسجيل سلفة ${Number(args.amount).toLocaleString('en-US')} ج.م لـ"${emp.name}".`, data: adv }
      }

      case 'record_penalty': {
        const emp = await findEmployeeByName(args.employeeName)
        if (!emp) return { success: false, message: `❌ لم يتم العثور على موظف باسم "${args.employeeName}".` }
        const d = args.date ? new Date(args.date) : new Date()
        const pen = await db.penalty.create({
          data: {
            employeeId: emp.id, employeeName: emp.name, date: d,
            amount: Number(args.amount) || 0, reason: args.reason || null,
            month: d.getMonth() + 1, year: d.getFullYear(),
          },
        })
        return { success: true, message: `✅ تم تسجيل جزاء ${Number(args.amount).toLocaleString('en-US')} ج.م على "${emp.name}".`, data: pen }
      }

      case 'add_stock_item': {
        const name = String(args.name || '').trim()
        if (!name) return { success: false, message: '❌ اسم الخامة مطلوب.' }
        const category = args.category || 'detailing'
        // تطبيع الاسم للتحقق من التكرار (يلتقط اختلافات الـ case والمسافات والتشكيل)
        const normalized = normalizeStockName(name)
        const allItems = await db.stockItem.findMany({ select: { id: true, name: true, code: true } })
        const existing = allItems.find(i => normalizeStockName(i.name) === normalized)
        if (existing) {
          return { success: false, message: `❌ الصنف موجود مسبقاً باسم "${existing.name}"${existing.code ? ` (كود: ${existing.code})` : ''}. استخدم أمر السحب/الاستلام بدلاً من الإضافة.` }
        }
        const currentQty = Number(args.currentQty) || 0
        const minLevel = Number(args.minLevel) || 0
        const status = recalcStockStatus(currentQty, minLevel)
        // توليد كود تلقائي بصيغة STL-001 / STD-001 / STN-001 / STT-001
        const code = await generateStockCode(category)
        const item = await db.stockItem.create({
          data: {
            code, name, category, unit: args.unit || 'ml',
            totalReceived: currentQty, totalWithdrawn: 0, currentQty, minLevel, status,
            unitPrice: Number(args.unitPrice) || 0,
          },
        })
        if (currentQty > 0) {
          await db.stockMovement.create({
            data: {
              itemId: item.id, itemName: item.name, date: new Date(), materialType: item.category,
              movementType: 'استلام', quantity: currentQty, unit: item.unit, unitPrice: item.unitPrice,
              totalCost: currentQty * item.unitPrice, notes: 'رصيد افتتاحي',
            },
          })
        }
        return { success: true, message: `✅ تم إضافة الصنف "${item.name}" بكود ${code} للمخزون بنجاح.`, data: item }
      }

      case 'stock_movement': {
        // ابحث بالكود أولاً (إن وُجد) ثم بالاسم المطبّع — يمنع التكرار
        const item = await findStockItem(args.itemCode, args.itemName)
        if (!item) {
          return { success: false, message: `❌ الصنف "${args.itemName || args.itemCode}" غير موجود في المخزون. أضفه أولاً بأمر add_stock_item.` }
        }
        const qty = Number(args.quantity) || 0
        const unitPrice = Number(args.unitPrice) || item.unitPrice
        const totalCost = qty * unitPrice
        const movementType = args.movementType || 'استلام'

        if (movementType === 'سحب' && qty > item.currentQty) {
          return { success: false, message: `❌ الكمية المطلوب سحبها (${qty}) أكبر من الرصيد المتاح (${item.currentQty} ${item.unit}).` }
        }

        const movement = await db.stockMovement.create({
          data: {
            itemId: item.id, itemName: item.name, date: new Date(), materialType: item.category,
            movementType, quantity: qty, unit: item.unit, unitPrice, totalCost,
            notes: args.notes || null, deliveryNote: args.deliveryNote || null,
          },
        })

        let newQty = item.currentQty
        let newReceived = item.totalReceived
        let newWithdrawn = item.totalWithdrawn
        if (movementType === 'استلام') { newQty += qty; newReceived += qty }
        else { newQty -= qty; newWithdrawn += qty }
        const newStatus = recalcStockStatus(newQty, item.minLevel)

        await db.stockItem.update({
          where: { id: item.id },
          data: { currentQty: newQty, totalReceived: newReceived, totalWithdrawn: newWithdrawn, status: newStatus },
        })

        // إدارة التنبيهات (إنشاء عند الانخفاض + حذف عكسي عند العودة لـ "كافي")
        await manageStockAlerts({
          itemId: item.id, itemName: item.name, category: item.category, unit: item.unit,
          oldStatus: item.status, newStatus, newQty,
        })

        return { success: true, message: `✅ تم تسجيل ${movementType} ${qty} ${item.unit} من "${item.name}". الرصيد الحالي: ${newQty} ${item.unit}.`, data: movement }
      }

      case 'add_roll': {
        let code = args.code
        if (!code) {
          const brandPrefix = (args.brand || 'GEN').slice(0, 3).toUpperCase()
          const typePrefix = (args.type || 'GEN').slice(0, 3).toUpperCase()
          const count = await db.roll.count()
          code = `${brandPrefix}-${typePrefix}-${String(count + 1).padStart(3, '0')}`
        }
        const totalLength = Number(args.totalLength) || 0
        const roll = await db.roll.create({
          data: {
            code, brand: args.brand || '', type: args.type || '', model: args.model || null,
            width: args.width ? Number(args.width) : null, totalLength, remainingLength: totalLength,
            price: Number(args.price) || 0, supplier: args.supplier || null,
            rollCategory: args.rollCategory || 'ppf',
            purchaseDate: args.purchaseDate ? new Date(args.purchaseDate) : null,
            status: 'active', carsCount: 0,
          },
        })
        return { success: true, message: `✅ تم إضافة الرول بكود ${roll.code} بنجاح.`, data: roll }
      }

      case 'roll_consumption': {
        // Partial code lookup: exact first, then contains (case-insensitive)
        const roll = await findRollByCode(args.rollCode)
        if (!roll) {
          return { success: false, message: `❌ كود الرول "${args.rollCode}" غير موجود.` }
        }
        const metersUsed = Number(args.metersUsed) || 0
        const waste = Number(args.waste) || 0
        const totalUsed = metersUsed + waste
        if (totalUsed > (roll.remainingLength || 0)) {
          return { success: false, message: `❌ الرصيد غير كافٍ. المتبقي ${roll.remainingLength}م، المطلوب ${totalUsed}م.` }
        }
        const consumption = await db.rollConsumption.create({
          data: {
            rollId: roll.id, rollCode: roll.code, date: new Date(),
            clientName: args.clientName || null, carType: args.carType || null,
            plateNumber: args.plateNumber || null, metersUsed, waste,
            usageArea: args.usageArea || null, workOrder: args.workOrder || null,
            notes: args.notes || null,
            technician: args.technician || null,
            transactionType: args.transactionType || 'استهلاك',
          },
        })
        const newRemaining = (roll.remainingLength || 0) - totalUsed
        let newStatus = 'active'
        if (newRemaining <= 0) newStatus = 'finished'
        else if (newRemaining <= 2) newStatus = 'low'
        const newCarsCount = args.clientName ? (roll.carsCount || 0) + 1 : roll.carsCount
        await db.roll.update({
          where: { id: roll.id },
          data: { remainingLength: newRemaining, status: newStatus, carsCount: newCarsCount },
        })
        if (newStatus !== 'active' && roll.status === 'active') {
          await db.alert.create({
            data: {
              type: 'roll_low', severity: newStatus === 'finished' ? 'critical' : 'warning',
              title: `رول ${roll.code} ${newStatus === 'finished' ? 'منتهي' : 'أوشك على النفاذ'}`,
              message: `الرول ${roll.brand} ${roll.type} (${roll.code}) — المتبقي ${newRemaining.toFixed(2)} متر`,
              relatedId: roll.id, relatedType: 'roll',
            },
          })
        }
        const obSuffix = args.workOrder ? ` (OB: ${args.workOrder})` : ''
        return { success: true, message: `✅ تم تسجيل سحب ${metersUsed}م من الرول ${roll.code}${obSuffix}. المتبقي: ${newRemaining.toFixed(2)}م.`, data: consumption }
      }

      case 'batch_waste': {
        const items = Array.isArray(args.items) ? args.items : []
        if (items.length === 0) {
          return { success: false, message: '❌ قائمة الرولات فارغة.' }
        }
        const workOrder = args.workOrder || null
        // If startWorkOrder is provided, each roll gets a sequential OB
        let startObNum: number | null = null
        if (args.startWorkOrder) {
          const m = String(args.startWorkOrder).match(/OB[-\s]*(\d+)/i)
          if (m) startObNum = parseInt(m[1], 10)
        }
        const results: string[] = []
        const errors: string[] = []
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx]
          // Assign per-roll OB if startWorkOrder is set, otherwise use shared workOrder
          const perRollOB = startObNum !== null
            ? `OB-${String(startObNum + idx).padStart(4, '0')}`
            : workOrder
          const roll = await findRollByCode(item.rollCode)
          if (!roll) {
            errors.push(`${item.rollCode}: غير موجود`)
            continue
          }
          const waste = Number(item.waste) || 0
          if (waste <= 0) {
            errors.push(`${roll.code}: قيمة الهالك غير صحيحة`)
            continue
          }
          if (waste > (roll.remainingLength || 0)) {
            errors.push(`${roll.code}: الرصيد غير كافٍ (متبقي ${roll.remainingLength}م، مطلوب ${waste}م)`)
            continue
          }
          const consumption = await db.rollConsumption.create({
            data: {
              rollId: roll.id, rollCode: roll.code, date: new Date(),
              metersUsed: 0, waste,
              workOrder: perRollOB,
              notes: args.notes || 'تسجيل هالك دفعة',
              transactionType: 'هالك',
            },
          })
          const newRemaining = (roll.remainingLength || 0) - waste
          let newStatus = 'active'
          if (newRemaining <= 0) newStatus = 'finished'
          else if (newRemaining <= 2) newStatus = 'low'
          await db.roll.update({
            where: { id: roll.id },
            data: { remainingLength: newRemaining, status: newStatus },
          })
          if (newStatus !== 'active' && roll.status === 'active') {
            await db.alert.create({
              data: {
                type: 'roll_low', severity: newStatus === 'finished' ? 'critical' : 'warning',
                title: `رول ${roll.code} ${newStatus === 'finished' ? 'منتهي' : 'أوشك على النفاذ'}`,
                message: `الرول ${roll.brand} ${roll.type} (${roll.code}) — المتبقي ${newRemaining.toFixed(2)} متر`,
                relatedId: roll.id, relatedType: 'roll',
              },
            })
          }
          results.push(`${roll.code}: ${waste}م — ${perRollOB || 'بدون OB'} (متبقي ${newRemaining.toFixed(2)}م)`)
        }
        let msg = `✅ تم تسجيل الهالك لـ ${results.length} رول:\n` + results.map(r => `• ${r}`).join('\n')
        if (errors.length > 0) {
          msg += `\n\n⚠️ ${errors.length} رول لم يُسجل:\n` + errors.map(e => `• ${e}`).join('\n')
        }
        return { success: results.length > 0, message: msg, data: { registered: results.length, errors: errors.length } }
      }

      case 'create_customer': {
        const name = String(args.name || '').trim()
        if (!name) return { success: false, message: '❌ اسم العميل مطلوب.' }
        const existing = await db.customer.findFirst({ where: { name } })
        if (existing) return { success: false, message: `❌ العميل "${name}" موجود بالفعل بكود ${existing.code}.` }
        const count = await db.customer.count()
        const customer = await db.customer.create({
          data: { code: `CUS-${String(count + 1).padStart(4, '0')}`, name, phone: args.phone || null, address: args.address || null, notes: args.notes || null },
        })
        return { success: true, message: `✅ تم إضافة العميل "${customer.name}" بكود ${customer.code}.`, data: customer }
      }

      case 'create_supplier': {
        const name = String(args.name || '').trim()
        if (!name) return { success: false, message: '❌ اسم المورد مطلوب.' }
        const existing = await db.supplier.findFirst({ where: { name } })
        if (existing) return { success: false, message: `❌ المورد "${name}" موجود بالفعل بكود ${existing.code}.` }
        const count = await db.supplier.count()
        const supplier = await db.supplier.create({
          data: { code: `SUP-${String(count + 1).padStart(4, '0')}`, name, phone: args.phone || null, notes: args.notes || null },
        })
        return { success: true, message: `✅ تم إضافة المورد "${supplier.name}" بكود ${supplier.code}.`, data: supplier }
      }

      case 'create_offer': {
        if (!args.title || !args.discountValue || !args.startDate || !args.endDate) {
          return { success: false, message: '❌ العنوان وقيمة الخصم وتاريخ البداية والنهاية مطلوبين.' }
        }
        const count = await db.offer.count()
        const offer = await db.offer.create({
          data: {
            code: `OFR-${String(count + 1).padStart(4, '0')}`,
            title: args.title,
            discountType: args.discountType || 'percentage',
            discountValue: Number(args.discountValue),
            serviceType: args.serviceType || null,
            startDate: new Date(args.startDate),
            endDate: new Date(args.endDate),
            active: true,
            notes: args.notes || null,
          },
        })
        return { success: true, message: `✅ تم إضافة العرض "${offer.title}" بكود ${offer.code}.`, data: offer }
      }

      case 'delete_service': {
        // ابحث عن الخدمة بالكود أو المعرّف
        let service
        if (args.serviceId) {
          service = await db.service.findUnique({ where: { id: args.serviceId } })
        } else if (args.serviceCode) {
          service = await db.service.findUnique({ where: { code: args.serviceCode } })
        }
        if (!service) {
          return { success: false, message: `❌ لم يتم العثور على خدمة بالكود "${args.serviceCode || args.serviceId}".` }
        }
        // احذف في transaction (خدمة + عمولتها المرتبطة)
        const notePattern = `عمولة خدمة ${service.code}`
        const linkedCommission = await db.commission.findFirst({ where: { notes: notePattern } })
        await db.$transaction(async (tx) => {
          if (linkedCommission) {
            await tx.commission.delete({ where: { id: linkedCommission.id } })
          }
          await tx.service.delete({ where: { id: service.id } })
        })
        return { success: true, message: `✅ تم حذف الخدمة ${service.code} (${service.serviceType}).${linkedCommission ? ' وحُذفت العمولة المرتبطة.' : ''}`, data: { deletedCode: service.code } }
      }

      case 'delete_stock_item': {
        // ابحث عن الخامة بالكود أو المعرّف
        let item
        if (args.itemId) {
          item = await db.stockItem.findUnique({ where: { id: args.itemId } })
        } else if (args.itemCode) {
          item = await db.stockItem.findUnique({ where: { code: args.itemCode } })
        }
        if (!item) {
          return { success: false, message: `❌ لم يتم العثور على خامة بالكود "${args.itemCode || args.itemId}".` }
        }
        // احذف الخامة + حركاتها (cascade)
        await db.stockMovement.deleteMany({ where: { itemId: item.id } })
        await db.stockItem.delete({ where: { id: item.id } })
        // احذف التنبيهات المرتبطة
        await db.alert.deleteMany({ where: { relatedId: item.id, relatedType: 'stock_item' } })
        return { success: true, message: `✅ تم حذف الخامة ${item.code} (${item.name}) وحركاتها.`, data: { deletedCode: item.code, deletedName: item.name } }
      }

      case 'create_stock_invoice': {
        // استدعِ POST /api/stock-invoices (نفس المنطق — transaction كامل)
        const res = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/stock-invoices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        })
        const data = await res.json()
        if (!res.ok) {
          return { success: false, message: data.error || '❌ فشل إنشاء الفاتورة.' }
        }
        return { success: true, message: `✅ تم إنشاء فاتورة خامات بكود ${data.code} بإجمالي ${num(data.net)} ج.م (${data.itemsCount} بند).`, data }
      }

      case 'pay_salary': {
        const emp = await findEmployeeByName(args.employeeName)
        if (!emp) return { success: false, message: `❌ لم يتم العثور على موظف باسم "${args.employeeName}".` }
        const now = new Date()
        const month = Number(args.month) || (now.getMonth() + 1)
        const year = Number(args.year) || now.getFullYear()
        const amount = Number(args.amount) || 0
        if (amount <= 0) return { success: false, message: '❌ قيمة الصرف يجب أن تكون أكبر من صفر.' }

        const existing = await db.payrollPayment.findUnique({
          where: { employeeId_month_year: { employeeId: emp.id, month, year } },
        })
        if (existing && existing.status === 'paid') {
          return { success: false, message: `❌ مرتب "${emp.name}" لشهر ${month}/${year} مدفوع بالفعل بتاريخ ${new Date(existing.paidAt).toLocaleDateString('ar-EG')}.` }
        }

        const payerName = context?.userName || 'المساعد الذكي'
        const payment = existing
          ? await db.payrollPayment.update({
              where: { id: existing.id },
              data: {
                status: 'paid', amount, paidAt: new Date(),
                paidByUserId: context?.userId || null, paidByName: payerName,
                reversedAt: null, reversedByUserId: null, reversedByName: null,
              },
            })
          : await db.payrollPayment.create({
              data: {
                employeeId: emp.id, employeeName: emp.name, month, year,
                amount, status: 'paid',
                paidByUserId: context?.userId || null, paidByName: payerName,
              },
            })

        return { success: true, message: `✅ تم صرف مرتب "${emp.name}" لشهر ${month}/${year} بمبلغ ${amount.toLocaleString('en-US')} ج.م بنجاح.`, data: payment }
      }

      default:
        return { success: false, message: `❌ أداة غير معروفة: ${name}` }
    }
  } catch (e: any) {
    console.error(`executeTool(${name}) error:`, e)
    return { success: false, message: `❌ حدث خطأ أثناء التنفيذ: ${e.message || 'خطأ غير معروف'}` }
  }
}

// ─── Helper: fuzzy employee lookup (exact match first, then contains) ─
async function findEmployeeByName(name: string) {
  if (!name) return null
  const exact = await db.employee.findUnique({ where: { name } })
  if (exact) return exact
  const all = await db.employee.findMany({ where: { status: 'نشط' } })
  return all.find(e => e.name.includes(name) || name.includes(e.name)) || null
}

// ─── Helper: roll code lookup with partial matching ────────────
// Strategy:
//   1. exact match (case-sensitive — codes are stored uppercase)
//   2. case-insensitive exact match
//   3. rolls whose code *contains* the query (case-insensitive)
//   4. rolls whose code *starts with* the query (prefer prefix matches)
// If multiple candidates match, we prefer the *exact* / *prefix* ones, but if
// more than one roll still ties, we throw a descriptive error so the AI can
// ask the user to disambiguate.
async function findRollByCode(rawCode: string) {
  const code = String(rawCode || '').trim()
  if (!code) return null

  // 1. exact match (fast path — DB unique index)
  const exact = await db.roll.findUnique({ where: { code } })
  if (exact) return exact

  // 2. case-insensitive exact match
  const upper = code.toUpperCase()
  const lower = code.toLowerCase()
  const ciExact = await db.roll.findFirst({ where: { OR: [{ code: upper }, { code: lower }] } })
  if (ciExact) return ciExact

  // 3. partial contains (case-insensitive)
  const all = await db.roll.findMany()
  const lowerQuery = code.toLowerCase()

  // Prefer prefix matches first
  const prefixMatches = all.filter(r => r.code.toLowerCase().startsWith(lowerQuery))
  if (prefixMatches.length === 1) return prefixMatches[0]

  const containsMatches = all.filter(r => r.code.toLowerCase().includes(lowerQuery))
  if (containsMatches.length === 1) return containsMatches[0]

  // Multiple matches — let the caller surface a disambiguation error
  if (containsMatches.length > 1) {
    const codes = containsMatches.slice(0, 10).map(r => r.code).join('، ')
    throw new Error(`كود الرول "${code}" مطابق لعدة رولات: ${codes}. اطلب من المستخدم تحديد الكود الكامل.`)
  }

  return null
}
