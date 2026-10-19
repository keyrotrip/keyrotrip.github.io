-- 144 · 알림이 생기면 «바로» 폰 푸시 (2026-10-17)
-- 사용자: 「근데 5분이나 걸려?」 → 「바로 오게 해 보자」.
-- 지금까지: 5분마다(137 의 pg_cron) push 함수가 «보낼 것»(due_pushes, 143)을 모아 보냄 → 늦으면 5분.
-- 바꾼 것: notifications 에 줄이 들어가면(한 번의 넣기마다 한 번) 같은 push 함수를 곧바로 부릅니다 → 몇 초.
--   · 부르는 길은 5분 예약과 똑같습니다(pg_net · Vault 의 push_cron_secret) — push 함수는 안 고침.
--   · pg_net 은 «넣기가 끝난(커밋) 뒤»에 요청을 보냅니다 → 함수가 그 알림을 봅니다.
--   · 5분 예약은 그대로 둡니다(안전망 — 바로 부르기가 실패해도 5분 안에는 감).
--   · 같은 알림 두 번 막기는 push_log(143). 아주 드물게 예약과 겹쳐 두 번 갈 수는 있음.
--   · 실패해도 알림 넣기는 막지 않습니다(예외를 삼킴) — 방명록·답글 쓰기가 푸시 때문에 실패하면 안 됨.
-- 여러 번 실행해도 안전합니다. 되돌리려면: drop trigger if exists notifications_push_now on public.notifications;

create or replace function public.push_now()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform net.http_post(
      url := 'https://qahqqhjleqfrsjiixnas.supabase.co/functions/v1/push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                           where name = 'push_cron_secret' limit 1)),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000);
  exception when others then
    null;   -- 푸시를 못 불러도 알림은 그대로 들어가야 함(5분 예약이 뒤에 보냄)
  end;
  return null;
end $$;
revoke all on function public.push_now() from public, anon, authenticated;

drop trigger if exists notifications_push_now on public.notifications;
create trigger notifications_push_now
  after insert on public.notifications
  for each statement execute function public.push_now();

-- 확인: true 면 된 것
select exists (select 1 from pg_trigger where tgname = 'notifications_push_now') as 바로_푸시;
