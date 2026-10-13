/* ── 성향 칸 더보기(b839) — 나를 만든 도시 · 성향 변천사 · 친구 중 여행 메이트 ─────────────────────────
 * 사용자(10-11): 분석 탭 아이디어에서 「성향 2,3,4 / 별점 1 만들자」.
 *   ③ 나를 만든 도시 — 네 축마다 나를 그쪽으로 끈 도시 둘을 사진으로(「왜 ○○○○인가요」의 그림판).
 *   ② 성향 변천사 — 별점을 매긴 차례대로 성향을 다시 세어 바뀐 순간을 줄 세웁니다.
 *   ④ 친구 중 여행 메이트 — 팔로우하는 사람들의 실제 유형으로 궁합(유형끼리 궁합 personaMatch 그대로).
 *   (별점 ①은 anal.js 「남들과 다른 내 별점」 — 여기 아님.)
 * ⚠ 성향은 card.js personaAxes 하나로만 셉니다 — 변천사도 같은 함수를 차례마다 부릅니다(흔들림 막기까지 그대로).
 *   여기서 축을 따로 세면 리포트의 코드와 변천사의 마지막 코드가 갈립니다.
 * ⚠ 변천사는 «지금» 매겨 둔 별점·다시 간 횟수로 다시 센 것입니다 — 옛 별점을 나중에 고쳤으면 그때와 다를 수 있어 카드에 밝힙니다.
 *   다시 센 마지막 코드가 화면의 코드와 다르면(흔들림 막기는 서버에 남은 지난 코드를 쓰므로) 「지금」 줄을 덧붙입니다.
 * ⚠ 친구 성향은 서버 friend_personas(db/119) — 팔로우 수락된 사람 · 비활성화·차단 뺌 · 볼 수 있는 사람만. 함수가 없으면 조용히 안 냅니다.
 * ⚠ 확정 전(해외 10곳 미만)에는 셋 다 안 냅니다(persona.js) — 흔들리는 코드로 지은 이야기는 같이 흔들립니다.
 * ⚠ 맨 바깥 이름은 한글로 둡니다 — tools/check-refs.mjs 가 영문 이름을 다른 파일과 견줍니다(b836 의 CSS 사고).
 * 층: dom · db · card(성향) · calc(거리). persona.js 가 부르고, 사람 화면은 누를 때 불러옵니다(people.js — 고리 없이). */
import { esc, emptyDo, josa, avatarImg } from './dom.js?v=b868';
import { sb } from './db.js?v=b868';
import { personaAxes, personaMatch, PERSONA16, AXIS_WORD, AXIS_NAME } from './card.js?v=b868';
import { distKm, SEOUL } from './calc.js?v=b868';

const 국내 = 'KR';
const 코드꼴 = /^[FH][ML][ND][GP]$/;
const 별글 = v => { const x = Math.round(Number(v) * 10) / 10; return Number.isInteger(x) ? String(x) : x.toFixed(1); };
/* 「2026년 3월」 — 서울 날짜로. */
const 달 = ts => {
  const d = new Date(ts || '');
  if (isNaN(d)) return '';
  const [y, m] = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).split('-').map(Number);
  return `${y}년 ${m}월`;
};
/* 사진은 http(s) 주소만 — 도시 표에서 오지만 화면 글에 그대로 들어가므로 한 번 거릅니다. */
/* ⚠ 정규식을 괄호로 감쌉니다 — 「return /…/」 꼴은 tools/check-refs.mjs 가 나눗셈으로 읽어 안의 $ 를 이름으로 셉니다. */
const 사진주소 = u => { const s = String(u || '').trim(); return (/^https?:\/\/\S+$/i).test(s) ? s : ''; };
/* 도시 사진 칸 — 「별점이 갈린 곳」과 같은 .gapim(사진이 없으면 이름 첫 글자). */
const 사진칸 = (c, 이름) => {
  const u = 사진주소(c?.image_url);
  return `<span class="gapim"${u ? ` style="background-image:url('${esc(u)}')"` : ''}>${u ? '' : esc([...String(이름 || '?')][0] || '?')}</span>`;
};
const 성향그림 = code => `./persona/t/${esc(code)}.jpg?v=b868`;

