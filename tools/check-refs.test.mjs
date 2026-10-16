/* check-refs 의 회귀 검사 — `node tools/check-refs.test.mjs`
 *
 * 왜 있나(2026-10-16): app.js 의 `import { draw as rateCcDraw }` 를 «import 없이
 * 쓴 draw» 로 잘못 잡아 CI 의 「못 찾는 이름」이 b874 부터 빨갰습니다. 고치면서
 * **정상 별칭은 조용하고, 진짜 빠진 이름은 여전히 잡는지**를 글자 몇 줄로 못 박습니다.
 * 이 검사가 둔해지면(아무것도 안 잡으면) 첫 두 줄이 같이 빨개집니다.
 *
 * ⚠ 의존성 없이 돕니다 — refs-core.mjs 의 순수 함수만 부릅니다. */
import { 벗기기, 빠진이름 } from './refs-core.mjs';

/* 후보 표: 이 이름들은 «어딘가에 있는» 이름입니다(check-refs 의 `어디`). */
const 어디 = new Map([
  ['draw', 'ratecc.js'], ['openCity', 'city.js'], ['avgTail', 'rate.js'],
  ['$', 'dom.js'], ['esc', 'dom.js'],
]);
const 빠짐 = 원본 => [...빠진이름(벗기기(원본), 어디).keys()].sort();

const 경우 = [
  ['별칭으로 들여와서 별칭으로 씀 — 조용해야 함 (app.js rateCcDraw 오탐)',
   `import { setX, draw as rateCcDraw } from './ratecc.js?v=b880';\nrateCcDraw(true);`, []],
  ['별칭으로 들여왔는데 원래 이름을 맨몸으로 씀 — 잡아야 함',
   `import { draw as rateCcDraw } from './ratecc.js';\ndraw(true);`, ['draw']],
  ['아예 안 들여오고 씀 — 잡아야 함',
   `openCity('tokyo');`, ['openCity']],
  ['여러 줄 import 속 별칭 — 조용해야 함',
   `import { a,\n         draw as rd,\n         b } from './x.js';\nrd();`, []],
  ['동적 import() 는 선언이 아님 — 그 뒤 맨몸 draw 는 잡아야 함',
   `const m = await import('./ratecc.js');\ndraw();`, ['draw']],
  ['import.meta 는 건드리지 않음 — 맨몸 draw 는 잡아야 함',
   `const u = import.meta.url; draw();`, ['draw']],
  ['템플릿 ${...} 안의 쓰임도 잡아야 함 (b335)',
   'const h = `<b>${avgTail(x)}</b>`;', ['avgTail']],
  ['남의 이름을 다시 내보내는 줄은 쓰임이 아님 — 조용해야 함',
   `export { draw as rateDraw } from './ratecc.js';`, []],
  ['세미콜론 없는 부수효과 import 뒤의 진짜 쓰임을 먹지 않음',
   `import './a.js'\nconst x = Array.from(draw)`, ['draw']],
  ['$ 로 시작하는 이름도 잡음 (b362)',
   `$('offbar').textContent = esc(t);`, ['$', 'esc']],
  ['$ 를 들여왔으면 조용함',
   `import { $, esc } from './dom.js';\n$('offbar').textContent = esc(t);`, []],
  ['기본 import 도 선언 — 조용해야 함',
   `import draw from './ratecc.js';\ndraw();`, []],
  ['이름공간 import 의 속성 쓰임 — 조용해야 함',
   `import * as rc from './ratecc.js';\nrc.draw();`, []],
  ['속성 이름(점 뒤)은 변수가 아님 — 조용해야 함',
   `const o = {}; o.draw(); o.openCity;`, []],
  ['매개변수로 받은 같은 이름은 조용함',
   `function f(draw){ return draw(); }`, []],
];

let 틀림 = 0;
for (const [이름, 원본, 기대] of 경우){
  const 실제 = 빠짐(원본);
  const 맞음 = JSON.stringify(실제) === JSON.stringify([...기대].sort());
  if (!맞음) 틀림++;
  console.log((맞음 ? '  ok  ' : '  X   ') + 이름 +
              (맞음 ? '' : `\n        기대 ${JSON.stringify(기대)} · 실제 ${JSON.stringify(실제)}`));
  if (!맞음) console.log('::error file=tools/check-refs.test.mjs::' + 이름);
}
console.log(`\n${경우.length}개 중 ${틀림}개 틀림`);
if (typeof process !== 'undefined') process.exit(틀림 ? 1 : 0);
