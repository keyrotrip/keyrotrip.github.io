/* ── 화면 밑바탕 ───────────────────────────────────────────────────────
 * 아무것도 import 하지 않는 잎 모듈입니다. **여기에 import 를 더하지 마세요** —
 * 이 파일이 뭔가에 기대기 시작하면 net.js·admin.js 와 고리가 생겨 순환 참조가
 * 납니다. 지금은 net.js 가 toast 를 쓰고 admin.js 가 넷 다 쓰는데, 이쪽이
 * 아무에게도 안 기대므로 한 방향으로만 흐릅니다.
 *
 * 여기 들어올 자격: 앱 상태(trip·plans·me…)를 모르고, 브라우저만 있으면
 * 되는 것. 그 조건을 못 지키면 여기가 아니라 쓰는 쪽에 두세요.
 */

/* 이 앱의 유일한 요소 접근자입니다. querySelector 를 직접 쓰는 자리가
   몇 군데 있지만 id 로 찾는 것은 전부 이걸 지납니다. */
export const $ = id => document.getElementById(id);

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* 잠깐 떴다 사라지는 알림. #toast 가 없으면 그 자리에서 만듭니다 —
   index.html 에 미리 둘 필요가 없고, 안 쓰는 화면에서는 아예 안 생깁니다. */
let toastT = null;
export function toast(msg){
  let t = $('toast');
  if (!t){ t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), 3200);
}

/* 클립보드는 창이 포커스를 잃었거나 권한이 없으면 그냥 거절합니다.
   그래서 옛 방식(execCommand)으로 한 번 더 해봅니다. 둘 다 실패하면 false. */
