// Interprets POST /bookings. Success is reported ONLY when the platform
// answered ok:true with status "confirmed" (auto-confirm) or "pending".
const store = $getWorkflowStaticData('global');
const chatId = $('Conversation Router').first().json.chatId;
const esc = (x) => String(x ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const res = $input.first().json;
const s = store.sessions?.[chatId] || {};
const b = res.body?.data;

if ((res.statusCode === 201 || res.statusCode === 200) && res.body?.ok && (b?.status === 'confirmed' || b?.status === 'pending')) {
  store.sessions[chatId] = { step: 'done', updatedAt: Date.now() };
  const when = DateTime.fromISO(b.starts_at).setZone(b.timezone).setLocale('ar').toFormat('cccc d/M — HH:mm');
  return [{ json: { chatId, text:
    (b.status === 'confirmed' ? `✅ تم <b>تأكيد</b> حجزك، ننتظرك!\n` : `✅ تم استلام طلب حجزك وهو <b>بانتظار تأكيد الصالون</b>.\n`) +
    `الخدمة: ${esc(b.service?.name)}\nالأخصائية: ${esc(b.specialist?.full_name)}\nالموعد: ${esc(when)}\n` +
    `رقم الحجز: <code>${esc(String(b.id).slice(0, 8))}</code>` +
    (b.status === 'pending' ? `\n\nسنرسل لك رسالة هنا عند التأكيد.` : '') } }];
}

const code = res.body?.error?.code;
const message = res.body?.error?.message || 'تعذّر إتمام الحجز، حاولي مرة أخرى.';
if (code === 'SLOT_UNAVAILABLE') {
  s.step = 'day';
  s.updatedAt = Date.now();
  store.sessions[chatId] = s;
  const days = (s.days || []).map((d, i) => `${i + 1}. ${d.label}`).join('\n');
  return [{ json: { chatId, text: `⚠️ ${esc(message)}\nاختاري اليوم من جديد:\n${days}` } }];
}
if (code === 'INVALID_CUSTOMER') {
  s.step = 'name';
  s.updatedAt = Date.now();
  store.sessions[chatId] = s;
  return [{ json: { chatId, text: `⚠️ ${esc(message)}\nما اسمك الكامل؟` } }];
}
// Network/5xx: keep the same idempotency key so a retry cannot double-book.
if (!res.statusCode || res.statusCode >= 500) {
  s.step = 'confirm';
  s.updatedAt = Date.now();
  store.sessions[chatId] = s;
  return [{ json: { chatId, text: '⚠️ لم يتأكد تسجيل الحجز بسبب خطأ مؤقت. أرسلي 1 لإعادة المحاولة (لن يتكرر الحجز)، أو 2 للإلغاء.' } }];
}
store.sessions[chatId] = { step: 'start', updatedAt: Date.now() };
return [{ json: { chatId, text: `⚠️ ${esc(message)}\nأرسلي «حجز» للبدء من جديد.` } }];
