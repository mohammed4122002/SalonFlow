// Conversation state per Telegram chat (kept in workflow static data,
// persisted for production executions). Decides the next action.
const store = $getWorkflowStaticData('global');
store.sessions = store.sessions || {};
const SESSION_TTL_MS = 30 * 60 * 1000;

const update = $input.first().json;
const msg = update.message || {};
const chatId = String(msg.chat?.id ?? '');
const text = String(msg.text ?? '').trim();
if (!chatId) return [];

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const toLatin = (s) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const pick = (list) => {
  const n = parseInt(toLatin(text), 10);
  return Number.isInteger(n) && n >= 1 && n <= list.length ? list[n - 1] : null;
};

let s = store.sessions[chatId];
if (!s || Date.now() - (s.updatedAt || 0) > SESSION_TTL_MS) s = { step: 'start' };
const save = () => { s.updatedAt = Date.now(); store.sessions[chatId] = s; };
const out = (action, extra = {}) => { save(); return [{ json: { chatId, action, ...extra } }]; };
const reply = (t) => out('reply', { text: t });

const dayMenu = () => {
  const lines = s.days.map((d, i) => `${i + 1}. ${d.label}`);
  return `اختاري اليوم (أرسلي الرقم):\n${lines.join('\n')}`;
};

const restartWords = ['/start', 'start', 'ابدأ', 'حجز', 'إلغاء', 'الغاء', '/cancel', 'رجوع'];
if (s.step === 'start' || restartWords.includes(text.toLowerCase())) {
  s = { step: 'loading' };
  return out('services');
}

switch (s.step) {
  case 'service': {
    const sv = pick(s.services);
    if (!sv) return reply('أرسلي رقم الخدمة من القائمة، أو «إلغاء» للبدء من جديد.');
    s.service = sv;
    s.step = 'loading';
    return out('specialists', { serviceId: sv.id });
  }
  case 'specialist': {
    const n = parseInt(toLatin(text), 10);
    if (n === 0) s.specialist = null;
    else {
      const sp = pick(s.specialists);
      if (!sp) return reply('أرسلي رقم الأخصائية، أو 0 لأي أخصائية متاحة.');
      s.specialist = sp;
    }
    const tz = s.timezone || 'UTC';
    const now = DateTime.now().setZone(tz);
    s.days = Array.from({ length: 7 }, (_, i) => {
      const d = now.plus({ days: i });
      return { date: d.toFormat('yyyy-MM-dd'), label: `${d.setLocale('ar').toFormat('cccc')} ${d.toFormat('d/M')}` };
    });
    s.step = 'day';
    return reply(dayMenu());
  }
  case 'day': {
    const d = pick(s.days);
    if (!d) return reply(dayMenu());
    s.date = d.date;
    s.dayLabel = d.label;
    s.step = 'loading';
    return out('slots', { serviceId: s.service.id, date: d.date, specialistId: s.specialist?.id ?? '' });
  }
  case 'slot': {
    const sl = pick(s.slots);
    if (!sl) return reply('أرسلي رقم الوقت من القائمة.');
    s.slot = sl;
    s.step = 'name';
    return reply('ما اسمك الكامل؟');
  }
  case 'name': {
    if (text.length < 2 || text.length > 120) return reply('أرسلي الاسم الكامل (حرفان على الأقل).');
    s.name = text;
    s.step = 'phone';
    return reply('رقم الهاتف؟ (مثال: +970599000000)');
  }
  case 'phone': {
    const phone = toLatin(text).replace(/[\s\-()]/g, '');
    if (!/^\+?\d{7,15}$/.test(phone)) return reply('رقم الهاتف غير صحيح، أعيدي كتابته بالأرقام.');
    s.phone = phone;
    s.step = 'email';
    return reply('البريد الإلكتروني؟ (لإرسال تفاصيل الحجز)');
  }
  case 'email': {
    const email = text.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return reply('البريد غير صحيح، أعيدي كتابته.');
    s.email = email;
    s.attempt = `tg-${chatId}-${Date.now()}`; // fixed per confirmation → safe retries
    s.step = 'confirm';
    const who = s.slot.specialist_name;
    return reply(
      `<b>راجعي طلبك:</b>\n` +
      `الخدمة: ${esc(s.service.name)}\n` +
      `الأخصائية: ${esc(who)}\n` +
      `الموعد: ${esc(s.dayLabel || s.date)} الساعة ${esc(s.slot.local_time)}\n` +
      `الاسم: ${esc(s.name)}\nالهاتف: ${esc(s.phone)}\nالبريد: ${esc(s.email)}\n\n` +
      `أرسلي 1 للتأكيد، أو 2 للإلغاء.`,
    );
  }
  case 'confirm': {
    const n = parseInt(toLatin(text), 10);
    if (n === 2) { s = { step: 'start' }; return reply('تم إلغاء الطلب. أرسلي «حجز» للبدء من جديد.'); }
    if (n !== 1) return reply('أرسلي 1 للتأكيد، أو 2 للإلغاء.');
    s.step = 'submitting';
    return out('create', {
      idempotencyKey: s.attempt,
      body: {
        service_id: s.service.id,
        specialist_id: s.slot.specialist_id,
        starts_at: s.slot.starts_at,
        customer: { full_name: s.name, phone: s.phone, email: s.email },
        channel_ref: `tg:${chatId}`,
      },
    });
  }
  case 'submitting':
    return reply('جارٍ تسجيل طلبك، لحظة من فضلك…');
  case 'done':
    s = { step: 'loading' };
    return out('services');
  default:
    s = { step: 'loading' };
    return out('services');
}