export async function copyText(t){
  try { await navigator.clipboard.writeText(t); return true; } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed; top:0; left:0; opacity:0';
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, t.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

/* ── 마크다운 조금 ────────────────────────────────────────────────────
 * AI 는 마크다운으로 씁니다. 그대로 찍으면 별표가 글자로 보입니다.
 * 반드시 먼저 이스케이프하고 나서 태그로 바꿉니다 — 순서를 바꾸면
 * AI 가 돌려준 글이 그대로 HTML 이 됩니다.
 *
 * **app.js 에 있던 것을 여기로 내렸습니다(b335).** report.js 가 답변을
 * 그리면서 이것을 쓰는데 import 가 없었습니다. 문자열 안에서 불려서
 * 검사도 브라우저도 그 화면을 열기 전까지 아무 말이 없었습니다. */
export function md(s){
  return esc(s)
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/^\s*[*-]\s+/gm, '· ')
    .replace(/^\s*(#{1,4})\s+(.+)$/gm, '<b>$2</b>')
    .replace(/\n/g, '<br>');
}

/* ── 기본 프로필 그림 ────────────────────────────────────────────────
 * 구글에서 사진을 안 받기로 했으니(041) 새로 가입하면 그림이 아예 없습니다.
 * src 가 빈 <img> 는 흰 네모나 깨진 아이콘으로 보입니다 — 실제로 그랬습니다.
 *
 * 이름 첫 글자를 그려 채웁니다. **글자로 만드는 것이라 저장소도 네트워크도
 * 안 씁니다** — 비행기모드에서도 나오고 사진 값도 안 듭니다.
 * 색은 계정 id 에서 뽑으므로 기기를 바꿔도 같은 사람은 같은 색입니다.
 *
 * **app.js 에 있던 것을 여기로 내렸습니다(b335)** — city.js 가 남들 한줄평에
 * 얼굴을 다는데 import 가 없었습니다. 여기 있을 자격이 됩니다: 앱 상태를
 * 모르고 esc 하나만 씁니다. */
const AV_BG = ['#4a7ebb', '#5a9367', '#b4794a', '#8a6bb1',
               '#c06a6a', '#3f8f93', '#a1783f', '#6b7fa8'];
export function avatarOf(seed, label){
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  /* 이모지는 서로게이트 쌍이라 [0] 으로 자르면 반쪽만 남아 깨집니다.
     영문은 대문자로 올립니다 — 한글·이모지는 대소문자가 없어 그대로입니다. */
  const ch = ([...String(label || '').trim()][0] || '·').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
    + `<rect width="64" height="64" rx="32" fill="${AV_BG[h % AV_BG.length]}"/>`
    + `<text x="32" y="34" fill="#fff" font-size="30" font-weight="600"`
    + ` text-anchor="middle" dominant-baseline="central"`
    + ` font-family="-apple-system,'Apple SD Gothic Neo',sans-serif">${esc(ch)}</text></svg>`;
  /* encodeURIComponent 가 따옴표까지 인코딩해서 그대로 속성에 넣어도 안전합니다. */
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
/* 올려둔 사진의 주소가 깨졌을 때 숨기면 흰 구멍이 남습니다. 기본 그림으로 되돌립니다. */
export function avatarImg(url, seed, label, style, cls){
  const fb = avatarOf(seed, label);
  return `<img ${cls ? `class="${cls}" ` : ''}src="${esc(url || fb)}" alt="" data-fb="${fb}"
    onerror="this.onerror=null;this.src=this.dataset.fb"${style ? ` style="${style}"` : ''}>`;
}

/* ── 빈 화면 ──────────────────────────────────────────────────────────
 * "아직 지출이 없어요." 한 줄만 두면 처음 온 사람은 여기서 멈춥니다.
 * 추가 단추는 카드 오른쪽 위에 작게 있어서 눈이 안 갑니다.
 * **빈 화면은 앱이 처음 쓰는 사람을 가르칠 유일한 기회입니다.**
 * 무엇을 하면 되는지 그 자리에 큼직하게 둡니다.
 *
 * **app.js 에 있던 것을 여기로 내렸습니다(b335)** — 지출을 떼어내니
 * 이것 하나 때문에 ctx 가 한 줄 늘어나게 생겼습니다. esc 밖에 안 쓰므로
 * 여기 있을 자격이 됩니다. 다음에 떼는 화면들도 다 이걸 씁니다. */
/* ── 빈 화면은 한 가지 말투로만 적습니다 (b363) ───────────────────────
 * 전에는 탭마다 달랐습니다. 지출은 "아직 지출이 없어요" + 큰 단추,
 * 준비물은 설명 문장 + 그 자리 입력폼, 예약은 문장 하나에 동작은 오른쪽
 * 위 작은 `추가` — 같은 여행 안에서 규칙이 셋이었습니다.
 *
 *   `text`   무엇이 없는지. **"아직 ~가 없어요."** 로 통일합니다.
 *   `hint`   왜 넣으면 좋은지. 한 줄. 없어도 됩니다.
 *   `btnId`  **동작이 숨어 있을 때만** 답니다(단추를 눌러야 폼이 열리는 자리).
 *            준비물·링크처럼 **입력폼이 이미 보이는 자리에는 안 답니다** —
 *            달면 같은 일을 하는 단추가 20px 거리에 둘이 됩니다.
 *
 * 안내 줄은 새 스타일을 만들지 않고 `.memo` 를 그대로 씁니다 —
 * 계단(15px 제목 / 13px 안내)이 앱의 나머지와 같아야 합니다. */
/* `more` 는 **두 번째 길**입니다 — `{ label, go }`.
   ⚠ 두 단추가 같은 무게로 서면 고르기가 일이 됩니다. 뒤엣것은 흐리게 답니다.
   길이 정말 둘일 때만 쓰십시오(예: 빈 일정 — 직접 적기 / AI 로 짜기).
   하나로 되는 곳에 굳이 둘을 두지 않습니다. */
export function emptyDo(text, label, btnId, hint, more){
  return `<div class="empty emptydo">
    <div class="t">${esc(text)}</div>
    ${hint ? `<div class="memo h">${esc(hint)}</div>` : ''}
    ${btnId ? `<button class="primary" data-go="${esc(btnId)}">${esc(label)}</button>` : ''}
    ${more?.go ? `<button class="ghost" data-go="${esc(more.go)}"
        style="display:block; margin:8px auto 0">${esc(more.label)}</button>` : ''}
  </div>`;
}

/* ── 조사 ────────────────────────────────────────────────────────────
 * '가보고 싶은 곳**이** 없어요' / '다녀온 도시**가** 없어요'.
 * 보관함처럼 **이름을 표에서 꺼내 문장에 끼우는 자리**가 있는데, 거기에
 * 조사를 손으로 적으면 이름을 바꾸는 날 한쪽을 반드시 놓칩니다.
 * 받침이 있으면 앞의 것을, 없으면 뒤의 것을 씁니다.
 * 한글이 아니면(영문·숫자) 받침 없는 쪽으로 봅니다. */
export const josa = (word, withBatchim, without) => {
  const s = String(word ?? '').trim();
  const c = s.charCodeAt(s.length - 1) - 0xAC00;
  return s + (c >= 0 && c < 11172 && c % 28 !== 0 ? withBatchim : without);
};
/* 빈 화면의 단추는 원래 있던 단추를 대신 눌러줍니다 — 여는 방법을 두 벌로
   만들면 한쪽만 고치는 날이 옵니다. **위 함수와 붙여 둡니다**: 떨어뜨리면
   단추만 옮기고 손잡이를 두고 가는 날이 옵니다. */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (b) $(b.dataset.go)?.click();
});

/* ── 제자리 안내 한 줄(b807) ─────────────────────────────────────────
 * 사용자: 「원래 앱에 처음 들어오면 유저들한테 기능 설명하는 카드같은거 있지 않아?」 → 설계 셋 + 다른 앱
 * 벤치마크(소개 카드를 쓰는 앱이 없었고, NN/g 실험에서 카드는 앱을 «더 어렵게» 느끼게 함) → 시안 C 를 고름.
 * 새 화면을 띄우지 않고 **그 탭의 그 자리에 한 줄**(.tabtip)만 둡니다. 할 일을 마치면 부르는 쪽이 숨기고,
 * ×(data-tipoff="이름")를 누르면 영구로 끕니다.
 * ⚠ 열쇠는 기록 탭 칩과 **같은 칸**(`t2:chipoff:<이름>`, home.js 의 껐나·끄기)입니다 — 로그아웃하면 forgetLocal 이
 *   t2: 를 다 지우므로, 할 일을 아직 안 한 사람에게는 다시 뜹니다(칩과 같은 동작).
 * ⚠ 끈 기록은 **누를 때만** 적습니다(그릴 때 적지 않음 — 「썼다≠봤다」, b528). */
export const tipOff = k => { try { return localStorage.getItem('t2:chipoff:' + k) === '1'; } catch { return false; } };
document.addEventListener('click', e => {
  const x = e.target.closest('[data-tipoff]');
  if (!x) return;
  try { localStorage.setItem('t2:chipoff:' + x.dataset.tipoff, '1'); } catch {}
  x.closest('.tabtip')?.classList.add('hide');
});

/* ── 국기 ─────────────────────────────────────────────────────────────
 * 나라 코드로 국기를 만듭니다. ISO 3166-1 두 글자를 지역표시기호로 옮기는
 * 규칙이라 나라마다 따로 적어둘 것이 없습니다 — 적어두면 언젠가 틀립니다.
 *
 * ── 같은 규칙이 두 곳에 있었습니다(b339) ─────────────────────────────
 * app.js 에 `flagOf` 가 있고, map.js 의 '다녀온 국가' 안에 **같은 계산이
 * 인라인으로 한 번 더** 적혀 있었습니다(`+127397`, 0x1F1E6-65 와 같은 수).
 * 도시 검색을 떼어내다 발견했습니다. 둘을 여기 하나로 모읍니다.
 *
 * 짝인 `flagOk` 도 map.js 에서 같이 내렸습니다. 떨어뜨려 두면 도시 검색이
 * 국기 하나 때문에 지도 화면을 import 하게 됩니다 — 화면이 화면에 기대는
 * 모양이라 층이 꼬입니다. 둘 다 앱 상태를 모르고 브라우저만 있으면 되므로
 * 여기 있을 자격이 됩니다. */
export function flagOf(code){
  if (!/^[A-Za-z]{2}$/.test(code || '')) return '';
  return String.fromCodePoint(...[...code.toUpperCase()]
    .map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65));
}

