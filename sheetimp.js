/* ── 표로 된 일정을 그대로 넣기(b784) ─────────────────────────────────
 * 사용자 요청(2026-09-27): 「앞으로 이런 엑셀 파일을 넣더라도 일정에 자동으로
 * 집어넣고 좌표까지」 · 「AI 채팅처럼 묻는 단계 없이 알아서 다 잘 넣을 수 있어?」
 *
 * ⚠⚠ **표는 AI 가 안 읽습니다.** 날짜·시간·일정 칸이 이미 나뉜 표를 AI 에
 *   보내면(예전 길) 20~30초가 걸리고, 서버가 «하루 8개»로 자르므로 4일짜리
 *   여행은 32개에서 끊깁니다 — 43줄짜리 후쿠오카 표는 **마지막 날이 통째로
 *   빠졌습니다**(chat/index.ts 의 actions slice). 끝나는 시각도 버렸습니다
 *   (불러오기 틀에 end_time 이 없습니다). 칸을 그대로 읽으면 빠지는 줄도
 *   지어낸 줄도 없고 1초도 안 걸립니다.
 *   표가 아니면(사진·글·머리줄이 낯선 표) 예전처럼 AI 로 갑니다(bring.js).
 *
 * ⚠⚠ **좌표는 «이름만» AI 가 짓고, 자리는 OSM 이 정합니다.** 실측(브라우저,
 *   나라=일본, 2026-09-27): 한국어 이름으로 찾으면 10곳 중 **1곳만** 맞았고
 *   1곳은 **엉뚱한 데**였습니다(우미지고쿠 → 우사의 다른 온천). 일본어 이름으로는
 *   8곳이 맞았습니다. 그래서 AI(chat 함수의 `places` 모드)가 줄마다 «실제로
 *   어디인지»의 현지 이름만 내고, `이름찾기` 가 **그 줄의 지역 40km 안에서, 이름이 맞는 것만**
 *   받습니다. **못 찾으면 비워 둡니다** — 틀린 핀이 빈 핀보다 나쁩니다(b388).
 *
 * ⚠ 묻는 단계가 없는 대신: 넣기 전에 «몇 월 며칠에 몇 개»를 보여 주고(bring.js),
 *   이미 있는 줄은 다시 안 넣고, 넣은 것은 한 번에 되돌릴 수 있습니다.
 *
 * 층: dom.js · db.js · trip.js · cands.js 만 씁니다. 화면(불러오기 카드)은
 *     bring.js 가 그립니다 — 여기는 읽고·넣고·찾는 일만 합니다. */
import { sb } from './db.js?v=b837';
import { trip, plans, legs } from './trip.js?v=b837';
import { 여행기준, osmLookup, addressQueries } from './cands.js?v=b837';
import { distKm } from './calc.js?v=b837';

/* ── 머리줄 찾기 ──────────────────────────────────────────────────────
 * 칸 이름은 사람마다 다르게 씁니다. 날짜와 «무엇을 하나» 두 칸만 있으면
 * 표로 봅니다. 나머지는 있으면 쓰고 없으면 비웁니다.
 * ⚠ 「장소」만 있고 「일정」이 없으면 장소가 곧 제목입니다. 둘 다 있으면
 *   일정이 제목이고 장소는 메모로 갑니다(찾기에도 씁니다). */
