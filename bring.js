/* ── 일정 불러오기 — 파일과 사진에서 ──────────────────────────────────
 * 이미 어딘가에 적어둔 일정을 앱으로 들여옵니다. 엑셀 표를 올리거나,
 * 화면 사진을 찍어 AI 에게 읽히거나. **직접 다시 치게 하지 않는 것**이
 * 이 화면의 전부입니다 — 3박 4일이면 스무 줄이 넘습니다.
 *
 * 분류 짐작(`guessCat`)도 여기 있습니다. 들여온 줄에는 분류가 없으므로
 * 제목에서 짐작해 붙입니다 — 그래야 일정 화면의 색점이 제 색으로 나옵니다.
 *
 * ── app.js 에서 떼어낸 스물한 번째 조각입니다(b346) ──────────────────
 * app.js 만 아는 것은 셋 — AI 화면 열기, 대화 다시 받기, 그리고 다 읽은 뒤
 * 일정 다시 그리기. 셋 다 **끝나고 넘겨주는 곳**이라 이 조각이 알 필요가
 * 없는 것들입니다.
 *
 * `xlsxLib` 는 **쓸 때 받아옵니다.** 엑셀을 안 올리는 사람이 대부분인데
 * 그 라이브러리는 큽니다 — planmap.js 의 Leaflet 과 같은 이유입니다.
 *
 * ⚠⚠ **날짜·시간·일정 칸이 있는 표는 AI 를 안 거칩니다(b784, sheetimp.js).**
 *   고르는 순간 표를 읽어 「11/6 10개 · 11/7 14개…」를 보여 주고 단추가
 *   「N개 넣기」로 바뀝니다. 누르면 한 번에 넣고 위치까지 찾아 찍습니다.
 *   사진·글·낯선 표는 예전처럼 AI 로 읽어 카드로 보여 줍니다(아래 imp_go).
 *
 * 층: dom.js · db.js · net.js · trip.js · ui.js · card.js 와
 *     이미 떼어낸 aiui.js · cards.js · sheetimp.js 를 씁니다. */
import { $, esc, toast } from './dom.js?v=b832';
import { sb } from './db.js?v=b832';
import { fail } from './net.js?v=b832';
import { trip } from './trip.js?v=b832';
import { syncSheets } from './ui.js?v=b832';
import { fitJpeg, drawSources, SHOT_MAX } from './aiui.js?v=b832';
import { drawCards } from './cards.js?v=b832';
import { 표에서일정, 글표, 일정넣기, 좌표찾기, 넣은것되돌리기, 지도로찍기 } from './sheetimp.js?v=b832';

let ctx = { openAi: () => {}, loadChats: async () => {}, loadPlans: async () => {} };
export function setBringCtx(o){ ctx = { ...ctx, ...o }; }


/* ── 분류 짐작 ──────────────────────────────────────────────────────
 * "라멘"이라고 적었으면 분류는 식사입니다. 매번 고르게 할 이유가 없습니다.
 * 다만 **짐작일 뿐이라 사용자가 고른 것을 덮지 않습니다.**
 * 한 번이라도 직접 골랐으면 그때부터는 손대지 않습니다 —
 * 자동으로 바꿔버리면 고쳐도 고쳐도 되돌아가는 것처럼 느껴집니다. */
