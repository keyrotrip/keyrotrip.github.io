/* ── 관리자 「사용」 칸(b815) — 유튜브 스튜디오 「분석 › 개요」처럼 ─────────────────────
 * 사용자: 「얼마나 많은 사람이 가입하고 별점 매기고 전반적으로 쓰고 있는지 종합적으로 다 트래킹 하고 싶어」
 *   → 고른 것: 「쓴 사람」은 앱 연 날로 셈(dayseen.js · db/112) · 대시보드 「사용 | 비용 | 문제」 ·
 *     사용 칸은 「유튜브 스튜디오 참고해서 잘 만들어봐」.
 * 유튜브 스튜디오에서 가져온 것: 기간 고르기(7·28·90일) · 한 줄 요약 · 지표 카드(누르면 아래 그래프가 그 지표로,
 *   바로 앞 같은 길이와 견준 ▲▼) · 그래프(손가락으로 짚으면 그날 값) · 실시간(오늘 · 최근 48시간 막대) ·
 *   「시청자층」(→ 새로 온/다시 온 · 가입 주별 재방문).
 *   우리 것으로 더한 것: 어디까지 가나(가입 → 첫 별점 → 성향 확정 → 팔로우 → 여행) · 기능별 쓰임 · 쌓인 것.
 * ⚠ 「이 기간 인기 도시」(유튜브의 「인기 콘텐츠」)는 걷었습니다(b815, 사용자: 「이 기간 인기도시가 필요해?? 앱 사용
 *   통계가 필요한건데」). 112 의 admin_usage 는 그 숫자(`top`)를 아직 돌려주지만 여기서 안 씁니다 — 함수를 다시
 *   고칠 일이 생기면 그때 같이 걷습니다. 이 칸은 **앱을 얼마나 쓰나**만 말합니다(도시 이야기는 분석 탭 몫).
 * ⚠ 숫자는 서버 함수 admin_usage(p_days) 하나가 다 줍니다(db/112). **누가 무엇을 했는지는 안 받습니다** —
 *   관리자 화면의 약속(admin.js 머리말 「숫자만 냅니다」) 그대로.
 * ⚠ 「쓴 사람」은 기록이 시작된 날(since — 112 를 돌린 뒤 처음 연 날)부터만 있습니다. 그 앞 날은 그래프에
 *   「기록 전」으로 흐리게 두고, 지난 기간이 기록 전에 걸치면 ▲▼를 안 냅니다(0 과 견주면 늘 ▲ 입니다).
 * ⚠ 날짜는 서버가 서울 기준으로 자른 'YYYY-MM-DD' 입니다. 여기서 Date 로 다시 자르지 않습니다(UTC 함정 —
 *   home.js 「날짜는 글자로 견줍니다」와 같은 까닭).
 * 층: dom · db · net. admin.js 가 부릅니다(loadUsage). 화면 자리는 index.html 의 #adm_use. */
import { $, esc } from './dom.js?v=b823';
import { sb } from './db.js?v=b823';
import { netTimeout } from './net.js?v=b823';

const 지표들 = [
  { k: 'a', kpi: 'active',  이름: '쓴 사람',   단위: '명', 말: '앱을 연 사람' },
  { k: 's', kpi: 'signups', 이름: '새 가입',   단위: '명', 말: '가입' },
  { k: 'r', kpi: 'ratings', 이름: '새 별점',   단위: '개', 말: '새 별점' },
  { k: 'p', kpi: 'persona', 이름: '성향 확정', 단위: '명', 말: '해외 다섯 곳째를 매긴 사람' },
];
let 기간 = 28, 지표 = 'a', 자료 = null, 받은때 = 0, 차례 = 0;

const 수 = v => Number(v ?? 0).toLocaleString('ko-KR');
const 요일 = ['일', '월', '화', '수', '목', '금', '토'];
const 쪼개기 = s => { const [y, m, d] = String(s).split('-').map(Number); return { y, m, d }; };
const 짧은날 = s => { const t = 쪼개기(s); return `${t.m}/${t.d}`; };
const 긴날 = s => {
  const t = 쪼개기(s);
  return `${t.m}월 ${t.d}일 (${요일[new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay()]})`;
};
const 날빼기 = (s, n) => { const t = 쪼개기(s); return new Date(Date.UTC(t.y, t.m - 1, t.d - n)).toISOString().slice(0, 10); };
/* 눈금 꼭대기 — 2·4·6·10 × 10ⁿ. 반이 늘 정수라 가운데 눈금이 「0.5명」이 안 됩니다. */
const 눈금올림 = v => { for (let 십 = 1; ; 십 *= 10) for (const c of [2, 4, 6, 10]) if (v <= c * 십) return c * 십; };

