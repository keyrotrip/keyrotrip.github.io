/* ── 여행 목록 — 다가오는 여행과 다녀온 여행 ─────────────────────────
 * '여행' 탭입니다. 카드로 늘어놓고, 각 카드에 사진을 채웁니다.
 *
 * **사진 고르는 규칙이 이 파일의 반입니다.** 전에는 `t.cities?.image_url`
 * 하나만 봤는데, 그건 여행에 직접 붙은 도시의 사진이라 **우리 목록에 없는
 * 곳으로 만든 여행은 늘 빈 칸**이었습니다. 지금은 구간의 도시까지 훑고,
 * 그래도 없으면 여행 이름에서 색을 뽑아 칠합니다(`heroTint`) —
 * 빈 회색 네모보다는 낫습니다.
 *
 * ── app.js 에서 떼어낸 스물일곱 번째 조각입니다(b351) ────────────────
 * app.js 만 아는 것은 셋 — 로그인한 사람, 여행 열기, 오류 남기기.
 * `tripFilter`(다가오는 것만 볼까 다녀온 것만 볼까)는 이 목록의 상태라
 * 같이 데려왔습니다. 거르개 단추는 app.js 에 남아 있어 `setTripFilter` 로
 * 넣습니다 — **밖에서 `=` 로 넣으면 import 한 값은 안 바뀝니다.**
 *
 * 층: dom.js · db.js · net.js · calc.js · cities.js · trip.js 와 이미
 *     떼어낸 rating.js · home.js · member.js 를 씁니다. */
import { $, esc, putHtml, dropHtml, emptyDo } from './dom.js?v=b827';
import { sb } from './db.js?v=b827';
import { fail, netTimeout, drawOffbar, cacheGet, cacheSet } from './net.js?v=b827';
import { todayYmd } from './calc.js?v=b827';
import { cities } from './cities.js?v=b827';
import { trip } from './trip.js?v=b827';
import { tripSub } from './rating.js?v=b827';
import { heroTint, openTripReport, reviewBar, heroHtml } from './home.js?v=b827';
import { ROLE_KO } from './member.js?v=b827';

let ctx = { me: () => null, openTrip: async () => {}, logError: () => {} };
export function setTripListCtx(o){ ctx = { ...ctx, ...o }; }

/* 다가오는 것만 볼까(`up`), 다녀온 것만 볼까(`past`).
   **app.js 의 상태 뭉치에 있던 것을 여기로 옮겼습니다(b351)** —
   이 목록 말고는 쓰는 곳이 없습니다. 거르개 단추는 app.js 에 남아 있어
   아래 설정자로 넣습니다. */
export let tripFilter = 'up';
export function setTripFilter(v){ tripFilter = v || 'up'; }

/* ── 여행 목록의 사진 ────────────────────────────────────────────────
 * 전에는 `t.cities?.image_url` **하나만** 봤습니다. 그건 여행에 직접 붙은
 * 도시(`trips.city_id`)의 사진이라, 우리 목록에 없는 곳으로 만든 여행은
 * ('삼척') 늘 비어서 색 칸에 첫 글자만 떴습니다.
 *
 * 고르는 순서는 `tripPhoto()` 와 **같습니다**(구간 도시 › 나라 대표).
 * 목적지 이름으로 찾는 단계는 뺐습니다 — 이름이 맞으면 애초에 `city_id` 가
 * 붙어 있어서 첫 줄에서 걸립니다.
 *
 * ⚠ **줄마다 부르지 않습니다.** `tripPhoto()` 는 여행 하나에 질의를 최대
 *   3번 합니다. 목록이 열 개면 서른 번입니다. 여기서는 빠진 것만 모아
 *   **두 번**에 끝냅니다(구간 한 번, 나라 대표 한 번).
 *
 * ⚠ 이 사진은 그 사람이 가는 곳이 아닐 수 있습니다 — 삼척 여행에 강릉
 *   사진이 걸립니다. 사진은 분위기고, 어디로 가는지는 **글자**가 말합니다.
 *   `tripPhoto()` 머리말에 같은 이야기를 적어뒀습니다. */
