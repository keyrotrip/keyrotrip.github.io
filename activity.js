/* ── ♡ 알림(b859) — 인스타 하트 화면처럼 ────────────────────────────────────────
 * 사용자(10-13): 「소식탭 / 팔로워 / 팔로잉도 인스타처럼 수정하자 · 인스타는 하트탭을 누르면 저렇게 소식이 뜨는데」
 *   → 기록 탭 오른쪽 위 ♡(지도 · 공유 · ♡, 시안 A-3) · 프로필의 종도 같은 화면.
 *   «나에게 온 것»(notifications)과 «친구 소식»(friend_feed — 옛 친구 화면 「소식」 탭)을 한 목록으로 합칩니다.
 *   맨 위 「팔로우 요청 · ○○님 외 N명 ›」(받은 요청이 있을 때만), 그 아래 오늘 · 이번 주 · 이번 달 · 이전 활동.
 *   줄: 사람 사진(여럿이면 두 장 겹침) + 귀퉁이 표시(♥ 좋아요 · 💬 답글 · ★ 매김 · ✎ 한줄평) · 굵은 이름 + 글 + 흐린 시간 ·
 *   오른쪽 도시 사진(또는 「맞팔로우」 단추).
 * ⚠ 덮는 층(#actview, fixed, z 1140 — 친구 화면과 같은 층). 그 위로 한줄평 화면(1145)·사람 화면(1150)이 뜹니다.
 *   도시 화면은 덮는 층이 아니라서 city.js 의 덮개 목록에 이 판도 넣었습니다(도시를 열면 가렸다가 닫을 때 되살림).
 * ⚠ 사람 사진·이름은 db/123 people_brief 로 받습니다(profiles 는 RLS 로 남의 것이 안 읽힘). SQL 전이면 이름은 알림 글에서,
 *   사진은 첫 글자 동그라미로 — 화면이 안 깨지게.
 * ⚠ 읽음 처리는 열고 1.2초 뒤(notify.js 와 같은 규칙 — 어느 것이 새것인지 눈에 한 번 들어와야).
 */
import { $, esc, avatarImg } from './dom.js?v=b864';
import { sb } from './db.js?v=b864';
import { netTimeout } from './net.js?v=b864';
import { cities } from './cities.js?v=b864';
import { 언제, 묶기, 소식줄, 구간 } from './friends.js?v=b864';

let ctx = { me: () => null, openPerson: () => {}, openFriends: () => {}, openCityRev: () => {}, openCity: () => {},
            loadNotifs: () => {}, loadSocialCounts: () => {} };
export function setActivityCtx(o){ ctx = { ...ctx, ...o }; }

let 차례 = 0, 읽음틈 = null;
export const isActivityOpen = () => !!$('actview') && !$('actview').classList.contains('hide');

export async function openActivity(){
  if (!ctx.me()) return;
  const 판 = $('actview');
  판.classList.remove('hide');
  판.scrollTop = 0;
  if (history.state?.t2 !== 'act') history.pushState({ t2: 'act' }, '');
  await 그리기();
}
export function closeActivity(fromPop){
  if (!fromPop && history.state?.t2 === 'act'){ history.back(); return; }
  $('actview')?.classList.add('hide');
  차례++; clearTimeout(읽음틈);
}

/* ── ♡ 위의 빨간 점 — 안 읽은 알림(notify.js) 또는 받은 팔로우 요청(friends.js) 중 하나라도 ── */
const 점 = { 알림: false, 요청: false };
export function heartDot(o){
  Object.assign(점, o);
  const 켬 = 점.알림 || 점.요청;
  $('heartdot')?.classList.toggle('hide', !켬);
  $('hometabdot')?.classList.toggle('hide', !켬);   /* 하단바 「기록」 위에도(b861) — 다른 탭에 있어도 보이게 */
}

const 사진 = (url, id, 이름, px) => avatarImg(url, id, 이름,
  `width:${px}px;height:${px}px;border-radius:50%;object-fit:cover;flex:none`, 'thumb');
const 도시 = id => (cities || []).find(c => c.id === id);