/* ── 받기 ── 같은 기간을 1분 안에 다시 열면 받은 것을 그대로 씁니다(관리자 화면을 오갈 때마다 세지 않게). */
export async function loadUsage(force){
  const 칸 = $('adm_use');
  if (!칸) return;
  if (!force && 자료 && 자료.days === 기간 && Date.now() - 받은때 < 60_000){ 그리기(); return; }
  const 이번 = ++차례;
  if (!자료 || 자료.days !== 기간)
    칸.innerHTML = `<div class="card auc"><div class="empty"><span class="load">세는 중…</span></div></div>`;
  const r = await netTimeout(sb.rpc('admin_usage', { p_days: 기간 }), 10000);
  if (이번 !== 차례) return;                       /* 그 사이 기간을 또 바꿨으면 늦은 답은 버립니다 */
  if (r.error || !r.data){
    const 없음 = /admin_usage|does not exist|schema cache|could not find/i.test(r.error?.message || '');
    칸.innerHTML = `<div class="card auc"><div class="empty">${없음
      ? '서버에 「사용」 숫자 함수가 아직 없어요.<br><span class="memo">db/112_usage_dashboard.sql 을 돌리면 나와요.</span>'
      : '숫자를 못 받았어요.'}
      <div style="margin-top:10px"><button class="small" data-au="retry">다시 받기</button></div></div></div>`;
    return;
  }
  자료 = r.data; 받은때 = Date.now();
  그리기();
}

/* ── 그리기 ──────────────────────────────────────────────────────────── */
function 그리기(){
  const 칸 = $('adm_use'), D = 자료;
  if (!칸 || !D) return;
  칸.innerHTML = 개요(D) + 실시간(D) + 사람들(D) + 어디까지(D) + 기능(D) + 쌓인것(D);
  그래프잇기();
}

/* 쓴 사람을 지난 기간과 견줄 수 있나 — 지난 기간 첫날까지 기록이 있어야 합니다. */
const 견줄수있나 = (D, k) => k !== 'a' || (D.since && D.since <= 날빼기(D.from, D.days));

function 차이(cur, prev){
  if (cur === prev) return { t: '그대로', c: '' };
  const d = cur - prev;
  const pct = prev > 0 ? ` · ${Math.round(Math.abs(d) / prev * 100)}%` : '';
  return { t: `${d > 0 ? '▲' : '▼'} ${수(Math.abs(d))}${pct}`, c: d > 0 ? 'up' : 'down' };
}

/* ① 개요 — 기간 · 한 줄 요약 · 지표 카드 넷 · 그래프 */
function 개요(D){
  const K = D.kpi || {};
  const 기록중 = !!D.since;
  const 늦게시작 = 기록중 && D.since > D.from;       /* 이 기간 도중에 기록이 시작됐다 */
  const 요약 = !기록중
    ? `앱을 연 날은 <b>오늘부터</b> 쌓여요`
    : `${늦게시작 ? `${긴날(D.since).replace(/ \(.\)$/, '')}부터` : `지난 ${D.days}일 동안`} <b>${수(K.active)}명</b>이 기로를 열었어요`;
  const 카드 = 지표들.map(x => {
    const cur = Number(K[x.kpi] ?? 0), prev = Number(K[x.kpi + '_prev'] ?? 0);
    const 견줌 = 견줄수있나(D, x.k) ? 차이(cur, prev) : { t: '견줄 기록 없음', c: 'na' };
    return `<button type="button" role="tab" data-au-k="${x.k}" aria-selected="${x.k === 지표}"
      class="${x.k === 지표 ? 'on' : ''}"><span class="l">${esc(x.이름)}</span>
      <b>${수(cur)}<small>${esc(x.단위)}</small></b><span class="dt ${견줌.c}">${esc(견줌.t)}</span></button>`;
  }).join('');
  return `<div class="card auc auov">
    <div class="auhead">
      <div class="auper" role="tablist" aria-label="기간">${[7, 28, 90].map(n =>
        `<button type="button" role="tab" data-au-days="${n}" aria-selected="${n === 기간}"
          class="${n === 기간 ? 'on' : ''}">${n}일</button>`).join('')}</div>
      <button type="button" class="ghost aurf" data-au="refresh" aria-label="새로고침">새로고침</button>
    </div>
    <p class="ausum">${요약}</p>
    <div class="aukpi" role="tablist" aria-label="지표">${카드}</div>
    <p class="aunote">▲▼ 는 바로 앞 ${D.days}일과 견준 값이에요${늦게시작 || !기록중
      ? ` · 「쓴 사람」은 ${기록중 ? 긴날(D.since).replace(/ \(.\)$/, '') : '오늘'}부터 세요` : ''}</p>
    <div class="aucap" id="au_cap" aria-live="polite"></div>
    <div class="auchartwrap" id="au_chartwrap">${그래프(D)}</div>
    <div class="aux"><span>${짧은날(D.from)}</span><span>${짧은날(D.series?.[Math.floor((D.series.length - 1) / 2)]?.d || D.from)}</span><span>${짧은날(D.today)}</span></div>
  </div>`;
}

