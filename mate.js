/* ── 친구와 궁합 ──────────────────────────────────────────────────────
 * **유입이 유입을 만드는 유일한 고리입니다(b408).**
 *
 * 성향 카드 한 장은 한 번 퍼지고 끝입니다 — 올리고 나면 더 할 것이 없습니다.
 * 궁합은 다릅니다: 링크를 받은 사람이 **자기 카드를 만들어야** 결과가
 * 나오고, 그 결과가 다시 그 사람의 공유거리가 됩니다.
 *
 * ⚠ **궁합은 이미 계산돼 있었습니다.** 카드에 「환상의 메이트 FLDG」 가
 *   찍혀 있는데 **정작 그 상대를 데려올 길이 없었습니다.** 없던 것은
 *   계산이 아니라 링크 하나였습니다.
 *
 * ⚠ **서버가 필요 없습니다.** 링크에 담는 것은 코드 네 글자뿐이고
 *   (`?mate=FMDP`), 궁합은 card.js 가 코드만으로 계산합니다.
 *   그래서 오프라인에서도, 로그인 전에도 됩니다.
 *
 * ⚠ **이름은 안 담습니다.** 「OO님과의 궁합」이 더 좋아 보이지만 그건
 *   링크에 남의 이름을 실어 보내는 것입니다. 누가 보냈는지는 받는 사람이
 *   이미 압니다 — 카톡으로 받았으니까요.
 *
 * 층: dom.js · card.js 만 씁니다(계산도 화면도 순수). */
import { esc, copyText } from './dom.js?v=b824';
import { personaMatch, personaMateLine, PERSONA16 } from './card.js?v=b824';

const KEY = 't2:mate';
const 코드꼴 = /^[FH][ML][ND][GP]$/;

/* 주소에서 받아 담아둡니다. **로그인하러 구글에 다녀오는 동안 주소가
   사라지므로** 담아둬야 합니다(초대 링크 `?join=` 과 같은 수법).
   `sessionStorage` 인 이유: 이 탭에서만 뜻이 있습니다. 내일 다시 열었을 때
   "친구와의 궁합" 이 남아 있으면 그게 더 이상합니다. */
export function catchMate(){
  const v = new URLSearchParams(location.search).get('mate');
  if (!v) return;
  const code = v.trim().toUpperCase();
  if (코드꼴.test(code)) sessionStorage.setItem(KEY, code);
  history.replaceState(null, '', location.pathname);
}

export const mateCode = () => {
  const c = sessionStorage.getItem(KEY);
  return c && 코드꼴.test(c) ? c : null;
};
export const clearMate = () => sessionStorage.removeItem(KEY);

/* 보낼 링크. **앱 주소 그대로**입니다 — 초대 링크(deno)와 달리 미리보기에
   넣을 것이 없습니다. 코드 네 글자는 남에게 보여줘도 되는 값입니다. */
export const mateLink = code =>
  `${location.origin}${location.pathname}?mate=${encodeURIComponent(code)}`;

/* ── 궁합 칸 ─────────────────────────────────────────────────────────
 * 로그인 전(try.js)과 로그인 뒤(persona.js)가 **같은 것을 봅니다.**
 * 두 벌로 만들면 한쪽만 고쳐집니다.
 *
 * ⚠ **점수만 내놓지 않습니다.** 「72%」 만 있으면 아무 말도 안 한 것과
 *   같습니다. 어느 축이 맞고 어긋나는지를 한 줄로 답니다(personaMateLine).
 * ⚠ 색은 점수로 가릅니다 — 좋은 궁합과 나쁜 궁합이 같은 색이면 굳이
 *   점수를 읽어야 압니다. */
export function mateHtml(mine, theirs){
  if (!코드꼴.test(mine || '') || !코드꼴.test(theirs || '')) return '';
  const 점 = personaMatch(mine, theirs);
  const 나 = PERSONA16[mine], 너 = PERSONA16[theirs];
  if (!나 || !너) return '';
  const 좋음 = 점 >= 60;
  return `<div class="card matecard${좋음 ? ' good' : ' bad'}">
    <div class="matetop">
      <span class="mateside"><b>${esc(theirs)}</b><span>${esc(너.n)}</span></span>
      <span class="matescore">${점}<i>%</i></span>
      <span class="mateside r"><b>${esc(mine)}</b><span>${esc(나.n)}</span></span>
    </div>
    <div class="mateline">${esc(personaMateLine(mine, theirs))}</div>
  </div>`;
}

/* ── 궁합 링크 보내기 ─────────────────────────────────────────────────
 * **성향 화면과 분석 탭이 같이 씁니다(b461).** persona.js 안에 인라인으로
 * 있던 것을 여기로 옮겼습니다 — 분석 탭에도 같은 단추가 생기면서 두 벌이
 * 될 판이었습니다. 문구가 갈리면 같은 앱이 두 가지로 소개됩니다.
 *
 * ⚠ **그림이 아니라 글입니다.** 받는 사람이 눌러서 자기 것을 만들어야
 *   결과가 나오므로 주소가 주인공입니다. 카드 그림을 보내면 거기서 끝납니다.
 * ⚠ 공유창을 닫은 것은 실패가 아닙니다(AbortError) — 그때는 아무것도 안
 *   합니다. 진짜 실패일 때만 주소를 복사해 둡니다. */
export function shareMate(code, 이름){
  const url  = mateLink(code);
  const text = `내 여행 성향은 ${code} ${이름}.\n너랑 잘 맞나 볼래?`;
  if (navigator.share)
    navigator.share({ title:'기로 · 여행 성향 궁합', text, url })
      .catch(e => { if (e?.name !== 'AbortError') copyText(`${text}\n${url}`); });
  else copyText(`${text}\n${url}`);
}