/* ══ ② 성향 변천사 ══════════════════════════════════════════════════════
 * 별점 줄(city_ratings — created_at 이 있는 것)을 매긴 차례로 세우고, 해외가 문턱(10곳)에 닿은 뒤로는 한 줄 더할 때마다
 * personaAxes 를 다시 불러 코드가 바뀌는 순간만 남깁니다. 흔들림 막기는 «바로 앞 코드»를 prev 로 넘겨 앱과 같은 규칙으로.
 * 돌려주는 값: [{ code, 전, at, city, stars, 해외수 }] — 첫 줄은 확정(전 = null). */
export function 성향흐름(rows, world, 문턱){
  const 도시들 = world?.cities || [];
  const 표 = new Map(도시들.map(c => [c.id, c]));
  const 순서 = (rows || []).filter(r => r.stars != null && r.created_at)
    .slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const 흐름 = [];
  let 전 = null, 해외수 = 0;
  for (let i = 0; i < 순서.length; i++){
    const c = 표.get(순서[i].city_id);
    if (c && c.country !== 국내) 해외수++;
    if (해외수 < 문턱) continue;
    const ax = personaAxes(순서.slice(0, i + 1), { cities: 도시들, prev: 전 });
    if (ax.code !== 전){
      흐름.push({ code: ax.code, 전, at: 순서[i].created_at, city: 순서[i].city_id, stars: Number(순서[i].stars), 해외수 });
      전 = ax.code;
    }
  }
  return 흐름;
}

export function 변천사Html(rows, world, 문턱, 지금코드){
  const 흐름 = 성향흐름(rows, world, 문턱);
  if (!흐름.length) return '';
  /* 다시 센 마지막과 화면의 코드가 다르면 「지금」 줄 — 흔들림 막기가 서버의 지난 코드를 쓰기 때문입니다(머리말). */
  if (코드꼴.test(지금코드 || '') && 흐름[흐름.length - 1].code !== 지금코드)
    흐름.push({ code: 지금코드, 전: 흐름[흐름.length - 1].code, at: null, city: null, 지금: true });
  const 도시들 = world?.cities || [];
  const 도시이름 = id => 도시들.find(c => c.id === id)?.name || String(id ?? '');
  /* 너무 길면 앞을 접습니다 — 흔들림 막기로 평생 한두 번이지만, 별점을 많이 고친 사람은 늘 수 있습니다. */
  const 보일 = 흐름.slice(-6), 접힘 = 흐름.length - 보일.length;
  const 줄 = 보일.map((s, i) => {
    /* 조사는 josa — 「세부」를 · 「강릉」을. 별은 정수 3(삼)만 「으로」, 나머지(일·이·사·오, .5)는 「로」. */
    const 을를 = id => `「${josa(도시이름(id), '」을', '」를')}`;
    const 무엇 = s.지금 ? '최근 별점으로'
      : !s.전 ? `해외 ${s.해외수}번째 도시 ${을를(s.city)} 매기며 확정`
      : `${을를(s.city)} ★${별글(s.stars)}${별글(s.stars) === '3' ? '으로' : '로'} 매긴 뒤`;
    const 바뀐축 = s.전 ? [...s.code].map((ch, k) => ch !== s.전[k]
      ? `${AXIS_NAME[k]} ${AXIS_WORD[s.전[k]]} → ${AXIS_WORD[ch]}` : '').filter(Boolean).join(' · ') : '';
    const 끝 = i === 보일.length - 1;
    return `<li class="phs${끝 ? ' now' : ''}">
      <img class="phimg" src="${성향그림(s.code)}" alt="" loading="lazy" decoding="async">
      <div class="phb"><span class="phd">${s.지금 ? '지금' : esc(달(s.at))}${끝 && !s.지금 ? ' · 지금' : ''}</span>
        <b>${esc(PERSONA16[s.code]?.n || s.code)}<span class="phc">${esc(s.code)}</span></b>
        <span class="phw">${esc(무엇)}</span>${바뀐축 ? `<span class="pha">${esc(바뀐축)}</span>` : ''}</div></li>`;
  }).join('');
  return `<div class="card phist"><h2>성향 변천사</h2>
    ${접힘 ? `<div class="memo">앞의 ${접힘}번은 접어 두었어요.</div>` : ''}
    <ol class="phl">${줄}</ol>
    ${흐름.length === 1 ? '<div class="memo">확정된 뒤로 한 번도 안 바뀌었어요.</div>' : ''}
    <div class="memo">지금 매겨 둔 별점으로 다시 센 흐름이에요. 예전에 준 별점을 나중에 고쳤다면 그때와 조금 다를 수 있어요.</div>
  </div>`;
}