/* 그래프 치수(viewBox) — 폭은 CSS 가 100% 로 늘립니다(재지 않아도 됨 — 숨은 칸에서도 그려짐, raf-hidden-window). */
const G = { W: 320, H: 140, 위: 12, 아래: 6, 왼: 2, 오: 34 };
function 그래프(D){
  const xs = D.series || [], n = xs.length;
  if (!n) return '';
  const 값 = xs.map(p => Number(p[지표] ?? 0));
  const 최대 = 눈금올림(Math.max(1, ...값));
  const X = i => G.왼 + (n <= 1 ? (G.W - G.왼 - G.오) / 2 : i * (G.W - G.왼 - G.오) / (n - 1));
  const Y = v => G.위 + (G.H - G.위 - G.아래) * (1 - v / 최대);
  /* 「쓴 사람」의 기록 전 날 — 선을 거기서부터 긋고 앞은 흐린 칸. */
  let 앞 = 0;
  if (지표 === 'a'){ const i = D.since ? xs.findIndex(p => p.d >= D.since) : -1; 앞 = i < 0 ? n : i; }
  const 점 = 값.map((v, i) => [X(i), Y(v)]).slice(앞);
  const 선 = 점.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  const 바닥 = Y(0).toFixed(1);
  const 면 = 점.length > 1 ? `${선}L${점.at(-1)[0].toFixed(1)} ${바닥}L${점[0][0].toFixed(1)} ${바닥}Z` : '';
  const 격자 = [0, 0.5, 1].map(f => {
    const y = Y(최대 * f).toFixed(1);
    return `<line x1="${G.왼}" x2="${G.W - G.오}" y1="${y}" y2="${y}" class="g"/>
      <text x="${G.W - G.오 + 6}" y="${(+y + 4).toFixed(1)}" class="yt">${수(최대 * f)}</text>`;
  }).join('');
  const 흐림 = 앞 > 0 ? `<rect x="${G.왼}" y="${G.위}" width="${Math.max(0, (앞 >= n ? X(n - 1) : X(앞)) - G.왼).toFixed(1)}"
      height="${G.H - G.위 - G.아래}" class="pre"/><text x="${G.왼 + 6}" y="${G.위 + 14}" class="pt">기록 전</text>` : '';
  const 끝 = 점.at(-1);
  const 이름 = 지표들.find(x => x.k === 지표)?.이름 || '';
  return `<svg class="auchart" id="au_chart" viewBox="0 0 ${G.W} ${G.H}" role="img"
      aria-label="${esc(`${이름} — 지난 ${D.days}일 날마다`)}">
    ${격자}${흐림}
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
  const 최대 = 눈금올림(Math.max(1, ...값));
  const X = i => G.왼 + (n <= 1 ? (G.W - G.왼 - G.오) / 2 : i * (G.W - G.왼 - G.오) / (n - 1));
  const Y = v => G.위 + (G.H - G.위 - G.아래) * (1 - v / 최대);
  const 기록전 = i => 지표 === 'a' && (!D.since || xs[i].d < D.since);
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

/* ③ 사람들 — 새로 온 / 다시 온 · 가입 주별 재방문 */
function 사람들(D){
  const A = D.aud || {}, 새 = Number(A.new || 0), 다시 = Number(A.back || 0), 합 = 새 + 다시;
  const 쪼갬 = 합 ? `<div class="ausplit" role="img" aria-label="새로 온 사람 ${새}명, 다시 온 사람 ${다시}명">
      <i class="n" style="width:${(새 / 합 * 100).toFixed(1)}%"></i><i class="b" style="width:${(다시 / 합 * 100).toFixed(1)}%"></i></div>
      <div class="aulg"><span><i class="n"></i>새로 온 사람 ${수(새)}명</span><span><i class="b"></i>다시 온 사람 ${수(다시)}명</span></div>`
    : `<div class="empty">${D.since ? '이 기간에 앱을 연 기록이 없어요.' : '앱을 연 날은 오늘부터 쌓여요.'}</div>`;
  const 칸 = (n, size, ok, tracked) => !tracked ? '<td class="na">기록 전</td>'
    : !ok ? '<td class="na">아직</td>'
    : `<td>${Math.round(Number(n) / Math.max(1, Number(size)) * 100)}%<small>${수(n)}명</small></td>`;
  const 줄 = (D.cohort || []).map(c => `<tr><th scope="row">${짧은날(c.w)}~</th><td>${수(c.size)}명</td>
      ${칸(c.w1, c.size, c.ok1, c.tracked)}${칸(c.w4, c.size, c.ok4, c.tracked)}</tr>`).join('');
  return `<div class="card auc">
    <h2>사람들</h2>
    <p class="aunote" style="margin-top:0">지난 ${D.days}일 동안 앱을 연 ${수(합)}명</p>
    ${쪼갬}
    <div class="agrp">가입한 주마다 — 다시 왔나</div>
    ${줄 ? `<div class="autw"><table class="aucoh"><thead><tr><th>가입 주</th><th>가입</th><th>1주 안</th><th>한 달 안</th></tr></thead>
      <tbody>${줄}</tbody></table></div>` : `<div class="empty">최근 8주에 가입한 사람이 없어요.</div>`}
    <p class="aunote">1주 안 = 가입 다음 날부터 7일 안에 다시 연 사람 · 한 달 안 = 8~30일 사이에 연 사람</p>
  </div>`;
}

/* ④ 어디까지 가나 — 지금까지 가입한 사람 기준. 단계끼리 가장 많이 빠지는 곳을 짚습니다. */
function 어디까지(D){
  const F = D.funnel || {}, 전체 = Number(F.users || 0);
  const 단계 = [['가입', F.users], ['첫 별점', F.rated], ['성향 확정', F.persona], ['팔로우', F.follow], ['여행 만들기', F.trip]]
    .map(([l, v]) => [l, Number(v || 0)]);
  let 큰곳 = -1, 큰수 = 0;
  for (let i = 1; i < 단계.length; i++){ const 빠짐 = 단계[i - 1][1] - 단계[i][1]; if (빠짐 > 큰수){ 큰수 = 빠짐; 큰곳 = i; } }
  const 줄 = 단계.map(([l, v], i) => {
    const p = 전체 ? Math.round(v / 전체 * 100) : 0;
    return `<div class="aust${i === 큰곳 ? ' drop' : ''}"><span class="l">${esc(l)}</span>
      <div class="bar"><i style="width:${전체 ? (v / 전체 * 100).toFixed(1) : 0}%"></i></div>
      <span class="v">${수(v)}<small>${p}%</small></span></div>`;
  }).join('');
  return `<div class="card auc">
    <h2>어디까지 가나</h2>
    <p class="aunote" style="margin-top:0">지금까지 가입한 ${수(전체)}명이 어디까지 갔나</p>
    <div class="aufun">${줄}</div>
    ${큰곳 > 0 ? `<p class="aunote">가장 많이 멈추는 곳: <b>${esc(단계[큰곳 - 1][0])} → ${esc(단계[큰곳][0])}</b> (${수(큰수)}명)</p>` : ''}
  </div>`;
}

/* ⑤ 기능별 쓰임 — 이 기간에 쓴 사람(막대)과 몇 번 */
function 기능(D){
  const fs = (D.feat || []).map(f => ({ k: f.k, u: Number(f.u || 0), n: Number(f.n || 0) }))
    .sort((a, b) => b.u - a.u || b.n - a.n);
  const 최대 = Math.max(1, ...fs.map(f => f.u));
  const 줄 = fs.map(f => `<div class="aust${f.u ? '' : ' zero'}"><span class="l">${esc(f.k)}</span>
      <div class="bar"><i style="width:${(f.u / 최대 * 100).toFixed(1)}%"></i></div>
      <span class="v">${수(f.u)}명<small>${수(f.n)}${f.k === '별점' ? '개' : '번'}</small></span></div>`).join('');
  return `<div class="card auc">
    <h2>기능별 쓰임</h2>
    <p class="aunote" style="margin-top:0">지난 ${D.days}일 동안 쓴 사람(막대)과 횟수</p>
    <div class="aufun">${줄}</div>
    <p class="aunote">별점은 새로 매긴 개수 · 한줄평·일기는 그 기간에 손댄 곳 수예요</p>
  </div>`;
}

/* ⑥ 쌓인 것 — 지금까지 */
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

/* ── 누르기 ── 칸은 index.html 에 늘 있으므로 한 번만 답니다. */
$('adm_use')?.addEventListener('click', e => {
  const 기 = e.target.closest('[data-au-days]');
  if (기){ const n = Number(기.dataset.auDays); if (n !== 기간){ 기간 = n; loadUsage(); } return; }
  const 카 = e.target.closest('[data-au-k]');
  if (카){
    if (카.dataset.auK === 지표) return;
    지표 = 카.dataset.auK;
    document.querySelectorAll('#adm_use [data-au-k]').forEach(b => {
      const on = b.dataset.auK === 지표; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on));
    });
    const 판 = $('au_chartwrap');
    if (판 && 자료){ 판.innerHTML = 그래프(자료); 그래프잇기(); }
    return;
  }
  const 단 = e.target.closest('[data-au]');
  if (단) loadUsage(true);
});
