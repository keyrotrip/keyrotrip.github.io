/* ── 보관함 · 여행 배지 ──────────────────────────────────────────────
 * 프로필의 타일(도시·가보고 싶은 곳·맛집·후기·배지)을 누르면 열리는 목록입니다.
 * 종류마다 담기는 것이 달라서 여는 함수가 넷이지만, 닫는 것과 줄을 빼는 것은
 * 하나로 씁니다.
 *
 * ── app.js 에서 떼어낸 세 번째 조각입니다(b323) ─────────────────────
 * persona.js(b321) · map.js(b322)와 같은 방식입니다. app.js 를 import 하지
 * 않고, app.js 만 아는 것은 `setShelfCtx` 로 받습니다.
 * `me` 는 로그인할 때마다 바뀌므로 값이 아니라 **함수**로 받습니다.
 *
 * ⚠ 원래 이 자리에 AI 화면 열기와 알림 읽기가 같이 있었습니다. 보관함과
 *   아무 상관이 없는데 파일이 길어서 옆에 붙어 있던 것뿐입니다.
 *   그 둘은 app.js 에 두고 보관함만 가져왔습니다 — **줄 수로 자르지 않고
 *   하는 일로 자릅니다.**
 *
 * 층: dom.js · db.js · cities.js · rate.js · stars.js · net.js 만 씁니다. */
import { $, esc, toast, emptyDo, josa, toTop, coverDeck, backLabel,
         flagOf, flagOk, flagSprite } from './dom.js?v=b819';
import { openCity } from './city.js?v=b819';
import { sb } from './db.js?v=b819';
import { cities, countryName, cityCountry } from './cities.js?v=b819';
import { myRates, cityStat, visited, avgTail } from './rate.js?v=b819';
import { starHtml, paintStars, markRated, starValue, 별갈래, BAND_NAME } from './stars.js?v=b819';
import { fail } from './net.js?v=b819';
import { arm } from './ui.js?v=b819';
/* 깃발 벽의 공유는 지도·나라 목록과 **같은 카드**입니다(b649) — 셋 다
   「몇 개국 다녀왔다」를 말합니다. map.js 가 만들고 여기서 부르기만
   합니다. ⚠ map.js 는 shelf.js 를 안 가져오므로 고리가 안 생깁니다. */
import { 발자국스펙 } from './map.js?v=b819';
import { shareCard } from './card.js?v=b819';
import { todayYmd } from './calc.js?v=b819';
/* ⚠ `flagOf`·`flagOk` 는 **dom.js 것**입니다(위 줄) — un.js 에 또 만들었다가
     걷었습니다. `UN_CONT`·`UN_TOTAL` 도 un.js 가 «세어서» 줍니다. map.js 를
     끌어오지 않는 이유가 이것입니다 — 195 라는 수를 두 곳에서 적으면
     언젠가 갈라집니다. 두 곳이 같은지는 un.js 의 `검산()` 이 봅니다. */
import { UN_CODES, UN_TOTAL } from './un.js?v=b819';
import { loadCities } from './citysearch.js?v=b819';
import { loadRateData, saveRate } from './rating.js?v=b819';

let ctx = {
  me: () => null,
  loadFootprint: () => {},
  openTrip: async () => {},
  /* 어느 탭에서 열었나 — 뒤로 단추 글자에 씁니다(b697). */
  appTab: () => null,
};
export function setShelfCtx(o){ ctx = { ...ctx, ...o }; }

/* ── 보관함 ──────────────────────────────────────────────────────────
 * 기록 탭으로 보내면 그 탭이 걸린 목록으로 바뀝니다. 그러면 새로 매길 곳을
 * 찾을 수가 없습니다 — 기록 탭은 안 매긴 곳을 보여주는 자리입니다.
 * 프로필 안에서 펼치고, 여기서도 바로 별점을 고칠 수 있게 합니다. */
/* **been 이 빠져 있었습니다.** 프로필의 '국가'·'도시' 타일을 누르면 제목이
   그냥 '보관함'으로 떠서 무슨 목록인지 알 수가 없었습니다.
   그리고 '다녀온 곳'이 도시(been)와 관광지(spot) 둘을 가리키고 있었습니다 —
   보관함 안에 '다녀온 맛집' 옆에 '다녀온 곳'이 나란히 있으니 더 헷갈립니다.
   도시는 '다녀온 도시', 관광지는 '다녀온 관광지'로 갈랐습니다. */
const SHELF = { been:'방문한 도시', want:'가보고 싶은 곳', mine:'내가 매긴 곳',
                comment:'한줄평 남긴 곳', place:'다녀온 맛집', spot:'다녀온 관광지',
                review:'여행 후기', badge:'여행 배지', flag:'나라 깃발' };
/* 맛집과 관광지는 같은 방식으로 다룹니다 — 분류만 다릅니다. */
const SHELF_CAT = { place:['식사','카페'], spot:['관광','쇼핑'] };

/* ── 보관함 정렬·거르기 ─────────────────────────────────────────────
 * 매긴 것이 쌓이면 목록이 길어져 찾을 수가 없습니다.
 * 별점이 없는 보관함(가보고 싶은 곳)에서는 아예 안 나옵니다 — 거를 것이 없습니다. */
/* 지금 보고 있는 보관함 종류. **app.js 에 있던 것을 여기로 옮겼습니다(b327)** —
   쓰는 곳이 여기뿐인데 저쪽에 남아 있어서 떼어낸 뒤 'shelfKind is not defined'
   로 보관함이 통째로 안 열렸습니다. 한 곳에서만 쓰는 것은 그 곳에 둡니다. */
let shelfKind = 'mine';
let shelfSort = 'new';
/* 'all' 이면 안 거릅니다. 값은 별갈래() 가 내는 것과 같습니다. */
let shelfStar = 'all';

/* ── 빈 보관함 (b363) ────────────────────────────────────────────────
 * 전에는 두 곳 다 그냥 **'아직 없어요.'** 였습니다. 무엇이 없는지가 안
 * 적혀 있어서, 어느 타일로 들어왔는지 잊으면 읽고도 모릅니다.
 * 이름은 SHELF 표에서 꺼내 씁니다 — **조사는 `josa` 가 붙입니다.**
 * '다녀온 도시**가**' / '가보고 싶은 곳**이**' 를 손으로 적으면 이름을
 * 바꾸는 날 한쪽을 놓칩니다.
 *
 * 여기를 지나는 것은 도시 평가 넷(been·want·mine·comment)입니다 —
 * 맛집·관광지·후기·배지는 각자 다른 함수로 빠집니다. */
const SHELF_HINT = {
  been:    '도시를 열어 다녀왔다고 표시하면 여기에 모여요.',
  want:    '도시 옆 하트를 누르면 여기에 모여요.',
  mine:    '도시에 별을 남기면 여기에 모여요.',
  comment: '별과 함께 한줄평을 적으면 여기에 모여요.',
};
/* **두 곳에서 씁니다**(그릴 때 · 마지막 줄을 지웠을 때). 문구를 양쪽에
   적으면 한쪽만 고치는 날이 옵니다. */
