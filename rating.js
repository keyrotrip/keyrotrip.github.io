/* ── 평가 화면 — 도시에 별을 매기는 자리 ──────────────────────────────
 * '기록' 탭입니다. 도시 목록을 보여주고 별점·가보고 싶어요·한줄평을 받습니다.
 * **평가 자료를 서버에서 받아오는 곳도 여기 하나입니다** — 네 화면(기록·도시·
 * 보관함·홈)이 같은 자료를 보므로 받는 자리가 둘이면 언젠가 갈립니다.
 *
 * ── app.js 에서 떼어낸 열다섯 번째 조각입니다(b341) ──────────────────
 * app.js 만 아는 것은 셋입니다 — 로그인한 사람, 도시 고르개 채우기,
 * 앱 화면 켜기. `rateShown`·`rateObs`(더 보기 스크롤 상태)는 이 블록에서만
 * 쓰던 것이라 같이 데려왔습니다.
 *
 * ⚠ **city.js 는 여전히 ctx 로 받습니다.** 여기가 `openCity` 를 import 하므로
 * 저쪽이 `saveRate` 를 import 하면 **고리가 생깁니다.** shelf.js 는 이쪽을
 * 안 부르므로 직접 import 로 바꿨습니다 — 그쪽 ctx 가 둘 줄었습니다.
 *
 * 층: dom.js · db.js · net.js · calc.js · stars.js · cities.js · rate.js ·
 *     city.js · citysearch.js 를 씁니다. */
import { $, esc, josa, tipOff } from './dom.js?v=b829';
import { sb } from './db.js?v=b829';
import { fail, netTimeout, netIsDown, drawOffbar, NOROW } from './net.js?v=b829';
import { dateRange } from './calc.js?v=b829';
import { starHtml, paintStars, starValue } from './stars.js?v=b829';
import { cities, countryName, cityCountry, continentOf,
         countryInfo } from './cities.js?v=b829';
import { myRates, cityStat, visited, justRated, avgTail,
         setRateData, setVisited, applyRate, putCityStat, clearJustRated,
         removeRate, 별받음 } from './rate.js?v=b829';
import { openCity } from './city.js?v=b829';
import { loadCities } from './citysearch.js?v=b829';

let ctx = { me: () => null, fillCityList: () => {}, showApp: () => {} };
export function setRatingCtx(o){ ctx = { ...ctx, ...o }; }

/* 목록을 몇 개까지 그렸나, 그리고 '더 보기' 를 지켜보는 눈.
   **app.js 의 상태 뭉치에 있던 것을 여기로 옮겼습니다(b341)** —
   쓰는 곳이 이 파일뿐이었습니다. */
let rateShown = 80, rateObs = null;

/* 기록 목록을 마지막으로 그린 글자. 같으면 다시 안 그립니다 — 사진이
   깜빡이는 것을 막습니다(아래 drawRatings). **목록을 밖에서 건드리면
   반드시 빈 글자로 되돌립니다.** 안 그러면 "같으니 건드리지 말자"가
   화면과 어긋난 채로 굳습니다.
   **이것도 app.js 의 상태 뭉치에 있던 것입니다(b341).** app.js 는
   로그아웃할 때 되돌려야 하므로 그 길만 내보냅니다 — 밖에서 `=` 로
   넣으면 import 한 쪽은 안 바뀌고 이 파일 안쪽만 어긋납니다. */
let lastRateHtml = '';
export function resetRateHtml(){ lastRateHtml = ''; }

/* ── 평가 자료를 받는 곳은 여기 하나입니다 ────────────────────────────
 * myRates · cityStat · visited 는 **네 화면이 같이 쓰는 자료**입니다
 * (평가 화면 · 보관함 · 홈 발자국 · 별점 저장).
 * 전에는 같은 질의가 그 네 곳에 손으로 베껴져 있었고 **이미 서로 달랐습니다**:
 *   - 보관함만 updated_at 을 받아왔습니다 (정렬에 쓰므로)
 *   - **보관함은 오류를 확인하지 않았습니다.** 질의가 실패하면 myRates 가
 *     {} 가 되어 "평가가 하나도 없음"으로 보이고, 공유 자료라 평가 화면까지
 *     같이 비었습니다. 조용한 실패라 아무도 몰랐습니다.
 * 배지 버그(my_footprint 를 my_counts 가 베껴 적은 것)와 같은 모양입니다.
 *
 * 칸은 두 화면이 쓰는 것을 **합쳐서** 받습니다 — 한쪽만 늘리면 다른 쪽이
 * 조용히 빈 값을 씁니다.
 * **실패하면 아무것도 안 바꿉니다.** 반쯤 지워진 자료가 빈 화면보다 나쁩니다. */
export async function loadRateData(){
  /* ⚠⚠ **로그인 정보가 아직 없으면 «터집니다»(b692).** `ctx.me()` 는 앱이
     세션을 되살리기 전이나 로그아웃 상태에서 null 이라 `.id` 에서
     TypeError 가 났고, **부르는 쪽이 통째로 죽었습니다.**
     실제로 이렇게 났습니다 — 지도에서 도시를 눌렀는데 카드가 안 뜨고
     오류도 «화면에 안 뜹니다»(unhandled rejection 이라 기록에만 남습니다).
     b682 부터 있던 길인데 평가 탭을 먼저 열어 보면 안 걸려서 안 보였습니다.
   ⚠ 던지지 말고 «못 받았다»고 돌려줍니다 — 부르는 쪽은 별점 없이도 화면을
     띄울 수 있어야 합니다(카드는 별점을 «매기러» 여는 자리이기도 합니다). */
  const 나 = ctx.me();
  if (!나?.id) return { error: { message: '아직 로그인 정보가 없습니다' } };
  const [mine, stats, vis] = await Promise.all([
    sb.from('city_ratings').select('city_id,stars,want,comment,journal,journal_photo,updated_at')
      .eq('user_id', 나.id),
    sb.rpc('city_stats'),
    sb.rpc('my_visited'),
  ]);
  if (mine.error) return { error: mine.error };
  /* 넣는 것은 rate.js 가 합니다 — 셋을 한 번에 맞추고, 못 받은 것은 안 건드립니다. */
  setRateData({ mine, stats, vis });
  return {};
}

