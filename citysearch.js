/* ── 도시 검색 · 도시 자료 받아오기 ───────────────────────────────────
 * 여행을 만들 때 도시를 고르는 화면입니다. '많이 가는 곳' 을 깔아두고,
 * 치면 걸러 보여주고, 고르면 나라를 붙여 확인해 줍니다.
 * 도시·나라 목록을 서버에서 받아 cities.js 에 넘기는 것도 여기가 합니다 —
 * 앱에서 그 자료를 처음 필요로 하는 자리가 여기라서입니다.
 *
 * ── app.js 에서 떼어낸 열두 번째 조각입니다(b339) ────────────────────
 * **딸린 것이 없습니다.** ctx 0 짜리로는 세 번째입니다(prep · planmap 다음).
 *
 * `loadCities` 를 app.js 가 12곳, `pick` 을 10곳에서 부릅니다. 많이 불리는
 * 것은 떼지 말라는 뜻이 아니라 **한곳에 모아둘 값이 크다**는 뜻입니다 —
 * 부르는 쪽은 export 한 줄이면 되고, 딸린 것은 이 조각이 남을 아는 것뿐입니다.
 *
 * `flagOf` 는 여기 있었는데 dom.js 로 내렸습니다 — map.js 의 '다녀온 국가'
 * 안에 **같은 계산이 인라인으로 한 번 더** 적혀 있었습니다. 두 곳이 쓰면
 * 아래층입니다.
 *
 * 찾기(`search`)는 cities.js 가 합니다 — 초성·시작 우선·40개 자르기는
 * 사전이 아는 것입니다. 사전 세우기도 거기입니다(`useCities`).
 *
 * 층: dom.js · db.js · net.js · cities.js 만 씁니다. */
import { $, esc, emptyDo, flagOf, flagOk } from './dom.js?v=b830';
import { sb } from './db.js?v=b830';
import { fail, netTimeout, netIsDown, isOffline, drawOffbar,
         cacheGet, cacheSet } from './net.js?v=b830';
import { cities, countryName, countryInfo, search, useCities, cityCountry } from './cities.js?v=b830';

/* ── 도시 검색 ──────────────────────────────────────────────────── */
/* 도시 고르개가 지금 무엇을 보여주고 있나. **app.js 의 let 뭉치 안에 있던
   것을 여기로 옮겼습니다(b339).** 원래 주석에는 `pick()` 이 화면 여덟 곳을
   쓰니 app.js 에 남긴다고 적혀 있었는데, 그 `pick()` 이 이 파일로 왔으니
   이유가 없어졌습니다.

   ⚠ 이 셋이 app.js 의 **여러 줄짜리 `let` 선언 안쪽**에 들어 있어서
   떼어낼 때 세는 데서도, check-refs 에서도 안 보였습니다(둘 다 줄 맨 앞의
   `let` 만 봅니다). 검사는 b339 에서 고쳤습니다. */
export let picked = null;
let hitList = [], cursor = 0;

/* 새 여행 만들기를 닫을 때 앞사람 흔적을 지웁니다. app.js 가 세 변수를
   직접 비우던 자리인데, 변수가 여기로 왔으니 길도 여기서 냅니다. */
export function resetPick(){
  picked = null; hitList = []; cursor = 0;
  $("picked").classList.add("hide");
}

/* 대중교통 등급(transit_grade)은 더 이상 화면에 안 씁니다. 알아도 할 수 있는
   일이 없고, 정작 필요한 이동 시간은 일정 화면이 따로 알려줍니다.
   등급 자체는 그 계산의 재료라 DB 에는 그대로 있습니다. */

/* 뒤에서 다시 받아오는 중인지. 두 번 겹쳐 부르지 않으려고 둡니다. */
let citiesRefreshing = false;