async function fillTripPhotos(rows){
  const need = (rows || []).filter(t => !t.cities?.image_url);
  if (!need.length) return;

  /* 큰 판(image_lg)도 같이 받습니다 — 맨 위 머리 카드는 폭 가득이라 그것을 씁니다(아래 `_photoLg`). */
  const lg = await netTimeout(sb.from('trip_legs')
    .select('trip_id,country,start_date,cities(image_url,image_lg)')
    .in('trip_id', need.map(t => t.id)).order('start_date'));

  const byTrip = {}, byTripLg = {}, legCountry = {};
  for (const l of (lg.data || [])){
    if (!byTrip[l.trip_id] && l.cities?.image_url){
      byTrip[l.trip_id] = l.cities.image_url;
      byTripLg[l.trip_id] = l.cities.image_lg || l.cities.image_url;
    }
    if (!legCountry[l.trip_id] && l.country)       legCountry[l.trip_id] = l.country;
  }

  /* 구간에서 못 찾은 것만 나라로 갑니다. 나라는 겹치므로 한 번에 묻습니다. */
  const rest = need.filter(t => !byTrip[t.id]);
  const countries = [...new Set(rest.map(t => legCountry[t.id] || t.country).filter(Boolean))];
  const rep = {}, repLg = {};
  if (countries.length){
    /* 같은 여행은 열 때마다 같은 사진이어야 합니다 — 다르면 "내 여행"으로
       안 읽힙니다. pop_rank › fame › 이름 순으로 **늘 같은 것**을 고릅니다. */
    const c = await netTimeout(sb.from('cities')
      .select('country,image_url,image_lg,pop_rank,fame,name')
      .in('country', countries).not('image_url', 'is', null)
      .order('pop_rank', { ascending:true, nullsFirst:false })
      .order('fame',     { ascending:true, nullsFirst:false })
      .order('name',     { ascending:true }));
    for (const row of (c.data || [])) if (!rep[row.country]){
      rep[row.country] = row.image_url;
      repLg[row.country] = row.image_lg || row.image_url;
    }
  }

  for (const t of need){
    const 나라 = legCountry[t.id] || t.country;
    t._photo   = byTrip[t.id]   || rep[나라]   || null;
    t._photoLg = byTripLg[t.id] || repLg[나라] || t._photo;
  }
}

/* ── 늦게 온 답은 버립니다(b799, GPT 리포트 P0-2) ─────────────────────────
 * ⚠⚠ 「다가오는 → 다녀온」을 누르면 **옛 머리 카드(후쿠오카 D-38)가 몇 초 남았습니다.**
 *   목록 · 사진 · 후기 띠를 차례로 기다리는 동안(최대 아홉 번) 아무것도 안 치웠기 때문입니다.
 *   더 나쁜 것: 기다린 «뒤에» `tripFilter` 를 다시 읽어서, 먼저 보낸 「다가오는」 답이 늦게
 *   오면 **「다녀온」 칸에 그려지고 오프라인 저장본(`trips:past`)에도 그 이름으로 담겼습니다.**
 * → ① 부르는 순간의 갈래(`갈래`)만 씁니다. ② 기다릴 때마다 차례를 봐서 늦은 답은 버립니다
 *   (people.js 의 `차례` 와 같은 수법). ③ 갈래가 바뀌면 옛 머리 카드·띠·목록을 곧바로 치우고
 *   「불러오는 중」을 답니다 — 같은 갈래를 다시 부를 때(탭 다시 누름·지운 뒤)는 안 치웁니다.
 *   깜빡일 이유가 없습니다. */
let 목록차례 = 0;
let 그린갈래 = null;      /* 지금 #trips 에 그려진 갈래 */