const CAT_HINTS = [
  ['카페', /커피|카페|디저트|라떼|아메리카노|빵집|베이커리|케이크|아이스크림|젤라또|스타벅스|블루보틀/],
  ['식사', /라멘|스시|초밥|식당|맛집|점심|저녁|아침|브런치|디너|런치|장어|야키니쿠|야키토리|규카츠|카레|덮밥|정식|코스|오마카세|이자카야|국수|파스타|피자|버거|타코|쌀국수|딤섬|훠궈|바비큐|스테이크|해산물|시장|포차|술집|바\b/],
  ['숙소', /호텔|숙소|체크인|체크아웃|료칸|게스트하우스|에어비앤비|민박|리조트|숙박/],
  ['이동', /공항|기차|신칸센|버스|지하철|전철|페리|렌터카|택시|이동|환승|입국|출국|탑승|고속철|KTX|열차/i],
  ['쇼핑', /쇼핑|백화점|아울렛|면세|마트|드럭스토어|기념품|상점가|편집샵|서점/],
  ['관광', /신사|절|사원|성\b|박물관|미술관|공원|전망대|타워|궁|유적|해변|해수욕장|산\b|호수|폭포|온천|테마파크|동물원|수족관|야경|다리|광장|성당|모스크/],
];
export function guessCat(text){
  const t = String(text || '');
  for (const [cat, re] of CAT_HINTS) if (re.test(t)) return cat;
  return '';
}

/* ── 일정 불러오기 ──────────────────────────────────────────────────
 * 이미 짜둔 일정을 손으로 옮겨 적는 것이 제일 귀찮은 일입니다.
 * 사진·파일·붙여넣은 글 아무 것으로나 받아서 AI 가 읽고 카드로 만듭니다.
 *
 * **바로 저장하지 않습니다.** AI 가 잘못 읽을 수 있고, 남의 일정이 통째로
 * 들어가면 되돌리기가 번거롭습니다. 카드로 보여주고 담는 것은 사용자가 합니다
 * (담기·되돌리기는 AI 시트에 이미 있는 것을 그대로 씁니다).
 *
 * 엑셀(.xlsx)은 그대로 못 읽습니다. 압축된 XML 덩어리라 읽으려면 400KB 짜리
 * 라이브러리를 붙여야 하는데, 표를 복사해서 붙여넣으면 탭으로 나뉜 글이 그대로
 * 들어옵니다. 그게 더 빠르고 가볍습니다. */
let impShots = [], impFiles = [];

/* 엑셀은 압축된 XML 덩어리라 그냥은 못 읽습니다. 읽으려면 도구가 필요한데,
   그걸 늘 받아두면 앱이 1MB 가까이 무거워집니다. 엑셀을 고른 순간에만 받습니다.
   한 번 받으면 서비스워커가 담아둬서 다음부터는 비행기모드에서도 됩니다. */
let xlsxLib = null;
async function loadXlsx(){
  if (xlsxLib) return xlsxLib;
  await new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    s.onload = ok;
    s.onerror = () => no(new Error('엑셀 읽는 도구를 못 받았어요. 연결을 확인해주세요.'));
    document.head.appendChild(s);
  });
  xlsxLib = window.XLSX;
  if (!xlsxLib) throw new Error('엑셀 읽는 도구를 못 받았어요.');
  return xlsxLib;
}

/* 엑셀을 글자로 바꿉니다. 시트가 여럿이면 시트 이름을 붙여 이어 씁니다 —
   "숙소" 시트와 "일정" 시트가 나뉘어 있는 파일이 흔합니다.
   ⚠ **줄×칸(rows)도 같이 돌려줍니다(b784).** 표로 읽을 수 있으면 AI 없이 넣습니다.
     `raw:false` — 화면에 보이는 글자 그대로(「11/6 (금)」·「10:50」). */
async function xlsxRead(file){
  const X = await loadXlsx();
  const wb = X.read(await file.arrayBuffer(), { type:'array' });
  return {
    text: wb.SheetNames.map(name =>
      `[${name}]\n` + X.utils.sheet_to_csv(wb.Sheets[name])).join('\n\n').slice(0, 8000),
    sheets: wb.SheetNames.map(name =>
      X.utils.sheet_to_json(wb.Sheets[name], { header:1, raw:false, defval:'' })),
  };
}

/* 시트마다 표를 찾아 합칩니다. 날마다 시트를 나눈 파일도 흔합니다.
   표가 하나도 없으면 null — 그때는 AI 가 읽습니다. */