export async function loadCities(){
  if (cities) return;

  /* ── 담아둔 것이 있으면 그걸 먼저 씁니다 ──
     도시 313행에 설명 글까지 붙어 제법 무겁습니다. 그걸 다 받아야 홈도 여행도
     그려지니, 켤 때마다 그 시간을 통째로 기다리고 있었습니다.
     예전에는 이 캐시를 **연결이 끊겼을 때만** 꺼냈습니다. 그런데 도시 목록은
     하루 사이에 바뀌는 자료가 아닙니다. 바로 꺼내 쓰고 새것은 뒤에서 받습니다.
     서비스워커에서 배운 것과 같습니다 — 기다리는 설계가 집니다. */
  const cached = cacheGet('cities');
  if (cached?.cities?.length){
    applyCities(cached.cities, cached.countries);
    if (!citiesRefreshing && !netIsDown()){
      citiesRefreshing = true;
      /* 화면은 이미 그려졌습니다. 새것이 오면 조용히 갈아끼웁니다. */
      refreshCities().finally(() => { citiesRefreshing = false; });
    }
    return;
  }
  return refreshCities();
}

/* 실제로 받아오는 쪽. 위에서 캐시를 쓸 때는 이걸 뒤에서 돌립니다. */
async function refreshCities(){
  /* 새로 붙인 칸(사진·설명)이 아직 DB에 없을 수 있습니다. 그때 질의가 통째로
     실패하면 도시 목록이 아예 안 나옵니다 — 한 번 그렇게 비어 버렸습니다.
     없는 칸은 빼고 다시 물어봐서, 마이그레이션이 늦어도 화면은 살아 있게 합니다. */
  /* 좌표는 지도에 핀을 찍는 데 씁니다. 313행이라 무게는 무시할 만합니다. */
  const BASE = 'id,name,name_en,name_local,country,currency,timezone,transit_grade,' +
               'center_lat,center_lng';
  /* fame 은 성향 카드가 씁니다 (033). 없으면 그 판정만 건너뛰면 되므로
     아래 단계별 후퇴에서 제일 먼저 떨어져 나가게 둡니다. */
  /* pop_rank 는 새 여행 첫 화면의 추천 순서입니다 (051). 아직 없는 DB 가
     있을 수 있어 한 칸 따로 둡니다 — 같이 묶으면 이게 없다는 이유로
     fame 까지 떨어져 나가서 성향 카드가 조용히 망가집니다. */
  /* ⚠⚠ **한 번에 1000행까지만 옵니다(b651).** PostgREST 의 `db-max-rows`
     이고 **서버가 정한 값이라 `limit` 으로 못 넘깁니다.** 도시가 1,151곳이
     된 날 앱은 **1,000곳만 받았습니다** — 151곳이 검색에서도 지도에서도
     통째로 사라졌습니다. **오류가 안 납니다. 그냥 덜 옵니다.**
     (재보고 알았습니다: `limit=5000` 도 `Range: 0-4999` 도 1000 이 옵니다.)
     → `range()` 로 쪽을 나눠 받습니다. 마지막 쪽은 1000보다 적게 옵니다.
   ⚠ **차례가 흔들리면 안 됩니다.** `name` 하나로 정렬하면 같은 이름이
     있을 때 쪽 경계에서 순서가 바뀌어 **어떤 줄은 두 번 오고 어떤 줄은
     아예 안 옵니다.** `id` 를 뒤에 붙여 «완전한 차례»로 만듭니다.
   ⚠ 첫 쪽만 `netTimeout` 을 씌웁니다 — 거기서 끊기면 어차피 캐시로
     갑니다. 뒤쪽까지 매번 재면 느린 회선에서 오히려 잘 끊깁니다. */
  const 쪽크기 = 1000;
  const 도시받기 = async (sel) => {
    let 다 = [], 부터 = 0;
    for (;;){
      const q = sb.from('cities').select(sel).order('name').order('id')
                  .range(부터, 부터 + 쪽크기 - 1);
      const r = 부터 === 0 ? await netTimeout(q) : await q;
      if (r.error) return r;
      const 온것 = r.data || [];
      다 = 다.concat(온것);
      if (온것.length < 쪽크기) break;
      부터 += 쪽크기;
      if (부터 >= 20000) break;   /* 만일을 대비한 멈춤 */
    }
    return { data: 다, error: null };
  };

  /* `tags` 는 추천 계산이 씁니다(rec.js). **제일 앞 시도에만 넣습니다** —
     아직 db/068 을 안 돌린 곳에서는 이 줄이 실패하고 아래 단계별 후퇴가
     tags 없이 받아옵니다. 그러면 추천만 조용히 비고 앱은 그대로 돕니다. */
  /* `image_lg` 는 큰 칸(넘기며 매기기·도시 화면 맨 위…)에 쓰는 세로 1080 사진입니다(db/109, 사진 개편).
     없는 도시는 비어 있고, 그때는 어디서나 image_url 로 갑니다. 아래 후퇴 단계에서는 뺍니다. */
  /* `kinds` 는 화면에 보이는 도시 «종류»입니다(db/113, b824 — 분석 탭 「여행지 종류별 별점」 · 어워즈 「○○ 최애」).
     ⚠⚠ **`tags` 와 다른 칸입니다.** tags 는 추천 계산용이라 그대로 두고(바꿔서 재 보니 추천이 나빠졌습니다 — 113 머리말),
     kinds 는 「그 도시에 가는 대표 이유」만 1~3개로 새로 붙였습니다. **맨 윗단에만 넣습니다** — 113 을 아직 안 돌린
     DB 에서는 이 줄만 실패하고 바로 아랫단(지금까지의 맨 윗단)으로 받습니다. 그러면 종류 카드만 안 뜨고 앱은 그대로 돕니다. */
  let cs = await 도시받기(BASE + ',image_url,image_lg,summary,summary_url,fame,pop_rank,tags,kinds');
  if (cs.error && !isOffline(cs.error))
    cs = await 도시받기(BASE + ',image_url,image_lg,summary,summary_url,fame,pop_rank,tags');
  if (cs.error && !isOffline(cs.error))
    cs = await 도시받기(BASE + ',image_url,summary,summary_url,fame,pop_rank,tags');
  if (cs.error && !isOffline(cs.error))
    cs = await 도시받기(BASE + ',image_url,summary,summary_url,fame');
  /* 연결 문제로 실패한 것이면 아래 단계별 후퇴를 돌 이유가 없습니다.
     세 번을 더 기다리면 그만큼 화면이 늦게 뜹니다. 바로 캐시로 갑니다. */
  if (cs.error && isOffline(cs.error)){
    const old = cacheGet('cities');
    if (old){ applyCities(old.cities, old.countries); drawOffbar(); return; }
  }
  if (cs.error) cs = await 도시받기(BASE + ',image_url,summary,summary_url');
  if (cs.error) cs = await 도시받기(BASE + ',image_url');
  if (cs.error) cs = await 도시받기(BASE);

  /* ⚠ `parent_code` 는 속령을 모국으로 접는 칸입니다(db/076). **제일 앞
     시도에만 넣습니다** — 아직 076 을 안 돌린 곳에서는 이 줄이 실패하고
     아래로 떨어집니다. 그러면 괌이 다시 제 나라로 세어질 뿐, 앱은 돕니다. */
  let ns = await sb.from('countries')
    .select('code,name,currency,local_lang,default_timezone,continent,parent_code').order('name');
  if (ns.error) ns = await sb.from('countries')
    .select('code,name,currency,local_lang,default_timezone,continent').order('name');
  if (ns.error) ns = await sb.from('countries')
    .select('code,name,currency,local_lang,default_timezone').order('name');

  if (cs.error || ns.error){
    /* 못 받아왔으면 지난번 것을 씁니다. 도시 목록이 없으면 홈도 여행도 못 그립니다 —
       비행기모드에서 화면이 "불러오는 중…"에 멈춰 있던 곳이 여기였습니다. */
    /* 뒤에서 새로 받는 중이었다면 화면에는 이미 도시가 있습니다.
       그때 오류 상자를 띄우면 멀쩡한 화면 위에 빨간 줄만 얹힙니다. */
    if (cities) return;
    const old = cacheGet('cities');
    if (old){ applyCities(old.cities, old.countries); drawOffbar(); return; }
    fail(cs.error || ns.error, 'rate');
    return fail(cs.error || ns.error, 'form');
  }
  cacheSet('cities', { cities: cs.data, countries: ns.data });
  applyCities(cs.data, ns.data);
}

