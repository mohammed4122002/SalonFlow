// Builds the specialists menu from GET /specialists?service_id= (full response).
const store = $getWorkflowStaticData('global');
const chatId = $('Conversation Router').first().json.chatId;
const esc = (x) => String(x ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const res = $input.first().json;
const s = store.sessions?.[chatId] || {};

if (!(res.statusCode >= 200 && res.statusCode < 300 && res.body?.ok)) {
  store.sessions[chatId] = { step: 'start', updatedAt: Date.now() };
  return [{ json: { chatId, text: esc(res.body?.error?.message || 'تعذّر تحميل الأخصائيات، أرسلي «حجز» للمحاولة مجددًا.') } }];
}
const list = res.body.data || [];
s.specialists = list.map((p) => ({ id: p.id, full_name: p.full_name }));
s.step = 'specialist';
s.updatedAt = Date.now();
store.sessions[chatId] = s;
const lines = list.map((p, i) => `${i + 1}. ${esc(p.full_name)}`);
return [{ json: { chatId, text: `الخدمة: <b>${esc(s.service?.name)}</b>\nاختاري الأخصائية:\n0. أي أخصائية متاحة\n${lines.join('\n')}` } }];