/* ⚠ 「가보고 싶은 곳」만 단추를 답니다(b799, GPT 리포트 · 빈 화면 규칙) — ♡ 는 이 화면이 아니라
   평가 탭·도시 화면에 있어서 «여기서 못 하는 일»입니다. 단추는 하단바의 평가 탭(`#tabrate`)을
   대신 눌러줍니다(dom.js 의 data-go — 여는 방법을 두 벌로 만들지 않습니다). */
const shelfEmpty = () =>
  emptyDo(`아직 ${josa(SHELF[shelfKind] || '담아둔 것', '이', '가')} 없어요.`,
          shelfKind === 'want' ? '도시 둘러보기' : null,
          shelfKind === 'want' ? 'tabrate' : null, SHELF_HINT[shelfKind]);
/* ⚠⚠ **`been` 을 넣었습니다(b671).** 기록 탭 타일이 「다녀온 도시」로
   바뀌면서 `mine` 대신 `been` 을 열게 됐는데, `been` 이 여기 없어서
   **별점도 정렬칩도 통째로 사라졌습니다.** 이름을 바꾸면 그 이름이 여는
   화면도 같이 봐야 합니다.
 ⚠ 다녀온 곳 중에 아직 별을 안 준 곳은 빈 별로 나옵니다 — 그게 맞습니다.
   「여긴 갔는데 아직 안 매겼네」가 보이는 편이 낫습니다. */
const HAS_STARS = k => k === 'been' || k === 'mine' || k === 'comment'
                    || k === 'place' || k === 'spot';

/* ── 정렬과 거르기(b673) ──────────────────────────────────────────────
 * ⚠⚠ **예전에 별점 칸을 «칩 줄»로 만들었다가 걷어냈습니다** — 그때
 *   주석: 「줄이 둘이 되면서 답답했습니다」. 이번에는 줄을 안 늘리고
 *   **시트**로 갑니다(index.html 의 `#shsheet`). 같은 기능을 다시
 *   넣는 것이니, 걷어낸 이유를 피했는지부터 보십시오.
 * ⚠ `at` 은 마지막으로 손댄 시각입니다 — 없으면 최신순에서 뒤로 갑니다.
 * ⚠ 「유명한 순」(`fame`)은 b675 에 걷었습니다(사용자 결정) — 정렬이
 *   여섯이면 고르는 것 자체가 일이 됩니다. 되살리려거든 `fame` 은
 *   **작을수록 유명하다**는 것을 기억하십시오(db/033, b656 에 데었음). */
function shelfArrange(list){
  const by = {
    new:  (a, b) => String(b.at || '').localeCompare(String(a.at || '')),
    high: (a, b) => (b.stars ?? -1) - (a.stars ?? -1),
    low:  (a, b) => (a.stars ?? 99) - (b.stars ?? 99),
    avg:  (a, b) => (Number(cityStat[b.id]?.avg_stars) || -1)
                  - (Number(cityStat[a.id]?.avg_stars) || -1),
    name: () => 0,
  }[shelfSort] || (() => 0);
  return [...list].sort((a, b) => by(a, b) || String(a.name).localeCompare(String(b.name), 'ko'));
}

/* ⚠ 갈래 규칙은 **stars.js 한 곳**입니다(b727) — 분석 탭이 같은 분포를
   그리므로, 여기 따로 두면 두 화면이 다른 수를 말하게 됩니다. */
const shelfSift = list =>
  shelfStar === 'all' ? list : list.filter(c => 별갈래(c.stars) === shelfStar);

/* 시트의 개수·표식과 위 컨트롤 두 개의 글자를 한 번에 맞춥니다.
 * ⚠ **한 함수에서만 칠합니다.** 표식을 여기저기서 켜면 시트와 컨트롤이
 *   다른 말을 하는 날이 옵니다(b663 에 점과 화면이 갈렸던 그 부류). */
function 거르개칸채우기(all){
  const 셈 = { all: all.length, '5':0, '4':0, '3':0, '2':0, '1':0, none:0 };
  for (const c of all) 셈[별갈래(c.stars)]++;

  $('shsheet').querySelectorAll('[data-sstar]').forEach(b => {
    const k = b.dataset.sstar, n = 셈[k] || 0;
    const 칸 = b.querySelector('i');
    if (칸) 칸.textContent = n;
    /* ⚠ 0 곳은 **감추지 않고 흐리게** 둡니다 — 「없다」도 정보입니다.
       다만 지금 고른 것이 0 이 되는 일은 없습니다(고를 수가 없으므로). */
    b.disabled = n === 0 && k !== 'all';
    b.classList.toggle('on', k === shelfStar);
  });
  $('shsheet').querySelectorAll('[data-ssort]').forEach(b =>
    b.classList.toggle('on', b.dataset.ssort === shelfSort));

  /* ⚠ 단추는 하나입니다(b718) — 정렬과 별점이 «한 시트» 안에 있으니
       밖에도 하나면 됩니다. 자세한 사연은 index.html 의 `#shelffilter`.
     ⚠ 거르개가 걸려 있으면 «걸려 있다»고 말해야 합니다 — 목록이 왜
       짧은지 모르는 것이 이 화면에서 제일 나쁜 일입니다. 그래서 별점을
       걸었을 때만 이름을 덧붙이고 까맣게 켭니다.
     ⚠ **정렬은 안 적습니다.** 정렬은 «늘» 걸려 있는 것이라 적으면 단추가
       도로 둘로 나뉜 것과 같아집니다. 무엇으로 정렬 중인지는 시트가 ✓ 로
       말합니다. */
  const 걸림 = shelfStar !== 'all';
  $('sh_filter').textContent = 걸림 ? `필터 · ${STAR_NAME[shelfStar]}` : '필터';
  $('sh_filter').classList.toggle('on', 걸림);
}

/* ── 시트(b673) ───────────────────────────────────────────────────────
 * ⚠ 고르면 **바로 반영하되 시트는 안 닫습니다** — 정렬과 별점을 이어서
 *   고를 수 있어야 합니다. 닫는 것은 「완료」·바깥 누르기·뒤로가기 셋.
 * ⚠ 기록에 자리를 남깁니다(`t2:'shsheet'`). 안 남기면 뒤로가기가 시트를
 *   건너뛰고 그 아래 보관함을 닫습니다. 닫는 쪽은 tripview.js 의 사슬. */
