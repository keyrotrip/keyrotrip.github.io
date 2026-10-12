-- ═══════════════════════════════════════════════════════════════════════════
-- 120 · 새 가입의 기본 이름을 «메일 아이디» 대신 「여행자 1234」로 (2026-10-12)
-- ═══════════════════════════════════════════════════════════════════════════
-- 사용자: 「우리 닉네임은 무조건 설정하도록 되어있나?」 → (안내) → 「1번으로 가고」.
--
-- 까닭: 104 까지의 가입 트리거는 첫 이름으로 **메일 앞부분**을 넣었습니다(minji@gmail.com → 「minji」).
--   이름은 한줄평 · 일행 목록 · 친구 찾기(똑같은 이름으로만 찾음)에서 다른 사람에게 보입니다 —
--   첫 화면에 「이메일만 받아요」라고 적어 놓고 메일 아이디를 공개 이름으로 쓰는 셈이었고,
--   ⚠ 바로잡음(10-12): 친구 찾기(db/106 people_find)는 «이름 == 메일 아이디»인 사람을 이미 결과에서 뺍니다 —
--   처음 안내에서 「메일 아이디를 알면 이름 찾기로 찾을 수 있다」고 한 것은 틀렸습니다. 남은 문제는 «보이는 것»(한줄평·일행).
--   새 기본 이름 「여행자 1234」는 메일과 달라 찾기에서 안 빠집니다(누가 그 이름을 알면 찾힘 — 메일과 무관하니 괜찮음).
--
-- 바꾼 것: 기본 이름 = 「여행자 」 + 숫자 네 자리. 겹치면 다시 뽑고(네 자리 열 번), 그래도 겹치면 여섯 자리
--   열 번, 그래도면 이름 없이(null — 화면이 「이름을 정해 주세요」·남에게는 「여행자」).
--   ⚠ 이름 규칙은 그대로 지킵니다: 30자 안 · 못 쓰는 이름(name_reserved) 아님 · 겹침은 name_key 로 봄(공백 무시라
--     「여행자 1234」와 「여행자1234」는 같은 이름) · 동시 가입으로 겹치면 unique_violation 을 받아 null.
--   ⚠ 이미 가입한 사람의 이름은 안 건드립니다.
--
-- ⚠ 바탕은 «마지막으로 이 함수를 만든 파일» db/104_no_google_profile.sql 입니다(관리자 화면 기록의 교훈 —
--   옛 파일을 바탕으로 쓰면 그 뒤에 고친 것이 되돌아갑니다). 104 에서 지킨 것: 가입 막기(signup_on) 검사 ·
--   구글 이름·사진을 안 가져옴(avatar_url null) · user_prefs 줄 만들기. 셋 다 그대로입니다.
-- ⚠ 트리거(on_auth_user_created, db/001)는 이 함수를 이름으로 부르므로 다시 만들 필요가 없습니다.
-- 여러 번 돌려도 안전합니다(create or replace).

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_try  int := 0;
  v_max  int;
begin
  if not coalesce((select (value->>'on')::boolean
                     from public.app_settings where key='signup_on'), true) then
    raise exception '지금은 새로 가입할 수 없어요. 잠시 뒤 다시 시도해 주세요.';
  end if;

  -- 「여행자 1234」 — 안 겹치는 것을 찾을 때까지(최대 스무 번).
  loop
    v_try := v_try + 1;
    if v_try > 20 then v_name := null; exit; end if;
    v_max := case when v_try <= 10 then 10000 else 1000000 end;
    v_name := '여행자 ' || lpad(floor(random() * v_max)::int::text,
                                case when v_try <= 10 then 4 else 6 end, '0');
    exit when not public.name_reserved(v_name)
          and not exists (select 1 from public.profiles p
                           where public.name_key(p.display_name) = public.name_key(v_name));
  end loop;

  begin
    insert into public.profiles (id, display_name, avatar_url)
    values (new.id, v_name, null) on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, display_name, avatar_url)
    values (new.id, null, null) on conflict (id) do nothing;
  end;

  insert into public.user_prefs (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;


-- ── 확인 ─────────────────────────────────────────────────────────────
-- 모두 true 면 됩니다. (실제로 가입해 보지 않고 함수 본문과 트리거 연결만 봅니다.)
select '기본 이름이 「여행자 숫자」'      as 항목,
       pg_get_functiondef('public.handle_new_user'::regproc) like '%여행자 %' as ok
union all select '메일 앞부분을 더는 안 씀',
       pg_get_functiondef('public.handle_new_user'::regproc) not like '%split_part(new.email%'
union all select '가입 막기(signup_on) 검사 남음',
       pg_get_functiondef('public.handle_new_user'::regproc) like '%signup_on%'
union all select '구글 사진 안 가져옴(avatar_url null)',
       pg_get_functiondef('public.handle_new_user'::regproc) like '%values (new.id, v_name, null)%'
union all select '가입 트리거가 이 함수를 부름',
       exists (select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
                where t.tgname = 'on_auth_user_created' and p.proname = 'handle_new_user')
union all select '「여행자 1234」는 쓸 수 있는 이름',
       not public.name_reserved('여행자 1234') and char_length('여행자 123456') <= 30;
