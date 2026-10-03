/* ── 내 계정 — 자료 받기 · 버그 알리기 · 탈퇴 ─────────────────────────
 * 프로필 아래쪽에 나란히 있는 셋입니다. 화면은 다르지만 하는 일은 하나 —
 * **내 자료를 내 손으로 다루는 것**입니다.
 *
 *   내려받기  데이터베이스에는 되돌리기가 없습니다. 잘못 지우면 그냥
 *             사라지므로 통째로 받아둘 길을 줍니다. 서버 열쇠를 안 쓰고
 *             내 권한으로만 읽습니다 — **볼 수 있는 것이 곧 내 자료**입니다.
 *   버그 신고 앱 판과 기기 종류만 같이 보냅니다. 일정·지출 내용은 안 보냅니다.
 *   탈퇴      되돌릴 수 없으므로 글자를 그대로 치게 합니다(`DEL_WORD`).
 *
 * ── app.js 에서 떼어낸 스물다섯 번째 조각입니다(b349) ────────────────
 * app.js 만 아는 것은 둘 — 로그인한 사람, 오류 남기기.
 * **밖으로 내보내는 것이 하나도 없습니다.** 셋 다 자기 단추에 자기가
 * 붙으므로 app.js 는 이 파일을 `import` 하기만 하면 됩니다.
 *
 * 층: dom.js · db.js · net.js · trip.js 만 씁니다. 프로필 화면의 '보관함·지도
 *     열기' 손잡이는 **두고 왔습니다** — 바로 아랫줄에 있었지만 그건 화면
 *     넘기기지 내 계정이 아닙니다. */
import { $, esc, toast } from './dom.js?v=b826';
import { sb } from './db.js?v=b826';
import { fail, netTimeout, forgetLocal } from './net.js?v=b826';
import { plans, expenses, bookings } from './trip.js?v=b826';


let ctx = { me: () => null, logError: () => {} };
export function setAccountCtx(o){ ctx = { ...ctx, ...o }; }

/* ── 탈퇴 ───────────────────────────────────────────────────────────
 * 이메일·이름·사진을 모으고 있으니 지울 길이 반드시 있어야 합니다.
 *
 * 세 가지를 지킵니다.
 *   1. **무엇이 지워지는지 누르기 전에 보여줍니다.** "정말요?"만 묻고 실행하면
 *      무엇을 잃는지 모른 채 누르게 됩니다.
 *   2. **글자를 적게 합니다.** 버튼 두 번으로 계정이 사라지면 안 됩니다.
 *   3. **일행이 있는 여행은 안 지웁니다.** 내 계정 하나 지우자고 남의 일정을
 *      없앨 수는 없습니다. 나만 빠지고 주인이면 다음 사람에게 넘깁니다.
 */
const DEL_WORD = '탈퇴합니다';

$('delbtn').addEventListener('click', async () => {
  const box = $('delbox');
  if (!box.classList.contains('hide')){ box.classList.add('hide'); return; }
  box.classList.remove('hide');
  $('delerr').classList.add('hide');
  $('del_word').value = ''; $('del_go').disabled = true;

  const { data, error } = await sb.rpc('delete_preview');
  if (error){
    /* 036 을 아직 안 올렸으면 함수가 없습니다. 세는 것만 건너뛰고 나머지는 그대로. */
    $('delwhat').innerHTML =
      `<div class="empty" style="text-align:left">무엇이 지워지는지 세지 못했어요.<br>
         <span class="memo">${esc(error.message || '')}</span></div>`;
    return;
  }
  const d = data || {};
  const row = (k, v, m) => v ? `<div class="row"><span class="label">${esc(k)}
      ${m ? `<div class="memo">${esc(m)}</div>` : ''}</span>
      <span class="val"><b>${v}</b></span></div>` : '';
  $('delwhat').innerHTML =
    `<div class="daysep">지워지는 것</div>` +
    row('나 혼자인 여행', d.solo_trips, '그 안의 일정·지출·예약까지 함께') +
    row('일정', d.plans) +
    row('지출', d.expenses) +
    row('도시 별점', d.city_ratings) +
    row('가보고 싶은 곳', d.wants) +
    row('맛집·관광지 별점', d.plan_ratings) +
    row('AI 대화', d.chats) +
    `<div class="row"><span class="label">계정
       <div class="memo">이름 · 이메일 · 프로필 사진</div></span>
       <span class="val"><b>삭제</b></span></div>` +
    (d.shared_trips
      ? `<div class="daysep">남는 것</div>
         <div class="row"><span class="label">일행이 있는 여행
           <div class="memo">일정은 그대로 두고 나만 빠져요. 제가 주인이면
             다음 일행에게 넘어가요. 제가 낸 지출은 남지만 결제자 칸이 비워져요</div></span>
           <span class="val"><b>${d.shared_trips}</b></span></div>` : '');
});

