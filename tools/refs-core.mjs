/* check-refs 의 «분석» 부분 — 파일을 읽지 않는 순수 함수만 여기 둡니다.
 *
 * 왜 따로 뺐나(2026-10-16): 검사 자체에 회귀 검사를 붙이려면, 파일 시스템 없이
 * 글자 몇 줄을 넣어 돌려볼 수 있어야 합니다. check-refs.mjs 는 읽고·모으고·
 * 알리는 일만 하고, 판단은 여기서 합니다. 함수 몸통은 check-refs.mjs 에 있던
 * 것을 **그대로** 옮겼습니다 — 바뀐 것은 `import지우기` 를 더한 것 하나뿐입니다
 * (아래 그 함수 머리말).
 *
 * ⚠ 여기에 `node:` 모듈을 들이지 마십시오. 회귀 검사(check-refs.test.mjs)가
 *   의존성 없이 돌아야 합니다. */

/* ── 주석과 글자열을 지웁니다. 다만 템플릿의 ${...} 안은 코드라 남깁니다 ──
   글자를 세는 것이 아니라 이름을 세는 것이라 이 정도면 됩니다. */
export function 벗기기(src){
  let i = 0;
  const n = src.length, out = [];

  const 따옴표 = q => {
    i++;
    while (i < n && src[i] !== q){ if (src[i] === '\\') i++; i++; }
    i++; out.push(' ');
  };
  /* `/` 가 나눗셈인지 정규식인지 앞글자로 가릅니다. 정규식 안의 따옴표를
     글자열 시작으로 잘못 읽으면 그 뒤 코드가 통째로 사라집니다 —
     esc 의 /[&<>"]/ 가 딱 그 모양입니다. */
  const 정규식자리 = () => {
    for (let k = out.length - 1; k >= 0; k--){
      const c = out[k];
      if (c === ' ' || c === '\n' || c === '\t') continue;
      if ('(,=:[!&|?{};+-*%~^<>'.includes(c)) return true;
      /* ⚠ `return /^(…)$/i.test(t)` — 앞이 낱말이어도 **이런 낱말 뒤면 정규식**입니다(2026-10-16).
         전엔 마지막 글자 'n' 만 보고 나눗셈으로 읽어, 정규식 안의 `$` 를 이름으로 셌습니다(sheetimp.js). */
      let j = k; while (j > 0 && /[\w$]/.test(out[j - 1])) j--;
      return /^(?:return|typeof|case|do|else|in|of|instanceof|new|delete|void|throw|yield|await)$/
        .test(out.slice(j, k + 1).join(''));
    }
    return true;
  };
  const 정규식 = () => {
    i++;
    let 대괄호 = false;
    while (i < n){
      const c = src[i];
      if (c === '\\'){ i += 2; continue; }
      if (c === '[') 대괄호 = true;
      else if (c === ']') 대괄호 = false;
      else if (c === '/' && !대괄호){ i++; break; }
      else if (c === '\n') break;
      i++;
    }
    while (i < n && 'gimsuyd'.includes(src[i])) i++;
    out.push(' ');
  };
  const 템플릿 = () => {
    while (i < n){
      const c = src[i];
      if (c === '\\'){ i += 2; continue; }
      if (c === '`'){ i++; return; }
      if (c === '$' && src[i + 1] === '{'){ i += 2; out.push(' '); 코드(true); out.push(' '); continue; }
      i++;
    }
  };
  function 코드(안쪽){
    let 깊이 = 0;
    while (i < n){
      const c = src[i], d = src[i + 1];
      if (c === '/' && d === '*'){ const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; out.push(' '); continue; }
      if (c === '/' && d === '/'){ const e = src.indexOf('\n', i);   i = e < 0 ? n : e;     out.push(' '); continue; }
      if (c === '"' || c === "'"){ 따옴표(c); continue; }
      if (c === '`'){ i++; 템플릿(); continue; }
      if (c === '/' && 정규식자리()){ 정규식(); continue; }
      if (안쪽 && c === '{') 깊이++;
      if (안쪽 && c === '}'){ if (깊이 === 0){ i++; return; } 깊이--; }
      out.push(c); i++;
    }
  }
  코드(false);
  return out.join('');
}

