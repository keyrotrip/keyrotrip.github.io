/* ── 관리자 「사용」 칸(b815 · 고도화 b825) — 유튜브 스튜디오 「분석」처럼 ─────────────────────
 * 사용자: 「얼마나 많은 사람이 가입하고 별점 매기고 전반적으로 쓰고 있는지 종합적으로 다 트래킹 하고 싶어」(b815)
 *   → 「유튜브 스튜디오처럼 초고도화 해봐」(b825).
 * 칸 넷 — 유튜브 스튜디오의 「개요 · 콘텐츠 · 시청자층 · 고급 모드」를 앱에 맞게:
 *   · 개요   — 기간(7·28·90·365·전체) · 한 줄 요약 · 지표 카드 여섯(누르면 아래 그래프가 그 지표로, 바로 앞 같은
 *              길이와 견준 ▲▼) · 그래프에 「평소 범위」 띠(앞 90일 하루 값 25~75% — 유튜브의 평소 범위) ·
 *              「평소보다 많아요/적어요」(평소 하루 «평균»과 견줌 — 띠와 견주면 틀림, 평소() 머리말) · 실시간(오늘 · 최근 48시간) · 지금까지 쌓인 것
 *   · 참여   — 얼마나 깊이(사람마다 별점 수) · 한 사람 평균 · 기능별 쓰임 · 어디까지 가나(전체 / 이 기간 가입)
 *   · 사람들 — 새로 온 / 전부터 쓰던 · 얼마나 자주(연 날 수)와 꾸준함 · 언제 쓰나(요일×시간 열지도) · 가입 주별 재방문
 *   · 고급   — 날마다(90일 넘으면 주마다) 모든 숫자 표 · CSV 받기
 * ⚠ 「이 기간 인기 도시」(유튜브의 「인기 콘텐츠」)는 b815 에 걷었습니다(사용자: 「이 기간 인기도시가 필요해?? 앱 사용
 *   통계가 필요한건데」). 114 가 서버에서도 걷었습니다. 이 칸은 **앱을 얼마나 쓰나**만 말합니다.
 * ⚠ 숫자는 서버 함수 admin_usage(p_days) 하나가 다 줍니다(db/112 → 114 가 넓힘). **누가 무엇을 했는지는 안 받습니다** —
 *   관리자 화면의 약속(admin.js 머리말 「숫자만 냅니다」) 그대로. 새로 모으는 자료도 없습니다(114 머리말).
 * ⚠ 「쓴 사람」「다시 온 사람」은 기록이 시작된 날(since — 112 를 돌린 뒤 처음 연 날)부터만 있습니다. 그 앞 날은
 *   그래프에 「기록 전」으로 흐리게 두고, 지난 기간이 기록 전에 걸치면 ▲▼를 안 냅니다(0 과 견주면 늘 ▲ 입니다).
 * ⚠ 날짜는 서버가 서울 기준으로 자른 'YYYY-MM-DD' 입니다. 여기서 Date 로 다시 자르지 않습니다(UTC 함정 —
 *   home.js 「날짜는 글자로 견줍니다」와 같은 까닭).
 * ⚠ 114 를 아직 안 돌린 서버(112)도 그립니다 — 새 숫자(다시 온 사람·새 여행·평소 범위·열지도…)가 없으면 그 자리에
 *   「db/114 를 돌리면 나와요」만 둡니다.
 * 층: dom · db · net. admin.js 가 부릅니다(loadUsage). 화면 자리는 index.html 의 #adm_use. */
import { $, esc, toast } from './dom.js?v=b830';
import { sb } from './db.js?v=b830';
import { netTimeout } from './net.js?v=b830';

const 지표들 = [
  { k: 'a', kpi: 'active',  이름: '쓴 사람',     단위: '명', 기록: true },
  { k: 's', kpi: 'signups', 이름: '새 가입',     단위: '명' },
  { k: 'b', kpi: 'back',    이름: '다시 온 사람', 단위: '명', 기록: true, 새: true },
  { k: 'r', kpi: 'ratings', 이름: '새 별점',     단위: '개' },
  { k: 'p', kpi: 'persona', 이름: '성향 확정',   단위: '명' },
  { k: 't', kpi: 'trips',   이름: '새 여행',     단위: '개', 새: true },
];
const 기간들 = [[7, '7일'], [28, '28일'], [90, '90일'], [365, '365일'], [0, '전체']];
const 칸들 = [['ov', '개요'], ['en', '참여'], ['au', '사람들'], ['ad', '고급']];
let 기간 = 28, 보는칸 = 'ov', 지표 = 'a', 깔때기 = 'all';
let 자료 = null, 받은기간 = null, 받은때 = 0, 차례 = 0;

const 수 = v => Number(v ?? 0).toLocaleString('ko-KR');
/* 소수 한 자리 — 「1.0」은 「1」로. */
const 소수 = v => { const x = Math.round(Number(v || 0) * 10) / 10; return Number.isInteger(x) ? String(x) : x.toFixed(1); };
const 요일 = ['일', '월', '화', '수', '목', '금', '토'];
const 쪼개기 = s => { const [y, m, d] = String(s).split('-').map(Number); return { y, m, d }; };
const 짧은날 = s => { const t = 쪼개기(s); return `${t.m}/${t.d}`; };
const 긴날 = s => {
  const t = 쪼개기(s);
  return `${t.m}월 ${t.d}일 (${요일[new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay()]})`;
};
const 날빼기 = (s, n) => { const t = 쪼개기(s); return new Date(Date.UTC(t.y, t.m - 1, t.d - n)).toISOString().slice(0, 10); };
/* 그 주 월요일(글자로) — 고급 표를 주마다 묶을 때. */
const 주첫날 = s => { const t = 쪼개기(s); const w = new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay(); return 날빼기(s, (w + 6) % 7); };
/* 눈금 꼭대기 — 2·4·6·10 × 10ⁿ. 반이 늘 정수라 가운데 눈금이 「0.5명」이 안 됩니다. */
const 눈금올림 = v => { for (let 십 = 1; ; 십 *= 10) for (const c of [2, 4, 6, 10]) if (v <= c * 십) return c * 십; };
/* 114 를 돌린 서버인가 — 새 숫자가 오는지로 봅니다. */
const 새서버 = D => !!(D && D.typical);
const 새안내 = '<p class="aunote au114">db/114_usage_studio.sql 을 돌리면 이 자리에 숫자가 나와요.</p>';