/* ⚠⚠ **b718 에 `SORT_NAME` 을 걷었다가 보관함이 통째로 안 열렸습니다.** ⚠⚠
   밖의 단추가 하나가 되면서 «이름표»는 쓸 데가 없어진 것이 맞는데,
   아래 `openShelf` 에 **「아는 정렬인가」를 그 표로 묻는 줄**이 하나
   남아 있었습니다(`if (!SORT_NAME[shelfSort])`). 지운 이름을 부르니
   ReferenceError 로 화면이 그대로 죽었습니다.
   → 이름표 대신 **열쇠 목록**만 남깁니다. 묻는 것은 「아는 값인가」이지
     「뭐라고 적을까」가 아니었습니다 — 처음부터 이것이 맞는 자료입니다.
   ⚠ `shelfArrange` 의 `by` 와 **같은 다섯**이어야 합니다. 하나를 더하거나
     빼면 두 곳을 같이 고치십시오. */
const SORT_KEYS = ['new', 'high', 'low', 'avg', 'name'];
const STAR_NAME = { all:'별점 전체', ...BAND_NAME, none:'아직 안 매김' };

export function 거르개열기(){
  $('shsheet').classList.remove('hide');
  if (history.state?.t2 !== 'shsheet') history.pushState({ t2:'shsheet' }, '');
}
export function 거르개닫기(뒤로온것){
  const 판 = $('shsheet');
  if (!판 || 판.classList.contains('hide')) return;
  if (!뒤로온것 && history.state?.t2 === 'shsheet'){ history.back(); return; }
  판.classList.add('hide');
}

$('shelffilter').addEventListener('click', e => {
  if (e.target.closest('#sh_filter')) 거르개열기();
});
$('shsheet').addEventListener('click', e => {
  if (e.target.closest('[data-shclose]')) return 거르개닫기();
  const s = e.target.closest('[data-ssort]');
  if (s){ shelfSort = s.dataset.ssort; openShelf(shelfKind); return; }
  const t = e.target.closest('[data-sstar]');
  /* ⚠ 0 곳인 것은 `disabled` 라 여기까지 안 옵니다. 그래도 한 번 더
     막습니다 — 브라우저마다 disabled 요소의 이벤트가 다릅니다. */
  if (t && !t.disabled){ shelfStar = t.dataset.sstar; openShelf(shelfKind); }
});

/* 도시가 아니라 일정 줄에 답니다. 일정 짤 때 이미 넣은 것이라
   따로 적게 하지 않고, 다녀온 여행의 그 분류만 모아 별점을 받습니다. */
async function openPlaceShelf(kind){
  const today = todayYmd();
  const cats = SHELF_CAT[kind] || SHELF_CAT.place;
  const [ps, rs] = await Promise.all([
    sb.from('plans').select('id,title,memo,category,date,trip_id,trips(title,end_date)')
      .in('category', cats).is('deleted_at', null)
      .order('date', { ascending:false }).limit(300),
    /* updated_at 은 최신순에 씁니다. select 에 안 적으면 undefined 로 와서
       전부 같은 값이 되고 최신순이 이름순처럼 보입니다. */
    sb.from('plan_ratings').select('plan_id,stars,updated_at').eq('user_id', ctx.me().id),
  ]);
  if (ps.error) return fail(ps.error, 'trip');
  const rate = Object.fromEntries((rs.data || []).map(r => [r.plan_id, r.stars]));
  const rateAt = Object.fromEntries((rs.data || []).map(r => [r.plan_id, r.updated_at]));
  /* 아직 안 끝난 여행은 뺍니다 — 가보지도 않고 별점을 매길 수는 없습니다.
     다만 이미 매긴 것은 남깁니다. 매겼다는 것은 갔다는 뜻이고,
     프로필의 숫자와 여기 목록이 어긋나면 어느 쪽을 믿어야 할지 모릅니다. */
  const all = (ps.data || []).filter(p =>
    rate[p.id] != null || (p.trips?.end_date || p.date) < today)
    .map(p => ({ ...p, stars: rate[p.id] ?? null, at: rateAt[p.id] || p.date, name: p.title }));

  const list = shelfArrange(all);

  /* 도시 목록과 같은 이유로 평균을 같이 적습니다(위 주석 참고).
     여기는 아직 안 매긴 장소가 섞여 있어 **매긴 것만으로** 셉니다. */
  {
    const st = list.map(p => rate[p.id]).filter(s => s != null);
    const avg = st.length ? (st.reduce((a, b) => a + b, 0) / st.length) : null;
    $('shelfcount').textContent = !list.length ? ''
      : avg != null ? `${list.length}곳 · 평균 ★${avg.toFixed(1)}` : `${list.length}곳`;
  }
  $('shelflist').innerHTML = list.length
    ? list.map(p => `<div class="rrow">
        <span class="thumb ph">${({ 식사:'🍽', 카페:'☕', 관광:'📸', 쇼핑:'🛍' })[p.category] || '📍'}</span>
        <div class="t"><b>${esc(p.title)}</b>
          <span class="memo">${esc(p.trips?.title || '')} · ${esc(p.date)}</span></div>
        <span class="stars" data-plan="${esc(p.id)}">${starHtml(rate[p.id])}</span>
        ${rate[p.id] != null
          ? `<button class="ghost" aria-label="지우기" data-pdel="${esc(p.id)}"
                     style="color:var(--bad); flex:none">×</button>`
          : '<span style="width:26px; flex:none"></span>'}
      </div>`).join('')
    : `<div class="empty">지난 여행에 ${esc(cats.join(' · '))} 일정이 아직 없어요.<br>
           일정에 넣어두면 여행이 끝난 뒤 여기서 평가할 수 있어요.</div>`;
}

/* 다녀온 여행에 남긴 것을 모아 봅니다. 여행 화면 안에만 두면 그 여행을
   다시 찾아 들어가야 다시 볼 수 있습니다 — 후기는 다시 보라고 쓰는 것입니다.
   별점·글·사진 중 하나라도 남긴 여행만 나옵니다(db/052 의 my_reviews). */
async function openReviewShelf(){
  const { data, error } = await sb.rpc('my_reviews');
  if (error) return fail(error, 'trip');
  const list = data || [];
  $('shelfcount').textContent = list.length ? `${list.length}개` : '';
  if (!list.length){
    $('shelflist').innerHTML =
      emptyDo('아직 남긴 후기가 없어요.', null, null,
              '여행이 끝나면 그 여행 화면에서 별점과 글, 사진을 남길 수 있어요.');
    return;
  }
  /* 표지 사진은 비공개 통에 있습니다. 잠깐 열리는 주소를 한 번에 받습니다. */
  const paths = list.map(r => r.cover).filter(Boolean);
  let by = {};
  if (paths.length){
    const { data: urls } = await sb.storage.from('trip-photos')
      .createSignedUrls(paths, 3600);
    by = Object.fromEntries((urls || []).map(u => [u.path, u.signedUrl]));
  }
  $('shelflist').innerHTML = list.map(r => `
    <div class="rvcard" data-rvtrip="${esc(r.trip_id)}">
      ${r.cover ? `<img src="${esc(by[r.cover] || '')}" alt="" loading="lazy">` : ''}
      <div class="b">
        <div class="t"><b>${esc(r.title)}</b>
          <span class="c">${esc(r.end_date)}</span></div>
        ${r.stars != null ? `<span class="stars">${starHtml(r.stars)}</span>` : ''}
        ${r.comment ? `<div class="m">${esc(r.comment)}</div>` : ''}
        ${r.photos ? `<div class="c">사진 ${r.photos}장</div>` : ''}
      </div>
    </div>`).join('');
}

