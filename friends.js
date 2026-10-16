/* ── 친구(b789) — 소식 · 팔로잉 · 팔로워 · 받은 요청 · 찾기 · 내 링크 ──────
 * 프로필 탭 이름 밑의 「팔로워 N · 팔로잉 N」을 누르면 열립니다. 설계와 근거는
 * db/101_follow.sql 머리말(벤치마크: Letterboxd · Polarsteps · Beli · 왓챠).
 *
 * ⚠ **덮는 층입니다(`#friendview`, position:fixed)** — people.js 와 같은 이유.
 *   남의 프로필(`#whoview`)은 이 위에 한 겹 더 덮입니다(z-index 가 하나 위).
 * ⚠ 소식은 **한 시간 안에 한 사람이 여러 곳을 매기면 한 줄로 묶습니다**
 *   (쭉 매기기로 서른 곳을 매기면 소식이 서른 줄이 됩니다 — Letterboxd 도 몰아
 *   적은 기록은 한 시간에 한 번만 흘립니다).
 * ⚠ 이름 찾기는 **앞글자가 같으면** 나옵니다(서버 people_find, db/121) — 한 번에 20명까지.
 *   기본 이름 「여행자 1234」도 같은 규칙(db/139 — 사용자: 누군지 알 수 없는 이름이라).
 * ⚠ SQL(101)을 아직 안 돌렸으면 친구 줄 · 설정 카드를 통째로 숨깁니다 —
 *   눌러도 안 되는 단추를 두면 안 됩니다.
 *
 * ── 인스타처럼(b800) ────────────────────────────────────────────────────
 * 사용자: 「이탭도 뭔가 지저분하고 어수선해, 인스타처럼 깔끔하게 참고해서 바꾸자」 → 시안 보고 「시안대로」.
 *   b789~b799 는 소식 한 칸이 도시 칩 최대 11개 뭉치(국기·이름·별점)였고, 탭은 네모 단추 넷,
 *   찾기는 칸 + 「찾기」 단추였습니다.
 *   → 소식은 인스타 알림처럼 **한 줄**: 사진 · 한 문장(+ 흐린 둘째 줄) · 오른쪽 도시 사진 한 장.
 *     도시 이름은 별점 높은 둘만(폰 폭에 셋은 넘쳐 잘렸습니다 — 재 봄), 나머지는 「외 N곳」. 시간으로 나눕니다(오늘 · 이번 주 · 이번 달 ·
 *     이전 활동). 끝까지 내리면 저절로 더 받습니다(「더 보기」 단추 없음).
 *   → 탭은 밑줄, 숫자는 옆에(loadSocialCounts). 찾기는 칸 안의 돋보기, 엔터로.
 *   → 줄 오른쪽 단추: 팔로잉 「팔로잉」(한 번 더 → 끊기) · 팔로워 「맞팔로우」「삭제」 · 요청 「수락」「거절」.
 *     둘째 줄 「서로 팔로우해요」는 서버가 줄마다 안 알려줘서 **목록 둘을 견줘** 정합니다.
 * ⚠ 줄 전체를 단추 하나로 만들지 않습니다 — 오른쪽 사진·단추가 따로 눌려야 해서 «사람 단추 + 옆 단추»
 *   형제로 둡니다(단추 안에 단추는 안 됩니다). 그래서 누르기 처리는 도시·단추를 사람보다 «먼저» 봅니다.
 */
import { $, esc, toast, avatarImg, copyText, flagOf, flagOk, josa, emptyDo } from './dom.js?v=b888';
import { 이름먼저 } from './nameask.js?v=b888';   /* 이름이 남에게 처음 보일 때 「이름을 정하고 남길까요?」(2026-10-16) */
import { sb } from './db.js?v=b888';
import { netTimeout } from './net.js?v=b888';
import { cities, countryName } from './cities.js?v=b888';
/* 소식의 도시 사진을 누르면 여는 화면(b789). city.js 는 이 파일을 안 읽으므로 고리가 없습니다. */
import { openCity } from './city.js?v=b888';
/* 「팔로잉」·「삭제」를 한 번 더 눌러 정하는 장치(b800). ui.js 는 dom.js 만 읽어 고리가 없습니다. */
import { arm } from './ui.js?v=b888';

let ctx = { me: () => null, openPerson: () => {} };
export function setFriendsCtx(o){ ctx = { ...ctx, ...o }; }

let 탭 = 'feed';
let 차례 = 0;
let 소식끝 = null;          /* 소식을 더 받을 때 기준 시각 */
let 소식구간 = null;        /* 마지막으로 단 시간 머리(오늘·이번 주…) — 더 받을 때 같은 머리를 또 안 달게 */
let 더받는중 = false;       /* 끝까지 내렸을 때 한 번만 받게 */
let 끝눈 = null;            /* 맨 아래 「불러오는 중」 줄을 지켜보는 IntersectionObserver */

export const isFriendsOpen = () => !!$('friendview') && !$('friendview').classList.contains('hide');

