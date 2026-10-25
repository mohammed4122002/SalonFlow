// Compares SalonFlow's signature with the HMAC computed by "Compute HMAC",
// rejects stale requests, and builds the customer's Telegram message.
const req = $input.first().json;
const expected = 'sha256=' + String(req.expectedSignature || '');
const got = String(req.headers?.['x-salonflow-signature'] || '');
let diff = got.length ^ expected.length;
for (let i = 0; i < Math.min(got.length, expected.length); i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
if (diff !== 0) return []; // forged or altered request: ignore
const body = req.body || {};
if (Math.abs(Date.now() - Date.parse(body.sent_at)) > 10 * 60 * 1000) return []; // stale / replayed

const event = body.event;
const b = body.data || {};
const ref = String(b.channel_ref || '');
if (!ref.startsWith('tg:')) return []; // test event, or booking not made through this bot
const chatId = ref.slice(3);

const esc = (x) => String(x ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const when = DateTime.fromISO(b.starts_at).setZone(b.timezone || 'UTC').setLocale('ar').toFormat('cccc d/M — HH:mm');
const details = `الخدمة: ${esc(b.service?.name)}\nالأخصائية: ${esc(b.specialist?.full_name)}\nالموعد: ${esc(when)}`;
let text;
if (event === 'booking.confirmed') text = `🎉 تم <b>تأكيد</b> حجزك في ${esc(b.salon?.name)}.\n${details}\nننتظرك!`;
else if (event === 'booking.cancelled') text = `❌ تم <b>إلغاء</b> حجزك في ${esc(b.salon?.name)}.\n${details}\nيمكنك حجز موعد جديد بإرسال «حجز».`;
else return [];
return [{ json: { chatId, text } }];
