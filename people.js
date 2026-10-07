/* ── 남의 프로필(b789 · 요약 첫 판 b799) ──────────────────────────────
 * 사용자: 「사람들 유입되기 전에 기능은 다 만들어 놔야지」 · 「다른 어플들
 *   벤치마크해서 제대로 미리 만들어 놓자」. 설계와 근거는 db/101_follow.sql 머리말.
 *
 * ── 첫 판은 요약, 누르면 목록(b799) ────────────────────────────────────
 * 사용자: 「팔로잉 하는 친구 앱 들어가면 세로로 너무 길게 나와 왓챠처럼 그 항목에
 *   들어가면 주르륵 볼 수 있게 나와야지 첫판은 요약이 있어야해」 → 시안을 보고
 *   「시안대로 하돼 명소검열관 카드 만들었는데 그거도 보이게 하자」.
 *   b798 까지는 궁합 · 지구본 · 수 · 성향 · 배지 · 별점 77곳이 한 판에 세로로 다 나왔습니다.
 *   첫 판(#whosum): 머리 → 지구본 → 나라·도시·한줄평 세 칸 → 궁합과 「흥미로운 사실」 → 여행 분석(별점
 *     분포) → **맨 아래 「여행 성향」**(분석 탭의 히어로 + 네 축 막대 — b802, 사용자: 「명소검열관 위에
 *     여행성향 텍스트 달아주고 제일 아래로 내리자 … 저거만 덩그러니 있으니 톤앤매너가 안맞는데??」 → 시안 A).
 *   들어간 판(#whosub): 도시(별점 순·나라별·한줄평) · 나라 · 궁합 · 여행 분석(맨 아래 받은 배지) ·
 *     여행 성향(왜 ○○○○ 인가요 · 여행 궁합 — b804, 사용자: 「자세히 눌러도 위에 모든 분석이랑 같은
 *     페이지로 이동되는거아냐?」 → 시안 「성향 화면 따로」. 「성향 네 축」은 여행 분석에서 뺐습니다).
 *   ⚠ 배지는 세 칸에서 뺐습니다(b802, 사용자: 「나라 도시 옆에 배지가 … 값어치가 비슷한 부분인가?」 → 한줄평).
 * ⚠ 들어간 판도 기록을 한 칸씩 쌓습니다(`whosub`) — 뒤로 한 번에 한 겹:
 *   나라 → (나라를 누름) 그 나라 도시 → 도시 화면 → 뒤로 셋이면 첫 판.
 *   tripview.js 의 사슬은 `personBack` 을 부릅니다(판이 있으면 판, 없으면 사람 화면을 닫음).
 * ⚠ 첫 판은 **숨기기만** 합니다(다시 안 그림). 돌아오면 스크롤 자리 그대로, 지구본도 그대로.
 *   들어간 판은 열 때마다 받아 둔 자료(`알`)로 새로 그립니다 — 서버에 다시 안 묻습니다.
 *
 * 보이는 것
 *   머리(누구나 — 로그인한 사람): 사진 · 이름 · 소개 · 팔로워/팔로잉 수 · 함께 아는 사람 ·
 *     팔로우 단추. 나를 팔로우하겠다고 요청한 사람이면 수락/거절도 여기서.
 *   알맹이(나 자신 · 공개 계정은 누구나 · 비공개 계정은 승인된 팔로워 — db/106):
 *     지구본 · 나라/도시 · 배지 · 궁합 · 성향 · 별점과 한줄평(별점은 본인이 숨길 수 있음).
 *   ⚠ 가고 싶은 곳 · 일기 · AI 대화는 서버가 아예 안 보냅니다(person_body).
 *   ⚠ 비활성화(visibility 'off')한 사람은 남에게 이름·사진과 「비활성화된 계정」만.
 *
 * ⚠ **덮는 층입니다(`#whoview`, position:fixed).** 도시 화면·여행 일행·알림·친구
 *   화면 어디서든 열립니다. 그래서 아래 화면을 숨기고 되살리는 대신 위에 덮고,
 *   닫으면 그대로 드러납니다 — 탭 덱·판 목록(네 곳)을 건드리지 않습니다.
 * ⚠ 뒤로가기는 tripview.js 의 popstate 사슬 «맨 위»에 있습니다(사진 다음).
 * ⚠ 지구본은 열 때마다 새로 띄우고 닫을 때 `끝()` 으로 치웁니다 — 안 치우면
 *   보이지도 않는 지구가 뒤에서 계속 돕니다.
 */
import { $, esc, toast, avatarImg, flagOf, flagOk, emptyDo } from './dom.js?v=b829';
import { sb } from './db.js?v=b829';
import { netTimeout } from './net.js?v=b829';
import { cities, countryName } from './cities.js?v=b829';
import { myRates, visited, 별받음 } from './rate.js?v=b829';
/* 내 별점이 아직 안 왔으면 받는 곳(b797 — 아래 `알맹이그림`). rating.js 는 이 파일을 안 읽으므로 고리가 없습니다. */
import { loadRateData } from './rating.js?v=b829';
import { PERSONA16, personaMatch, personaMateLine, personaAxes, personaRank,
         personaMates, axisSpectrum, AXIS_WORD,
         personaSaved, personaWhyHtml } from './card.js?v=b829';
/* 내 코드는 서버에 올린 것(흔들림 막기까지 거친 것)을 먼저 씁니다 — 분석 탭과 같은 유형이어야 궁합이 맞습니다. */
import { knownPersona } from './pshift.js?v=b829';
import { starsRo } from './stars.js?v=b829';
import { mountGlobe } from './globe.js?v=b829';
import { arm } from './ui.js?v=b829';
/* 친구가 매긴 도시를 누르면 여는 화면(b789). city.js 는 이 파일을 안 읽으므로 고리가 없습니다. */
import { openCity } from './city.js?v=b829';

let ctx = { me: () => null, openFriends: () => {}, onFollowChange: () => {} };
export function setPeopleCtx(o){ ctx = { ...ctx, ...o }; }

let 지금 = null;          /* 열린 사람 id */
let 머리 = null;          /* 마지막으로 받은 person_head */
let 알 = null;            /* 마지막으로 받은 person_body(못 보면 null) — 들어간 판이 씁니다 */
let 공 = null;            /* 지구본 */
let 차례 = 0;             /* 늦게 온 답은 버립니다 */
let 배지표 = null;        /* badge_defs — 한 번만 받습니다 */
/* 들어간 판들(b799). 맨 끝이 지금 보이는 판입니다.
   { 종류, cc?, 정렬?, 아래: 그 밑 판(첫 판이나 앞 판)의 스크롤 } */
let 층 = [];
/* 궁합이 나오는 문턱 — persona.js 와 같은 **해외 10곳**(2026-10-03 사용자 · v2 부터 해외만 — 국내는 성향에 안 들어감). */
const 문턱 = 10;

