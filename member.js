/* ── 일행 · 초대 링크 ─────────────────────────────────────────────────
 * 누구와 같이 가는가. 일행 목록·권한, 초대 링크를 만들고 거두는 것,
 * 그리고 그 링크로 들어온 사람을 여행에 넣는 것까지입니다.
 *
 * ── app.js 에서 떼어낸 열 번째 조각입니다(b337) ──────────────────────
 * 세 후보를 재고 골랐습니다(SPLIT.md '고르기 전에 세 후보를 다 재라').
 * 221줄에 딸린 것 셋 — 지금 남은 것 중 제일 싼 자리입니다.
 *
 * `JOIN_URL` 도 같이 가져왔습니다. app.js 맨 위에 있었지만 **쓰는 곳이
 * 여기 한 줄뿐**이라 ctx 로 받을 것이 아니었습니다. 왜 앱 주소가 아닌지는
 * 아래 주석에 그대로 옮겨뒀습니다 — 그 이유를 모르면 언젠가 '앱 주소로
 * 바꾸면 되잖아' 하고 되돌리게 됩니다.
 *
 * `nameOf` 는 b335 에 trip.js 로 내려뒀습니다. 이름을 만드는 곳은 거기
 * 하나입니다 — 일행 목록도, 정산 송금 줄도 같은 것을 씁니다.
 *
 * 층: dom.js · db.js · net.js · calc.js · trip.js · ui.js 만 씁니다. */
import { $, esc, toast, copyText, avatarImg } from './dom.js?v=b824';
import { sb } from './db.js?v=b824';
import { fail, netTimeout, offNote, drawOffbar, isOffline, NOROW } from './net.js?v=b824';
import { dateRange } from './calc.js?v=b824';
import { trip, members, setMembers, nameOf } from './trip.js?v=b824';
import { arm } from './ui.js?v=b824';

/* app.js 만 아는 것 셋. **`me` 는 값이 아니라 함수로 받습니다** —
   로그인할 때마다 바뀌는데 값으로 받으면 처음 것을 붙들고 있습니다. */
let ctx = { me: () => null, loadTrips: async () => {}, openTrip: async () => {},
            openPerson: () => {} };
export function setMemberCtx(o){ ctx = { ...ctx, ...o }; }

/* ── 초대 링크가 지나가는 자리 ────────────────────────────────────────
 * ⚠ **앱 주소가 아닙니다.** 앱은 GitHub Pages 에 올라간 정적 index.html
 *   한 장이라 `?join=` 을 붙여도 메신저 미리보기 카드가 안 바뀝니다 —
 *   크롤러는 자바스크립트를 안 돌리고 `<meta og:>` 만 읽습니다. 여행마다
 *   다른 카드를 만들려면 여행마다 다른 HTML 을 내주는 자리가 있어야 합니다.
 *   그 자리가 deno/join.ts 입니다. 사람은 눌러서 0.1초 만에 앱에 닿습니다.
 *
 * ⚠ **왜 Supabase 엣지 함수가 아닌가.** 처음엔 거기 올렸고 코드도 잘 돌았는데
 *   카톡에 카드가 아예 안 떴습니다. 응답 헤더에 `Server: cloudflare` 와
 *   `set-cookie: __cf_bm=`(봇 감지)이 있었습니다. 같은 링크를 github.io
 *   주소로 보내면 카드가 떴고요. Cloudflare 를 안 지나는 자리로 옮겼습니다.
 *   자세한 것은 deno/join.ts 머리말에.
 *
 * 예전에 보낸 `?join=` 링크도 그대로 됩니다 — 받는 쪽은 안 건드렸습니다.
 *
 * **app.js 맨 위에 있던 것을 여기로 옮겼습니다(b337)** — 쓰는 곳이
 * 아래 한 줄뿐입니다. */
/* ⚠ **이름을 `loyal-bat-8481` 에서 바꿨습니다 (b390).** 그건 Deno Deploy 가
 *   지어준 임의 이름이었고, 초대 링크는 **남에게 보내는 유일한 주소**입니다.
 *   실사용 점검에서 받은 사람 입장으로 보니 앱 이름도 여행 이름도 없는
 *   수상한 링크였습니다 — 눌러도 되는지 알 방법이 없습니다.
 *   `keyro-join` 이면 최소한 어느 앱의 초대인지 읽힙니다.
 *
 * ⚠ **이 값을 바꾸면 이미 보낸 링크가 끊깁니다.** 옛 주소는 404 가 됩니다
 *   (확인함). 바꿀 때는 Deno 쪽 이름과 여기를 **같이** 고쳐야 합니다.
 *
 * 더 나은 자리: 도메인을 사서 붙이는 것입니다. 그때는 여기만 고치면 됩니다.
 *
 * ⚠ b817(2026-10-01): `keyro-join.honeychelsea123.deno.net` → **`join.keyro.deno.net`**. 사용자가 Deno 조직 slug 를
 *   keyro 로(keyrotrip 은 지운 조직이 잡고 있어 실패), 앱 이름을 join 으로 바꿈 — 주소는 「앱.조직.deno.net」.
 *   slug 를 바꾸는 순간 옛 주소가 끊겨서(404 실측) 그 전에 보낸 초대 링크는 다시 보내야 합니다. */