/* 받아온 것이든 캐시에서 꺼낸 것이든 여기서 한 번에 세웁니다.
   **사전 세우기와 검색 색인은 cities.js 가 합니다**(useCities). 여기는
   그 뒤에 화면을 맞추는 일만 합니다 — 나라 고르개, 많이 가는 곳. */
function applyCities(cityRows, countryRows){
  useCities(cityRows, countryRows);
  $('f_country').innerHTML =
    (countryRows || []).map(n => `<option value="${esc(n.code)}">${esc(n.name)}</option>`).join('');
  drawCountryNote();
  /* 도시가 새로 들어왔으면 '많이 가는 곳'도 다시 뽑습니다. */
  delete $('wizpop').dataset.done;
  drawPop();
}

/* 나라만 골랐을 때 무엇이 채워질지 미리 보여줍니다.
   시간대가 여럿인 나라는 그렇다고 적어줘야 오해가 없습니다. */
function drawCountryNote(){
  const n = countryInfo[$('f_country').value];
  if (!n) return;
  const many = cities && cities.filter(c => c.country === n.code)
                              .some(c => c.timezone !== n.default_timezone);
  $('c_note').textContent =
    `${n.currency} · ${n.default_timezone || '시간대 미정'}` +
    (many ? ' — 이 국가는 시간대가 여럿입니다. 정확히 하려면 도시를 고르세요.' : '');
}
$('f_country').addEventListener('change', drawCountryNote);