function 표모으기(sheets){
  let 찾음 = false;
  const 합 = { items: [], 날짜밖: 0, 날짜모름: 0 };
  for (const rows of sheets){
    const t = 표에서일정(rows, trip);
    if (!t) continue;
    찾음 = true;
    합.items.push(...t.items); 합.날짜밖 += t.날짜밖; 합.날짜모름 += t.날짜모름;
  }
  return 찾음 ? 합 : null;
}

/* ⚠ 전에는 머리줄의 `불러오기`(#impbtn)가 이걸 열었습니다. **그 단추가 무엇을
   불러오는지 알 수 없다**는 말을 듣고 `추가` 폼 안의 두 갈래로 옮겼습니다
   (b365). 일정이 생기는 길은 둘뿐이고 — 직접 적거나 이미 짜둔 것을 옮겨오거나 —
   둘이 같은 자리에 있어야 설명이 필요 없습니다. */
function openImport(){
  /* 폼 둘이 나란히 서 있으면 어디에 적어야 하는지 헷갈립니다. */
  $('plancard').classList.add('hide');
  $('importcard').classList.remove('hide');
  $('imperr').classList.add('hide');
  /* 앞서 넣은 결과 칸은 걷습니다. 위치 찾기가 아직 돌고 있으면 뒤에서 마저
     돕니다 — 판만 넘겨서 그 글이 새 카드를 덮지 않게 합니다(b784). */
  $('imp_done').classList.add('hide'); ++좌표판;
  impShots = []; impFiles = [];
  $('imp_text').value = '';
  drawImpPicked();
  /* 여기도 시트라 끌어올 것이 없습니다(b366). */
}
$('p_how_import').addEventListener('click', openImport);

/* 닫으면 칩을 '직접 적기'로 되돌립니다. 안 그러면 다음에 `추가` 를 열었을 때
   폼은 적는 화면인데 칩만 '사진·링크에서'를 가리키고 서 있습니다. */
function resetHow(){
  $('p_how_write').classList.add('on');
  $('p_how_import').classList.remove('on');
}
$('p_how_write').addEventListener('click', resetHow);
$('imp_cancel').addEventListener('click', () => {
  $('importcard').classList.add('hide'); resetHow();
});
$('imp_pick').addEventListener('click', () => $('imp_file').click());

function drawImpPicked(){
  $('imp_shots').classList.toggle('hide', !impShots.length);
  $('imp_shots').innerHTML = impShots.map((s, i) =>
    `<span class="shot1"><img src="${s.url}" alt="">
       <button class="x" data-impx="${i}" aria-label="빼기">×</button></span>`).join('');
  $('imp_files').classList.toggle('hide', !impFiles.length);
  $('imp_files').textContent = impFiles.length
    ? '파일 ' + impFiles.map(f => f.name).join(' · ') : '';
  표미리보기();
}

/* ── 표로 바로 넣을 수 있나(b784) ──────────────────────────────────────
 * 고른 것이 **전부 표**이고 사진·붙여넣은 글이 없을 때만입니다. 섞여 있으면
 * AI 가 한꺼번에 읽는 편이 맞습니다(사진 속 일정과 표를 맞춰 봐야 하므로). */
const 표합 = () => impFiles.map(f => f.표).filter(Boolean);
function 표로갈까(){
  return impFiles.length > 0 && impFiles.every(f => f.표) && !impShots.length
      && !$('imp_text').value.trim() && 표합().some(t => t.items.length);
}
const 요일 = d => '일월화수목금토'[new Date(d + 'T00:00:00Z').getUTCDay()];
const 짧은날 = d => `${+d.slice(5, 7)}/${+d.slice(8)}(${요일(d)})`;
/* 넣기 **전에** 무엇이 어디로 들어가는지 보여 줍니다. 묻는 단계 대신입니다 —
   「다 담기」가 확인 없이 넣던 것이 문제였던 자리(b388, cards.js)와 같은 이유. */