/* 다녀온 곳만 다시 셉니다. 별점을 지웠을 때와 홈 발자국이 씁니다.
   **응답을 통째로 넘깁니다.** 전에는 `v.data || []` 로 넘어가서, 못 받아오면
   다녀온 곳이 통째로 빈 Set 이 됐습니다 — 홈 발자국이 이걸 부르므로 그때
   세계지도가 하얘졌습니다. rate.js 가 오류면 아무것도 안 바꿉니다. */
export async function refreshVisited(){
  setVisited(await netTimeout(sb.rpc('my_visited')));
}

export async function loadRatings(){
  /* 도시 목록은 받아둔 것이 있어도 **내 별점은 서버에서** 옵니다.
     별점 없이 도시만 늘어놓으면 뭘 매겼는지 모르고, 눌러도 저장이 안 됩니다.
     오프라인이면 아예 안 물어보고 알립니다. */
  if (netIsDown()){
    $('ratelist').innerHTML =
      `<div class="empty" style="padding:26px 12px">
         연결이 없어 기록은 지금 볼 수 없어요.<br>
         <span class="memo">별점과 평가는 서버에 저장됩니다.</span></div>`;
    lastRateHtml = '';          /* 안내로 갈아끼웠으니 다음엔 반드시 다시 그립니다 */
    $('r_head').textContent = '도시';
    drawOffbar(); return;
  }
  $('rateerr').classList.add('hide');
  await loadCities();
  ctx.fillCityList();

  /* ⚠ **네트워크 셋을 다 기다린 뒤에야 그리고 있었습니다** (실기기에서 지적받음).
     `loadRateData` 는 city_ratings · city_stats · my_visited 셋을 받아옵니다.
     탭을 누를 때마다 그 왕복이 끝나야 첫 글자가 나오니, 두 번째부터도
     매번 빈 화면을 보게 됩니다 — **이미 다 아는 내용인데도요.**
     별점 · 통계 · 다녀온 곳은 rate.js 에 그대로 살아 있습니다(탭을 옮겨도
     안 비웁니다). 있으면 **그것으로 먼저 그리고** 새것은 뒤에서 받습니다.
     받아온 뒤 달라진 게 없으면 위 `lastRateHtml` 이 다시 그리는 것을 막으므로
     사진도 안 깜빡입니다. */
  const warm = !!(myRates && Object.keys(myRates).length);
  if (warm) drawRatings();

  const r = await loadRateData();
  /* 이미 그려둔 것이 있으면 오류로 그것을 지우지 않습니다 —
     연결이 잠깐 끊긴 것 때문에 멀쩡히 보던 목록이 사라지면 안 됩니다. */
  if (r.error) return warm ? undefined : fail(r.error, 'rate');
  clearJustRated();       /* 다시 들어왔으니 매긴 것은 이제 목록에서 뺍니다 */
  drawRatings();
}

/* 칩으로 놔둔 것은 둘뿐입니다. 나머지는 프로필 보관함에서 걸러 들어옵니다.
   그때는 무엇으로 걸렀는지 알려주고 풀 길을 같이 줍니다. */
/* 여행 카드·히어로의 밑줄. **여행 이름이 대표 도시와 같으면 도시를 뺍니다** —
   여행을 도시 이름으로 짓는 일이 흔한데, 그러면 "도쿄 / 도쿄 · 9월 12일 –
   15일 · 4일" 처럼 같은 말이 바로 위아래로 두 번 나옵니다.
   두 화면이 같은 규칙을 써야 하므로 여기 한 곳에 둡니다. */
export const tripSub = (t, days) =>
  (t.destination && t.destination !== t.title ? `${t.destination} · ` : '') +
  `${dateRange(t.start_date, t.end_date)} · ${days}일`;

/* ⚠⚠ **`setRateFilter`·`NARROW` 를 걷었습니다(b671).** 갈래줄(도시 /
   가보고 싶어요 / 다녀온 곳)을 통째로 없앴기 때문입니다 — 이유는
   index.html 의 `#r_filter` 자리 주석에 있습니다.
 ⚠ 부르던 곳이 **그 단추들 자신 하나뿐**이었습니다. 「보관함에서 걸러
   들어온다」는 길은 b550 에 보관함이 제 화면을 갖게 되면서 없어졌는데,
   주석과 코드만 남아 있었습니다. 지우기 전에 부르는 곳을 세어 보십시오. */