export const isPersonOpen = () => !!$('whoview') && !$('whoview').classList.contains('hide');

/* ── 도시 밑에 가려 둔 사람(b789) ─────────────────────────────────────
 * 친구가 매긴 도시를 누르면 도시 화면이 이 판을 **가리고** 위에 뜹니다
 * (city.js 의 겹). 거기서 또 다른 사람 이름을 누르면 이 판 하나를 다시
 * 써야 하므로, 가려져 있던 사람을 그린 것째(지구본 · 들어간 판까지) 챙겨 두었다가
 * 위의 사람을 닫을 때 되돌립니다. 도시를 닫으면 city.js 가 판을 되살려
 * 그대로 보입니다. 뒤로 한 번에 한 겹: 사람 B → 도시 → 사람 A.
 * ⚠ 챙긴 지구본은 끝내지 않습니다 — 떼어 낸 캔버스는 안 보이므로
 *   globe.js 의 눈(IntersectionObserver)이 알아서 멈춥니다. */
let 아래사람 = [];

export async function openPerson(uid){
  if (!uid || !ctx.me()) return;
  const 판 = $('whoview');
  if (지금 && 판.classList.contains('hide')){
    const 조각 = document.createDocumentFragment();
    const 몸 = $('whobody');
    while (몸.firstChild) 조각.appendChild(몸.firstChild);
    아래사람.push({ 지금, 머리, 알, 공, 층, 조각, 메뉴: !$('whomenu').classList.contains('hide') });
    공 = null;
  }
  층 = [];
  지금 = uid;
  판.classList.remove('hide');
  판.scrollTop = 0;
  if (history.state?.t2 !== 'who') history.pushState({ t2:'who' }, '');
  await 그리기();
}

export function closePerson(fromPop){
  if (!fromPop){
    const t = history.state?.t2;
    /* 들어간 판에서 닫으면(차단 등) 그 판들의 기록까지 한 번에 걷습니다 — 뒤로가기
       사슬이 한 번만 와서 `personBack` 이 (판이 없으니) 사람 화면을 닫습니다. */
    if (t === 'whosub' && 층.length){ const n = 층.length + 1; 층 = []; history.go(-n); return; }
    if (t === 'who'){ history.back(); return; }
  }
  $('whoview')?.classList.add('hide');
  $('whosheet')?.classList.add('hide');
  공?.끝?.(); 공 = null;
  지금 = null; 머리 = null; 알 = null; 층 = []; 차례++;
  const 전 = 아래사람.pop();
  if (전){
    /* 도시 밑에 가려 두었던 사람을 되돌립니다 — 판은 가린 채로(도시가 닫히면 보임). */
    ({ 지금, 머리, 알, 공, 층 } = 전);
    $('whobody').replaceChildren(전.조각);
    $('whomenu').classList.toggle('hide', !전.메뉴);
  }
}

/* 뒤로(b799) — 들어간 판이 있으면 한 겹만, 없으면 사람 화면을 닫습니다.
   tripview.js 의 뒤로가기 사슬과 「← 뒤로」 단추가 부릅니다. */
export function personBack(fromPop){
  if (층.length) return 나오기(fromPop);
  closePerson(fromPop);
}

/* 통째로 치웁니다 — 로그아웃·계정 전환, 그리고 도시 밑에 가려진 채
   탭을 옮겼을 때(app.js). 가려 둔 사람들의 지구본도 끝냅니다. */
export function resetPerson(){
  아래사람.forEach(x => x.공?.끝?.());
  아래사람 = [];
  층 = [];
  closePerson(true);
}

/* ── 그리기 ────────────────────────────────────────────────────────── */
async function 그리기(){
  const 이번 = ++차례, uid = 지금;
  const 몸 = $('whobody');
  공?.끝?.(); 공 = null;
  몸.innerHTML = '<div class="empty"><span class="load">불러오는 중…</span></div>';
  const [h, b] = await Promise.all([
    netTimeout(sb.rpc('person_head', { p_user: uid })),
    netTimeout(sb.rpc('person_body', { p_user: uid })),
  ]);
  if (이번 !== 차례) return;
  if (!h || h.error){
    몸.innerHTML = `<div class="empty">지금은 프로필을 볼 수 없어요.<br>
      <span class="memo">${esc(h?.error?.message || '연결을 확인해 주세요')}</span></div>`;
    return;
  }
  머리 = h.data;
  if (!머리){ 몸.innerHTML = emptyDo('찾을 수 없는 사람이에요.', '', '', '계정이 없어졌을 수 있어요'); return; }
  $('whomenu').classList.toggle('hide', !!머리.self);
  const 받은 = 머리.can_see ? (b && !b.error ? b.data : null) : null;
  /* ⚠ 알맹이는 기다립니다(배지표 · 내 별점) — 그사이 다른 사람을 열었으면 늦은 그림을 버립니다(b797). */
  const 아래 = 받은 ? await 알맹이그림(머리, 받은) : 잠김그림(머리);
  if (이번 !== 차례) return;
  알 = 받은;
  if (!알) 층 = [];
  몸.innerHTML = `<div id="whosum">${머리그림(머리) + 아래}</div><div id="whosub" class="hide"></div>`;
  if (알) 지구본올리기(알);
  /* 들어간 판에서 다시 그렸으면(⋯ 의 팔로워 빼기 등) 그 판을 새 자료로 다시 폅니다. */
  if (층.length) 서브그리기(false);
}

function 이름(h){ return h?.name || '여행자'; }   /* b799: 「이름 없음」→「여행자」(사용자) */
/* 공개 범위(b799, db/106). 옛 서버(106 전)는 visibility 를 안 보내므로 잠금에서 셉니다. */
const 범위 = h => h?.visibility || (h?.locked ? 'off' : 'private');