$('del_cancel').addEventListener('click', () => {
  $('delbox').classList.add('hide'); $('delerr').classList.add('hide');
});
/* 정확히 적었을 때만 열립니다. 앞뒤 공백은 봐줍니다 — 자동완성이 붙일 때가 있습니다. */
$('del_word').addEventListener('input', () => {
  $('del_go').disabled = $('del_word').value.trim() !== DEL_WORD;
});

$('del_go').addEventListener('click', async () => {
  if ($('del_word').value.trim() !== DEL_WORD) return;
  const b = $('del_go');
  $('delerr').classList.add('hide');
  b.disabled = true; b.innerHTML = '<span class="load">지우는 중…</span>';

  const { data, error } = await sb.functions.invoke('delete-me',
    { body: { confirm: 'DELETE' } });

  if (error || data?.error){
    b.disabled = false; b.textContent = '영구 삭제';
    let why = data?.error || error?.message || '';
    try { why = (await error?.context?.json())?.error || why; } catch {}
    return fail(/not found|Failed to send/i.test(why)
      ? '탈퇴 기능이 아직 준비되지 않았어요. 만든 사람에게 알려주세요.'
      : why, 'del');
  }

  /* 계정이 없어졌으니 남은 토큰도 버리고 첫 화면으로 보냅니다.
     캐시에 남은 내 자료도 지웁니다 — 안 지우면 다음 사람이 그걸 봅니다.
     ⚠ 규칙은 net.js 한 곳입니다(b716) — 로그아웃도 같은 것을 부릅니다. */
  forgetLocal();
  await sb.auth.signOut().catch(() => {});
  alert('탈퇴가 끝났어요. 그동안 고마웠어요.');
  location.replace(location.pathname);
});

/* ── 버그 신고 ──────────────────────────────────────────────────────
 * 앱이 스스로 터진 것(client_errors)만 모으면 절반만 압니다.
 * 제일 흔한 문제는 안 터집니다 — "눌러도 아무 일이 안 나요".
 * 그건 사람이 적어줘야 알 수 있습니다. */
$('rpbtn').addEventListener('click', () => {
  $('rpbox').classList.toggle('hide');
  $('rperr').classList.add('hide');
  if (!$('rpbox').classList.contains('hide')) $('rp_body').focus();
});
$('rp_cancel').addEventListener('click', () => $('rpbox').classList.add('hide'));
$('rpkind').addEventListener('click', e => {
  const b = e.target.closest('[data-rk]'); if (!b) return;
  $('rpkind').querySelectorAll('.day').forEach(x => x.classList.toggle('on', x === b));
});

$('rp_send').addEventListener('click', async () => {
  const b = $('rp_send');
  $('rperr').classList.add('hide');
  const body = $('rp_body').value.trim();
  if (body.length < 5) return fail('무엇이 불편했는지 조금만 더 적어주세요.', 'rp');

  b.disabled = true; b.innerHTML = '<span class="load">보내는 중…</span>';
  const r = await netTimeout(sb.from('reports').insert({
    user_id: ctx.me().id,
    kind: $('rpkind').querySelector('.on')?.dataset.rk || '버그',
    body,
    /* 어느 빌드에서 났는지가 제일 중요한 단서입니다. 기기 종류도 같이.
       일정·지출 내용은 안 보냅니다 — 고치는 데 필요 없습니다. */
    build: $('build')?.textContent || '',
    ua: navigator.userAgent.slice(0, 300),
  }).select('id'));
  b.disabled = false; b.textContent = '보내기';

  if (r.error) return fail(r.error, 'rp');
  /* 040 을 안 올렸으면 표가 없어 0건이 됩니다. 그건 만든 사람이 할 일이라
     화면에는 안 적습니다 — 사용자는 마이그레이션 번호를 모릅니다. */
  if (!r.data?.length){
    ctx.logError('버그 신고 저장 0건 — db/040 미적용 가능성', 'report');
    return fail('보내지 못했어요. 잠시 뒤 다시 해주세요.', 'rp');
  }
  $('rp_body').value = '';
  $('rpbox').classList.add('hide');
  toast('보냈어요. 읽고 고칠게요.');
});


/* 초성('ㄷㅋ'→도쿄)과 찾기는 cities.js 로 갔습니다 (맨 위 import) —
   사전이 아는 규칙이라 사전 옆에 있어야 하고, 거기서는 로그인 없이도
   콘솔에서 돌려볼 수 있습니다(__citiesCheck). */

/* ── 내 자료 내려받기 ────────────────────────────────────────────────
 * 데이터베이스에는 되돌리기가 없습니다. 잘못 지우면 그냥 사라집니다.
 * 서버 열쇠를 쓰지 않고 내 권한으로만 읽습니다 — RLS 가 내 것만 내줍니다.
 * 남의 여행에 초대돼 있으면 그 여행도 같이 받습니다. 볼 수 있는 것이 곧 내 자료입니다. */
