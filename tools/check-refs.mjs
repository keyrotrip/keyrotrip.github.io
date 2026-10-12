/* 떼어낸 모듈이 **어딘가에 있는 이름을 import 없이 쓰고 있는지** 봅니다.
 *
 * 왜 이것을 보나:
 *   app.js 를 쪼개면서 같은 사고가 계속 났습니다 —
 *   shelfKind · avgTail · cityOpen · localTime. 전부 모양이 같습니다.
 *   문법은 멀쩡하니 check-syntax 가 못 잡고, 그 줄은 로그인해서 그 화면을
 *   열어야 도니까 check-app 도 못 잡습니다. 실기기에서 눌러보고서야 알았습니다.
 *
 * ── b335 에서 두 군데를 고쳤습니다 ──────────────────────────────────
 *
 * ① **템플릿 문자열 안을 못 보고 있었습니다.** 이름을 셀 때 백틱 글자열을
 *    통째로 지웠는데, 그 안의 `${...}` 는 글자가 아니라 코드입니다.
 *    이 앱은 화면을 전부 템플릿으로 그리므로 **가장 많이 부르는 자리가
 *    통째로 사각지대**였습니다. 실제로 열한 개가 숨어 있었습니다 —
 *    city.js 의 avatarImg·hm·dateRange, report.js 의 md·PERSONA_ICON,
 *    cards.js 의 asDate·D1·suggested·setSuggested·setAiTripId·NOROW.
 *    전부 그 화면을 열면 ReferenceError 로 죽는 것들이었습니다.
 *    그래서 글자열을 **글자 부분만** 지우고 `${...}` 안은 남깁니다.
 *
 * ② **'app.js 것을 들고 나왔나' 만 보다가 범위를 넓혔습니다.** 원래 걱정은
 *    app.js 에서 이름을 들고 나오는 것이었는데, 실제로 난 사고의 절반은
 *    **calc.js·ai.js·net.js 에서 와야 하는데 import 를 안 쓴 것**이었습니다.
 *    떼어낸 코드가 app.js 안에서는 형제였던 이름들이라 그냥 불러도 됐던
 *    것이 원인이라, 사고의 성격은 똑같습니다.
 *
 * ⚠ **잡음을 늘리지 않는 것이 이 검사의 목숨입니다.** 처음 만들 때
 *   '못 찾는 이름 전부' 를 알려주게 했다가 물렸습니다 — 글자열 속 HTML 과
 *   표준 이름이 한 파일에 열 몇 개씩 나왔고 그중 진짜는 없었습니다.
 *   **안 보는 검사는 없는 검사입니다.** 그래서 범위를 넓히면서도 조건은
 *   하나로 좁혀뒀습니다: **이 저장소 어딘가가 그 이름을 내보내거나
 *   app.js 가 선언했을 때만** 말합니다. rgba·var·Image 처럼 저장소에
 *   없는 이름은 애초에 후보가 아닙니다. 지금 잡음은 0 개입니다.
 *
 * 여기서 못 잡는 것: 오타 난 이름, 아무 데도 없는 이름. 그건 브라우저가
 * 그 줄을 실제로 돌릴 때 납니다. */
import { readFileSync, readdirSync } from 'node:fs';

/* app.js 에서 떼어낸 것들. 새 조각을 만들면 여기 더하십시오 —
   안 더하면 그 파일은 아무도 안 봅니다.

   **app.js 자신도 넣습니다(b335).** 조각을 떼어내면 app.js 쪽에 부르는 줄만
   남는 일이 생깁니다 — 지출을 뗄 때 drawExpenses 를 부르는 자리가 남았으면
   그대로 죽었을 것입니다. app.js 는 자기가 선언한 것이 대부분이라
   여기 들어가도 조용합니다. 말할 때는 진짜입니다. */
const 모듈 = ['persona.js', 'map.js', 'shelf.js', 'city.js', 'aiui.js',
              'report.js', 'cards.js', 'expense.js', 'prep.js', 'member.js', 'planmap.js', 'citysearch.js', 'profile.js', 'review.js', 'rating.js', 'notify.js', 'newtrip.js', 'home.js', 'cands.js', 'selfcheck.js', 'bring.js', 'trash.js', 'plancheck.js', 'aiscreen.js', 'account.js', 'draft.js', 'triplist.js', 'tabs.js', 'planline.js', 'planview.js', 'geocode.js', 'legs.js', 'tripview.js', 'today.js', 'opentrip.js', 'flags.js', 'swreg.js', 'people.js', 'friends.js', 'pshift.js', 'setnav.js', 'myrecord.js', 'pmore.js', 'install.js', 'crop.js', 'app.js'];