const JOIN_URL = 'https://join.keyro.deno.net/';

/* ── 일행 ───────────────────────────────────────────────────────── */
/* 화면에는 한국어만 씁니다. 여행 목록 배지가 'OWNER' 로 떠 있었습니다. */
/* 권한 이름은 여기 하나로 정합니다. 전에는 배지가 '편집'인데 바로 옆
   드롭다운은 '편집자'였고, owner 는 배지에서 '호스트'인데 오류 문구에서는
   '소유자'였습니다. 같은 사람을 두 이름으로 부르면 사용자가 헷갈립니다. */
export const ROLE_KO = { owner:'만든 사람', editor:'편집자', viewer:'보기만' };

export async function loadMembers(){
  $('memerr').classList.add('hide');
  const 그여행 = trip.id;          /* 늦은 답 막기(b799) — tripview.js 의 loadPlans 머리말 */
  const { data, error } = await netTimeout(sb.from('trip_members')
    .select('user_id,role,nickname,left_at,joined_at,profiles(display_name,avatar_url)')
    .eq('trip_id', 그여행)
    .order('joined_at'));
  if (trip?.id !== 그여행) return;
  if (error){
    if (isOffline(error)){ offNote('members'); drawOffbar(); return; }
    $('members').innerHTML = ''; return fail(error, 'mem'); }
  setMembers(data);

  const owner = trip.myRole === 'owner';
  $('members').innerHTML = data.map(m => {
    const p = m.profiles || {};
    /* 위 nameOf 하나만 씁니다 — 여기 따로 적으면 정산과 일행 목록에서
       같은 사람이 다른 이름으로 보입니다. */
    const name = nameOf(m.user_id);
    const self = m.user_id === ctx.me().id;
    const gone = !!m.left_at;
    /* 나간 사람도 지웁니다가 아니라 남깁니다 — 빼면 정산이 어긋납니다. */
    const tag = gone ? '<span class="badge">탈퇴함</span>'
                     : `<span class="badge">${esc(ROLE_KO[m.role] || m.role)}</span>`;
    /* 소유자만 남의 권한을 바꾸거나 내보냅니다. 자기 자신은 못 건드립니다. */
    const admin = (owner && !self && !gone)
      ? `<select data-mrole="${esc(m.user_id)}" style="width:auto; padding:4px 8px;
                 font-size:calc(12px * var(--ts))">
           <option value="editor"${m.role === 'editor' ? ' selected' : ''}>편집자</option>
           <option value="viewer"${m.role === 'viewer' ? ' selected' : ''}>보기만</option>
         </select>
         <!-- '내보내기'라고 적혀 있었습니다. 그 말은 보통 자료를 파일로
              빼는 것을 뜻하고, 이 앱에도 '내려받기'가 따로 있습니다.
              사람을 여행에서 빼는 되돌리기 어려운 동작이라 헷갈리면 안 됩니다. -->
         <button class="ghost" data-mact="kick" data-id="${esc(m.user_id)}"
                 data-name="${esc(name)}" style="color:var(--bad)">일행에서 빼기</button>`
      : '';
    const mine = self && !gone
      ? `<button class="ghost" data-mact="nick" data-nick="${esc(m.nickname || '')}">별명</button>`
      : '';
    /* 다른 일행의 사진·이름을 누르면 그 사람 프로필이 덮여 열립니다(b789). */
    const 누름 = self ? '' : ` data-person="${esc(m.user_id)}" style="cursor:pointer"`;
    return `<div class="trip" style="cursor:default">
      <span${누름}>${avatarImg(p.avatar_url, m.user_id, name,
                  'width:32px;height:32px;border-radius:50%;object-fit:cover;flex:none')}</span>
      <div class="t"><b${누름}><span style="${gone ? 'opacity:.5' : ''}">${esc(name)}${self ? ' (나)' : ''}</span></b>
        <div style="margin-top:2px">${mine}${admin}</div></div>${tag}</div>`;
  }).join('');

  /* 초대는 소유자만 만듭니다. */
  $('invbtn').classList.toggle('hide', !owner);
}

$('invbtn').addEventListener('click', () => {
  $('invitebox').classList.toggle('hide');
  $('i_result').classList.add('hide');
  if (!$('invitebox').classList.contains('hide')) drawInvites();
});
$('i_cancel').addEventListener('click', () => $('invitebox').classList.add('hide'));