/* 후기 카드를 누르면 그 여행을 엽니다. 고치는 것은 거기서 합니다 —
   여기서도 고치게 하면 같은 폼이 두 벌이 됩니다. */
$('shelflist').addEventListener('click', e => {
  const c = e.target.closest('[data-rvtrip]');
  if (c) ctx.openTrip(c.dataset.rvtrip);
});

/* ── 여행 배지 ───────────────────────────────────────────────────────
 * 세는 것은 전부 DB 가 합니다(db/053). 화면에서 세면 기기마다 다르게
 * 나오고, 나중에 조건을 바꿔도 옛날 기기는 옛 조건으로 셉니다.
 *
 * **못 받은 것도 보여줍니다.** 받은 것만 늘어놓으면 다음에 뭘 하면
 * 되는지 알 수가 없습니다 — 배지는 받은 자랑이자 다음 목표입니다. */
/* ── 나라 깃발 벽 (b618, 사용자 요청) ─────────────────────────────────
 * 195칸을 다 깔고 **가본 나라만 색이 돕니다.** 나머지는 흐리게 남습니다 —
 * 「얼마나 갔나」보다 **「얼마나 남았나」**가 보이는 것이 이 화면의 값입니다.
 * 다녀온 도시 목록은 이미 있는데 이건 다른 것을 말합니다.
 *
 * ⚠ **자료를 새로 안 받아옵니다.** 칠할 나라는 `cities` + `visited` 로
 *   내는데, 그건 지구본이 칠하는 바로 그 집합입니다(home.js 의 `gone`).
 *   서버에 또 물으면 지구본과 이 벽이 다른 말을 할 수 있습니다.
 * ⚠ **UN 195 안에 없는 코드는 안 셉니다.** 우리 자료에는 괌(GU) 같은
 *   속령도 있습니다. 분모가 195 이므로 분자도 195 안에서 세야 합니다 —
 *   안 그러면 100%를 넘거나 홈의 「27 / 195」와 어긋납니다.
 * ⚠ **깃발을 못 그리는 기기가 있습니다**(윈도우는 `KR` 두 글자).
 *   `flagOk()` 가 재서 알려줍니다 — 그때는 코드 두 글자로 깝니다.
 *   map.js 가 이미 같은 판단을 하고 있어서 그것을 그대로 씁니다. */
/* ── 깃발 그림판 (b624, 사용자 요청) ─────────────────────────────────
 * 「아이폰 자체 말고 내가 첨부한 이미지 같은 깃발은 못 구해?」
 * 이모지 깃발은 **기기가 그립니다** — 아이폰은 애플 것, 안드로이드는
 * 구글 것, 윈도우는 아예 못 그리고 `KR` 두 글자로 나옵니다. 우리가
 * 크기도 모서리도 못 정합니다.
 * → 그림 195개를 **한 파일(`flags.svg`, 356KB)** 로 묶어 들고 다닙니다.
 *   어느 기기에서나 같게 보이고, 한 번 받으면 오프라인에서도 뜹니다.
 *
 * ⚠ **깃발 화면을 열 때만 받습니다.** 356KB 를 앱 첫 실행에 얹으면
 *   이 한 화면 때문에 모두가 느려집니다.
 * ⚠ **한 번만 받습니다.** 두 번째부터는 이미 문서에 들어 있습니다.
 * ⚠ 못 받으면(첫 실행 + 비행기모드) **이모지로 떨어집니다.** 그 길을
 *   지우지 마십시오 — 없으면 그때 빈 화면이 됩니다.
 * ⚠ 그림은 Twemoji, **CC BY 4.0** 입니다. 출처를 밝혀야 해서 화면
 *   아래에 한 줄 답니다. 그 줄을 지우면 라이선스 위반입니다. */
/* ⚠ **싣는 일은 dom.js 로 내려갔습니다(b649).** 공유 카드도 같은 그림판을
   쓰기 때문입니다 — 두 벌로 두면 한쪽만 고치는 사고가 납니다. */