/* 이 기기가 국기를 그릴 수 있나. 한 번만 재고 기억합니다 —
   캔버스 글자 재기는 값싸지만 나라 스물일곱 번 부를 일은 아닙니다.
   못 그리는 기기(윈도우 크롬)에서 합치지 않으면 화면이 "KR JP IT CH…"
   코드 나열이 되어 없느니만 못합니다. 실기기에서 재보고 알았습니다. */
let flagCan = null;
export function flagOk(){
  if (flagCan != null) return flagCan;
  try {
    const g = document.createElement('canvas').getContext('2d');
    g.font = '20px sans-serif';
    /* 🇰🇷 가 한 글자로 합쳐지면 폭이 🇰 하나와 비슷합니다.
       못 합치면 두 글자를 나란히 그려서 정확히 두 배가 됩니다. */
    flagCan = g.measureText('\u{1F1F0}\u{1F1F7}').width
            < g.measureText('\u{1F1F0}').width * 2 - 1;
  } catch { flagCan = false; }
  return flagCan;
}

/* ── 깃발 그림판 (b649) ──────────────────────────────────────────────
 * 그림 195개를 묶은 `flags.svg` 를 문서에 한 번 심습니다.
 * ⚠ **b624 에 shelf.js 안에 있던 것을 여기로 내렸습니다.** 이제 «두 곳»이
 *   씁니다 — 깃발 벽(화면)과 공유 카드(캔버스). 두 벌로 두면 한쪽만
 *   고치는 사고가 납니다. 여기는 브라우저만 있으면 되는 잎이라 자격이
 *   됩니다(flagOf·flagOk 와 같은 이유).
 * ⚠ **깃발이 필요할 때만 받습니다.** 356KB 를 첫 실행에 얹으면 이 화면
 *   하나 때문에 모두가 느려집니다.
 * ⚠ 못 받으면(첫 실행 + 비행기모드) 부르는 쪽이 **이모지로 떨어집니다.**
 *   그 길을 지우지 마십시오.
 * ⚠ 그림은 Twemoji, **CC BY 4.0**. 출처를 밝혀야 합니다 — 깃발 벽 아래에
 *   한 줄 답니다(shelf.js). 그 줄을 지우면 라이선스 위반입니다. */
