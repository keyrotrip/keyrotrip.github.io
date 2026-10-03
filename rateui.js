/* ── 평가 히어로 한 벌 ────────────────────────────────────────────────
 * 사진 위에 도시 이름과 별 다섯, 그 밑에 「안 가봤어요」·「♡」.
 * **세 화면이 같은 것을 씁니다** — 홈(home.js) · 로그인 전 맛보기(try.js) ·
 * 연속 평가(spree.js).
 *
 * ⚠ **여기 모은 이유.** b406~b407 을 지나며 같은 조각이 두 벌이 됐고,
 *   b408 에서 세 번째를 만들려다 멈췄습니다. 이미 한 번 겪었습니다 —
 *   별 크기를 통에만 주고 `.st` 를 빠뜨려 **주인공 별이 목록 별보다 작았던**
 *   일이 그것입니다(app.css 의 herostars 주석). 같은 것이 여러 벌이면
 *   고칠 때 한 벌만 고쳐집니다.
 *
 * ⚠ **누르기는 여기서 안 답니다.** 화면마다 매긴 뒤에 할 일이 다릅니다 —
 *   홈은 다음 도시로 갈아끼우고, 맛보기는 다섯 곳을 채우면 카드를 내고,
 *   연속 평가는 세면서 계속 넘깁니다. 그리는 것만 여기서 하고 처리는
 *   부르는 쪽이 합니다. 대신 **찾는 이름은 여기서 정합니다**:
 *     별 통  → `.stars[data-city]`
 *     단추   → `[data-rate="skip"|"want"]`, 감싼 줄에 `[data-city]`
 *   이 이름을 바꾸면 세 화면이 같이 멈춥니다.
 *
 * 층: dom.js · cities.js · stars.js 만 씁니다(전부 잎). */
import { esc } from './dom.js?v=b824';
import { countryName, cityCountry } from './cities.js?v=b824';
import { starHtml } from './stars.js?v=b824';
/**
 * @param city  도시 한 줄(image_url · name · country · id). **사진이 있어야 합니다** —
 *              히어로는 사진이 주인공이라 없으면 빈 색 덩어리만 남습니다.
 * @param ask   별 위에 붙는 한 줄. 화면마다 다릅니다("다녀오셨다면 별점을
 *              남겨주세요" / "3곳만 더 매기면…"). **빈 값이면 줄을 안 넣습니다.**
 * @param id    히어로 상자의 id. 화면마다 달라야 합니다 — 한 문서에 둘이
 *              동시에 뜰 수 있습니다(로그인 화면과 앱은 아니지만, 나중에).
 * @param bar   단추 줄을 달까. 안 다는 자리가 생기면 false 로.
 * @param 모양  'wide'(기본) 또는 'square'.
 *
 * ── 모양이 둘인 이유(b418) ──────────────────────────────────────────
 * **wide** — 홈·맛보기. 위아래로 다른 것들이 붙는 자리라 납작해야 합니다.
 *   글자를 사진 위에 얹고 아래를 어둡게 덮습니다.
 *
 * **square** — 넘기며 매기기. 그 화면은 **이것 하나뿐**이라 세로가 통째로
 *   남습니다. 실기기에서 재보니 위 542px · 아래 447px 이 비어 있는데
 *   사진은 480×260 으로 납작했습니다.
 *   ⚠ 더 큰 문제는 **덮개였습니다.** 글자를 얹으려면 사진 아래 절반을
 *     검게 덮어야 하는데, 이 화면에서 사진은 장식이 아니라 **판단
 *     근거**입니다 — "가보셨어요?" 는 사진을 보고 기억을 떠올리는
 *     물음입니다. 가려 놓고 물으면 안 됩니다.
 *   그래서 사진은 정방형으로 키우고 **글자와 별을 사진 밖으로** 뺍니다.
 *
 * ⚠ **찾는 이름은 두 모양이 똑같습니다**(`.stars[data-city]`,
 *   `[data-rate]`). 위 머리말의 약속이고, 다르게 두면 넘기며 매기기만
 *   조용히 멈춥니다.
 */