async function openFlagShelf(){
  await loadCities();
  /* ⚠ `c.cc` — 속령은 모국으로 셉니다(cities.js·db/076). 홍콩을 다녀오면
     중국 깃발이 켜집니다. 전에는 `c.country` 라 홍콩·마카오·괌·사이판·
     타히티가 **어느 깃발도 못 켰습니다**(UN 195 에 없는 코드라서). */
  const 갔다 = new Set((cities || []).filter(c => visited.has(c.id))
                       .map(c => c.cc).filter(Boolean));
  const 센것 = UN_CODES.filter(c => 갔다.has(c)).length;
  /* 그림판을 먼저 싣습니다. 실패하면 예전처럼 이모지로 갑니다. */
  const 그림 = await flagSprite();
  const 기ok = flagOk();
  $('shelfcount').textContent =
    `${센것}개국 · ${(센것 / UN_TOTAL * 100).toFixed(1)}%`;
  /* ⚠ 제목(「나라 깃발」)은 안 답니다(b641, 사용자 결정). 깃발 195개가
     깔린 화면에서 그 이름은 아무것도 더 말해주지 않습니다 — 들어온
     사람은 이미 무엇을 눌렀는지 압니다. 오른쪽 「27개국 · 13.8%」만 남깁니다.
     ⚠ `openShelf` 가 위에서 제목을 이미 넣었으므로 여기서 지웁니다. */
  $('shelfhead').textContent = '';
  $('shelflist').classList.add('flagwall');
  /* ⚠⚠ **깃발을 못 그리는 기기에는 표를 답니다(b619).** CSS 에 `nofl`
     규칙을 써 놓고 클래스를 안 달아서, 코드 두 글자가 26px 로 커다랗게
     깔렸습니다 — 칸을 넘치고 읽기도 나빴습니다.
     **규칙을 쓰면 그 클래스를 다는 자리도 같이 만들어야 합니다.** */
  $('shelflist').classList.toggle('nofl', !기ok);
  /* ⚠ **대륙으로 안 나눕니다(b620, 사용자 결정).** 처음에 대륙마다 머리글과
       몫(유럽 19/44)을 달았는데 「그냥 한방에 다 넣어」 — 맞습니다.
       머리글 여섯이 들어가면 벽이 여섯 토막으로 잘려서, 이 화면의 값인
       **「한 판을 보는 것」**이 사라집니다. 대륙별 수는 홈 캐러셀이 이미
       말하고 있어서 여기서 또 말할 일도 아닙니다.
     ⚠ 순서는 **코드 차례**입니다. `UN_CODES` 는 대륙 순서라 그대로 깔면
       한 판이어도 대륙 덩어리로 보입니다 — 베낀 것이 아니라 «세계 전부»로
       보이려면 섞여 있어야 합니다. 원본은 안 건드리고 사본을 늘어놓습니다
       (`UN_CODES` 의 순서를 여기서 바꾸면 세는 쪽이 같이 흔들립니다). */
  $('shelflist').classList.toggle('nofl', !그림 && !기ok);
  $('shelflist').innerHTML =
    `<div class="fgrid">${[...UN_CODES].sort().map(코드 => {
      const 켬 = 갔다.has(코드) ? ' on' : '';
      const 이름 = esc(countryName[코드] || 코드);
      /* 그림판이 있으면 <use> 하나로 부릅니다. `#f-kr` 처럼 나라 코드가
         곧 이름표입니다(tools/flagsprite.pl 이 그렇게 굽습니다). */
      /* ⚠ `data-cc` 는 **누르면 이름을 띄우기 위한 것**입니다(b660, 사용자
         요청: 「깃발 누르면 어떤 나라인지 알 수 있게 이름 뜨는거도
         할 수 있어?」). `aria-label` 로는 손가락으로 못 읽습니다 —
         그것은 화면 낭독기용입니다. */
      return 그림
        ? `<svg class="fg${켬}" data-cc="${코드}" aria-label="${이름}"><use href="#f-${
             코드.toLowerCase()}"/></svg>`
        : `<span class="fg${켬}" data-cc="${코드}" title="${이름}">${
             기ok ? flagOf(코드) : esc(코드)}</span>`;
    }).join('')}</div>` +
    /* CC BY 4.0 — 지우면 라이선스 위반입니다. */
    (그림 ? `<div class="fgcredit">국기 그림 Twemoji · CC BY 4.0</div>` : '');

  /* ── 누르면 나라 이름 (b660, 사용자 요청) ─────────────────────────
     ⚠ **이름을 넣을 자리는 이미 비어 있습니다.** b641 에 「나라 깃발」
       이라는 제목을 걷었습니다(깃발 195개가 깔린 화면에서 그 이름은
       아무것도 더 말해주지 않아서). 그 빈 자리에 «누른 나라»를 적습니다 —
       줄이 안 늘고, 눈이 이미 가는 자리입니다.
     ⚠ 안 가본 나라에는 「· 아직」을 붙입니다. 이름만 띄우면 회색 깃발을
       누른 사람이 「내가 갔었나?」 하고 헷갈립니다.
     ⚠ 처리기는 **격자에** 답니다. `#shelflist` 에는 이미 처리기가 둘
       걸려 있고(별점·도시 열기), 거기 또 얹으면 갈래가 셋이 됩니다.
       격자는 그릴 때마다 새로 만들어지므로 겹쳐 붙을 일도 없습니다. */
  {
    const 격자 = $('shelflist').querySelector('.fgrid');
    격자?.addEventListener('click', e => {
      const 칸 = e.target.closest('.fg');
      if (!칸) return;
      const 코드 = 칸.dataset.cc;
      if (!코드) return;
      격자.querySelectorAll('.fg.tapped').forEach(x => x.classList.remove('tapped'));
      칸.classList.add('tapped');
      /* ⚠ 「· 아직」을 붙이지 «않습니다»(b662, 사용자: 「안간 곳 굳이
         아직이라고 적지말고 나라만 알려줘」). 갔는지 안 갔는지는 **칸의
         색이 이미 말하고 있습니다** — 회색이면 안 간 곳입니다. 같은 것을
         글자로 또 적으면 새로 알려 주는 것 없이 제목만 길어집니다.
         여기서 답할 것은 «어느 나라인가» 하나입니다. */
      $('shelfhead').textContent = countryName[코드] || 코드;
    });
  }

  /* ── 공유 (b649, 사용자 요청) ────────────────────────────────────
     ⚠ **세는 자료는 이 화면이 쓰는 것 그대로**입니다(`visited`). 카드가
       제 나름대로 다시 세면 벽에는 27개국인데 카드에는 28개국이 나옵니다.
     ⚠ `발자국스펙` 은 **도시 목록**을 받습니다(나라가 아니라). 나라 수는
       거기서 도시의 country 로 셉니다 — 그래야 「가장 많이 간 곳」도
       같이 나옵니다. */
  $('shelfshare').classList.remove('hide');
  $('shelfshare').onclick = () =>
    shareCard(발자국스펙((cities || []).filter(c => visited.has(c.id))),
              'keyro-발자국');
}

async function openBadgeShelf(){
  const { data, error } = await sb.rpc('my_badges');
  if (error) return fail(error, 'trip');
  const list = data || [];
  const got = list.filter(b => b.earned_at);
  $('shelfcount').textContent = `${got.length} / ${list.length}`;

  /* 지금 내 숫자를 맨 위에 한 줄로 적습니다. 이게 없으면 "왜 이 배지가
     안 들어오지"를 알 길이 없습니다 — 실제로 국가 27인데 배지가 안 켜지는
     일이 있었고, 그때 어디가 틀렸는지 볼 자리가 없었습니다.
     갈래마다 재는 것이 하나씩이라 배지 목록에서 그대로 뽑아 씁니다. */
  /* 갈래의 **마지막** 배지 값을 씁니다. '여행'만 첫 칸이 여행 횟수고
     나머지가 일수라, 첫 칸을 쓰면 "여행 3일"처럼 엉뚱하게 나옵니다. */
  const now = {};
  for (const b of list) now[b.cat] = b.have;
  const line = Object.entries(now)
    .map(([c, v]) => `${c} ${v}${{ '평가':'곳', '다녀온 곳':'개국',
                                   '여행':'일', '후기':'개', '여행 후기':'개' }[c] || ''}`)
    .join(' · ');

  /* 갈래끼리 묶습니다. 스물일곱 개를 한 줄로 늘어놓으면 훑을 수가 없습니다. */
  const cats = [];
  for (const b of list){
    const last = cats[cats.length - 1];
    if (last && last.cat === b.cat) last.items.push(b);
    else cats.push({ cat: b.cat, items: [b] });
  }
  $('shelflist').innerHTML = `<div class="memo bdnow">${esc(line)}</div>` +
    cats.map(g => {
    const n = g.items.filter(b => b.earned_at).length;
    return `<div class="daysep">${esc(g.cat)}
      <span class="dstat">${n}/${g.items.length}</span></div>
      ${/* 이름과 설명을 따로 뒀더니 둘이 같은 말이었습니다 — '첫 해외'와
            '다른 나라에 한 곳 다녀왔어요'. 조건 그 자체를 이름으로 씁니다.
            한 줄이면 무슨 배지인지 한 번에 읽힙니다. 받았는지는 색으로 압니다. */''}
      <div class="bdgrid">${g.items.map(b => `
        <div class="bdg${b.earned_at ? ' on' : ''}"
             title="${esc(b.earned_at ? String(b.earned_at).slice(0,10) + ' 받음'
                                      : b.have + ' / ' + b.need)}">
          <span class="i">${esc(b.icon)}</span>
          <b>${esc(b.name)}</b>
        </div>`).join('')}</div>`;
  }).join('');
}

