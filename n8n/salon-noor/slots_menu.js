// Builds the time menu from GET /availability (full response).
const store = $getWorkflowStaticData('global');
const chatId = $('Conversation Router').first().json.chatId;
const esc = (x) => String(x ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const res = $input.first().json;
const s = store.sessions?.[chatId] || {};
const dayMenu = () => (s.days || []).map((d, i) => `${i + 1}. ${d.label}`).join('\n');

if (!(res.statusCode >= 200 && res.statusCode < 300 && res.body?.ok)) {
  s.step = 'day';
  s.updatedAt = Date.now();
  store.sessions[chatId] = s;
  return [{ json: { chatId, text: `${esc(res.body?.error?.message || 'تعذّر تحميل المواعيد.')}\nاختاري يومًا آخر:\n${dayMenu()}` } }];
}

// With "any specialist" several specialists share a time: offer each time once.
const seen = new Set();
const slots = [];
for (const sl of res.body.data || []) {
  if (seen.has(sl.starts_at)) continue;
  seen.add(sl.starts_at);
  slots.push({ starts_at: sl.starts_at, local_time: sl.local_time, specialist_id: sl.specialist_id, specialist_name: sl.specialist_name });
}
if (!slots.length) {
  s.step = 'day';
  s.updatedAt = Date.now();
  store.sessions[chatId] = s;
  return [{ json: { chatId, text: `لا توجد مواعيد متاحة في ${esc(s.dayLabel)}. اختاري يومًا آخر:\n${dayMenu()}` } }];
}
// Long days: offer half-hour starts only, so the list stays readable.
const compact = slots.length > 30 ? slots.filter((sl) => /:(00|30)$/.test(sl.local_time)) : slots;
s.slots = compact.slice(0, 30);
s.step = 'slot';
s.updatedAt = Date.now();
store.sessions[chatId] = s;
const lines = s.slots.map((sl, i) => `${i + 1}. ${sl.local_time}${s.specialist ? '' : ` (${esc(sl.specialist_name)})`}`);
return [{ json: { chatId, text: `المواعيد المتاحة يوم ${esc(s.dayLabel)} (أرسلي الرقم):\n${lines.join('\n')}` } }];