/* ── 대륙·국가로 거르기(b676, 사용자 요청) ────────────────────────────
 * 안 매긴 곳이 650 인데 대부분은 «갈 일이 없는 나라»입니다. 하나씩
 * 내려가며 매기는 것이 오래 걸리는 진짜 이유는 정렬이 아니라 **목록의
 * 크기**였습니다.
 * ⚠ 기본 정렬은 **이미 유명한 순**입니다(아래 `rank` 다음이 `fame`).
 *   다만 `fame` 이 1 인 곳이 80곳이라 그 안에서는 가나다순이 되어
 *   「괌·나라·나트랑·나하」로 시작합니다 — 그래서 유명한 순으로
 *   안 보였던 것입니다. 정렬을 고칠 일이 아니었습니다.
 * ⚠ 도시의 나라·대륙은 **모국을 씁니다**(`cc`) — 괌은 미국,
 *   홍콩은 중국(b672 의 `cityCountry` 와 같은 규칙). */
/* ⚠⚠ **b678 에 대륙을 걷었다가 b679 에 되살렸습니다.** 사용자가 「두 개가
   같은 기능한다」고 한 것은 **«단추» 두 개**를 말한 것이었는데, 저는
   대륙이라는 «갈래»를 없애라는 뜻으로 읽었습니다. 되물었어야 했습니다.
   → 지금 모양: 단추는 하나(「필터」), 시트 «안»에 대륙과 국가가 같이. */
let rtCont = 'all';   /* 대륙 이름 그대로 */
let rtCtry = 'all';   /* 나라 «코드» */
const 모국 = c => c.cc || countryInfo[c.country]?.parent_code || c.country;
const 대륙of = c => continentOf[모국(c)] || '기타';

/* ── 제자리 안내 한 줄(b807, 사용자가 고른 시안 C) ─────────────────────────
 * 왓챠처럼 **매긴 개수에 따라 말이 바뀝니다**(벤치마크: 왓챠는 별점 화면 맨 위 한 줄이 개수 따라 바뀜,
 * Vivino 도 5개 문턱). 0곳이면 무엇을 누르는지, 문턱 전이면 몇 곳 남았는지. 문턱(해외 10곳 — v3)이 되면 사라집니다.
 * ⚠ 「나와요」가 아니라 **「확정돼요」** — 성향 카드는 1곳부터 임시로 나오고 문턱(10곳)에서 확정됩니다(persona.js 의
 *   「도시 N곳만 더 매기면 성향이 확정돼요」와 같은 말). 설계 심사에서 「5곳이면 나와요」는 틀린 말로 걸렸습니다.
 * ⚠ **별점을 서버에서 받기 전에는 안 띄웁니다**(`별받음`) — 안 받은 0 과 진짜 0 을 못 가리면 매긴 사람에게도
 *   「가본 곳엔 별을…」이 뜹니다(b705 「모르면 안 띄운다」).
 * ⚠ 문턱은 persona.js · pshift.js · people.js 의 `문턱` 과 같은 값이어야 합니다 — **10**(2026-10-03 사용자 「문턱 10곳으로 하자」,
 *   5곳이면 한 곳 더 매길 때 유형이 바뀌는 사람이 61% 였음 — card.js personaAxes 머리).
 * ⚠⚠ **목록의 별은 «조용히» 저장합니다(다시 안 그림) — 그래서 saveRate 가 조용할 때도 이걸 부릅니다**(b807 점검에서
 *   잡음: 바로 밑 목록에서 별을 다섯 번 눌러도 줄이 「가본 곳엔 별을…」 그대로였습니다).
 *   조용할 때는 **숨기지 않습니다** — 누르는 도중에 줄이 사라지면 목록이 한 줄 위로 올라가 다음 별을 잘못 누릅니다.
 *   문턱이 되면 「확정됐어요」로 말만 바꿔 두고, 다음에 목록을 새로 그릴 때(탭 다시 열기·검색) 사라집니다. */
const 성향문턱 = 10;
/* v2: 성향은 **해외** 도시로만 셉니다(card.js personaAxes 머리) — 여기 세는 것도 해외만.
   제자리 안내와 아래 「확정된 순간」이 같이 씁니다. 두 벌로 세면 언젠가 갈립니다. */
function 해외매긴수(){
  const 국내 = new Set((cities || []).filter(c => c.country === 'KR').map(c => c.id));
  return Object.entries(myRates || {}).filter(([id, r]) => r?.stars != null && !국내.has(id)).length;
}

/* ── 문턱째(해외 10곳째 — v3, 전엔 5곳째)를 매긴 «순간»(b822, 리포트 「사용자 순환 구조」 중 사용자가 고른 1번) ──────────────
 * 여태는 확정돼도 「분석 탭에서 볼 수 있어요」라는 글뿐이라 누를 데가 없었고, 빠른 평가·맨 위 카드로 채우면
 * 그 말도 없이 줄이 사라졌습니다. 이제 그 순간에 「내 여행 성향 보기 ›」 단추를 냅니다.
 * ⚠ 저장은 전부 saveRate 를 지납니다(아홉 군데) — 그래서 거기서 «저장 전»과 «저장 후»를 세어 문턱 아래 → 문턱이 된
 *   그 한 번만 「확정」으로 칩니다. 처음부터 문턱이 넘던 사람에게는 안 뜹니다.
 * ⚠ 별점을 서버에서 받기 전(별받음 false)에는 안 셉니다 — 안 받은 0 으로 세면 이미 매긴 사람도 「방금 확정」이 됩니다.
 * ⚠ 저장이 실패하면 안 뜹니다(아래 saveRate — 실패는 셈까지 가기 전에 돌아갑니다).
 * ⚠ 앱이 켜 있는 동안만 기억합니다. 성향을 보러 가면(app.js 의 성향보기) 걷힙니다. 별을 지워 문턱 아래가 되어도 걷힙니다.
 * 빠른 평가(spree.js)는 자기 머리줄에 같은 단추를 띄웁니다 — 이 값을 읽어서. */