/* ── 팔로워 | 팔로잉(b859, 인스타처럼) ─────────────────────────────────────
 * 사용자(10-13): 「소식탭 / 팔로워 / 팔로잉도 인스타처럼」 → 「그냥 인스타처럼 알아서 만들어줘」.
 *   탭은 「N 팔로워 | N 팔로잉」 둘. 「소식」은 ♡ 알림(activity.js)으로, 「요청」은 팔로워 탭 맨 위 한 줄로 갔습니다.
 *   팔로워 탭 맨 위: 「팔로우 요청 · ○○님 외 N명 ›」 · 「내가 맞팔로우하지 않는 사람 · ○○님 외 N명 ›」(들어간 판 — 「sub」),
 *   그 아래 「정렬 기준 기본 ⇅」(기본 = 최근 순 · 이름 순), 그리고 목록. 목록 위 검색칸은 «이 목록 안에서» 거르기.
 *   새 사람 찾기는 오른쪽 위 사람+(#fr_qbtn → 찾기 화면) 또는 프로필 「친구 찾기」.
 * ⚠ 들어간 판(requests · notback)은 history 한 칸(frsub). 그 판으로 «바로» 열렸으면(♡ 알림의 「팔로우 요청 ›」) 닫을 때
 *   친구 화면까지 통째로 닫습니다 — 그 사람은 목록을 거쳐 오지 않았습니다(바로찾기와 같은 생각). */
const 들어간판 = { requests: '팔로우 요청', notback: '맞팔로우하지 않는 사람' };
let 정렬 = '기본', 바로판 = false, 내이름 = '';
function 머리글(){
  const 판 = $('friendview'), 속 = !!들어간판[탭];
  판?.classList.toggle('frsub', 속);
  if ($('fr_title')) $('fr_title').textContent = 속 ? 들어간판[탭] : (내이름 || '친구');
}
function 판열기(kind){
  탭 = kind;
  history.pushState({ t2:'frsub' }, '');
  $('friendview').scrollTop = 0;
  머리글(); 그리기();
}

export async function openFriends(t, 옵션 = {}){
  if (!ctx.me()) return;
  /* 옛 이름(feed — 소식 탭)으로 부르는 곳(people.js 등)은 팔로워로 */
  탭 = !t || t === 'feed' ? 'followers' : t;
  바로판 = !!들어간판[탭];
  const 판 = $('friendview');
  판.classList.remove('hide');
  판.scrollTop = 0;
  if (history.state?.t2 !== 'friend') history.pushState({ t2:'friend' }, '');
  찾기비우기();
  판.classList.remove('frs');
  if ($('fr_filter')) $('fr_filter').value = '';
  머리글();
  탭칠하기();
  loadSocialCounts();       /* 탭 옆 숫자(b800) — 기다리지 않습니다 */
  /* 프로필의 「친구 찾기」(b791) — 찾기 칸에 커서를 둡니다. ⚠ 아래 await «전»에
     해야 아이폰이 키보드를 올립니다(누른 그 순간 안이어야 합니다). */
  /* 프로필의 「친구 찾기」로 왔으면 찾기 화면만 쓰고, 닫으면 프로필로 바로 돌아갑니다(b859, 사용자: 「친구 추가 버튼 누르고
     끄면 다시 프로필 탭이 나와야하는거아냐?」). 그래서 찾기 칸을 위한 history 칸을 따로 안 쌓습니다. */
  바로찾기 = !!옵션.찾기;
  if (옵션.찾기) 찾기열기();
  await 그리기();
}

export function closeFriends(fromPop){
  /* 찾기 화면(b858)이 열려 있으면 그것만 닫습니다 — 뒤로가기도 「취소」처럼 친구 화면으로. */
  /* ⚠ 단, 프로필 「친구 찾기」로 바로 들어왔으면(바로찾기) 친구 화면까지 통째로 닫습니다 — 그 사람은 친구 목록을 안 봤습니다. */
  if (찾기중() && !바로찾기) return 찾기닫기(fromPop);
  /* 들어간 판(요청 · 맞팔로우 안 한 사람)이면 목록으로 한 겹만 — 단 그 판으로 바로 열렸으면 통째로 닫습니다. */
  if (들어간판[탭] && !바로판){
    if (!fromPop && history.state?.t2 === 'frsub'){ history.back(); return; }
    탭 = 'followers'; 머리글(); 그리기();
    return;
  }
  if (!fromPop && history.state?.t2 === 'friend'){ history.back(); return; }
  $('friendview')?.classList.add('hide');
  $('friendview')?.classList.remove('frs', 'frsub');
  바로찾기 = false; 바로판 = false;
  차례++;
  loadSocialCounts();         /* 요청에 답했으면 점이 바뀌었습니다 */
}

/* ── 프로필 머리의 「팔로워 N · 팔로잉 N」과 받은 요청 점 ─────────────── */
export async function loadSocialCounts(){
  const me = ctx.me();
  if (!me) return;
  const r = await netTimeout(sb.rpc('person_head', { p_user: me.id }));
  const h = r && !r.error ? r.data : null;
  $('friendrow')?.classList.toggle('hide', !h);
  if (!h) return;
  내이름 = h.name || 내이름;
  if (!들어간판[탭] && $('fr_title')) $('fr_title').textContent = 내이름 || '친구';
  $('fr_followers').textContent = h.followers ?? 0;
  $('fr_following').textContent = h.following ?? 0;
  /* 친구 화면 탭 옆 숫자(b800, 인스타처럼) — 같은 수를 두 곳에 씁니다. */
  if ($('fr_nfollowing')) $('fr_nfollowing').textContent = h.following ?? '';
  if ($('fr_nfollowers')) $('fr_nfollowers').textContent = h.followers ?? '';
  /* 공개 범위가 기본(비공개)이 아니면 여기서 늘 보이게(b789 → b799) — 비활성화한 걸 잊고
     「왜 아무도 안 보지」, 공개한 걸 잊고 「모르는 사람이 왜 보지」가 안 되게.
     옛 서버(db/106 전)는 visibility 를 안 보내므로 잠금에서 셉니다. */
  const 범 = h.visibility || (h.locked ? 'off' : 'private');
  const 표 = $('fr_locked');
  if (표){
    표.textContent = 범 === 'public' ? '🌐 공개' : '🔒 비활성화';
    표.classList.toggle('hide', 범 === 'private');
  }
  const 요청 = (h.requests || 0) > 0;
  $('frdot')?.classList.toggle('hide', !요청);
  /* ♡(기록 탭) 빨간 점에도 알립니다(b859) — activity.js 를 읽으면 고리라 사건으로 */
  window.dispatchEvent(new CustomEvent('t2:heartdot', { detail: { 요청 } }));
}

