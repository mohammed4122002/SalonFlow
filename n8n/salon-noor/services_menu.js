// Builds the services menu from GET /salon + GET /services (full responses).
const store = $getWorkflowStaticData('global');
store.sessions = store.sessions || {};
const chatId = $('Conversation Router').first().json.chatId;
const esc = (x) => String(x ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const salonRes = $('Get Salon').first().json;
const svcRes = $input.first().json;

const failed = [salonRes, svcRes].find((r) => !(r.statusCode >= 200 && r.statusCode < 300 && r.body?.ok));
if (failed) {
  store.sessions[chatId] = { step: 'start', updatedAt: Date.now() };
  const m = failed.body?.error?.message || 'الخدمة غير متاحة حاليًا، حاولي لاحقًا.';
  return [{ json: { chatId, text: esc(m) } }];
}

const salon = salonRes.body.data;
const services = svcRes.body.data || [];
if (!services.length) {
  store.sessions[chatId] = { step: 'start', updatedAt: Date.now() };
  return [{ json: { chatId, text: 'لا توجد خدمات متاحة للحجز حاليًا.' } }];
}
store.sessions[chatId] = {
  step: 'service',
  timezone: salon.timezone,
  services: services.map((s) => ({ id: s.id, name: s.name })),
  updatedAt: Date.now(),
};
const lines = services.map((s, i) => `${i + 1}. ${esc(s.name)} — ${s.duration_minutes} دقيقة — ${s.price} ${esc(s.currency)}`);
return [{ json: { chatId, text: `أهلًا بك في <b>${esc(salon.name)}</b> 🌸\nاختاري الخدمة (أرسلي الرقم):\n${lines.join('\n')}\n\nفي أي وقت أرسلي «إلغاء» للبدء من جديد.` } }];