/* ── 만들어 둔 초대 링크 ─────────────────────────────────────────────
 * 링크는 한 번 만들면 14일간 살아 있고 스무 번까지 쓰입니다.
 * 그런데 만들고 나면 화면에서 사라져서, 단톡방에 흘린 링크를 거둘 길이 없었습니다.
 * 여기 늘어놓고 지울 수 있게 합니다. 지우면 그 링크로는 못 들어옵니다. */
async function drawInvites(){
  const { data, error } = await sb.from('trip_invites')
    .select('code,role,expires_at,max_uses,uses')
    .eq('trip_id', trip.id).order('created_at', { ascending:false });
  if (error) return fail(error, 'mem');

  const now = new Date();
  const live = (data || []).filter(i => new Date(i.expires_at) > now && i.uses < i.max_uses);
  const dead = (data || []).length - live.length;

  $('i_list').innerHTML = live.length
    ? `<div class="daysep">살아 있는 링크</div>` + live.map(i => {
        /* ⚠ **`ceil` 이 하루를 더 얹었습니다 (b388).** 만든 직후 위에서는
           "14일 뒤 만료"라고 하는데 여기서는 "15일 남음"이 떴습니다 —
           서버가 잡은 만료 시각과 화면의 `now` 사이에 몇 초가 벌어지면
           14.0001 일이 되고 `ceil` 이 15 로 올립니다.
           반올림하되 시간이 남아 있으면 최소 1일로 둡니다("0일 남음"은
           살아 있는 링크에 붙을 말이 아닙니다). */
        const 남은 = (new Date(i.expires_at) - now) / 86400000;
        const days = 남은 <= 0 ? 0 : Math.max(1, Math.round(남은));
        return `<div class="row">
          <span class="label"><b style="font-family:ui-monospace,monospace">${esc(i.code)}</b>
            <div class="memo">${esc(ROLE_KO[i.role] || i.role)} ·
              ${i.uses}/${i.max_uses}명 · ${days}일 남음</div></span>
          <button class="ghost" data-ikill="${esc(i.code)}"
                  style="color:var(--bad)">지우기</button></div>`;
      }).join('') +
      (dead ? `<div class="memo" style="padding-top:8px">만료됐거나 다 쓴 링크 ${dead}개는
                 이미 못 씁니다.</div>` : '')
    : (data || []).length
      ? `<div class="memo">만들어 둔 링크가 다 만료됐어요.</div>` : '';
}

$('i_list').addEventListener('click', async e => {
  const b = e.target.closest('[data-ikill]'); if (!b) return;
  if (b.dataset.armed !== '1'){ arm(b, '한 번 더 누르면 이 초대 링크가 더는 안 열려요'); return; }
  b.disabled = true;
  const r = await sb.from('trip_invites').delete()
    .eq('code', b.dataset.ikill).select('code');
  b.disabled = false;
  if (r.error) return fail(r.error, 'mem');
  /* ⚠ 초대 링크 지우기입니다 — 예전 문구가 「일행에서 빼지 못했어요」였습니다(b799 에 바로잡음). */
  if (!r.data?.length) return fail('초대 링크를 지우지 못했어요. 만든 사람만 지울 수 있어요.', 'mem');
  toast('그 링크로는 이제 못 들어와요.');
  drawInvites();
});

$('i_make').addEventListener('click', async () => {
  const btn = $('i_make');
  $('memerr').classList.add('hide');
  btn.disabled = true; btn.innerHTML = '<span class="load">만드는 중…</span>';
  const { data, error } = await sb.from('trip_invites')
    .insert({ trip_id: trip.id, role: $('i_role').value })
    .select('code').maybeSingle();
  btn.disabled = false; btn.textContent = '초대 링크 만들기';
  if (error) return fail(error, 'mem');
  if (!data)  return fail('초대 링크를 만들지 못했어요. 만든 사람만 만들 수 있어요.', 'mem');

  const link = JOIN_URL + '?c=' + data.code;
  $('i_link').textContent = link;
  $('i_result').classList.remove('hide');
  /* 공유 시트를 열 수 있는 기기에서만 보내기 버튼을 답니다.
     없는데 눌러 놓으면 아무 일도 안 일어나 고장으로 보입니다. */
  $('i_share').classList.toggle('hide', !navigator.share);
  drawInvites();
});