function 표미리보기(){
  const 칸 = $('imp_table');
  const 표들 = 표합();
  const items = 표들.flatMap(t => t.items);
  const 간다 = 표로갈까();
  $('imp_go').textContent = 간다 ? `일정 ${items.length}개 넣기` : '읽어오기';
  const 뺀 = 표들.reduce((s, t) => s + t.날짜밖, 0);
  const 모름 = 표들.reduce((s, t) => s + t.날짜모름, 0);
  if (!간다 && !(표들.length && !items.length)){ 칸.classList.add('hide'); 칸.innerHTML = ''; return; }
  if (!items.length){
    칸.innerHTML = `표는 읽었는데 이 여행 날짜(${짧은날(trip.start_date)}~${짧은날(trip.end_date)})에 ` +
                  `맞는 줄이 없어요.` + (뺀 ? ` 날짜 밖 ${뺀}줄.` : '');
    칸.classList.remove('hide');
    return;
  }
  const 날마다 = {};
  for (const it of items) 날마다[it.date] = (날마다[it.date] || 0) + 1;
  칸.innerHTML = `<b>표에서 일정 ${items.length}개를 읽었어요</b><br>` +
    esc(Object.keys(날마다).sort().map(d => `${짧은날(d)} ${날마다[d]}개`).join(' · ')) +
    (뺀 ? `<br>여행 날짜 밖이라 뺀 줄 ${뺀}개` : '') +
    (모름 ? `<br>날짜를 못 읽어 뺀 줄 ${모름}개` : '') +
    '<br>누르면 바로 일정에 들어가고 위치도 찾아서 찍어요. 이미 있는 줄은 다시 안 넣어요.';
  칸.classList.remove('hide');
}
$('imp_text').addEventListener('input', 표미리보기);

/* ── 표로 넣기 ── 넣고 → 일정을 다시 그리고 → 위치를 찾습니다.
 * ⚠ 위치 찾기는 **뒤에서 계속** 돕니다(OSM 이 초당 한 번이라 30곳이면 30초 남짓).
 *   카드를 닫아도 멈추지 않습니다 — 되돌리기를 눌렀을 때만 멈춥니다.
 * ⚠ `좌표판` — 새로 불러오거나 되돌리면 앞선 찾기가 글을 덮지 않게 판을 셉니다. */
let 방금넣은 = [], 좌표판 = 0, 되돌린판 = -1;
function 좌표말(r){
  if (r.그만둠) return '';
  if (r.안됨)
    return '위치는 못 찾았어요' + (r.이유 ? ` (${r.이유})` : '') +
           '. 일정 화면의 「좌표 채우기」로 다시 해볼 수 있어요.';
  const 못 = r.못찾음 || [];
  const 줄수 = 못.reduce((s, g) => s + g.ids.length, 0);
  return `위치 ${r.찍음}줄을 찍었어요.` +
    (못.length ? ` 지도에서 못 찾은 ${못.length}곳(${줄수}줄)은 아래에 구글 지도 링크를 붙이면` +
                 ' 그 곳의 줄에 한꺼번에 찍혀요.' : '') +
    (r.장소아님 ? ` 점심·휴식처럼 어디인지 정해지지 않은 ${r.장소아님}줄은 비워 뒀어요.` : '') +
    (r.멈춤 ? ' 지도 서버가 잠시 쉬라고 해서 멈췄어요 — 남은 곳도 아래에 있어요.' : '');
}

/* ── 못 찾은 곳 — 곳마다 링크 한 번(b784) ──────────────────────────────
 * 료칸 하나가 여섯 줄에 나옵니다. 줄마다 「수정」을 열어 링크를 붙이게 하면
 * 여섯 번이라, 곳으로 묶어 한 칸씩만 보여 줍니다(sheetimp.js 의 지도로찍기). */
/* 일정 다시 받기. 연결이 끊겨 실패해도 넣기·위치 찾기 흐름은 이어갑니다 —
   이미 들어간 것은 들어간 것이고, 화면은 다음에 열 때 맞춰집니다. */
