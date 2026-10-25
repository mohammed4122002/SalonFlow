# n8n workflows

Each salon gets its own pair of n8n workflows. The source of every Code node is
kept here, so changes are reviewed in git and then pasted into n8n.

## `salon-noor/`: salon «نور»

### 1. «SalonFlow — بوت حجز صالون نور (Telegram)»

```
Telegram Trigger ─► Conversation Router ─► Switch(action)
   services    ─► GET /salon ─► GET /services ─► Services Menu    ─┐
   specialists ─► GET /specialists            ─► Specialists Menu ─┤
   slots       ─► GET /availability           ─► Slots Menu       ─┼─► Telegram: Send Reply
   create      ─► POST /bookings              ─► Booking Result   ─┤
   reply       ───────────────────────────────────────────────────┘
```

- Fixed conversation steps, no AI: service → specialist (or «any») → day → time → name → phone → email → summary → confirm.
- Each customer's state is kept in the workflow's Static Data, keyed by `chat_id`. A session expires after 30 minutes. «حجز» or «إلغاء» starts over.
- Every HTTP node uses `neverError` + `fullResponse`, so the Code nodes read both the status code and `error.message` and show the Arabic message to the customer.
- Success is shown **only** when the API answers `ok: true` and `status = "pending"`.
- `Idempotency-Key = tg-<chat_id>-<time the summary was shown>`, fixed for each confirmation. A retry after a network error cannot create two bookings.
- `SLOT_UNAVAILABLE` sends the customer back to pick a day again.

Files: `router.js`, `services_menu.js`, `specialists_menu.js`, `slots_menu.js`, `booking_result.js`.

### 2. «SalonFlow — إشعارات صالون نور (Webhook)»

```
Webhook POST /webhook/salonflow-noor ─► Crypto: HMAC-SHA256(body, secret) ─► Check Signature & Build Message ─► Telegram
```

- Requests with a bad signature, or older than 10 minutes, are ignored.
- Only bookings with `channel_ref = tg:<chat_id>` get a Telegram message. Website bookings and `test` events are skipped.

File: `check_webhook.js`. A built-in Crypto node is used because self-hosted n8n blocks `require('crypto')` in Code nodes by default.

## Setup (once per salon)

1. **Telegram bot:** create a bot with `@BotFather` and add its token as a Telegram credential in n8n. Use it in all three Telegram nodes (Trigger, Send Reply, Notify Customer).
2. **API key:** in the salon dashboard, open «الربط (n8n)» and click «توليد مفتاح API». In n8n, open the credential «SalonFlow API — صالون نور» and set the `Authorization` header to `Bearer sf_live_…`.
3. **Signing secret:** from the same page, copy the secret with «نسخ السر» and paste it into the `secret` field of the «Compute HMAC» node.
4. Activate (Publish) both workflows.
5. Copy the Production URL of the notifications Webhook node (`https://<n8n>/webhook/salonflow-noor`) into «رابط Webhook» in the salon's settings, save, then click «إرسال إشعار تجريبي».

Test locally without n8n: the scratchpad simulator runs these files unchanged against `next start` (13/13 conversation checks, 4/4 signature checks).