let 확정순간 = false;
export const 방금확정 = () => 확정순간;
export function 확정봤음(){ 확정순간 = false; }

function 제자리안내(조용){
  const el = $('tip_rate');
  if (!el) return;
  const n = 해외매긴수();
  if (n < 성향문턱) 확정순간 = false;
  const 단추 = $('tip_rate_go');
  if (확정순간 && 별받음 && !tipOff('ratelist')){
    /* 조용할 때(목록의 별) 줄이 숨어 있었으면 지금 띄우지 않습니다 — 누르는 도중에 줄이 생기면 목록이 한 줄
       내려가 다음 별을 잘못 누릅니다(위 ⚠⚠). 목록을 다시 그릴 때 뜹니다. */
    if (조용 && el.classList.contains('hide')) return;
    /* 조용할 때는 줄 높이를 지금 그대로 묶어 둡니다 — 글이 바뀌며 줄이 늘거나 줄면 그것도 목록을 밀어 다음 별을
       잘못 누르게 합니다. 재 보니 단추(닿는 높이 32px)가 들어서면 45 → 51 로 6px 늘었습니다(375px 폭, b822).
       그래서 «최소»가 아니라 높이 자체를 묶습니다 — 넘치는 몇 px 은 줄의 안쪽 여백(위아래 9px)으로 들어갑니다.
       다시 그릴 때(아래) 풉니다. */
    if (조용) el.style.height = el.offsetHeight + 'px';
    else el.style.height = '';
    el.classList.remove('hide');
    $('tip_rate_t').innerHTML = '<b>여행 성향이 확정됐어요</b>';
    단추?.classList.remove('hide');
    return;
  }
  if (!조용) el.style.height = '';
  단추?.classList.add('hide');
  const 끔 = !별받음 || n >= 성향문턱 || tipOff('ratelist');
  if (조용 && 끔) return;            /* 조용할 때는 보이던 줄을 걷지 않습니다(위 ⚠⚠) */
  el.classList.toggle('hide', 끔);
  if (끔) return;
  /* 처음 안내는 **아무것도 안 매긴** 사람에게만 — 국내만 매긴 사람에게 「가본 곳엔 별을…」은 틀린 말입니다. */
  const 매긴수 = Object.values(myRates || {}).filter(r => r?.stars != null).length;
  $('tip_rate_t').innerHTML = 매긴수 === 0
    ? `가본 곳엔 별을, 가보고 싶은 곳엔 ♡를 눌러요 · <b>해외 도시 ${성향문턱}곳이면 여행 성향이 확정돼요</b>`
    : `<b>해외 도시 ${성향문턱 - n}곳만 더</b> 매기면 여행 성향이 확정돼요`;
}