const 칸이름 = [
  ['date',  /^(날짜|일자|일시|날|date|day|일차|요일)$/i],
  ['time',  /^(시간|시각|time|시간대|when|시작\s*시간)$/i],
  ['title', /^(일정|내용|할\s*일|활동|계획|스케줄|코스|title|activity|plan|schedule|what|to\s*do)$/i],
  ['place', /^(장소|위치|주소|place|location|spot|where|address)$/i],
  ['area',  /^(지역|도시|구역|동네|area|city|region|town)$/i],
  ['move',  /^(이동|교통|이동\s*수단|교통\s*수단|수단|transport|transit|move)$/i],
  ['memo',  /^(메모|비고|참고|노트|설명|팁|note|notes|memo|remarks?|tips?|comment)$/i],
];
function 칸찾기(row){
  const got = {};
  (row || []).forEach((c, j) => {
    const t = String(c ?? '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 12) return;
    for (const [k, re] of 칸이름) if (got[k] == null && re.test(t)){ got[k] = j; break; }
  });
  if (got.title == null && got.place != null){ got.title = got.place; delete got.place; }
  return got.date != null && got.title != null ? got : null;
}

/* 「-」·「없음」 같은 자리 채움은 빈칸입니다. 표를 짤 때 칸을 비워 두지 않으려고
   흔히 넣습니다 — 그대로 옮기면 메모에 「-」가 박힙니다. */
const 빈칸 = v => {
  const t = String(v ?? '').replace(/\s+/g, ' ').trim();
  return /^(-|–|—|x|없음|n\/?a|null)$/i.test(t) ? '' : t;
};
/* 전각 숫자·쌍점·물결을 폅니다. 일본 표는 흔히 전각으로 옵니다. */
const 펴기 = s => String(s ?? '').replace(/[０-９：～〜－]/g, c =>
  ({ '：':':', '～':'~', '〜':'~', '－':'-' }[c] || String.fromCharCode(c.charCodeAt(0) - 0xFEE0)));
const 두 = n => String(n).padStart(2, '0');

/* 있는 날짜인가(2월 30일 따위를 거릅니다). */
function 날(y, m, d){
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 ? `${y}-${두(m)}-${두(d)}` : null;
}
const 더하기 = (d, n) => { const t = new Date(d + 'T00:00:00Z');
                            t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const 날수차 = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/* ── 날짜 읽기 ────────────────────────────────────────────────────────
 * 「2026.11.06」·「11/6 (금)」·「11월 6일」·「Day 1」·「1일차」·엑셀 날짜 숫자.
 * ⚠ 해가 안 적혀 있으면 **여행 날짜에 가장 가까운 해**를 고릅니다 —
 *   12월 말에 떠나 1월에 오는 여행에서 「1/2」가 내년이어야 합니다. */
export function 날짜읽기(v, 여행){
  const s = 펴기(v).trim();
  if (!s) return null;
  const 첫 = 여행?.start_date, 끝 = 여행?.end_date || 첫;
  let m;
  if ((m = s.match(/^(\d{5})(?:\.\d+)?$/)))
    return new Date(Date.UTC(1899, 11, 30) + Number(m[1]) * 864e5).toISOString().slice(0, 10);
  if ((m = s.match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/)))
    return 날(+m[1], +m[2], +m[3]);
  if (첫 && (m = s.match(/\bday\s*[-.]?\s*(\d{1,2})\b|(\d{1,2})\s*일\s*차|제\s*(\d{1,2})\s*일/i))){
    const n = +(m[1] || m[2] || m[3]);
    if (n >= 1 && n <= 60) return 더하기(첫, n - 1);
  }
  if (첫 && (m = s.match(/(\d{1,2})\s*[./월]\s*(\d{1,2})/))){
    const y0 = +첫.slice(0, 4);
    let 고른 = null, 틈 = Infinity;
    for (const y of [y0 - 1, y0, y0 + 1]){
      const t = 날(y, +m[1], +m[2]);
      if (!t) continue;
      const g = t < 첫 ? 날수차(t, 첫) : t > 끝 ? 날수차(끝, t) : 0;
      if (g < 틈){ 고른 = t; 틈 = g; }
    }
    return 고른;
  }
  return null;
}

/* ── 시각 읽기 ── 「11:40~12:20」→ 시작·끝, 「20:00~」→ 시작만, 「~18:00」→ 끝만.
 * 「오후 3시 반」·「3:00 PM」 도 됩니다. 24시가 넘는 값은 버립니다(DB 가 못 받음). */
export function 시각읽기(v){
  const s = 펴기(v).replace(/[–—−]/g, '-').trim();
  if (!s) return [null, null];
  const re = /(오전|오후|새벽|저녁|밤|a\.?m\.?|p\.?m\.?)?\s*(\d{1,2})\s*(?::\s*(\d{2})|시(?:\s*(반)|\s*(\d{1,2})\s*분)?)\s*(a\.?m\.?|p\.?m\.?)?/gi;
  const 찾은 = [];
  let m;
  while ((m = re.exec(s))){
    let h = +m[2];
    const mi = m[3] != null ? +m[3] : m[4] ? 30 : m[5] != null ? +m[5] : 0;
    const ap = String(m[1] || m[6] || '').toLowerCase().replace(/\./g, '');
    if (['오후', 'pm', '저녁', '밤'].includes(ap) && h < 12) h += 12;
    if (['오전', 'am', '새벽'].includes(ap) && h === 12) h = 0;
    if (h <= 23 && mi <= 59) 찾은.push(`${두(h)}:${두(mi)}`);
  }
  if (!찾은.length) return [null, null];
  if (찾은.length === 1) return /^[~-]/.test(s) ? [null, 찾은[0]] : [찾은[0], null];
  return [찾은[0], 찾은[1]];
}

/* ── 표 → 일정 ────────────────────────────────────────────────────────
 * 돌려주는 값: `null`(표가 아님) 또는
 *   { items:[{date,start_time,end_time,title,memo,move_note,area,place}],
 *     날짜밖, 날짜모름 }
 * ⚠ 날짜 칸이 빈 줄은 **윗줄 날짜를 이어 씁니다** — 날짜를 합친 칸(병합)이나
 *   첫 줄에만 날짜를 적는 표가 흔합니다.
 * ⚠ 날짜 칸에 글이 있는데 못 읽으면(「미정」) 그 줄은 넣지 않고 셉니다 —
 *   윗줄 날짜로 넣으면 엉뚱한 날에 들어갑니다. */
export function 표에서일정(rows, 여행){
  let 머리 = null, hi = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++){
    const got = 칸찾기(rows[i]);
    if (got){ 머리 = got; hi = i; break; }
  }
  if (!머리) return null;
  const 첫 = 여행?.start_date, 끝 = 여행?.end_date || 첫;
  const items = [];
  let 날짜밖 = 0, 날짜모름 = 0, 지난날 = null;
  for (let i = hi + 1; i < rows.length; i++){
    const r = rows[i] || [];
    if (칸찾기(r)) continue;                         /* 중간에 되풀이된 머리줄 */
    const 칸 = k => 머리[k] == null ? '' : 빈칸(r[머리[k]]);
    const 날글 = 칸('date');
    const 읽은날 = 날글 ? 날짜읽기(날글, 여행) : null;
    if (읽은날) 지난날 = 읽은날;
    const 제목 = 칸('title');
    if (!제목) continue;
    if (날글 && !읽은날){ 날짜모름++; continue; }
    const date = 읽은날 || 지난날;
    if (!date){ 날짜모름++; continue; }
    if (첫 && (date < 첫 || date > 끝)){ 날짜밖++; continue; }
    const [start_time, end_time] = 시각읽기(칸('time'));
    const place = 칸('place');
    const memo = [place && !제목.includes(place) ? place : '', 칸('memo')]
      .filter(Boolean).join(' · ');
    items.push({ date, start_time, end_time, title: 제목.slice(0, 100),
                 memo: memo.slice(0, 300) || null, move_note: 칸('move').slice(0, 100) || null,
                 area: 칸('area').slice(0, 60), place });
  }
  return { items, 날짜밖, 날짜모름 };
}