async function 그리기(){
  const 이번 = ++차례;
  const 칸 = $('act_list');
  칸.innerHTML = '<div class="empty"><span class="load">불러오는 중…</span></div>';
  const 나 = ctx.me()?.id;
  const [n, f, rq, fl] = await Promise.all([
    netTimeout(sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(40)),
    netTimeout(sb.rpc('friend_feed', { p_before: null, p_limit: 60 })),
    netTimeout(sb.rpc('follow_people', { p_kind: 'requests' })),
    netTimeout(sb.rpc('follow_people', { p_kind: 'following' })),
  ]);
  if (이번 !== 차례) return;
  if (!n || n.error){ 칸.innerHTML = '<div class="empty">지금은 알림을 불러올 수 없어요.</div>'; return; }
  /* 요청은 맨 위 한 줄로 — 줄로는 안 씁니다(인스타처럼) */
  const 알림 = (n.data || []).filter(x => x.kind !== 'follow_request');
  const 요청 = rq?.data || [];
  const 내가 = new Set((fl?.data || []).map(p => p.user_id));

  /* 사람 사진·이름(db/123). 좋아요 여럿이면 둘째 사진도 — review_one 의 likers 에서. */
  const 겹 = {};
  const 좋아요여럿 = 알림.filter(x => x.kind === 'review_like' && x.city_id && /외 \d+명/.test(x.body || ''));
  await Promise.all(좋아요여럿.slice(0, 6).map(async x => {
    const r = await netTimeout(sb.rpc('review_one', { p_author: 나, p_city: x.city_id }));
    겹[x.id] = (r?.data?.[0]?.likers || []).filter(p => p.id !== x.actor_id).slice(0, 1);
  }));
  const ids = [...new Set(알림.map(x => x.actor_id).filter(Boolean))];
  const 사람 = {};
  if (ids.length){
    const r = await netTimeout(sb.rpc('people_brief', { p_ids: ids }));
    (r?.data || []).forEach(p => { 사람[p.user_id] = p; });
  }
  if (이번 !== 차례) return;

  /* 합치기 — 알림 한 줄 · 소식 묶음 한 줄을 시각으로 섞습니다 */
  const 줄들 = [
    ...알림.map(x => ({ at: x.created_at, html: 알림줄(x, 사람[x.actor_id], 겹[x.id], 내가) })),
    ...(f && !f.error ? 묶기(f.data || []).map(g => ({ at: g.at, html: 소식줄꾸밈(g) })) : []),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  let html = 요청.length ? 요청줄(요청) : '';
  let 앞 = null;
  for (const z of 줄들){
    const k = 구간(z.at);
    if (k !== 앞){ html += `<div class="actsec">${k}</div>`; 앞 = k; }
    html += z.html;
  }
  칸.innerHTML = html || `<div class="empty" style="padding:40px 12px">아직 알림이 없어요.<br>
    <span class="memo">누가 나를 팔로우하거나 내 한줄평에 좋아요·답글을 달면, 친구가 도시를 매기면 여기 떠요.</span></div>`;

  /* 읽음 — 1.2초 뒤(아직 열려 있으면). 끝나면 점(notify.js)을 다시 셉니다. */
  clearTimeout(읽음틈);
  if (알림.some(x => !x.read_at) || (n.data || []).some(x => !x.read_at)){
    읽음틈 = setTimeout(async () => {
      if (!isActivityOpen()) return;
      const r = await netTimeout(sb.from('notifications')
        .update({ read_at: new Date().toISOString() }).is('read_at', null).select('id'));
      if (!r?.error) ctx.loadNotifs();
    }, 1200);
  }
}

/* 「팔로우 요청 · ○○님 외 N명 ›」 — 사진 둘 겹침 + 파란 점 */
function 요청줄(목록){
  const [a, b] = 목록;
  return `<button type="button" class="actreq" data-actgo="requests">
    <span class="actav two">${사진(a.avatar_url, a.user_id, a.name, 32)}${b ? 사진(b.avatar_url, b.user_id, b.name, 32) : ''}</span>
    <span class="t"><b>팔로우 요청</b><span>${esc(a.name || '여행자')}님${목록.length > 1 ? ` 외 ${목록.length - 1}명` : ''}</span></span>
    <i class="actblue" aria-hidden="true"></i><span class="actgo" aria-hidden="true">›</span></button>`;
}

/* 알림 한 줄 */
const 표시 = { review_like: ['♥', 'lk'], review_reply: ['💬', 'rp'], follow_new: ['', ''], follow_accepted: ['', ''] };
function 알림줄(x, p, 둘째, 내가){
  const 이름 = p?.name || (x.body || '').split('님')[0] || '';
  const 글 = 이름 && (x.body || '').startsWith(이름)
    ? `<b>${esc(이름)}</b>${esc(x.body.slice(이름.length))}` : esc(x.body || '');
  const [표, 칠] = 표시[x.kind] || ['', ''];
  const 여행 = !x.actor_id || /^(invited|member_joined|joined|expense_added|plan_changed|depart_soon)$/.test(x.kind || '');
  const 얼굴 = 여행
    ? `<span class="actav"><span class="acttrip" aria-hidden="true">✈</span></span>`
    : `<span class="actav${둘째?.length ? ' two' : ''}">${사진(p?.avatar_url, x.actor_id, 이름 || '여행자', 둘째?.length ? 32 : 44)}${
        둘째?.length ? 사진(둘째[0].avatar, 둘째[0].id, 둘째[0].name, 32) : ''}${표 ? `<i class="actbadge ${칠}">${표}</i>` : ''}</span>`;
  /* 오른쪽 — 한줄평 알림은 그 도시 사진(누르면 그 한줄평), 새 팔로워는 「맞팔로우」(아직 안 했으면) */
  let 오른쪽 = '';
  const c = x.city_id && 도시(x.city_id);
  if (/^review_/.test(x.kind || '') && x.city_id)
    오른쪽 = `<span class="actthumb">${c?.image_url ? `<img src="${esc(c.image_url)}" alt="" loading="lazy" onerror="this.remove()">` : esc((c?.name || '?').slice(0, 1))}</span>`;
  else if (x.kind === 'follow_new' && x.actor_id && !내가.has(x.actor_id))
    오른쪽 = `<button type="button" class="frbtn ac" data-actfb="${esc(x.actor_id)}">맞팔로우</button>`;
  const 가는곳 = /^review_/.test(x.kind || '') && x.city_id ? ` data-actrev="${esc(x.city_id)}"`
               : x.actor_id && !여행 ? ` data-person="${esc(x.actor_id)}"` : '';
  return `<div class="actrow${x.read_at ? '' : ' new'}"${가는곳}>${얼굴}
    <span class="t">${글} <em>${esc(언제(x.created_at).replace(/ 전$/, ''))}</em></span>${오른쪽}</div>`;
}

/* 친구 소식 한 줄 — friends.js 의 소식줄을 그대로 쓰고 귀퉁이 표시(★ · ✎)만 얹습니다 */
function 소식줄꾸밈(g){
  const 표 = g.kind === 'comment' ? '✎' : '★';
  return 소식줄(g).replace('<div class="frline">', `<div class="frline actfeed" data-badge="${표}">`);
}

/* ── 누르기 ─────────────────────────────────────────────────────────── */
$('actview')?.addEventListener('click', async e => {
  if (e.target.closest('#actback')) return closeActivity();
  const 맞 = e.target.closest('[data-actfb]');
  if (맞){
    맞.disabled = true;
    const r = await netTimeout(sb.rpc('follow_ask', { p_user: 맞.dataset.actfb }));
    if (!r || r.error){ 맞.disabled = false; return; }
    맞.textContent = r.data === 'accepted' ? '팔로잉' : '요청됨';
    맞.classList.remove('ac');
    ctx.loadSocialCounts();
    return;
  }
  if (e.target.closest('[data-actgo="requests"]')) return ctx.openFriends('requests');
  const 도시칸 = e.target.closest('[data-cityopen]');
  if (도시칸) return ctx.openCity(도시칸.dataset.cityopen);
  const 평 = e.target.closest('[data-actrev]');
  if (평) return ctx.openCityRev(ctx.me()?.id, 평.dataset.actrev);
  const 누구 = e.target.closest('[data-person]');
  if (누구) return ctx.openPerson(누구.dataset.person);
});

/* ♡ 점 — 알림 셈(notify.js)·요청 셈(friends.js)이 사건으로 알려 옵니다(이 파일을 읽으면 고리라). */
window.addEventListener('t2:heartdot', e => heartDot(e.detail || {}));
/* 홈을 다시 그리면 ♡ 단추가 새로 생깁니다 — 지금 상태로 다시 칠합니다(home.js). */
export function heartRefresh(){ heartDot({}); }