/* ── 받기 ── 같은 기간을 1분 안에 다시 열면 받은 것을 그대로 씁니다(관리자 화면을 오갈 때마다 세지 않게). */
export async function loadUsage(force){
  const 판 = $('adm_use');
  if (!판) return;
  if (!force && 자료 && 받은기간 === 기간 && Date.now() - 받은때 < 60_000){ 그리기(); return; }
  const 이번 = ++차례;
  if (!자료 || 받은기간 !== 기간)
    판.innerHTML = 머리() + `<div class="card auc"><div class="empty"><span class="load">세는 중…</span></div></div>`;
  const r = await netTimeout(sb.rpc('admin_usage', { p_days: 기간 }), 15000);
  if (이번 !== 차례) return;                       /* 그 사이 기간을 또 바꿨으면 늦은 답은 버립니다 */
  if (r.error || !r.data){
    const 없음 = /admin_usage|does not exist|schema cache|could not find/i.test(r.error?.message || '');
    판.innerHTML = 머리() + `<div class="card auc"><div class="empty">${없음
      ? '서버에 「사용」 숫자 함수가 아직 없어요.<br><span class="memo">db/112 · db/114 를 돌리면 나와요.</span>'
      : '숫자를 못 받았어요.'}
      <div style="margin-top:10px"><button class="small" data-au="retry">다시 받기</button></div></div></div>`;
    return;
  }
  자료 = r.data; 받은기간 = 기간; 받은때 = Date.now();
  그리기();
}

/* ── 그리기 ──────────────────────────────────────────────────────────── */
function 그리기(){
  const 판 = $('adm_use'), D = 자료;
  if (!판 || !D) return;
  if (!새서버(D) && 지표들.find(x => x.k === 지표)?.새) 지표 = 'a';   /* 112 서버엔 그 숫자가 없습니다 */
  const 몸 = 보는칸 === 'en' ? 깊이(D) + 평균(D) + 기능(D) + 어디까지(D)
           : 보는칸 === 'au' ? 사람들(D) + 자주(D) + 언제(D) + 재방문(D)
           : 보는칸 === 'ad' ? 표(D)
           : 개요(D) + 실시간(D) + 쌓인것(D);
  판.innerHTML = 머리() + 몸;
  if (보는칸 === 'ov') 그래프잇기();
}

/* 칸 줄 + 기간 + 새로고침. 기간은 넷이 같이 씁니다.
   칸 줄은 위 「사용 | 비용 | 문제」(.frtabs) 아래 둘째 층이라 모양을 달리합니다 — 같은 꽉 찬 밑줄 탭을 또 두면
   어느 줄이 위인지 안 보입니다(유튜브 스튜디오도 왼쪽 메뉴 아래에 왼쪽으로 모은 탭). */
