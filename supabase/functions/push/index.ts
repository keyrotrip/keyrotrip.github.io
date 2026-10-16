/* 잠금화면 알림을 실제로 보내는 자리.
 *
 * **때가 되면 저절로 도는 일은 여기가 아닙니다.** 이 등급에는 pg_cron 이
 * 없어서(032·042 에 적어둔 것과 같은 사정) GitHub Actions 가 15분마다
 * 이 함수를 부릅니다 — `.github/workflows/push.yml`.
 *
 * 하는 일은 셋뿐입니다.
 *   1. `due_pushes()` 에게 "지금 보낼 것"을 묻는다 (시각 계산은 DB 가 한다)
 *   2. 그 사람의 기기들로 보낸다
 *   3. 보냈다고 적는다 (같은 것을 두 번 안 보내려고)
 *
 * **암호는 직접 안 짭니다.** Web Push 는 VAPID 서명(ES256)과 본문 암호화
 * (aes128gcm + ECDH + HKDF)를 요구하는데, 돈이나 알림이나 직접 짠 암호가
 * 조용히 틀리면 알 방법이 없습니다. 검증된 것을 씁니다.
 */
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL_  = Deno.env.get('SUPABASE_URL')!;
const SRV   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PUB   = Deno.env.get('VAPID_PUBLIC')!;
const PRIV  = Deno.env.get('VAPID_PRIVATE')!;
/* mailto: 는 Web Push 규격이 요구합니다. 보내는 쪽에 문제가 있을 때
   푸시 서비스가 연락할 곳입니다. */
const CONTACT = Deno.env.get('VAPID_CONTACT') || 'mailto:noreply@example.com';

const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });

/* 스케줄러 전용 열쇠(2026-10-16). 함수 비밀값(Edge Functions → Secrets)과 GitHub
   Actions 비밀값 양쪽에 **같은 값**을 넣습니다 — 넣는 법은 docs/운영-설정-확인.md. */
const CRON = Deno.env.get('PUSH_CRON_SECRET') || '';

/* ── 누가 부를 수 있나 (2026-10-16 다시 짬) ───────────────────────────────
 * ⚠⚠ **전에는 «증명이 아닌 것»을 증명으로 받았습니다.** ⚠⚠ 셋 중 하나면 들여보냈는데
 *   ① 함수에 들어온 SUPABASE_SERVICE_ROLE_KEY 와 같음 — 이건 진짜 비밀값 비교
 *   ② `sb_secret_` 로 **시작하기만** 하면 — 아무나 `Bearer sb_secret_아무글자` 를 보내면 통과
 *   ③ 레거시 JWT 의 payload 에 `role: service_role` 이 **적혀만** 있으면 — **서명을 안 봤습니다.**
 *      payload 는 base64 일 뿐이라 누구나 꾸밀 수 있습니다.
 *   ②③을 막아 줄 수 있는 것은 Supabase 게이트웨이의 JWT 검사(verify_jwt) 하나뿐인데,
 *   그것이 켜져 있는지는 이 저장소에서 알 수 없고(설정 파일이 없습니다), ②는 켜져
 *   있어도 지나갈 수 있습니다. 이 함수는 «지금 보낼 알림 전부»를 쏩니다.
 *   (②③을 둔 까닭은 옛 주석에 있던 대로입니다: 스케줄러에 넣은 키와 함수에 자동으로
 *    들어오는 키의 «종류»가 달라 맞는 키인데도 403 이 났습니다. 그 문제는 아래 A 로 풉니다.)
 *
 * → 받는 길을 **둘로 정합니다. 둘 다 «비밀값과 글자까지 같음»** 이고, 시간이 일정한
 *   방식으로 견줍니다(앞글자부터 맞춰 보는 공격을 막으려고).
 *   A. 머리 `x-cron-secret` = 함수 비밀값 `PUSH_CRON_SECRET`   ← 정한 방식(스케줄러 전용 열쇠)
 *   B. `Authorization: Bearer` = 함수에 자동으로 들어오는 `SUPABASE_SERVICE_ROLE_KEY`
 *      ← A 를 운영에 넣기 전까지 지금 스케줄러가 계속 돌게 남긴 길. A 로 옮긴 뒤에도
 *        진짜 비밀값 비교라 위험하지 않지만, 스케줄러가 service_role 을 들고 있을 필요는 없어집니다.
 * ⚠ A 를 «함수에만» 넣고 스케줄러가 아직 머리를 안 보내면 B 로 갑니다. 반대로 스케줄러만
 *   머리를 보내고 함수에 비밀값이 없으면 머리를 무시하고 B 로 갑니다. **어느 순서로 넣어도
 *   멈추지 않게** 짰습니다. 다만 머리를 보냈고 함수에도 비밀값이 있는데 «다르면» 막습니다.
 * ⚠ B 가 지금 실제로 통과하는지는 운영 값에 달렸습니다 — 스케줄러에 넣은 키가 함수의
 *   SUPABASE_SERVICE_ROLE_KEY 와 «글자까지» 같아야 합니다(옛 주석의 403 사연). 다르면
 *   이 판을 올리는 순간 알림이 멈춥니다. **A 를 먼저 넣으십시오**(문서 순서대로). */
