/* ── 내 기록 보기 파일(b836 · 다시 짬 b837) ─────────────────────────────────
 * 「설정 → 내 자료」에서 받는, 사람이 읽는 HTML 파일 한 장입니다.
 * 사용자(10-08): 「기록을 json 파일로 받는다는데 일반 유저들은 이게 무슨 파일인지 모르는데 나도 잘 몰라
 *   무슨 프로그램으로 열어야할지」 → 「1,2 둘다하자」.
 * 인스타그램(메타) 「내 정보 받기」처럼 둘로 나눕니다 — 보기용(이 파일) · 옮기기용(account.js 의 JSON).
 *   JSON 은 그대로 둡니다. 처리방침 「전송 요구 — 내려받기로 받은 파일(JSON)」이 그 파일입니다.
 * ⚠⚠ **b837 에 다시 짰습니다.** 사용자(10-08): 「세계지도도 안 들어 있고 그냥 줄글만 줄줄인데」.
 *   첫 판은 기록을 빠짐없이 «늘어놓기»만 했습니다. 이제 앱·탑승권 카드와 같은 모습입니다 —
 *   표지(큰 숫자 넷 · 여행 성향) → 세계지도(간 나라 주황 · 대륙 막대 · 많이 간 나라) → 도시 사진 카드 →
 *   엽서 일기 → 여행 카드(자세한 일정·지출은 눌러야 펼쳐짐) → 장소 별점 → AI 대화(접힘) → 프로필.
 * ⚠ **스크립트 없이 보이는 종이 한 장**입니다. 아이폰 「파일」 앱 미리보기처럼 스크립트를 안 돌리는 곳에서도
 *   열리게 — 글·지도는 여기서 다 만들어 넣고, 접기는 <details>(스크립트 없이 됨)로 합니다.
 * ⚠ **모든 글은 esc() 를 지납니다.** 일정 제목·메모·AI 답은 사람이 쓴 글입니다. 링크·사진은 http(s) 주소만 —
 *   `javascript:` 주소를 적어 둔 링크가 이 파일 안에서 눌리면 안 됩니다.
 * ⚠ 지도·숫자는 **앱 지도·탑승권과 같은 길**입니다(account.js 가 my_visited → map.js `발자국스펙` 으로 세어
 *   opt.발자국 으로 넘김). 여기서 따로 세면 탑승권은 12개국인데 파일은 11개국이라고 말하게 됩니다.
 * ⚠ 도시 사진은 파일에 넣지 않고 주소만 겁니다 — 넣으면 수십 MB 입니다. 인터넷이 될 때만 보이고,
 *   안 되면 도시 이름 첫 글자가 든 색 칸이 남습니다.
 * ⚠ 지운 것(deleted_at)은 뺍니다 — 휴지통 것까지 섞이면 기록이 아니라 찌꺼기입니다. JSON 에는 그대로 있습니다.
 * ⚠ 받는 표는 account.js 의 TABLES 그대로입니다. 표를 더하면 여기서 «어디에 보일지»도 정하십시오.
 * ⚠ 맨 바깥 이름은 한글로 둡니다 — 영문(예: CSS)이면 브라우저 내장 이름과 겹쳐 tools/check-refs.mjs 가
 *   그 내장을 쓰는 다른 파일을 잡습니다(b836 CI 빨강).
 * 층: dom(esc) · cities(도시) · card(성향 이름·네 축) · world(지도 좌표). account.js 가 누를 때 불러옵니다.
 */
import { esc } from './dom.js?v=b837';
import { cities, countryName } from './cities.js?v=b837';
import { PERSONA16, AXIS_WORD } from './card.js?v=b837';
import { WORLD_PATHS } from './world.js?v=b837';