function 머리(){
  return `<div class="ausub" role="tablist" aria-label="사용 칸">${칸들.map(([k, l]) =>
      `<button type="button" role="tab" data-au-tab="${k}" aria-selected="${k === 보는칸}"
        class="${k === 보는칸 ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="auhead aubar">
      <div class="auper" role="tablist" aria-label="기간">${기간들.map(([n, l]) =>
        `<button type="button" role="tab" data-au-days="${n}" aria-selected="${n === 기간}"
          class="${n === 기간 ? 'on' : ''}">${l}</button>`).join('')}</div>
      <button type="button" class="ghost aurf" data-au="refresh" aria-label="새로고침">새로고침</button>
    </div>`;
}
const 기간말 = D => D.all ? `${긴날(D.first || D.from).replace(/ \(.\)$/, '')}부터 지금까지` : `지난 ${D.days}일 동안`;

/* 쓴 사람·다시 온 사람을 지난 기간과 견줄 수 있나 — 지난 기간 첫날까지 기록이 있어야 합니다. 전체는 견줄 기간이 없습니다. */
const 견줄수있나 = (D, x) => !D.all && (!x.기록 || (D.since && D.since <= 날빼기(D.from, D.days)));

function 차이(cur, prev){
  if (cur === prev) return { t: '그대로', c: '' };
  const d = cur - prev;
  const pct = prev > 0 ? ` · ${Math.round(Math.abs(d) / prev * 100)}%` : '';
  return { t: `${d > 0 ? '▲' : '▼'} ${수(Math.abs(d))}${pct}`, c: d > 0 ? 'up' : 'down' };
}

/* ① 개요 — 한 줄 요약 · 지표 카드 여섯 · 그래프(평소 범위 띠) · 평소 견줌 */
function 개요(D){
  const K = D.kpi || {};
  const 기록중 = !!D.since;
  const 늦게시작 = 기록중 && D.since > D.from;       /* 이 기간 도중에 기록이 시작됐다 */
  const 요약 = !기록중
    ? `앱을 연 날은 <b>오늘부터</b> 쌓여요`
    : `${늦게시작 ? `${긴날(D.since).replace(/ \(.\)$/, '')}부터` : 기간말(D)} <b>${수(K.active)}명</b>이 기로를 열었어요`;
  const 카드 = 지표들.map(x => {
    const 없음 = x.새 && !새서버(D);
    const cur = Number(K[x.kpi] ?? 0), prev = Number(K[x.kpi + '_prev'] ?? 0);
    const 견줌 = 없음 ? { t: 'db/114 필요', c: 'na' }
      : 견줄수있나(D, x) ? 차이(cur, prev) : { t: D.all ? '' : '견줄 기록 없음', c: 'na' };
    return `<button type="button" role="tab" data-au-k="${x.k}" aria-selected="${x.k === 지표}"
      class="${x.k === 지표 ? 'on' : ''}"${없음 ? ' disabled' : ''}><span class="l">${esc(x.이름)}</span>
      <b>${없음 ? '–' : 수(cur)}<small>${esc(x.단위)}</small></b><span class="dt ${견줌.c}">${esc(견줌.t)}</span></button>`;
  }).join('');
  return `<div class="card auc auov">
    <p class="ausum">${요약}</p>
    <div class="aukpi aukpi6" role="tablist" aria-label="지표">${카드}</div>
    <p class="aunote">${D.all ? '전체 기간은 견줄 앞 기간이 없어요' : `▲▼ 는 바로 앞 ${D.days}일과 견준 값이에요`}
      · 다시 온 사람 = 가입한 날이 아닌 날에도 앱을 연 사람${늦게시작 || !기록중
      ? ` · 「쓴 사람」「다시 온 사람」은 ${기록중 ? 긴날(D.since).replace(/ \(.\)$/, '') : '오늘'}부터 세요` : ''}</p>
    <div class="aucap" id="au_cap" aria-live="polite"></div>
    <div class="auchartwrap" id="au_chartwrap">${그래프(D)}</div>
    <div class="aux"><span>${짧은날(D.from)}</span><span>${짧은날(D.series?.[Math.floor((D.series.length - 1) / 2)]?.d || D.from)}</span><span>${짧은날(D.today)}</span></div>
    <div id="au_cmp">${평소(D)}</div>
  </div>`;
}

/* 평소 — 이번 기간 바로 앞 90일(114 · 앱이 그보다 어리면 있는 날만). 견준 날이 2주가 안 되면 안 냅니다(우연을 말하게 됨).
   ⚠ 판정은 «평균끼리» 견줍니다. 처음엔 이 기간 하루 평균을 띠(평소 하루 값의 가운데 절반)와 견줬는데, 별점처럼 며칠에
     몰리는 숫자는 띠가 0~0 이라 1개만 매겨도 「평소보다 많아요」가 됐습니다(10-03 실제 숫자 — 지난 28일 1개, 그 앞 28일
     151개인데 「많아요」). 띠는 「평소 하루는 이 정도」를 보여주는 그림으로만 두고, 0~0 이면 안 그립니다.
   ⚠ 숫자가 작으면(이 기간도 평소 흐름도 5 밑) 판정하지 않습니다 — 1명과 3명 사이는 우연입니다. */
const 평소값 = D => {
  const T = D.typical?.[지표];
  if (D.all || !T || Number(T.n) < 14 || T.hi == null) return null;
  return { lo: Number(T.lo), hi: Number(T.hi), avg: T.avg == null ? null : Number(T.avg), n: Number(T.n) };
};
const 기록지표 = () => !!지표들.find(x => x.k === 지표)?.기록;
function 평소(D){
  const x = 지표들.find(v => v.k === 지표) || 지표들[0];
  if (D.all) return '';
  if (!새서버(D)) return 새안내;
  const T = 평소값(D);
  if (!T) return `<p class="aucmp">「평소」는 앞 기록이 2주 넘게 쌓이면 나와요</p>`;
  const xs = (D.series || []).filter(p => !(기록지표() && (!D.since || p.d < D.since)));
  if (!xs.length) return '';
  const 합 = xs.reduce((a, p) => a + Number(p[지표] || 0), 0);
  const 띠말 = T.hi > 0 ? `<div class="aulg"><span><i class="band"></i>평소 하루 값의 가운데 절반</span></div>` : '';
  const 뜻 = `<p class="aunote">평소 = 이 기간 바로 앞 ${T.n}일${기록지표() ? '(앱 연 날 기록이 있는 날)' : ''}</p>`;
  if (T.avg == null) return 띠말 + 뜻;              /* avg 없는 114 첫 판 — 판정은 114 를 다시 돌리면 나옵니다 */
  const 기대 = T.avg * xs.length;
  const [말, c] = Math.max(합, 기대) < 5 ? ['아직 숫자가 작아 견주지 않아요', 'na']
    : 합 > 기대 * 1.2 ? ['평소보다 많아요', 'up'] : 합 < 기대 * 0.8 ? ['평소보다 적어요', 'down'] : ['평소와 비슷해요', ''];
  /* 사람 수(쓴·다시 온)는 하루 평균으로, 개수(가입·별점·성향·여행)는 이 기간 합으로 — 사람 수를 날마다 더하면
     「사람×날」이라 뜻이 없습니다(고급 표의 주마다 묶기와 같은 까닭). */
  const 견줌 = 기록지표()
    ? `하루 평균 <b>${소수(합 / xs.length)}${x.단위}</b> · 평소 하루 <b>${소수(T.avg)}${x.단위}</b>`
    : `이 기간 <b>${수(합)}${x.단위}</b> · 평소 흐름이면 ${기대 >= 1 ? `<b>${수(Math.round(기대))}${x.단위}</b>쯤` : `<b>1${x.단위}</b> 미만`}`;
  return `<p class="aucmp">${견줌} — <b class="${c}">${말}</b></p>${띠말}${뜻}`;
}

/* 그래프 치수(viewBox) — 폭은 CSS 가 100% 로 늘립니다(재지 않아도 됨 — 숨은 칸에서도 그려짐, raf-hidden-window). */
const G = { W: 320, H: 140, 위: 12, 아래: 6, 왼: 2, 오: 34 };
function 그래프(D){
  const xs = D.series || [], n = xs.length;
  if (!n) return '';
  const 값 = xs.map(p => Number(p[지표] ?? 0));
  const T = 평소값(D);
  const 최대 = 눈금올림(Math.max(1, ...값, T ? T.hi : 0));
  const X = i => G.왼 + (n <= 1 ? (G.W - G.왼 - G.오) / 2 : i * (G.W - G.왼 - G.오) / (n - 1));
  const Y = v => G.위 + (G.H - G.위 - G.아래) * (1 - v / 최대);
  /* 「쓴 사람」「다시 온 사람」의 기록 전 날 — 선을 거기서부터 긋고 앞은 흐린 칸. */
  let 앞 = 0;
  if (기록지표()){ const i = D.since ? xs.findIndex(p => p.d >= D.since) : -1; 앞 = i < 0 ? n : i; }
  const 점 = 값.map((v, i) => [X(i), Y(v)]).slice(앞);
  const 선 = 점.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  const 바닥 = Y(0).toFixed(1);
  const 면 = 점.length > 1 ? `${선}L${점.at(-1)[0].toFixed(1)} ${바닥}L${점[0][0].toFixed(1)} ${바닥}Z` : '';
  const 격자 = [0, 0.5, 1].map(f => {
    const y = Y(최대 * f).toFixed(1);
    return `<line x1="${G.왼}" x2="${G.W - G.오}" y1="${y}" y2="${y}" class="g"/>
      <text x="${G.W - G.오 + 6}" y="${(+y + 4).toFixed(1)}" class="yt">${수(최대 * f)}</text>`;
  }).join('');
  /* 평소 띠 — 0~0 이면 안 그립니다(바닥 선과 겹쳐 뜻이 없음). 위아래가 같아도(3~3) 2px 은 보이게. */
  const 띠 = T && T.hi > 0 ? (() => {
    const y1 = Y(T.hi), y2 = Y(T.lo), h = Math.max(2, y2 - y1);
    return `<rect x="${G.왼}" y="${(y2 - h).toFixed(1)}" width="${G.W - G.왼 - G.오}" height="${h.toFixed(1)}" class="band"/>`;
  })() : '';
  const 흐림 = 앞 > 0 ? `<rect x="${G.왼}" y="${G.위}" width="${Math.max(0, (앞 >= n ? X(n - 1) : X(앞)) - G.왼).toFixed(1)}"
      height="${G.H - G.위 - G.아래}" class="pre"/><text x="${G.왼 + 6}" y="${G.위 + 14}" class="pt">기록 전</text>` : '';
  const 끝 = 점.at(-1);
  const 이름 = 지표들.find(x => x.k === 지표)?.이름 || '';
  return `<svg class="auchart" id="au_chart" viewBox="0 0 ${G.W} ${G.H}" role="img"
      aria-label="${esc(`${이름} — ${기간말(D)} 날마다`)}">
    ${격자}${띠}${흐림}
    ${면 ? `<path d="${면}" class="ar"/>` : ''}${선 ? `<path d="${선}" class="ln"/>` : ''}
    ${끝 ? `<circle cx="${끝[0].toFixed(1)}" cy="${끝[1].toFixed(1)}" r="3.5" class="end"/>` : ''}
    <line id="au_hair" class="hair" x1="0" x2="0" y1="${G.위}" y2="${G.H - G.아래}" visibility="hidden"/>
    <circle id="au_dot" class="dot" r="4.5" cx="0" cy="0" visibility="hidden"/>
  </svg>`;
}

/* 그래프를 손가락으로 짚으면 그날 값(유튜브 스튜디오의 마우스 올리기). 놓으면 오늘 값으로. */
function 그래프잇기(){
  const svg = $('au_chart'), D = 자료;
  if (!svg || !D?.series?.length) return;
  const xs = D.series, n = xs.length;
  const x단위 = 지표들.find(x => x.k === 지표) || 지표들[0];
  const 값 = xs.map(p => Number(p[지표] ?? 0));
  const T = 평소값(D);
  const 최대 = 눈금올림(Math.max(1, ...값, T ? T.hi : 0));
  const X = i => G.왼 + (n <= 1 ? (G.W - G.왼 - G.오) / 2 : i * (G.W - G.왼 - G.오) / (n - 1));
  const Y = v => G.위 + (G.H - G.위 - G.아래) * (1 - v / 최대);
  const 기록전 = i => 기록지표() && (!D.since || xs[i].d < D.since);
  const 말 = i => `${i === n - 1 ? '오늘' : 긴날(xs[i].d)} · ${기록전(i) ? '기록 전' : `${수(값[i])}${x단위.단위}`}`;
  const 캡 = $('au_cap'), 털 = $('au_hair'), 점 = $('au_dot');
  const 놓기 = () => { 털.setAttribute('visibility', 'hidden'); 점.setAttribute('visibility', 'hidden'); 캡.textContent = 말(n - 1); };
  const 짚기 = e => {
    const r = svg.getBoundingClientRect();
    if (!r.width) return;
    const vx = (e.clientX - r.left) / r.width * G.W;
    const i = Math.max(0, Math.min(n - 1, Math.round(n <= 1 ? 0 : (vx - G.왼) / ((G.W - G.왼 - G.오) / (n - 1)))));
    const x = X(i).toFixed(1);
    털.setAttribute('x1', x); 털.setAttribute('x2', x); 털.setAttribute('visibility', 'visible');
    if (기록전(i)) 점.setAttribute('visibility', 'hidden');
    else { 점.setAttribute('cx', x); 점.setAttribute('cy', Y(값[i]).toFixed(1)); 점.setAttribute('visibility', 'visible'); }
    캡.textContent = 말(i);
  };
  svg.addEventListener('pointerdown', 짚기);
  svg.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) 짚기(e); });
  svg.addEventListener('pointerleave', 놓기);
  svg.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') setTimeout(놓기, 1600); });
  놓기();
}

/* ② 실시간 — 오늘(서울) 숫자 셋 + 최근 48시간 한 시간 막대(새 별점 · 가입 쌓기) */
function 실시간(D){
  const L = D.live || {}, hs = L.hours || [];
  const 최대 = Math.max(1, ...hs.map(h => Number(h.r || 0) + Number(h.s || 0)));
  const W = 320, H = 56, 칸폭 = W / Math.max(1, hs.length);
  const 막대 = hs.map((h, i) => {
    const r = Number(h.r || 0), s = Number(h.s || 0);
    const hr = r / 최대 * (H - 4), hs2 = s / 최대 * (H - 4);
    const x = (i * 칸폭 + 1).toFixed(1), w = Math.max(1, 칸폭 - 2).toFixed(1);
    return (r ? `<rect x="${x}" width="${w}" y="${(H - hr).toFixed(1)}" height="${hr.toFixed(1)}" class="r"/>` : '')
      + (s ? `<rect x="${x}" width="${w}" y="${(H - hr - hs2).toFixed(1)}" height="${hs2.toFixed(1)}" class="s"/>` : '')
      + (!r && !s ? `<rect x="${x}" width="${w}" y="${H - 1}" height="1" class="z"/>` : '');
  }).join('');
  const 지금 = new Date(받은때 || Date.now());
  const 시각 = `${String(지금.getHours()).padStart(2, '0')}:${String(지금.getMinutes()).padStart(2, '0')}`;
  return `<div class="card auc">
    <h2><span class="grow">실시간</span><span class="aulv"><i aria-hidden="true"></i>${시각} 기준</span></h2>
    <div class="aulvn">
      <div><b>${수(L.active)}</b><span>오늘 연 사람</span></div>
      <div><b>${수(L.signups)}</b><span>오늘 가입</span></div>
      <div><b>${수(L.ratings)}</b><span>오늘 새 별점</span></div>
    </div>
    <svg class="aubars" viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 48시간 한 시간마다 새 별점과 가입">${막대}</svg>
    <div class="aux"><span>48시간 전</span><span>지금</span></div>
    <div class="aulg"><span><i class="r"></i>새 별점</span><span><i class="s"></i>가입</span></div>
  </div>`;
}

/* ③ 쌓인 것 — 지금까지 */
function 쌓인것(D){
  const T = D.total || {};
  /* 뒤의 둘은 예전 대시보드(043)의 비용 칸에 있던 것 — 혼자 쓰는 앱인지 같이 쓰는 앱인지가 여기서 갈립니다. */
  const 칸 = [['가입자', T.users, '명'], ['별점', T.ratings, '개'], ['매긴 사람', T.raters, '명'],
              ['성향 확정', T.persona, '명'], ['팔로우', T.follows, '건'], ['여행', T.trips, '개'],
              ['지금 여행 중', T.trips_now, '개'], ['함께 쓰는 여행', T.trips_shared, '개']];
  return `<div class="card auc">
    <h2>지금까지 쌓인 것</h2>
    <div class="autot">${칸.map(([l, v, u]) => `<div><b>${수(v)}<small>${u}</small></b><span>${l}</span></div>`).join('')}</div>
  </div>`;
}

/* 막대 줄 하나(.aust) — 참여·사람들 칸이 같이 씁니다. */
const 막대줄 = (l, v, 최대, 오른쪽, 표시 = '') => `<div class="aust${v ? '' : ' zero'}${표시}"><span class="l">${esc(l)}</span>
    <div class="bar"><i style="width:${최대 ? (v / 최대 * 100).toFixed(1) : 0}%"></i></div>
    <span class="v">${오른쪽}</span></div>`;

/* ④ 얼마나 깊이 — 사람마다 매긴 별점 수(가입자 전체, 114). 유튜브의 「평균 시청 지속 시간」 자리 — 들어와서 얼마나 깊이 쓰나. */
function 깊이(D){
  if (!새서버(D)) return `<div class="card auc"><h2>얼마나 깊이</h2>${새안내}</div>`;
  const P = D.depth || {};
  const 구간 = [['0', '0개'], ['1-4', '1~4개'], ['5-19', '5~19개'], ['20-49', '20~49개'], ['50+', '50개 넘게']]
    .map(([k, l]) => [l, Number(P[k] || 0)]);
  const 합 = 구간.reduce((a, x) => a + x[1], 0), 최대 = Math.max(1, ...구간.map(x => x[1]));
  return `<div class="card auc">
    <h2>얼마나 깊이</h2>
    <p class="aunote" style="margin-top:0">가입한 ${수(합)}명이 별점을 몇 개씩 매겼나(지금까지 · 국내 포함)</p>
    <div class="aufun">${구간.map(([l, v]) => 막대줄(l, v, 최대, `${수(v)}명<small>${합 ? Math.round(v / 합 * 100) : 0}%</small>`)).join('')}</div>
    <p class="aunote">성향은 해외 도시 열 곳부터 확정돼요(이 칸은 국내도 센 개수) — 0개·1~4개에 많으면 첫 별점이 막힌 거예요</p>
  </div>`;
}

/* ⑤ 한 사람 평균 — 이 기간 쓴 사람 한 명이 한 일. 전체 숫자만 보면 한 사람이 다 한 것인지 고루 한 것인지 모릅니다. */
function 평균(D){
  const 쓴 = Number(D.kpi?.active || 0), xs = D.series || [];
  const 합 = k => xs.reduce((a, p) => a + Number(p[k] || 0), 0);
  if (!쓴) return `<div class="card auc"><h2>한 사람 평균</h2><div class="empty">${D.since ? '이 기간에 앱을 연 사람이 없어요.' : '앱을 연 날은 오늘부터 쌓여요.'}</div></div>`;
  const 칸 = [['새 별점', 합('r'), '개'], ['새 여행', 새서버(D) ? 합('t') : null, '개'], ['일정', 새서버(D) ? 합('pl') : null, '개'],
              ['지출', 새서버(D) ? 합('e') : null, '건'], ['AI 질문', 새서버(D) ? 합('ai') : null, '번'], ['팔로우', 새서버(D) ? 합('f') : null, '건']];
  return `<div class="card auc">
    <h2>한 사람 평균</h2>
    <p class="aunote" style="margin-top:0">${기간말(D)} 앱을 연 ${수(쓴)}명 한 사람당</p>
    <div class="autot autot3">${칸.map(([l, v, u]) => `<div><b>${v == null ? '–' : 소수(v / 쓴)}<small>${u}</small></b><span>${l}</span></div>`).join('')}</div>
    ${새서버(D) ? '' : 새안내}
  </div>`;
}

/* ⑥ 기능별 쓰임 — 이 기간에 쓴 사람(막대)과 몇 번 */
function 기능(D){
  const fs = (D.feat || []).map(f => ({ k: f.k, u: Number(f.u || 0), n: Number(f.n || 0) }))
    .sort((a, b) => b.u - a.u || b.n - a.n);
  const 최대 = Math.max(1, ...fs.map(f => f.u));
  return `<div class="card auc">
    <h2>기능별 쓰임</h2>
    <p class="aunote" style="margin-top:0">${기간말(D)} 쓴 사람(막대)과 횟수</p>
    <div class="aufun">${fs.map(f => 막대줄(f.k, f.u, 최대, `${수(f.u)}명<small>${수(f.n)}${f.k === '별점' ? '개' : '번'}</small>`)).join('')}</div>
    <p class="aunote">별점은 새로 매긴 개수 · 한줄평·일기는 그 기간에 손댄 곳 수예요</p>
  </div>`;
}

/* ⑦ 어디까지 가나 — 전체(지금까지 가입한 사람) / 이 기간에 가입한 사람(114). 단계끼리 가장 많이 빠지는 곳을 짚습니다.
   ⚠ 「이 기간 가입」이 초대한 사람들을 따로 보는 자리입니다 — 전체는 예전 사람들에 묻혀 안 보입니다. */
function 어디까지(D){
  const 기간쪽 = 깔때기 === 'p' && 새서버(D);
  const F = (기간쪽 ? D.funnel_p : D.funnel) || {}, 전체 = Number(F.users || 0);
  const 단계 = [['가입', F.users], ['첫 별점', F.rated], ['성향 확정', F.persona], ['팔로우', F.follow], ['여행 만들기', F.trip]]
    .map(([l, v]) => [l, Number(v || 0)]);
  let 큰곳 = -1, 큰수 = 0;
  for (let i = 1; i < 단계.length; i++){ const 빠짐 = 단계[i - 1][1] - 단계[i][1]; if (빠짐 > 큰수){ 큰수 = 빠짐; 큰곳 = i; } }
  const 토글 = 새서버(D) ? `<div class="auper aufunt" role="tablist" aria-label="누구">${[['all', '전체'], ['p', '이 기간 가입']].map(([k, l]) =>
      `<button type="button" role="tab" data-au-fun="${k}" aria-selected="${(깔때기 === k)}" class="${깔때기 === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : '';
  return `<div class="card auc">
    <h2><span class="grow">어디까지 가나</span>${토글}</h2>
    <p class="aunote" style="margin-top:0">${기간쪽 ? `${기간말(D)} 가입한 ${수(전체)}명이` : `지금까지 가입한 ${수(전체)}명이`} 어디까지 갔나</p>
    ${전체 ? `<div class="aufun">${단계.map(([l, v], i) => 막대줄(l, v, 전체, `${수(v)}<small>${전체 ? Math.round(v / 전체 * 100) : 0}%</small>`, i === 큰곳 ? ' drop' : '')).join('')}</div>
    ${큰곳 > 0 ? `<p class="aunote">가장 많이 멈추는 곳: <b>${esc(단계[큰곳 - 1][0])} → ${esc(단계[큰곳][0])}</b> (${수(큰수)}명)</p>` : ''}`
    : `<div class="empty">${기간쪽 ? '이 기간에 가입한 사람이 없어요.' : '아직 가입한 사람이 없어요.'}</div>`}
  </div>`;
}

/* ⑧ 사람들 — 새로 온 / 전부터 쓰던(유튜브 「새 시청자 / 재방문 시청자」). 기간 전에 가입했나로 가릅니다.
   ⚠ 개요의 「다시 온 사람」(가입한 날이 아닌 날에 연 사람)과 셈이 달라서 이름을 달리 둡니다 — 이번 주에 가입해
     다음 날 또 온 사람은 저기선 「다시 온」, 여기선 「새로 온」입니다. */
function 사람들(D){
  const A = D.aud || {}, 새 = Number(A.new || 0), 전 = Number(A.back || 0), 합 = 새 + 전;
  const 쪼갬 = 합 ? `<div class="ausplit" role="img" aria-label="새로 온 사람 ${새}명, 전부터 쓰던 사람 ${전}명">
      <i class="n" style="width:${(새 / 합 * 100).toFixed(1)}%"></i><i class="b" style="width:${(전 / 합 * 100).toFixed(1)}%"></i></div>
      <div class="aulg"><span><i class="n"></i>새로 온 사람 ${수(새)}명</span><span><i class="b"></i>전부터 쓰던 사람 ${수(전)}명</span></div>`
    : `<div class="empty">${D.since ? '이 기간에 앱을 연 기록이 없어요.' : '앱을 연 날은 오늘부터 쌓여요.'}</div>`;
  return `<div class="card auc">
    <h2>새로 온 사람 · 전부터 쓰던 사람</h2>
    <p class="aunote" style="margin-top:0">${기간말(D)} 앱을 연 ${수(합)}명 — 이 기간에 가입한 사람과 그 전에 가입한 사람</p>
    ${쪼갬}
  </div>`;
}

/* ⑨ 얼마나 자주 + 꾸준함 — 이 기간에 앱을 연 날 수(114). 유튜브의 「재방문 시청자」를 한 걸음 더: 몇 번 왔나. */
function 자주(D){
  if (!새서버(D)) return `<div class="card auc"><h2>얼마나 자주</h2>${새안내}</div>`;
  const Q = D.freq || {};
  const 구간 = [['1', '하루'], ['2-3', '2~3일'], ['4-7', '4~7일'], ['8+', '8일 넘게']].map(([k, l]) => [l, Number(Q[k] || 0)]);
  const 합 = 구간.reduce((a, x) => a + x[1], 0), 최대 = Math.max(1, ...구간.map(x => x[1]));
  const 꾸준 = D.stick == null ? null : Math.round(Number(D.stick) * 100);
  return `<div class="card auc">
    <h2><span class="grow">얼마나 자주</span>${꾸준 == null ? '' : `<span class="austk"><b>${꾸준}%</b> 꾸준함</span>`}</h2>
    <p class="aunote" style="margin-top:0">${기간말(D)} 앱을 연 ${수(합)}명이 며칠 열었나</p>
    ${합 ? `<div class="aufun">${구간.map(([l, v]) => 막대줄(l, v, 최대, `${수(v)}명<small>${Math.round(v / 합 * 100)}%</small>`)).join('')}</div>`
        : `<div class="empty">${D.since ? '이 기간에 앱을 연 기록이 없어요.' : '앱을 연 날은 오늘부터 쌓여요.'}</div>`}
    <p class="aunote">꾸준함 = 하루 평균 쓴 사람 ÷ 이 기간 쓴 사람 · 높을수록 같은 사람이 자주 와요(매일 오면 100%)</p>
  </div>`;
}

/* ⑩ 언제 쓰나 — 요일×시간 활동(114). 유튜브의 「시청자가 YouTube를 이용하는 시간대」.
   활동 = 별점·여행·일정·지출·팔로우·일기 사진을 «만든» 시각(서울). 앱만 열고 아무것도 안 한 것은 안 셉니다. */
const HM = { W: 320, 왼: 18, 아래: 14, 칸h: 13, 틈: 2 };
function 언제(D){
  if (!새서버(D)) return `<div class="card auc"><h2>언제 쓰나</h2>${새안내}</div>`;
  const m = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const c of D.heat || []) if (m[c.w]) m[c.w][c.h] = Number(c.n || 0);
  const 최대 = Math.max(0, ...m.flat());
  if (!최대) return `<div class="card auc"><h2>언제 쓰나</h2><div class="empty">${기간말(D)} 활동 기록이 없어요.</div></div>`;
  const 칸w = (HM.W - HM.왼) / 24, H = 7 * (HM.칸h + HM.틈) + HM.아래;
  let 큰 = { w: 0, h: 0, n: -1 };
  const 칸 = m.map((줄, w) => 줄.map((n, h) => {
    if (n > 큰.n) 큰 = { w, h, n };
    const x = (HM.왼 + h * 칸w).toFixed(1), y = (w * (HM.칸h + HM.틈)).toFixed(1);
    const op = n ? (0.18 + 0.82 * n / 최대).toFixed(2) : 1;
    return `<rect x="${x}" y="${y}" width="${(칸w - 1.5).toFixed(1)}" height="${HM.칸h}" class="${n ? 'c' : 'z'}"
      ${n ? `fill-opacity="${op}"` : ''} data-hm="${w}-${h}-${n}"/>`;
  }).join('')).join('');
  const 요일글 = 요일.map((l, w) => `<text x="0" y="${(w * (HM.칸h + HM.틈) + HM.칸h - 3).toFixed(1)}" class="yl">${l}</text>`).join('');
  const 시글 = [0, 6, 12, 18].map(h => `<text x="${(HM.왼 + h * 칸w).toFixed(1)}" y="${H - 2}" class="hl">${h}시</text>`).join('');
  /* 요일별·시간대별 합 — 열지도는 「어느 칸이 진한가」, 이 두 줄은 「그래서 언제」를 말로. */
  const 요일합 = m.map(r => r.reduce((a, v) => a + v, 0)), 시합 = Array.from({ length: 24 }, (_, h) => m.reduce((a, r) => a + r[h], 0));
  const 큰요일 = 요일합.indexOf(Math.max(...요일합)), 큰시 = 시합.indexOf(Math.max(...시합));
  const 주말 = 요일합[0] + 요일합[6], 합 = 요일합.reduce((a, v) => a + v, 0);
  return `<div class="card auc">
    <h2>언제 쓰나</h2>
    <p class="aunote" style="margin-top:0">${기간말(D)} 별점·여행·일정·지출·팔로우·일기 사진을 만든 시각(서울)</p>
    <svg class="auheat" viewBox="0 0 ${HM.W} ${H}" role="img" aria-label="요일과 시간대별 활동">${요일글}${칸}${시글}</svg>
    <p class="aucap" id="au_hmcap" aria-live="polite">가장 많이 쓴 때: ${요일[큰.w]}요일 ${큰.h}시 · ${수(큰.n)}건</p>
    <p class="aunote">요일로는 <b>${요일[큰요일]}요일</b>, 시간으로는 <b>${큰시}시대</b>에 가장 많이 써요 · 주말이 ${합 ? Math.round(주말 / 합 * 100) : 0}% · 칸을 누르면 그 칸 숫자</p>
  </div>`;
}

/* ⑪ 가입 주별 재방문 — 가입한 주마다 1주 안·한 달 안에 다시 왔나 */
function 재방문(D){
  const 칸 = (n, size, ok, tracked) => !tracked ? '<td class="na">기록 전</td>'
    : !ok ? '<td class="na">아직</td>'
    : `<td>${Math.round(Number(n) / Math.max(1, Number(size)) * 100)}%<small>${수(n)}명</small></td>`;
  const 줄 = (D.cohort || []).map(c => `<tr><th scope="row">${짧은날(c.w)}~</th><td>${수(c.size)}명</td>
      ${칸(c.w1, c.size, c.ok1, c.tracked)}${칸(c.w4, c.size, c.ok4, c.tracked)}</tr>`).join('');
  return `<div class="card auc">
    <h2>가입한 주마다 — 다시 왔나</h2>
    ${줄 ? `<div class="autw"><table class="aucoh"><thead><tr><th>가입 주</th><th>가입</th><th>1주 안</th><th>한 달 안</th></tr></thead>
      <tbody>${줄}</tbody></table></div>` : `<div class="empty">최근 8주에 가입한 사람이 없어요.</div>`}
    <p class="aunote">1주 안 = 가입 다음 날부터 7일 안에 다시 연 사람 · 한 달 안 = 8~30일 사이에 연 사람 · 초대한 주를 여기서 따로 봅니다</p>
  </div>`;
}

/* ⑫ 고급 — 모든 숫자 표(유튜브 「고급 모드」). 90일까지는 날마다, 넘으면 주마다(월요일부터).
   ⚠ 주마다일 때 「쓴 사람」「다시 온」은 그 주 «하루 평균»입니다 — 날마다 사람 수를 더하면 같은 사람이 여러 번 세어져
     「사람」이 아니라 「사람×날」이 됩니다. 맨 위 「이 기간」 줄은 서버가 센 기간 전체 사람 수(한 사람은 한 번)입니다. */
const 열 = [['a', '쓴 사람'], ['b', '다시 온'], ['s', '가입'], ['r', '별점'], ['p', '성향'], ['t', '여행'],
            ['pl', '일정'], ['e', '지출'], ['ai', 'AI'], ['f', '팔로우']];
const 사람열 = new Set(['a', 'b']);
function 표줄(D){
  const xs = D.series || [], 주마다 = xs.length > 92;
  const 기록전 = d => !D.since || d < D.since;
  if (!주마다) return { 주마다, 줄: xs.slice().reverse().map(p => ({ 날: p.d, 글: `${짧은날(p.d)} ${요일[new Date(`${p.d}T00:00:00Z`).getUTCDay()]}`,
    ...Object.fromEntries(열.map(([k]) => [k, 사람열.has(k) && 기록전(p.d) ? null : Number(p[k] || 0)])) })) };
  const 묶음 = new Map();
  for (const p of xs){
    const w = 주첫날(p.d);
    if (!묶음.has(w)) 묶음.set(w, []);
    묶음.get(w).push(p);
  }
  const 줄 = [...묶음].map(([w, ps]) => {
    const r = { 날: w, 글: `${짧은날(w)}~` };
    for (const [k] of 열){
      if (사람열.has(k)){ const 된 = ps.filter(p => !기록전(p.d)); r[k] = 된.length ? 된.reduce((a, p) => a + Number(p[k] || 0), 0) / 된.length : null; }
      else r[k] = ps.reduce((a, p) => a + Number(p[k] || 0), 0);
    }
    return r;
  }).reverse();
  return { 주마다, 줄 };
}
function 표(D){
  if (!새서버(D)) return `<div class="card auc"><h2>모든 숫자</h2>${새안내}</div>`;
  const { 주마다, 줄 } = 표줄(D), K = D.kpi || {};
  const 합 = k => (D.series || []).reduce((a, p) => a + Number(p[k] || 0), 0);
  const 위 = { a: K.active, b: K.back, ...Object.fromEntries(열.filter(([k]) => !사람열.has(k)).map(([k]) => [k, 합(k)])) };
  const 칸 = (k, v) => v == null ? '<td class="na">–</td>' : `<td>${사람열.has(k) && 주마다 ? 소수(v) : 수(v)}</td>`;
  return `<div class="card auc">
    <h2><span class="grow">모든 숫자</span><button type="button" class="small aucsv" data-au-csv="1">CSV 받기</button></h2>
    <p class="aunote" style="margin-top:0">${기간말(D)} · ${주마다 ? '주마다(월요일부터) — 쓴 사람·다시 온은 그 주 하루 평균' : '날마다'}</p>
    <div class="autw"><table class="aucoh autbl"><thead><tr><th>${주마다 ? '주' : '날'}</th>${열.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead>
      <tbody><tr class="sum"><th scope="row">이 기간</th>${열.map(([k]) => 칸(k, 위[k] ?? null)).join('')}</tr>
      ${줄.map(r => `<tr><th scope="row">${esc(r.글)}</th>${열.map(([k]) => 칸(k, r[k])).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="aunote">「이 기간」의 쓴 사람·다시 온은 기간 안에 한 번이라도 연 사람(한 사람은 한 번) · – 는 앱 연 날 기록 전</p>
  </div>`;
}
/* CSV — 엑셀에서 한글이 안 깨지게 BOM 을 붙입니다. 날짜는 오래된 것부터(표는 최근이 위).
   보내는 길은 card.js sendCardBlob 과 같은 순서 — 손가락 기기는 공유 시트(「파일에 저장」·카톡), 안 되면 내려받기. */
async function CSV받기(){
  const D = 자료;
  if (!D) return;
  const { 주마다, 줄 } = 표줄(D);
  const 칸 = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const 머리글 = [주마다 ? '주(월요일)' : '날짜', ...열.map(([, l]) => l)];
  const 몸 = 줄.slice().reverse().map(r => [r.날, ...열.map(([k]) => r[k] == null ? '' : (사람열.has(k) && 주마다 ? 소수(r[k]) : r[k]))]);
  const 글 = '﻿' + [머리글, ...몸].map(cs => cs.map(칸).join(',')).join('\r\n');
  const 이름 = `keyro-usage-${D.from}-${D.today}.csv`;
  if (matchMedia('(pointer: coarse)').matches){
    const file = new File([글], 이름, { type: 'text/csv' });
    if (navigator.canShare?.({ files: [file] })){
      try { await navigator.share({ files: [file], title: 이름 }); return; }
      catch (e){ if (e?.name === 'AbortError') return; }
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([글], { type: 'text/csv;charset=utf-8' }));
  a.download = 이름;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  toast('CSV 파일을 받았어요');
}

/* ── 누르기 ── 칸은 index.html 에 늘 있으므로 한 번만 답니다. */
$('adm_use')?.addEventListener('click', e => {
  const 탭 = e.target.closest('[data-au-tab]');
  if (탭){ if (탭.dataset.auTab !== 보는칸){ 보는칸 = 탭.dataset.auTab; 그리기(); } return; }
  const 기 = e.target.closest('[data-au-days]');
  if (기){ const n = Number(기.dataset.auDays); if (n !== 기간){ 기간 = n; loadUsage(); } return; }
  const 카 = e.target.closest('[data-au-k]');
  if (카){
    if (카.dataset.auK === 지표 || 카.disabled) return;
    지표 = 카.dataset.auK;
    document.querySelectorAll('#adm_use [data-au-k]').forEach(b => {
      const on = b.dataset.auK === 지표; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on));
    });
    const 판 = $('au_chartwrap');
    if (판 && 자료){ 판.innerHTML = 그래프(자료); 그래프잇기(); }
    const 견 = $('au_cmp');
    if (견 && 자료) 견.innerHTML = 평소(자료);
    return;
  }
  const 깔 = e.target.closest('[data-au-fun]');
  if (깔){ if (깔.dataset.auFun !== 깔때기){ 깔때기 = 깔.dataset.auFun; 그리기(); } return; }
  if (e.target.closest('[data-au-csv]')){ CSV받기(); return; }
  const 칸 = e.target.closest('[data-hm]');
  if (칸){
    const [w, h, n] = 칸.dataset.hm.split('-').map(Number);
    const 캡 = $('au_hmcap');
    if (캡) 캡.textContent = `${요일[w]}요일 ${h}시 · ${수(n)}건`;
    return;
  }
  const 단 = e.target.closest('[data-au]');
  if (단) loadUsage(true);
});