/* ══ ③ 나를 만든 도시 ════════════════════════════════════════════════════
 * 축마다 «내 글자 쪽»으로 끈 해외 도시를 둘씩. 성향과 같은 기준입니다(국내는 네 축 어디에도 안 셈 — card.js).
 *   개척 F: 이름난 관광 도시(유명도 1) · H: 덜 알려진 곳(유명도 3) — 여러 번 간 곳부터.
 *   단골 L: 다시 간 도시(근거가 「다시」일 때) 또는 가장 몰린 나라의 도시 · M: 한 곳만 간 나라의 도시(먼 곳부터).
 *   모험 D: 서울에서 가장 먼 곳 · N: 가장 가까운 곳.
 *   만족 G: ★4.5 넘게 준 곳 · P: ★3 아래로 준 곳 — 어중간한 별은 「끈 도시」라고 하기 어렵습니다.
 * 못 정한 축(ax.추정 — 해외가 모자람)과 고를 도시가 없는 축은 줄을 안 냅니다.
 * 돌려주는 값: [{ i, 글자, 도시: [{ c, 이름, 말 }] }] */
export function 만든도시(rows, world, ax){
  const code = ax?.code || '';
  if (!코드꼴.test(code)) return [];
  const 표 = new Map((world?.cities || []).map(c => [c.id, c]));
  const 나라이름 = k => world?.나라이름?.[k] || k;
  const 해외 = (rows || []).filter(r => r.stars != null)
    .map(r => ({ r, c: 표.get(r.city_id) })).filter(x => x.c && x.c.country !== 국내);
  const 번 = x => Math.max(1, Math.round(Number(x.r.visits) || 1));
  const 별 = x => Number(x.r.stars);
  const km = x => x.c.center_lat != null && x.c.center_lng != null
    ? distKm(SEOUL[0], SEOUL[1], Number(x.c.center_lat), Number(x.c.center_lng)) : null;
  const 자주 = (a, b) => 번(b) - 번(a) || 별(b) - 별(a);
  const 축 = [];

  { const F = code[0] === 'F';
    축.push({ i: 0, 후보: 해외.filter(x => x.c.fame != null && (F ? Number(x.c.fame) <= 1 : Number(x.c.fame) >= 3)).sort(자주),
              말: () => F ? '이름난 관광 도시' : '덜 알려진 곳' }); }

  { const L = code[1] === 'L';
    if (L && ax.사실?.단골근거 === '다시')
      축.push({ i: 1, 후보: 해외.filter(x => 번(x) >= 2).sort(자주), 말: x => `${번(x)}번 감` });
    else if (L){
      const 나라 = ax.사실?.몰린나라;
      const 후보 = 해외.filter(x => x.c.country === 나라).sort(자주);
      축.push({ i: 1, 후보, 말: () => `${나라이름(나라)} ${후보.length}곳 중` });
    } else {
      const 셈 = {};
      for (const x of 해외) 셈[x.c.country] = (셈[x.c.country] || 0) + 1;
      축.push({ i: 1, 후보: 해외.filter(x => 셈[x.c.country] === 1).sort((a, b) => (km(b) ?? 0) - (km(a) ?? 0)),
                말: x => `${나라이름(x.c.country)}에선 여기만` });
    } }

  { const D = code[2] === 'D';
    축.push({ i: 2, 후보: 해외.filter(x => km(x) != null).sort((a, b) => D ? km(b) - km(a) : km(a) - km(b)),
              말: x => `${Math.round(km(x)).toLocaleString('ko-KR')}km` }); }

  { const G = code[3] === 'G';
    축.push({ i: 3, 후보: 해외.filter(x => G ? 별(x) >= 4.5 : 별(x) <= 3).sort((a, b) => G ? 별(b) - 별(a) : 별(a) - 별(b)),
              말: x => `★${별글(별(x))}` }); }

  /* 축마다 되도록 «다른» 도시를 — 도쿄가 개척·만족에 두 번 나오면 카드가 한 도시 이야기가 됩니다(시안에서 봄).
     앞 축에서 쓴 곳은 뒤로 미루고, 모자라면 그때 다시 씁니다. */
  const 쓴 = new Set();
  return 축.filter(a => !(ax.추정 || []).includes(AXIS_NAME[a.i]) && a.후보.length)
    .map(a => {
      const 고른 = [...a.후보.filter(x => !쓴.has(x.r.city_id)), ...a.후보.filter(x => 쓴.has(x.r.city_id))].slice(0, 2);
      고른.forEach(x => 쓴.add(x.r.city_id));
      return { i: a.i, 글자: code[a.i], 도시: 고른.map(x => ({ c: x.c, 이름: x.c.name || x.r.city_id, 말: a.말(x) })) };
    });
}

