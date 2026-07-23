import{a as i,j as e}from"./vendor-react-CT0_hoX6.js";import{o as ee,d as ae,b as L,c as $,S as C,T as le,B as h,i as te,j as ie,k as se,a as U}from"./index-LVnuQI4L.js";import{u as oe,b as re}from"./vendor-tanstack-BdGrscrn.js";import{C as ne}from"./card-CV5LEaTW.js";import{I as d}from"./input-DA-3K2Ay.js";import{L as b}from"./label-5bpSUTBh.js";import{A as de,a as ce}from"./adaptive-dialog-BP-0dzbf.js";import{a6 as pe,F as g,S as me,a7 as xe,D as he,B as be,an as ue,e as I,br as ge,bn as fe,aq as S,o as ye,E as ve,H as je,b as _e}from"./vendor-icons-kThR5W7g.js";import"./vendor-router-DkVvMFVl.js";import"./vendor-charts-CneYNIhr.js";import"./vendor-i18n-lBdt9ta2.js";import"./vendor-clerk-hm2juogq.js";import"./use-breakpoint-l8ceMopP.js";const R=[{id:"all",label:"الكل",icon:g},{id:"judicial",label:"قضائية",icon:me},{id:"contractual",label:"تعاقدية",icon:xe},{id:"financial",label:"مالية",icon:he},{id:"admin",label:"إدارية",icon:be}],P=[{id:"legal-warning",title:"خطاب إنذار قانوني",category:"judicial",description:"إنذار رسمي قبل اتخاذ الإجراءات القانونية",fields:[{key:"recipient_name",label:"اسم المستلم",placeholder:"عبدالله محمد الشمري"},{key:"recipient_title",label:"صفة المستلم",placeholder:"المدير العام"},{key:"recipient_company",label:"جهة المستلم",placeholder:"شركة النور للتجارة"},{key:"amount",label:"المبلغ المطالب به",placeholder:"٥٠,٠٠٠ ريال سعودي"},{key:"debt_reason",label:"سبب المطالبة",placeholder:"فاتورة خدمات غير مسددة"},{key:"days",label:"مهلة السداد (يوم)",placeholder:"١٥"},{key:"client_name",label:"اسم الموكّل",placeholder:"أحمد سعد القحطاني"}],body:`بسم الله الرحمن الرحيم

السيد/ {{recipient_name}} — {{recipient_title}}
{{recipient_company}}
المحترم

السلام عليكم ورحمة الله وبركاته،

**الموضوع: إنذار قانوني رسمي**

نُفيدكم بأنّ موكّلنا السيد/ {{client_name}} قد فوّضنا بموجب وكالة شرعية نظامية للتواصل معكم بشأن حقّه المشروع، وهو مبلغ {{amount}} الناشئ عن {{debt_reason}}.

وعليه، فإنّنا نُنذركم رسمياً بضرورة سداد المبلغ المذكور كاملاً خلال مدّة أقصاها **{{days}} يوماً** من تاريخ استلامكم هذا الإنذار، وذلك تجنّباً للجوء إلى القضاء والمطالبة بكامل الحقوق المترتبة على ذلك، بما فيها التعويضات والمصاريف القانونية.

وفي حال عدم الاستجابة خلال المدة المحددة، سنتخذ جميع الإجراءات القانونية اللازمة أمام المحاكم المختصة دون أي إشعار مسبق.

وتفضلوا بقبول فائق الاحترام والتقدير،

**المحامي الموكّل**`},{id:"case-status",title:"خطاب متابعة قضية",category:"judicial",description:"إحاطة الموكّل بآخر مستجدات قضيته",fields:[{key:"client_name",label:"اسم الموكّل",placeholder:"فهد عبدالرحمن السعيد"},{key:"case_no",label:"رقم القضية",placeholder:"٢٠٢٥/٣٤٥٦"},{key:"court",label:"المحكمة",placeholder:"المحكمة التجارية بالرياض"},{key:"last_session",label:"تاريخ الجلسة الأخيرة",placeholder:"١٥ / ١١ / ١٤٤٦هـ"},{key:"session_result",label:"نتيجة الجلسة",placeholder:"تأجّلت القضية لاستكمال تبادل المذكرات"},{key:"next_session",label:"تاريخ الجلسة القادمة",placeholder:"٢٩ / ١١ / ١٤٤٦هـ"},{key:"required_action",label:"المطلوب من الموكّل",placeholder:"إحضار عقد الشراكة الأصلي"}],body:`بسم الله الرحمن الرحيم

الأخ الكريم/ {{client_name}}
حفظه الله

السلام عليكم ورحمة الله وبركاته،

**الموضوع: تقرير متابعة — القضية رقم {{case_no}}**

نُحيطكم علماً بآخر مستجدات قضيتكم المنظورة أمام {{court}}:

**آخر جلسة:** {{last_session}}
**ما تمّ:** {{session_result}}

**الجلسة القادمة:** {{next_session}}

**المطلوب منكم على وجه السرعة:**
{{required_action}}

نؤكد لكم حرصنا التام على متابعة قضيتكم بكل اجتهاد وإخلاص، ونرجو التواصل معنا في حال وجود أي استفسار.

وتفضلوا بقبول فائق الاحترام والتقدير،

**المحامي الموكّل**`},{id:"engagement",title:"خطاب تأكيد التوكيل",category:"contractual",description:"تأكيد استلام التوكيل وبدء تمثيل الموكّل",fields:[{key:"client_name",label:"اسم الموكّل",placeholder:"سلطان ناصر الدوسري"},{key:"case_type",label:"نوع القضية / الخدمة",placeholder:"نزاع تجاري"},{key:"retainer_fee",label:"أتعاب التوكيل",placeholder:"٨,٠٠٠ ريال سعودي"},{key:"start_date",label:"تاريخ بدء التمثيل",placeholder:"١ / ١٢ / ١٤٤٦هـ"},{key:"lawyer_name",label:"اسم المحامي",placeholder:"المحامي / خالد عبدالله الرشيد"}],body:`بسم الله الرحمن الرحيم

الأخ الكريم/ {{client_name}}
حفظه الله

السلام عليكم ورحمة الله وبركاته،

**الموضوع: تأكيد استلام التوكيل والبدء بالتمثيل القانوني**

يسعدنا إحاطتكم بأنّنا استلمنا وكالتكم الشرعية النظامية، وقد تسلّم مكتبنا مهمّة تمثيلكم قانونياً في **{{case_type}}** اعتباراً من تاريخ **{{start_date}}**.

**تفاصيل الاتفاق:**
- الخدمة القانونية: {{case_type}}
- الأتعاب المتفق عليها: {{retainer_fee}}
- المحامي المسؤول: {{lawyer_name}}

نؤكد لكم أنّنا سنبذل أقصى جهدنا للدفاع عن حقوقكم وتحقيق أفضل النتائج الممكنة، وسنحرص على إبقائكم على اطلاع دائم بمجريات قضيتكم.

ولا تترددوا في التواصل معنا في أي وقت.

وتفضلوا بقبول فائق الاحترام والتقدير،

**{{lawyer_name}}**`},{id:"doc-request",title:"خطاب طلب مستندات",category:"judicial",description:"طلب وثائق وأدلة من الموكّل أو الطرف الآخر",fields:[{key:"recipient_name",label:"اسم المستلم",placeholder:"محمد علي الغامدي"},{key:"case_no",label:"رقم القضية / الملف",placeholder:"QD-2025-089"},{key:"documents",label:"المستندات المطلوبة",placeholder:`١- العقد الأصلي
٢- الفواتير
٣- المراسلات`,multiline:!0},{key:"deadline",label:"الموعد النهائي للتسليم",placeholder:"٢٠ / ١١ / ١٤٤٦هـ"}],body:`بسم الله الرحمن الرحيم

السيد/ {{recipient_name}}
المحترم

السلام عليكم ورحمة الله وبركاته،

**الموضوع: طلب تزويدنا بالمستندات — الملف رقم {{case_no}}**

تتمّة لمتابعتنا للملف المشار إليه، وبهدف استكمال الإجراءات القانونية اللازمة على أكمل وجه، نرجو التكرم بتزويدنا بالمستندات الآتية:

{{documents}}

ونأمل أن يتمّ ذلك في أقرب وقت ممكن، وعلى وجه الاستعجال في موعد أقصاه **{{deadline}}**، إذ إنّ عدم التزوّد بهذه الوثائق في الوقت المحدد قد يُؤثّر سلباً على سير الإجراءات.

شاكرين حسن تعاونكم،

وتفضلوا بقبول فائق الاحترام والتقدير،

**المحامي الموكّل**`},{id:"settlement",title:"خطاب عرض تسوية ودية",category:"judicial",description:"عرض الحل الودي قبل التقاضي",fields:[{key:"recipient_name",label:"اسم الطرف الآخر",placeholder:"الشركة السعودية للمقاولات"},{key:"dispute_subject",label:"موضوع النزاع",placeholder:"خلاف على تنفيذ عقد المقاولة"},{key:"settlement_amount",label:"مبلغ التسوية المقترح",placeholder:"٣٠,٠٠٠ ريال سعودي"},{key:"response_deadline",label:"مهلة الرد",placeholder:"٧ أيام"},{key:"client_name",label:"اسم الموكّل",placeholder:"عمر فيصل المطيري"}],body:`بسم الله الرحمن الرحيم

إلى/ {{recipient_name}}
المحترمين

السلام عليكم ورحمة الله وبركاته،

**الموضوع: عرض تسوية ودية**

بالإشارة إلى النزاع القائم بين موكّلنا السيد/ {{client_name}} وجهتكم بشأن **{{dispute_subject}}**، وحرصاً على إنهاء هذا النزاع بصورة ودّية بعيداً عن التكاليف والمشقّات التي يُفضي إليها التقاضي، فإنّ موكّلنا يُعرب عن استعداده للتسوية الودّية بمبلغ **{{settlement_amount}}** يُدفع دفعةً واحدة عند توقيع اتفاقية التسوية.

ونأمل أن تُخطرونا بموقفكم خلال **{{response_deadline}}** من تاريخ استلام هذا الخطاب، علماً بأنّ انقضاء هذه المدة دون ردّ سيُعدّ رفضاً لهذا العرض، مما سيضطرّنا لاتخاذ الإجراءات القانونية الكفيلة باستيفاء حقوق موكّلنا كاملة.

وتفضلوا بقبول فائق الاحترام والتقدير،

**المحامي الموكّل**`},{id:"case-closure",title:"خطاب إغلاق القضية",category:"judicial",description:"إعلام الموكّل بإنهاء القضية وتسليم الملف",fields:[{key:"client_name",label:"اسم الموكّل",placeholder:"بدر عبدالعزيز الحربي"},{key:"case_no",label:"رقم القضية",placeholder:"٢٠٢٥/١١٢٣"},{key:"result",label:"نتيجة القضية",placeholder:"صدر الحكم لصالح الموكّل بالمبلغ كاملاً"},{key:"closure_date",label:"تاريخ الإغلاق",placeholder:"١٠ / ١٢ / ١٤٤٦هـ"}],body:`بسم الله الرحمن الرحيم

الأخ الكريم/ {{client_name}}
حفظه الله

السلام عليكم ورحمة الله وبركاته،

**الموضوع: إغلاق ملف القضية رقم {{case_no}}**

يسعدنا إحاطتكم بأنّه قد تمّ الفصل في القضية رقم {{case_no}} بتاريخ **{{closure_date}}**، وقد جاءت النتيجة كما يلي:

**{{result}}**

وعليه، يُعدّ ملفّ هذه القضية مُغلقاً رسمياً من جهتنا. يسعدنا أنّنا كنّا عوناً لكم، ونتمنى لكم التوفيق والسداد.

ستجدون لدينا جميع مستنداتكم الأصلية ويمكن استلامها من مكتبنا في أي وقت مناسب.

شاكرين ثقتكم الغالية بمكتبنا،

وتفضلوا بقبول فائق الاحترام والتقدير،

**المحامي الموكّل**`},{id:"financial-demand",title:"خطاب مطالبة مالية",category:"financial",description:"المطالبة الرسمية بسداد مستحقات مالية",fields:[{key:"debtor_name",label:"اسم المدين",placeholder:"شركة الأفق للاستثمار"},{key:"creditor_name",label:"اسم الدائن (الموكّل)",placeholder:"مؤسسة النجاح التجارية"},{key:"amount",label:"المبلغ المطالب به",placeholder:"١٢٠,٠٠٠ ريال سعودي"},{key:"due_date",label:"تاريخ الاستحقاق الأصلي",placeholder:"١ / ٩ / ١٤٤٦هـ"},{key:"payment_deadline",label:"مهلة السداد",placeholder:"١٠ أيام من تاريخ هذا الخطاب"}],body:`بسم الله الرحمن الرحيم

إلى/ {{debtor_name}}
المحترمين

السلام عليكم ورحمة الله وبركاته،

**الموضوع: مطالبة رسمية بسداد المستحقات المالية**

نُفيدكم بأنّنا نُمثّل موكّلنا **{{creditor_name}}**، والذي يحق له لديكم مبلغ وقدره **{{amount}}** والمستحقّ بتاريخ **{{due_date}}**، غير أنّكم لم تقوموا بالسداد حتى تاريخه رغم مرور المدة المتفق عليها.

لذا، ندعوكم إلى سداد هذا المبلغ كاملاً خلال **{{payment_deadline}}**، وإلا اضطُررنا إلى اتخاذ الإجراءات النظامية والقانونية كافة أمام الجهات المختصة، بما في ذلك رفع دعوى قضائية والمطالبة بكامل الحقوق والتعويضات المستحقة.

آملين التفاعل الإيجابي مع هذا الطلب.

وتفضلوا بقبول فائق الاحترام والتقدير،

**المحامي الموكّل**`},{id:"complaint-response",title:"خطاب رد على شكوى",category:"admin",description:"الرد الرسمي على شكوى مقدّمة",fields:[{key:"complainant_name",label:"اسم مقدّم الشكوى",placeholder:"خالد سعد العنزي"},{key:"complaint_ref",label:"رقم / تاريخ الشكوى",placeholder:"٢٥-١١-١٤٤٦هـ"},{key:"complaint_subject",label:"موضوع الشكوى",placeholder:"تأخر في تسليم المشروع"},{key:"response_details",label:"تفاصيل الرد",placeholder:"تمّ التأخير بسبب ظروف خارجة عن إرادتنا وتمّ إبلاغ العميل مسبقاً...",multiline:!0},{key:"resolution",label:"الحل المقترح",placeholder:"تعويض بمبلغ ٥,٠٠٠ ريال وإنجاز المشروع خلال أسبوعين"}],body:`بسم الله الرحمن الرحيم

السيد/ {{complainant_name}}
المحترم

السلام عليكم ورحمة الله وبركاته،

**الموضوع: الرد على شكواكم المؤرّخة {{complaint_ref}} — {{complaint_subject}}**

تلقّينا شكواكم الكريمة بكل اهتمام وأولوية، وقد أجرينا دراسة معمّقة لجميع جوانبها، ونودّ توضيح ما يلي:

{{response_details}}

وحرصاً منّا على رضاكم وتقديراً لأهمية علاقتنا بكم، فإنّنا نقترح ما يلي كحلّ يليق بكم:

**{{resolution}}**

نأمل أن يُحقق هذا الرد توقعاتكم، ونؤكد حرصنا الدائم على تقديم أفضل الخدمات، وأبوابنا دائماً مفتوحة للتواصل.

وتفضلوا بقبول فائق الاحترام والتقدير،

**المحامي الموكّل**`},{id:"arbitration-invite",title:"خطاب دعوة للتحكيم",category:"judicial",description:"دعوة الطرف الآخر لحل النزاع عبر التحكيم",fields:[{key:"recipient_name",label:"اسم الطرف المدعو",placeholder:"مجموعة الرياض القابضة"},{key:"dispute_subject",label:"موضوع النزاع",placeholder:"خلاف على تنفيذ اتفاقية الشراكة"},{key:"arbitration_center",label:"مركز التحكيم المقترح",placeholder:"مركز التحكيم التجاري لدول مجلس التعاون"},{key:"client_name",label:"اسم الموكّل",placeholder:"مجموعة الخليج للأعمال"},{key:"response_deadline",label:"مهلة الرد على الدعوة",placeholder:"١٤ يوماً"}],body:`بسم الله الرحمن الرحيم

إلى/ {{recipient_name}}
المحترمين

السلام عليكم ورحمة الله وبركاته،

**الموضوع: دعوة للتحكيم في النزاع المتعلق بـ {{dispute_subject}}**

نتشرف بتمثيل **{{client_name}}** في النزاع القائم بينه وبين جهتكم الموقّرة، وإيماناً منّا بأنّ التحكيم هو الوسيلة الأمثل لحلّ النزاعات التجارية بعيداً عن التعقيدات القضائية، فإنّنا نرسل إليكم هذه الدعوة للتحكيم أمام **{{arbitration_center}}**.

نأمل موافقتكم على هذه الدعوة وإخطارنا بردّكم خلال **{{response_deadline}}** من تاريخ استلام هذا الخطاب، وذلك لاتخاذ الإجراءات اللازمة للشروع في مسار التحكيم.

وفي حال عدم الموافقة، سنضطر للجوء للقضاء النظامي مباشرةً.

وتفضلوا بقبول فائق الاحترام والتقدير،

**المحامي الموكّل**`},{id:"contract-extension",title:"خطاب تمديد عقد",category:"contractual",description:"طلب أو إشعار بتمديد عقد قائم",fields:[{key:"recipient_name",label:"الطرف الآخر",placeholder:"شركة البناء الحديث"},{key:"contract_no",label:"رقم العقد",placeholder:"CTR-2024-045"},{key:"original_end_date",label:"تاريخ انتهاء العقد الأصلي",placeholder:"٣٠ / ١٢ / ١٤٤٦هـ"},{key:"extension_period",label:"مدة التمديد المطلوبة",placeholder:"٦ أشهر"},{key:"extension_reason",label:"سبب التمديد",placeholder:"استكمال المراحل المتبقية من المشروع"},{key:"client_name",label:"اسم الموكّل",placeholder:"مؤسسة الريادة للإنشاءات"}],body:`بسم الله الرحمن الرحيم

إلى/ {{recipient_name}}
المحترمين

السلام عليكم ورحمة الله وبركاته،

**الموضوع: طلب تمديد العقد رقم {{contract_no}}**

بالإشارة إلى العقد المبرم بين **{{client_name}}** وجهتكم الكريمة برقم **{{contract_no}}**، والمنتهي بتاريخ **{{original_end_date}}**، وبسبب **{{extension_reason}}**، نودّ أن نتقدّم بطلب رسمي لتمديد مدة العقد لفترة إضافية مدّتها **{{extension_period}}** بنفس الشروط والأحكام المتفق عليها مسبقاً.

نأمل دراسة هذا الطلب وإبداء موافقتكم عليه في أقرب وقت ممكن، إذ إنّ التنسيق المبكر يضمن استمرارية العمل دون انقطاع.

وتفضلوا بقبول فائق الاحترام والتقدير،

**المحامي الموكّل**`},{id:"welcome-client",title:"خطاب ترحيب بعميل جديد",category:"admin",description:"رسالة ترحيبية رسمية لعميل جديد",fields:[{key:"client_name",label:"اسم العميل",placeholder:"راشد بن محمد الكعبي"},{key:"service_type",label:"نوع الخدمة القانونية",placeholder:"استشارات قانونية تجارية"},{key:"lawyer_name",label:"المحامي المسؤول",placeholder:"المحامي / عادل حمد الشهراني"},{key:"office_phone",label:"هاتف المكتب",placeholder:"٠١١-٤٥٦٧٨٩٠"},{key:"office_email",label:"البريد الإلكتروني",placeholder:"info@office.com"}],body:`بسم الله الرحمن الرحيم

الأخ الكريم/ {{client_name}}
حفظه الله

السلام عليكم ورحمة الله وبركاته،

يسعدنا أن نرحّب بكم في عائلة مكتبنا القانوني، ونشكر ثقتكم الغالية في اختياركم لنا لتقديم خدمات **{{service_type}}** لكم.

**محاميكم المسؤول:** {{lawyer_name}}
**للتواصل:** {{office_phone}}
**البريد الإلكتروني:** {{office_email}}

نؤكد لكم أنّنا سنبذل أقصى جهدنا لتقديم أفضل خدمة قانونية ممكنة، وسنحرص على الشفافية الكاملة في التواصل معكم بشأن كل ما يتعلق بشؤونكم القانونية.

أهلاً وسهلاً بكم دائماً،

وتفضلوا بقبول فائق الاحترام والتقدير،

**{{lawyer_name}}**`}];function ke(f,c){return f.replace(/\{\{(\w+)\}\}/g,(E,s)=>c[s]||`[${s}]`)}const we=new Date().toLocaleDateString("ar-SA-u-ca-islamic",{day:"numeric",month:"long",year:"numeric"});function Re(){const{data:f}=ee(),[c,E]=i.useState("all"),[s,B]=i.useState(""),[t,M]=i.useState(null),[y,v]=i.useState({}),[T,j]=i.useState(!1),[q,_]=i.useState(!1),[o,O]=i.useState(""),[z,H]=i.useState(""),[p,D]=i.useState(""),[A,Q]=i.useState(""),Y=i.useRef(null),{toast:m}=ae(),{data:x}=oe({queryKey:["smtp-status"],queryFn:()=>U("/api/email/smtp-status").then(a=>{if(!a.ok)throw new Error("خطأ في الخادم");return a.json()})}),k=re({mutationFn:a=>U("/api/email/send-letter",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)}).then(l=>{if(!l.ok)throw new Error("خطأ في الخادم");return l.json()}),onSuccess:a=>{if(a.mailtoFallback){const l=`mailto:${o}?subject=${encodeURIComponent(p)}&body=${encodeURIComponent(r.replace(/\*\*(.*?)\*\*/g,"$1"))}`;window.open(l,"_blank"),m({title:"فُتح برنامج البريد",description:"أكمل الإرسال من برنامج البريد لديك"})}else a.success?(m({title:"✅ تم الإرسال بنجاح",description:`تم إرسال الخطاب إلى ${o}`}),_(!1)):m({title:"فشل الإرسال",description:a.error,variant:"destructive"})},onError:()=>m({title:"خطأ في الإرسال",variant:"destructive"})});function G(){t&&D(t.title),_(!0)}function J(){k.mutate({to:o,toName:z,subject:p,body:r,fromName:A})}function K(){const a=`mailto:${o}?subject=${encodeURIComponent(p)}&body=${encodeURIComponent(r.replace(/\*\*(.*?)\*\*/g,"$1"))}`;window.open(a,"_blank")}const F=P.filter(a=>!(c!=="all"&&a.category!==c||s&&!a.title.includes(s)&&!a.description.includes(s)));function V(a){M(a),v({}),j(!1)}const r=t?ke(t.body,{...y,date:we}):"";function W(){navigator.clipboard.writeText(r).then(()=>{j(!0),setTimeout(()=>j(!1),2e3),m({title:"تم نسخ الخطاب ✓"})})}function X(){const a=window.open("","_blank");if(!a)return;const l=f,n=l?.letterheadUrl,u=l?.primaryColor||"#1e3a5f",w=l?.secondaryColor||"#2563EB",N=l?.officeName||"مكتب المحاماة",Z=l?.showAdalalahFooter!==!1;a.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar"><head>
<meta charset="utf-8"/>
<title>${t?.title??"خطاب"}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
body{font-family:'Cairo',Arial,sans-serif;background:#fff;color:#111;direction:rtl}
.page{
  width:210mm;min-height:297mm;margin:0 auto;position:relative;
  display:flex;flex-direction:column;
  ${n?`background-image:url(${n});background-size:100% 100%;background-repeat:no-repeat;`:""}
}
.page-inner{padding:22mm 20mm;flex:1;position:relative;z-index:1}
${n?".page-inner{background:rgba(255,255,255,0.88);}":""}
.office-header{
  display:flex;justify-content:space-between;align-items:flex-start;
  padding-bottom:14px;margin-bottom:18px;
  border-bottom:3px solid ${w};
}
.office-brand{display:flex;align-items:center;gap:12px}
.office-logo{height:60px;width:auto;object-fit:contain}
.office-name{font-size:20pt;font-weight:900;color:${u};line-height:1.1}
.office-name-en{font-size:9pt;color:#888;margin-top:2px}
.office-contact{font-size:8pt;color:#666;margin-top:6px;line-height:1.8}
.doc-title{
  text-align:center;font-size:16pt;font-weight:900;
  color:${u};margin:16px 0 24px;
  padding-bottom:8px;border-bottom:1.5px solid ${w}40;
}
.body-text{font-size:13pt;line-height:2.2;white-space:pre-wrap}
.body-text strong{font-weight:700}
.footer{
  margin-top:auto;padding-top:10px;
  border-top:2px solid ${w};
  text-align:center;font-size:8pt;color:#888;
}
@media print{.page{width:100%;min-height:100vh}}
</style>
</head><body>
<div class="page">
<div class="page-inner">
  <div class="office-header">
    <div class="office-brand">
      ${l?.logoUrl?`<img src="${l.logoUrl}" alt="شعار" class="office-logo"/>`:`<div style="width:50px;height:50px;border-radius:10px;background:${u};display:flex;align-items:center;justify-content:center;color:#fff;font-size:18pt;font-weight:900">${N[0]}</div>`}
      <div>
        <div class="office-name">${N}</div>
        ${l?.officeNameEn?`<div class="office-name-en">${l.officeNameEn}</div>`:""}
        <div class="office-contact">
          ${l?.phone?`📞 ${l.phone}`:""}${l?.email?` &nbsp;|&nbsp; ✉ ${l.email}`:""}${l?.address?`<br>📍 ${l.address}`:""}
          ${l?.licenseNo?`<br>🪪 رقم الترخيص: ${l.licenseNo}`:""}
        </div>
      </div>
    </div>
    <div style="text-align:left;font-size:9pt;color:#888;margin-top:4px">
      التاريخ: ${new Date().toLocaleDateString("ar-SA-u-nu-latn",{day:"2-digit",month:"long",year:"numeric"})}
    </div>
  </div>
  <div class="doc-title">${t?.title??""}</div>
  <div class="body-text">${r.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,`
`)}</div>

  <div style="display:flex;justify-content:space-between;margin-top:48px;padding-top:16px;border-top:1px solid #ddd">
    <div style="text-align:center;width:160px">
      ${l?.signatureUrl?`<img src="${l.signatureUrl}" alt="توقيع" style="height:56px;object-fit:contain;margin-bottom:4px;display:block;margin-inline:auto"/>`:'<div style="height:56px"></div>'}
      <div style="border-top:1.5px solid #aaa;padding-top:4px;font-size:8pt;color:#888">توقيع المسؤول</div>
      <div style="font-size:9pt;font-weight:700;margin-top:4px;color:${u}">${N}</div>
    </div>
    <div style="text-align:center;width:100px">
      ${l?.stampUrl?`<img src="${l.stampUrl}" alt="ختم" style="height:64px;width:64px;object-fit:contain;margin:0 auto 4px;display:block"/>`:'<div style="height:64px;width:64px;border:2px dashed #ccc;border-radius:50%;margin:0 auto"></div>'}
      <div style="border-top:1.5px solid #aaa;padding-top:4px;font-size:8pt;color:#888">ختم المكتب</div>
    </div>
  </div>

  ${Z?`<div class="footer" style="margin-top:20px">تم إنشاء هذا الخطاب بواسطة منصة عدالة AI · ${l?.website||""}</div>`:l?.website?`<div class="footer" style="margin-top:20px">${l.website}</div>`:""}
</div>
</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),500))<\/script>
</body></html>`),a.document.close()}return e.jsxs("div",{className:"space-y-6 h-full",children:[e.jsxs("div",{className:"flex items-center justify-between flex-wrap gap-3",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-2xl font-black",children:"نماذج الخطابات والمراسلات"}),e.jsx("p",{className:"text-muted-foreground text-sm",children:"نماذج قانونية جاهزة قابلة للتخصيص"})]}),e.jsxs(L,{variant:"outline",className:"border-primary/30 text-primary",children:[P.length," نموذج جاهز"]})]}),e.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-200px)] min-h-[600px]",children:[e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsxs("div",{className:"relative",children:[e.jsx(pe,{className:"absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"}),e.jsx(d,{value:s,onChange:a=>B(a.target.value),placeholder:"بحث في النماذج...",className:"pe-9"})]}),e.jsx("div",{className:"flex flex-wrap gap-1.5",children:R.map(a=>e.jsx("button",{onClick:()=>E(a.id),className:$("px-3 py-1 rounded-full text-xs font-semibold border transition-all",c===a.id?"bg-primary text-primary-foreground border-primary":"border-border text-muted-foreground hover:border-primary/50 hover:text-primary"),children:a.label},a.id))}),e.jsx(C,{className:"flex-1",children:e.jsxs("div",{className:"space-y-2 ps-1",children:[F.map(a=>e.jsx("button",{onClick:()=>V(a),className:$("w-full text-right p-3 rounded-xl border transition-all hover:border-primary/40",t?.id===a.id?"bg-primary/10 border-primary/50":"bg-card/50 border-border/50 hover:bg-muted/30"),children:e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx(g,{className:$("h-4 w-4 mt-0.5 shrink-0",t?.id===a.id?"text-primary":"text-muted-foreground")}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsx("div",{className:"font-semibold text-sm leading-tight",children:a.title}),e.jsx("div",{className:"text-[11px] text-muted-foreground mt-0.5 leading-snug",children:a.description}),e.jsx(L,{variant:"outline",className:"mt-1.5 text-[9px] px-1.5 py-0",children:R.find(l=>l.id===a.category)?.label})]}),t?.id===a.id&&e.jsx(ue,{className:"h-4 w-4 text-primary shrink-0"})]})},a.id)),F.length===0&&e.jsxs("div",{className:"text-center py-10 text-muted-foreground text-sm",children:[e.jsx(g,{className:"h-8 w-8 mx-auto mb-2 opacity-30"}),"لا توجد نماذج مطابقة"]})]})})]}),e.jsx("div",{className:"flex flex-col gap-3",children:t?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"p-3 rounded-xl bg-primary/5 border border-primary/20",children:[e.jsx("div",{className:"font-bold text-sm text-primary",children:t.title}),e.jsx("div",{className:"text-[11px] text-muted-foreground",children:t.description})]}),e.jsx(C,{className:"flex-1",children:e.jsx("div",{className:"space-y-3 ps-1",children:t.fields.map(a=>e.jsxs("div",{children:[e.jsx(b,{className:"text-xs font-semibold mb-1 block",children:a.label}),a.multiline?e.jsx(le,{value:y[a.key]??"",onChange:l=>v(n=>({...n,[a.key]:l.target.value})),placeholder:a.placeholder,className:"text-sm resize-none",rows:3}):e.jsx(d,{value:y[a.key]??"",onChange:l=>v(n=>({...n,[a.key]:l.target.value})),placeholder:a.placeholder,className:"text-sm"})]},a.key))})})]}):e.jsxs("div",{className:"flex-1 flex flex-col items-center justify-center text-center text-muted-foreground gap-3",children:[e.jsx(g,{className:"h-12 w-12 opacity-20"}),e.jsx("div",{className:"text-sm",children:"اختر نموذجاً من القائمة لتعبئة بياناته"})]})}),e.jsx("div",{className:"flex flex-col gap-3",children:t?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"flex items-center gap-1.5 flex-wrap",children:[e.jsx("span",{className:"text-xs font-semibold text-muted-foreground flex-1",children:"معاينة الخطاب"}),e.jsxs(h,{size:"sm",variant:"outline",onClick:W,className:"h-7 text-xs gap-1.5",children:[T?e.jsx(I,{className:"h-3.5 w-3.5 text-emerald-400"}):e.jsx(ge,{className:"h-3.5 w-3.5"}),T?"تم النسخ":"نسخ"]}),e.jsxs(h,{size:"sm",variant:"outline",onClick:X,className:"h-7 text-xs gap-1.5",children:[e.jsx(fe,{className:"h-3.5 w-3.5"})," طباعة"]}),e.jsxs(h,{size:"sm",onClick:G,className:"h-7 text-xs gap-1.5 bg-primary hover:bg-primary/90",children:[e.jsx(S,{className:"h-3.5 w-3.5"})," إرسال بالبريد"]})]}),e.jsx(ne,{className:"flex-1 border-border/50",children:e.jsx(C,{className:"h-full",children:e.jsx("div",{ref:Y,className:"p-5 text-sm leading-8 whitespace-pre-wrap font-[Cairo,sans-serif]",dangerouslySetInnerHTML:{__html:r.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\[(\w+)\]/g,'<span class="bg-yellow-500/20 text-yellow-400 px-1 rounded text-xs">[$1]</span>')}})})})]}):e.jsxs("div",{className:"flex-1 rounded-xl border border-dashed border-border/40 flex flex-col items-center justify-center text-center text-muted-foreground gap-3",children:[e.jsx(ye,{className:"h-10 w-10 opacity-20"}),e.jsx("div",{className:"text-sm",children:"ستظهر معاينة الخطاب هنا"})]})})]}),e.jsx(de,{open:q,onOpenChange:_,children:e.jsxs(ce,{className:"max-w-md",children:[e.jsx(te,{children:e.jsxs(ie,{className:"flex items-center gap-2",children:[e.jsx(S,{className:"h-4 w-4 text-primary"}),"إرسال الخطاب بالبريد الإلكتروني"]})}),x&&!x.configured&&e.jsxs("div",{className:"flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300",children:[e.jsx(ve,{className:"h-3.5 w-3.5 mt-0.5 shrink-0"}),e.jsx("span",{children:"لم يتم إعداد خادم البريد (SMTP) بعد — سيُفتح برنامج بريدك الإلكتروني تلقائياً لإكمال الإرسال."})]}),x?.configured&&e.jsxs("div",{className:"flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300",children:[e.jsx(I,{className:"h-3.5 w-3.5 shrink-0"}),"خادم البريد مُهيّأ — سيتم الإرسال مباشرة"]}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{children:[e.jsx(b,{className:"text-xs font-semibold mb-1 block",children:"البريد الإلكتروني للمستلم *"}),e.jsx(d,{type:"email",value:o,onChange:a=>O(a.target.value),placeholder:"client@example.com",dir:"ltr"})]}),e.jsxs("div",{children:[e.jsx(b,{className:"text-xs font-semibold mb-1 block",children:"اسم المستلم"}),e.jsx(d,{value:z,onChange:a=>H(a.target.value),placeholder:"محمد عبدالله"})]}),e.jsxs("div",{children:[e.jsx(b,{className:"text-xs font-semibold mb-1 block",children:"موضوع الرسالة *"}),e.jsx(d,{value:p,onChange:a=>D(a.target.value),placeholder:t?.title??"موضوع الخطاب"})]}),e.jsxs("div",{children:[e.jsx(b,{className:"text-xs font-semibold mb-1 block",children:"اسم المُرسِل / المكتب"}),e.jsx(d,{value:A,onChange:a=>Q(a.target.value),placeholder:"مكتب المحاماة / اسم المحامي"})]}),e.jsxs("div",{className:"rounded-lg bg-muted/30 border border-border/40 p-3 text-xs text-muted-foreground leading-6 max-h-24 overflow-hidden relative",children:[e.jsxs("div",{className:"line-clamp-3",children:[r.replace(/\*\*/g,"").slice(0,200),"..."]}),e.jsx("div",{className:"absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background/80 to-transparent"})]})]}),e.jsxs(se,{className:"gap-2 flex-col sm:flex-row",children:[!x?.configured&&e.jsxs(h,{variant:"outline",onClick:K,disabled:!o,className:"gap-2 flex-1",children:[e.jsx(S,{className:"h-4 w-4"})," فتح في برنامج البريد"]}),e.jsxs(h,{onClick:J,disabled:!o||!p||k.isPending,className:"gap-2 flex-1",children:[k.isPending?e.jsx(je,{className:"h-4 w-4 animate-spin"}):e.jsx(_e,{className:"h-4 w-4"}),x?.configured?"إرسال الآن":"إرسال عبر البريد"]})]})]})})]})}export{Re as default};