export function rateHero(city, { ask = '', id = 'ratehero', bar = true,
                                 모양 = 'wide' } = {}){
  const c = city;
  const 별 = `<div class="hrow">
      <span class="stars herostars" data-city="${esc(c.id)}">${starHtml(null)}</span>
    </div>`;
  /* ── 「다른 여행지」 문구가 정해지기까지(b418 → b421) ───────────────
     처음엔 「안 가봤어요」였습니다. 그런데 **넘어가는 단추라는 것이 전혀
     안 읽혔습니다** — 「♡ 가보고 싶어요」와 나란히 똑같이 생겨서 둘 중
     고르는 것처럼 보였습니다.
       b418  「안 가봤어요 ›」        화살표만으로는 **무엇으로** 넘어가는지
                                     안 보였습니다.
       b420  「안 가봤어요 (다음 여행지)」  길고, 「다음」이 내 여행 일정처럼
                                     들렸습니다.
       b421  「다른 여행지 ›」        ← 지금.

     ⚠ **「안 가봤어요」를 지운 이유.** 물음이 이미 「○○, 가보셨어요?」라
       답에 또 "안 가봤어요" 를 쓰면 동어반복입니다. 셋의 역할은 이렇게
       갈립니다 — 별점=가봤음 · 가보고 싶어요=안 가봤지만 관심 · 다른
       여행지=그 외.

     ⚠ **문구가 무를 뜻하는 것보다 하는 일이 셉니다.** 이 단추는 눌리면
       `stars:null` 줄을 남겨 **다시 안 묻습니다**(spree.js 의 누르기).
       「다른 여행지」는 "보류" 로 읽힐 수 있지만, 되돌릴 길이 기록 탭에
       있어서 그대로 둡니다. 문구를 또 바꿀 일이 있으면 **이 동작부터**
       보십시오. */
  const 단추 = bar ? `<div class="trybar" data-city="${esc(c.id)}">
    <button class="ghost" data-rate="skip">다른 여행지 <i>›</i></button>
    <button class="ghost" data-rate="want">♡ 가보고 싶어요</button>
  </div>` : '';

  /* 사진은 **큰 판(image_lg, 세로 1080)** 을 먼저 씁니다(2026-09-30 사진 개편, db/109). 예전 image_url 은
     세로 350 이라 폰 폭 가득한 이 칸에서 뭉개졌습니다. 큰 판을 못 받으면 작은 판(data-s)으로 한 번 갈아
     끼우고, 그것도 안 되면 예전처럼 비웁니다. 큰 판이 없는 도시는 처음부터 작은 판이라 한 번에 끝납니다. */
  if (모양 === 'square')
    return `<div class="rateq" id="${esc(id)}">
      <div class="rqimg"><img src="${esc(c.image_lg || c.image_url)}" data-s="${esc(c.image_url)}" alt=""
        onerror="if(this.dataset.s&amp;&amp;this.src!==this.dataset.s){this.src=this.dataset.s}else{this.closest('.rqimg').classList.add('ph')}"></div>
      <div class="ht">${esc(c.name)} <i>(${esc(cityCountry(c))})</i></div>
      ${ask ? `<div class="hask">${esc(ask)}</div>` : ''}
      ${별}
    </div>${단추}`;

  /* ── 히어로와 단추는 **한 카드**입니다(b419) ────────────────────────
     ⚠ 물음은 하나("나폴리, 가보셨어요?")인데 **답이 셋**입니다 —
       별점 · 안 가봤어요 · 가보고 싶어요. 그런데 별점만 사진 카드 안에
       있고 나머지 둘은 밖에 떠 있었습니다. 같은 물음의 답이 두 덩어리로
       갈라져 보였습니다.
     ⚠ 단추는 테두리를 벗기고 **카드 바닥에 붙인 두 칸**으로 둡니다.
       흰 바닥 위에 흰 테두리 단추를 얹으면 상자 안에 상자가 됩니다.
       가운데 선 하나면 둘이라는 것은 충분히 보입니다. */
  return `<div class="ratecard">
    <div class="hero rateh" id="${esc(id)}">
      <img src="${esc(c.image_lg || c.image_url)}" data-s="${esc(c.image_url)}" alt=""
        onerror="if(this.dataset.s&amp;&amp;this.src!==this.dataset.s){this.src=this.dataset.s}else{this.remove()}">
      <div class="ht">${esc(c.name)} <i>(${esc(cityCountry(c))})</i></div>
      ${ask ? `<div class="hask">${esc(ask)}</div>` : ''}
      ${별}
    </div>${단추}
  </div>`;
}

/* 눌린 자리에서 별점을 읽습니다. **반 칸(0.5점)은 왼쪽 절반.**
   ⚠ **몸통은 stars.js 로 내렸습니다(b491).** 여기 「한 곳에 둔다」고 적어
     놓고도 rating.js · review.js · shelf.js 가 같은 식을 손으로 베껴 쓰고
     있었습니다 — 그 셋은 rateui 를 import 하지 않기 때문입니다. 별을 쓰는
     여섯 화면이 다 닿는 아래층은 stars.js 입니다.
     이름은 여기서도 그대로 나갑니다(home·spree·try 가 여기서 가져갑니다). */
export { starValue } from './stars.js?v=b824';