$('i_share').addEventListener('click', async () => {
  /* 복사해서 어디에 붙이라고 하는 것보다 쓰던 메신저로 바로 보내는 편이 빠릅니다. */
  const url = $('i_link').textContent;
  /* **`url` 을 따로 주면 카톡이 우리 글을 버립니다.** URL 이 있으면 메신저는
     보낸 사람의 글 대신 제 미리보기 카드만 만듭니다 — 그래서 받는 사람 화면에
     "기로 / 여기를 눌러 링크를 확인하세요" 만 떴고, **무슨 여행인지 알 수가
     없었습니다.** 주소를 글 안에 넣고 url 은 안 줍니다. 그러면 메신저는 이걸
     그냥 글로 받아 그대로 보여주고, 주소는 알아서 링크가 됩니다.
     (미리보기 카드는 여전히 뜨는데, 그 내용은 index.html 의 og: 태그입니다.) */
  const text = `${trip.title} 같이 가실까요?\n` +
               `${trip.destination} · ${dateRange(trip.start_date, trip.end_date)}\n` +
               `아래 링크로 들어오면 일정을 같이 볼 수 있어요.\n${url}`;
  try {
    await navigator.share({ title: `${trip.title} 같이 가요`, text });
  } catch {}   /* 취소를 누르면 거절로 옵니다. 오류가 아닙니다. */
});

/* 복사는 두 번 시도합니다.
   navigator.clipboard 는 내장 브라우저나 iframe 에서 막히는 일이 있는데,
   그럴 때 옛 execCommand 방식은 대개 통합니다. 한 번 실패했다고 포기하면
   사용자가 손으로 긁어야 합니다. */
/* copyText 는 dom.js 로 옮겼습니다 (맨 위 import) — admin.js 도 씁니다. */

$('i_copy').addEventListener('click', async () => {
  const ok = await copyText($('i_link').textContent);
  $('i_copy').textContent = ok ? '복사했어요' : '아래 글자를 복사하세요';
  if (!ok){
    /* 둘 다 막혔으면 최소한 긁어는 놓습니다. 그대로 Ctrl+C 면 됩니다. */
    const r = document.createRange(); r.selectNodeContents($('i_link'));
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  setTimeout(() => { $('i_copy').textContent = '복사'; }, 2000);
});

$('members').addEventListener('click', async e => {
  const 누구 = e.target.closest('[data-person]');
  if (누구){ ctx.openPerson(누구.dataset.person); return; }
  const b = e.target.closest('button[data-mact]'); if (!b) return;

  /* prompt 도 confirm 과 같이 내장 브라우저에서 막힙니다. 화면 안에서 받습니다. */
  if (b.dataset.mact === 'nick'){
    b.outerHTML =
      `<input id="nickin" value="${esc(b.dataset.nick)}" maxlength="20"
              placeholder="비우면 계정 이름" style="width:auto; max-width:160px;
              padding:4px 10px; font-size:calc(12px * var(--ts))">
       <button class="ghost" data-mact="nicksave">저장</button>`;
    $('nickin').focus();
    return;
  }
  if (b.dataset.mact === 'nicksave'){
    b.disabled = true;
    const r = await sb.from('trip_members')
      .update({ nickname: $('nickin').value.trim() || null })
      .eq('trip_id', trip.id).eq('user_id', ctx.me().id).select('user_id');
    b.disabled = false;
    if (r.error) return fail(r.error, 'mem');
    return loadMembers();
  }

  if (b.dataset.mact === 'kick'){
    if (b.dataset.armed !== '1'){       /* 확인창을 안 쓰는 이유는 앞과 같습니다 */
      /* 누구를 빼고 무엇이 달라지는지(b799, GPT 리포트) — 이름은 원래 있었고, 결과를 더했습니다. */
      arm(b, `한 번 더 누르면 ${b.dataset.name}님이 이 여행을 못 봐요`); return;
    }
    b.disabled = true;
    /* 지우지 않고 나간 것으로 표시합니다. 지출에 이름이 남아야 정산이 맞습니다. */
    const r = await sb.from('trip_members')
      .update({ left_at: new Date().toISOString() })
      .eq('trip_id', trip.id).eq('user_id', b.dataset.id).select('user_id');
    b.disabled = false;
    if (r.error) return fail(r.error, 'mem');
    if (!r.data?.length) return fail(NOROW.edit, 'mem');
    return loadMembers();
  }
});

$('members').addEventListener('change', async e => {
  const s = e.target.closest('select[data-mrole]'); if (!s) return;
  const r = await sb.from('trip_members').update({ role: s.value })
    .eq('trip_id', trip.id).eq('user_id', s.dataset.mrole).select('user_id');
  if (r.error) return fail(r.error, 'mem');
  if (!r.data?.length) return fail(NOROW.edit, 'mem');
  await loadMembers();
});

/* ── 초대 링크로 들어왔을 때 ────────────────────────────────────── */
export async function handleJoin(){
  const code = sessionStorage.getItem('t2:join');
  if (!code) return false;
  sessionStorage.removeItem('t2:join');

  const { data, error } = await sb.rpc('redeem_invite', { p_code: code });
  if (error){ fail(error, 'trip'); return false; }
  await ctx.loadTrips();
  await ctx.openTrip(data);
  return true;
}

