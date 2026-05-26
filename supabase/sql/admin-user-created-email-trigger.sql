-- Replace ADMIN_USER_CREATED_WEBHOOK_SECRET_HERE before running this SQL.
-- The same value must be stored as the Edge Function secret
-- ADMIN_USER_CREATED_WEBHOOK_SECRET.

create extension if not exists pg_net;

create or replace function public.notify_admin_user_created_email()
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
    url := 'https://eroplxovpnm.supabase.co/functions/v1/admin-user-created-email',
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
      'x-webhook-secret', 'ADMIN_USER_CREATED_WEBHOOK_SECRET_HERE'
    ),
    timeout_milliseconds := 10000
  ) into request_id;

  raise log 'notify_admin_user_created_email queued request_id=% email=%',
    request_id,
    coalesce(safe_record->>'email', '<no email>');

  return new;
end;
$$;

drop trigger if exists notify_admin_user_created_email on public."user";

create trigger notify_admin_user_created_email
after insert on public."user"
for each row
execute function public.notify_admin_user_created_email();