export async function openShelf(kind){
  shelfKind = kind;
  /* ⚠⚠ **뒤로 단추가 늘 「← 프로필」이었습니다(b697, 실제로 눌러보고 찾음).**
     보관함 타일(다녀온 도시·가고 싶은 곳·깃발·한줄평·배지)은 b542 에
     **기록 탭으로 옮겨졌는데** 단추 글자는 마크업에 박힌 채였습니다.
     기록 탭에서 열고 뒤로 단추를 보면 「프로필」이라고 적혀 있습니다.
     ⚠ 이 앱은 이미 `backLabel(tab)` 하나로 이것을 맞춥니다 — 지도·일기·
       성향은 쓰는데 **보관함만 안 쓰고 있었습니다.** */
  {
    const b = $('shelfback');
    if (b) b.textContent = backLabel(ctx.appTab?.());
  }
  $('profpane').classList.add('hide');
  $('mappane').classList.add('hide');
  $('shelfpane').classList.remove('hide');
  coverDeck(true);
  toTop($('shelfpane'));   /* 프로필 안이라 문서가 아니라 setview 를 올립니다(b471) */
  if (history.state?.t2 !== 'shelf') history.pushState({ t2:'shelf' }, '');
  $('shelfhead').textContent = SHELF[kind] || '보관함';
  /* ⚠⚠ **먼저 비웁니다(b614, 사용자 신고).** ⚠⚠
   * 「내가 매긴 곳이나 한줄평 남긴 곳에 들어가면 처음에 다른 화면이 아주
   *  잠깐 보이고 넘어간다」 — 맞습니다. 이 함수는 판을 **먼저 보여주고**
   *  그 다음에 `loadCities()` · `loadRateData()` 를 «기다립니다».
   *  그 사이에 화면에는 **직전에 보던 보관함의 목록**이 그대로 남아
   *  있었습니다. 제목만 새것이라 더 어긋나 보입니다.
   * ⚠ 개수도 같이 지웁니다 — 제목은 「한줄평 남긴 곳」인데 개수가 「74곳」
   *   이면 그 한순간이 제일 크게 틀려 보입니다.
   * ⚠ 벽(`wall`)도 여기서 벗깁니다. 아래에서도 벗기지만, 그건 이 아래
   *   `await` 다음이라 늦습니다 — 그 사이에 옛 벽이 그대로 보입니다. */
  $('shelfcount').textContent = '';
  $('shelflist').classList.remove('wall');
  $('shelflist').classList.remove('flagwall');
  /* ⚠ 공유 단추도 **맨 위에서 끕니다**(b649) — 깃발 벽만 켜는 것이라,
     안 끄면 깃발을 보고 배지로 넘어갔을 때 단추가 그대로 남습니다.
     아래 갈래마다 일찍 나가는 길이 있어서 켜는 쪽에서는 못 끕니다
     (b607 에 벽으로 똑같이 겪었습니다). */
  $('shelfshare').classList.add('hide');
  $('shelflist').innerHTML =
    '<div class="empty"><span class="load">보관함을 여는 중…</span></div>';
  /* 별점이 없는 보관함에서는 정렬 칸을 숨깁니다. 거를 것이 없습니다.
     넘어올 때 걸려 있던 조건도 풀어둡니다 — 다른 보관함의 조건이 남아 있으면
     왜 목록이 짧은지 알 수가 없습니다. */
  $('shelffilter').classList.toggle('hide', !HAS_STARS(kind));
  /* ⚠ 별점이 없는 보관함으로 넘어가면 **정렬도 거르개도 풀어둡니다.**
     남겨두면 다음에 별점 보관함을 열었을 때 왜 목록이 짧은지 알 수가
     없습니다(b649 에 공유 단추로 겪은 것과 같은 부류). */
  if (!HAS_STARS(kind)){ shelfSort = 'new'; shelfStar = 'all'; }
  /* ⚠ 없앤 정렬이 걸린 채 남을 수 있습니다(b675 에 「유명한 순」을
     걷었습니다). 모르는 값이면 기본으로 되돌립니다 — 안 그러면
     `by` 가 «아무것도 안 하는 함수»라 이름순처럼 보입니다. */
  if (!SORT_KEYS.includes(shelfSort)) shelfSort = 'new';

  /* ⚠⚠ **벽은 여기서 먼저 벗깁니다(b607).** 아래 세 갈래(맛집·관광지·
     후기·배지)는 여기서 «일찍 나가»서, 벽을 씌우고 벗기는 줄을 지나가지
     않습니다. 그러면 **앞서 본 목록의 벽이 그대로 남아** 배지 화면이
     두 칸 격자로 찢어집니다(도시 벽 → 배지 순으로 열면 재현됩니다).
     ⚠ **일찍 나가는 길이 있는 함수에서 «켜기»만 끝에 두면 안 됩니다.**
       끄는 것은 맨 위, 켜는 것은 정해진 뒤 — 이 순서라야 어느 길로
       나가도 남는 것이 없습니다. */
  $('shelflist').classList.remove('wall');
  $('shelflist').classList.remove('flagwall');
  if (kind === 'flag')   return openFlagShelf();
  if (kind === 'place' || kind === 'spot') return openPlaceShelf(kind);
  if (kind === 'review') return openReviewShelf();
  if (kind === 'badge')  return openBadgeShelf();

  await loadCities();
  /* 전에는 여기서 오류를 안 봤습니다. 실패하면 평가가 하나도 없는 것처럼
     보이고, 공유 자료라 평가 화면까지 같이 비었습니다. 보고 있는 자리에 적습니다. */
  const rd = await loadRateData();
  if (rd.error){
    $('shelfcount').textContent = '';
    $('shelflist').innerHTML =
      `<div class="empty">평가를 못 받아왔어요.<br>
         <span class="memo">${esc(rd.error.message || rd.error)}</span></div>`;
    return;
  }

  const all = (cities || []).filter(c => {
    const r = myRates[c.id];
    if (kind === 'been')    return visited.has(c.id);
    /* ⚠ 별점을 매긴(다녀온) 곳은 뺍니다(b799, 사용자: 「목록에서 빼기」) — 분석 탭 「다음 여행」·
       보관함 숫자(my_footprint, db/107)와 같은 셈. ♡ 는 그대로라 별점을 지우면 다시 나옵니다. */
    if (kind === 'want')    return !!r?.want && r?.stars == null;
    if (kind === 'mine')    return r?.stars != null;
    if (kind === 'comment') return !!r?.comment;
    return false;
  }).map(c => ({ ...c, stars: myRates[c.id]?.stars ?? null,
                        at: myRates[c.id]?.updated_at || '' }));

  /* ⚠ **세는 것은 «거르기 전»입니다.** 시트의 개수는 「★4 를 고르면 몇
     곳이 남나」를 말해야 하는데, 거른 뒤에 세면 고른 칸만 숫자가 남고
     나머지가 전부 0 이 됩니다. */
  거르개칸채우기(all);
  const list = HAS_STARS(kind) ? shelfArrange(shelfSift(all))
    : [...all].sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  /* **개수만 있고 평균이 없었습니다.** 74곳을 매겼다는 것보다 "평균 몇 점을
     주는 사람인가"가 자기 기록을 볼 때 더 궁금합니다 — 후하게 주는 편인지
     짜게 주는 편인지가 거기서 드러납니다.
     ⚠ **별점이 있는 목록에만 답니다.** '가보고 싶은 곳'은 별점이 없어서
       평균이 NaN 이 되거나 0점으로 보입니다. */
  /* ⚠ **한줄평 수도 같이 답니다(b615, 사용자 요청).** 「평균 별점 옆에
       한줄평 몇 개 있는지 넣어주면 될듯」.
     별을 몇 개 줬는지 옆에 말 몇 개를 남겼는지가 붙으면 「별은 많이
     줬는데 말은 거의 안 남겼구나」가 한 줄에서 읽힙니다.
     ⚠ **이 목록 안에서** 셉니다. 옆의 「곳」·「평균」이 둘 다 이 목록의
       것이라, 한줄평만 내 기록 전체를 세면 셋이 서로 다른 것을 말합니다.
     ⚠ 빈 한줄평은 안 셉니다 — 지우면 빈 글자로 남는 자리가 있어서,
       있는지만 보면 지운 것까지 셉니다.
     ⚠ **0 이면 아예 안 적습니다.** 「한줄평 0」은 알려주는 것이 없고
       줄만 길어집니다. 남긴 것이 있을 때만 자랑할 자리입니다. */
  {
    const st = list.map(c => myRates[c.id]?.stars).filter(s => s != null);
    const avg = st.length ? (st.reduce((a, b) => a + b, 0) / st.length) : null;
    const 한줄 = list.filter(c => (myRates[c.id]?.comment || '').trim()).length;
    const 꼬리 = 한줄 ? ` · 한줄평 ${한줄}` : '';
    $('shelfcount').textContent =
      !list.length ? '' :
      (HAS_STARS(kind) && avg != null)
        ? `${list.length}곳 · 평균 ★${avg.toFixed(1)}${꼬리}`
        : `${list.length}곳${꼬리}`;
  }
  /* ── 도시 벽(b604, 5단계) ─────────────────────────────────────────
   * 사진이 있는 보관함 셋은 **줄이 아니라 벽**입니다 — 두 칸 격자에
   * 엽서를 붙여 놓은 모양. 「내가 어디를 갔었나」는 이름을 읽는 것보다
   * **사진을 훑는 쪽**이 훨씬 빠릅니다.
   *
   * ⚠⚠ **마크업은 그대로 두고 겉모양만 CSS 로 바꿉니다.** 별점 누르기
   *   (`.stars[data-city]`) · ♡(`data-want`) · 도시 열기(`data-cityopen`)
   *   에다 `closest('.rrow')` 까지 전부 **속성·클래스 위임**이라,
   *   `.rrow` 를 그대로 두면 손잡이를 하나도 다시 안 이어도 됩니다.
   *   (b513 주석의 경고가 이 뜻이었습니다 — 새로 짜면 셋 다 다시 이어야
   *    한다. 그래서 새로 짜지 않았습니다.)
   * ⚠ 한줄평 목록은 벽으로 안 만듭니다 — 거기선 **문장이 주인공**이라
   *   사진을 키우면 정작 읽을 것이 밀립니다(b513·b514 에서 정한 것).
   * ⚠ 맛집·관광지·후기·배지는 애초에 도시 사진이 없습니다.
   * ⚠ 비었을 때는 벽을 안 씌웁니다 — 안내문 한 줄이 격자 반 칸에
   *   갇혀 가운데가 아니라 왼쪽에 붙습니다. */
  $('shelflist').classList.toggle(
    'wall', list.length > 0 && (kind === 'mine' || kind === 'been' || kind === 'want'));
  /* (벗기는 것은 이 함수 맨 위에서 이미 했습니다 — 위 주석 참고.) */
  $('shelflist').innerHTML = list.length
    ? list.map(c => {
        const r = myRates[c.id] || {};
        const 줄 = `<div class="rrow" data-cityopen="${esc(c.id)}">
          ${c.image_url
            ? `<img class="thumb" src="${esc(c.image_url)}" alt="" loading="lazy">`
            : `<span class="thumb ph">${esc(c.name.slice(0,1))}</span>`}
          ${/* ⚠⚠ **여기에 도장을 찍었다가 걷었습니다(b604 → b605).**
               재보니 **74곳 중 74곳에 찍혔습니다.** `visited` 는 「별점을
               매긴 곳」을 포함하므로(rate.js `applyRate`), 「내가 매긴 곳」
               에서는 예외 없이 전부 다녀온 곳입니다. 「다녀온 도시」도
               정의상 전부입니다.
               **모두에게 붙는 표는 아무것도 안 알려줍니다.** 나라 코드도
               바로 밑줄에 나라 이름으로 이미 적혀 있습니다.
               도장은 **도시 화면 한 곳**에만 둡니다 — 거기서는 다녀온
               곳과 아닌 곳이 갈리고, 그래야 찍힌 뜻이 있습니다. */''}
          <div class="t"><b>${esc(c.name)}</b>
            <span class="memo">${esc(cityCountry(c))}${
              avgTail(cityStat[c.id], r)}</span></div>
          <span class="stars" data-city="${esc(c.id)}">${starHtml(r.stars)}</span>
          <button class="ghost want${r.want ? ' on' : ''}" data-want="${esc(c.id)}" aria-label="가보고 싶어요">♡</button>
        </div>`;
        /* ── 한줄평 목록은 문장이 주인공입니다(b513) ─────────────────
           사용자 지적: 「한줄평이 제대로 보이지도 않는다」.
           맞습니다 — 화면 이름이 「한줄평 남긴 곳」인데, 정작 그 문장이
           줄 밑에 **제일 작고 제일 흐린 글씨**로 딸려 있었습니다.
           도시 이름 17px/진하게, 나라 13px, 그리고 한줄평이 13px/48% —
           읽는 순서가 정확히 거꾸로였습니다.

           문장에 잉크를 다 주고 크기를 올립니다. 자리는 **줄 밑**입니다 —
           b513 에 위로 올려봤다가 b514 에 내렸습니다(사용자 결정). 어느
           도시 이야기인지 먼저 보고 그 사람 말을 읽는 순서입니다. 줄 사이는 실선으로
           끊습니다 — 한 덩이가 한 사람의 한마디입니다.

           ⚠ 한줄평 탭에서만입니다. 내 평가 목록에서는 별점만 봅니다 —
             어떤 줄만 두 줄이 되면 목록이 들쭉날쭉해집니다.
           ⚠ 안쪽은 `.rrow` 를 **그대로 씁니다.** 별점 누르기(.stars
             [data-city])·♡(data-want)·도시 열기(data-cityopen)가 전부
             그 줄에 걸려 있어서, 새로 짜면 셋 다 다시 이어야 합니다. */
        return kind === 'comment' && r.comment
          ? `<div class="cmt" data-cityopen="${esc(c.id)}">
               ${줄}<div class="cq">${esc(r.comment)}</div></div>`
          : 줄;
      }).join('')
    : shelfEmpty();
}

