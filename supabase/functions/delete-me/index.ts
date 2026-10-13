// =====================================================================
// 탈퇴 — Supabase Edge Function
//
// 왜 서버가 필요한가
//   계정(auth.users) 자체를 지우는 것은 서비스 키로만 됩니다.
//   그 키는 화면에 두면 안 됩니다 — 공개 저장소에 그대로 올라가고,
//   가진 사람은 남의 계정도 지울 수 있습니다.
//   그래서 여기서만 씁니다. 그리고 **부른 사람 본인만** 지웁니다.
//
// 올리는 법 (CLI 없이 대시보드에서)
//   1. Supabase → Edge Functions → Deploy a new function → 이름 delete-me
//   2. 이 파일 내용을 그대로 붙여넣고 Deploy
//   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 는 자동으로 들어 있습니다)
//
// 순서가 중요합니다
//   1) 앱 자료 먼저 (delete_my_data) — 계정을 먼저 지우면 외래키에 걸려 실패합니다
//   2) 그 다음 계정
//   1)만 되고 2)가 실패하면 자료는 지워지고 계정만 남습니다.
//   그 경우를 숨기지 않고 그대로 알려줍니다 — 다시 누르면 이어서 됩니다.
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth) return json({ error: '로그인이 필요해요.' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;

    // 누가 부른 것인지 그 사람의 토큰으로 확인합니다.
    // 이 한 줄이 "남의 계정 지우기"를 막습니다.
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: '로그인이 필요해요.' }, 401);

    // 한 번 더 확인합니다. 화면이 실수로 불러도 그냥은 안 지워집니다.
    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== 'DELETE')
      return json({ error: '확인 값이 없어요.' }, 400);

    // ── 1. 앱 자료 ── 부른 사람의 토큰으로 돕니다.
    // 함수 안에서 auth.uid() 로 본인 것만 건드립니다 (036).
    const { data: summary, error: dataErr } = await asUser.rpc('delete_my_data');
    if (dataErr){
      console.error('delete_my_data', dataErr.message);
      return json({ error: '자료를 지우지 못했어요. 잠시 뒤 다시 해주세요.' }, 500);
    }

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // ── 2. 올린 사진 ──
    // storage.objects.owner 가 auth.users 를 가리킵니다. 파일이 남아 있으면
    // 그 외래키 때문에 **계정 줄이 안 지워집니다.** SQL 쪽에서는 storage 스키마를
    // 못 건드려서(소유자가 다릅니다) 여기서 지웁니다.
    // 실패해도 멈추지 않습니다 — 통이 없을 수도 있고, 그때는 막을 것도 없습니다.
    // b870: 맛집 사진(food-photos)도 — 공개 통이라 남으면 주소로 계속 보입니다. 앱(account.js)도 먼저 지우지만 여기서 한 번 더.
    for (const 통 of ['avatars', 'food-photos']) {
      try {
        const { data: files } = await admin.storage.from(통).list(user.id, { limit: 1000 });
        if (files?.length)
          await admin.storage.from(통)
            .remove(files.map((f) => `${user.id}/${f.name}`));
      } catch { /* 통이 없거나 이미 비었음 */ }
    }

    // ── 3. 계정 ── 여기서만 서비스 키를 씁니다.
    const { error: authErr } = await admin.auth.admin.deleteUser(user.id);
    if (authErr) {
      // GoTrue 는 이럴 때 본문 없이 실패해서 message 가 "{}" 로 옵니다.
      // 그것만 보고는 무엇이 막는지 알 길이 없어 매번 짐작하게 됩니다.
      // 044 의 account_blockers 로 **무엇이 몇 개 남았는지** 세어 같이 보냅니다.
      let left: Record<string, number> | null = null;
      try {
        const { data } = await admin.rpc('account_blockers', { p_user: user.id });
        // 0 인 것은 볼 필요가 없습니다. 남은 것만 남깁니다.
        if (data) left = Object.fromEntries(
          Object.entries(data as Record<string, number>).filter(([, v]) => Number(v) > 0));
      } catch { /* 044 를 아직 안 돌렸을 수 있습니다 */ }

      const detail = left && Object.keys(left).length
        ? Object.entries(left).map(([k, v]) => `${k} ${v}`).join(', ')
        : (authErr.message || '(이유를 못 받았습니다)');
      /* 반쯤 지워진 상태입니다. 무엇이 막고 있는지는 사용자가 손쓸 수 없는
         것이라 로그로 보내고, 화면에는 **지금 상태와 다음에 할 일**만 적습니다.
         구조화된 값(blockers)은 그대로 둡니다 — 화면 쪽이 씁니다. */
      console.error('delete-me blockers', detail);
      return json({
        error: '여행 자료는 다 지웠는데 계정만 남았어요. ' +
               '만든 사람에게 알려주시면 마저 지워드릴게요.',
        partial: true, summary, blockers: left,
      }, 500);
    }

    return json({ ok: true, summary });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