const 다시그리기 = async () => { try { await ctx.loadPlans(); } catch {} };
let 못묶음 = [];
function 못그리기(){
  const 칸 = $('imp_miss');
  칸.innerHTML = 못묶음.map((g, i) => `
    <div style="margin-top:10px">
      <div><b>${esc(g.이름)}</b> <span class="memo">· ${g.ids.length}줄</span>` +
      (g.끝 ? ` <span style="color:var(--ok)">✓ ${esc(g.끝)}</span></div>` : `</div>
      <div style="display:flex; gap:6px; margin-top:4px">
        <input data-missurl="${i}" placeholder="구글 지도 링크 붙여넣기" inputmode="url"
               style="flex:1; min-width:0">
        <button class="small" data-missgo="${i}">찍기</button>
      </div>`) + `
    </div>`).join('');
  칸.classList.toggle('hide', !못묶음.length);
}
$('imp_miss').addEventListener('click', async e => {
  const b = e.target.closest('[data-missgo]');
  if (!b) return;
  const i = +b.dataset.missgo, g = 못묶음[i];
  if (!g) return;
  const 글 = $('imp_miss').querySelector(`[data-missurl="${i}"]`)?.value || '';
  $('imperr').classList.add('hide');
  b.disabled = true; b.innerHTML = '<span class="load">찾는 중…</span>';
  const r = await 지도로찍기(g.ids, 글, g.near);
  b.disabled = false; b.textContent = '찍기';
  if (r.안됨) return fail(r.안됨, 'imp');
  g.끝 = `${r.찍음}줄에 찍었어요`;
  못그리기();
  await 다시그리기();
});
async function 표로넣기(){
  const b = $('imp_go');
  const items = 표합().flatMap(t => t.items);
  $('imperr').classList.add('hide');
  b.disabled = true; b.innerHTML = '<span class="load">넣는 중…</span>';
  let 결과;
  try { 결과 = await 일정넣기(items, guessCat); }
  catch (err){ b.disabled = false; 표미리보기(); return fail(err, 'imp'); }
  b.disabled = false;
  impFiles = []; impShots = []; $('imp_text').value = '';
  drawImpPicked();
  const { 넣은, 있던 } = 결과;
  const 판 = ++좌표판;
  방금넣은 = 넣은.map(x => x.id);
  못묶음 = []; 못그리기();
  $('imp_done').classList.remove('hide');
  $('imp_done_msg').textContent = 넣은.length
    ? `일정 ${넣은.length}개를 넣었어요.` + (있던 ? ` 이미 있던 ${있던}개는 건너뛰었어요.` : '')
    : `새로 넣을 것이 없어요 — ${있던}개가 이미 들어 있어요.`;
  $('imp_undo').classList.toggle('hide', !넣은.length);
  $('imp_geo_msg').textContent = 넣은.length ? '위치를 찾는 중…' : '';
  /* 결과 칸은 시트 맨 아래(「읽어오기」 밑)라 폰에서는 화면 밖입니다 — 내려 줍니다. */
  $('imp_done').scrollIntoView({ block: 'nearest' });
  await 다시그리기();
  if (!넣은.length) return;
  const r = await 좌표찾기(넣은, (단계, i, n) => {
    if (판 !== 좌표판) return;
    /* ⚠ 「10초쯤」이 틀렸습니다(b785) — 실제로는 20~60초 걸립니다. 모르는 채
       「10초」라고 하면 20초째부터 멈춘 줄 압니다. */
    $('imp_geo_msg').textContent =
      단계 === '이름' ? '장소 이름을 확인하는 중…(길면 1분)'
      : 단계 === '주소' ? `숙소처럼 지도에 없는 곳은 주소로 찾는 중…${n ? ` ${i}/${n}` : ''}`
      : `위치를 찾는 중… ${i}/${n}`;
  }, () => 되돌린판 === 판);
  if (되돌린판 === 판) return;
  await 다시그리기();
  if (판 !== 좌표판) return;
  $('imp_geo_msg').textContent = 좌표말(r);
  못묶음 = r.못찾음 || [];
  못그리기();
}
$('imp_undo').addEventListener('click', async () => {
  const u = $('imp_undo');
  if (!방금넣은.length) return;
  되돌린판 = 좌표판;
  u.disabled = true; u.innerHTML = '<span class="load">되돌리는 중…</span>';
  try { await 넣은것되돌리기(방금넣은); }
  catch (err){ u.disabled = false; u.textContent = '방금 넣은 것 되돌리기'; return fail(err, 'imp'); }
  toast(`${방금넣은.length}개를 되돌렸어요.`);
  방금넣은 = [];
  못묶음 = []; 못그리기();
  u.disabled = false; u.textContent = '방금 넣은 것 되돌리기';
  $('imp_done').classList.add('hide');
  await 다시그리기();
});
$('imp_shots').addEventListener('click', e => {
  const b = e.target.closest('[data-impx]'); if (!b) return;
  impShots.splice(+b.dataset.impx, 1); drawImpPicked();
});