function 머리그림(h){
  /* 비활성화한 사람(db/106 — 옛 「비공개로 잠그기」). 서버가 수·소개·알맹이를 안 보냅니다.
     이미 팔로우 중이거나 요청해 둔 것은 끊거나 거둘 수 있게 둡니다. */
  const 꺼짐 = 범위(h) === 'off' && !h.self;
  const 단추 = (() => {
    if (h.self) return `<button class="small" data-who="friends">내 친구 보기</button>`;
    if (h.mine === 'accepted') return `<button class="small on" data-who="unfollow">팔로잉 ✓</button>`;
    if (h.mine === 'requested') return `<button class="small" data-who="cancel">요청됨</button>`;
    if (꺼짐) return `<button class="small" disabled>비활성화된 계정</button>`;
    const 글 = h.theirs === 'accepted' ? '맞팔로우' : '팔로우';
    return `<button class="primary" data-who="follow">${글}</button>`;
  })();
  /* 나에게 온 요청은 여기서 바로 답합니다(인스타그램과 같은 자리). */
  const 요청 = !h.self && h.theirs === 'requested'
    ? `<div class="whoask">${esc(이름(h))}님이 팔로우를 요청했어요
         <span><button class="small primary" data-who="accept">수락</button>
               <button class="small" data-who="decline">거절</button></span></div>`
    : '';
  const 함께 = !h.self && h.mutual > 0 ? `<div class="memo">함께 아는 사람 ${h.mutual}명</div>` : '';
  /* 내 화면일 때 — 지금 누구에게 보이는지 늘 알려 둡니다(잠근 걸 잊고 「왜 아무도 안 보지」가 안 되게). */
  const 내범위 = !h.self ? '' : ({
    public: '🌐 공개 계정이에요 — 로그인한 누구나 내 기록을 봐요',
    off:    '🔒 비활성화해 두었어요 — 지금은 나만 봐요',
  })[범위(h)] || '';
  return `<div class="card whohead">
    <div class="whotop">
      ${avatarImg(h.avatar_url, h.id, 이름(h),
                  'width:72px;height:72px;border-radius:50%;object-fit:cover;flex:none', 'thumb')}
      <div class="whoid">
        <div class="whoname">${esc(이름(h))}</div>
        ${꺼짐 ? '' : `<div class="whocounts"><span>팔로워 <b>${h.followers ?? 0}</b></span>
                               <span>팔로잉 <b>${h.following ?? 0}</b></span></div>`}
      </div>
    </div>
    ${h.bio ? `<p class="whobio">${esc(h.bio)}</p>` : ''}
    ${내범위 ? `<div class="memo">${내범위}</div>` : ''}
    ${함께}
    <div class="whobtns">${단추}</div>
    ${요청}
  </div>`;
}

function 잠김그림(h){
  if (h.self) return '';
  const 말 = 범위(h) === 'off'
    ? `비활성화된 계정이에요. 지금은 아무에게도 기록을 보여주지 않아요.`
    : h.mine === 'requested'
    ? `요청을 보냈어요. ${esc(이름(h))}님이 승인하면 지구본과 기록이 보여요.`
    : `비공개 계정이에요. ${esc(이름(h))}님이 팔로우를 승인하면 지구본과 기록이 보여요.`;
  return `<div class="card wholock"><div class="i" aria-hidden="true">🔒</div><p>${말}</p></div>`;
}

/* 내 성향 코드 — 서버에 올린 것(v2: 다시 간 도시·흔들림 막기까지 거친 것)이 있으면 그것,
   없으면 내 별점으로 계산합니다(확정 해외 10곳부터). */
function 내코드(){
  const 올린 = knownPersona(ctx.me()?.id);
  if (올린 && PERSONA16[올린]) return 올린;
  const rows = Object.entries(myRates || {})
    .filter(([, r]) => r?.stars != null).map(([city_id, r]) => ({ city_id, stars: r.stars }));
  const a = personaAxes(rows, { cities: cities || [] });
  return a.해외 >= 문턱 ? a.code : null;   /* 문턱은 해외 10곳(위 `문턱`) */
}
/* 그 사람 막대(v2) — 본인 앱이 올린 네 숫자(110 · persona_ax)를 먼저 씁니다. 다시 간 횟수는 남에게 안 와서
   여기서 새로 세면 본인 화면과 어긋나기 때문입니다. 없으면(110 전 · 옛 앱) 보이는 별점으로 세되
   **코드 글자에 맞춥니다**(personaSaved) — 어긋나는 축은 글자 쪽으로 짧게만 그립니다(b805 막대=글자 규칙). */
function 그사람축(너, b, rows){
  const 올린 = personaSaved(너, b?.persona_ax);
  if (올린) return 올린;
  if (!rows?.length) return null;
  const a = personaAxes(rows, { cities: cities || [] });
  if (a.해외 < 문턱) return null;
  return personaSaved(너, [a.개척, a.단골, a.모험, a.만족]);
}
/* 그 사람 성향 — 서버에 적힌 코드(본인 앱이 적음). 없으면 보이는 별점으로 계산. */
function 그사람코드(b){
  if (b.persona && PERSONA16[b.persona]) return b.persona;
  const rows = (b.ratings || []).filter(r => r.stars != null);
  if (!b.show_stars || !rows.length) return null;
  const a = personaAxes(rows, { cities: cities || [] });
  return a.해외 >= 문턱 ? a.code : null;
}

const 도시 = id => (cities || []).find(c => c.id === id);
/* 도시(c.cc)나 나라({ cc })를 받습니다. */
const 국기 = c => (c && flagOk() ? flagOf(c.cc || c.country) + ' ' : '');
const 도시이름 = id => 도시(id)?.name || id;
/* 별 하나를 글자로(나 ★4.5 · 너 ★3). 별 다섯 그림을 두 벌 세우면 줄이 넘칩니다. */
const 별글 = v => `<em class="whost">★${Number(v)}</em>`;

async function 배지들(){
  if (배지표) return 배지표;
  const r = await netTimeout(sb.rpc('badge_defs'));
  배지표 = Object.fromEntries((r?.data || []).map(d => [d.id, d]));
  return 배지표;
}

/* 다녀온 곳 + 별점·한줄평을 남긴 곳(한줄평만 남긴, 안 가 본 곳도 있을 수 있음). */
function 도시목록(b){
  const 별 = new Map((b.ratings || []).map(r => [r.city_id, r]));
  const ids = new Set([...(b.visited || []), ...별.keys()]);
  return [...ids].map(id => ({ id, c: 도시(id), r: 별.get(id) || null }));
}
/* 나라별로 묶기 — c.cc 는 딸린 땅을 본국으로 셉니다(cities.js, 서버 foot 과 같은 셈). */
function 나라묶음(목록){
  const 묶음 = {};
  for (const x of 목록) if (x.c) (묶음[x.c.cc] ||= []).push(x);
  const 키 = Object.keys(묶음).sort((a, c) => 묶음[c].length - 묶음[a].length
    || (countryName[a] || a).localeCompare(countryName[c] || c, 'ko'));
  return { 묶음, 키 };
}
const 별값 = x => x.r?.stars != null ? Number(x.r.stars) : null;
const 줄이름 = x => x.c?.name || x.id;
const 별순 = (a, c) => ((별값(c) ?? -1) - (별값(a) ?? -1)) || 줄이름(a).localeCompare(줄이름(c), 'ko');

/* 별점 모음 — 0.5 칸으로 맞춥니다. 별점을 가린 사람이면 빈 배열(서버가 null 로 보냄). */
const 별모음 = b => (b.ratings || []).filter(r => r.stars != null).map(r => Math.round(Number(r.stars) * 2) / 2);
const 칸들 = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
function 분포(별들){
  const 수 = 칸들.map(v => 별들.filter(s => s === v).length);
  const 큰 = Math.max(...수);
  return { 수, 큰, 많이: 칸들[수.indexOf(큰)],
           평균: 별들.length ? 별들.reduce((s, v) => s + v, 0) / 별들.length : null };
}
/* 별점 분포 막대(왓챠 「별점 분포」). 제일 많이 준 칸만 진하게. */
function 막대(별들, 높이){
  const { 수, 큰 } = 분포(별들);
  return `<div class="whohist" style="height:${높이}px" aria-hidden="true">${수.map(n =>
      `<i class="${n === 0 ? 'zero' : n === 큰 ? 'top' : ''}"
          style="height:${n ? Math.max(3, Math.round(n / 큰 * 높이)) : 1}px"></i>`).join('')}</div>
    <div class="whohistx" aria-hidden="true">${칸들.map(v =>
      `<span>${Number.isInteger(v) ? v : ''}</span>`).join('')}</div>`;
}