export function drawRatings(){
  const q = $('r_q').value.trim().toLowerCase();
  const cho = /^[ㄱ-ㅎ]+$/.test(q);
  let list = (cities || []).filter(c => {
    if (q && !(cho ? c._cho.includes(q) : c._hay.includes(q))) return false;
    const r = myRates[c.id];
    /* ⚠ 갈래(rateFilter)는 b671 에 없앴습니다. 이 탭은 이제 한 가지만
       합니다 — **아직 안 매긴 곳을 보여준다.** 매긴 것을 다시 보는 자리는
       기록 탭의 보관함입니다. */
    /* 기본 목록에는 아직 안 매긴 곳만 둡니다. 매긴 것이 계속 쌓여 있으면
       남은 게 안 보여서 더 안 매기게 됩니다. 매긴 것은 프로필에서 봅니다.
       방금 매긴 것은 남겨둡니다 — 잘못 눌렀을 때 그 자리에서 고쳐야 합니다. */
    if (rtCont !== 'all' && 대륙of(c) !== rtCont) return false;
    if (rtCtry !== 'all' && 모국(c) !== rtCtry) return false;
    return r?.stars == null || justRated.has(c.id);
  });
  /* 아직 안 매긴 다녀온 곳을 맨 위로, 그다음 높은 별점 순.
     기록 화면에 왔으면 "매길 게 남았나"가 먼저 궁금합니다.
     **매길 게 없으면 가나다순이 됩니다.** 그러면 첫 화면이 가고시마·가나자와·
     가마쿠라… 로 시작하는 사전이 됩니다. 매긴 곳이 49개인 사람에게도
     그랬습니다 — 이름을 알고 찾아오는 게 아니면 아무 쓸모가 없습니다.
     그래서 그 자리는 이름난 곳 순으로 채웁니다. 찾아서 오는 사람은
     위의 검색칸을 씁니다(초성도 됩니다).
     **fame 은 1이 이름난 쪽입니다** — 파리·로마·도쿄가 1, 겐트·공주가 3.
     처음에 큰 값을 앞에 두었더니 목록이 겐트·골웨이·공주로 시작했습니다.
     값이 없으면 맨 뒤로 보냅니다. */
  const rank = c => (visited.has(c.id) && myRates[c.id]?.stars == null) ? 999
                  : (myRates[c.id]?.stars ?? -1);
  list.sort((a, b) => rank(b) - rank(a)
                   || (a.fame ?? 9) - (b.fame ?? 9)
                   || a.name.localeCompare(b.name, 'ko'));

  $('r_head').textContent = '도시';
  제자리안내();
  /* ⚠ 여기서 한 번 부릅니다 — 시트를 «안 열어도» 컨트롤 글자와 개수가
     맞아야 합니다. 시트 여는 쪽에서만 채우면 처음엔 늘 「전체」로 보입니다. */
  거르개채우기();

  /* ⚠ 「직접 넣기」 안내를 걷었습니다(b670) — index.html 의 주석 참고. */
  /* ── 왜 비었는지 말합니다(b728) ────────────────────────────────────
   * ⚠⚠ **이 목록은 「이미 매긴 곳」을 «일부러» 뺍니다**(위 필터의 마지막 줄).
   *   그런데 비었을 때 하던 말은 「찾는 도시가 없어요」 하나였습니다 —
   *   도쿄를 검색했는데 그 말이 뜨면 **사전에 없는 줄 압니다.** 실제로는
   *   이미 매겨서 빠진 것입니다. 앱이 자기가 한 일을 사용자 탓으로
   *   돌리는 셈이라, 「저장 실패를 성공처럼 보이게」와 같은 부류입니다.
   * ⚠ 그래서 **거르기 전 사전**과 견줍니다 — 사전에도 없으면 진짜 없는
   *   것이고, 있는데 안 보이면 **우리가 뺀 것**입니다.
   * ⚠ 단추는 안 답니다. 보관함은 «다른 탭» 안에 있어서, `data-go` 로
   *   눌러도 그 탭으로 옮겨가지 않습니다(dom.js 의 data-go 는 요소를
   *   누를 뿐 화면을 안 바꿉니다). 갈 곳을 글로만 알려줍니다.
   * ⚠ 조사는 `josa` 로 붙입니다 — 「‘도쿄’는」과 「‘파리’는」이 다릅니다. */
  if (!list.length){
    const 쓴것 = $('r_q').value.trim();
    /* ① 검색어만으로 사전을 다시 봅니다(거르개도 「안 매긴 곳」도 빼고). */
    const 사전 = q ? (cities || []).filter(c =>
                      cho ? c._cho.includes(q) : c._hay.includes(q))
                   : (cities || []);
    /* ② 그중 지금 거르개를 통과하는 것. */
    const 범위 = 사전.filter(c =>
      (rtCont === 'all' || 대륙of(c) === rtCont) &&
      (rtCtry === 'all' || 모국(c) === rtCtry));
    const 거른이름 = rtCtry !== 'all' ? (countryName[rtCtry] || rtCtry)
                   : rtCont !== 'all' ? rtCont : '';

    let 글, 밑 = '';
    if (!사전.length){
      글 = '찾는 도시가 없어요.';
    } else if (!범위.length){
      글 = 쓴것 ? `${josa(`‘${쓴것}’`, '은', '는')} ${거른이름}에 없어요.`
                : `${거른이름}에 아직 도시가 없어요.`;
      밑 = '거르개를 「전체」로 두면 다 보여요.';
    } else {
      /* 사전에도 있고 거르개도 통과하는데 안 보인다 = 전부 이미 매긴 것. */
      글 = 쓴것 ? `${josa(`‘${쓴것}’`, '은', '는')} 이미 매기셨어요.`
                : (거른이름 ? `${josa(거른이름, '은', '는')} 다 매기셨어요.`
                              : '매길 곳을 다 매기셨어요.');
      밑 = '매긴 곳은 기록 탭의 보관함에서 볼 수 있어요.';
    }
    $('ratelist').innerHTML =
      `<div class="empty"><div>${esc(글)}</div>` +
      (밑 ? `<div class="memo" style="margin-top:6px">${esc(밑)}</div>` : '') +
      `</div>`;
    lastRateHtml = '';
    return;
  }

  /* 끝까지 내리면 더 불러옵니다. 80곳에서 자르고 "검색하세요" 라고만 하면
     222곳이 영영 안 보입니다. */
  const html = list.slice(0, rateShown).map(c => {
    const r = myRates[c.id] || {}, s = cityStat[c.id];
    const todo = visited.has(c.id) && r.stars == null;
    /* 사진이나 이름을 누르면 그 도시 페이지가 열립니다.
       별과 하트는 아래 처리에서 먼저 걸러지므로 여기 걸리지 않습니다. */
    return `<div class="rrow" data-cityopen="${esc(c.id)}">
      ${c.image_url
        ? `<img class="thumb" src="${esc(c.image_url)}" alt="" loading="lazy"
               onerror="this.replaceWith(Object.assign(document.createElement('span'),
                 {className:'thumb ph', textContent:'${esc(c.name.slice(0,1))}'}))">`
        : `<span class="thumb ph">${esc(c.name.slice(0,1))}</span>`}
      <div class="t"><b>${esc(c.name)}</b>
        ${todo ? '<span class="ktag" style="--kc:#f5a623">평가 대기</span>' : ''}
        <span class="memo">${esc(cityCountry(c))}${
          visited.has(c.id) ? ' · 다녀옴' : ''}${avgTail(s, r)}</span>
      </div>
      <span class="stars" data-city="${esc(c.id)}">${starHtml(r.stars)}</span>
      <button class="ghost want${r.want ? ' on' : ''}" data-want="${esc(c.id)}"
              title="가보고 싶어요">♡</button>
    </div>`;
  }).join('') + (list.length > rateShown
    ? '<div class="empty" id="ratemore">더 불러오는 중…</div>' : '');

  /* ⚠ **같은 것을 다시 그리면 사진이 깜빡입니다** (실기기에서 지적받음).
     `ctx.showApp('rate')` 가 탭을 누를 때마다 `loadRatings()` 를 부르고, 여기가
     `innerHTML` 을 갈아끼웁니다. 글자는 똑같이 다시 그려도 티가 안 나는데
     **`<img>` 80개는 통째로 버려졌다가 새로 만들어져서** 빈 칸이 보였다가
     채워집니다. 같은 주소인데도 그렇습니다 — 요소가 새것이라 처음부터
     다시 그리는 것이라서요.
     → **글자가 한 자도 안 달라졌으면 손대지 않습니다.** 그러면 사진 요소가
       그대로 살아 있어 깜빡일 일이 없습니다.
     비교는 우리가 만든 글자끼리 합니다 — `el.innerHTML` 을 도로 읽으면
     브라우저가 따옴표와 속성 순서를 제 식대로 바꿔 놓아서 **늘 다르다고 나옵니다.** */
  if (html !== lastRateHtml){
    $('ratelist').innerHTML = html;
    lastRateHtml = html;
  }
  /* 바닥에 닿으면 더 그립니다. 스크롤 값을 재는 것보다 어긋날 자리가 적습니다. */
  const more = $('ratemore');
  if (more){
    rateObs?.disconnect();
    rateObs = new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return;
      rateShown += 60; rateObs.disconnect(); drawRatings();
    }, { rootMargin:'400px' });
    rateObs.observe(more);
  }
}

/* ⚠⚠ **여기 있던 「직접 넣기」 처리기를 걷었습니다(b670).**
   `sb.from('cities').insert(...)` 로 사용자가 도시를 만들 수 있었습니다
   (db/017 이 열어둔 것). 목록은 «남들과 같이 보는 것»이라 한 사람이 넣은
   이상한 이름을 모두가 봅니다. 도시가 701곳이 된 지금은 「없으면 직접」의
   필요도 거의 없습니다.
 ⚠ **화면과 코드만 지우면 문은 열려 있습니다** — RLS 정책도 같이
   닫았습니다(db/082). 되살리려거든 셋을 다 되살려야 합니다:
   index.html 의 `#addcity` · 여기 · db 정책. */