$('imp_file').addEventListener('change', async e => {
  const files = [...(e.target.files || [])];
  e.target.value = '';
  $('imperr').classList.add('hide');
  for (const f of files){
    if (f.type.startsWith('image/')){
      if (impShots.length >= SHOT_MAX){ toast(`사진은 ${SHOT_MAX}장까지예요.`); continue; }
      try { impShots.push(await fitJpeg(f)); } catch (err){ fail(err, 'imp'); }
      continue;
    }
    if (/\.xlsx?$/i.test(f.name)){
      toast('엑셀을 읽는 중…');
      try {
        const { text, sheets } = await xlsxRead(f);
        impFiles.push({ name: f.name, text, 표: 표모으기(sheets) });
      }
      catch (err){ fail(err, 'imp'); }
      continue;
    }
    if (/\.pdf$/i.test(f.name)){
      fail('PDF 는 아직 못 읽어요. 화면을 캡처해서 사진으로 올려주세요.', 'imp');
      continue;
    }
    /* 나머지는 글자 파일로 봅니다. CSV·TSV·메모장이 여기 들어옵니다. */
    try {
      const text = await f.text();
      impFiles.push({ name: f.name, text: text.slice(0, 8000), 표: 표모으기([글표(text)]) });
    } catch { fail(`${f.name} 을 읽지 못했어요.`, 'imp'); }
  }
  drawImpPicked();
});

