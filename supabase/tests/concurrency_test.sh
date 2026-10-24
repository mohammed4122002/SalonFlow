#!/usr/bin/env bash
# SalonFlow — Phase 1 concurrency check.
# Two separate connections try to book the same specialist/slot at the same
# time. Expected: exactly one succeeds, the other fails with
# "bookings_no_specialist_overlap". All test rows are removed at the end.
#
# Usage: DATABASE_URL="postgresql://..." ./supabase/tests/concurrency_test.sh
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL (Supabase > Connect > Session pooler)}"

PSQL=(psql "$DATABASE_URL" -q -At -v ON_ERROR_STOP=1)
OWNER=11111111-1111-1111-1111-111111111111
SALON=22222222-2222-2222-2222-222222222222
SERVICE=33333333-3333-3333-3333-333333333333
SPECIALIST=44444444-4444-4444-4444-444444444444
CUST1=55555555-5555-5555-5555-555555555551
CUST2=55555555-5555-5555-5555-555555555552

cleanup() {
  "${PSQL[@]}" -c "delete from public.salons where id = '$SALON'; delete from auth.users where id = '$OWNER';" >/dev/null
}
trap cleanup EXIT
cleanup

"${PSQL[@]}" <<EOF
insert into auth.users (id, email) values ('$OWNER', 'concurrency-test@salonflow.invalid');
insert into public.salons (id, owner_id, slug, name, timezone, currency)
  values ('$SALON', '$OWNER', 'concurrency-test', 'Concurrency Test', 'UTC', 'USD');
insert into public.services (id, salon_id, name, duration_minutes, price) values ('$SERVICE', '$SALON', 'Test', 60, 1);
insert into public.specialists (id, salon_id, full_name) values ('$SPECIALIST', '$SALON', 'Test');
insert into public.specialist_services values ('$SALON', '$SPECIALIST', '$SERVICE');
insert into public.customers (id, salon_id, full_name, phone, email) values
  ('$CUST1', '$SALON', 'Customer One', '+10000000001', 'one@salonflow.invalid'),
  ('$CUST2', '$SALON', 'Customer Two', '+10000000002', 'two@salonflow.invalid');
EOF

book() { # $1 customer, $2 seconds to hold the transaction open
  "${PSQL[@]}" <<EOF 2>&1 | grep -E 'OK|ERROR' | head -1
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"$OWNER","role":"authenticated"}', true) \g /dev/null
insert into public.bookings (salon_id, customer_id, service_id, specialist_id, starts_at, ends_at, price)
  values ('$SALON', '$1', '$SERVICE', '$SPECIALIST', '2030-01-01 10:00+00', '2030-01-01 11:00+00', 1);
select pg_sleep($2) \g /dev/null
commit;
select 'OK booked for $1';
EOF
}

book "$CUST1" 3 > /tmp/sf_c1.log &
sleep 0.5
book "$CUST2" 0 > /tmp/sf_c2.log &
wait

echo "connection 1: $(cat /tmp/sf_c1.log)"
echo "connection 2: $(cat /tmp/sf_c2.log)"
COUNT=$("${PSQL[@]}" -c "select count(*) from public.bookings where specialist_id = '$SPECIALIST' and status <> 'cancelled'")
echo "active bookings in the slot: $COUNT"
if [ "$COUNT" = "1" ] && grep -q bookings_no_specialist_overlap /tmp/sf_c2.log; then
  echo "PASS"
else
  echo "FAIL"; exit 1
fi