/* ── 시트(b676) ───────────────────────────────────────────────────────
 * ⚠ 항목은 **자료에서 만듭니다.** 대륙·국가 목록을 코드에 적으면
 *   도시를 넣고 뺄 때마다 여기도 고쳐야 합니다.
 * ⚠ 세는 것은 **거르기 «전»**입니다 — 거른 뒤에 세면 고른 칸만 숫자가
 *   남고 나머지가 전부 0 이 됩니다(보관함 시트에서 겪은 것과 같음).
 * ⚠ 국가는 **도시 많은 순**입니다. 192개국 중 114개는 도시가 한 곳뿐이라
 *   가나다순이면 쓸모없는 것이 위로 옵니다. */
function 거르개채우기(){
  const 안매긴 = (cities || []).filter(c =>
    myRates[c.id]?.stars == null || justRated.has(c.id));

  const 대륙셈 = {}, 나라셈 = {};
  for (const c of 안매긴){
    const k = 대륙of(c);
    대륙셈[k] = (대륙셈[k] || 0) + 1;
    /* 국가 칸은 «고른 대륙 안»만 셉니다 — 아시아를 골랐는데 프랑스가
       남아 있으면 누를 때마다 0곳이 됩니다. */
    if (rtCont === 'all' || k === rtCont){
      const cc = 모국(c);
      나라셈[cc] = (나라셈[cc] || 0) + 1;
    }
  }

  const 칸 = (그룹, 값, 글, 수, 켬) =>
    `<button type="button" class="shopt${켬 ? ' on' : ''}" data-${그룹}="${
      esc(값)}"${수 === 0 ? ' disabled' : ''}>${esc(글)}<i>${수}</i></button>`;

  $('rt_conts').innerHTML = '<span class="label">대륙</span>' +
    칸('rtcont', 'all', '전체', 안매긴.length, rtCont === 'all') +
    Object.entries(대륙셈).sort((a, b) => b[1] - a[1])
      .map(([k, n]) => 칸('rtcont', k, k, n, rtCont === k)).join('');

  const 나라합 = Object.values(나라셈).reduce((a, b) => a + b, 0);
  $('rt_ctrys').innerHTML = '<span class="label">국가</span>' +
    칸('rtctry', 'all', '전체', 나라합, rtCtry === 'all') +
    Object.entries(나라셈)
      .sort((a, b) => b[1] - a[1]
                   || (countryName[a[0]] || a[0]).localeCompare(countryName[b[0]] || b[0], 'ko'))
      .map(([cc, n]) => 칸('rtctry', cc, countryName[cc] || cc, n, rtCtry === cc)).join('');

  /* ⚠ 걸린 것이 있으면 **이름 옆에 적습니다** — 목록이 왜 짧은지 모르는
     것이 이 화면에서 제일 나쁜 일입니다. 나라가 대륙보다 좁으므로
     나라가 걸려 있으면 그것을 적습니다. */
  const 걸린것 = rtCtry !== 'all' ? (countryName[rtCtry] || rtCtry)
               : rtCont !== 'all' ? rtCont : '';
  $('rt_btn').textContent = 걸린것 ? `필터 · ${걸린것}` : '필터';
  $('rt_btn').classList.toggle('on', !!걸린것);
}

export function 나라거르개열기(){
  거르개채우기();
  $('rtsheet').classList.remove('hide');
  if (history.state?.t2 !== 'rtsheet') history.pushState({ t2:'rtsheet' }, '');
}
export function 나라거르개닫기(뒤로온것){
  const 판 = $('rtsheet');
  if (!판 || 판.classList.contains('hide')) return;
  if (!뒤로온것 && history.state?.t2 === 'rtsheet'){ history.back(); return; }
  판.classList.add('hide');
}