/* 링크로 들어온 사람(?p=코드) — app.js 가 로그인 뒤에 부릅니다 */
export async function openByLink(code){
  const r = await netTimeout(sb.rpc('person_by_link', { p_code: String(code || '') }));
  if (r?.data) return ctx.openPerson(r.data);
  toast('링크가 바뀌었거나 찾을 수 없는 사람이에요');
}

/* ── 그리기 ────────────────────────────────────────────────────────── */
function 탭칠하기(){
  document.querySelectorAll('#fr_tabs [data-fr]').forEach(b => {
    const on = b.dataset.fr === 탭;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

/* 사람 한 줄(b800, 인스타처럼) — 사진 44 · 이름 · 흐린 둘째 줄 · 오른쪽 단추.
   `둘째` 는 **이미 esc 한 HTML** 로 받습니다(시간·별 같은 꾸밈이 들어가서). */
function 사람줄(p, 오른쪽 = '', 둘째 = ''){
  const 이름 = p.name || '여행자';
  return `<div class="frline" data-name="${esc(이름)}">
    <button class="ghost frwho" data-person="${esc(p.user_id)}">
      ${avatarImg(p.avatar_url, p.user_id, 이름,
                  'width:44px;height:44px;border-radius:50%;object-fit:cover;flex:none', 'thumb')}
      <span class="frtxt"><span class="l1"><b>${esc(이름)}</b></span>${
        둘째 ? `<span class="l2">${둘째}</span>` : ''}</span></button>
    ${오른쪽 ? `<span class="frbtns">${오른쪽}</span>` : ''}</div>`;
}

async function 그리기(){
  const 이번 = ++차례;
  const 칸 = $('fr_list');
  칸.innerHTML = '<div class="empty"><span class="load">불러오는 중…</span></div>';
  끝눈?.disconnect(); 끝눈 = null;
  if (탭 === 'feed'){ 소식끝 = null; 소식구간 = null; return 소식그리기(이번, false); }

  /* ── 팔로잉 · 팔로워(b800) ── 목록 셋을 한 번에 받아 견줍니다: 「서로 팔로우해요」 · 「맞팔로우」 ·
     「요청됨」은 서버가 줄마다 안 알려줘서, 내가 팔로우하는 사람(following)·보낸 요청(sent)과
     맞춰 봅니다. 세 번 부르지만 셋 다 가벼운 목록입니다. */
  if (탭 === 'following' || 탭 === 'followers' || 탭 === 'notback'){
    const [a, b, s, q] = await Promise.all([
      netTimeout(sb.rpc('follow_people', { p_kind: 'following' })),
      netTimeout(sb.rpc('follow_people', { p_kind: 'followers' })),
      netTimeout(sb.rpc('follow_people', { p_kind: 'sent' })),
      netTimeout(sb.rpc('follow_people', { p_kind: 'requests' })),
    ]);
    if (이번 !== 차례) return;
    const 틀림 = [a, b, s].find(x => !x || x.error);
    if (틀림) return 실패(틀림?.error);
    const 정렬하기 = l => 정렬 === '이름' ? [...l].sort((x, y) => (x.name || '').localeCompare(y.name || '', 'ko')) : l;
    const 팔로잉 = 정렬하기(a.data || []), 팔로워 = 정렬하기(b.data || []), 보냄 = s.data || [], 받은 = q?.data || [];
    const 내가 = new Set(팔로잉.map(p => p.user_id));
    const 나를 = new Set(팔로워.map(p => p.user_id));
    const 요청중 = new Set(보냄.map(p => p.user_id));
    const 단추 = (fa, id, 글, 진하게) =>
      `<button class="frbtn${진하게 ? ' ac' : ''}" data-fa="${fa}" data-id="${esc(id)}">${글}</button>`;
    /* × — 팔로워에서 빼기(인스타처럼 오른쪽 끝). 한 번 더 눌러 정합니다(아래 한번더말). */
    const 빼기 = id => `<button class="frx" data-fa="remove" data-id="${esc(id)}" aria-label="팔로워에서 빼기">×</button>`;
    /* 「팔로우 요청 ›」·「맞팔로우하지 않는 사람 ›」 — 사진 둘 겹침 + 이름 외 N명 */
    const 묶음줄 = (목록, 제목, 판, 점) => {
      const [x, y] = 목록;
      return `<button type="button" class="frgroup" data-frsub="${판}">
        <span class="actav two">${avatarImg(x.avatar_url, x.user_id, x.name, 'width:32px;height:32px;border-radius:50%;object-fit:cover', 'thumb')}${
          y ? avatarImg(y.avatar_url, y.user_id, y.name, 'width:32px;height:32px;border-radius:50%;object-fit:cover', 'thumb') : ''}</span>
        <span class="t"><b>${제목}</b><span>${esc(x.name || '여행자')}님${목록.length > 1 ? ` 외 ${목록.length - 1}명` : ''}</span></span>
        ${점 ? '<i class="actblue" aria-hidden="true"></i>' : ''}<span class="actgo" aria-hidden="true">›</span></button>`;
    };
    const 정렬줄 = `<button type="button" class="frsort" data-frsort>정렬 기준 <b>${정렬 === '이름' ? '이름 순' : '기본'}</b>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
           stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/></svg></button>`;
    const 팔로워줄 = p => {
      const 맞 = 내가.has(p.user_id);
      const 앞 = 맞 ? 단추('unfollow', p.user_id, '팔로잉')
               : 요청중.has(p.user_id) ? 단추('cancel', p.user_id, '요청됨')
               : 단추('followback', p.user_id, '맞팔로우', true);
      return 사람줄(p, 앞 + 빼기(p.user_id), 맞 ? '서로 팔로우해요' : '나를 팔로우해요');
    };

    if (탭 === 'following'){
      칸.innerHTML = (팔로잉.length || 보냄.length)
        ? (팔로잉.length > 1 ? 정렬줄 : '') +
          팔로잉.map(p => 사람줄(p, 단추('unfollow', p.user_id, '팔로잉'),
                                나를.has(p.user_id) ? '서로 팔로우해요' : '')).join('') +
          (보냄.length ? `<div class="frsec">보낸 요청</div>` + 보냄.map(p =>
            사람줄(p, 단추('cancel', p.user_id, '요청 취소'), '승인을 기다려요')).join('') : '')
        : 빈칸('아직 팔로우한 사람이 없어요.',
               '오른쪽 위 사람+ 로 이름을 찾거나, 도시 화면 한줄평의 이름을 누르거나, 친구에게 링크를 받아 보세요.');
      걸러내기();
      return;
    }
    const 안한 = 팔로워.filter(p => !내가.has(p.user_id) && !요청중.has(p.user_id));
    if (탭 === 'notback'){
      칸.innerHTML = 안한.length ? 안한.map(팔로워줄).join('')
        : 빈칸('모두 맞팔로우했어요.', '');
      걸러내기();
      return;
    }
    /* 팔로워 — 맨 위 묶음 줄 둘, 정렬, 목록 */
    칸.innerHTML = (받은.length ? 묶음줄(받은, '팔로우 요청', 'requests', true) : '') +
      (안한.length && 팔로워.length > 1 ? `<div class="frsec">카테고리</div>` + 묶음줄(안한, '내가 맞팔로우하지 않는 사람', 'notback', false) : '') +
      (팔로워.length
        ? (팔로워.length > 1 ? 정렬줄 : '') + 팔로워.map(팔로워줄).join('')
        : 빈칸('아직 나를 팔로우한 사람이 없어요.', '프로필의 「프로필 공유」로 친구에게 링크를 보내 보세요.'));
    걸러내기();
    return;
  }

  /* 받은 요청 */
  const r = await netTimeout(sb.rpc('follow_people', { p_kind: 'requests' }));
  if (이번 !== 차례) return;
  if (r?.error) return 실패(r.error);
  const 목록 = r?.data || [];
  /* 인스타처럼(b800) — 「○○ · 팔로우를 요청했어요 · 언제」 + 오른쪽 「수락」(진하게) 「거절」.
     요청은 비공개 계정일 때만 옵니다(기본은 공개 — db/108). */
  칸.innerHTML = 목록.length
    ? `<div class="memo" style="margin:10px 0 2px">수락하면 그 사람에게 내 지구본·성향·별점·한줄평이 보여요.</div>` +
      목록.map(p => 사람줄(p,
        `<button class="frbtn ac" data-fa="accept" data-id="${esc(p.user_id)}">수락</button>` +
        `<button class="frbtn" data-fa="decline" data-id="${esc(p.user_id)}">거절</button>`,
        `팔로우를 요청했어요${p.at ? ` · ${언제(p.at)}` : ''}`)).join('')
    : 빈칸('받은 요청이 없어요.', '');
}

/* 목록 안에서 이름 거르기(b859, 인스타 팔로워 화면의 검색칸) — 띄어쓰기·대소문자 무시, 이름 어디든 들어 있으면.
   서버에 안 묻습니다 — 이미 받은 목록을 숨기기만(새 사람 찾기는 사람+ 단추의 찾기 화면). */
const 키 = s => String(s || '').replace(/\s+/g, '').toLowerCase();
function 걸러내기(){
  const q = 키($('fr_filter')?.value);
  const 줄들 = document.querySelectorAll('#fr_list .frline[data-name]');
  줄들.forEach(l => l.classList.toggle('hide', !!q && !키(l.dataset.name).includes(q)));
  /* 거르는 동안엔 묶음 줄·정렬 줄·머리는 숨깁니다 — 사람만 남게 */
  document.querySelectorAll('#fr_list .frgroup, #fr_list .frsort, #fr_list .frsec').forEach(x => x.classList.toggle('hide', !!q));
}
$('fr_filter')?.addEventListener('input', 걸러내기);

function 빈칸(말, 도움){
  return emptyDo(말, '', '', 도움);   /* 빈 화면은 emptyDo 하나로(b363 규칙) */
}
function 실패(err){
  $('fr_list').innerHTML = 빈칸('지금은 불러올 수 없어요.', err?.message || '');
}

/* ── 소식 ──────────────────────────────────────────────────────────── */
export function 언제(at){
  const t = Date.parse(at);
  const s = (Date.now() - t) / 1000;
  if (s < 60) return '방금';
  if (s < 3600) return Math.floor(s / 60) + '분 전';
  if (s < 86400) return Math.floor(s / 3600) + '시간 전';
  if (s < 86400 * 2) return '어제';
  if (s < 86400 * 7) return Math.floor(s / 86400) + '일 전';
  const d = new Date(t);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
export function 묶기(rows){
  const out = [];
  for (const r of rows){
    const g = out[out.length - 1];
    if (g && g.kind === 'rate' && r.kind === 'rate' && g.user_id === r.user_id
        && Date.parse(g.끝) - Date.parse(r.at) < 3600e3){
      g.items.push(r); g.끝 = r.at; continue;
    }
    out.push({ kind: r.kind, user_id: r.user_id, name: r.name, avatar_url: r.avatar_url,
               at: r.at, 끝: r.at, items: [r] });
  }
  return out;
}
const 도시 = id => (cities || []).find(c => c.id === id);
/* ── 소식 한 줄(b800, 인스타 알림처럼) ─────────────────────────────────────
 * 「○○님이 도시 19곳을 매겼어요 · 8월 9일」 + 흐린 둘째 줄 + 오른쪽 도시 사진 한 장.
 *   둘째 줄 — 여러 곳이면 별점 높은 둘(「외 N곳」), 한 곳이면 별점 · 나라, 한줄평이면 그 글.
 *   오른쪽 사진 — 제일 높게 준 도시(한줄평·한 곳이면 그 도시). 사진이 없으면 첫 글자.
 * ⚠ 누르면: 왼쪽(사진·글)은 그 사람, 오른쪽 사진은 그 도시(도시 화면이 이 판을 가리고 뜹니다 — city.js 의 겹).
 * ⚠ 별은 칩처럼 크게 안 씁니다 — 둘째 줄 안의 작은 글자(.frst)입니다. */
const 별글 = v => v != null ? `<i class="frst">★${Number(v).toFixed(1).replace(/\.0$/, '')}</i>` : '';
export function 소식줄(g){
  const 이름 = g.name || '여행자';
  let 말, 둘째 = '', 대표;
  if (g.kind === 'comment'){
    const r = g.items[0], 곳 = 도시(r.city_id)?.name || r.city_id;
    말 = `${esc(곳)}에 한줄평을 남겼어요`;
    둘째 = `“${esc(r.comment || '')}”`;
    대표 = r.city_id;
  } else {
    const 줄 = [...g.items].sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1));
    대표 = 줄[0].city_id;
    if (줄.length === 1){
      const c = 도시(줄[0].city_id), 곳 = c?.name || 줄[0].city_id;
      말 = `${esc(josa(곳, '을', '를'))} 매겼어요`;
      둘째 = [별글(줄[0].stars), c ? esc(countryName[c.cc] || '') : ''].filter(Boolean).join(' · ');
    } else {
      말 = `도시 ${줄.length}곳을 매겼어요`;
      둘째 = 줄.slice(0, 2).map(r => `${esc(도시(r.city_id)?.name || r.city_id)} ${별글(r.stars)}`.trim())
               .join(' · ') + (줄.length > 2 ? ` 외 ${줄.length - 2}곳` : '');
    }
  }
  const c = 도시(대표), 사진 = c?.image_url;
  return `<div class="frline">
    <button class="ghost frwho" data-person="${esc(g.user_id)}">
      ${avatarImg(g.avatar_url, g.user_id, 이름,
                  'width:44px;height:44px;border-radius:50%;object-fit:cover;flex:none', 'thumb')}
      <span class="frtxt"><span class="l1"><b>${esc(이름)}</b>님이 ${말} <span class="t">· ${언제(g.at)}</span></span>${
        둘째 ? `<span class="l2">${둘째}</span>` : ''}</span></button>
    <button class="frthumb" data-cityopen="${esc(대표)}" aria-label="${esc(c?.name || '도시')} 보기">${
      /* ⚠ 배경 그림이 아니라 <img loading="lazy"> 입니다(b801, 라이브에서 재 봄) — 배경으로 두면 소식 60줄의
         도시 사진(원본 크기)을 여는 순간 한꺼번에 받았습니다. 화면에 가까워질 때만 받습니다.
         못 받으면 그림을 걷어 크림 칸만 남깁니다. */
      사진 ? `<img src="${esc(사진)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`
           : esc((c?.name || '?').slice(0, 1))}</button>
  </div>`;
}
/* 시간 머리(인스타 알림처럼) — 오늘 · 이번 주(7일) · 이번 달(30일) · 이전 활동. */
export function 구간(at){
  const t = new Date(Date.parse(at)), 지금 = new Date();
  if (t.toDateString() === 지금.toDateString()) return '오늘';
  const 일 = (지금 - t) / 864e5;
  return 일 < 7 ? '이번 주' : 일 < 30 ? '이번 달' : '이전 활동';
}
async function 소식그리기(이번, 더){
  const r = await netTimeout(sb.rpc('friend_feed', { p_before: 소식끝, p_limit: 60 }));
  if (이번 !== 차례) return;
  if (!r || r.error) return 실패(r?.error);
  const rows = r.data || [];
  const 칸 = $('fr_list');
  if (!더 && !rows.length){
    칸.innerHTML = 빈칸('아직 소식이 없어요.',
      '팔로우한 사람이 도시를 매기거나 한줄평을 쓰면 여기 떠요. 팔로우한 사람이 없으면 「팔로잉」에서 시작해 보세요.');
    return;
  }
  /* ⚠ **마지막 묶음은 다음 판으로 미룹니다(b800, 재 봄).** 60개씩 받는 경계에서 한 사람의 같은 날이
     「39곳을 매겼어요」「2곳을 매겼어요」 두 줄로 갈렸습니다. 더 받을 것이 있으면(60개가 꽉 찼으면)
     마지막 묶음은 안 그리고, 그 앞 묶음의 끝 시각부터 다시 받아 통째로 그립니다.
     묶음이 하나뿐이면(한 사람이 60곳 넘게) 미루지 않습니다 — 미루면 영영 못 그립니다. */
  const 묶음 = 묶기(rows);
  const 더있음 = rows.length >= 60;
  if (더있음 && 묶음.length > 1) 묶음.pop();
  let html = '';
  for (const g of 묶음){
    const k = 구간(g.at);
    if (k !== 소식구간){ html += `<div class="frsec">${k}</div>`; 소식구간 = k; }
    html += 소식줄(g);
  }
  $('fr_more')?.remove();
  if (더) 칸.insertAdjacentHTML('beforeend', html); else 칸.innerHTML = html;
  소식끝 = 묶음.length ? 묶음[묶음.length - 1].끝 : 소식끝;
  /* ── 끝까지 내리면 저절로 더(b800) ── 「더 보기」 단추 대신 맨 아래 한 줄을 지켜봅니다.
     ⚠ 뿌리(root)는 #friendview 입니다 — 이 판이 스스로 스크롤하는 덮는 층이라(position:fixed)
       문서 스크롤로는 안 옵니다. 300px 앞에서 미리 부릅니다. */
  if (rows.length >= 60){
    칸.insertAdjacentHTML('beforeend',
      `<div id="fr_more" class="empty"><span class="load">불러오는 중…</span></div>`);
    끝눈?.disconnect();
    if ('IntersectionObserver' in window){
      끝눈 = new IntersectionObserver(es => {
        if (!es.some(x => x.isIntersecting) || 더받는중 || 탭 !== 'feed') return;
        더받는중 = true;
        소식그리기(차례, true).finally(() => { 더받는중 = false; });
      }, { root: $('friendview'), rootMargin: '300px 0px' });
      끝눈.observe($('fr_more'));
    }
  } else { 끝눈?.disconnect(); 끝눈 = null; }
}

/* ── 누르기 ────────────────────────────────────────────────────────── */
/* ⚠ **도시·단추를 사람보다 먼저 봅니다(b800).** 줄은 «사람 단추 + 옆 단추(도시 사진·팔로잉·삭제…)»
   형제라 겹치지 않지만, 순서를 사람 먼저로 두면 나중에 누가 옆 단추를 사람 단추 안에 넣는 날
   사람 화면이 열려 버립니다. */
const 한번더말 = { unfollow: '한 번 더 누르면 끊어요', remove: '한 번 더 누르면 빼요' };
$('friendview')?.addEventListener('click', async e => {
  const 도시칸 = e.target.closest('[data-cityopen]');
  if (도시칸) return openCity(도시칸.dataset.cityopen);

  const a = e.target.closest('[data-fa]');
  if (a){
    const { fa, id } = a.dataset;
    /* 끊기·팔로워 빼기는 한 번 더 눌러 정합니다(ui.js 의 arm — 다른 데를 누르면 풀립니다). */
    if (한번더말[fa] && a.dataset.armed !== '1'){ arm(a, 한번더말[fa]); return; }
    a.disabled = true;
    if (fa === 'followback') await 이름먼저();
    const r = fa === 'cancel' || fa === 'unfollow' ? await netTimeout(sb.rpc('follow_drop', { p_user: id }))
            : fa === 'remove'    ? await netTimeout(sb.rpc('follower_drop', { p_user: id }))
            : fa === 'followback'? await netTimeout(sb.rpc('follow_ask', { p_user: id }))
            : await netTimeout(sb.rpc('follow_answer', { p_user: id, p_ok: fa === 'accept' }));
    if (!r || r.error){ a.disabled = false; toast(r?.error?.message || '연결을 확인해 주세요'); return; }
    toast({ accept: '수락했어요', decline: '거절했어요', cancel: '요청을 취소했어요',
            unfollow: '팔로우를 끊었어요', remove: '팔로워에서 뺐어요',
            followback: r.data === 'accepted' ? '맞팔로우했어요' : '팔로우를 요청했어요' }[fa]);
    loadSocialCounts();
    그리기();
    return;
  }

  const 사람 = e.target.closest('[data-person]');
  if (사람){ ctx.openPerson(사람.dataset.person); return; }

  const t = e.target.closest('#fr_tabs [data-fr]');
  if (t){ 탭 = t.dataset.fr; 탭칠하기(); 그리기(); return; }
  /* 묶음 줄(요청 · 맞팔로우 안 한 사람) → 들어간 판 · 정렬 바꾸기(b859) */
  const 속 = e.target.closest('[data-frsub]');
  if (속) return 판열기(속.dataset.frsub);
  if (e.target.closest('[data-frsort]')){ 정렬 = 정렬 === '이름' ? '기본' : '이름'; return 그리기(); }

  if (e.target.closest('#friendback')) return closeFriends();
});
/* ── 찾기 화면(b858, 인스타처럼) ─────────────────────────────────────────
 * 사용자(10-13): 「윤 입력만 해도 뜨게 해주고 … 검색을 지우면 검색된 친구가 사라져야 하는데 그대로 떠 있고 …
 *   검색은 다른 창에서 진행 되어야지」.
 * ⚠ 옛 판(b800)은 엔터에서만 찾았고, 비우기는 type=search 의 'search' 이벤트에 기댔습니다 — **아이폰은 글자를
 *   지워 비울 때 그 이벤트를 안 보냅니다**(그래서 결과가 남았습니다). 이제 'input' 하나로 치고 지우는 것을 다 봅니다.
 * ⚠ 서버는 «앞글자가 같으면» 20명까지(db/121). 늦게 온 답이 새 답을 덮지 않게 차례(찾기차례)를 셉니다.
 * ⚠ 열 때 focus 는 «누른 그 순간» 안에서 — 아이폰이 키보드를 올리는 조건입니다(await 앞). */
let 찾기차례 = 0, 찾기틈 = null;
let 바로찾기 = false;      /* 프로필 「친구 찾기」로 바로 들어왔나(b859) */
const 찾기중 = () => $('friendview')?.classList.contains('frs') === true;
function 찾기비우기(){
  clearTimeout(찾기틈); 찾기차례++;
  if ($('fr_q')) $('fr_q').value = '';
  $('fr_qx')?.classList.add('hide');
  if ($('fr_found')) $('fr_found').innerHTML = 찾기안내();
}
const 찾기안내 = () => '<div class="frshint">이름 앞글자만 쳐도 찾아져요.</div>';
function 찾기열기(){
  if (찾기중()) { $('fr_q').focus(); return; }
  찾기비우기();
  $('friendview').classList.add('frs');
  $('friendview').scrollTop = 0;
  if (!바로찾기) history.pushState({ t2:'frsearch' }, '');
  $('fr_q').focus();
}
function 찾기닫기(fromPop){
  if (바로찾기) return closeFriends(fromPop);    /* 「취소」 — 프로필로 */
  if (!fromPop && history.state?.t2 === 'frsearch'){ history.back(); return; }
  $('fr_q')?.blur();
  찾기비우기();
  $('friendview')?.classList.remove('frs');
}
$('fr_qbtn')?.addEventListener('click', 찾기열기);
$('fr_qcancel')?.addEventListener('click', () => 찾기닫기());
$('fr_qx')?.addEventListener('click', () => { 찾기비우기(); $('fr_q').focus(); });
$('fr_q')?.addEventListener('input', () => {
  const 있다 = !!$('fr_q').value.trim();
  $('fr_qx').classList.toggle('hide', !$('fr_q').value);
  clearTimeout(찾기틈);
  if (!있다){ 찾기차례++; $('fr_found').innerHTML = 찾기안내(); return; }
  찾기틈 = setTimeout(찾기, 180);       /* 한 글자마다 서버를 부르지 않게 잠깐 기다립니다 */
});
/* 엔터(키보드의 「검색」)는 키보드만 내립니다 — 결과는 이미 떠 있습니다. */
$('fr_q')?.addEventListener('keydown', e => {
  if (e.key === 'Enter'){ e.preventDefault(); clearTimeout(찾기틈); 찾기(); $('fr_q').blur(); }
});

async function 찾기(){
  const q = $('fr_q').value.trim();
  const 칸 = $('fr_found');
  if (!q){ 칸.innerHTML = 찾기안내(); return; }
  const 이번 = ++찾기차례;
  const r = await netTimeout(sb.rpc('people_find', { p_name: q }));
  if (이번 !== 찾기차례) return;        /* 그새 글자가 바뀌었거나 비웠습니다 */
  if (!r || r.error){ 칸.innerHTML = 빈칸('지금은 찾을 수 없어요.', r?.error?.message || ''); return; }
  const 나 = ctx.me()?.id;
  const 목록 = (r.data || []).filter(p => p.user_id !== 나);
  칸.innerHTML = 목록.length
    /* 상태는 이름 밑 둘째 줄(b800, 인스타처럼) — 누르면 그 사람 화면에서 팔로우합니다. */
    ? 목록.map(p => 사람줄(p, '', p.mine === 'accepted' ? '팔로잉 중'
                                : p.mine === 'requested' ? '요청됨' : '')).join('')
    : `<div class="frshint">「${esc(q)}」${josa(q, '으로', '로').slice(q.length)} 시작하는 이름이 없어요.<br>` +
      '처음 이름(메일 앞부분)을 그대로 쓰는 사람은 안 찾아져요 — 그 사람에게 프로필 링크를 받으세요.</div>';
}

/* ── 내 프로필 링크 ─────────────────────────────────────────────────── */
/* ⚠ **링크 코드를 미리 받아 둡니다(b791).** 아이폰은 공유 창을 단추를 누른
   «그 순간»에만 띄워 줍니다 — 누른 뒤 서버에 코드를 물으러 갔다 오면 그 순간이
   지나 공유 창 대신 복사로 떨어질 수 있습니다. 설정 칸을 채울 때(loadSocialPrefs)
   받아 두고, 없을 때만 여기서 받습니다. 사람이 바뀌면 버립니다. */
let 내코드 = null, 코드주인 = null;
async function 내링크(){
  const 나 = ctx.me()?.id;
  if (!내코드 || 코드주인 !== 나){
    const r = await netTimeout(sb.from('profiles').select('link_code').eq('id', 나).maybeSingle());
    내코드 = r?.data?.link_code || null; 코드주인 = 나;
  }
  return 내코드 ? location.origin + location.pathname + '?p=' + encodeURIComponent(내코드) : null;
}
/* 프로필 머리의 「프로필 공유」(b791)가 부릅니다. 친구 화면 맨 아래에 같은 단추가 있었는데
   중복이라 b793 에 걷었습니다(「새 링크로」도 같이). */
export function shareProfile(){ return 링크보내기(); }
async function 링크보내기(){
  const url = await 내링크();
  if (!url){ toast('링크를 만들 수 없어요. 잠시 뒤에 다시 해 주세요'); return; }
  const text = '기로에서 내 여행 지구본과 기록을 볼 수 있어요. 팔로우해 주세요!';
  if (navigator.share){
    try { await navigator.share({ title: '기로', text, url }); return; }
    catch (e){ if (e?.name === 'AbortError') return; }
  }
  toast(await copyText(url) ? '링크를 복사했어요' : url);
}

/* ── 설정: 공개 범위(b790 에 이름을 바꿈 · 세 가지는 b799) ─────────────────────────────────
 * 공개 계정 / 비공개 계정 / 비활성화(db/106) · 별점 보이기 · 팔로우 알림 · 차단한 사람.
 * ⚠ 옛 「비공개로 잠그기」 스위치와 「팔로우 받기(승인/누구나)」를 이 셋으로 합쳤습니다.
 *   서버는 옛 칸(locked · follow_mode)을 새 칸(visibility)에 맞춰 둡니다 — 옛 판 폰을 위해.
 * 톱니 설정 화면이 열릴 때 app.js 가 부릅니다. */
export async function loadSocialPrefs(){
  const me = ctx.me();
  if (!me) return;
  const [p, u, bl] = await Promise.all([
    netTimeout(sb.from('profiles').select('visibility,show_stars,link_code').eq('id', me.id).maybeSingle()),
    netTimeout(sb.from('user_prefs').select('*').eq('user_id', me.id).maybeSingle()),
    netTimeout(sb.rpc('my_blocks')),
  ]);
  const 카드 = $('socialcard');
  if (!p || p.error || !p.data){ 카드?.classList.add('hide'); return; }
  카드?.classList.remove('hide');
  범위칠하기(p.data.visibility || 'public');   /* 기본은 공개(b799, db/108) */
  if (p.data.link_code){ 내코드 = p.data.link_code; 코드주인 = me.id; }   /* 공유용(b791, 위 내링크) */
  $('sc_stars').checked = p.data.show_stars !== false;
  $('sc_notify').checked = u?.data?.notify_social !== false;
  const 막음 = bl?.data || [];
  $('sc_blocks').innerHTML = 막음.length
    ? 막음.map(x => `<div class="frrow2"><span>${esc(x.name || '여행자')}</span>
        <button class="small" data-unblock="${esc(x.user_id)}">차단 풀기</button></div>`).join('')
    : '<span class="memo">차단한 사람이 없어요.</span>';
}
function 범위칠하기(v){
  document.querySelectorAll('#sc_vis [data-vis]').forEach(b => {
    const on = b.dataset.vis === v;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  범위표시(v);
}
/* 넓게 여는 것(공개)과 다 닫는 것(비활성화)은 한 번 더 눌러 정합니다. 칸 안의 `.visask` 가
   그때만 보입니다(app.css). ⚠ ui.js 의 arm 을 안 씁니다 — arm 은 글자를 통째로 갈아서
   칸 안의 제목·설명 모양이 깨집니다. `data-armed` 만 씁니다: 다른 데를 누르면 ui.js 가
   알아서 풉니다(disarm 은 dataset.orig 가 없으면 글자를 안 건드립니다). */
const 한번더범위 = new Set(['public', 'off']);
const 범위말 = {
  public:  '공개 계정으로 바꿨어요 — 로그인한 누구나 볼 수 있어요',
  private: '비공개 계정으로 바꿨어요 — 승인한 팔로워만 봐요',
  off:     '비활성화했어요 — 이제 아무에게도 안 보여요',
};
$('socialcard')?.addEventListener('click', async e => {
  const v = e.target.closest('#sc_vis [data-vis]');
  if (v){
    const 전 = document.querySelector('#sc_vis .on')?.dataset.vis || 'private';
    const 새 = v.dataset.vis;
    if (새 === 전) return;
    if (한번더범위.has(새) && v.dataset.armed !== '1'){ v.dataset.armed = '1'; return; }
    v.dataset.armed = '';
    범위칠하기(새);
    const r = await netTimeout(sb.from('profiles').update({ visibility: 새 })
      .eq('id', ctx.me().id).select('visibility'));
    if (!r || r.error || !r.data?.length){ 범위칠하기(전); toast('저장하지 못했어요'); return; }
    toast(범위말[새]);
    loadSocialCounts();       /* 프로필 머리의 🌐/🔒 표시 · 공개로 바꾸며 수락된 요청 점 */
    return;
  }
  const u = e.target.closest('[data-unblock]');
  if (u){
    u.disabled = true;
    const r = await netTimeout(sb.rpc('unblock_user', { p_user: u.dataset.unblock }));
    if (!r || r.error){ u.disabled = false; toast('풀지 못했어요'); return; }
    toast('차단을 풀었어요');
    loadSocialPrefs();
  }
});
$('socialcard')?.addEventListener('change', async e => {
  if (e.target.id === 'sc_stars'){
    const on = e.target.checked;
    const r = await netTimeout(sb.from('profiles').update({ show_stars: on })
      .eq('id', ctx.me().id).select('show_stars'));
    if (!r || r.error || !r.data?.length){ e.target.checked = !on; toast('저장하지 못했어요'); return; }
    toast(on ? '별점을 보여요' : '별점을 숨겨요 — 별 개수만 가려요');
  }
});
/* 팔로우 알림 — **알림 칸으로 옮겨 갔습니다(b790).** 그래서 위 `#socialcard`
   의 change 로는 안 옵니다. 스위치에 직접 답니다. */
$('sc_notify')?.addEventListener('change', async e => {
  const on = e.target.checked;
  const r = await netTimeout(sb.from('user_prefs')
    .upsert({ user_id: ctx.me().id, notify_social: on }, { onConflict: 'user_id' }).select('user_id'));
  if (!r || r.error || !r.data?.length){ e.target.checked = !on; toast('저장하지 못했어요'); return; }
  toast(on ? '팔로우 알림을 받아요' : '팔로우 알림을 껐어요');
});
/* 설정 목록의 「공개 범위」 줄 오른쪽 값(b790 → b799) — 지금 고른 것. */
function 범위표시(v){
  if ($('sv_open')) $('sv_open').textContent = ({ public: '공개', private: '비공개', off: '비활성화' })[v] || '';
}