/* 이름을 내보낼 수 있는 파일 전부. 여기 없는 파일이 내보내는 이름은
   후보에 안 들어가므로 검사가 그냥 조용합니다 — 틀린 말은 안 합니다. */
const 전부 = readdirSync('.').filter(f => f.endsWith('.js') && f !== 'sw.js' && f !== 'supabase.js');

/* ── 주석과 글자열을 지웁니다. 다만 템플릿의 ${...} 안은 코드라 남깁니다 ──
   글자를 세는 것이 아니라 이름을 세는 것이라 이 정도면 됩니다. */
function 벗기기(src){
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
      return '(,=:[!&|?{};+-*%~^<>'.includes(c);
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

const 소스 = {};
for (const f of 전부) 소스[f] = 벗기기(readFileSync(f, 'utf8'));

/* ── 이 저장소가 아는 이름 → 어느 파일에 있나 ───────────────────────── */
const 어디 = new Map();

/* ⚠ **쉼표로 그냥 자르면 괄호 안의 인자까지 선언 이름이 됩니다(b364).**

     const shelfEmpty = () =>
       emptyDo(`…`, null, null, SHELF_HINT[shelfKind]);

   세미콜론까지 읽고 `,` 로 자르면 조각이 ` null` 이 되어 **`null` 이 이름으로
   잡힙니다.** `있는이름`(이 파일이 가진 것) 쪽은 넉넉히 세어도 조용해질 뿐이라
   괜찮지만, **후보 표(`어디`)에서 넉넉히 세면 없는 이름을 지어냅니다** —
   실제로 스물세 개가 헛짚혔습니다. 후보 쪽은 **맨 바깥 쉼표에서만** 자릅니다. */
function 바깥쉼표(s){
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
const 이름아님 = new Set(['null','undefined','true','false','this','new','typeof',
                          'await','void','delete','in','of','instanceof']);
/* **떼어낸 모듈이 내보내는 것도 셉니다(b336).** 전에는 여기서 걸렀는데,
   그러면 `city.js` 의 `openCity` 를 `shelf.js` 가 import 없이 부르는 것을
   못 봅니다 — 조각끼리 서로 부르는 자리가 이미 여럿입니다. 자기가 내보낸
   이름은 자기 파일 안에서 선언으로도 잡히니 헛짚지 않습니다. */
for (const f of 전부){
  for (const m of 소스[f].matchAll(/\bexport\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g))
    if (!어디.has(m[1])) 어디.set(m[1], f);
}
/* app.js 가 스스로 선언한 것. 이것을 모듈이 맨몸으로 쓰고 있으면
   떼어낼 때 들고 나온 것입니다 — ctx 로 받거나 아래층으로 내려야 합니다. */
const app = 소스['app.js'] || '';
for (const m of app.matchAll(/^(?:async[ ]+)?function[ ]+([A-Za-z_$][\w$]*)/gm)) if (!어디.has(m[1])) 어디.set(m[1], 'app.js');
for (const m of app.matchAll(/^(?:const|let|var)[ ]+([A-Za-z_$][\w$]*)/gm))      if (!어디.has(m[1])) 어디.set(m[1], 'app.js');

/* ⚠ **줄 맨 앞의 `let` 만 보면 뒷줄이 통째로 빠집니다(b339).**
   app.js 의 앱 상태는 이렇게 한 뭉치로 적혀 있습니다:

       let me = null,
           picked = null, hitList = [], cursor = 0,     <- 이 줄은 `let` 으로 안 시작한다
           appTab = 'home',

   도시 검색을 떼면서 `hitList` 를 그대로 들고 나갔는데 **세는 데서도 검사에서도
   안 보였습니다.** 브라우저에서 그 화면을 눌러보고서야 알았습니다
   (`hitList is not defined`). 정확히 이 검사가 막으라고 있는 사고입니다.

   그래서 `let`/`const`/`var` 뭉치를 세미콜론까지 통째로 읽고 그 안의 이름을
   다 셉니다. 등호 오른쪽(값)은 이름이 아니므로 `=` 앞만 봅니다. */
for (const m of app.matchAll(/^(?:const|let|var)[ ]+([^;]*);/gm))
  for (const 조각 of 바깥쉼표(m[1])){
    const n = 조각.split('=')[0].trim();
    if (/^[A-Za-z_$][\w$]*$/.test(n) && !이름아님.has(n) && !어디.has(n))
      어디.set(n, 'app.js');
  }
/* ⚠ **아무도 내보내지 않는 이름은 통째로 안 보였습니다(b364).**
   `planSeedGeo` 가 `cards.js` 안에 `let` 으로 숨어 있었는데 `geocode.js` 와
   `app.js` 가 그냥 이름을 부르고 있었습니다. 모듈은 늘 strict 라
   `planSeedGeo is not defined` 로 터집니다 — **일정 탭의 `추가` 가 통째로
   안 열렸습니다.** 그런데 이 검사는 조용했습니다: 후보를 '누군가 내보내는
   이름' 으로만 잡고 있었으니 사문(private)은 애초에 후보가 아니었습니다.

   맨 바깥 선언은 **내보내든 안 내보내든** 셉니다. 헛짚을 걱정은 적습니다 —
   쓰는 파일이 자기도 그 이름을 선언했으면 `있는이름` 에 걸려 조용합니다.
   즉 **같은 이름을 두 파일이 각자 두는 것은 여전히 아무 말도 안 합니다.**
   말하는 것은 '한 곳에만 있는데 다른 곳이 부르는' 경우뿐입니다. */
for (const f of 전부){
  if (f === 'app.js') continue;               /* app.js 는 위에서 이미 셌습니다 */
  const s = 소스[f];
  for (const m of s.matchAll(/^(?:export[ ]+)?(?:async[ ]+)?function[ ]+([A-Za-z_$][\w$]*)/gm))
    if (!어디.has(m[1])) 어디.set(m[1], f);
  /* 여러 줄짜리 뭉치도 세미콜론까지 읽습니다(b339 에서 app.js 에 한 것과 같습니다). */
  for (const m of s.matchAll(/^(?:export[ ]+)?(?:const|let|var)[ ]+([^;]*);/gm))
    for (const 조각 of 바깥쉼표(m[1])){
      const n = 조각.split('=')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n) && !이름아님.has(n) && !어디.has(n))
        어디.set(n, f);
    }
}