export function 같은비밀(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length === 0 || x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

export function allowed(req: Request, env: { cron: string; srv: string } = { cron: CRON, srv: SRV }):
    { ok: boolean; kind: string } {
  const cron = (req.headers.get('x-cron-secret') || '').trim();
  if (env.cron && cron)
    return 같은비밀(cron, env.cron) ? { ok: true, kind: 'cron 비밀값' }
                                    : { ok: false, kind: 'x-cron-secret 이 맞지 않습니다' };
  const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!tok) return { ok: false, kind: '열쇠가 없습니다' };
  if (env.srv && 같은비밀(tok, env.srv)) return { ok: true, kind: 'service_role 키' };
  /* 어느 꼴이 왔는지는 알려 주지 않습니다 — 꾸민 열쇠를 고쳐 오는 데 쓰일 수 있습니다. */
  return { ok: false, kind: '서버 열쇠가 아닙니다' };
}

Deno.serve(async (req) => {
  /* 아무나 부르면 알림을 마구 쏠 수 있습니다. 비밀값을 요구합니다 —
     이 함수는 사람이 아니라 스케줄러가 부릅니다(위 allowed 머리말).
     **막을 때는 무엇이 잘못됐는지 같이 알려줍니다.** 그냥 forbidden 만
     돌려주니 넣은 키가 틀린 건지 이름이 틀린 건지 알 길이 없었습니다.
     키 값은 절대 안 싣습니다 — 이 답은 공개 저장소의 로그에 찍힙니다. */
  const gate = allowed(req);
  if (!gate.ok) return json({ error: 'forbidden', 받은키: gate.kind }, 403);

  /* **터진 이유를 답에 담습니다.** 처음엔 그냥 터지게 뒀더니 스케줄러
     로그에 500 이라는 숫자만 남았습니다. 그 숫자로는 키가 없는 건지
     라이브러리가 안 올라온 건지 가릴 수가 없습니다.
     여기 담기는 것은 오류 문구뿐이고 키 값은 절대 안 실립니다. */
  try {
    return await run();
  } catch (e: any){
    console.error('push', e);
    return json({ error: String(e?.message || e).slice(0, 300) }, 500);
  }

  async function run(){
  /* 비밀값이 하나라도 비면 setVapidDetails 가 알아듣기 힘든 말로 터집니다.
     먼저 세어보고 사람 말로 알려줍니다 — 값이 아니라 있고 없음만. */
  const 빠진것 = [['VAPID_PUBLIC', PUB], ['VAPID_PRIVATE', PRIV]]
    .filter(([, v]) => !v).map(([k]) => k);
  if (빠진것.length)
    return json({ error: `Edge Function 비밀값이 없습니다: ${빠진것.join(', ')}` }, 500);

  const sb = createClient(URL_, SRV);
  webpush.setVapidDetails(CONTACT, PUB, PRIV);

  const { data: due, error } = await sb.rpc('due_pushes');
  if (error){ console.error('due_pushes', error); return json({ error: error.message }, 500); }
  if (!due?.length) return json({ sent: 0, due: 0 });

  /* 사람마다 기기가 여럿입니다. 한 번에 받아서 나눠 씁니다 —
     보낼 것마다 물으면 같은 질의를 수십 번 합니다. */
  const users = [...new Set(due.map((d: any) => d.user_id))];
  const { data: subs } = await sb.from('push_subs')
    .select('user_id,endpoint,p256dh,auth').in('user_id', users);

  const byUser = new Map<string, any[]>();
  for (const s of subs || []){
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id)!.push(s);
  }

  let sent = 0, dead = 0, why = '';
  const gone: string[] = [];

  for (const d of due as any[]){
    const mine = byUser.get(d.user_id) || [];
    if (!mine.length) continue;          /* 켜둔 기기가 없으면 보낼 곳이 없습니다 */

    const payload = JSON.stringify({
      title: d.title, body: d.body, url: d.url || '/',
      /* 같은 일정 알림이 겹치면 덮어씁니다. 기기 하나에 두 장이 쌓이면 안 됩니다. */
      tag: `${d.kind}:${d.ref_id}`,
    });

    let any = false;
    for (const s of mine){
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++; any = true;
      } catch (e: any){
        /* 404·410 은 **그 기기가 사라졌다**는 뜻입니다(앱 삭제·기기 초기화).
           지우지 않으면 15분마다 영원히 실패합니다. */
        if (e?.statusCode === 404 || e?.statusCode === 410){ gone.push(s.endpoint); dead++; }
        else {
          console.error('send', e?.statusCode, e?.body || e?.message);
          /* **첫 실패 이유를 답에도 담습니다.** console 로만 보내면 스케줄러
             로그에는 `sent:0` 만 남아서, 키가 틀린 건지 기기가 죽은 건지
             가릴 수가 없습니다. 여기 담기는 것은 푸시 서비스가 준 문구뿐입니다. */
          if (!why) why = `${e?.statusCode || ''} ${String(e?.body || e?.message || e).slice(0, 200)}`.trim();
        }
      }
    }

    /* **한 기기라도 갔을 때만 적습니다.** 다 실패했는데 적어버리면
       다음 차례에 다시 시도할 기회가 사라집니다. */
    if (any){
      const r = await sb.from('push_log')
        .insert({ user_id: d.user_id, kind: d.kind, ref_id: d.ref_id });
      if (r.error) console.error('log', r.error.message);
    }
  }

  if (gone.length) await sb.from('push_subs').delete().in('endpoint', gone);

  /* **보낸 기록은 영원히 쌓입니다.** 지우는 코드가 없었습니다.
     pg_cron 이 없으니(042 와 같은 사정) 15분마다 지나가는 김에 치웁니다.
     실패해도 알림 보내는 일과는 상관없으므로 조용히 넘어갑니다. */
  sb.rpc('purge_push_log').then((r: any) => {
    if (r.error) console.error('purge', r.error.message);
  });

  return json({ due: due.length, sent, dead, ...(why ? { why } : {}) });
  }   /* run 끝 */
});