/* ⚠ **쉼표로 그냥 자르면 괄호 안의 인자까지 선언 이름이 됩니다(b364).**
   후보 표(`어디`)에서 넉넉히 세면 없는 이름을 지어냅니다 — 실제로 스물세 개가
   헛짚혔습니다. 후보 쪽은 **맨 바깥 쉼표에서만** 자릅니다. */
export function 바깥쉼표(s){
  const out = []; let 깊이 = 0, buf = '';
  for (const c of s){
    if ('([{'.includes(c)) 깊이++;
    else if (')]}'.includes(c)) 깊이--;
    if (c === ',' && 깊이 === 0){ out.push(buf); buf = ''; continue; }
    buf += c;
  }
  return out.concat(buf);
}

/* 값으로만 쓰이는 낱말은 이름이 아닙니다. */
export const 이름아님 = new Set(['null','undefined','true','false','this','new','typeof',
                          'await','void','delete','in','of','instanceof']);

/* ── 한 파일 안에서 이름이 생기는 자리 ────────────────────────────────
   선언·import 만 세면 매개변수와 분해가 빠져서 헛짚습니다
   (trip·plans 처럼 흔한 이름이 남의 파일에서도 내보내집니다).
   넉넉히 세는 쪽으로 기울입니다 — 놓치는 것보다 헛짚는 것이 더 나쁩니다. */
const 담기 = (덩어리, 집합) => {
  for (const p of String(덩어리).split(',')){
    const n = p.trim().split(':').pop().trim().replace(/^\.\.\./, '').split('=')[0].trim();
    if (/^[A-Za-z_$][\w$]*$/.test(n)) 집합.add(n);
  }
};
export function 있는이름(코드){
  const s = new Set();
  for (const m of 코드.matchAll(/\b(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) s.add(m[1]);
  /* 한 뭉치로 적은 선언의 **둘째 이름부터**도 셉니다(b339). */
  for (const m of 코드.matchAll(/\b(?:const|let|var)\s+([^;]*);/g)) 담기(m[1], s);
  for (const m of 코드.matchAll(/\bimport\s*\{([^}]*)\}/g))
    for (const p of m[1].split(',')) s.add(p.trim().split(/\s+as\s+/).pop().trim());
  /* 기본 import(`import d from`)·이름공간 import(`import * as ns from`)도 선언입니다
     (2026-10-16 — 지금 저장소에는 없지만, 쓰는 순간 헛짚지 않게). */
  for (const m of 코드.matchAll(/(?<![\w$.])import\s+([A-Za-z_$][\w$]*)\s*(?:,|\bfrom\b)/g)) s.add(m[1]);
  for (const m of 코드.matchAll(/(?<![\w$.])import\s*\*\s*as\s+([A-Za-z_$][\w$]*)/g)) s.add(m[1]);
  /* ⚠ 함수 이름이 한글이어도 매개변수를 셉니다(2026-10-16) — `function 일정넣기(items, guessCat)` 의
     guessCat, `function 검산(CONT)` 의 CONT 를 «import 없이 쓴 남의 이름»으로 헛짚었습니다. */
  for (const m of 코드.matchAll(/(?:function\s*\*?\s*[\p{L}\p{Nl}_$][\p{L}\p{N}_$]*\s*|function\s*\*?\s*|catch\s*)\(([^()]*)\)/gu)) 담기(m[1], s);
  for (const m of 코드.matchAll(/\(([^()]*)\)\s*=>/g)) 담기(m[1], s);
  for (const m of 코드.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) s.add(m[1]);
  for (const m of 코드.matchAll(/\b(?:const|let|var)\s*[{[]([^}\]]*)[}\]]/g)) 담기(m[1], s);
  return s;
}