const 요일 = ['일', '월', '화', '수', '목', '금', '토'];
const 쪼개기 = s => String(s || '').slice(0, 10).split('-').map(Number);
/* 「2026년 10월 8일 (목)」 — date 칸은 서울 날짜 글자 그대로 옵니다. */
function 긴날(s){
  const [y, m, d] = 쪼개기(s);
  if (!y || !m || !d) return '';
  return `${y}년 ${m}월 ${d}일 (${요일[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}
function 짧은날(s){
  const [y, m, d] = 쪼개기(s);
  return y && m && d ? `${m}월 ${d}일` : '';
}
/* 여행 기간 — 같은 해면 뒤쪽 해를 뺍니다. 끝날이 없거나 같으면 하루. */
function 기간(a, b){
  const [y1] = 쪼개기(a), [y2] = 쪼개기(b);
  if (!y1) return '';
  if (!y2 || String(a).slice(0, 10) === String(b).slice(0, 10)) return 긴날(a);
  return `${y1}년 ${짧은날(a)} ~ ${y1 === y2 ? '' : y2 + '년 '}${짧은날(b)}`;
}
/* 「2박 3일」 — 같은 날이면 「당일」. */
function 박일(a, b){
  const [y1, m1, d1] = 쪼개기(a), [y2, m2, d2] = 쪼개기(b || a);
  if (!y1 || !y2) return '';
  const n = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5) + 1;
  return n > 1 ? `${n - 1}박 ${n}일` : n === 1 ? '당일' : '';
}
const 시각 = t => t ? String(t).slice(0, 5) : '';
/* 만든 때(timestamptz) — 서울 시각으로. */
function 때(ts){
  const t = new Date(ts || '');
  if (isNaN(t)) return '';
  return t.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
                                      hour: '2-digit', minute: '2-digit' });
}
/* 받은 날(서울) — 「YYYY-MM-DD」. sv-SE 꼴이 딱 그 모양입니다. */
const 서울날 = ts => new Date(ts || Date.now()).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const 수 = v => Number(v ?? 0).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
const 별 = v => v == null ? '' : `★ ${Number(v).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}`;
/* 누를 수 있는 주소·사진 주소는 http(s) 뿐입니다. */
const 안전주소 = u => { const s = String(u || '').trim(); return /^https?:\/\/\S+$/i.test(s) ? s : ''; };
const 글 = s => esc(String(s ?? '').trim());
const 있나 = s => String(s ?? '').trim() !== '';
const 남은것 = r => r && !r.deleted_at;
const 칩 = s => 있나(s) ? ` <span class="chip">${글(s)}</span>` : '';
const 메모 = (s, 더 = '') => 있나(s) ? `<p class="memo${더}">${글(s)}</p>` : '';
const 공개 = { public: '공개', private: '비공개', off: '비활성화' };
const 글자크기 = v => ({ 0.9: '작게', 1: '보통', 1.15: '크게' })[Math.round(Number(v) * 100) / 100] || (v == null ? '' : String(v));
/* 접는 칸 — 스크립트 없이 눌러서 펼칩니다. 제목은 이미 이스케이프한 글을 받습니다. */
const 접기 = (제목, 몸, 더 = '') => `<details${더}><summary>${제목}</summary><div class="dt">${몸}</div></details>`;
/* 지도 칠 — 간 나라 경로에만 class="been". 앱 지도처럼 화면(DOM)을 빌리지 않고 좌표 글에서 바로 칠합니다. */
const 칠한지도 = (경로들, 코드들) => {
  const 갔다 = new Set(코드들 || []);
  return String(경로들 || '').replace(/<path data-c="([A-Z]{2})"/g, (m, c) => 갔다.has(c) ? `${m} class="been"` : m);
};
/* 사진 칸 — 사진이 안 오면(인터넷 없음) 도시 이름 첫 글자가 든 색 칸이 남습니다. */
const 사진칸 = (c, 이름) => {
  const u = 안전주소(c?.image_url || c?.image_lg);
  return `<div class="ph"><span class="ini" aria-hidden="true">${esc([...String(이름 || '?')][0] || '?')}</span>${
    u ? `<img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</div>`;
};

/* ── 파일 한 장 ──
 * out: account.js 가 모은 { app, savedAt, user, data:{표 이름: 줄들}, failed } 그대로.
 * opt.발자국: map.js `발자국스펙` 이 낸 것(나라·도시·대륙 수, 대륙 막대, 많이 간 나라, 등급). 없으면 별점에서 셉니다.
 * opt.도시 · opt.세계: 시험용 — 도시 찾기 (id) => {name, country, image_url} · 지도 좌표 글. */
export function 보기파일(out, opt = {}){
  const D = out?.data || {};
  const me = out?.user || '';
  const 표 = k => Array.isArray(D[k]) ? D[k] : [];
  const 발 = opt.발자국 || null;
  const 세계 = opt.세계 ?? WORLD_PATHS;

  const 프로필 = new Map(표('profiles').map(p => [p.id, p]));
  const 나 = 프로필.get(me) || {};
  const 도시표 = new Map((cities || []).map(c => [c.id, c]));
  const 도시 = opt.도시 || (id => 도시표.get(id));
  const 도시이름 = id => 도시(id)?.name || String(id ?? '');
  const 도시나라 = id => { const c = 도시(id); return c ? (countryName[c.country] || c.country || '') : ''; };

  /* 여행마다 묶기 — 지운 것은 여기서 빠집니다. 여행 밖 줄(trip_id 없음)은 '' 칸으로. */
  const 묶기 = k => {
    const m = new Map();
    for (const r of 표(k)) if (남은것(r)){
      const id = r.trip_id ?? '';
      if (!m.has(id)) m.set(id, []);
      m.get(id).push(r);
    }
    return m;
  };
  const 구간 = 묶기('trip_legs'), 일행 = 묶기('trip_members'), 일정 = 묶기('plans'), 지출 = 묶기('expenses'),
        예약 = 묶기('bookings'), 짐 = 묶기('packing'), 링크 = 묶기('links'), 후보 = 묶기('candidates'),
        후기 = 묶기('trip_reviews'), 대화 = 묶기('chats');

  /* 이름 — 그 여행에서 쓴 별명이 먼저, 없으면 프로필 이름. 나는 「(나)」. */
  const 이름 = (uid, tripId) => {
    if (!uid) return '';
    const m = (일행.get(tripId) || []).find(x => x.user_id === uid);
    const n = String(m?.nickname || 프로필.get(uid)?.display_name || '').trim();
    return uid === me ? (n ? `${n}(나)` : '나') : (n || '이름 모름');
  };

  /* 최근 여행이 위로. 날짜가 같으면 이름 순. */
  const 여행들 = 표('trips').slice().sort((a, b) =>
    String(b.start_date || '').localeCompare(String(a.start_date || '')) ||
    String(a.title || '').localeCompare(String(b.title || ''), 'ko'));
  const 여행제목 = new Map(여행들.map(t => [t.id, String(t.title || '').trim() || '이름 없는 여행']));

  /* ── 별점 · 일기 — 내 것만(표 권한도 내 것만 주지만, 한 번 더 거릅니다). ── */
  const 별점들 = 표('city_ratings').filter(r => !me || r.user_id === me);
  const 매김 = 별점들.filter(r => r.stars != null).sort((a, b) =>
    Number(b.stars) - Number(a.stars) || 도시이름(a.city_id).localeCompare(도시이름(b.city_id), 'ko'));
  const 가봄만 = 별점들.filter(r => r.stars == null && r.been);
  const 가고픈 = 별점들.filter(r => r.want && !r.been && r.stars == null);
  const 일기 = 별점들.filter(r => 있나(r.journal)).sort((a, b) =>
    String(b.visited_on || b.updated_at || '').localeCompare(String(a.visited_on || a.updated_at || '')));
  const 일정이름 = new Map(표('plans').map(p => [p.id, p]));       /* 지운 일정이라도 이름은 찾습니다 */
  const 맛 = 표('plan_ratings').filter(r => !me || r.user_id === me).sort((a, b) => Number(b.stars || 0) - Number(a.stars || 0));
  const n대화 = 표('chats').length;

  /* 큰 숫자 넷 — 발자국(앱 지도와 같은 셈)이 있으면 그것, 없으면 별점의 「가 봄」에서. */
  const 간도시 = 발 ? null : 별점들.filter(r => r.been || r.stars != null);
  const 나라수 = 발 ? 발.countries
    : new Set(간도시.map(r => 도시(r.city_id)?.cc || 도시(r.city_id)?.country).filter(Boolean)).size;
  const 도시수 = 발 ? 발.cities : 간도시.length;

  /* ── 여행 한 장 ── */
  function 여행칸(t){
    const id = t.id;
    const legs = (구간.get(id) || []).slice()
      .sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
    const 곳 = (legs.length ? legs.map(l => l.destination || 도시이름(l.city_id))
                            : [t.destination || (t.city_id ? 도시이름(t.city_id) : '')]).filter(Boolean);
    const 사람 = (일행.get(id) || []).filter(m => !m.left_at);
    const 접은것 = [];

    const ps = (일정.get(id) || []).slice().sort((a, b) =>
      String(a.date || '').localeCompare(String(b.date || '')) ||
      String(a.start_time || '99').localeCompare(String(b.start_time || '99')) ||
      (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
    if (ps.length){
      const 날들 = new Map();
      for (const p of ps){ const k = p.date || ''; if (!날들.has(k)) 날들.set(k, []); 날들.get(k).push(p); }
      접은것.push(접기(`일정 <small>${ps.length}개</small>`, [...날들].map(([d, xs]) => `
        <div class="day"><p class="dl">${d ? 긴날(d) : '날짜 없음'}</p><ul class="plans">${xs.map(p => `
          <li><span class="tm">${esc(시각(p.start_time))}${p.end_time ? '–' + esc(시각(p.end_time)) : ''}</span><div class="bd">
            <b>${글(p.title) || '(제목 없음)'}</b>${칩(p.category)}${메모(p.memo)}${
            있나(p.move_note) ? `<p class="memo mv">이동 · ${글(p.move_note)}</p>` : ''}</div></li>`).join('')}
        </ul></div>`).join('')));
    }

    const es = (지출.get(id) || []).slice().sort((a, b) =>
      String(a.date || '').localeCompare(String(b.date || '')) ||
      String(a.created_at || '').localeCompare(String(b.created_at || '')));
    const 합 = new Map(); let 집합 = 0, 집있음 = false;
    for (const e of es){
      const c = String(e.currency || '').trim();
      합.set(c, (합.get(c) || 0) + Number(e.amount || 0));
      if (e.amount_home != null){ 집합 += Number(e.amount_home) || 0; 집있음 = true; }
    }
    const 집돈 = String(t.home_currency || '').trim();
    const 원화 = 집있음 && 집돈 === 'KRW' ? `${수(Math.round(집합))}원` : '';
    const 합글 = [...합].map(([c, v]) => `${수(v)} ${esc(c)}`).join(' · ');
    if (es.length) 접은것.push(접기(`지출 <small>${es.length}건 · ${합글}</small>`, `
        <div class="tw"><table><thead><tr><th>날짜</th><th>내용</th><th class="n">금액</th></tr></thead>
        <tbody>${es.map(e => {
          /* 낸 사람 · 결제 · 분류는 내용 아래 작은 줄로 — 칸을 다섯으로 나누면 휴대폰 폭에서 「카/드」로 쪼개집니다(실측 375px). */
          const 곁 = [esc(이름(e.payer_id, id)), 글(e.method), 글(e.category)].filter(Boolean);
          return `<tr><td class="nw">${esc(짧은날(e.date))}</td>
          <td><b class="w5">${글(e.title) || '(내용 없음)'}</b>${곁.length ? `<div class="sub">${곁.join(' · ')}</div>` : ''}${메모(e.memo)}</td>
          <td class="n nw">${수(e.amount)} ${글(e.currency)}</td></tr>`;
        }).join('')}
        </tbody></table></div>
        <p class="sum">합계 · ${합글}${집있음 && 집돈 ? ` <span class="sub in">(${원화 ? `원화로 ${원화}` : `${esc(집돈)}로 바꾸면 ${수(집합)}`})</span>` : ''}</p>`));

    const bs = (예약.get(id) || []).slice().sort((a, b) =>
      String(a.start_date || '').localeCompare(String(b.start_date || '')) ||
      String(a.start_time || '').localeCompare(String(b.start_time || '')));
    if (bs.length) 접은것.push(접기(`예약 <small>${bs.length}건</small>`, `<ul class="list">${bs.map(b => {
      const 언제 = b.start_date ? [기간(b.start_date, b.end_date), [시각(b.start_time), 시각(b.end_time)].filter(Boolean).join('–')]
                                    .filter(Boolean).join(' ') : '';
      const 줄 = [esc(언제), 있나(b.ref) ? '예약 번호 ' + 글(b.ref) : '', 글(b.address), 있나(b.tel) ? '전화 ' + 글(b.tel) : ''].filter(Boolean);
      return `<li><b>${글(b.title) || '(이름 없음)'}</b>${칩(b.kind)}${줄.length ? `<p class="sub">${줄.join(' · ')}</p>` : ''}${메모(b.memo)}</li>`;
    }).join('')}</ul>`));

    const ks = (짐.get(id) || []).slice().sort((a, b) =>
      String(a.category || '').localeCompare(String(b.category || ''), 'ko') ||
      (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
    const 챙김 = ks.filter(k => k.done).length;
    if (ks.length) 접은것.push(접기(`준비물 <small>${ks.length}개 중 ${챙김}개 챙김</small>`, `<ul class="checks">${ks.map(k =>
      `<li class="${k.done ? 'done' : ''}"><span class="box" aria-hidden="true">${k.done ? '✓' : ''}</span>
        <span>${글(k.title)}${칩(k.category)}${있나(k.memo) ? ` <span class="sub in">${글(k.memo)}</span>` : ''}</span></li>`).join('')}</ul>`));

    const ls = (링크.get(id) || []).slice().sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
    if (ls.length) 접은것.push(접기(`링크 <small>${ls.length}개</small>`, `<ul class="list">${ls.map(l => {
      const u = 안전주소(l.url);
      return `<li><b>${글(l.title) || 글(l.url) || '(이름 없음)'}</b>${칩(l.category)}${
        u ? `<p class="sub"><a href="${esc(u)}" rel="noopener noreferrer">${esc(u)}</a></p>`
          : 있나(l.url) ? `<p class="sub">${글(l.url)}</p>` : ''}${메모(l.memo)}</li>`;
    }).join('')}</ul>`));

    const cs = 후보.get(id) || [];
    if (cs.length) 접은것.push(접기(`가 볼 후보 <small>${cs.length}곳</small>`, `<ul class="list">${cs.map(c => {
      const u = 안전주소(c.url);
      const 줄 = [글(c.address), 있나(c.hours) ? '영업 ' + 글(c.hours) : '', 글(c.price_range)].filter(Boolean);
      return `<li><b>${글(c.title) || '(이름 없음)'}</b>${있나(c.title_local) ? ` <span class="sub in">${글(c.title_local)}</span>` : ''}${칩(c.category)}${
        줄.length ? `<p class="sub">${줄.join(' · ')}</p>` : ''}${메모(c.memo)}${
        u ? `<p class="sub"><a href="${esc(u)}" rel="noopener noreferrer">${esc(u)}</a></p>` : ''}</li>`;
    }).join('')}</ul>`));

    /* 한눈에 보는 숫자 — 펼치지 않아도 이 여행이 어땠는지 보이게. */
    const 숫자 = [
      ps.length ? [String(ps.length), '일정'] : null,
      es.length ? [원화 || (합.size === 1 ? 합글 : `${es.length}건`), '지출'] : null,
      bs.length ? [String(bs.length), '예약'] : null,
      ks.length ? [`${챙김}/${ks.length}`, '준비물'] : null,
    ].filter(Boolean);
    const rs = 후기.get(id) || [];
    const n이대화 = (대화.get(id) || []).length;
    const 줄 = [곳.length ? `<p class="route">${곳.map(글).join(' → ')}</p>` : '',
                사람.length > 1 ? `<p class="sub">함께 간 사람 ${사람.map(m => esc(이름(m.user_id, id))).join(', ')}</p>` : ''].join('');
    return `<article class="trip" id="t-${esc(id)}">
      ${t.start_date ? `<p class="when">${esc(기간(t.start_date, t.end_date))}${박일(t.start_date, t.end_date) ? ` <span>${박일(t.start_date, t.end_date)}</span>` : ''}</p>` : ''}
      <h3>${esc(여행제목.get(id))}</h3>${줄}
      ${숫자.length ? `<ul class="tnum">${숫자.map(([v, k]) => `<li><b>${v}</b><span>${k}</span></li>`).join('')}</ul>` : ''}
      ${rs.map(r => `<div class="rv"><span class="star">${별(r.stars)}</span>${있나(r.comment) ? ` ${글(r.comment)}` : ''}
        <span class="sub in">— ${esc(이름(r.user_id, id))}</span></div>`).join('')}
      ${접은것.join('') || '<p class="empty">이 여행에 적어 둔 것이 없어요.</p>'}
      ${n이대화 ? `<p class="more"><a href="#ai-${esc(id)}">이 여행에서 나눈 AI 대화 ${n이대화}개 ↓</a></p>` : ''}
    </article>`;
  }

  /* ── 칸들 ── [열쇠, 제목, 몇, 몸] */
  const 칸 = [];
  if (발) 칸.push(['map', '다녀온 나라', `${발.countries}개국`, `
    <figure class="map"><svg viewBox="0 19 1000 387" role="img" aria-label="다녀온 나라를 주황으로 칠한 세계지도">${칠한지도(세계, 발.codes)}</svg></figure>
    <p class="mapcap"><b>${esc(발.total)}개국 중 ${esc(발.countries)}개국</b> · ${esc(Number(발.pct || 0).toFixed(1))}%${발.rank ? ` · ${esc(발.rank)}` : ''}</p>
    ${(발.byCont || []).length ? `<div class="conts">${발.byCont.map(([k, 분모, n]) => `
      <div class="cont"><span class="ck">${esc(k)}</span><span class="cb"><i style="width:${분모 ? Math.min(100, n / 분모 * 100).toFixed(1) : 0}%"></i></span>
        <span class="cv"><b>${esc(n)}</b>/${esc(분모)}</span></div>`).join('')}</div>` : ''}
    ${(발.top || []).length ? `<h4>가장 많이 간 나라</h4><ol class="topc">${발.top.map(([이름, n], i) => `
      <li><span class="rk">${i + 1}</span><b>${esc(이름)}</b><span class="n">${esc(n)}곳</span></li>`).join('')}</ol>` : ''}`]);
  if (매김.length || 가봄만.length || 가고픈.length) 칸.push(['rates', '별점 남긴 도시', `${매김.length}곳`, `
    ${매김.length ? `<div class="cards">${매김.map(r => {
      const c = 도시(r.city_id), n = 도시이름(r.city_id);
      return `<article class="cc">${사진칸(c, n)}<div class="ccb">
        <p class="cn"><b>${esc(n)}</b>${도시나라(r.city_id) ? ` <span class="sub in">${esc(도시나라(r.city_id))}</span>` : ''}</p>
        <p class="star">${별(r.stars)}</p>${있나(r.comment) ? `<p class="cm">${글(r.comment)}</p>` : ''}
        ${r.visited_on || Number(r.visits) > 1 ? `<p class="sub">${[짧은날(r.visited_on) ? `${쪼개기(r.visited_on)[0]}년 ${짧은날(r.visited_on)}` : '',
          Number(r.visits) > 1 ? `${Number(r.visits)}번 감` : ''].filter(Boolean).map(s => `<span class="nw">${esc(s)}</span>`).join(' · ')}</p>` : ''}
      </div></article>`;
    }).join('')}</div>` : ''}
    ${가봄만.length ? `<h4>별점 없이 가 본 곳 <small>${가봄만.length}곳</small></h4><ul class="chips">${
      가봄만.map(r => `<li>${esc(도시이름(r.city_id))}</li>`).join('')}</ul>` : ''}
    ${가고픈.length ? `<h4>가 보고 싶은 곳 <small>${가고픈.length}곳</small></h4><ul class="chips">${
      가고픈.map(r => `<li>♡ ${esc(도시이름(r.city_id))}</li>`).join('')}</ul>` : ''}`]);
  if (일기.length) 칸.push(['journal', '일기', `${일기.length}편`, 일기.map(r => {
    const c = 도시(r.city_id), n = 도시이름(r.city_id);
    return `<article class="pc">${사진칸(c, n)}<div class="pcb">
      <p class="pch"><b>${esc(n)}</b>${도시나라(r.city_id) ? ` <span class="sub in">${esc(도시나라(r.city_id))}</span>` : ''}</p>
      <p class="sub">${esc(긴날(r.visited_on) || 때(r.updated_at))}${r.stars != null ? ` · <span class="star">${별(r.stars)}</span>` : ''}</p>
      ${메모(r.journal, ' long')}</div></article>`;
  }).join('')]);
  if (여행들.length) 칸.push(['trips', '여행', `${여행들.length}개`,
    `<p class="hint">일정·지출은 제목을 누르면 펼쳐져요.</p>${여행들.map(여행칸).join('')}`]);
  if (맛.length) 칸.push(['places', '장소 별점', `${맛.length}곳`, `<ul class="list">${
    맛.map(r => { const p = 일정이름.get(r.plan_id);
      return `<li><b>${글(p?.title) || '(지운 일정)'}</b> <span class="star">${별(r.stars)}</span>${
        p?.trip_id && 여행제목.has(p.trip_id) ? `<p class="sub">${esc(여행제목.get(p.trip_id))}</p>` : ''}${메모(r.comment)}</li>`; }).join('')}</ul>`]);
  if (n대화){
    const 대화들 = [...대화].sort(([a], [b]) => (a === '' ? 1 : 0) - (b === '' ? 1 : 0) ||
      여행들.findIndex(t => t.id === a) - 여행들.findIndex(t => t.id === b));
    칸.push(['ai', 'AI 대화', `${n대화}개`, 대화들.map(([tid, xs]) => 접기(
      `${tid ? esc(여행제목.get(tid) || '지운 여행') : '여행 밖에서 나눈 대화'} <small>${xs.length}개</small>`,
      xs.slice().sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''))).map(x => `
        <div class="msg ${x.role === 'model' ? 'ai' : 'me'}"><p class="who">${x.role === 'model' ? 'AI' : '나'} · ${esc(때(x.created_at))}</p>${메모(x.content)}</div>`).join(''),
      ` class="chat" id="ai-${esc(tid || 'none')}"`)).join('')]);
  }
  const 설정 = 표('user_prefs')[0] || null;
  const 켜짐 = v => v === false ? '꺼짐' : '켜짐';
  const 프로필줄 = [['이름', 글(나.display_name)], ['소개', 글(나.bio)], ['공개 범위', esc(공개[나.visibility] || 나.visibility || '')],
                    ['가입한 날', 나.created_at ? esc(긴날(서울날(나.created_at))) : '']].filter(([, v]) => v);
  const 설정줄 = 설정 ? [['글자 크기', esc(글자크기(설정.text_scale))], ['알림', esc(켜짐(설정.notify_all))],
                          ['내 시간대', 글(설정.home_tz)]].filter(([, v]) => v) : [];
  if (프로필줄.length || 설정줄.length) 칸.push(['me', '프로필 · 설정', '', `
    <dl class="kv">${[...프로필줄, ...설정줄].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`]);

  /* ── 표지 ── 큰 숫자 넷 + 여행 성향(앱 성향 화면과 같은 차례: 코드 알약 → 이름 → 설명 → 네 축 → 등급). */
  const 받은날 = 서울날(out?.savedAt);
  const 누구 = String(나.display_name || '').trim();
  const 코드 = String(나.persona || '').trim().toUpperCase();
  const P = PERSONA16[코드];
  const 숫자넷 = [[나라수, '나라'], [도시수, '도시'], [발 ? 발.conts : null, '대륙'], [여행들.length, '여행']];
  const 성향 = P ? `<div class="hero">
      <div class="hh"><span class="pcode">${esc(코드)}</span><span class="pe">나의 여행 유형</span></div>
      <p class="pn">${esc(P.n)}</p><p class="pd">${esc(P.d)}</p>
      <div class="pax">${[...코드].map(ch => AXIS_WORD[ch] ? `<span>${esc(AXIS_WORD[ch])}</span>` : '').join('')}</div>
      ${발?.rank ? `<p class="prank">다녀온 나라 수 ${esc(발.rank)}</p>` : ''}</div>` : '';
  const 차례 = 칸.length > 1 ? `<nav class="toc" aria-label="차례">${칸.map(([k, 제목]) => `<a href="#${k}">${제목}</a>`).join('')}</nav>` : '';

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>기로 · 내 기록 (${esc(받은날)})</title>
<style>${모양}</style></head>
<body><main>
<header class="cover"><p class="eb">기로 · 내 여행 기록</p>
  <h1>${누구 ? `${esc(누구)}님의 여행 기록` : '나의 여행 기록'}</h1>
  <p class="sub">${esc(긴날(받은날))}에 받음</p>
  <ul class="stats">${숫자넷.map(([v, k]) => `<li><b>${v == null ? '–' : esc(v)}</b><span>${k}</span></li>`).join('')}</ul>
  ${성향}
  ${(out?.failed || []).length ? `<p class="warn">이 파일에는 빠진 것이 있어요: ${esc(out.failed.join(', '))}. 앱에서 다시 받아 주세요.</p>` : ''}
  ${차례}
</header>
${칸.map(([k, 제목, 몇, 몸]) => `<section id="${k}"><h2>${제목}${몇 ? ` <small>${몇}</small>` : ''}</h2>${몸}</section>`).join('\n') ||
  '<p class="empty">아직 기록이 없어요.</p>'}
<footer>
  <p>기로에서 ${esc(긴날(받은날))}에 받은 파일입니다. 사진 파일과 팔로우·알림·배지는 들어 있지 않아요. 지운 항목은 뺐어요.
    도시 사진은 인터넷이 될 때 보여요.</p>
  <p>다른 서비스로 자료를 옮기려면 앱의 <b>설정 → 내 자료 → 옮기기용 파일로 받기</b>(JSON)를 쓰세요.</p>
</footer>
</main></body></html>`;
}

/* 종이 한 장의 모양 — 앱과 같은 종이색·잉크색·주황. 어두운 화면이면 어둡게, 인쇄하면 흰 종이로.
   ⚠ 이름을 CSS 로 두지 마십시오 — 브라우저에 원래 있는 CSS(CSS.escape)와 겹쳐 tools/check-refs.mjs 가 그것을 쓰는
     map.js·planview.js 를 「import 없이 씀」으로 잡습니다(b836 CI 빨강).
   ⚠ 글자 주황(--brand #B5441A)과 칠 주황(--orange #F25E26)은 다릅니다 — 앱 주황을 작은 글자로 쓰면 종이 위 대비가
     4.5 에 못 미칩니다(#C94E20 도 약 4.0, 재 봄). 지도·막대·알약 같은 면에는 앱 주황 그대로. */
const 모양 = `
:root{--bg:#F3F0E8;--card:#FFFFFF;--ink:#1B1B1F;--ink2:#3A3630;--mute:#6B675F;--line:#DFDAD0;--soft:#ECE7DD;
  --brand:#B5441A;--orange:#F25E26;--land:#E2DCCF;--chip:#ECE7DC;--link:#1D4ED8;--hero:#1B1B1F;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#141417;--card:#1D1D21;--ink:#EDEAE3;--ink2:#D3CFC6;--mute:#A39E94;
  --line:#34333A;--soft:#29292E;--brand:#FF8152;--orange:#FF7A45;--land:#3A3940;--chip:#2C2B31;--link:#8AB4FF;
  --hero:#26262C;color-scheme:dark}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--bg);color:var(--ink);word-break:keep-all;overflow-wrap:anywhere;
  font:16px/1.6 "Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:28px 16px 64px}
p{margin:0}
a{color:var(--link)}
.eb{margin:0 0 6px;font-size:12px;letter-spacing:.08em;color:var(--brand);font-weight:700}
h1{margin:0;font-size:30px;line-height:1.2;letter-spacing:-.01em;text-wrap:balance}
h2{margin:52px 0 14px;font-size:22px;letter-spacing:-.01em}
h3{margin:0;font-size:20px;line-height:1.35;text-wrap:balance}
h4{margin:22px 0 8px;font-size:15px}
h2 small,h4 small,summary small{font-weight:400;color:var(--mute);font-size:13px;margin-left:4px}
.sub{margin-top:4px;color:var(--mute);font-size:14px}
.in{display:inline;margin:0 0 0 4px;font-size:13px}
.hint{color:var(--mute);font-size:13.5px;margin:-6px 0 4px}
.warn{margin-top:12px;padding:10px 12px;border-radius:10px;background:#FBE3D6;color:#7A2E12;font-size:14px}

ul.stats{list-style:none;margin:20px 0 0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
ul.stats li{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 6px 10px;text-align:center}
ul.stats b{display:block;font-size:28px;line-height:1.1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
ul.stats span{font-size:12.5px;color:var(--mute)}
.hero{margin-top:12px;background:var(--hero);color:#FFFFFF;border-radius:18px;padding:20px 18px 18px}
.hh{display:flex;align-items:center;gap:8px}
.pcode{background:var(--orange);color:#1B1B1F;font-weight:800;font-size:13px;letter-spacing:.08em;padding:4px 10px;border-radius:999px}
.pe{font-size:13px;color:#C9C6C0}
.pn{margin-top:12px;font-size:28px;font-weight:800;line-height:1.2;letter-spacing:-.01em;text-wrap:balance}
.pd{margin-top:6px;font-size:15px;color:#E4E1DB;text-wrap:balance}
.pax{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.pax span{font-size:12.5px;border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:3px 10px;color:#F3F0E8}
.prank{margin-top:12px;font-size:13px;color:#FFB08F;font-weight:700}
.toc{display:flex;flex-wrap:wrap;gap:6px;margin-top:18px}
.toc a{font-size:13.5px;text-decoration:none;color:var(--ink2);background:var(--chip);border-radius:999px;padding:6px 12px}

.map{margin:0;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 8px}
.map svg{display:block;width:100%;height:auto}
.map path{fill:var(--land);stroke:var(--card);stroke-width:.6;stroke-linejoin:round}
.map path.been{fill:var(--orange)}
.mapcap{margin-top:10px;font-size:14.5px;color:var(--ink2)}
.conts{display:grid;gap:9px;margin-top:16px}
.cont{display:grid;grid-template-columns:72px 1fr 48px;align-items:center;gap:10px;font-size:14px}
.cb{height:8px;border-radius:99px;background:var(--soft);overflow:hidden}
.cb i{display:block;height:100%;background:var(--orange);border-radius:99px}
.cv{text-align:right;color:var(--mute);font-variant-numeric:tabular-nums;font-size:13px}
.cv b{color:var(--ink);font-size:14px}
ol.topc{list-style:none;margin:0;padding:0;display:grid;gap:6px}
ol.topc li{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 14px}
ol.topc .rk{flex:0 0 22px;height:22px;border-radius:50%;background:var(--orange);color:#1B1B1F;font-size:12px;font-weight:800;
  display:grid;place-items:center}
ol.topc b{flex:1}
ol.topc .n{color:var(--mute);font-size:14px}

.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.cc{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
.ph{position:relative;aspect-ratio:4/3;background:var(--chip);overflow:hidden}
.ph .ini{position:absolute;inset:0;display:grid;place-items:center;font-size:30px;font-weight:800;color:var(--mute);opacity:.55}
.ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.ccb{padding:10px 12px 12px}
.cn{font-size:15.5px;line-height:1.35}
.cc .star{margin-top:2px;font-size:15px}
.cm{margin-top:4px;font-size:14px;color:var(--ink2)}
ul.chips{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}
ul.chips li{background:var(--chip);border-radius:999px;padding:4px 11px;font-size:14px}

.pc{display:grid;grid-template-columns:96px 1fr;gap:14px;background:var(--card);border:1px solid var(--line);border-radius:14px;
  padding:12px;margin-top:10px;align-items:start}
.pc .ph{aspect-ratio:3/4;border-radius:10px}
.pc .ph .ini{font-size:26px}
.pch{font-size:16.5px}
.memo{margin-top:3px;white-space:pre-wrap;color:var(--ink2);font-size:14.5px}
.memo.long{font-size:15.5px;line-height:1.75;color:var(--ink);margin-top:8px}
.mv{color:var(--mute)}

.trip{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 16px 6px;margin:12px 0}
.when{font-size:13px;color:var(--brand);font-weight:700}
.when span{color:var(--mute);font-weight:500;margin-left:6px}
.trip h3{margin-top:4px}
.route{margin-top:3px;font-size:15px;color:var(--ink2)}
ul.tnum{list-style:none;margin:14px 0 0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
@media (max-width:480px){ul.tnum{grid-template-columns:repeat(2,1fr)}}
ul.tnum li{background:var(--bg);border-radius:12px;padding:8px 12px;min-width:0}
ul.tnum b{display:block;font-size:17px;line-height:1.3;font-variant-numeric:tabular-nums}
ul.tnum span{font-size:12px;color:var(--mute)}
.rv{margin-top:12px;font-size:14.5px;color:var(--ink2)}
details{border-top:1px solid var(--soft)}
.trip details:first-of-type{margin-top:14px}
summary{cursor:pointer;list-style:none;display:flex;align-items:center;padding:13px 2px;font-weight:600;font-size:15px}
summary::-webkit-details-marker{display:none}
summary::after{content:"";margin-left:auto;flex:0 0 8px;width:8px;height:8px;border-right:2px solid var(--mute);
  border-bottom:2px solid var(--mute);transform:translateY(-2px) rotate(45deg)}
details[open]>summary::after{transform:translateY(2px) rotate(-135deg)}
summary:focus-visible{outline:2px solid var(--link);outline-offset:2px;border-radius:6px}
.dt{padding:0 0 14px}
.chat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0 14px;margin-top:8px}
.chat>.dt{padding-bottom:12px}

.day{margin-top:6px}
.dl{margin-bottom:2px;font-weight:700;font-size:14px;color:var(--ink2)}
ul.plans,ul.list,ul.checks{list-style:none;margin:0;padding:0}
ul.plans li{display:flex;gap:10px;padding:7px 0;border-top:1px solid var(--soft)}
.tm{flex:0 0 92px;font:13px/1.65 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--mute)}
.bd{min-width:0;flex:1}
.w5{font-weight:600}
.chip{display:inline-block;font-size:12px;line-height:1;padding:3px 7px;border-radius:999px;background:var(--chip);
  color:var(--ink2);vertical-align:2px;font-weight:500;margin-left:2px}
ul.list li{padding:9px 0;border-top:1px solid var(--soft)}
ul.list li:first-child{border-top:0}
ul.checks li{padding:5px 0;display:flex;gap:8px;align-items:baseline}
.box{flex:0 0 18px;height:18px;border:1.5px solid var(--mute);border-radius:5px;font-size:12px;line-height:15px;
  text-align:center;color:var(--card);align-self:center}
ul.checks li.done .box{background:var(--ink);border-color:var(--ink)}
ul.checks li.done{color:var(--mute)}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:7px 10px 7px 0;border-top:1px solid var(--soft);vertical-align:top}
th{font-size:12px;color:var(--mute);font-weight:600;border-top:0;white-space:nowrap}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
.nw{white-space:nowrap}
.sum{margin-top:8px;font-size:14px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums}
.star{color:var(--brand);font-weight:700;white-space:nowrap}
.msg{padding:10px 12px;border-radius:12px;margin:8px 0;max-width:92%;width:fit-content}
.msg.me{background:var(--chip);margin-left:auto}
.msg.ai{background:var(--bg);border:1px solid var(--line)}
.who{font-size:12px;color:var(--mute)}
.more{margin:4px 0 12px;font-size:14px}
.empty{color:var(--mute);font-size:14px;margin:8px 0 12px}
dl.kv{display:grid;grid-template-columns:max-content 1fr;gap:8px 18px;margin:0;background:var(--card);border:1px solid var(--line);
  border-radius:14px;padding:14px 16px}
dl.kv dt{color:var(--mute);font-size:14px;padding-top:1px}
dl.kv dd{margin:0;white-space:pre-wrap}
footer{margin-top:56px;padding-top:16px;border-top:1px solid var(--line);color:var(--mute);font-size:13px;display:grid;gap:6px}
@media (max-width:360px){ul.stats b{font-size:24px}.pn{font-size:25px}}
@media print{:root{--bg:#fff;--card:#fff;color-scheme:light}main{max-width:none;padding:0}
  .trip,.pc,.cc,.msg,li,tr{break-inside:avoid}a{color:inherit}.toc{display:none}}
`;

/* ── 자가검사 — CI 가 돌립니다(account.js 가 __myrecordCheck 로 걸어 둠). 서버도 로그인도 안 씁니다. ── */
export function 검사(){
  const out = [];
  const 봄 = (항목, ok, 왜 = '') => out.push({ 항목, 결과: ok ? '✓' : '✗ ' + 왜 });
  const 나 = 'u1', 남 = 'u2', 여행 = 't1';
  const 가짜 = { app: '기로', savedAt: '2026-10-08T03:00:00Z', user: 나, data: {
    trips: [{ id: 여행, title: '오사카 <script>alert(1)</script>', start_date: '2026-11-01', end_date: '2026-11-03', home_currency: 'KRW' }],
    trip_legs: [{ trip_id: 여행, destination: '오사카', start_date: '2026-11-01' }],
    trip_members: [{ trip_id: 여행, user_id: 나, role: 'owner', nickname: null }, { trip_id: 여행, user_id: 남, role: 'editor', nickname: '민지' }],
    plans: [{ id: 'p1', trip_id: 여행, date: '2026-11-01', start_time: '09:00:00', title: '구로몬 시장', category: '식사', memo: '첫 줄\n둘째 줄' },
            { id: 'p2', trip_id: 여행, date: '2026-11-01', title: '지운 일정', deleted_at: '2026-10-01T00:00:00Z' }],
    expenses: [{ id: 'e1', trip_id: 여행, date: '2026-11-01', title: '라멘', amount: 1200, currency: 'JPY', amount_home: 11000, payer_id: 남, method: '현금' }],
    links: [{ id: 'l1', trip_id: 여행, title: '나쁜 링크', url: 'javascript:alert(1)' }, { id: 'l2', trip_id: 여행, title: '좋은 링크', url: 'https://example.com/a?b=1&c=2' }],
    city_ratings: [{ user_id: 나, city_id: 'osaka', stars: 4.5, comment: '또 갈래요', visited_on: '2026-11-01', journal: '첫날 일기' },
                   { user_id: 나, city_id: 'bad', stars: 3 },
                   { user_id: 남, city_id: 'tokyo', stars: 1, comment: '남의 별점' }],
    chats: [{ id: 'c1', trip_id: 여행, user_id: 나, role: 'user', content: '좌표 채워줘', created_at: '2026-10-08T01:00:00Z' },
            { id: 'c2', trip_id: 여행, user_id: 나, role: 'model', content: '좌표 3곳을 채웠어요.', created_at: '2026-10-08T01:00:05Z' }],
    profiles: [{ id: 나, display_name: '소희', visibility: 'public', persona: 'FLNP' }, { id: 남, display_name: '민지 본명' }],
    user_prefs: [{ user_id: 나, text_scale: 1, notify_all: true }],
  } };
  const 도시 = id => ({ osaka: { name: '오사카', country: 'JP', image_url: 'https://img.example/osaka.jpg' },
                        bad: { name: '나쁜도시', country: 'JP', image_url: 'javascript:alert(2)' },
                        tokyo: { name: '도쿄', country: 'JP' } })[id];
  const 발자국 = { codes: ['JP'], countries: 1, cities: 2, conts: 1, total: 195, pct: 0.5, rank: '상위 80%',
                   top: [['일본', 2, 'JP']], byCont: [['아시아', 48, 1], ['유럽', 44, 0]] };
  const 세계 = '<path data-c="JP" d="M1 1h2v2z"/><path data-c="US" d="M5 5h2v2z"/>';
  let h = '';
  try { h = 보기파일(가짜, { 도시, 발자국, 세계 }); } catch (e){ 봄('만들다 터지지 않음', false, e.message); return out; }
  봄('제목의 <script> 가 글자로만 들어감', !h.includes('<script>alert') && h.includes('&lt;script&gt;'), '이스케이프 안 됨');
  봄('javascript: 링크·사진은 안 걸림', !/(href|src)="javascript:/i.test(h), 'href/src 로 들어감');
  봄('https 링크는 누를 수 있음(& 는 &amp;)', h.includes('href="https://example.com/a?b=1&amp;c=2"'), '링크 없음');
  봄('도시 사진은 https 주소로', h.includes('<img src="https://img.example/osaka.jpg"'), '사진 없음');
  봄('지운 일정은 빠짐', !h.includes('지운 일정'), '보임');
  봄('남의 도시 별점은 빠짐', !h.includes('남의 별점'), '보임');
  봄('낸 사람은 그 여행의 별명으로', h.includes('<div class="sub">민지 · 현금</div>'), '별명 아님');
  봄('원화 환산은 「원화로 …원」', h.includes('원화로 11,000원'), '환산 줄 틀림');
  봄('간 나라만 지도에 칠함', h.includes('<path data-c="JP" class="been"') && !h.includes('<path data-c="US" class="been"'), '칠 틀림');
  봄('대륙 막대·많이 간 나라', h.includes('class="cont"') && h.includes('아시아') && h.includes('가장 많이 간 나라'), '빠짐');
  봄('큰 숫자 넷(나라 1 · 도시 2)', /<li><b>1<\/b><span>나라<\/span><\/li><li><b>2<\/b><span>도시<\/span>/.test(h), '숫자 틀림');
  봄('성향 이름과 네 축', h.includes('눈 높은 재방문러') && h.includes('<span>유명한 곳</span>'), '빠짐');
  봄('일정·지출은 접힘(details)', /<details><summary>일정 <small>1개<\/small><\/summary>/.test(h), '접기 없음');
  봄('AI 대화가 여행 아래에 묶임', h.includes(`id="ai-${여행}"`) && h.includes('좌표 3곳을 채웠어요.'), '빠짐');
  봄('2박 3일', h.includes('2박 3일'), '박일 틀림');
  봄('받은 날은 서울 날짜', h.includes('2026년 10월 8일 (목)에 받음'), '날짜 틀림');
  봄('스크립트 없는 종이 한 장', !/<script\b/i.test(h), '<script> 있음');
  let 빈 = '';
  try { 빈 = 보기파일({ user: 나, data: {} }, { 도시 }); } catch (e){ 빈 = 'ERR ' + e.message; }
  봄('빈 자료도 열림(발자국 없이)', 빈.includes('아직 기록이 없어요') && !빈.includes('class="map"'), 빈.slice(0, 60));
  return out;
}