/* 나와 견주기 — 궁합 카드와 궁합 판이 같이 씁니다(계산이 두 군데 있으면 언젠가 갈라집니다).
   좋게: 둘 다 ★4 이상 · 엇갈림: 1.5점 넘게 차이 · 차이: 둘 다 매긴 도시의 별점 차이 평균. */
function 견주기(b){
  const 간것 = new Set(b.visited || []);
  const 둘다 = [...간것].filter(id => visited?.has?.(id))
    .sort((a, c) => 도시이름(a).localeCompare(도시이름(c), 'ko'));
  const 짝 = (b.ratings || []).filter(r => r.stars != null && myRates?.[r.city_id]?.stars != null)
    .map(r => ({ id: r.city_id, 너: Number(r.stars), 나: Number(myRates[r.city_id].stars) }));
  const 좋게 = 짝.filter(x => x.너 >= 4 && x.나 >= 4).sort((a, c) => (c.너 + c.나) - (a.너 + a.나));
  const 엇갈림 = 짝.filter(x => Math.abs(x.너 - x.나) >= 1.5)
    .sort((a, c) => Math.abs(c.너 - c.나) - Math.abs(a.너 - a.나));
  const 차이 = 짝.length ? 짝.reduce((s, x) => s + Math.abs(x.너 - x.나), 0) / 짝.length : null;
  return { 둘다, 짝, 좋게, 엇갈림, 차이 };
}

async function 알맹이그림(h, b){
  /* ⚠⚠ **내 별점부터 받습니다(b797, SNS 점검에서 찾음).** ⚠⚠ 궁합·「둘 다 매긴 도시」는 내 별점
     (`myRates`)으로 세는데, 그건 평가 탭을 열어야 받아집니다. 평가 탭을 안 거치고 친구 프로필을
     열면 — 별점 77곳·성향 FMDP 인 계정이 — 「도시를 5곳 매기면 궁합이 나와요」가 떴습니다.
     홈의 나라 카드(home.js `나라카드`)와 같은 방식: 비었으면 한 번 받습니다(못 받아도 그립니다). */
  if (!h.self && !별받음){ try { await loadRateData(); } catch {} }
  const 표 = await 배지들();
  const 너 = 그사람코드(b);
  const 목록 = 도시목록(b);
  /* 세 칸 — 나라 · 도시 · 한줄평(b802). 배지는 나라·도시 수에서 나온 보상이라 같은 줄에 두면 같은 무게로
     읽혔습니다 — 「여행 분석」 판 맨 아래로 옮겼습니다. 한줄평 칸은 도시 판을 「한줄평」 거르기로 엽니다. */
  const 칸 = (종류, 수, 말, 정렬) => `<div class="card whotile" data-whosub="${종류}"${
      정렬 ? ` data-sort="${정렬}"` : ''} role="button" tabindex="0"><b>${수}</b><span>${말}</span></div>`;
  return `<div class="card whoglobe"><canvas id="whocanvas" aria-label="${esc(이름(h))}님이 방문한 도시"></canvas></div>
    <div class="whotiles">
      ${칸('country', 나라묶음(목록).키.length, '나라')}${칸('city', 목록.length, '도시')}${
        칸('city', 목록.filter(x => x.r?.comment).length, '한줄평', 'comment')}
    </div>
    ${h.self ? '' : 궁합카드(h, b, 너)}
    ${분석카드(b)}
    ${성향카드(h, 너, b.foot || {}, b)}`;
}

/* ── 궁합 ── 성향 코드(원래 궁합 공식 그대로) + 「흥미로운 사실」(왓챠).
   ⚠ 공식은 바꾸지 않습니다 — 궁합 링크로 이미 보던 숫자와 달라지면 안 됩니다
     (벤치마크: Spotify 가 말없이 공식을 바꿨다가 94% → 3% 로 들통남). */
function 궁합카드(h, b, 너){
  const 나 = 내코드(), 점수 = 나 && 너 ? personaMatch(나, 너) : null;
  const { 둘다, 좋게, 엇갈림 } = 견주기(b);
  const 누구 = esc(이름(h));
  const 몇 = (목록, n) => 목록.slice(0, n).map(esc).join(' · ') + (목록.length > n ? ` 외 ${목록.length - n}곳` : '');
  const 사실 = [];
  if (좋게.length) 사실.push(`<div class="whofact"><b>둘 다 좋게 본 곳</b>
      <span>${몇(좋게.map(x => 도시이름(x.id)), 2)}</span></div>`);
  if (엇갈림.length){ const x = 엇갈림[0];
    사실.push(`<div class="whofact"><b>엇갈린 곳</b>
      <span>${esc(도시이름(x.id))} <i class="memo">나 ${별글(x.나)} · ${누구} ${별글(x.너)}</i>${
        엇갈림.length > 1 ? ` <i class="memo">외 ${엇갈림.length - 1}곳</i>` : ''}</span></div>`); }
  if (둘다.length) 사실.push(`<div class="whofact"><b>둘 다 가 본 곳</b>
      <span>${둘다.length}곳 <i class="memo">${몇(둘다.map(도시이름), 3)}</i></span></div>`);
  return `<div class="card whomatch" data-whosub="match" role="button" tabindex="0">
    <div class="whocardhd"><span class="memo">나와의 여행 궁합</span><span class="whomore">자세히 ›</span></div>
    ${점수 != null
      ? `<div class="whopct"><b>${점수}%</b></div>
         <div class="memo">${esc(personaMateLine(나, 너))}</div>`
      : `<div class="memo">${나 ? `${누구}님의 성향이 아직 안 나왔어요` : `해외 도시를 ${문턱}곳 매기면 궁합이 나와요`}</div>`}
    ${사실.length ? `<div class="whofacts"><div class="memo">흥미로운 사실</div>${사실.join('')}</div>` : ''}
  </div>`;
}

/* ── 성향 카드 ── 분석 탭 맨 위 히어로와 **같은 마크업·같은 클래스**(persona.js · app.css
   의 .phero). 사용자: 「명소검열관 카드 만들었는데 그거도 보이게 하자」.
   ⚠ 그림은 중간 크기(m/, 77KB)와 자리막이 썸네일(t/)만 — 원본 webp 는 공유 카드 전용입니다.
   ⚠ 그림이 안 오면 .noart 로 먹색 글자(크림 바탕에 흰 글자는 안 보입니다).
   ⚠ 공유 단추 · 「다른 유형 15가지」는 안 답니다 — 남의 카드입니다. */