export function closeShelf(fromPop){
  if (!fromPop && history.state?.t2 === 'shelf'){ history.back(); return; }
  /* ⚠ 시트를 «먼저» 닫습니다(b673). 안 닫으면 보관함이 사라진 자리에
     시트만 떠 있게 됩니다 — 그 아래는 프로필인데 시트는 보관함 것입니다.
     기록은 이미 되감긴 참이라 `true` 로 부릅니다. */
  거르개닫기(true);
  $('shelfpane').classList.add('hide');
  $('profpane').classList.remove('hide');
  coverDeck(false);
  ctx.loadFootprint();                  /* 여기서 매긴 것이 숫자에 바로 반영되게 */
}
$('shelfback').addEventListener('click', () => closeShelf());

/* 지운 줄을 빼는 자리. 곧바로 없애면 눌리자마자 사라져서 뭘 지웠는지 못 봅니다.
   0.7초 두었다가 밀어냅니다 — 지웠다는 것은 보이고, 기다린다는 느낌은 안 듭니다. */
function dropRow(row){
  if (!row) return;
  setTimeout(() => {
    row.classList.add('gone');
    setTimeout(() => {
      row.remove();
      const n = $('shelflist').querySelectorAll('.rrow').length;
      $('shelfcount').textContent = n ? `${n}곳` : '';
      if (!n) $('shelflist').innerHTML = shelfEmpty();
    }, 260);
  }, 700);
}