/* app.js 가 남에게서 가져온 것은 app.js 것이 아닙니다. */
for (const m of app.matchAll(/\bimport\s*\{([^}]*)\}/g))
  for (const p of m[1].split(',')){
    const n = p.trim().split(/\s+as\s+/).pop().trim();
    if (어디.get(n) === 'app.js') 어디.delete(n);
  }

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
function 있는이름(코드){
  const s = new Set();
  for (const m of 코드.matchAll(/\b(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) s.add(m[1]);
  /* 한 뭉치로 적은 선언의 **둘째 이름부터**도 셉니다(b339). 위 줄은 첫 이름만
     잡습니다 — `let a = 1, b = 2;` 의 `b` 가 빠져서 자기 파일 안에서 선언한
     것을 '없다'고 말합니다. app.js 에서 열아홉 개가 그렇게 나왔습니다.
     세미콜론까지 훑으므로 가끔 넉넉히 셉니다. 그 방향이 안전합니다 —
     넉넉히 세면 조용해질 뿐이고, 모자라게 세면 없는 사고를 지어냅니다. */
  for (const m of 코드.matchAll(/\b(?:const|let|var)\s+([^;]*);/g)) 담기(m[1], s);
  for (const m of 코드.matchAll(/\bimport\s*\{([^}]*)\}/g))
    for (const p of m[1].split(',')) s.add(p.trim().split(/\s+as\s+/).pop().trim());
  for (const m of 코드.matchAll(/(?:function\s*[A-Za-z_$][\w$]*\s*|function\s*|catch\s*)\(([^()]*)\)/g)) 담기(m[1], s);
  for (const m of 코드.matchAll(/\(([^()]*)\)\s*=>/g)) 담기(m[1], s);
  for (const m of 코드.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) s.add(m[1]);
  for (const m of 코드.matchAll(/\b(?:const|let|var)\s*[{[]([^}\]]*)[}\]]/g)) 담기(m[1], s);
  return s;
}