/* ── CSV·TSV 를 줄×칸으로 ── 따옴표 안의 쉼표·줄바꿈을 지킵니다.
 * 탭이 쉼표보다 많으면 TSV 로 봅니다(엑셀에서 복사한 글이 TSV 입니다). */
export function 글표(text){
  const s = String(text || '').replace(/\r\n?/g, '\n');
  const 첫줄 = s.split('\n', 1)[0];
  const 가름 = (첫줄.match(/\t/g) || []).length > (첫줄.match(/,/g) || []).length ? '\t' : ',';
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++){
    const c = s[i];
    if (q){
      if (c === '"' && s[i + 1] === '"'){ cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"' && !cell) q = true;
    else if (c === 가름){ row.push(cell); cell = ''; }
    else if (c === '\n'){ row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length){ row.push(cell); rows.push(row); }
  return rows;
}

/* ── 넣기 ──────────────────────────────────────────────────────────────
 * **한 번의 요청으로** 다 넣습니다. 43줄을 하나씩 넣으면 43번 오가고, 중간에
 * 끊기면 반쯤 들어간 채로 남습니다.
 * ⚠ **이미 있는 줄은 다시 안 넣습니다** — 같은 파일을 두 번 올려도 두 벌이 안
 *   됩니다. 같은 날·같은 시작 시각·같은 제목(띄어쓰기 무시)이면 같은 줄입니다.
 * 돌려주는 값: { 넣은:[{id,...item}], 있던:숫자 } */
const 제목열쇠 = t => String(t || '').replace(/\s+/g, '').toLowerCase();
export async function 일정넣기(items, guessCat){
  const 있는 = new Set((plans || []).map(p =>
    `${p.date}|${String(p.start_time || '').slice(0, 5)}|${제목열쇠(p.title)}`));
  const 순서 = {};
  for (const p of plans || [])
    순서[p.date] = Math.max(순서[p.date] ?? -1, Number(p.sort_order) || 0);
  const 새것 = [];
  let 있던 = 0;
  for (const it of items){
    const k = `${it.date}|${it.start_time || ''}|${제목열쇠(it.title)}`;
    if (있는.has(k)){ 있던++; continue; }
    있는.add(k);
    순서[it.date] = (순서[it.date] ?? -1) + 1;
    새것.push({ it, sort_order: 순서[it.date] });
  }
  if (!새것.length) return { 넣은: [], 있던 };
  const r = await sb.from('plans').insert(새것.map(({ it, sort_order }) => ({
    trip_id: trip.id, date: it.date, title: it.title,
    start_time: it.start_time, end_time: it.end_time,
    category: guessCat(it.title) || guessCat(it.memo || '') || null,
    memo: it.memo, move_note: it.move_note, sort_order,
  }))).select('id,date,title,start_time');
  if (r.error) throw r.error;
  /* 돌아온 순서를 믿지 않고 날짜·시각·제목으로 짝을 맞춥니다. */
  const 짝 = new Map();
  for (const row of r.data || [])
    짝.set(`${row.date}|${String(row.start_time || '').slice(0, 5)}|${제목열쇠(row.title)}`, row.id);
  const 넣은 = 새것.map(({ it }) => ({
    ...it, id: 짝.get(`${it.date}|${it.start_time || ''}|${제목열쇠(it.title)}`) }))
    .filter(x => x.id);
  return { 넣은, 있던 };
}

/* 되돌리기 — 진짜로 지우지 않고 숨깁니다. 다른 삭제와 같은 방식입니다(cards.js). */
export async function 넣은것되돌리기(ids){
  if (!ids?.length) return;
  const r = await sb.from('plans').update({ deleted_at: new Date().toISOString() }).in('id', ids);
  if (r.error) throw r.error;
}

/* ── 이름이 맞는 것만 받는 OSM 찾기 ────────────────────────────────────
 * ⚠⚠ **거리만으로는 틀린 핀을 못 막습니다.** 실측(2026-09-27): 「福岡城跡」
 *   (후쿠오카성터)을 찾았더니 **4.6km 떨어진 니시진의 「成吉」**이 중요도
 *   1등으로 나왔습니다 — 40km 창 안이라 거리 검사로는 그대로 통과합니다.
 *   그래서 결과의 **이름표 전부**(`namedetails` — 일본어·영어·한국어·옛 이름)와
 *   거리 이름(`address.road` — 「湯の坪街道」처럼 길을 찾을 때)을 받아,
 *   찾는 이름과 **실제로 맞는 것만** 받습니다.
 * 맞는다고 보는 것:
 *   · 같거나, 결과 이름이 찾는 이름을 품음(「福岡空港 国際線ターミナル」 ⊃ 「福岡空港」)
 *   · 결과 이름이 찾는 이름 안에 들고 길이가 60% 이상(「福岡城」 ⊂ 「福岡城跡」,
 *     「由布院」 ⊂ 「由布院駅」 — 역은 OSM 에 「駅」 없이 적혀 있습니다)
 *   · 꼬리(역·공항·공원·터·본점…)를 뗀 것이 같음(「Beppu Station」 → 「Beppu」)
 *   ⚠ 60% 는 「別府」(역) ⊂ 「別府ロープウェイ」(25%) 같은 **짧은 이름 걸림**을
 *     막으려는 것입니다 — 로프웨이 줄에 역 핀이 찍히면 4km 틀립니다.
 * ⚠ cands.js 의 `osmLookup` 은 손대지 않았습니다. 그쪽은 우리말 제목·주소로 찾는
 *   길이라 이름 확인을 걸면 지금 되는 것까지 못 찾게 됩니다.
 * 돌려주는 값: `{lat,lng}` · `null`(못 찾음) · `'stop'`(그쪽에서 그만하라 함). */
const 이름꼴 = s => String(s || '').normalize('NFKC').toLowerCase()
  .replace(/[\s·・.,\-_'’"「」()（）]/g, '');
const 꼬리 = /(国際線ターミナル|ターミナル|terminal|駅|station|空港|airport|公園|park|跡|ruins|本店|mainstore|店|store)$/;
function 이름맞나(이름들, q){
  const a = 이름꼴(q);
  if (a.length < 2) return false;
  const a2 = a.replace(꼬리, '');
  return 이름들.some(v => {
    const n = 이름꼴(v);
    if (n.length < 2) return false;
    if (n.includes(a)) return true;
    if (a.includes(n) && n.length / a.length >= 0.6) return true;
    return a2.length >= 2 && a2 !== a && n.replace(꼬리, '') === a2;
  });
}
export async function 이름찾기(q, { country, near, maxKm }){
  const u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8'
          + '&namedetails=1&addressdetails=1'
          + (country ? '&countrycodes=' + encodeURIComponent(country.toLowerCase()) : '')
          + '&q=' + encodeURIComponent(q);
  try {
    const r = await fetch(u, { headers: { 'Accept-Language': 'ko,en' } });
    if (!r.ok) return r.status === 429 ? 'stop' : null;
    const a = await r.json();
    if (!Array.isArray(a)) return null;
    const 쓸것 = a.map(x => {
        const lat = Number(x.lat), lng = Number(x.lon);
        return { lat, lng, imp: Number(x.importance) || 0, type: x.type,
                 d: near ? distKm(near[0], near[1], lat, lng) : 0,
                 이름들: [x.name, ...Object.values(x.namedetails || {}),
                          x.address?.road, x.address?.pedestrian].filter(Boolean) };
      })
      .filter(x => Math.abs(x.lat) <= 90 && Math.abs(x.lng) <= 180)
      /* 정류장·승강장은 **목적지 이름**을 달고 있습니다(「大分空港」 버스 정류장). */
      .filter(x => !['bus_stop', 'platform', 'stop_position'].includes(x.type))
      /* ⚠ **이름 없는 가게급(중요도 0.1 미만)은 6km 안에서만**(실측 b784): 「岩田屋」로
         물으면 덴진 본점은 결과에 **아예 없고** 8km·33km 떨어진 딴 「岩田屋」만
         나왔습니다(중요도 0.00). 역·공항·명소는 중요도가 0.3~0.5 라 40km 그대로 —
         오이타공항은 오이타 시내에서 29km 입니다. */
      .filter(x => !near || x.d <= (x.imp >= 0.1 ? maxKm : Math.min(maxKm, 6)))
      .filter(x => 이름맞나(x.이름들, q));
    if (!쓸것.length) return null;
    쓸것.sort((x, y) => (y.imp - x.imp) || (x.d - y.d));
    return { lat: 쓸것[0].lat, lng: 쓸것[0].lng };
  } catch { return null; }
}

/* ── 좌표 찾기 ────────────────────────────────────────────────────────
 * ① AI 에게 줄마다 «실제로 어디인지»의 현지 이름을 한 번에 묻습니다(chat 의
 *    `places` 모드 — 대화 기록은 안 남습니다).
 * ② 지역 칸마다 기준점을 받습니다. 그 줄은 **기준점 40km 안에서, 이름이 맞는 것만** 받습니다.
 *    기준점이 없으면 그날 구간 중심 120km(예전 규칙)로 떨어집니다.
 * ③ 같은 이름은 한 번만 묻습니다(메바에소 · 호텔이 여러 줄에 나옵니다).
 *    OSM 은 초당 한 번이 규칙입니다.
 * `그만()` 이 참이면 멈춥니다 — 되돌린 뒤에도 계속 찾으면 숨긴 줄에 좌표를
 * 넣느라 OSM 에 헛걸음을 합니다.
 * ⚠ **못 찾은 것은 «곳»으로 묶어 돌려줍니다.** 료칸 하나가 여섯 줄(짐 맡기기·
 *   체크인·온천·저녁·온천·조식)에 나옵니다 — 줄마다 지도 링크를 붙이라고 하면
 *   여섯 번입니다. 곳마다 한 번이면 되게 합니다(`지도로찍기`).
 * 돌려주는 값: { 찍음, 못찾음:[{이름, ids, near}], 장소아님, 멈춤?, 안됨? } */
const 쉼 = ms => new Promise(r => setTimeout(r, ms));
export async function 좌표찾기(넣은, 진행 = () => {}, 그만 = () => false){
  if (!넣은.length) return { 찍음: 0, 못찾음: [], 장소아님: 0 };
  const 나라 = String(trip?.country || legs?.[0]?.country || '').toUpperCase();
  진행('이름', 0, 넣은.length);
  const { data, error } = await sb.functions.invoke('chat', { body: {
    mode: 'places', trip_id: trip.id, country: 나라,
    items: 넣은.map((x, i) => ({ i, date: x.date, area: x.area || '', title: x.title,
                                memo: [x.memo, x.move_note].filter(Boolean).join(' · ') })),
  } });
  if (error || data?.error || !Array.isArray(data?.rows)){
    let 이유 = data?.error || '';
    try { 이유 = (await error?.context?.json())?.error || 이유; } catch {}
    return { 찍음: 0, 못찾음: [], 장소아님: 0, 안됨: true, 이유 };
  }

  /* 기준점이 여행 구간에서 너무 멀면(AI 가 동명이 다른 곳을 짚음) 안 씁니다. */
  const 중심들 = (legs || []).filter(l => l.center_lat != null && l.center_lng != null)
    .map(l => [Number(l.center_lat), Number(l.center_lng)]);
  const 지역 = new Map();
  for (const a of data.areas || []){
    if (!a?.name || typeof a.lat !== 'number' || typeof a.lng !== 'number') continue;
    if (중심들.length && !중심들.some(([y, x]) => distKm(y, x, a.lat, a.lng) <= 250)) continue;
    지역.set(String(a.name).replace(/\s+/g, ' ').trim(), [a.lat, a.lng]);
  }

  const 이름 = new Map((data.rows || []).map(r => [r.i, r]));
  const 대상 = 넣은.map((x, i) => ({ x, r: 이름.get(i) })).filter(({ r }) => r && (r.local || r.alt || r.en));
  const 장소아님 = 넣은.length - 대상.length;
  const 답 = new Map();
  /* 지역의 현지 이름(「유후인」 → 「由布院」) — 주소를 찾을 때 검색어에 붙입니다. */
  const 지역현지 = new Map((data.areas || []).filter(a => a?.name)
    .map(a => [String(a.name).replace(/\s+/g, ' ').trim(), a.local || '']));
  /* 같은 곳 = AI 가 준 현지 이름이 같은 것(없으면 한국어·영어·제목 순). */
  const 묶음 = new Map();
  const 못 = (x, r, near) => {
    const k = 이름꼴(r?.local || r?.ko || r?.en || x.title);
    const 지역말 = String(x.area || '').replace(/\s+/g, ' ').trim();
    const g = 묶음.get(k) || { 이름: r?.ko || r?.en || r?.local || x.title, ids: [], near,
                               local: r?.local || '', en: r?.en || '',
                               지역이름: 지역현지.get(지역말) || 지역말 };
    g.ids.push(x.id);
    묶음.set(k, g);
  };
  const 못찾음 = () => [...묶음.values()];
  const 기준점 = x => 지역.get(String(x.area || '').replace(/\s+/g, ' ').trim()) || null;
  let 찍음 = 0, n = 0;
  for (const { x, r } of 대상){
    if (그만()) return { 찍음, 못찾음: 못찾음(), 장소아님, 그만둠: true };
    진행('자리', ++n, 대상.length);
    /* 40km: 오이타 시내 → 오이타공항이 29km 입니다(실측). 30 이면 공항이 창 끝에
       걸립니다. 더 넓히면 이름이 같은 딴 동네 것이 들어옵니다. */
    const 기준 = 기준점(x);
    const near = 기준 || 여행기준(x.date);
    const maxKm = 기준 ? 40 : 120;
    let hit = null;
    /* 「跡」·「本店」을 뗀 이름도 한 번 물어봅니다 — OSM 에는 「福岡城」·「岩田屋」로
       올라 있어 「福岡城跡」·「岩田屋本店」으로는 안 나왔습니다(실측).
       ⚠ 「駅」은 안 뗍니다. 「別府」로 물으면 **도시 전체**가 이름 확인을
         통과해 역 줄에 시 한가운데 핀이 찍힙니다 — 역은 영어 이름이 잡습니다. */
    const 뗀 = r.local && r.local.replace(/(跡|本店)$/, '');
    /* alt — 「A · B」로 묶인 줄의 다른 곳, 또는 같은 자리의 다른 이름(AI 가 줍니다). */
    for (const q of [...new Set([r.local, 뗀 && 뗀.length >= 2 ? 뗀 : null, r.alt, r.en]
                                  .filter(Boolean))]){
      const k = `${q}|${near ? near.map(v => v.toFixed(2)).join(',') : ''}|${maxKm}`;
      if (답.has(k)) hit = 답.get(k);
      else {
        hit = await 이름찾기(q, { country: 나라, near, maxKm });
        if (hit === 'stop'){
          for (const o of 대상.slice(n - 1)) 못(o.x, o.r, 기준점(o.x) || 여행기준(o.x.date));
          return { 찍음, 못찾음: 못찾음(), 장소아님, 멈춤: true };
        }
        답.set(k, hit);
        await 쉼(1100);                              /* 초당 한 번이 그쪽 규칙입니다 */
      }
      if (hit) break;
    }
    if (!hit){ 못(x, r, near); continue; }
    const u = await sb.from('plans').update({ lat: hit.lat, lng: hit.lng }).eq('id', x.id).select('id');
    if (!u.error && u.data?.length) 찍음++;
    else 못(x, r, near);
  }
  /* 이름으로 못 찾은 곳(대개 숙소)은 주소로 한 번 더 — 아래 `주소로찾기`. */
  if (묶음.size && !그만()) 찍음 += await 주소로찾기(묶음, 나라, 진행, 그만);
  return { 찍음, 못찾음: 못찾음(), 장소아님 };
}

/* ── 이름으로 못 찾은 곳은 «주소»로(b785) ─────────────────────────────────
 * 사용자: 「호텔 좌표는 너가 넣을 수 있는거아냐?」 · 「지금 하고 있는 로직들은
 *   나중에 다 자동화시켜놔야해」. 손으로 한 것을 그대로 옮겼습니다 —
 *   ① 웹에서 그 곳의 주소를 찾고(서버 chat 의 `addr` 모드: 검색 결과에 **적힌**
 *      주소만 옮깁니다, 지어내지 않습니다) ② 주소를 좌표로 바꿉니다.
 * ⚠⚠ **일본 주소는 국토지리원(GSI) 주소 검색**으로 바꿉니다. OSM 은 일본 주소를
 *   동네(丁目)까지만 알아 1~2km 틀립니다. GSI 는 번지까지입니다 — 실측(2026-09-28):
 *   「福岡市中央区春吉2丁目4-14」 → 두 출처로 확인해 둔 좌표와 **20m**,
 *   「湯布院町川南249-1」 → **191m**.
 * ⚠ 그대로 넣으면 안 되는 꼴이 둘 있었습니다(실측):
 *   · 우편번호(〒810-0003)나 「春吉2-4-14」 꼴 → **0건**. 우편번호를 빼고
 *     「2丁目4-14」로 폅니다.
 *   · 「大字」가 붙으면 **6.9km 떨어진 딴 동네(下湯平)가 1등**이었습니다 →
 *     「大字」를 뺀 꼴을 먼저 묻고, 결과 이름에 **그 동네 이름(川南)이 들어 있을
 *     때만** 받습니다.
 * ⚠ 그날 지역에서 40km 넘게 먼 좌표는 안 받습니다 — 다른 지점의 주소입니다.
 * ⚠ 서버에 `addr` 모드가 없거나(옛 배포) 검색이 꺼져 있으면 조용히 넘어갑니다 —
 *   그 곳은 「구글 지도 링크 한 번」 칸으로 남습니다. */
function 일본주소꼴(a){
  const s = 펴기(a).replace(/〒\s*\d{3}-?\d{4}/g, ' ').replace(/^\s*\d{3}-\d{4}\s*/, '')
    .replace(/日本(国)?[、,]?/g, '').replace(/\s+/g, '').trim();
  const out = new Set();
  for (const v of [s.replace(/大字/g, ''), s]){
    out.add(v);
    const m = v.match(/^(.*?[^\d-])(\d+)-(\d+)-(\d+)$/);
    if (m && !/丁目/.test(v)) out.add(`${m[1]}${m[2]}丁目${m[3]}-${m[4]}`);
  }
  return [...out].filter(v => v.length >= 6);
}
/* 번지 바로 앞의 동네 이름 — 「…中央区春吉2丁目…」 → 春吉, 「…湯布院町川南249-1」 → 川南. */
const 동네이름 = a => (펴기(a).replace(/大字|字/g, '')
  .match(/([^\d\s市区町村郡都道府県〒-]{1,6})(?=\d)/) || [])[1] || '';
async function 주소좌표(주소, 나라, near){
  if (나라 === 'JP'){
    const 동네 = 동네이름(주소);
    for (const q of 일본주소꼴(주소)){
      try {
        const r = await fetch('https://msearch.gsi.go.jp/address-search/AddressSearch?q=' +
                              encodeURIComponent(q));
        const a = r.ok ? await r.json() : [];
        const 맞는 = (Array.isArray(a) ? a : []).find(f =>
          Array.isArray(f?.geometry?.coordinates) &&
          (!동네 || String(f?.properties?.title || '').includes(동네)));
        if (맞는){
          const [lng, lat] = 맞는.geometry.coordinates.map(Number);
          if (Number.isFinite(lat) && Number.isFinite(lng) &&
              (!near || distKm(near[0], near[1], lat, lng) <= 40)) return { lat, lng };
        }
      } catch {}
    }
    return null;
  }
  /* 일본 밖은 OSM — 유럽·미국은 번지까지 올라 있는 곳이 많습니다. */
  const hit = await osmLookup(주소, { country: 나라, near, maxKm: 40 });
  return hit && hit !== 'stop' ? hit : null;
}
async function 주소로찾기(묶음, 나라, 진행, 그만){
  const 남은 = [...묶음.entries()].slice(0, 8);
  진행('주소', 0, 남은.length);
  let data = null;
  try {
    const r = await sb.functions.invoke('chat', { body: {
      mode: 'addr', trip_id: trip.id, country: 나라,
      items: 남은.map(([, g], i) => ({ i, name: g.local || g.이름, en: g.en || '',
                                      area: g.지역이름 || '' })),
    } });
    data = r.error ? null : r.data;
  } catch {}
  if (!Array.isArray(data?.rows)) return 0;
  let 찍음 = 0;
  for (const r of data.rows){
    if (그만()) break;
    const 짝 = 남은[r?.i];
    if (!짝 || !r?.addr) continue;
    const [k, g] = 짝;
    진행('주소', r.i + 1, 남은.length);
    const hit = await 주소좌표(r.addr, 나라, g.near);
    if (!hit) continue;
    const u = await sb.from('plans').update({ lat: hit.lat, lng: hit.lng }).in('id', g.ids).select('id');
    if (!u.error && u.data?.length){ 찍음 += u.data.length; 묶음.delete(k); }
  }
  return 찍음;
}

/* ── 못 찾은 «곳»에 지도 링크 한 번으로 찍기 ──────────────────────────────
 * 호텔·작은 료칸은 OSM 에 없는 일이 많습니다(실측: 메바에소 · BAND HOTEL HAKATA).
 * 구글 지도 링크는 확실합니다 — 서버(chat 의 `map` 모드, AI 안 씀)가 펴서
 * 좌표를 줍니다. 좌표 없이 주소만 오는 링크는 주소로 한 번 더 찾습니다
 * (geocode.js 의 sniffMapLink 와 같은 길).
 * ⚠ 여행지에서 150km 넘게 먼 좌표는 안 받습니다 — 다른 곳 링크를 잘못
 *   붙인 것입니다.
 * 돌려주는 값: { 찍음 } 또는 { 안됨: '사람이 읽을 이유' } */
export const 지도주소 = /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.[a-z.]+\/maps)\S*/i;
export async function 지도로찍기(ids, 글, near){
  const url = (String(글 || '').match(지도주소) || [])[0];
  if (!url) return { 안됨: '구글 지도 링크가 아니에요. 지도에서 「공유 → 링크 복사」한 것을 붙여 주세요.' };
  const 나라 = String(trip?.country || legs?.[0]?.country || '').toUpperCase();
  const r = await sb.functions.invoke('chat', { body: { mode: 'map', message: url } });
  if (r.error || r.data?.error) return { 안됨: '이 링크를 읽지 못했어요.' };
  let { name, lat, lng } = r.data || {};
  if ((lat == null || lng == null) && name){
    for (const q of [...addressQueries(name), name]){
      const hit = await osmLookup(q, { country: 나라, near });
      if (hit === 'stop') break;
      if (hit){ ({ lat, lng } = hit); break; }
      await 쉼(1100);
    }
  }
  if (lat == null || lng == null) return { 안됨: '링크에서 위치를 못 찾았어요.' };
  if (near && distKm(near[0], near[1], lat, lng) > 150)
    return { 안됨: `여행지에서 ${Math.round(distKm(near[0], near[1], lat, lng))}km 떨어진 곳이에요. 링크를 확인해 주세요.` };
  const u = await sb.from('plans').update({ lat, lng }).in('id', ids).select('id');
  if (u.error) return { 안됨: u.error.message };
  return { 찍음: u.data?.length || 0 };
}
