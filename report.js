/* ── 여행 리포트 ─────────────────────────────────────────────────────
 * 다녀온 여행을 옆으로 넘겨 보는 카드로 냅니다. 며칠 · 몇 곳 · 얼마 ·
 * 얼마나 걸었나. 마지막 장에서 다음 여행으로 이어집니다.
 *
 * **AI 를 안 씁니다.** 같은 여행을 다시 열면 같은 문구가 나와야 합니다 —
 * 성향 카드(card.js)와 같은 규칙입니다.
 *
 * ── app.js 에서 떼어낸 여섯 번째 조각입니다(b333) ───────────────────
 * 앞의 다섯과 다른 점이 하나 있습니다. 이 화면은 **끝에서 다른 화면으로
 * 이어집니다** — AI 대화 · 새 여행 · 초안. 그래서 ctx 로 받는 것이 함수
 * 다섯입니다. 화면 하나가 통째로 떨어지는 것이 아니라 **여러 곳으로 나가는
 * 길목**이라 그렇습니다. ctx 가 길면 그건 이 화면이 원래 그런 자리라는 뜻이고,
 * 억지로 줄이려고 저쪽 코드를 여기로 끌고 오면 다시 커집니다.
 *
 * 층: dom.js · db.js · calc.js · card.js · trip.js · net.js 만 씁니다. */
import { $, esc, toast, copyText, md } from './dom.js?v=b822';
import { sb } from './db.js?v=b822';
import { fail, netTimeout } from './net.js?v=b822';
import { money, distKm, D1, asDate } from './calc.js?v=b822';
import { REPORT_ICON, REPORT_BG, shareCard, PERSONA_ICON } from './card.js?v=b822';

/* app.js 만 아는 것들. 로그인한 사람과, 이 화면 끝에서 이어지는 화면 넷.
   `me` 는 로그인할 때마다 바뀌므로 값이 아니라 **함수**로 받습니다. */
let ctx = {
  me: () => null, openAi: () => {}, openDraft: () => {}, openNew: () => {},
  closeReview: () => {}, loadChats: async () => {},
};
export function setReportCtx(o){ ctx = { ...ctx, ...o }; }

let rpt = null;                       /* 공유와 이미지 저장에서 다시 씁니다 */

/* ── 여행 리포트의 한 줄평 ───────────────────────────────────────────
 * 성향 카드와 같은 방식입니다. **계산으로만 정하고 AI 를 안 씁니다** —
 * 같은 여행을 다시 열면 같은 문구가 나와야 합니다.
 * 위에서부터 검사해 처음 걸리는 것을 씁니다.
 *
 * 같은 사람이라도 여행마다 다르게 나옵니다. 도쿄에서는 먹기만 하고
 * 파리에서는 걷기만 할 수 있습니다. 그게 오히려 재밌습니다.
 *
 * 자료가 모자라면 그 문구는 아예 건너뜁니다. 억지로 판정하면 틀린 말이 됩니다.
 *   - 예산을 안 적었으면 예산 문구를 건너뜁니다
 *   - 평가를 절반도 안 했으면 별점 문구를 건너뜁니다
 *   - 2박 이하면 속도 문구를 건너뜁니다 (하루 이틀은 값이 심하게 흔들립니다)
 */