let 틀림 = 0;
for (const f of 모듈){
  const 코드 = 소스[f];
  const 있음 = 있는이름(코드);
  /* 점 뒤(속성)와 `이름:`(객체 열쇠)은 변수가 아닙니다. */
  const 평평 = 코드.replace(/\.\s*[A-Za-z_$][\w$]*/g, ' ')
                   .replace(/([A-Za-z_$][\w$]*)\s*:/g, ' ');
  const 빠짐 = new Map();
  /* ⚠ 여기에 `\b` 를 쓰면 **`$` 로 시작하는 이름이 통째로 안 보입니다**(b362).
     `\b` 는 단어글자와 아닌 것의 경계인데 `$` 는 `\w` 가 아닙니다 — 그래서
     `$('noticebar')` 는 앞이 `(` 뒤도 `(` 라 양쪽 다 경계가 안 섭니다.
     `$` 는 dom.js 가 내보내는 이름이고 거의 모든 파일이 씁니다. 그런데도
     b325~b361 서른일곱 조각 내내 한 번도 안 세어졌고, `flags.js` 가 import
     없이 일곱 곳에서 쓰는 것이 그대로 배포됐습니다. 실기기에서 잡혔습니다.
     경계 대신 **앞뒤에 이름글자가 없음**을 봅니다. `$` 도 이름글자로 셉니다. */
  for (const m of 평평.matchAll(/(?<![\w$])([A-Za-z_$][\w$]*)(?![\w$])/g))
    if (어디.has(m[1]) && !있음.has(m[1])) 빠짐.set(m[1], 어디.get(m[1]));

  if (빠짐.size){
    틀림 += 빠짐.size;
    const 목록 = [...빠짐].map(([n, w]) => n + '(' + w + ')').join(' ');
    console.error('  X   ' + f + ' — import 없이 씁니다: ' + 목록);
    console.log('::error file=' + f + '::import 없이 씁니다: ' + 목록 +
                ' — app.js 것이면 ctx 로 받거나 아래층으로 내리고,' +
                ' 다른 파일 것이면 맨 위에 import 를 더하십시오');
  } else console.log('  ok  ' + f);
}

/* ── HTML 주석 안의 백틱 ──────────────────────────────────────────────
 * **같은 실수를 두 번 했습니다(b394 · b410).** 화면을 만드는 템플릿 문자열
 * 안에 `<!-- 주석 -->` 을 쓰면서 그 안에 백틱을 넣으면, 거기서 **문자열이
 * 끊깁니다.** 뒤에 오는 글이 코드로 읽혀 실행할 때 터집니다.
 *
 * ⚠ **문법은 멀쩡합니다.** `import()` 도 성공하고 `check-refs` 의 위 검사도
 *   통과합니다 — b410 에서 성향 화면이 통째로 안 뜬 채로 배포됐고,
 *   `"…".ghost is not a function` 이 나서야 알았습니다.
 *   "모듈이 읽힌다"는 "동작한다"가 아닙니다.
 *
 * ⚠ 클래스나 함수 이름을 적고 싶으면 **백틱 없이 그냥** 쓰십시오.
 *   주석의 멋보다 화면이 뜨는 것이 먼저입니다. */
let 백틱 = 0;
for (const f of 모듈){
  /* ⚠ **`소스[f]` 를 쓰면 안 됩니다.** 그건 `벗기기()` 를 거친 것이라
     템플릿 문자열 **내용이 통째로 버려져** 있습니다 — 주석이 거기 있으니
     아무것도 안 잡힙니다. 원본을 다시 읽습니다.
     (그리고 이것이 기존 검사가 b410 을 못 잡은 이유이기도 합니다: 끊긴
      뒤의 글이 한글이라 `[A-Za-z_$]` 이름 패턴에 안 걸렸습니다.) */
  const 원본 = readFileSync(f, 'utf8');
  for (const m of 원본.matchAll(/<!--[\s\S]*?-->/g)){
    if (!m[0].includes('`')) continue;
    백틱++;
    const 줄 = (원본.slice(0, m.index).match(/\n/g) || []).length + 1;
    console.error('  X   ' + f + ':' + 줄 + ' — HTML 주석 안에 백틱이 있습니다');
    console.log('::error file=' + f + ',line=' + 줄 +
                '::HTML 주석 안의 백틱은 템플릿 문자열을 끊습니다 — 백틱 없이 쓰십시오');
  }
}
틀림 += 백틱;

console.log('\n' + 모듈.length + '개 모듈, 빠진 이름 ' + (틀림 - 백틱) + '개' +
            ', 주석 속 백틱 ' + 백틱 + '개');
process.exit(틀림 ? 1 : 0);