function 성향카드(h, 너, 발, b){
  const t = 너 && PERSONA16[너];
  if (!t) return '';
  const 축말 = [...너].map(ch => AXIS_WORD[ch]).join(' · ');
  /* ⚠ **그림만 덩그러니 두지 않습니다(b802, 사용자: 「톤앤매너가 안맞는데??」).** 밝은 종이 칸들 사이에
     어두운 그림 한 장만 제목 없이 끼어 튀었습니다 — 분석 탭처럼 제목 · 그림 · 네 축 막대를 한 덩어리로.
     막대는 보이는 별점으로 셉니다(personaAxes). 별점을 가린 사람이면 그림만 나옵니다. */
  const 별줄 = (b?.ratings || []).filter(r => r.stars != null);
  const ax = 그사람축(너, b, 별줄);
  /* 누르면 「여행 성향」 판(b804) — 전에는 「모든 분석 ›」과 같은 판으로 갔습니다(사용자가 찾음). */
  return `<div class="card whop16" data-whosub="p16" role="button" tabindex="0"
      aria-label="${esc(h.self ? '나' : 이름(h))}의 여행 유형 ${esc(t.n)} — 여행 성향 보기">
    <div class="whocardhd"><b>여행 성향</b><span class="whomore">자세히 ›</span></div>
    <div class="phero">
      <div class="psizer" style="background-image:url('./persona/t/${esc(너)}.jpg?v=b829')"></div>
      <img src="./persona/m/${esc(너)}.jpg?v=b829" alt=""
           onerror="this.closest('.phero').classList.add('noart')">
      <div class="pscrim"></div>
      <div class="ptxt">
        <div class="peyebrow">${h.self ? '나의' : `${esc(이름(h))}님의`} 여행 유형은</div>
        <div class="pcode">${esc(너)}</div>
        <div class="pname${t.n.length >= 10 ? ' long' : ''}">${esc(t.n)}</div>
        ${t.d ? `<div class="pdesc">${esc(t.d)}</div>` : ''}
        <div class="paxis">${esc(축말)}</div>
        <div class="pstat">
          <span class="prank">${esc(personaRank(발.countries ?? 0))}</span>
          <span class="pcnt">${발.countries ?? 0}개국 · ${발.cities ?? 0}도시</span>
        </div>
      </div>
    </div>
    ${/* 네 축 — 분석 탭과 **같은 그림**(card.js 의 axisSpectrum, b805 양쪽 스펙트럼 · 숫자 없음).
         「여행 분석」 판의 「성향 네 축」은 b804 에 뺐습니다 — 근거와 숫자는 「여행 성향」 판에. */''}
    ${ax ? axisSpectrum(ax) : ''}
  </div>`;
}