const REPORT_RULES = [
  /* 특이한 결과 — 희소해서 재밌습니다 */
  { id:'adhoc', g:'rare', ic:'bolt', t:'즉흥이 더 좋았던 여행',
    f:r => r.rated && r.adhocN >= 3 && r.adhocRating != null && r.plannedRating != null
        && r.adhocRating - r.plannedRating >= 0.8 },
  { id:'oneArea', g:'rare', ic:'pinheart', t:'한 동네에 눌러앉은 여행',
    f:r => r.days >= 3 && r.areaCount > 0 && r.areaCount <= 2 },
  { id:'asPlanned', g:'rare', ic:'stamp', t:'계획대로 다 해낸 여행',
    f:r => r.rated && r.plannedN >= 10 && r.planRate >= 0.95 },

  /* 지출 성향 */
  { id:'food',   g:'spend', ic:'fork', t:'먹으러 간 여행',      f:r => r.spend > 0 && r.foodRatio >= 0.55 },
  { id:'shop',   g:'spend', ic:'bag2', t:'쇼핑하러 간 여행',    f:r => r.spend > 0 && r.shopRatio >= 0.35 },
  { id:'over',   g:'spend', ic:'wallet', t:'지갑이 열린 여행',    f:r => r.budgetRatio != null && r.budgetRatio >= 1.3 },
  { id:'under',  g:'spend', ic:'coin', t:'알뜰하게 다녀온 여행', f:r => r.budgetRatio != null && r.budgetRatio <= 0.8 },

  /* 속도 */
  { id:'nonstop',g:'speed', ic:'run', t:'하루도 안 쉰 여행', f:r => r.speedOk && r.perDay >= 7 },
  { id:'walked', g:'speed', ic:'shoe', t:'많이 걸은 여행',    f:r => r.speedOk && r.kmPerDay >= 12 },
  { id:'rest',   g:'speed', ic:'cup', t:'쉬러 간 여행',      f:r => r.speedOk && r.perDay <= 4 && r.cafeCount >= 3 },
  { id:'slow',   g:'speed', ic:'moon', t:'느긋했던 여행',     f:r => r.speedOk && r.perDay <= 4 },

  /* 취향이 드러난 결과 */
  { id:'eatWin', g:'taste', ic:'fork', t:'미식이 전부였던 여행',
    f:r => r.rated && r.eatAvg != null && r.seeAvg != null && r.eatAvg - r.seeAvg >= 1.5 },
  { id:'seeWin', g:'taste', ic:'camera', t:'눈이 즐거웠던 여행',
    f:r => r.rated && r.eatAvg != null && r.seeAvg != null && r.seeAvg - r.eatAvg >= 1.5 },
  { id:'cafe',   g:'taste', ic:'cup', t:'카페 투어', f:r => r.cafeCount >= r.days && r.cafeCount >= 3 },

  /* 어디에도 안 걸렸을 때 */
  { id:'even',   g:'even', ic:'bag', t:'골고루 다녀온 여행', f:() => true },
];