export function 만든도시Html(rows, world, ax){
  const 줄 = 만든도시(rows, world, ax);
  if (!줄.length) return '';
  return `<div class="card pmade"><h2>나를 만든 도시</h2>
    <div class="memo">네 축마다 나를 그쪽으로 끈 도시예요.</div>
    <div class="pmrows">${줄.map(a => `<div class="pmrow">
      <div class="pmh"><b>${esc(AXIS_NAME[a.i])}</b><span>${esc(AXIS_WORD[a.글자])} · ${esc(a.글자)}</span></div>
      <div class="pmcs">${a.도시.map(d => `<div class="pmc">${사진칸(d.c, d.이름)}
        <span class="pmt"><b>${esc(d.이름)}</b><span>${esc(d.말)}</span></span></div>`).join('')}</div>
    </div>`).join('')}</div>
  </div>`;
}

/* ══ ④ 친구 중 여행 메이트 ═══════════════════════════════════════════════
 * 내 코드와 친구 코드의 궁합(card.js personaMatch — 「여행 궁합」 카드와 같은 셈) 높은 순.
 * 둘 넘으면 맨 위 「환상의 메이트」 · 맨 아래 「극과 극」 딱지. 여덟 명까지, 넘치면 「외 N명」. */
export function 친구줄(내코드, 친구들){
  return (친구들 || []).filter(p => 코드꼴.test(p?.persona || ''))
    .map(p => ({ ...p, 점: personaMatch(내코드, p.persona) }))
    .sort((a, b) => b.점 - a.점 || String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
}

export async function 친구메이트Html(내코드){
  const r = await sb.rpc('friend_personas');
  /* db/119 를 안 돌렸으면 함수가 없습니다 — 카드를 안 냅니다(고장처럼 보이는 빈 상자를 띄우지 않음). */
  if (r.error) return '';
  return 친구카드Html(내코드, r.data);
}
/* 그리기만 따로 — 자가검사가 서버 없이 봅니다. */
export function 친구카드Html(내코드, 친구들){
  const 줄 = 친구줄(내코드, 친구들);
  if (!줄.length) return `<div class="card"><h2>친구 중 여행 메이트</h2>${emptyDo(
    '팔로우한 친구가 성향을 확정하면 나와 가장 잘 맞는 친구를 알려줘요', '친구 찾기', 'findfriend')}</div>`;
  const 보일 = 줄.slice(0, 8);
  const 둘넘 = 줄.length >= 2;
  return `<div class="card pfmates"><h2>친구 중 여행 메이트</h2>
    <div class="pfl">${보일.map((p, i) => {
      const 딱지 = 둘넘 && i === 0 ? ['good', '환상의 메이트'] : 둘넘 && i === 줄.length - 1 ? ['bad', '극과 극'] : null;
      /* ⚠ 이름이 없으면 「여행자」 — 친구 목록·사람 화면과 같은 말(b799 사용자: 「이름 없음」→「여행자」). b839 첫 판은
           「이름 없음」이라 실제 계정에서 어긋났습니다(10-11 크롬으로 재 봄). 얼굴도 친구 목록과 같은 avatarImg —
           사진이 없거나 깨지면 이름 첫 글자 동그라미. */
      const 이름 = String(p.name || '').trim() || '여행자';
      return `<button type="button" class="pfrow" data-person="${esc(p.user_id)}">
        ${avatarImg(사진주소(p.avatar_url), p.user_id, 이름, '', 'pfav')}
        <span class="pfn"><b>${esc(이름)}</b><span>${esc(PERSONA16[p.persona]?.n || p.persona)} · ${esc(p.persona)}</span></span>
        <span class="pfs${딱지 ? ' ' + 딱지[0] : ''}"><b>${p.점}%</b>${딱지 ? `<span>${딱지[1]}</span>` : ''}</span>
      </button>`;
    }).join('')}</div>
    ${줄.length > 보일.length ? `<div class="memo">외 ${줄.length - 보일.length}명</div>` : ''}
  </div>`;
}

/* ── persona.js 가 리포트를 다 그린 뒤 부릅니다 ── 자리(#pm_friends · #pm_cities · #pm_hist)는 persona.js 의 틀에 있습니다.
   하나가 터져도 나머지는 그립니다. 친구는 서버를 기다리므로 늦게 들어옵니다(자리를 먼저 잡아 두어 아래가 안 튐 — 카드 높이만큼은 밀림). */
export function 성향더보기({ ax, code, rates, world, 문턱 }){
  const 넣기 = (id, 만들기) => {
    const 칸 = document.getElementById(id);
    if (!칸) return;
    try { 칸.innerHTML = 만들기() || ''; }
    catch (e){ console.error('@pmore', e); self.reportError?.(e); }
  };
  넣기('pm_cities', () => 만든도시Html(rates, world, ax));
  넣기('pm_hist', () => 변천사Html(rates, world, 문턱, code));
  const 친구칸 = document.getElementById('pm_friends');
  if (!친구칸) return;
  친구메이트Html(code).then(html => {
    if (!친구칸.isConnected) return;               /* 그사이 리포트를 새로 그렸으면 버립니다 */
    친구칸.innerHTML = html;
    친구칸.onclick = e => {
      const b = e.target.closest('[data-person]');
      if (b) import('./people.js?v=b868').then(m => m.openPerson(b.dataset.person));
    };
  }).catch(e => { console.error('@pmore', e); self.reportError?.(e); });
}

/* ── 자가검사 — CI 가 돌립니다. 지어낸 도시·별점으로 규칙만 봅니다(서버 안 씀). ── */
if (typeof window !== 'undefined') window.__pmoreCheck = () => {
  const out = [];
  const 봄 = (항목, ok, 왜 = '') => out.push({ 항목, 결과: ok ? '✓' : '✗ ' + 왜 });
  /* 해외 열두 곳(일본 넷 · 태국 셋 · 프랑스 셋 · 미국 둘) + 국내 하나 */
  const 도시 = [
    ['tokyo', 'JP', 1, 35.68, 139.69], ['osaka', 'JP', 1, 34.69, 135.50], ['beppu', 'JP', 3, 33.28, 131.49], ['nara', 'JP', 2, 34.68, 135.80],
    ['bangkok', 'TH', 1, 13.75, 100.50], ['pai', 'TH', 3, 19.36, 98.44], ['krabi', 'TH', 2, 8.09, 98.91],
    ['paris', 'FR', 1, 48.86, 2.35], ['colmar', 'FR', 3, 48.08, 7.36], ['nice', 'FR', 2, 43.70, 7.27],
    ['nyc', 'US', 1, 40.71, -74.01], ['sedona', 'US', 3, 34.87, -111.76], ['gangneung', 'KR', 2, 37.75, 128.88],
  ].map(([id, country, fame, lat, lng]) => ({ id, name: id, country, fame, center_lat: lat, center_lng: lng }));
  const world = { cities: 도시, 나라이름: { JP: '일본', TH: '태국', FR: '프랑스', US: '미국' } };
  const 날 = i => `2026-0${1 + Math.floor(i / 10)}-${String(1 + (i % 10) * 2).padStart(2, '0')}T03:00:00Z`;
  /* 처음 열 곳은 ★5 — 후함(G). 뒤에 ★1 열 곳(같은 도시를 다시 매긴 것처럼 곳은 겹쳐도 됨) → 까다로움(P)으로. */
  const 해외id = 도시.filter(c => c.country !== 'KR').map(c => c.id);
  const 앞 = 해외id.slice(0, 10).map((id, i) => ({ city_id: id, stars: 5, created_at: 날(i) }));
  const 뒤 = 해외id.slice(10).concat(해외id.slice(0, 8)).map((id, i) => ({ city_id: id + '_2', stars: 1, created_at: 날(10 + i) }));
  /* 뒤의 줄은 다른 도시여야 별점이 따로 셉니다 — 같은 모양의 도시를 _2 로 하나 더 둡니다. */
  for (const r of 뒤){ const 원 = 도시.find(c => c.id === r.city_id.replace(/_2$/, '')); if (원 && !도시.some(c => c.id === r.city_id)) 도시.push({ ...원, id: r.city_id }); }
  const 아홉 = 성향흐름(앞.slice(0, 9), world, 10);
  봄('해외 아홉 곳이면 변천사 없음', 아홉.length === 0, `${아홉.length}줄`);
  const 흐름 = 성향흐름([...앞, ...뒤, { city_id: 'gangneung', stars: 3, created_at: 날(5) }], world, 10);
  봄('열 번째 해외 도시에서 첫 확정', 흐름[0]?.해외수 === 10 && 흐름[0]?.전 === null, JSON.stringify(흐름[0]));
  봄('별점이 짜지면 만족력이 G → P', 흐름.some(s => s.전 && s.전[3] === 'G' && s.code[3] === 'P'), 흐름.map(s => s.code).join('→'));
  const 끝코드 = 흐름[흐름.length - 1]?.code;
  const 다른지금 = 끝코드 && (끝코드[0] === 'F' ? 'H' : 'F') + 끝코드.slice(1);
  봄('다시 센 끝과 화면 코드가 다르면 「지금」 줄', 변천사Html([...앞, ...뒤], world, 10, 다른지금).includes('>지금<'), '없음');
  봄('변천사 그림은 성향 작은 그림', 변천사Html(앞, world, 10, null).includes('./persona/t/'), '그림 없음');

  const 줄들 = [...앞, { city_id: 'pai', stars: 2, visits: 3 }].map((r, i) => ({ ...r, visits: r.visits ?? (i === 1 ? 4 : 1) }));
  const 축D = 만든도시(줄들, world, { code: 'HLDP', 사실: { 단골근거: '다시' }, 추정: [] });
  const 모험 = 축D.find(a => a.i === 2), 단골 = 축D.find(a => a.i === 1), 만족 = 축D.find(a => a.i === 3), 개척 = 축D.find(a => a.i === 0);
  /* 가장 먼 곳은 짐작하지 않고 잽니다(니스·파리·콜마르가 서로 엇비슷). */
  const 먼순 = 앞.map(r => 도시.find(c => c.id === r.city_id))
    .map(c => [c.id, distKm(SEOUL[0], SEOUL[1], c.center_lat, c.center_lng)]).sort((a, b) => b[1] - a[1]);
  봄('모험 D — 서울에서 가장 먼 곳부터', 모험?.도시?.[0]?.이름 === 먼순[0][0] && 모험?.도시?.[1]?.이름 === 먼순[1][0],
    JSON.stringify([모험?.도시?.map(d => d.이름), 먼순.slice(0, 2)]));
  봄('단골 L(다시) — 여러 번 간 곳부터', 단골?.도시?.[0]?.이름 === 'osaka' && /4번/.test(단골?.도시?.[0]?.말 || ''), JSON.stringify(단골?.도시));
  봄('만족 P — ★3 아래만', 만족?.도시?.every(d => /★[12]/.test(d.말)) && 만족?.도시?.length >= 1, JSON.stringify(만족?.도시?.map(d => d.말)));
  봄('개척 H — 덜 알려진 곳만', 개척?.도시?.every(d => ['beppu', 'pai', 'colmar', 'sedona'].includes(d.이름)), JSON.stringify(개척?.도시?.map(d => d.이름)));
  봄('못 정한 축은 줄 없음', !만든도시(줄들, world, { code: 'HLDP', 사실: {}, 추정: ['모험력'] }).some(a => a.i === 2), '모험 줄이 있음');

  const 친구 = 친구줄('FMNP', [{ user_id: 'a', name: '<b>민지</b>', persona: 'HLDG' }, { user_id: 'b', name: '준', persona: 'FMNP' },
                                { user_id: 'c', name: '코드없음', persona: null }]);
  봄('친구는 궁합 높은 순 · 코드 없는 사람 뺌', 친구.length === 2 && 친구[0].점 >= 친구[1].점, JSON.stringify(친구.map(p => [p.name, p.점])));
  const 카드 = 친구카드Html('FMNP', [{ user_id: 'a', name: '<b>민지</b>', persona: 'HLDG' }, { user_id: 'b', name: null, persona: 'FMNP' }]);
  봄('이름 없는 친구는 「여행자」', 카드.includes('<b>여행자</b>') && !카드.includes('이름 없음'), '「여행자」 아님');
  봄('친구 이름은 글자로만(이스케이프)', 카드.includes('&lt;b&gt;민지') && !카드.includes('<b><b>'), '이스케이프 안 됨');
  봄('둘 넘으면 환상의 메이트 · 극과 극 딱지', 카드.includes('환상의 메이트') && 카드.includes('극과 극'), '딱지 없음');
  return out;
};
