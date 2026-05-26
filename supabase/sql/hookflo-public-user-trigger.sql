-- Replace the placeholders before running this SQL:
--   HOOKFLO_WEBHOOK_URL_HERE
--   HOOKFLO_WEBHOOK_ID_HERE
--   HOOKFLO_WEBHOOK_TOKEN_HERE

create extension if not exists pg_net;

create or replace function public.notify_hookflo_public_user_insert()
returns trigger
language plpgsql
security definer
set search_path = public, net, pg_temp
as $$
declare
  request_id bigint;
  safe_record jsonb;
begin
  safe_record := to_jsonb(new)
    - 'password'
    - 'verificationToken'
    - 'verificationTokenExpiresAt';

  select net.http_post(
    url := 'HOOKFLO_WEBHOOK_URL_HERE',
    body := jsonb_build_object(
      'type', tg_op,
      'schema', tg_table_schema,
      'table', tg_table_name,
      'record', safe_record,
      'old_record', null
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-id', 'HOOKFLO_WEBHOOK_ID_HERE',
      'x-webhook-token', 'HOOKFLO_WEBHOOK_TOKEN_HERE'
    ),
    timeout_milliseconds := 10000
  ) into request_id;

  raise log 'notify_hookflo_public_user_insert queued request_id=% email=%',
    request_id,
    coalesce(safe_record->>'email', '<no email>');

  return new;
end;
$$;

drop trigger if exists notify_hookflo_public_user_insert on public."user";

create trigger notify_hookflo_public_user_insert
after insert on public."user"
for each row
execute function public.notify_hookflo_public_user_insert();