/* 찾기(search)는 cities.js 로 갔습니다 — 초성·시작 우선·40개 자르기 규칙은
   사전이 아는 것입니다. 부르는 쪽은 그대로입니다. */

/* emptyDo 와 그 data-go 손잡이는 dom.js 로 내렸습니다(b335, 맨 위 import).
   떼어내는 화면마다 빈 상태를 그리므로 ctx 로 넘길 것이 아니었습니다. */


/* 첫 화면에 깔아둘 '많이 가는 곳'. 순서는 DB 의 pop_rank 가 정합니다(051) —
   여기 적어두면 도시를 더 넣어도 이 목록만 옛날 것으로 남습니다.
   pop_rank 는 나라마다 한 곳씩만 매겨져 있습니다. fame 으로는 못 합니다.
   1등급만 79곳이라 이름순으로 잘리고, 그러면 일본 대표가 '교토'가 됩니다.

   국내는 뺍니다 — 어디로 나갈지 정하는 자리이고, 국내는 쳐서 바로 찾습니다. */
const POP_N = 8;
export function drawPop(){
  const box = $('wizpop');
  const busy = $('f_q').value.trim() || picked;
  box.classList.toggle('hide', !!busy);
  if (busy || !cities || box.dataset.done) return;
  const top = cities.filter(c => c.pop_rank != null && c.country !== 'KR')
    .sort((a, b) => a.pop_rank - b.pop_rank).slice(0, POP_N);
  if (!top.length) return;              /* 051 을 아직 안 돌렸으면 조용히 접습니다 */
  /* **국기를 못 그리는 기기가 있습니다.** 윈도우는 지역표시기호 둘을 합치지
     않아서 `JP` `VN` `TH` 처럼 코드가 그대로 보입니다 — 여행을 시작하는
     첫 화면이 개발자 표기 나열이 됩니다. 오른쪽에 '일본'이라고 이미
     적혀 있으니 못 그릴 때는 아예 안 답니다.
     **판단은 `flagOk()` 한 곳에만 둡니다** — b265 에서 발자국 화면에
     만들어 둔 것을 그대로 씁니다. 그때 여기까지 안 고쳐서 이 화면만
     남아 있었습니다. 같은 판단을 두 벌로 적으면 한쪽만 고치게 됩니다. */
  const fl = flagOk();
  box.innerHTML = top.map(c =>
    `<button type="button" class="poprow" data-cid="${esc(c.id)}">
       ${fl ? `<span class="fl">${flagOf(c.country)}</span>` : ''}<b>${esc(c.name)}</b>
       <span class="c">${esc(cityCountry(c))}</span></button>`).join('');
  box.dataset.done = '1';
}
$('wizpop').addEventListener('click', e => {
  const b = e.target.closest('[data-cid]'); if (!b) return;
  const c = cities?.find(x => String(x.id) === b.dataset.cid); if (!c) return;
  hitList = [c]; cursor = 0; pick(0);
});