$('dumpbtn').addEventListener('click', async () => {
  const b = $('dumpbtn');
  $('dumperr').classList.add('hide');
  b.disabled = true; b.innerHTML = '<span class="load">모으는 중…</span>';

  /* 표마다 조건이 다르지 않습니다. RLS 가 이미 걸러 주므로 통째로 받습니다. */
  const TABLES = ['trips', 'trip_legs', 'trip_members', 'plans', 'expenses',
                  'expense_shares', 'bookings', 'packing', 'links', 'candidates',
                  'city_ratings', 'plan_ratings', 'trip_reviews', 'chats',
                  'profiles', 'user_prefs'];
  /* 표 이름을 한국어로 옮기는 짝. **위로 올려두었습니다** — 아래 목록만
     쓰고 있었고, 정작 오류 문구는 `city_ratings(PGRST301)` 처럼 표 이름과
     오류 코드를 그대로 내보내고 있었습니다. 둘이 같은 짝을 써야 합니다. */
  const NAME = { trips:'여행', trip_legs:'구간', trip_members:'일행', plans:'일정',
                 expenses:'지출', expense_shares:'분담', bookings:'예약',
                 packing:'준비물', links:'링크', candidates:'후보',
                 city_ratings:'도시 별점', plan_ratings:'맛집 별점',
                 trip_reviews:'여행 후기', chats:'AI 대화',
                 profiles:'프로필', user_prefs:'설정' };
  const out = { app:'기로', savedAt:new Date().toISOString(), user:ctx.me().id, data:{} };
  const failed = [];
  for (const t of TABLES){
    const r = await sb.from(t).select('*');
    if (r.error){
      failed.push(NAME[t] || t);
      ctx.logError(`내려받기 실패 ${t}: ${r.error.code || ''} ${r.error.message || ''}`, 'dump');
      continue;
    }
    out.data[t] = r.data || [];
  }
  /* 도시 목록은 우리가 만든 자료라 안 넣습니다 — 잃어버릴 것은 내가 쓴 것뿐입니다. */

  /* ⚠⚠ **하나도 못 받았으면 파일을 안 내립니다(b716, b698 점검 여덟째).** ⚠⚠
     여태 표를 전부 실패해도 `{}` 를 담은 파일이 그대로 떨어지고 토스트는
     「0개를 저장했어요」였습니다. **그것은 백업이 아니라 백업처럼 생긴
     빈 파일**이고, 받은 사람은 자료가 지켜졌다고 믿습니다.
     ⚠ 진짜로 0개인 사람(가입 직후)과 갈립니다 — 그때는 `failed` 가 비어
       있습니다. 「못 받은 표가 하나도 없는가」로 가릅니다.
     ⚠ 일부만 실패한 경우는 **내립니다** — 받을 수 있는 것까지 못 받게
       하는 것이 더 나쁩니다. 대신 파일 이름에 표를 남겨 나중에 이 파일이
       온전한 것인 줄 알고 쓰지 않게 합니다. */
  if (failed.length === TABLES.length){
    b.disabled = false; b.textContent = '다시 받기';
    return fail('아무것도 못 받았어요. 연결을 확인하고 다시 받아주세요.', 'dump');
  }
  const n = Object.values(out.data).reduce((s, v) => s + v.length, 0);
  const blob = new Blob([JSON.stringify(out, null, 1)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `giro-backup-${new Date().toISOString().slice(0,10)}${
                  failed.length ? '-불완전' : ''}.json`;
  a.click(); URL.revokeObjectURL(a.href);

  b.disabled = false; b.textContent = '다시 받기';
  /* 총합만 보면 맞는지 알 수가 없습니다. 표마다 몇 개인지 늘어놓습니다 —
     "일정 0" 같은 것이 눈에 띄어야 빈 백업을 붙들고 있지 않습니다. */
  $('dumplist').classList.remove('hide');
  /* ⚠⚠ **닫을 길이 없었습니다(b641, 사용자 신고).** 한 번 받고 나면
     이 표가 프로필에 영영 남았습니다 — 다른 데로 갔다 와도 그대로입니다.
     **띄우는 것을 만들면 내리는 길도 같이 만들어야 합니다.** */
  $('dumplist').innerHTML =
    `<div class="daysep"><span class="grow">받은 것 · 모두 ${
        n.toLocaleString()}개</span>` +
    `<button class="ghost" id="dumpclose">닫기</button></div>` +
    TABLES.map(t => `<div class="row" style="padding:5px 0">
        <span class="label memo">${esc(NAME[t] || t)}</span>
        <span class="val"${(out.data[t]?.length ? '' : ' style="color:var(--ink-48)"')}>${
          out.data[t] == null ? '못 읽었어요' : out.data[t].length.toLocaleString()}</span>
      </div>`).join('');
  /* 새로 그릴 때마다 단추도 새것이라 여기서 답니다. */
  $('dumplist').querySelector('#dumpclose').onclick =
    () => $('dumplist').classList.add('hide');
  toast(`${n.toLocaleString()}개를 저장했어요`);
  if (failed.length)
    fail('일부는 못 받았어요: ' + failed.join(', ') + '. 잠시 뒤 다시 받아주세요.', 'dump');
});