$('imp_go').addEventListener('click', async () => {
  /* 표면 AI 를 안 거칩니다(b784 — 위 `표로넣기`). */
  if (표로갈까()) return 표로넣기();
  const b = $('imp_go');
  $('imperr').classList.add('hide');
  const typed = $('imp_text').value.trim();
  const fileText = impFiles.map(f => `[${f.name}]\n${f.text}`).join('\n\n');
  const text = [typed, fileText].filter(Boolean).join('\n\n');
  if (!text && !impShots.length)
    return fail('사진이나 파일을 고르거나, 일정을 붙여넣어주세요.', 'imp');

  /* 20~30초가 걸리는 일입니다. "읽는 중…" 하나만 두면 멈춘 줄 알고 다시 누릅니다.
     지금 무엇을 하고 있는지 단계로 바꿔 보여줍니다. 진짜 진행률은 알 수 없지만
     **글자가 바뀌는 것만으로도 살아 있다는 신호가 됩니다.** */
  /* 문구에 '블로그'를 박아두면 구글 지도 링크를 넣었을 때 틀린 말이 됩니다.
     읽는 대상이 무엇이든 맞는 말로 둡니다. */
  const hasLink = /https?:\/\//.test(text);
  const steps = [
    [0,     hasLink ? '링크를 여는 중…' : '읽는 중…'],
    [4000,  hasLink ? '링크 안을 읽는 중…' : '내용을 살펴보는 중…'],
    [9000,  '날짜와 장소를 골라내는 중…'],
    [16000, '거의 다 됐어요…'],
    /* ⚠ **"글이 길면"은 사실이 아닐 때가 많습니다 (b389).** 실사용 점검에서
       한 줄짜리 글도 28초가 걸렸습니다. 걸리는 시간의 대부분은 글 길이가
       아니라 **모델이 답을 써 내려가는 시간**이고, 이건 짧은 글도 마찬가지입니다.
       (가벼운 모델로 바꾸면 13초가 되지만 일정이 새서 되돌렸습니다 — 위 참고.)
       사실이 아닌 이유를 대면 사용자가 엉뚱한 것을 고치려 듭니다. */
    [26000, '조금만 더요. 빠뜨리지 않으려고 꼼꼼히 보는 중이에요…'],
  ];
  const timers = steps.map(([ms, msg]) => setTimeout(
    () => { b.innerHTML = `<span class="load">${esc(msg)}</span>`; }, ms));

  b.disabled = true; b.innerHTML = `<span class="load">${esc(steps[0][1])}</span>`;
  const { data, error } = await sb.functions.invoke('chat', {
    body: { trip_id: trip.id, mode: 'import', message: text.slice(0, 8000),
            images: impShots.map(s => ({ mime: s.mime, data: s.data })) },
  });
  timers.forEach(clearTimeout);
  b.disabled = false; b.textContent = '읽어오기';

  /* 링크를 줬는데 못 읽었으면 그 사실을 말해줍니다. 조용히 넘어가면
     "링크를 왜 무시하지?"만 알고 이유를 모릅니다. */
  const bad = (data?.blogs || []).filter(x => !x.ok);
  if (bad.length)
    toast(bad.length === 1 ? '링크 1개는 못 읽었어요 (로그인이 필요하거나 막힌 글)'
                           : `링크 ${bad.length}개는 못 읽었어요`);

  if (error || data?.error){
    let why = data?.error || error?.message || '';
    try { why = (await error?.context?.json())?.error || why; } catch {}
    return fail(why, 'imp');
  }
  /* **후보(places)만 나올 수 있습니다.** 구글 지도 링크처럼 날짜가 없는 것은
     일정이 아니라 후보로 옵니다. actions 만 세면 멀쩡히 읽어놓고
     "일정을 못 찾았어요"로 튕깁니다. */
  const got = (data.actions?.length || 0) + (data.places?.length || 0);
  if (!got)
    return fail(bad.length
      ? '링크를 못 읽었어요. 로그인이 필요한 글이거나 막아둔 블로그일 수 있어요. ' +
        '글을 복사해서 아래 칸에 붙여넣으면 그대로 읽어드려요.'
      : '일정을 못 찾았어요. 사진이 흐리거나 형식이 낯설 수 있어요.', 'imp');

  /* 결과는 AI 시트에서 봅니다. 담기·되돌리기가 거기 이미 있습니다 —
     여기서 또 만들면 두 벌이 되고 언젠가 한쪽만 고칩니다. */
  $('importcard').classList.add('hide');
  syncSheets();
  ctx.openAi();
  /* ⚠ **고르개에 없으면 한 칸을 만들어 넣습니다(b759).** 그 칸은 이제
     «다가오는 여행»만 담습니다(plancheck.js 의 `loadAi`) — 지난 여행을
     열어 놓고 여기를 누르면 `value` 대입이 조용히 빈 값이 되어, 엉뚱하게
     「여행 선택」 상태의 대화가 열립니다. 지금 보고 있는 여행이 빠질 수는
     없으므로 여기서 채웁니다. */
  {
    const 칸 = $('ai_trip');
    if (칸 && !칸.querySelector(`option[value="${trip.id}"]`))
      칸.insertAdjacentHTML('beforeend',
        `<option value="${esc(trip.id)}">${esc(trip.title || '이 여행')}</option>`);
  }
  $('ai_trip').value = trip.id;
  await ctx.loadChats(trip.id);
  drawSources(data.sources, data.web);
  drawCards(data);
  toast(`${got}개를 읽었어요. 확인하고 담아주세요.`);
});