export function drawHits(){
  const box = $('hits'), q = $('f_q').value.trim();
  drawPop();
  if (!q){ box.classList.add('hide'); $('freewrap').classList.add('hide'); return; }

  box.classList.remove('hide');
  box.innerHTML = hitList.map((c, i) =>
    `<div class="hit${i === cursor ? ' on' : ''}" data-i="${i}">
       <b>${esc(c.name)}</b><span class="c">${esc(cityCountry(c))}</span>
       <span class="r">${flagOf(c.country)}</span></div>`
  ).join('')
  + `<div class="hit${cursor === hitList.length ? ' on' : ''}" data-i="${hitList.length}">
       <b>${esc(q)}</b><span class="c">그대로 쓰기</span>
       <span class="r">국가만 고르면 됩니다</span></div>`;

  /* 아는 도시가 하나도 없으면 기다릴 것 없이 나라 고르기를 바로 띄웁니다.
     "목록에 없어요"를 찾아 누르게 하는 건 이상합니다 — 친 그대로 쓰면 됩니다. */
  if (!hitList.length) useFree();
  else $('freewrap').classList.add('hide');
}

/* 목록에 없는 곳. 도시 이름은 위 칸에 이미 쳤으니 나라만 더 받습니다. */
function useFree(){
  picked = null;
  $('picked').classList.add('hide');
  $('freewrap').classList.remove('hide');
  drawCountryNote();
}

/* ── 도시 하나를 고른 상태로 만들기 ─────────────────────────────────
 * `pick(i)` 안에 있던 뒷부분입니다. **밖에서도 부릅니다(b463)** —
 * 분석 탭의 추천 칩을 누르면 검색을 거치지 않고 바로 그 도시가
 * 골라진 채로 여행 만들기가 열려야 합니다.
 * ⚠ 화면 채우는 절차를 두 벌로 두면 한쪽만 고칩니다. */
export function pickCity(c){
  if (!c) return;
  picked = c;
  $('freewrap').classList.add('hide');
  $('hits').classList.add('hide');
  $('f_q').classList.add('hide');
  $('wizpop').classList.add('hide');
  $('picked').classList.remove('hide');
  /* 사진이 없는 도시가 아직 많습니다. 그때는 첫 글자를 큼직하게 둡니다 —
     빈 회색 네모만 있으면 안 불러온 것인지 없는 것인지 모릅니다. */
  const im = $('pc_img');
  /* 폭 가득한 정사각형이라 큰 사진(image_lg)을 위에, 작은 것을 밑에 깝니다 — 큰 것이 오기 전·못 받았을 때
     밑의 작은 것이 보입니다(city.js 의 cv_hero 와 같은 수법). */
  im.style.backgroundImage = [...new Set([c.image_lg, c.image_url].filter(Boolean))]
    .map(u => `url("${u}")`).join(', ');
  im.textContent = c.image_url ? '' : c.name.slice(0, 1);
  $('p_name').textContent = c.name;
  $('p_country').textContent =
    `${flagOf(c.country)} ${cityCountry(c)}`.trim();
  $('p_note').textContent = c.currency || '';
}

export function pick(i){
  if (i >= hitList.length){                    /* 친 그대로 쓰기 */
    $('hits').classList.add('hide');
    useFree();
    $('f_country').focus();
    return;
  }
  pickCity(hitList[i]);
}

$('f_q').addEventListener('input', () => {
  hitList = search($('f_q').value); cursor = 0; drawHits();
});
$('f_q').addEventListener('keydown', e => {
  const max = hitList.length;                 /* 마지막 줄이 '목록에 없어요' */
  if (e.key === 'ArrowDown'){ cursor = Math.min(cursor + 1, max); drawHits(); e.preventDefault(); }
  else if (e.key === 'ArrowUp'){ cursor = Math.max(cursor - 1, 0); drawHits(); e.preventDefault(); }
  else if (e.key === 'Enter'){ if (!$('hits').classList.contains('hide')) pick(cursor);
                               e.preventDefault(); }
  else if (e.key === 'Escape'){ $('hits').classList.add('hide'); }
});
$('hits').addEventListener('click', e => {
  const el = e.target.closest('.hit'); if (el) pick(+el.dataset.i);
});
$('repick').addEventListener('click', () => {
  picked = null;
  $('picked').classList.add('hide');
  $('f_q').classList.remove('hide'); $('f_q').value = ''; $('f_q').focus();
  hitList = []; drawHits();
});