/* ── import·re-export 선언문을 «사용»에서 뺍니다(2026-10-16) ─────────────
 * ⚠⚠ **별칭 import 의 원래 이름을 «쓴 것»으로 셌습니다.** ⚠⚠
 *   app.js: `import { …, draw as rateCcDraw } from './ratecc.js'`
 *   여기서 `draw` 는 ratecc.js 가 내보내는 이름이라 후보 표에 있고, app.js 가
 *   선언한 이름(`있는이름`)에는 별칭 `rateCcDraw` 만 들어갑니다. 그래서 import
 *   줄 안의 `draw` 글자를 «import 없이 쓴 draw» 로 읽어 빨간불을 냈습니다
 *   (b874 부터 — CI 의 「못 찾는 이름」 단계가 이 오탐으로 계속 빨갰습니다).
 * → import 문 안의 이름은 «쓰임»이 아니라 «선언»입니다. 쓰임을 셀 때는 그
 *   문장을 통째로 빼고 셉니다. 선언 쪽(`있는이름`)은 원래대로 별칭을 셉니다.
 *
 * ⚠ 이미 `벗기기` 를 거친 코드에 씁니다 — 글자열이 빠져 있어 `from` 뒤가 빈칸입니다.
 * ⚠ 건드리지 않는 것: `import(...)` (동적 불러오기 — 함수 호출입니다),
 *   `import.meta` (값입니다). 둘 다 `import` 바로 뒤가 `(` 나 `.` 입니다. */
export function import지우기(코드){
  return 코드
    /* import { a, b as c } from · import d from · import * as e from · import f, { g } from
       ⚠ 절 안에 올 수 있는 글자(이름·{ } , * 공백)만 허용합니다. `[^;]*` 로 넓게 잡으면
         세미콜론 없는 줄에서 뒤의 `x.from(…)` 까지 먹어 들어가 진짜 쓰임을 지웁니다.
       ⚠ `(?!\s*[(.])` 는 «공백 뒤 ( 나 .» 를 통째로 봅니다 — `\s*(?![(.])` 로 쓰면
         공백을 0개로 되감아 `import (x)` 를 통과시킵니다. */
    .replace(/(?<![\w$.])import(?![\w$])(?!\s*[(.])[\w$\s{},*]*?\bfrom\b/g, ' ')
    /* export { a as b } from · export * from · export * as ns from — 남의 이름을 다시 내보낼 뿐 */
    .replace(/(?<![\w$.])export\s*(?:\*(?:\s*as\s+[A-Za-z_$][\w$]*)?|\{[^}]*\})\s*from\b/g, ' ');
}

/* ── 한 파일이 «선언도 import 도 없이» 쓰는 이름 ────────────────────────
 * `코드` 는 `벗기기` 를 거친 것, `어디` 는 이름 → 그 이름이 있는 파일.
 * 돌려주는 것: Map(이름 → 있는 파일). 비었으면 그 파일은 깨끗합니다. */
export function 빠진이름(코드, 어디){
  const 있음 = 있는이름(코드);
  /* 점 뒤(속성)와 `이름:`(객체 열쇠)은 변수가 아닙니다. */
  const 평평 = import지우기(코드)
                 .replace(/\.\s*[A-Za-z_$][\w$]*/g, ' ')
                 .replace(/([A-Za-z_$][\w$]*)\s*:/g, ' ');
  const 빠짐 = new Map();
  /* ⚠ 여기에 `\b` 를 쓰면 **`$` 로 시작하는 이름이 통째로 안 보입니다**(b362).
     경계 대신 **앞뒤에 이름글자가 없음**을 봅니다. `$` 도 이름글자로 셉니다. */
  /* ⚠ 앞뒤 «이름글자»에 한글·그리스 글자 등도 넣습니다(2026-10-16). 전엔 `φt0` 의 t0, `osm한글` 의 osm 처럼
     영문 조각만 떼어 남의 이름으로 헛짚었습니다(globe.js · 메모 missing-import-trap 의 «영어+한글 섞인 이름»). */
  for (const m of 평평.matchAll(/(?<![\p{L}\p{N}_$])([A-Za-z_$][\w$]*)(?![\p{L}\p{N}_$])/gu))
    if (어디.has(m[1]) && !있음.has(m[1])) 빠짐.set(m[1], 어디.get(m[1]));
  return 빠짐;
}