/* ── 평가 탭 «첫 화면»(b786) ── 하단바 «같은 탭 다시 누르기»(app.js)가 부릅니다.
   사용자: 「그 버튼 한번 더 누르면 그 탭 제일 처음 화면으로」. 거르개 시트를 닫고
   검색어와 대륙·국가 거르개를 풉니다. 걸린 것이 없으면 목록을 다시 안 그립니다. */
export function 평가처음으로(){
  나라거르개닫기();
  const 칸 = $('r_q');
  if (!칸.value && rtCont === 'all' && rtCtry === 'all') return;
  칸.value = ''; rtCont = 'all'; rtCtry = 'all';
  거르개채우기(); drawRatings();
}

$('rt_btn').addEventListener('click', () => 나라거르개열기());
$('rtsheet').addEventListener('click', e => {
  if (e.target.closest('[data-rtclose]')) return 나라거르개닫기();
  const a = e.target.closest('[data-rtcont]');
  if (a && !a.disabled){
    rtCont = a.dataset.rtcont;
    /* ⚠ 대륙을 바꾸면 «고른 나라»가 그 안에 없을 수 있습니다. 안 풀면
       목록이 0곳이 되고 왜 그런지 알 수가 없습니다. */
    if (rtCtry !== 'all' && rtCont !== 'all'
        && (continentOf[rtCtry] || '기타') !== rtCont) rtCtry = 'all';
    거르개채우기(); drawRatings(); return;
  }
  const b = e.target.closest('[data-rtctry]');
  if (b && !b.disabled){ rtCtry = b.dataset.rtctry; 거르개채우기(); drawRatings(); }
});

$('r_q').addEventListener('input', drawRatings);

$('ratelist').addEventListener('click', async e => {
  /* 별 왼쪽 절반은 반 개, 오른쪽 절반은 한 개 — 왓챠피디아와 같은 방식입니다. */
  const st = e.target.closest('.st');
  if (st){
    const wrap = st.closest('.stars'), cityId = wrap.dataset.city;
    const v = starValue(st, e.clientX);   /* 반칸 규칙은 stars.js 한 곳(b491) */
    /* 같은 점수를 다시 누르면 지웁니다. 잘못 누른 것을 되돌릴 길이 있어야 합니다.
       "다녀옴"은 따로 켜지 않습니다 — 별점이 있으면 다녀온 것으로 계산됩니다. */
    const cur = myRates[cityId]?.stars;
    /* ⚠ **0 도 「지우기」입니다(b501).** 별을 끌어 맨 왼쪽까지 가면 0 이
       옵니다. 자료는 `saveRate` 가 알아서 `dropRate` 로 보내는데(b494),
       **화면은 그걸 몰라서** 「★ 0 기록」 딱지가 붙었습니다 — 지웠는데
       0점을 준 것처럼 보였습니다. 아래 `paintStars` 가 이 값을 그대로
       쓰므로 여기서 null 로 만들어야 합니다. (딱지는 b823 에 걷었습니다 — stars.js.) */
    const next = (v === 0 || Number(cur) === v) ? null : v;
    /* 저장을 기다리지 않고 먼저 칠합니다. 여기서는 줄을 옮기지도 지우지도 않습니다.
       ⚠ 「★ 4 기록」 딱지는 안 붙입니다(b823) — 붙으면 줄이 늘어 아래 줄이 밀렸습니다(stars.js 주석). */
    paintStars(wrap, next, true);
    /* 줄을 직접 손댔습니다(별 칠하기). 만든 글자는 칠하기 전 모습이므로, 여기서
       무효로 해두지 않으면 다음 그리기가 "같다"고 건너뛰어 화면과 어긋난 채로 남습니다. */
    lastRateHtml = '';
    await saveRate(cityId, { stars: next }, true);
    return;
  }
  const w = e.target.closest('button[data-want]');
  if (w) return saveRate(w.dataset.want, { want: !myRates[w.dataset.want]?.want });

  /* 별과 하트가 아니면 도시 페이지를 엽니다. */
  const row = e.target.closest('[data-cityopen]');
  if (row) await openCity(row.dataset.cityopen);
});

/* ── 별점 취소 — 줄을 통째로 지웁니다(b407) ──────────────────────────
 * ⚠ **`saveRate(id, { stars: null })` 과 다릅니다.** 그건 줄을 남기고,
 *   남은 줄은 "이미 물어본 곳"이라 **다시는 안 물어봅니다**(fillQuiz).
 *   잘못 눌러서 취소한 도시가 영영 안 나오면 안 됩니다.
 *   가르는 이유는 rate.js 의 `removeRate` 머리말에 적어뒀습니다.
 *
 * ⚠ **♡ 나 메모가 있으면 안 지웁니다.** 그건 사용자가 따로 남긴 것이라
 *   별점을 무른다고 같이 없어지면 안 됩니다. 그때는 별점만 비웁니다. */