export async function drawReport(id){
  $('rv_rate').classList.add('hide');
  $('rv_report').classList.remove('hide');
  $('rv_report').innerHTML = '<div class="card"><div class="empty"><span class="load">만드는 중…</span></div></div>';
  window.scrollTo({ top:0 });

  const [t, lg, pl, ex, cr, pr, mb, allT] = await Promise.all([
    /* budget 은 034 에서 붙였습니다. 아직 안 올렸으면 아래에서 한 번 더 물어봅니다. */
    sb.from('trips').select('title,destination,start_date,end_date,home_currency,budget')
      .eq('id', id).maybeSingle(),
    sb.from('trip_legs').select('city_id').eq('trip_id', id).order('start_date'),
    /* created_at 으로 "출발 전에 넣은 것"과 "가서 넣은 것"을 가릅니다.
       즉흥이 더 좋았는지 보려면 이 구분이 있어야 합니다. */
    sb.from('plans').select('id,title,category,lat,lng,date,start_time,created_at')
      .eq('trip_id', id).is('deleted_at', null).order('date').order('start_time'),
    sb.from('expenses').select('title,amount,amount_home,currency,category')
      .eq('trip_id', id).is('deleted_at', null),
    sb.from('city_ratings').select('city_id,stars').eq('user_id', ctx.me().id),
    sb.from('plan_ratings').select('plan_id,stars').eq('user_id', ctx.me().id),
    /* 영수증에 「동행 N명」과 「1인당」을 적으려면 몇 명인지 알아야 합니다.
       나간 사람도 셉니다 — 그 사람 몫도 이미 쓴 돈에 들어 있습니다. */
    sb.from('trip_members').select('user_id').eq('trip_id', id),
    /* 여행 번호(TRIP #007). **누적되는 느낌**을 만드는 것이 전부입니다 —
       출발일 순으로 몇 번째 여행인지. 지운 여행은 안 셉니다. */
    sb.from('trips').select('id,start_date').is('deleted_at', null).order('start_date'),
  ]);
  /* 034 를 아직 안 올렸으면 budget 이 없다고 질의가 통째로 실패합니다.
     리포트가 통째로 안 뜨는 것보다는 예산 문구만 빠지는 편이 낫습니다. */
  if (t.error) Object.assign(t, await sb.from('trips')
    .select('title,destination,start_date,end_date,home_currency')
    .eq('id', id).maybeSingle());
  const T = t.data || {};
  const days   = Math.round((asDate(T.end_date) - asDate(T.start_date)) / D1) + 1;
  const plans_ = pl.data || [];
  const exps   = ex.data || [];
  const psr = Object.fromEntries((pr.data || []).map(r => [r.plan_id, Number(r.stars)]));

  /* 움직인 거리. 좌표가 있는 일정 사이만 더합니다 —
     모르는 구간을 지어내느니 빼는 편이 낫습니다. */
  let km = 0; const byDay = {}, kmDay = {};
  plans_.forEach(p => (byDay[p.date] = byDay[p.date] || []).push(p));
  Object.entries(byDay).forEach(([d, list]) => {
    let sum = 0;
    for (let i = 0; i < list.length - 1; i++){
      const v = distKm(list[i].lat, list[i].lng, list[i+1].lat, list[i+1].lng);
      if (v != null) sum += v;
    }
    kmDay[d] = sum; km += sum;
  });

  const PLACE = ['식사','카페','관광','쇼핑','기타'];
  const spots = plans_.filter(p => PLACE.includes(p.category));
  const eats  = spots.filter(p => ['식사','카페'].includes(p.category));
  const sees  = spots.filter(p => ['관광','쇼핑'].includes(p.category));
  const avg = a => a.length ? a.reduce((s,v) => s+v, 0) / a.length : null;
  const st  = list => avg(list.map(p => psr[p.id]).filter(v => v != null));
  const eatAvg = st(eats), seeAvg = st(sees);

  const money = e => Number(e.amount_home) || 0;
  const spend = exps.reduce((s,e) => s + money(e), 0);
  const foodPct = spend ? Math.round(
    exps.filter(e => ['식사','카페'].includes(e.category)).reduce((s,e)=>s+money(e),0)
    / spend * 100) : 0;
  const shopPct = spend ? Math.round(
    exps.filter(e => e.category === '쇼핑').reduce((s,e)=>s+money(e),0) / spend * 100) : 0;
  const won = n => Math.round(n).toLocaleString();
  const cur = T.home_currency || '';

  /* ── 한 줄 정의에 쓰는 값들 ──
     AI 를 안 부릅니다. 공짜이고 즉시 나오고, 같은 여행이면 언제나 같습니다. */

  /* 동네 수. "동네"라는 자료가 따로 없어서 좌표를 0.02°(약 2km) 칸으로 묶습니다.
     좌표가 없는 일정은 못 셉니다 — 그래서 좌표가 아예 없으면 이 문구를 건너뜁니다. */
  const areas = new Set(spots.filter(p => p.lat != null && p.lng != null)
    .map(p => `${Math.round(p.lat / 0.02)},${Math.round(p.lng / 0.02)}`));

  /* 출발 전에 넣은 것 = 계획, 가서 넣은 것 = 즉흥.
     created_at 은 시각까지 있으므로 출발일 0시를 경계로 봅니다. */
  const startTs = asDate(T.start_date).getTime();
  const planned = spots.filter(p => new Date(p.created_at).getTime() <  startTs);
  const adhoc   = spots.filter(p => new Date(p.created_at).getTime() >= startTs);

  const cafeCount = spots.filter(p => p.category === '카페').length;
  const ratedN = spots.filter(p => psr[p.id] != null).length;

  const R = {
    days,
    perDay: spots.length / days,
    kmPerDay: km / days,
    areaCount: areas.size,
    cafeCount,
    spend,
    foodRatio: spend ? exps.filter(e => ['식사','카페'].includes(e.category))
                           .reduce((s,e)=>s+money(e),0) / spend : 0,
    shopRatio: spend ? exps.filter(e => e.category === '쇼핑')
                           .reduce((s,e)=>s+money(e),0) / spend : 0,
    /* 예산을 안 적었으면 null 입니다. null 이면 그 문구를 건너뜁니다 — 0 으로 두면
       "알뜰하게 다녀온 여행"이 늘 걸립니다. */
    budgetRatio: (T.budget && spend) ? spend / Number(T.budget) : null,
    plannedN: planned.length,
    adhocN: adhoc.length,
    plannedRating: st(planned),
    adhocRating: st(adhoc),
    /* 계획한 곳 중 별점을 남긴 비율. "갔다"를 따로 안 적으므로 별점이 그 표시입니다. */
    planRate: planned.length
      ? planned.filter(p => psr[p.id] != null).length / planned.length : 0,
    eatAvg, seeAvg,
    /* 절반도 평가 안 했으면 별점 기반 문구는 근거가 약합니다. */
    rated: spots.length ? ratedN / spots.length >= 0.5 : false,
    /* 1박 2일은 하루 일정 수가 심하게 흔들립니다. 3일부터만 속도를 말합니다. */
    speedOk: days >= 3,
  };
  const rule = REPORT_RULES.find(r => r.f(R));
  const label = rule.t;

  /* ── 영수증에 쓰는 값들 ───────────────────────────────────────────────
   * 영수증은 **줄마다 숫자 하나**입니다. 그래서 화면보다 더 잘게 나눠야 합니다. */
  const 인원 = (mb.data || []).length || 1;
  /* 여행 번호. 출발일 순으로 몇 번째인가. 못 찾으면 안 적습니다 —
     틀린 번호를 찍느니 없는 편이 낫습니다. */
  const 번호 = ((allT.data || []).findIndex(x => x.id === id) + 1) || null;

  /* 분류별 금액. 화면은 비중(%)만 보여줬는데 영수증은 **금액**이 주인공입니다.
     앱의 분류(식사·카페·이동·쇼핑·관광·숙소·기타)를 영수증 말로 묶습니다. */
  const 묶음 = { 식비:['식사','카페'], 교통:['이동'], 숙소:['숙소'],
                 쇼핑:['쇼핑'], 관광:['관광'], 기타:['기타', null, ''] };
  const 지출줄 = Object.entries(묶음).map(([이름, cats]) => {
    const v = exps.filter(e => cats.includes(e.category || '')).reduce((s,e) => s+money(e), 0);
    return { 이름, 값: v };
  }).filter(x => x.값 > 0).sort((a,b) => b.값 - a.값);

  /* 계획 대비. "갔다"를 따로 안 적으므로 **별점이 곧 다녀왔다는 표시**입니다.
     계획이 하나도 없으면(전부 즉흥) 이 줄은 뜻이 없어 뺍니다. */
  const 계획수 = planned.length;
  const 다녀온계획 = planned.filter(p => psr[p.id] != null).length;

  /* 하루별 줄 — 곳 수 · 그날 평균 별점 · 그날 이동 거리 */
  const 날들 = Object.keys(byDay).sort();

  const defLine = [
    foodPct ? `식비 ${foodPct}%` : null,
    eatAvg != null ? `식당 평균 ★${eatAvg.toFixed(1)}` : null,
    seeAvg != null ? `관광지 평균 ★${seeAvg.toFixed(1)}` : null,
  ].filter(Boolean).join(' · ');

  const five = spots.filter(p => psr[p.id] === 5).map(p => p.title);
  const top  = spots.filter(p => psr[p.id] != null)
                    .sort((a,b) => psr[b.id] - psr[a.id])[0];
  const pricey = exps.slice().sort((a,b) => money(b) - money(a))[0];

  /* 하루별 흐름. 점 개수가 일정 수, 옆이 그날 평균 별점입니다. */
  const dayRows = Object.keys(byDay).sort().map((d, i) => {
    const list = byDay[d].filter(p => PLACE.includes(p.category));
    const s = st(list);
    return { i:i+1, n:list.length, s };
  });
  const busiest = dayRows.reduce((a,b) =>
    (!a || b.n > a.n || (b.n === a.n && (b.s ?? 9) < (a.s ?? 9))) ? b : a, null);
  const hard = busiest && busiest.n >= 6 && (busiest.s == null || busiest.s <= 3.6)
             ? busiest.i : null;

  rpt = { title:T.title, dest:T.destination, from:T.start_date, to:T.end_date,
          days, spend, cur, spots:spots.length, km:Math.round(km), label, defLine };

  /* ── 영수증 ───────────────────────────────────────────────────────────
   * ⚠ **성향 카드와 결이 다릅니다.** 성향 카드는 여권(크림톤·일러스트·놀이)이고
   *   이건 영수증(흰 종이·글자만·기록)입니다. 둘이 같아 보이면 안 됩니다 —
   *   하나는 "나는 이런 사람"이고 하나는 "이 여행은 이랬다"입니다.
   *
   * 영수증은 원래 글자만 있는 형식이라 **그림이 없는 것이 오히려 진짜 같습니다.**
   * 등폭 글씨와 점선이 형식을 만듭니다. 여기서 그림을 넣으면 영수증이 아니라
   * 그냥 카드가 됩니다.
   *
   * ⚠ **글자 크기를 여러 개 쓰지 마십시오.** 한 줄평 하나만 크고 나머지는 다
   *   같은 크기여야 영수증으로 읽힙니다. 크기를 늘리는 순간 형식이 무너집니다.
   *
   * ⚠ **앱에서 보는 것과 공유용은 내용이 다릅니다.** 성향 카드는 "보는 것이 곧
   *   올리는 것"이었지만 여기는 일부러 가릅니다 — AI 문단("Day 3에 무리하셨다")과
   *   하루별 흐름은 **내가 볼 것**이지 남에게 보일 것이 아닙니다. */
  const 돈 = n => won(n) + (cur ? ' ' + cur : '');
  const 굵은선 = '<div class="rcline"></div>';
  const 점선  = '<div class="rcdash"></div>';
  const 줄 = (k, v, 굵게) =>
    `<div class="rcrow${굵게 ? ' b' : ''}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`;

  /* 바코드는 **장식입니다.** 진짜 자료를 담지 않습니다 — 여권 카드의 MRZ 와
     같은 역할이고, 읽을 필요가 없다는 것을 알고 봐야 합니다.
     같은 여행이면 늘 같은 무늬가 나오도록 여행 id 로 만듭니다. */
  const 바코드 = (seed) => {
    let h = 0; const s = String(seed || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    /* ⚠ **하위 비트를 쓰면 무늬가 안 갈립니다.** `h % 4` 로 했더니 막대가
       전부 같은 것 하나로 나왔습니다 — 이 난수식(LCG)은 아래쪽 비트의 주기가
       아주 짧습니다. 위쪽 비트를 봐야 섞입니다. */
    let out = '';
    for (let i = 0; i < 44; i++){ h = (h * 1103515245 + 12345) >>> 0;
      out += ['▌','▎','▍','▏'][(h >>> 16) % 4]; }
    return out;
  };

  const 영수증 = `
    <div class="receipt" id="rcpt">
      <div class="rchead">기 로</div>
      <div class="rcsub">TRIP RECEIPT</div>
      ${굵은선}
      ${번호 ? `<div class="rcrow"><span>TRIP #${String(번호).padStart(3,'0')}</span><span></span></div>` : ''}
      ${줄(T.destination || T.title || '여행', (T.country || '').toUpperCase() || '')}
      ${줄(`${(T.start_date||'').replace(/-/g,'.')} – ${(T.end_date||'').slice(5).replace(/-/g,'.')}`,
           `${days - 1}박 ${days}일`)}
      ${인원 > 1 ? 줄(`동행 ${인원}명`, '') : ''}
      ${점선}
      ${줄('방문한 곳', `${spots.length} 곳`)}
      ${km ? 줄('이동 거리', `약 ${Math.round(km)} km`) : ''}
      ${줄('하루 평균', `${(spots.length / days).toFixed(1)} 곳`)}
      ${/* ⚠ **계획이 몇 개 안 되면 안 적습니다.** 계획 1곳짜리 여행에서
            "0 / 1  0%" 가 떴는데, 그건 계획을 안 지켰다는 뜻이 아니라
            **잴 것이 없다**는 뜻입니다. 0% 라고 적으면 사실이 아닌 인상을
            줍니다. 세 곳부터 말이 됩니다. */
        계획수 >= 3 ? 줄('계획 대비',
          `${다녀온계획} / ${계획수}  ${Math.round(다녀온계획 / 계획수 * 100)}%`) : ''}
      ${adhoc.length ? 줄('즉흥 방문', `${adhoc.length} 곳`) : ''}
      ${지출줄.length ? 점선 + 지출줄.map(x => 줄(x.이름, won(x.값))).join('') : ''}
      ${spend ? 굵은선 + 줄('합계', 돈(spend), true) +
        (인원 > 1 ? 줄('1인당', 돈(spend / 인원)) : '') +
        줄('하루 평균', 돈(spend / days)) : ''}
      ${굵은선}
      ${ratedN ? 줄('평가', `${ratedN} / ${spots.length}${
            ratedN === spots.length ? ' 완료' : ''}`) : ''}
      ${ratedN ? 줄('평균 별점', (st(spots) ?? 0).toFixed(1)) : ''}
      ${five.length ? 점선 + `<div class="rcrow"><span>★5를 준 곳</span><span></span></div>` +
        five.slice(0, 5).map(n => `<div class="rcsub2">${esc(n)}</div>`).join('') : ''}
      ${점선}
      ${날들.map((d, i) => {
        const list = byDay[d].filter(p => PLACE.includes(p.category));
        const s = st(list);
        return `<div class="rcday"><span>DAY ${i+1}</span>
          <span>${list.length}곳</span>
          <span>${s != null ? '★' + s.toFixed(1) : '–'}</span>
          <span>${kmDay[d] ? kmDay[d].toFixed(1) + 'km' : '–'}</span></div>`;
      }).join('')}
      ${점선}
      <div class="rcbig">"${esc(label)}"</div>
      <div id="rv_ai" class="rcai hide"></div>
      ${점선}
      <div class="rcfoot">또 오세요 · KEYRO ${(T.end_date || '').slice(0,4)}</div>
      <div class="rcbar">${바코드(id)}</div>
    </div>`;

  $('rv_report').innerHTML = 영수증 +
    `<div class="card" style="margin-top:var(--s-sm)">
       <button class="ghost" id="rv_askai" style="width:100%">AI 한마디 듣기</button>
       <!-- 성향 카드와 같은 이유로 단추를 하나로 합쳤습니다(b393) —
            글만 보내는 「공유」는 그림까지 보내는 쪽에 통째로 포함됩니다. -->
       <button class="primary" id="rv_img" style="width:100%; margin-top:8px">공유하기</button>
       <button class="ghost" id="rv_home" style="width:100%; margin-top:6px">홈으로</button>
     </div>`;

  $('rv_home').onclick  = () => ctx.closeReview();
  /* ⚠ **이미지는 화면과 내용이 다릅니다.** 하루별 흐름과 AI 문단은 빼고
     핵심만 남깁니다 — 그건 내가 볼 것이지 남에게 보일 것이 아닙니다.
     성향 카드에서는 "보는 것이 곧 올리는 것"이 규칙이었지만, 여기는
     **일부러 가르는 것**이라 다릅니다. 그 이유를 모르면 언젠가 "왜 두 벌이지"
     하고 합치게 됩니다. */
  $('rv_img').onclick   = () => shareCard({
    kind:'receipt',
    번호, dest: T.destination || T.title || '여행',
    from: T.start_date, to: T.end_date, days, 인원,
    곳: spots.length, km: Math.round(km),
    합계: spend, 돈합계: 돈(spend), 돈1인: 돈(spend / 인원),
    식비비중: foodPct,
    five: five.slice(0, 2), label,
    바: 바코드(id),
    /* 그림을 못 받는 기기(문자·메모)에서는 이 글로 떨어집니다 —
       예전 「공유」 단추가 보내던 그 글입니다(b393 에서 단추만 합쳤습니다). */
    shareText: reportText(),
  }, '기로-영수증');
  $('rv_askai').onclick = () => askReportAi(id, { label, defLine, dayRows, hard,
                                                  spend, cur, days, top, pricey, psr });
}
function reportText(){
  if (!rpt) return '';
  return [
    `${rpt.dest || rpt.title} ${rpt.from} – ${rpt.to} · ${rpt.days}일`,
    `"${rpt.label}"`,
    [rpt.spend ? `쓴 돈 ${Math.round(rpt.spend).toLocaleString()}${rpt.cur}` : null,
     `다녀온 곳 ${rpt.spots}곳`,
     rpt.km ? `움직인 거리 ${rpt.km}km` : null].filter(Boolean).join(' · '),
    rpt.defLine,
  ].filter(Boolean).join('\n');
}

/* ⚠ 여기 `shareReport`(글만 보내기)가 있었습니다 — **b393 에서 걷었습니다.**
   단추 둘 중 「공유」가 부르던 것인데, 그림까지 보내는 쪽이 이 글도 같이
   보내므로 통째로 포함됩니다. 위 `reportText()` 는 남아 있고 `shareText` 로
   넘어가서, 그림을 못 받는 기기에서 그대로 쓰입니다. */

/* AI 한마디. 계산해 둔 사실만 넘기고 문장만 받습니다 —
   AI 가 숫자를 다시 세면 틀립니다. 부를 때만 부르므로 횟수도 아낍니다. */
async function askReportAi(id, f){
  const b = $('rv_askai');
  b.disabled = true; b.innerHTML = '<span class="load">듣는 중…</span>';
  const facts = [
    `여행 ${f.days}일, 다녀온 곳 ${rpt.spots}곳, 움직인 거리 ${rpt.km}km`,
    f.spend ? `쓴 돈 ${Math.round(f.spend).toLocaleString()}${f.cur}, 하루 평균 ${
      Math.round(f.spend / f.days).toLocaleString()}${f.cur}` : null,
    f.defLine, `한 줄 정의는 "${f.label}"`,
    f.hard ? `Day ${f.hard}이 가장 빡빡했고 그날 평가가 낮았다` : null,
    f.top ? `가장 만족한 곳은 ${f.top.title} ★${f.psr[f.top.id]}` : null,
    f.pricey ? `가장 비쌌던 곳은 ${f.pricey.title}` : null,
  ].filter(Boolean).join('\n');

  const { data, error } = await sb.functions.invoke('chat', { body: { trip_id: id,
    message: '아래는 이번 여행을 계산한 결과다. 숫자를 새로 세지 말고 이 사실만 써서 ' +
             '3~4문장으로 소감과 다음 여행 조언을 해요체로 써줘. ' +
             '마지막 문장은 다음 여행에 쓸 수 있는 구체적인 제안으로 끝낼 것. ' +
             'places 와 actions 는 빈 배열로 둘 것.\n\n' + facts } });
  b.disabled = false; b.textContent = 'AI 한마디 다시 듣기';
  if (error || data?.error){
    let why = data?.error || error.message;
    try { why = (await error?.context?.json())?.error || why; } catch {}
    return toast(why);
  }
  $('rv_ai').classList.remove('hide');
  $('rv_ai').innerHTML = `<div class="h">AI 한마디</div>
    <div class="v" style="font-weight:400; line-height:1.7">${md(data.reply || '')}</div>`;
}

/* AI 일정 만들기 — 이 앱이 내세우는 기능이라 홈 위쪽에 둡니다. */
/* ── 무엇을 권할지는 그 사람의 여행이 정합니다 ──
   "AI와 함께 떠나볼까요?" 하나만 늘 띄우면, 다음 주에 도쿄 가는 사람에게도
   일정이 텅 빈 사람에게도 같은 말을 합니다. 지금 제일 급한 것을 말합니다.
     · 곧 가는데 일정이 비었다 → 그 여행을 짜자 (제일 급합니다)
     · 곧 가는데 일정이 있다   → 다듬거나 물어보자
     · 여행이 없다             → 새로 만들자

   ⚠ **판단만 따로 뺐습니다(b377).** 여행이 있을 때는 이 권유가 카드가 아니라
   **히어로의 단추**로 들어갑니다 — `도쿄, 뭐 더 넣을까요?` 는 도쿄 여행
   이야기인데 히어로(도쿄) 바로 밑에 따로 선 카드였습니다. 같은 것을 말하는
   덩어리가 둘로 나뉘어 있었습니다. 그리는 것은 두 곳이지만 **무엇을 권할지는
   여기 한 곳**입니다.
   `heroGo` 는 히어로 단추에 쓰는 말입니다. 카드에서는 옆에 설명(`sub`)이
   붙지만 히어로에서는 단추 글자만 남습니다.
   ⚠ b377 에 `뭐 더 넣을까 묻기` 라고 적었더니 사용자가 **"그게 뭐야"** 라고
   물었습니다 — 어디에 넣는지도 누구에게 묻는지도 안 드러납니다. 설명을 지고
   있던 줄을 버리고 그 뜻을 글자 하나에 다 담으려 한 것이 잘못이었습니다.
   b378 에서 **아이콘이 '누가'를, 글자가 '무엇이 되는지'를** 맡게 나눴습니다.
   히어로 단추 앞에 앱의 AI 표시(별 두 개)가 붙으므로 글자에는 AI 를 안
   적습니다 — `일정 추가` · `일정 짜기` · `여행 만들기`. */
export function aiPrompt(nextTrip, nextPlans){
  return !nextTrip
    ? { title:'AI와 함께 떠나볼까요?', sub:'뭘 좋아하는지만 알려주세요',
        go:'시작', heroGo:'여행 만들기', go2:() => ctx.openNew() }
    : nextPlans === 0
    ? { title:`${nextTrip.title} 일정이 비어 있어요`,
        sub:'AI가 하루씩 짜드릴게요', go:'짜기', heroGo:'일정 짜기',
        go2:() => ctx.openDraft(nextTrip.id, true) }
    /* **여기는 초안 화면이 아니라 비서로 보냅니다.** 처음에 초안으로 보냈더니
       "빈 시간에 넣을 곳을 찾아드려요"라고 해놓고 일정을 통째로 다시 짜는
       화면이 떴습니다. 이미 31개가 들어 있는 여행에서요. 말과 행동이 달랐습니다.
       뭘 더 넣을지 물어보는 자리는 비서입니다. */
    : { title:`${nextTrip.title}, 뭐 더 넣을까요?`,
        sub:'빈 시간에 넣을 곳을 찾아드려요', go:'물어보기', heroGo:'일정 추가',
        go2:async () => { ctx.openAi(); $('ai_trip').value = nextTrip.id;
                          await ctx.loadChats(nextTrip.id); } };
}

export function renderAiCard(nextTrip, nextPlans){
  const ai = aiPrompt(nextTrip, nextPlans);
  const box = document.createElement('div');
  box.className = 'aicard';
  box.id = 'homeaicard';
  box.innerHTML =
    `<span class="ic">
       <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
         <path d="M11 2l1.8 5.2L18 9l-5.2 1.8L11 16l-1.8-5.2L4 9l5.2-1.8L11 2z"/>
         <path d="M18.5 13.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z"
               opacity=".75"/>
       </svg>
     </span>
     <span class="tx">
       <b>${esc(ai.title)}</b>
       <span>${esc(ai.sub)}</span>
     </span>
     <span class="go">${esc(ai.go)}</span>`;
  /* 예전에는 초안 화면(openDraft)을 바로 열었습니다. 그런데 거기에도
     '새 여행'이 따로 있어서, 여행을 만드는 길이 두 개가 됐습니다 —
     한쪽은 단계 화면, 한쪽은 옛날 폼이라 모양도 달랐습니다.
     여기서는 단계 화면을 엽니다. 마지막에 'AI가 짜줄게요'를 고르면
     그 초안 화면으로 이어집니다. 길은 하나로 모입니다. */
  box.onclick = ai.go2;
  $('home').appendChild(box);
}