let 깃발판 = null;                 /* null 아직 · false 실패 · true 됨 */
export async function flagSprite(){
  if (깃발판 != null) return 깃발판;
  try {
    const r = await fetch('./flags.svg?v=b823');
    if (!r.ok) return (깃발판 = false);
    const 통 = document.createElement('div');
    통.id = 'flagsprite';
    통.innerHTML = await r.text();
    document.body.appendChild(통);
    return (깃발판 = true);
  } catch { return (깃발판 = false); }
}

/* 깃발 하나를 **혼자 서는 SVG** 로 꺼냅니다 — 캔버스에 그리려면 `<use>`
   로는 안 되고 제 문서가 있어야 하기 때문입니다.
   ⚠ `flags.svg` 를 구울 때 **심볼 안의 id 를 나라 코드로 앞가림**해
     두었습니다(tools/flagsprite.pl). 그래서 잘라내도 안쪽 참조가 안
     엉킵니다 — 그 규칙을 깨면 여기가 조용히 깨집니다.
   ⚠ `data:` 로 넣으므로 캔버스가 안 더러워집니다(toBlob 이 삽니다). */
export function flagSvgOf(code){
  const 판 = document.getElementById('flagsprite');
  if (!판) return '';
  const 심 = 판.querySelector(`#f-${String(code || '').toLowerCase()}`);
  if (!심) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg"
               xmlns:xlink="http://www.w3.org/1999/xlink"
               viewBox="0 0 36 36" width="72" height="72">${심.innerHTML}</svg>`;
}

/* ── 같은 것을 다시 그리지 않습니다 ──────────────────────────────────
 * **탭을 누를 때마다 목록을 통째로 갈아끼우고 있었습니다.** 글자는 똑같이
 * 다시 그려도 티가 안 나는데 **사진은 요소가 버려졌다 새로 만들어져서**
 * 빈 칸이 보였다 채워집니다. 주소가 같아도 그렇습니다 — 요소가 새것이라
 * 처음부터 다시 그리기 때문입니다.
 *
 * b276 에서 기록 탭만 고쳤는데 사용자가 **홈의 평가·지도와 여행 목록도
 * 그대로 깜빡인다**고 했습니다. 같은 구조가 네 곳인데 한 곳만 봤던 것입니다.
 * 그래서 규칙을 여기 한 곳에 둡니다.
 *
 * ⚠ **비교는 우리가 만든 글자끼리** 합니다. `el.innerHTML` 을 도로 읽으면
 *   브라우저가 따옴표와 속성 순서를 제 식대로 바꿔 놓아 **늘 다르다고 나옵니다.**
 * ⚠ **밖에서 그 상자를 손대면 반드시 `dropHtml` 로 무효로** 하십시오.
 *   안 그러면 "같으니 건드리지 말자"가 화면과 어긋난 채로 굳습니다.
 *
 * **app.js 에 있던 것을 여기로 내렸습니다(b351).** `$` 하나만 쓰고 앱 상태를
 * 모르므로 여기 있을 자격이 됩니다. 네 화면이 쓰는데 app.js 에 두면
 * 떼어낸 조각마다 ctx 로 두 줄씩 늘어납니다. */
const lastHtml = {};
export function putHtml(id, html){
  if (lastHtml[id] === html) return false;      /* 안 바뀌었으면 손대지 않습니다 */
  $(id).innerHTML = html;
  lastHtml[id] = html;
  return true;
}
export const dropHtml = id => { delete lastHtml[id]; };

/* ── 뒤로 단추 글자 ───────────────────────────────────────────────────
 * 지도·성향·보관함은 **프로필 위에 얹히는 판**이라 뒤로 단추가
 * 「← 프로필」로 못 박혀 있었습니다. 이제 홈·분석에서도 열리므로,
 * 어디서 왔든 「프로필」이라 적혀 있으면 틀린 말이 됩니다.
 *
 * ⚠ **map.js 에 있던 것을 여기로 내렸습니다(b457).** map.js 안에 두었더니
 *   persona.js 가 이 함수를 쓰면서 **import 를 안 했습니다.** 같은 파일에
 *   있는 map.js 는 멀쩡했고 persona.js 만 조용히 ReferenceError 로 죽어서,
 *   분석 탭의 「자세히 보기」가 **눌러도 아무 일이 없었습니다.**
 *   최하위(dom.js)에 두면 누구든 이미 import 하고 있어 그런 일이 없습니다.
 *   — [[ctx-injection-trap]] 과 같은 종류의 함정입니다. */
/* ⚠ **하단바에 적힌 것과 «똑같은» 말이어야 합니다(b542).** 「← 기록」을
   눌렀는데 하단바에는 「홈」이라 적혀 있으면 같은 곳인 줄 모릅니다.
   이름을 바꾸려거든 index.html 의 탭바와 여기를 «같이» 고치십시오. */
/* ── 사진을 «비율 그대로» 줄입니다(b567) ──────────────────────────────
 * ⚠⚠ **프로필의 `shrink` 를 쓰면 안 됩니다.** 그건 아바타용이라
 *   ① 가운데를 **정사각으로 잘라내고** ② 작은 사진도 **늘립니다**.
 *   일기 사진에 썼다가 실제로 겪었습니다(b565): 1280×853 짜리가
 *   **1280×1280 정사각**이 되고, 파일이 125KB → 254KB 로 «커졌습니다».
 *   줄이려고 부른 함수가 늘린 것입니다.
 * ⚠ 여기서는 긴 변만 맞추고 **원본보다 크게 안 만듭니다**(scale ≤ 1).
 * ⚠ 품질 0.82 — 0.85 와 눈으로 구별이 안 가는데 파일은 뚜렷이 작습니다.
 * ⚠ 다 그린 뒤에 `revokeObjectURL` 을 부릅니다. 그리기 전에 부르면
 *   사파리에서 빈 그림이 나옵니다. */
export function fitImage(file, maxEdge = 1280, quality = 0.82){
  return new Promise((ok, no) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width  * k));
      const h = Math.max(1, Math.round(img.height * k));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      cv.toBlob(b => {
        URL.revokeObjectURL(img.src);
        b ? ok(b) : no(new Error('사진을 바꾸지 못했어요.'));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(img.src);
                          no(new Error('사진을 읽지 못했어요.')); };
    img.src = URL.createObjectURL(file);
  });
}

const 탭이름 = { home:'기록', rate:'평가', anal:'분석', trips:'여행', set:'프로필' };
export function backLabel(tab){ return '← ' + (탭이름[tab] || '프로필'); }

/* ── 「맨 위로」는 **어느 스크롤러**의 맨 위인가(b471) ────────────────────
 * 전에는 세로 스크롤을 `body` 하나가 맡아서 어디서든 `window.scrollTo` 면
 * 됐습니다. 이제 탭 화면 다섯이 **각자 스크롤러**입니다(`.tabpane`).
 * 프로필 안에서 지도를 열고 `window.scrollTo` 를 부르면 아무 일도 안
 * 일어납니다 — 문서는 원래 안 굴러가 있고, 굴러가 있는 것은 프로필입니다.
 *
 * 그래서 **기준 요소를 받아** 그것이 속한 스크롤러를 찾습니다.
 * 탭 밖 화면(여행·도시·초안…)은 `.tabpane` 이 없으니 window 로 떨어집니다 —
 * 부르는 쪽이 안팎을 몰라도 됩니다.
 *
 * ⚠ `el` 을 안 주면 window 입니다. 옛 코드와 같은 뜻이라 헷갈릴 일이 없습니다. */
export function toTop(el){
  const 통 = el?.closest?.(".tabpane");
  /* ⚠ **`scrollTo({behavior:"smooth"})` 를 안 씁니다.** 스크롤 칸에서는 그것이
     아예 안 도는 환경이 있습니다 — 재보니 값이 그대로 남았습니다. 부드럽게
     구르는 것은 CSS 의 `scroll-behavior` 에 맡기고, 여기서는 값만 넣습니다.
     그러면 애니메이션이 돌든 안 돌든 **끝 값은 반드시 0** 입니다. */
  if (통) 통.scrollTop = 0;
  else window.scrollTo({ top:0 });
}

/* ── 덮는 화면이 열렸다 ─────────────────────────────────────────────────
 * 지도·성향·보관함·설정·대시보드는 **프로필 위에 얹히는 판**이었습니다.
 * b481 에서 덱 밖으로 꺼내면서, 판이 열려 있는 동안에는 **탭 덱을 숨깁니다.**
 *
 * ⚠ 안 숨기면 지도를 보다가 옆으로 밀렸을 때 탭이 넘어가 버립니다. 지도는
 *   손가락으로 끌어 옮기는 화면이라 그런 일이 자주 납니다.
 * ⚠ 여닫는 자리가 다섯 파일에 흩어져 있어 **한 함수로 모읍니다.** 각자
 *   `classList` 를 만지면 언젠가 한 곳을 빠뜨리고, 그러면 탭이 사라진 채로
 *   남습니다. */
export function coverDeck(on){
  document.getElementById('tabdeck')?.classList.toggle('hide', !!on);
}