export async function dropRate(cityId){
  const cur = myRates[cityId] || {};
  /* ⚠⚠ **줄에 «남길 것»이 하나라도 있으면 지우지 않습니다(b734).** ⚠⚠
   *   b734 전에는 `want` 와 `comment` 둘만 봤습니다. 그런데 **일기(`journal`)
   *   와 일기 사진(`journal_photo`)도 같은 줄에 삽니다**(db/071·b565).
   *   그래서 일기를 써 둔 도시에서 별을 맨 왼쪽까지 끌면 — ♡ 도 한줄평도
   *   없으면 — **줄이 통째로 지워지면서 일기가 같이 날아갔습니다.**
   *   별점 취소는 「별점만 비우는 것」이지 「이 도시 기록을 버리는 것」이
   *   아닙니다. 사용자에게는 되돌릴 길도 없습니다.
   * ⚠ **칸을 더할 때는 여기도 같이 봐야 합니다.** `city_ratings` 에 새 칸이
   *   생기면 이 목록이 늘어야 합니다 — 안 늘리면 조용히 지워집니다.
   *   지금 이 줄이 아는 칸: want · comment · journal · journal_photo.
   * ⚠ 별점만 비우는 길은 `saveRate(…, {stars:null})` 입니다 — 그쪽은
   *   upsert 라 나머지 칸을 안 건드립니다. */
  const 남길것 = cur.want
              || (cur.comment || '').trim()
              || (cur.journal || '').trim()
              || cur.journal_photo;
  if (남길것) return saveRate(cityId, { stars: null }, true);

  const r = await sb.from('city_ratings').delete()
    .eq('user_id', ctx.me().id).eq('city_id', cityId).select('city_id');
  if (r.error){ fail(r.error, 'rate'); return false; }
  removeRate(cityId);
  /* 지워서 문턱 아래로 내려가면 「확정」 단추도 걷습니다(위 「확정된 순간」). */
  if (해외매긴수() < 성향문턱) 확정순간 = false;
  /* 다녀온 곳은 지난 여행에서도 오므로 서버에 다시 물어야 맞습니다. */
  await refreshVisited();
  const s = await sb.rpc('city_stats', { p_city: cityId });
  putCityStat(cityId, s.data?.[0]);
  return true;
}

/* ⚠⚠ **되었는지를 «돌려줍니다»(b716, b698 점검 첫째).** ⚠⚠
 *   여태 성공도 실패도 undefined 였습니다. 그래서 도시 화면은 저장이
 *   실패해도 「한줄평을 등록했어요」를 띄웠습니다 — 그리고 진짜 오류는
 *   평가 탭의 오류 상자로 갔는데, 그 판은 도시 화면 뒤에 숨어 있어
 *   **아무 데도 안 보였습니다**(실측: 화면 아래 7,954px).
 * ⚠ 부르는 쪽이 안 봐도 전과 똑같이 돕니다 — 값을 더했을 뿐입니다. */
export async function saveRate(cityId, patch, quiet){
  /* ⚠⚠ **0 은 「지우기」입니다(b494).** ⚠⚠ 별을 끌어 맨 왼쪽까지 가면
   *   0 이 옵니다. 그대로 저장하면 **「0점을 준 곳」이라는 없는 상태**가
   *   생기고, 별점 없는 줄은 이 앱에서 「안 가봤어요」라서(b407) 뜻까지
   *   뒤집힙니다.
   * ⚠ **`{stars:null}` 이 아니라 `dropRate` 입니다.** 취소는 줄을 지우는
   *   것이고, 별점 없는 줄을 남기는 것은 「안 가봤어요」입니다 — b407 에서
   *   갈라 놓은 것입니다. `dropRate` 가 ♡·한줄평이 있으면 알아서 줄을
   *   남기고 별점만 비웁니다.
   * ⚠ **여기 한 곳에서 막습니다.** 별을 누르는 자리가 아홉 군데인데 거기
   *   마다 적으면 언젠가 한 곳이 빠집니다. 저장은 전부 여기를 지납니다. */
  if (patch && patch.stars === 0) return dropRate(cityId);
  /* 문턱째인지 보려고 «저장 전» 수를 잡아 둡니다(위 「확정된 순간」). 별점을 아직 못 받았으면 안 셉니다. */
  const 전 = 별받음 ? 해외매긴수() : null;
  const r = await sb.from('city_ratings')
    .upsert({ user_id: ctx.me().id, city_id: cityId, ...patch },
            { onConflict: 'user_id,city_id' })
    .select('city_id,stars,want,comment,journal,journal_photo').maybeSingle();
  if (r.error){ fail(r.error, 'rate'); return false; }
  /* 별점 · 방금 매긴 것 · 다녀온 곳을 **한 번에** 맞춥니다(rate.js).
     셋을 따로 적으면 그중 하나를 빠뜨립니다. 별을 지운 경우만 다녀온 곳을
     여기서 못 정합니다 — 지난 여행 기록이 있으면 그대로 다녀온 곳이라
     서버에 다시 물어야 합니다. 물어야 하는지는 rate.js 가 알려줍니다. */
  if (applyRate(cityId, r.data, patch).recount) await refreshVisited();
  /* 문턱 아래 → 문턱(해외 10곳)이 된 이 저장 한 번만 「확정」입니다. 별점을 «지워서» 줄면 걷습니다(제자리안내도 한 번 더 봅니다). */
  const 후 = 해외매긴수();
  if (전 != null && 전 < 성향문턱 && 후 >= 성향문턱) 확정순간 = true;
  if (후 < 성향문턱) 확정순간 = false;
  /* 평균은 남들 것까지 합친 값이라 다시 받아야 맞습니다. */
  const s = await sb.rpc('city_stats', { p_city: cityId });
  putCityStat(cityId, s.data?.[0]);
  /* 조용히 저장할 때는 다시 그리지 않습니다 — 누른 줄이 제자리에 있어야 합니다.
     대신 위 안내 한 줄의 숫자만 고칩니다(b807 — 제자리안내 머리말). */
  if (!quiet) drawRatings(); else 제자리안내(true);
  return true;
}