/* 받은 배지 — 「여행 분석」 판 맨 아래(b802, 세 칸에서 옮김). 최근에 받은 것부터. ⚠ 칸에 .card 를 달지 말 것 — .card .card 가 위아래 여백을 얹어 줄 사이가 54px 였음(b803, 사용자: 「배지 줄 간격 너무 넓다」). */
function 배지칸(b){
  const 받은 = (b.badges || []).map(x => ({ d: 배지표?.[x.id], at: x.at })).filter(x => x.d).reverse();
  if (!받은.length) return '';
  const 날 = t => { const d = new Date(t); return isNaN(d) ? '' : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`; };
  return `<div class="card"><h2>받은 배지 <span class="memo">${받은.length}</span></h2>
    <div class="whobadgegrid">${받은.map(x => `<div class="whobadge">
      <i aria-hidden="true">${esc(x.d.icon || '')}</i><b>${esc(x.d.name)}</b>
      ${x.d.cat ? `<span class="memo">${esc(x.d.cat)}</span>` : ''}
      ${x.at ? `<span class="memo">${날(x.at)}</span>` : ''}</div>`).join('')}</div></div>`;
}

/* ── 여행 분석(작게) ── 왓챠 「별점 분포」 + 「모든 분석 보기」. */
function 분석카드(b){
  const 별들 = 별모음(b), 분 = 분포(별들);
  return `<div class="card whostat" data-whosub="stats" role="button" tabindex="0">
    <div class="whocardhd"><b>여행 분석</b><span class="whomore">모든 분석 ›</span></div>
    ${별들.length
      ? `${막대(별들, 44)}
         <div class="memo">평균 ★${분.평균.toFixed(1)} · ${분.많이}점을 제일 많이 줬어요</div>`
      : `<div class="memo">${b.show_stars ? '아직 매긴 별점이 없어요' : '별점은 비공개예요'}</div>`}
  </div>`;
}

/* ── 들어간 판(b799) ─────────────────────────────────────────────────── */
function 판머리(제목, 수){
  return `<div class="whosubhd"><h2>${제목}${수 != null ? ` <span class="memo">${수}</span>` : ''}</h2></div>`;
}

function 도시줄(x){
  const c = x.c, 별 = 별값(x);
  /* 누르면 그 도시 화면(b789) — 친구가 좋다는 곳을 보고 「가고 싶은 곳」에 담게. */
  return `<div class="whorow" data-cityopen="${esc(x.id)}" role="button" tabindex="0">
    <div class="t"><b>${국기(c)}${esc(c?.name || x.id)}</b>
      ${c ? `<span class="memo">${esc(countryName[c.cc] || '')}</span>` : ''}
      ${x.r?.comment ? `<span class="memo">“${esc(x.r.comment)}”</span>` : ''}</div>
    ${별 != null ? starsRo(별) : ''}</div>`;
}
/* 나와 견준 줄 — 궁합 판. */
function 짝줄(x, 누구){
  return `<div class="whorow" data-cityopen="${esc(x.id)}" role="button" tabindex="0">
    <div class="t"><b>${국기(도시(x.id))}${esc(도시이름(x.id))}</b></div>
    <span class="whovs">나 ${별글(x.나)} · ${esc(누구)} ${별글(x.너)}</span></div>`;
}

const 판그림 = {
  /* 도시 — 별점 높은 순 · 나라별 · 한줄평. 나라 판에서 들어오면 그 나라만(cc). */
  city(위, b){
    let 목록 = 도시목록(b);
    if (위.cc) 목록 = 목록.filter(x => x.c?.cc === 위.cc);
    const 별보임 = b.show_stars !== false;
    const 한줄 = 목록.filter(x => x.r?.comment);
    const 고를것 = [
      별보임 && ['star', '별점 높은 순'],
      !위.cc && ['country', '나라별'],
      (!별보임 && 위.cc) && ['name', '이름순'],
      한줄.length && ['comment', `한줄평 ${한줄.length}`],
    ].filter(Boolean);
    /* 한줄평 칸(b802)으로 들어왔는데 한줄평이 없으면 거르기 단추가 없어도 「한줄평」으로 둡니다 —
       안 그러면 「한줄평 0」을 눌렀는데 도시가 전부 떴습니다. */
    const 정렬 = 고를것.some(([k]) => k === 위.정렬) ? 위.정렬
               : 위.정렬 === 'comment' ? 'comment' : 고를것[0]?.[0] || 'name';
    let 몸;
    if (정렬 === 'comment') 몸 = 한줄.sort(별순).map(도시줄).join('');
    else if (정렬 === 'country'){
      const { 묶음, 키 } = 나라묶음(목록);
      const 모름 = 목록.filter(x => !x.c);
      몸 = 키.map(k => `<div class="whogrp">${국기({ cc: k })}${esc(countryName[k] || k)}
          <span class="memo">${묶음[k].length}곳</span></div>${묶음[k].sort(별순).map(도시줄).join('')}`).join('')
        + (모름.length ? `<div class="whogrp">기타</div>${모름.map(도시줄).join('')}` : '');
    }
    else if (정렬 === 'star') 몸 = 목록.sort(별순).map(도시줄).join('');
    else 몸 = 목록.sort((a, c) => 줄이름(a).localeCompare(줄이름(c), 'ko')).map(도시줄).join('');
    const 제목 = 위.cc ? `${국기({ cc: 위.cc })}${esc(countryName[위.cc] || 위.cc)}`
               : 정렬 === 'comment' ? '한줄평' : '도시';
    return 판머리(제목, 정렬 === 'comment' && !위.cc ? 한줄.length : 목록.length) +
      (고를것.length > 1 ? `<div class="days whosort">${고를것.map(([k, 말]) =>
        `<button class="day${k === 정렬 ? ' on' : ''}" data-whosort="${k}">${말}</button>`).join('')}</div>` : '') +
      (별보임 ? '' : `<div class="memo whonote">${esc(이름(머리))}님이 별점은 가려 두었어요</div>`) +
      `<div class="card">${몸 || emptyDo(정렬 === 'comment' ? '아직 남긴 한줄평이 없어요.'
                                                    : '아직 방문한 도시가 없어요.')}</div>`;
  },

  /* 나라 — 도시 수가 많은 순. 누르면 그 나라 도시만. */
  country(위, b){
    const { 묶음, 키 } = 나라묶음(도시목록(b));
    const 대륙 = Object.entries(b.foot?.by_continent || {})
      .filter(([k]) => k !== '기타').sort((a, c) => c[1] - a[1]);
    return 판머리('나라', 키.length) +
      (대륙.length ? `<div class="memo whonote">${대륙.map(([k, n]) => `${esc(k)} ${n}`).join(' · ')}</div>` : '') +
      `<div class="card">${키.map(k => `<div class="whorow" data-whosub="city" data-cc="${esc(k)}"
          role="button" tabindex="0">
          <div class="t"><b>${국기({ cc: k })}${esc(countryName[k] || k)}</b></div>
          <span class="memo">${묶음[k].length}곳 ›</span></div>`).join('')
        || emptyDo('아직 다녀온 나라가 없어요.')}</div>`;
  },

  /* 궁합 — 숫자 · 두 사람 성향 · 둘 다 좋게 본 곳 · 엇갈린 곳 · 둘 다 가 본 곳. */
  match(위, b){
    const 누구 = 이름(머리), 너 = 그사람코드(b), 나 = 내코드();
    const 점수 = 나 && 너 ? personaMatch(나, 너) : null;
    const { 둘다, 짝, 좋게, 엇갈림, 차이 } = 견주기(b);
    /* 그림은 작은 것(t/, 23KB) — 성향 탭 「여행 궁합」 칸과 같습니다. */
    const 사람 = (누, 코드) => `<div class="whomate">${코드 && PERSONA16[코드]
        ? `<img src="./persona/t/${esc(코드)}.jpg?v=b829" alt="" loading="lazy" decoding="async">
           <span class="memo">${esc(누)}</span><b>${esc(PERSONA16[코드].n)}</b><span class="memo">${esc(코드)}</span>`
        : `<span class="memo">${esc(누)}</span><b>아직 없어요</b>
           <span class="memo">${누 === '나' ? `해외 도시를 ${문턱}곳 매기면 나와요` : '별점이 더 쌓이면 나와요'}</span>`}</div>`;
    const 가본줄 = id => { const x = 짝.find(y => y.id === id);
      return x ? 짝줄(x, 누구) : `<div class="whorow" data-cityopen="${esc(id)}" role="button" tabindex="0">
        <div class="t"><b>${국기(도시(id))}${esc(도시이름(id))}</b></div></div>`; };
    const 별줄 = 짝.length >= 3
      ? `둘 다 매긴 도시 ${짝.length}곳 · 별점 차이 평균 ${차이.toFixed(1)}${차이 <= 0.5 ? ' — 눈이 비슷해요' : 차이 >= 1.2 ? ' — 보는 눈이 달라요' : ''}`
      : 짝.length ? `둘 다 매긴 도시 ${짝.length}곳 — 3곳부터 별점을 견줘요` : '';
    return 판머리('나와의 궁합') +
      `<div class="card whomatch">
        ${점수 != null
          ? `<div class="whopct"><b>${점수}%</b><span>나와의 여행 궁합</span></div>
             <div class="memo">${esc(personaMateLine(나, 너))}</div>`
          : `<div class="memo">${나 ? `${esc(누구)}님의 성향이 아직 안 나왔어요` : `해외 도시를 ${문턱}곳 매기면 궁합이 나와요`}</div>`}
        <div class="whomates">${사람('나', 나)}${사람(누구, 너)}</div>
        ${별줄 ? `<div class="memo">${esc(별줄)}</div>` : ''}
      </div>` +
      (좋게.length ? `<div class="card"><h2>둘 다 좋게 본 곳 <span class="memo">${좋게.length}</span></h2>
          ${좋게.map(x => 짝줄(x, 누구)).join('')}</div>` : '') +
      (엇갈림.length ? `<div class="card"><h2>엇갈린 곳 <span class="memo">${엇갈림.length}</span></h2>
          ${엇갈림.map(x => 짝줄(x, 누구)).join('')}</div>` : '') +
      `<div class="card"><h2>둘 다 가 본 곳 <span class="memo">${둘다.length}</span></h2>
        ${둘다.length ? 둘다.map(가본줄).join('') : emptyDo('아직 둘 다 가 본 곳이 없어요.')}</div>`;
  },

  /* 여행 분석 — 별점 분포 · 발자국 · 제일 좋았던/아쉬웠던 곳 · 받은 배지.
     ⚠ 「성향 네 축」은 b804 에 뺐습니다 — 요약의 성향 칸에 같은 막대가 있고, 근거는 「여행 성향」 판(p16). */
  stats(위, b){
    const 별들 = 별모음(b), 분 = 분포(별들), 발 = b.foot || {};
    const 누구 = 이름(머리);
    const 대륙 = Object.entries(발.by_continent || {}).filter(([k]) => k !== '기타').sort((a, c) => c[1] - a[1]);
    const 대륙큰 = Math.max(1, ...대륙.map(([, n]) => n));
    const 매긴 = 도시목록(b).filter(x => 별값(x) != null);
    const 높은 = 매긴.length ? Math.max(...매긴.map(별값)) : null;
    const 낮은 = 매긴.length ? Math.min(...매긴.map(별값)) : null;
    const 좋은곳 = 매긴.filter(x => 별값(x) === 높은).sort(별순).slice(0, 5);
    const 아쉬운곳 = 낮은 != null && 낮은 < 높은 ? 매긴.filter(x => 별값(x) === 낮은).sort(별순).slice(0, 3) : [];
    const 줄 = (말, 값) => `<div class="whokv"><span>${말}</span><b>${값}</b></div>`;
    return 판머리('여행 분석') +
      `<div class="card"><h2>별점 분포 <span class="memo">${별들.length}곳</span></h2>
        ${별들.length
          ? 막대(별들, 96) + 줄('평균', `★${분.평균.toFixed(1)}`) +
            줄('제일 많이 준 별점', `${분.많이}점 · ${분.큰}곳`)
          : `<div class="memo">${b.show_stars ? '아직 매긴 별점이 없어요' : `${esc(누구)}님이 별점은 가려 두었어요`}</div>`}
      </div>` +
      `<div class="card"><h2>발자국</h2>
        ${줄('여행', `${발.trips ?? 0}번`)}${줄('나라', `${발.countries ?? 0}곳`)}${줄('도시', `${발.cities ?? 0}곳`)}${
          줄('대륙', `${대륙.length}곳`)}
        ${대륙.length ? `<div class="memo whonote">대륙별 나라</div>${대륙.map(([k, n]) =>
          `<div class="whocont"><span>${esc(k)}</span><span class="axbar"><i style="width:${Math.max(4, Math.round(n / 대륙큰 * 100))}%"></i></span>
            <b>${n}</b></div>`).join('')}` : ''}
      </div>` +
      (좋은곳.length ? `<div class="card"><h2>제일 좋았던 곳 <span class="memo">★${높은}</span></h2>
          ${좋은곳.map(도시줄).join('')}</div>` : '') +
      (아쉬운곳.length ? `<div class="card"><h2>제일 아쉬웠던 곳 <span class="memo">★${낮은}</span></h2>
          ${아쉬운곳.map(도시줄).join('')}</div>` : '') +
      배지칸(b);
  },

  /* 여행 성향(b804) — 요약 맨 아래 성향 칸의 「자세히 ›」가 여기로 옵니다. 사용자: 「자세히 눌러도 위에
     모든 분석이랑 같은 페이지로 이동되는거아냐?」 → 시안 「성향 화면 따로」.
     ⚠ 분석 탭(persona.js)의 「왜 ○○○○ 인가요」 · 「여행 궁합」과 **같은 말 · 같은 마크업**(.row · .mates ·
       환상의 메이트 · 극과 극 메이트). 한쪽 말만 바꾸지 마십시오.
     ⚠ 근거 문장은 **보이는 별점**으로 셉니다(personaAxes → personaWhyHtml), 값은 그 사람이 올린 것(v2). 별점을 가린 사람이면 궁합만.
     ⚠ 네 글자는 요약 그림과 같은 코드(그사람코드 — 본인 앱이 서버에 올린 것)입니다. 점수는 보이는 별점으로
       새로 세므로 본인이 앱을 한동안 안 열었으면 드물게 어긋날 수 있습니다(pshift.js 가 바뀔 때 올립니다). */
  p16(위, b){
    const 누구 = 이름(머리), 너 = 그사람코드(b);
    if (!너 || !PERSONA16[너]) return 판머리('여행 성향') +
      `<div class="card">${emptyDo(`${누구}님의 성향이 아직 안 나왔어요.`)}</div>`;
    const rows = (b.ratings || []).filter(r => r.stars != null);
    /* v2: 줄 넷은 분석 탭과 **같은 함수**(card.js personaWhyHtml)입니다. 문장은 보이는 별점으로 센 것,
       값(막대와 같은 숫자)은 그 사람이 올린 것(그사람축). 다시 간 도시 이야기는 안 합니다(남: 참). */
    const 센것0 = rows.length ? personaAxes(rows, { cities: cities || [] }) : null;
    const 센것 = 센것0 && 센것0.해외 >= 문턱 ? 센것0 : null;   /* 문턱은 해외 10곳(위 `문턱`) */
    const 보임 = 센것 && 그사람축(너, b, rows);
    const 왜 = 센것 && 보임
      ? personaWhyHtml(센것, 너, { 보임, 나라이름: countryName, 남: true })
      : `<div class="memo whonote">${b.show_stars === false ? `${esc(누구)}님이 별점을 가려 두어서 근거는 안 보여요`
                                                              : '별점이 더 쌓이면 근거가 나와요'}</div>`;
    const m = personaMates(너);
    const 짝 = (결, 말, 코드, 점) => `<div class="mate ${결}">
        <img class="mateimg" src="./persona/t/${esc(코드)}.jpg?v=b829" alt="" loading="lazy" decoding="async">
        <span class="ml">${말} · ${점}%</span>
        <b>${esc(PERSONA16[코드]?.n || 코드)}</b><span class="mc">${esc(코드)}</span></div>`;
    return 판머리('여행 성향') +
      `<div class="card"><h2>왜 ${esc(너)} 인가요</h2>${왜}</div>` +
      `<div class="card"><h2>여행 궁합</h2><div class="mates">${
        짝('good', '환상의 메이트', m.best, m.bestScore)}${짝('bad', '극과 극 메이트', m.worst, m.worstScore)}</div></div>`;
  },
};

function 들어가기(종류, 더 = {}){
  if (!알 || !판그림[종류]) return;
  층.push({ 종류, ...더, 아래: $('whoview').scrollTop });
  history.pushState({ t2:'whosub' }, '');
  서브그리기();
}
/* 층의 맨 위를 그립니다. 층이 비었으면 첫 판을 다시 보입니다(첫 판은 숨겨 두기만 했습니다). */
function 서브그리기(맨위로 = true){
  const 합 = $('whosum'), 서 = $('whosub');
  if (!합 || !서) return;
  const 위 = 층[층.length - 1];
  if (!위 || !알){
    서.classList.add('hide'); 서.replaceChildren();
    합.classList.remove('hide');
    return;
  }
  서.innerHTML = 판그림[위.종류](위, 알);
  합.classList.add('hide');
  서.classList.remove('hide');
  if (맨위로) $('whoview').scrollTop = 0;
}
function 나오기(fromPop){
  if (!fromPop && history.state?.t2 === 'whosub'){ history.back(); return; }
  const 나간 = 층.pop();
  서브그리기(false);
  $('whoview').scrollTop = 나간?.아래 || 0;
}

function 지구본올리기(b){
  const cv = $('whocanvas');
  if (!cv) return;
  const 간도시 = new Set(b.visited || []);
  const 나라 = new Set((cities || []).filter(c => 간도시.has(c.id)).map(c => c.cc));
  공?.끝?.();
  공 = mountGlobe(cv, 나라, undefined, undefined, null, { 갔나: id => 간도시.has(id) });
}

/* ── 누르기 ────────────────────────────────────────────────────────── */
async function 부르기(fn, args, 성공말){
  const r = await netTimeout(sb.rpc(fn, args));
  if (!r || r.error){ toast(r?.error?.message || '연결을 확인해 주세요'); return null; }
  if (성공말) toast(typeof 성공말 === 'function' ? 성공말(r.data) : 성공말);
  ctx.onFollowChange();
  return r;
}

/* ⚠ confirm() 을 안 씁니다 — 카카오톡 같은 앱 안 브라우저에서 막힙니다(member.js
   머리말). 앱의 방식대로 버튼 글자를 바꿔 한 번 더 누르게 합니다(ui.js 의 arm —
   다른 데를 누르면 저절로 원래대로 돌아옵니다). */
const 한번더 = { cancel: '한 번 더 누르면 요청을 거둬요', unfollow: '한 번 더 누르면 팔로우를 끊어요' };

$('whobody')?.addEventListener('click', async e => {
  /* 들어가기(b799) — 세 칸 · 궁합 · 성향 · 분석 · 나라 줄. */
  const 판 = e.target.closest('[data-whosub]');
  if (판) return 들어가기(판.dataset.whosub, { ...(판.dataset.cc ? { cc: 판.dataset.cc } : {}),
                                              ...(판.dataset.sort ? { 정렬: 판.dataset.sort } : {}) });
  const 정렬 = e.target.closest('[data-whosort]');
  if (정렬){
    const 위 = 층[층.length - 1];
    if (위 && 위.정렬 !== 정렬.dataset.whosort){ 위.정렬 = 정렬.dataset.whosort; 서브그리기(); }
    return;
  }
  /* 도시 줄(b789). 도시 화면이 이 판을 가리고 위에 뜹니다 — 뒤로 가면 여기로. */
  const 도시칸 = e.target.closest('[data-cityopen]');
  if (도시칸) return openCity(도시칸.dataset.cityopen);
  const b = e.target.closest('[data-who]'); if (!b || !지금) return;
  const uid = 지금, h = 머리, 누구 = 이름(h);
  if (한번더[b.dataset.who] && b.dataset.armed !== '1'){ arm(b, 한번더[b.dataset.who]); return; }
  b.disabled = true;
  try {
    switch (b.dataset.who){
      case 'follow':
        await 부르기('follow_ask', { p_user: uid },
          s => s === 'accepted' ? `${누구}님을 팔로우해요` : '팔로우를 요청했어요');
        break;
      case 'cancel':
        await 부르기('follow_drop', { p_user: uid }, '요청을 거뒀어요');
        break;
      case 'unfollow':
        await 부르기('follow_drop', { p_user: uid }, '팔로우를 끊었어요');
        break;
      case 'accept':
        await 부르기('follow_answer', { p_user: uid, p_ok: true }, `${누구}님의 요청을 수락했어요`);
        break;
      case 'decline':
        await 부르기('follow_answer', { p_user: uid, p_ok: false }, '요청을 거절했어요');
        break;
      case 'friends':
        /* ⚠ `closePerson()`(= history.back)을 쓰면 뒤로가기가 «나중에» 와서
           방금 연 친구 화면을 닫습니다. 바로 닫고 기록 한 칸은 **친구 화면
           것으로 바꿔 씁니다** — 안 바꾸면 openFriends 가 한 칸을 더 쌓아서,
           친구 화면을 닫은 뒤 빈 'who' 칸에서 뒤로가기가 한 번 헛돕니다. */
        /* 친구 화면 위에서 열렸으면(목록 → 나) 한 겹 걷기만 하면 됩니다. */
        if ($('friendview') && !$('friendview').classList.contains('hide')){ closePerson(); return; }
        closePerson(true);
        if (history.state?.t2 === 'who') history.replaceState({ t2:'friend' }, '');
        ctx.openFriends('feed'); return;
    }
  } finally { b.disabled = false; }
  if (지금 === uid) 그리기();
});
/* 줄·칸은 div 라 키보드로 누를 수 있게 Enter·스페이스를 눌림으로 바꿉니다. */
$('whobody')?.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const t = e.target.closest?.('[data-whosub],[data-cityopen]');
  if (!t || t !== e.target) return;
  e.preventDefault(); t.click();
});

/* ── 메뉴(⋯): 팔로워에서 빼기 · 차단 · 신고 ──────────────────────────── */
$('whomenu')?.addEventListener('click', () => {
  if (!머리 || 머리.self) return;
  const 시트 = $('whosheet');
  $('whosheet_rm').classList.toggle('hide', 머리.theirs !== 'accepted');
  $('whosheet_rep').classList.add('hide');
  $('whosheet_main').classList.remove('hide');
  시트.classList.remove('hide');
});
$('whosheet')?.addEventListener('click', async e => {
  const 시트 = $('whosheet');
  if (e.target === 시트 || e.target.closest('[data-ws="close"]')){ 시트.classList.add('hide'); return; }
  const b = e.target.closest('[data-ws]'); if (!b || !지금) return;
  const uid = 지금, 누구 = 이름(머리);
  if (b.dataset.ws === 'remove'){
    if (b.dataset.armed !== '1'){ arm(b, '한 번 더 누르면 빼요 — 상대에게 알림은 안 가요'); return; }
    시트.classList.add('hide');
    if (await 부르기('follower_drop', { p_user: uid }, '팔로워에서 뺐어요')) 그리기();
  } else if (b.dataset.ws === 'block'){
    if (b.dataset.armed !== '1'){
      arm(b, '한 번 더 누르면 차단해요 — 서로 안 보이고 팔로우도 양쪽 다 끊겨요'); return; }
    시트.classList.add('hide');
    if (await 부르기('block_user', { p_user: uid }, `${누구}님을 차단했어요`)) closePerson();
  } else if (b.dataset.ws === 'report'){
    $('whosheet_main').classList.add('hide');
    $('whosheet_rep').classList.remove('hide');
  } else if (b.dataset.ws === 'reason'){
    const 더 = $('whosheet_detail').value;
    시트.classList.add('hide');
    await 부르기('report_user', { p_user: uid, p_reason: b.dataset.r, p_detail: 더 },
                '신고했어요. 살펴볼게요');
    $('whosheet_detail').value = '';
  }
});
$('whoback')?.addEventListener('click', () => personBack());