/* 여기서도 별점을 고칠 수 있습니다. 기록 탭과 같은 방식입니다. */
$('shelflist').addEventListener('click', async e => {
  /* 별점을 지우는 길. 별을 0으로 만들 수는 없어서 따로 둡니다.
     지우면 목록에서 빠지고, 다시 남기고 싶으면 여행 탭에서 그 일정에 별을 답니다. */
  const del = e.target.closest('[data-pdel]');
  if (del){
    if (del.dataset.armed !== '1'){ arm(del, '정말 지울까요?'); return; }
    const r = await sb.from('plan_ratings').delete()
      .eq('user_id', ctx.me().id).eq('plan_id', del.dataset.pdel).select('plan_id');
    if (r.error) return fail(r.error, 'trip');
    ctx.loadFootprint();
    return openShelf(shelfKind);
  }

  const st = e.target.closest('.st');
  /* 식당·카페는 일정 줄에 답니다. 도시 별점과 저장하는 표가 다릅니다. */
  const pw = st?.closest('.stars[data-plan]');
  if (pw){
    const v = starValue(st, e.clientX);   /* 반칸 규칙은 stars.js 한 곳(b491) */
    const cur = [...pw.querySelectorAll('.st i')]
      .reduce((s, i) => s + parseFloat(i.style.width) / 100, 0);
    /* 0(끌어서 맨 왼쪽)도 지우기입니다 — b494, stars.js 의 끌린값 참고. */
    const next = (v === 0 || Math.abs(cur - v) < .01) ? null : v;
    /* 같은 점수를 다시 누르면 아예 지웁니다. 별점 없는 줄을 남겨두면
       "지웠는데 그대로 있다"가 됩니다. */
    if (next == null){
      const r = await sb.from('plan_ratings').delete()
        .eq('user_id', ctx.me().id).eq('plan_id', pw.dataset.plan).select('plan_id');
      if (r.error) return fail(r.error, 'trip');
      ctx.loadFootprint();
      return openShelf(shelfKind);
    }
    paintStars(pw, next, true);
    const r = await sb.from('plan_ratings')
      .upsert({ user_id: ctx.me().id, plan_id: pw.dataset.plan, stars: next },
              { onConflict: 'user_id,plan_id' }).select('plan_id');
    if (r.error) return fail(r.error, 'trip');
    ctx.loadFootprint();
    return;
  }
  if (st){
    const wrap = st.closest('.stars'), cityId = wrap.dataset.city;
    const row = st.closest('.rrow');
    const v = starValue(st, e.clientX);   /* 반칸 규칙은 stars.js 한 곳(b491) */
    const next = Number(myRates[cityId]?.stars) === v ? null : v;
    paintStars(wrap, next, true);
    markRated(row, next);
    await saveRate(cityId, { stars: next }, true);

    /* 지웠으면 목록에서도 빼야 합니다. 저장은 되는데 줄이 그대로 남아 있어서
       "안 지워진다"로 보였습니다 — 새로고침해야 사라졌습니다.
       여기는 "내 평가"이므로 별점이 없으면 있을 자리가 아닙니다.
       다시 그리지 않고 그 줄만 빼는 이유는, 다시 그리면 화면이 맨 위로 튀기 때문입니다. */
    if (next == null && shelfKind === 'mine') dropRow(row);
    ctx.loadFootprint();                 /* 프로필 숫자도 같이 맞춥니다 */
    return;
  }
  const w = e.target.closest('button[data-want]');
  if (w){
    const on = !myRates[w.dataset.want]?.want;
    await saveRate(w.dataset.want, { want: on }, true);
    w.classList.toggle('on', on);
    /* 별점과 같은 이유입니다 — "가보고 싶은 곳"에서 하트를 끄면 그 줄도 빠져야 합니다. */
    if (!on && shelfKind === 'want') dropRow(w.closest('.rrow'));
    return;
  }
  const row = e.target.closest('[data-cityopen]');
  if (row) await openCity(row.dataset.cityopen);
});

/* AI 는 어디서든 한 번에 갑니다. 여행을 보고 있었으면 그 여행을 물어볼
   대상으로 미리 골라둡니다 — 들어가서 또 고르게 하면 안 씁니다. */
/* 여행 비서는 페이지를 옮기지 않고 보던 화면 위에 올라옵니다.
   일정을 보다가 물어보고 그 자리로 돌아가야 합니다. */