export async function loadTrips(){
  const 이번 = ++목록차례;
  const 갈래 = tripFilter;
  if (그린갈래 !== 갈래){
    $('triphero')?.remove(); $('tripsrv')?.remove();
    dropHtml('trips');
    $('trips').innerHTML = '<div class="empty"><span class="load">불러오는 중…</span></div>';
  }
  /* RLS 가 참여 중인 것만 내려줍니다. 만든 사람이 owner 로 자동 등록되지
     않으면 방금 만든 여행조차 여기 안 나옵니다. */
  const today = todayYmd();
  let q = sb.from('trips')
    .select('id,title,destination,start_date,end_date,currency,timezone,' +
            /* `country` 는 사진 대체에 씁니다(아래 fillTripPhotos). */
    'transit_factor,city_id,country,cities(image_url,image_lg),' +
            'trip_members(user_id,role),trip_reviews(user_id,stars)');
  /* 날짜가 지나면 저절로 "다녀온"으로 넘어갑니다 — 손으로 옮길 일이 없습니다. */
  if (갈래 === 'past')
    q = q.lt('end_date', today)
         .order('start_date', { ascending:false });
  else
    q = q.gte('end_date', today)
         .order('start_date', { ascending:true });
  let { data, error } = await netTimeout(q);
  if (이번 !== 목록차례) return;          /* 그사이 다른 갈래(나 같은 갈래)를 또 불렀습니다 */

  /* 못 받아왔으면 지난번 목록을 씁니다. 여행 목록이 안 나오면 여행 중에
     일정으로 들어갈 길 자체가 없어집니다. */
  const ck = 'trips:' + 갈래;
  if (error){
    const old = cacheGet(ck);
    /* ⚠ 옛 머리 카드·띠도 치웁니다(b799) — 안 치우면 「불러오지 못했어요」 위에 앞 갈래의
       「D-38」이 계속 남았습니다. */
    if (!old){ $('triphero')?.remove(); $('tripsrv')?.remove();
               dropHtml('trips'); $('trips').innerHTML = '<div class="empty">불러오지 못했어요</div>';
               그린갈래 = null; return fail(error); }
    data = old; error = null; drawOffbar();
  } else {
    await fillTripPhotos(data);
    if (이번 !== 목록차례) return;
    cacheSet(ck, data);   /* 사진까지 담아둡니다 — 비행기모드에서도 같은 줄이 나옵니다 */
    /* 목록에 있는 여행은 **열어본 적 없어도** 비행기모드에서 열려야 합니다.
       한 줄씩 미리 담아둡니다 — 목록을 받을 때 이미 필요한 값이 다 왔습니다.
       이걸 안 하면 "열어본 적 있는 여행만 열림"이 되는데,
       그건 정작 여행 가서 처음 여는 순간에 안 열린다는 뜻입니다. */
    for (const t of data){
      const k = 'trip:' + t.id;
      if (!cacheGet(k)) cacheSet(k, { ...t, home_currency: t.currency || 'KRW' });
    }
  }

  /* ── 다녀온 여행 평가 재촉(b398) ─────────────────────────────────────
     **홈에 있던 띠를 여기로 옮겼습니다.** 홈은 도시 평가가 주인공이 됐고
     (home.js 의 buildHome 머리말), 이 띠는 **특정 여행에 묶인 것**이라 여행
     탭이 제 자리입니다. 띠를 만드는 것은 home.js 가 합니다(`reviewBar`) —
     평가 화면이 거기 있어서 입구만 가져옵니다.  */
  /* ⚠⚠ **「다녀온」 갈래에서만, 그리고 맨 위입니다(b446).** ⚠⚠
     b398 부터 「다가오는」에 달려 있었는데 자리가 틀렸습니다 —
     **다녀온 여행을 평가해달라는 말**을 앞으로 갈 여행 목록에 두고
     있었습니다. b435 에서 목록 아래로 내려 맥락 충돌은 줄였지만,
     애초에 **다른 갈래에 있어야 할 것**이었습니다.
     「다녀온」을 열면 평가할 것이 제일 먼저 보입니다.
     ⚠ 여전히 `#trips` **밖**입니다 — 안에 넣으면 putHtml 이 목록을
       갈아끼울 때 같이 지워집니다.
     ⚠ **받아온 뒤에 지웁니다**(b435). 순서를 되돌리면 탭을 옮길 때마다
       띠가 사라졌다 나타나며 화면이 깜빡입니다. */
  if (갈래 === 'past'){
    const bar = await reviewBar();
    if (이번 !== 목록차례) return;
    $('tripsrv')?.remove();
    if (bar){ bar.id = 'tripsrv'; $('trips').before(bar); }
  } else {
    $('tripsrv')?.remove();
  }

  /* ── 다음 여행 히어로(b402) ──────────────────────────────────────────
     **홈 맨 위에 있던 사진 히어로를 여기로 옮겼습니다.** 홈은 평가가
     주인공이 됐고(home.js 머리말), 여행 사진 히어로는 여행 탭이 제 자리
     입니다. 그리는 것은 home.js 의 `heroHtml` 을 그대로 씁니다 — 두 벌로
     만들면 한쪽만 고쳐집니다.

     ⚠ **히어로에 건 여행은 목록에서 뺍니다**(아래 `목록`). 처음에는 "말하는
       것이 다르니 둘 다 둬도 된다"고 했는데 눈으로 보니 중복만 보였습니다.
     ⚠ **'다녀온' 목록에서는 안 답니다.** 지난 여행에 D-day 는 뜻이 없습니다.
     ⚠ **`#trips` 밖, 평가 재촉 띠보다 위에 답니다.** 안에 넣으면 `putHtml`
       이 목록을 갈아끼울 때 같이 지워집니다.
     ⚠ 사진은 `fillTripPhotos` 가 이미 채워둔 `_photo` 를 씁니다 — 여기서
       또 받아오면 목록을 그릴 때마다 질의가 늡니다. */
  $('triphero')?.remove();
  그린갈래 = 갈래;          /* 여기부터 이 갈래를 그립니다(b799) */
  /* ── 히어로에 건 여행도 **목록에 그대로 둡니다**(b436) ────────────────
     b410 에서 뺐다가 b436 에서 되돌렸습니다. 그 사이의 판단을 남겨 둡니다 —
       · b410: "바로 위아래로 같은 도쿄가 두 번" 이라 중복만 보인다며 뺌.
       · b436: **뺐더니 그 여행은 목록에서 할 수 있는 일을 다 잃었습니다.**
         수정·삭제·「만든 사람」이 전부 목록 줄에만 있는데, 제일 가까운
         여행이 거기 없으니 고치려면 열고 들어가야 했습니다.
     그래서 **히어로의 일을 줄이는 쪽**으로 정리했습니다 — 히어로는
     「다음은 도쿄, 며칠 남았다」만 알리는 **꾸밈**이고, 할 일은 목록이
     맡습니다. 중복은 알고 두는 것입니다(사용자 결정).
     ⚠ 되돌리려거든 위 두 줄을 먼저 읽으십시오. 한 번 갔다 온 길입니다. */
  const 목록 = data;
  if (갈래 !== 'past' && data.length){
    const t = data[0];
    const dd = Math.round((new Date(t.start_date) - new Date(today)) / 864e5);
    const days = Math.round((new Date(t.end_date) - new Date(t.start_date)) / 864e5) + 1;
    const badge = dd > 0 ? `D-${dd}` : dd === 0 ? 'D-DAY'
                : `Day ${Math.round((new Date(today) - new Date(t.start_date)) / 864e5) + 1}`;
    const wrap = document.createElement('div');
    wrap.id = 'triphero';
    /* 머리 카드는 폭 가득이라 큰 판(image_lg)을 씁니다. 목록 줄의 작은 네모(아래)는 예전 image_url 그대로. */
    wrap.innerHTML = heroHtml(t.cities?.image_lg || t.cities?.image_url || t._photoLg || t._photo || '',
                              badge, t.title, tripSub(t, days), '');
    /* heroHtml 이 안쪽에 `id="hero"` 를 답니다. **홈의 히어로와 같은 id 라
       한 화면에 둘이 뜨면 안 됩니다** — 탭이 갈려 있어 지금은 괜찮지만,
       여기서 id 로 찾지 말고 이 상자를 통해 찾습니다. */
    wrap.firstElementChild?.removeAttribute('id');
    wrap.onclick = () => ctx.openTrip(t.id);
    /* ⚠ **누를 수 있다는 표시 ›(b805, 사용자 결정 — 밖에서 받은 리포트 P1-3).** 카드 전체가 원래
       눌렸는데(바로 위 onclick) 표시가 없어서 리포트가 「안 눌린다」고 적었습니다. 목록 줄의 › 와
       같은 말입니다. 홈 히어로(heroHtml)는 같이 쓰는 것이라 거기엔 안 넣고 여기서만 붙입니다. */
    wrap.querySelector('.hrow')?.insertAdjacentHTML('beforeend',
      '<span class="hgo" aria-hidden="true">›</span>');
    /* ⚠ **`#trips` 앞입니다(b435).** 전에는 「띠가 있으면 띠 앞」이었는데
       띠가 목록 **아래**로 내려갔으므로 이제 기준이 목록입니다. */
    $('trips').before(wrap);
  }

  if (!data.length){
    dropHtml('trips'); $('trips').innerHTML =
      /* 지난 여행은 만들 수 있는 것이 아니라 단추가 없습니다. 앞으로 갈
         여행은 **글로 '새 여행을 눌러보세요' 라고 가리키고 있었습니다** —
         가리키는 대신 그 단추를 여기 답니다. */
      갈래 === 'past'
        ? emptyDo('아직 지난 여행이 없어요.', null, null,
                  '여행이 끝나면 여기로 옮겨져요.')
        : emptyDo('어디로 떠나볼까요?', '새 여행 만들기', 'newtripbtn',
                  '날짜와 도시만 정하면 나머지는 채워가면 돼요.');
    return;
  }
  /* ⚠ **여행이 하나뿐이면 목록이 빕니다**(히어로가 그 하나를 가져갔으므로).
     그대로 두면 제목만 있는 빈 카드가 남습니다 — 고장으로 보입니다.
     그럴 때는 위 히어로가 이미 다 말했으니 한 줄만 조용히 답니다(b410). */
  if (!목록.length){
    putHtml('trips', `<div class="empty" style="padding:18px 12px">
      위가 다음 여행이에요.<br>
      <span class="memo">새 여행은 위 ＋새 여행 으로 만들 수 있어요</span></div>`);
    return;
  }
  /* 히어로에 건 여행은 빠진 목록입니다(위 b410 주석). */
  const tripsHtml = 목록.map(t => {
    const role = (t.trip_members || []).find(m => m.user_id === ctx.me().id)?.role || '';
    const days = Math.round((new Date(t.end_date) - new Date(t.start_date)) / 864e5) + 1;
    const a = `data-id="${esc(t.id)}" data-title="${esc(t.title)}"`;
    /* 소유자만 지웁니다. 일행은 나갈 뿐입니다 — 남의 여행을 지울 수는 없습니다.
       (RLS 도 같은 규칙을 걸어두었으니 버튼을 숨기는 건 안내일 뿐입니다.) */
    /* 보관은 뺐습니다. 날짜가 지나면 저절로 "다녀온"으로 넘어가는데
       거기서 또 손으로 치우게 하면 두 곳에 나뉘어 어디 있는지 헷갈립니다. */
    /* 일정 화면 위에서 사진과 정보를 걷어냈으니 고치는 길이 여기 있어야 합니다. */
    /* 다녀온 여행에는 리포트로 가는 길을 답니다. 전에는 홈의 "평가 안 한 여행" 띠
       하나뿐이라, 평가를 마치고 나면 리포트를 다시 볼 방법이 없었습니다. */
    const report = t.end_date < today
      ? `<button class="ghost" data-act="report" ${a}
                 style="color:var(--primary)">리포트</button>` : '';
    /* **지우기를 상시로 두지 않습니다.** 줄마다 빨간 '삭제'가 손가락 닿는
       자리에 늘 있었습니다. 되돌릴 수 없는 것을 스치기 쉬운 곳에 둘 이유가
       없습니다. ⋯ 뒤로 넣고, 누르면 그 줄에서만 펼칩니다. */
    const more = (role === 'owner'
      ? `<button class="ghost" data-act="edit" ${a}>수정</button>` +
        `<button class="ghost" data-act="delete" ${a} style="color:var(--bad)">삭제</button>`
      : `<button class="ghost" data-act="leave" ${a}>나가기</button>`);
    const acts = report +
      `<button class="ghost" data-act="more" ${a} aria-label="더보기">더보기</button>` +
      `<span class="tmore hide">${more}</span>`;
    /* 글자만 있으면 어느 여행인지 한눈에 안 들어옵니다.
       그 여행의 첫 도시 사진을 왼쪽에 답니다. 없으면 첫 글자만. */
    /* `_photo` 는 fillTripPhotos 가 채웁니다 — 우리 도시 목록에 없는 곳으로
       만든 여행('삼척')이 늘 빈 칸이던 것을 메웁니다. */
    const img = t.cities?.image_url || t._photo;
    /* **사진이 없으면 회색 칸에 '삼' 한 글자만 떠 있었습니다.** 글자 하나가
       제목 왼쪽에 덩그러니 놓이면 제목을 두 번 읽는 것처럼 보입니다.
       홈 히어로가 쓰는 색(heroTint)을 그대로 깔면 같은 여행은 어디서나
       같은 색이라 목록에서도 눈으로 짚입니다. */
    const tint = ` style="background:${heroTint(t.title)}; color:#fff"`;
    return `<div class="trip" data-open="${esc(t.id)}">
      ${img ? `<img class="thumb" src="${esc(img)}" alt="" loading="lazy"
                   onerror="this.replaceWith(Object.assign(document.createElement('span'),
                     {className:'thumb ph', textContent:'${esc(t.title.slice(0,1))}',
                      style:'background:${heroTint(t.title)}; color:#fff'}))">`
            : `<span class="thumb ph"${tint}>${esc(t.title.slice(0,1))}</span>`}
      <div class="t">
      <b>${esc(t.title)}</b>
      <span class="meta">${esc(tripSub(t, days))}</span>
      <div style="margin-top:4px">${acts}</div>
    </div>${
      /* 다녀왔는데 아직 후기를 안 남긴 여행. 여기가 평가로 들어가는 입구입니다. */
      t.end_date < today && !(t.trip_reviews || []).some(r => r.user_id === ctx.me().id)
        ? '<span class="badge" style="background:#fdf3e6; color:#f5a623; font-weight:600">' +
          '후기 전</span>'
        /* 'OWNER' 만 영어로 떠 있었습니다. 앱 전체가 한국어입니다. */
        : `<span class="badge">${esc(ROLE_KO[role] || role)}</span>`}</div>`;
  }).join('');
  /* 기록 탭과 **같은 이유**입니다(drawRatings 참고). 탭을 누를 때마다
     `loadTrips` 가 돌고 여기서 목록을 통째로 갈아끼우면, 글자는 티가 안 나도
     **여행 사진이 버려졌다 새로 만들어져** 빈 칸이 보였다 채워집니다.
     한 자도 안 달라졌으면 손대지 않습니다. */
  putHtml('trips', tripsHtml);
}

/* 줄마다 버튼을 달면 목록을 다시 그릴 때마다 이벤트를 다시 붙여야 합니다.
   상자 하나에만 붙이고 눌린 버튼을 찾아 씁니다. */
$('trips').addEventListener('click', async e => {
  const b = e.target.closest('button[data-act]');
  if (!b){
    /* 버튼이 아니면 줄을 누른 것입니다 — 그 여행을 엽니다. */
    const row = e.target.closest('.trip[data-open]');
    if (row) await ctx.openTrip(row.dataset.open);
    return;
  }
  const { act, id, title } = b.dataset;

  if (act === 'cancelact') return loadTrips();

  /* ⋯ — 그 줄에서만 펼칩니다. 다른 줄이 열려 있으면 접습니다.
     여러 줄이 동시에 펼쳐져 있으면 어느 여행의 삭제인지 헷갈립니다. */
  if (act === 'more'){
    const wrap = b.nextElementSibling;
    const open = wrap.classList.contains('hide');
    document.querySelectorAll('#trips .tmore').forEach(x => x.classList.add('hide'));
    document.querySelectorAll('#trips [data-act="more"]').forEach(x => x.textContent = '더보기');
    wrap.classList.toggle('hide', !open);
    b.textContent = open ? '닫기' : '더보기';
    return;
  }

  /* 고치기 — 여행을 열고 수정 칸을 바로 펼칩니다. */
  if (act === 'report') return openTripReport(id);
  if (act === 'edit'){ await ctx.openTrip(id); $('editbtn').click(); return; }

  /* 되돌릴 수 없는 일은 그 자리에서 한 번 더 묻습니다.
     window.confirm 은 내장 브라우저나 iframe 안에서 조용히 막혀 false 를
     돌려줍니다. 그러면 요청도 안 보내고 아무 말도 없이 끝납니다 —
     실제로 그래서 "삭제가 안 먹는다"가 됐습니다. 화면 안에서 묻습니다. */
  if ((act === 'delete' || act === 'leave') && b.dataset.armed !== '1'){
    const wrap = b.parentElement;
    const msg = act === 'delete'
      ? '일정 · 지출 · 예약 · 준비물 · 사진이 함께 사라져요. 되돌릴 수 없어요.'
      : '목록에서 사라져요. 넣은 지출은 정산을 위해 남아요.';
    wrap.innerHTML =
      `<div style="color:var(--bad); font-size:calc(12px * var(--ts)); margin-bottom:4px">
         ${esc(msg)}</div>
       <button class="ghost" data-act="cancelact">취소</button>
       <button class="ghost" data-act="${esc(act)}" data-armed="1"
               data-id="${esc(id)}" data-title="${esc(title)}"
               style="color:var(--bad); font-weight:600">
         정말 ${act === 'delete' ? '삭제' : '나가기'}</button>`;
    return;
  }

  b.disabled = true;
  $('triperr').classList.add('hide');

  /* .select() 를 붙여 실제로 몇 줄이 바뀌었는지 받습니다.
     RLS 가 막으면 Postgres 는 오류를 내지 않고 0건을 처리합니다.
     이걸 안 세면 "눌러도 아무 일도 안 일어남"이 되고 원인을 알 수 없습니다. */
  let r;
  if (act === 'delete')          r = await sb.from('trips').delete().eq('id', id).select('id');
  else if (act === 'leave')      r = await sb.from('trip_members')
                                      .update({ left_at: new Date().toISOString() })
                                      .eq('trip_id', id).eq('user_id', ctx.me().id).select('trip_id');
  b.disabled = false;

  if (r?.error) return fail(r.error, 'trip');
  if (!r?.data?.length){
    /* 여행 id(UUID)와 동작 이름을 화면에 적고 있었습니다. 사용자가 볼 것이
       아니라 고치는 사람이 볼 것이므로 기록으로 보냅니다. */
    ctx.logError(`여행 ${act} 0건 — trip=${id}`, 'trip');
    return fail(act === 'leave'
      ? '이 여행에서 나가지 못했어요. 잠시 뒤 다시 해주세요.'
      : '이 여행을 지울 권한이 없어요. 만든 사람만 지울 수 있어요.', 'trip');
  }
  await loadTrips();
});

