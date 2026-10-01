/* ── 분석 탭 ─────────────────────────────────────────────────────────
 * **이 앱의 가장 큰 무기가 사는 곳입니다(b439 신설 · b447 채움).**
 * 전에는 성향 카드가 프로필 → 「여행 성향」 → 「보기」로 **두 번 들어가야**
 * 나왔습니다. 앱 얼굴이 「나는 어떤 여행자일까」인데 그 답이 제일 깊은
 * 곳에 있었습니다.
 *
 * ⚠ **화면을 새로 만들지 않습니다.** 성향 카드(persona.js)와 세계지도
 *   (map.js)는 이미 있고 잘 돕니다. 여기는 **들어가기 전에 보는 요약**이고,
 *   누르면 그 화면으로 보냅니다. 카드를 여기서 또 그리면 두 벌이 되어
 *   언젠가 갈라집니다(card.js 머리말과 같은 이유).
 *
 * ⚠ **이 파일은 성향을 «안 셉니다»(b547).** 리포트를 통째로 persona.js
 *   에게 맡기고 자리만 내줍니다 — 문턱도 축도 거기 하나입니다.
 *
 * 층: dom.js · db.js · cities.js · card.js · map.js 만 씁니다.
 *     app.js 는 import 하지 않습니다 — ctx 로 받습니다(persona.js 머리말). */
import { $, esc, emptyDo } from './dom.js?v=b821';
import { sb } from './db.js?v=b821';
import { cities, cityCountry } from './cities.js?v=b821';
/* 별 갈래와 그 이름. ⚠ **보관함 시트와 같은 것을 씁니다**(b727) — 따로 세면
   「★4점대 32곳」이 두 화면에서 달라집니다. 규칙은 stars.js 한 곳입니다. */
import { 별갈래, BAND_NAME } from './stars.js?v=b821';
/* 도시 평균과 인원(`{avg_stars, n_rated}`). ⚠ **`n_rated` 에는 내가
   들어 있습니다**(rate.js 의 avgTail 주석) — 남들과 견줄 때는 나를 빼야 합니다. */
import { cityStat } from './rate.js?v=b821';
/* `cityStat` 이 비어 있을 때 한 번 싣습니다. ⚠ rate.js·rating.js 는
   anal.js 를 모르므로 고리가 안 생깁니다(확인함). */
import { loadRateData } from './rating.js?v=b821';
/* 리포트는 persona.js 가 그립니다 — 여기는 자리만 내줍니다(b547).
   ⚠ `personaAxes`·`PERSONA16`·`AXIS_NAME`·`AXIS_WORD` 를 여기서 뗐습니다.
     요약 카드가 없어져서 이 파일은 성향을 **한 번도 안 셉니다** — 세는
     것은 persona.js 한 곳입니다. */
import { renderPersona } from './persona.js?v=b821';
/* ⚠ `funRows` 는 **계산만** 합니다 — 그리는 것은 여기 몫입니다. 지도
   화면과 같은 함수를 써야 같은 물음에 같은 답이 나옵니다(map.js 머리말). */
/* 추천과 궁합은 성향 리포트에서 꺼내온 것입니다(b461) — 계산은 원래
   있던 곳(rec.js · mate.js) 그대로 씁니다. 여기서 다시 세면 두 화면이
   다른 답을 내놓습니다. */
import { similarPicks } from './rec.js?v=b821';
/* 여행 만들기로 바로 잇습니다(b463) — newtrip.js 는 anal.js 를 모르므로
   고리가 안 생깁니다(확인함). */
import { openNew } from './newtrip.js?v=b821';
import { pickCity } from './citysearch.js?v=b821';
/* 카드 셋(b810) — 도시 어워즈 · 거리별 별점 · 여행지 월드컵(옛 「진짜 최애」). mycity.js 는 anal.js 를 모르므로 고리가 없습니다. */
import { drawMyCities } from './mycity.js?v=b821';

let ctx = { me: () => null, showApp: () => {} };
export function setAnalCtx(o){ ctx = { ...ctx, ...o }; }

/* ⚠ **문턱(5곳)은 persona.js 가 압니다.** 여기 두 벌로 두었다가 값이
   갈리면 「성향 보기」를 눌렀는데 「아직」이 나옵니다 — 이 파일은 이제
   성향을 안 세므로 아예 지웁니다. */


/* ⚠ **`성향열기` 를 걷었습니다(b547).** 성향 화면이 이 탭 «안»에 있으므로
   열러 갈 데가 없습니다. 지도를 여는 길(`지도열기`)은 b542 에 기록 탭으로
   갔습니다 — 이 파일에는 이제 다른 화면을 여는 길이 하나도 없습니다. */
/* ⚠ **`지도열기` 를 걷었습니다(b542).** 발자국 카드가 기록 탭으로 가면서
   이 탭에서 지도를 여는 자리가 없어졌습니다. 다시 필요하면 home.js 에
   같은 것이 있습니다 — 두 벌로 만들지 마십시오. */

/* ── 추천 도시로 바로 여행 만들기(b463) ──────────────────────────────
 * ⚠ **`#newcard` 는 탭 안에 있지 않습니다.** 화면 위에 얹히는 한 장이라
 *   분석 탭에서 열어도 그대로 뜹니다(app.js 의 showApp 이 탭을 옮길 때
 *   닫아 줍니다). 그래서 탭을 옮기지 않습니다 — 옮기면 하단바가 튀고
 *   뒤로 갈 자리도 애매해집니다.
 * ⚠ `openNew()` 가 도시 목록을 받아온 뒤라야 고를 수 있습니다. 그래서
 *   **await 합니다** — 안 기다리면 pickCity 가 빈 화면을 채웁니다.
 * ⚠ 고르는 절차는 citysearch.js 의 pickCity 하나입니다. 검색으로 고른
 *   것과 여기서 고른 것이 **같은 상태**여야 다음 단계가 같이 돕니다. */
async function 여행짜기(city){
  await openNew();
  pickCity(city);
}

/* 줄 하나. 홈·프로필과 **같은 부품**(.fprow)입니다 — 새로 만들면 리듬이
   또 갈립니다(app.css 의 「내가 쌓은 것」 주석). */
function 줄(제목, 밑, 오른쪽, 눌렀을때){
  const el = document.createElement('div');
  el.className = 'fprow';
  el.innerHTML = `<span class="t"><b>${esc(제목)}</b><span>${esc(밑)}</span></span>
    <span class="go">${esc(오른쪽)} ›</span>`;
  el.onclick = 눌렀을때;
  return el;
}

/* ── 「성향 | 별점 | 어워즈」 칸 고르기(b811 · 셋째 칸 b812) ── 칸 줄(#an_tabs)은 index.html 에 있고, 세 칸(#an_p · #an_m · #an_a)은 loadAnal 이
   그릴 때마다 새로 만듭니다. 고른 칸은 앱이 켜 있는 동안 기억합니다 — 다른 탭에 갔다 와도 그 칸 그대로.
   ⚠ 칸을 바꿀 때 칸 줄이 화면 위로 올라가 있으면 칸 줄까지만 되돌립니다 — 긴 성향 칸 아래에서 「별점」을 누르면
     새 칸의 중간에 떨어지지 않게. */
let 지금칸 = 'p';
function 칸보이기(){
  $('an_p')?.classList.toggle('hide', 지금칸 !== 'p');
  $('an_m')?.classList.toggle('hide', 지금칸 !== 'm');
  $('an_a')?.classList.toggle('hide', 지금칸 !== 'a');
  document.querySelectorAll('#an_tabs [data-an]').forEach(b => {
    const on = b.dataset.an === 지금칸;
    b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on));
  });
}
$('an_tabs')?.addEventListener('click', e => {
  const b = e.target.closest('[data-an]');
  if (!b || b.dataset.an === 지금칸) return;
  지금칸 = b.dataset.an;
  칸보이기();
  const 줄 = $('an_tabs');
  if (줄 && 줄.getBoundingClientRect().top < 0) 줄.scrollIntoView({ block: 'start' });
});

export async function loadAnal(){
  const box = $('analbox');
  if (!box || !ctx.me()) return;

  /* ⚠ **제 질의를 합니다.** `myRates` 는 평가 탭을 열어야 채워집니다 —
     분석 탭만 열고 온 사람에게는 비어 있습니다(home.js 의 renderFoot 에서
     겪은 것과 같은 함정).
     ⚠ **한 번에 다 받습니다(b461).** 「다음 여행」이 씨앗으로 want 도 씁니다 —
       별점만 쓰면 아직 안 가본 결이 통째로 빠집니다(rec.js). created_at 은
       성향 변화가 씁니다. 카드가 넷이어도 왕복은 하나입니다. */
  /* ⚠ **`my_footprint` 를 안 부릅니다(b542).** 그것이 주던 「28개국 ·
     14.4%」는 발자국 카드의 것이었고, 카드는 기록 탭으로 갔습니다.
     여기 남은 셋(성향 · 진기록 · 다음 여행)은 전부 평가 줄로 셉니다.
     왕복이 둘에서 하나로 줄었습니다. */
  const 평가 = await sb.from('city_ratings').select('city_id,stars,want,created_at')
    .eq('user_id', ctx.me().id);

  const 전부   = 평가?.data || [];
  /* ⚠ **지우기 «전»에 붙잡습니다.** 아래 ① 참고 — 이 줄이 자식을 다
     지우므로, 두 번째부터는 여기서 안 잡으면 리포트를 영영 잃습니다. */
  const 리포트 = $('personabox');
  box.innerHTML = '';

  /* ══ 두 칸 — 「성향 | 별점」(b811, 2026-10-01 사용자 결정) ═══════════════════════════════
   * 사용자: 「분석탭이 너무 길어지는데」 → 로컬 시안 A(두 칸) · B(접기) → A. 이름은 「내 도시」 대신 「별점」(사용자).
   * 재 보니 한 장에 폰 화면 4.4장(3,596px)이었습니다 — 성향 2.4장 · 별점 1.6장으로 갈렸습니다.
   * ⚠ 접기(B)를 안 고른 까닭: 「두 걸음 깊은 것은 아무도 안 본다」(b457·b503). 칸은 한 번 누르면 다 펼쳐져 있습니다.
   * ⚠ 어느 칸에 무엇이: 성향 = 리포트(성향 카드 · 다시 간 도시 · 궁합 · 다음 여행 · 왜 ○○○○) ·
   *   별점 = 내 별점 · 거리별 별점 · 어워즈 = 도시 어워즈 · 여행지 월드컵(mycity.js, b812). 칸 줄은 index.html 의 #an_tabs. */
  /* ⚠ b812: 셋째 칸 「어워즈」(사용자: 「도시어워즈랑, 진짜 최애는 … 탭하나 더 만들어서 빼고 다 펼쳐놓자 세로로」 ·
     차례 「성향 별점 어워즈 순으로 가자」). 별점 = 내 별점 · 거리별 별점, 어워즈 = 도시 어워즈(세로로 다 펼침) · 여행지 월드컵(옛 「진짜 최애」, 사용자가 바꿈). */
  const 성향칸 = document.createElement('div'), 별점칸 = document.createElement('div'), 어워즈칸 = document.createElement('div');
  성향칸.id = 'an_p'; 별점칸.id = 'an_m'; 어워즈칸.id = 'an_a';
  box.append(성향칸, 별점칸, 어워즈칸);
  칸보이기();

  /* ══ ① 성향 리포트 ═══════════════════════════════════════════════════
   * ⚠⚠ **요약 카드를 걷고 «리포트 그 자체»를 놓습니다(b547, 사용자 결정).** ⚠⚠
   *   b447 부터 여기는 요약(유형 · 축 막대 넷)이었고, 제목 줄의
   *   「자세히 보기 ›」가 프로필 위에 얹히는 판을 열었습니다. 그 구조는
   *   이 탭이 **여러 가지를 맡던 시절**의 것입니다 — 발자국·다음 여행과
   *   나란히 놓으려니 성향은 요약이어야 했습니다.
   *   b542·b546 을 거치며 이 탭은 **성향 하나만** 맡게 됐습니다. 그러면
   *   요약과 원본이 같은 탭에 두 겹으로 서고, 한 걸음 더 들어갈 이유가
   *   없습니다. 「두 걸음 깊은 것은 아무도 안 본다」가 이 앱에서 여러 번
   *   나온 말인데(b457·b503), 여기서는 아예 걸음을 없앨 수 있습니다.
   * ⚠ **화면을 새로 만들지 않습니다.** `#personabox` 를 **옮겨와서**
   *   persona.js 가 그대로 그립니다 — 두 벌로 그리면 언젠가 갈라집니다.
   * ⚠⚠ **`box.innerHTML = ''` 보다 «먼저» 붙잡아야 합니다.** 그 한 줄이
   *   자식을 다 지우는데, 두 번째로 이 탭을 열 때 `#personabox` 는 이미
   *   그 자식입니다 — 지워지고 나면 `getElementById` 가 null 을 줍니다.
   *   그래서 위에서 미리 잡아 둡니다(`리포트`).
   * ⚠ 매긴 곳이 문턱(5곳)에 못 미쳐도 그냥 그립니다 — 리포트가 스스로
   *   「도시 N곳만 더 매기면」과 「평가하러 가기」를 냅니다(persona.js 의 `임시`). */
  /* ⚠⚠ **`await` 가 있어야 합니다(b736).** 아래 ③(다음 여행)이 리포트 «안»의
     자리(#nextspot)를 찾아 들어갑니다 — 리포트가 다 그려지기 전에는 그 칸이 없어서,
     안 기다리면 성향 칸 맨 아래로 떨어집니다. (② 내 별점은 b811 부터 「별점」 칸이라 리포트를 안 기다려도 됩니다.)
     ⚠ 터져도 나머지는 그립니다 — 리포트 하나 때문에 탭 전체가 비면
       안 됩니다. */
  if (리포트){
    성향칸.appendChild(리포트);
    try { await renderPersona(); } catch (e) { console.error('@persona', e); }
  }

  /* ══ ② 내 별점 ═══════════════════════════════════════════════════════
   * 사용자: 「분석탭에 컨텐츠가 적은 것 같은데」. 맞습니다 — 카드 넷이
   * **전부 유형 이야기**였고 **나에 대한 숫자가 하나도 없었습니다.**
   * 발자국 숫자는 b542, 진기록은 b546 에 기록 탭으로 옮겼으니 그것을
   * 되돌리면 안 됩니다. 대신 「나는 어떤 여행자인가」에 답하는 숫자를 놓습니다.
   *
   * 셋을 한 카드에 담습니다 — 다 「내 별점」을 재료로 쓰는 이야기입니다:
   *   ① 내 평균 vs 남들 평균 (짜게 주나 후하게 주나)
   *   ② 얼마나 알려진 곳에 갔나 (fame 분포)
   *   ③ 남들과 갈리는 곳
   *
   * ⚠⚠ **`n_rated` 에는 내가 들어 있습니다**(rate.js 의 `avgTail` 주석).
   *   그대로 비교하면 «내 별점이 섞인 평균»과 내 별점을 견주는 셈이라
   *   늘 「남들과 비슷하다」쪽으로 기웁니다. 나를 빼고 다시 냅니다:
   *       남들평균 = (avg_stars × n_rated − 내별점) ÷ (n_rated − 1)
   * ⚠⚠ **두 평균은 «같은 집합»에서 내야 합니다.** 내 평균을 전부에서
   *   내고 남들 평균을 「비교 가능한 곳」에서 내면, 차이가 취향이 아니라
   *   **집합 차이**에서 옵니다. 그래서 둘 다 짝이 맞는 곳만 씁니다.
   * ⚠ 표본이 적으면 안 그립니다 — 세 곳으로 「짜게 준다」고 말할 수 없습니다.
   * ⚠ `cityStat` 은 평가 탭을 열어야 채워집니다. 비어 있으면 여기서 한 번
   *   싣습니다(홈 깃발 줄에서 겪은 것과 같은 함정, b652). */
  {
    if (!Object.keys(cityStat).length) { try { await loadRateData(); } catch {} }

    const 매긴 = 전부.filter(r => r.stars != null);
    /* 남이 한 명이라도 매긴 곳만 비교에 씁니다 — 나 혼자면 견줄 것이 없습니다. */
    const 짝 = 매긴.map(r => {
      const s = cityStat[r.city_id];
      const 남수 = (s?.n_rated || 0) - 1;
      if (!s || 남수 < 1) return null;
      const 남평 = (Number(s.avg_stars) * s.n_rated - Number(r.stars)) / 남수;
      return { id: r.city_id, 내: Number(r.stars), 남: 남평, 남수,
               차: Number(r.stars) - 남평 };
    }).filter(Boolean);

    const 카드 = document.createElement('div');
    /* `starcard` 는 **여백 때문에** 답니다 — `.picks + .picks` 는 두 줄이
       «서로 붙어» 있을 때만 걸리는데(app.css), 이 카드는 사이에 막대와
       갈림 줄이 끼어 있어 안 먹습니다. */
    카드.className = 'card quiet starcard';
    카드.innerHTML = '<h2>내 별점</h2>';
    let 뭔가 = false;

    /* ── ① 평균 견주기 ── */
    if (짝.length >= 5){
      const 내평 = 짝.reduce((a, x) => a + x.내, 0) / 짝.length;
      const 남평 = 짝.reduce((a, x) => a + x.남, 0) / 짝.length;
      const 차 = 내평 - 남평;
      /* 0.3 은 별 반 칸보다 작습니다. 그 아래를 「짜다/후하다」고 말하면
         다음에 한 곳 더 매길 때 말이 뒤집힙니다. */
      /* ⚠ 「남들」이 아니라 「다른 사람」입니다(b673) — 아래 칸 이름과
         같은 말을 써야 합니다. 한 카드 안에서 「남들」과 「다른 사람」이
         섞이면 둘이 다른 것인 줄 압니다. */
      const 말 = 차 >= 0.3 ? '다른 사람보다 후하게 줍니다'
               : 차 <= -0.3 ? '다른 사람보다 짜게 줍니다'
               : '다른 사람과 비슷하게 줍니다';
      const 부호 = 차 > 0 ? '+' : '';
      카드.insertAdjacentHTML('beforeend', `
        <div class="fpnums">
          <div><b>${내평.toFixed(1)}</b><span>내 평균</span></div>
          <div><b>${남평.toFixed(1)}</b><span>다른 사람 평균</span></div>
          <div><b>${부호}${차.toFixed(1)}</b><span>차이</span></div>
        </div>
        <div class="memo">${esc(말)} · 견준 곳 ${짝.length}곳</div>`);
      뭔가 = true;
    }

    /* ── ② 얼마나 알려진 곳에 갔나 ──
       ⚠ **`fame` 은 작을수록 유명합니다**(db/033: 1 도쿄·파리 / 3 할슈타트).
         이름 때문에 반대로 읽기 쉽습니다 — b656 에 여기 옆 탭이 거꾸로
         정렬하고 있었습니다. 쓰기 전에 정의를 보십시오. */
    {
      const 칸 = [0, 0, 0];
      let 셈 = 0;
      for (const r of 매긴){
        const c = (cities || []).find(x => x.id === r.city_id);
        const f = c?.fame;
        if (f >= 1 && f <= 3){ 칸[f - 1]++; 셈++ }
      }
      if (셈 >= 5){
        const 이름 = ['누구나 아는 곳', '좀 다니면 아는 곳', '덜 알려진 곳'];
        카드.insertAdjacentHTML('beforeend',
          `<div class="picks"><span class="label">얼마나 알려진 곳에 갔나</span></div>` +
          칸.map((n, i) => {
            const p = Math.round(n / 셈 * 100);
            return `<div class="famerow"><span>${이름[i]}</span>
              <div class="fp"><i style="width:${p}%"></i></div>
              <b>${p}%</b></div>`;
          }).join(''));
        뭔가 = true;
      }
    }

    /* ── ③ 별점을 어떻게 주나 (b727, 사용자 결정: 「막대 + 해석으로 가자」) ──
     * ⚠ **남이 필요 없는 칸입니다.** 위 ①③ 은 견줄 사람이 있어야 뜻이
     *   생기는데, 이건 내 별점만으로 답이 납니다 — 사람이 적은 지금
     *   이 카드에서 늘 살아 있는 칸이 ②와 여기뿐입니다.
     * ⚠ **막대만 그리면 보관함 시트의 숫자를 한 번 더 적는 것뿐입니다**
     *   (거기 갈래별 개수가 이미 있습니다). 값은 «해석»에서 나옵니다 —
     *   「★3~4에 88%가 몰려 있다」는 본인도 모르던 사실이고, 별점을 사실상
     *   두 칸으로만 쓰고 있다는 뜻입니다.
     * ⚠ 갈래는 stars.js 의 `별갈래` 하나입니다(위 import 주석).
     * ⚠ 문턱 5곳은 위 ①② 와 같습니다 — 세 곳으로 「몰려 있다」고 할 수 없습니다.
     * ⚠ 해석은 **두 마디까지**만 답니다. 세 마디가 되면 읽다 말고, 그러면
     *   막대만 남아 처음 문제로 돌아갑니다. */
    {
      const 갈래 = ['5', '4', '3', '2', '1'];
      const 셈 = {}; 갈래.forEach(k => { 셈[k] = 0; });
      let 전체 = 0;
      for (const r of 매긴){ const k = 별갈래(r.stars); if (셈[k] != null){ 셈[k]++; 전체++; } }

      if (전체 >= 5){
        const 몫 = k => 셈[k] / 전체;
        /* 제일 많은 두 갈래. 붙어 있으면 「★3~4」, 떨어져 있으면 「★3과 ★5」. */
        const 큰둘 = [...갈래].sort((a, b) => 셈[b] - 셈[a]).slice(0, 2)
                              .map(Number).sort((a, b) => a - b);
        const 합 = (셈[String(큰둘[0])] + 셈[String(큰둘[1])]) / 전체;
        const 말 = [];
        if (합 >= 0.7)
          말.push(`${큰둘[1] - 큰둘[0] === 1 ? `★${큰둘[0]}~${큰둘[1]}` :
                    `★${큰둘[0]}과 ★${큰둘[1]}`}에 ${Math.round(합 * 100)}%가 몰려 있어요`);
        if (몫('5') <= 0.1) 말.push(`별 다섯은 ${셈['5']}곳뿐이에요`);
        else if (몫('5') >= 0.35) 말.push(`${Math.round(몫('5') * 100)}%가 별 다섯이에요`);
        if (말.length < 2 && 셈['1'] + 셈['2'] === 0) 말.push('★2 아래는 하나도 없어요');

        카드.insertAdjacentHTML('beforeend',
          `<div class="picks"><span class="label">별점을 어떻게 주나</span></div>` +
          갈래.map(k => {
            const p = Math.round(몫(k) * 100);
            return `<div class="famerow"><span>${esc(BAND_NAME[k])}</span>
              <div class="fp"><i style="width:${p}%"></i></div>
              <b>${셈[k]}곳</b></div>`;
          }).join('') +
          (말.length ? `<div class="memo">${esc(말.slice(0, 2).join(' · '))}</div>` : ''));
        뭔가 = true;
      }
    }

    /* ── ④ 별점이 갈린 곳 ──
       ⚠⚠ **「남이 둘 이상」으로 걸렀다가 되돌렸습니다(b658).** 실기기에서
         재보니 그 조건에 맞는 도시가 **0곳**이었습니다 — 지금 이 앱은 쓰는
         사람이 사실상 둘이라 거의 모든 도시가 `n_rated = 2`(나 + 한 명)
         입니다. 그러면 이 줄은 **영구히 안 보입니다.**
         「통계적으로 더 옳은 문턱」이 「아무것도 안 보이는 화면」이 되면
         그건 옳은 문턱이 아닙니다.
       → 한 명이어도 보여주고, **인원을 함께 적습니다.** `avgTail` 이 이미
         같은 판단을 합니다(rate.js) — 숫자를 숨기지 말고 근거를 밝힌다.
       ⚠ 그래서 제목이 「남들과 갈리는 곳」이 아니라 「별점이 갈린 곳」입니다.
         한 명일 때 「남들」은 거짓입니다.
       ⚠ 1.0(별 한 칸) 미만은 안 넣습니다 — 반 칸 차이를 「갈린다」고 하면
         거의 모든 도시가 걸립니다. */
    {
      const 갈림 = 짝.filter(x => Math.abs(x.차) >= 1.0)
        .sort((a, b) => Math.abs(b.차) - Math.abs(a.차)).slice(0, 4);
      if (갈림.length){
        카드.insertAdjacentHTML('beforeend',
          `<div class="picks"><span class="label">별점이 갈린 곳</span></div>` +
          갈림.map(x => {
            const c = (cities || []).find(y => y.id === x.id);
            const 위 = x.차 > 0 ? 'up' : 'down';
            /* ⚠ **「내 / 남」이 아니라 「나 / 다른 사람」입니다(b673,
               사용자 결정).** 한 글자 라벨은 짧아서 좋은 게 아니라
               **말 같지 않습니다** — 「남 3.0」은 읽히지 않고 해독됩니다.
             ⚠ 사람 수 괄호는 남겨 둡니다. 이 앱은 아직 쓰는 사람이
               둘이라 대부분 「(1명)」인데, 그걸 감추면 「다른 사람들이
               이렇게 매겼다」로 읽혀 **여러 명인 척**하게 됩니다. */
            /* ⚠ 도시 사진을 답니다(b749, 사용자: 「별점이 갈린 곳도 사진
               넣자」). 「다음 여행」과 같은 수법 — 사진이 없으면 크림 칸에
               이름 첫 글자(city.js 가 쓰는 것과 같습니다). */
            const 이름 = c?.name || x.id;
            return `<div class="gaprow">
              <span class="gapim"${c?.image_url
                ? ` style="background-image:url('${esc(c.image_url)}')"` : ''}
                >${c?.image_url ? '' : esc(String(이름).slice(0, 1))}</span>
              <b>${esc(이름)}</b>
              <span class="${위}">나 ${x.내.toFixed(1)}</span>
              <span>다른 사람 ${x.남.toFixed(1)} (${x.남수}명)</span></div>`;
          }).join(''));
        뭔가 = true;
      }
    }

    /* 리포트 안 「내 별점」 자리로. 리포트가 없으면 제자리(탭 맨 아래). */
    if (뭔가) 별점칸.appendChild(카드);   /* 「별점」 칸 맨 위(b811 — 전에는 리포트 안 #statspot) */
  }

  /* ══ ②-2 내 도시 이야기(b810, 2026-10-01) ══════════════════════════════
   * 도시 어워즈 · 거리별 별점 · 여행지 월드컵 — b812 부터 거리별은 「별점」 칸, 어워즈·월드컵은 「어워즈」 칸.
   * 그리는 것은 mycity.js. 국내도 셉니다(성향과 다름 — 거기 머리말 참고).
   * ⚠ 터져도 탭은 그대로 둡니다 — 카드 셋 때문에 아래 「다음 여행」까지 안 그려지면 안 됩니다. */
  try { await drawMyCities(전부, { 별점: 별점칸, 어워즈: 어워즈칸 }, ctx.me().id); }
  catch (e) { console.error('@mycity', e); }
  /* 별점 칸이 비면(매긴 곳이 적으면) 무엇을 하면 채워지는지 한 줄 — 빈 화면 규칙(emptyDo). */
  if (!별점칸.children.length)
    별점칸.innerHTML = `<div class="card">${emptyDo('도시를 5곳 넘게 매기면 여기에 별점 이야기가 나와요', '평가하러 가기', 'tabrate',
      '내 별점 · 거리별 별점')}</div>`;
  if (!어워즈칸.children.length)
    어워즈칸.innerHTML = `<div class="card">${emptyDo('도시를 5곳 넘게 매기면 여기에 도시 어워즈와 여행지 월드컵이 나와요', '평가하러 가기',
      'tabrate', '최애 도시 · 숨은 보석 · 1·2·3위')}</div>`;

  /* ⚠ **진기록은 기록 탭으로 갔습니다(b546, 사용자 결정).**
     b542 에 지도 화면에서 여기로 꺼냈던 것인데, 실기기에서 보니 「가장
     많이 간 나라 · 최북단 · 가장 먼 두 도시」는 **성향이 아니라 발자국**
     이야기였습니다. 이 탭은 「나는 어떤 여행자인가」 하나만 맡습니다.
   ⚠ 세는 함수(`funRows`)는 여전히 map.js 것입니다 — 이제 home.js 가
     그것을 씁니다. 여기로 되돌리려거든 거기서 먼저 빼십시오. */



  /* ══ ③ 다음 여행 ═══════════════════════════════════════════════════
     「다음에 가볼 만한 곳」과 「가보고 싶어요」를 합쳤습니다(b464).
     하나는 우리가 고른 것, 하나는 본인이 골라둔 것 — 둘 다 **아직 안 간
     곳** 이야기라 한 카드에 있는 편이 맞습니다.
     ⚠ 세 줄을 **한 덩어리로 합치지 마십시오.** 「어울리는 곳」은
       감추고-맞히기로 재서 정한 것이고, 「도전해볼 곳」은 정확도를
       주장하지 않으며, 「가보고 싶어요」는 본인이 적은 것입니다.
       출처가 다른 셋이라 섞으면 앞의 넷까지 못 믿게 됩니다(rec.js).
     ⚠ 칩을 누르면 그 도시가 골라진 채로 여행 만들기가 열립니다(b463) —
       읽고 끝나면 분석 탭이 읽을거리로 남습니다. */
  const 골라 = similarPicks(cities, 전부, { n: 4 });
  const 위시 = 전부.filter(r => r.want && r.stars == null)
    .map(r => (cities || []).find(c => c.id === r.city_id)).filter(Boolean);

  if (골라.match.length || 골라.opposite.length || 위시.length){
    const 갈곳 = document.createElement('div');
    갈곳.className = 'card quiet';
    갈곳.innerHTML = '<h2>다음 여행</h2>';

    /* ⚠⚠ **이름만 적힌 알약에서 «사진 칸»으로(b748, 사용자 결정:
       「다음 여행도 도시 사진 다 넣자」).** 여기는 «가고 싶게 만드는» 자리인데
       글자만 있으면 아무 그림도 안 그려집니다. 도시 사진은 이미 다 갖고
       있습니다(cities.image_url, 469곳 전부 — city-photos 메모).
     ⚠ **가로로 굴립니다.** 한 줄에 넉 장이 안 들어가므로 접지 말고 밀어
       보게 합니다(사용자: 「가로로 다 못 넣으면 스와이프 해서 볼 수 있게」).
     ⚠ 사진이 없는 도시도 있습니다(드물게). 그때는 크림 칸에 이름 첫 글자 —
       도시 화면(city.js)이 쓰는 것과 같은 수법입니다. */
    const 줄내기 = (제목, 도시들, 꼬리) => {
      if (!도시들.length) return;
      const 줄 = document.createElement('div');
      줄.className = 'picks';
      줄.innerHTML = `<span class="label">${esc(제목)}${
        꼬리 ? `<i>${esc(꼬리)}</i>` : ''}</span>`;
      const 칸들 = document.createElement('div');
      칸들.className = 'crow';
      도시들.slice(0, 8).forEach(c => {
        const b = document.createElement('button');
        b.className = 'ccard';
        b.innerHTML =
          `<span class="cimg"${c.image_url
              ? ` style="background-image:url('${esc(c.image_url)}')"`
              : ' data-ph="1"'}>${c.image_url ? '' : esc(c.name.slice(0, 1))}</span>` +
          `<b>${esc(c.name)}</b><i>${esc(cityCountry(c))}</i>`;
        b.onclick = () => 여행짜기(c);
        칸들.appendChild(b);
      });
      줄.appendChild(칸들);
      갈곳.appendChild(줄);
    };
    줄내기('어울리는 곳', 골라.match.map(x => x.city));
    /* 「도전해볼 곳」 — b776 에 「반대로 가보면」에서 바꿨습니다(사용자).
       공유 카드(card.js 의 drawP16)와 같은 말입니다. 한쪽만 바꾸지 마십시오. */
    줄내기('도전해볼 곳', 골라.opposite.map(x => x.city));
    줄내기('가보고 싶어요', 위시,
           위시.length > 8 ? `${위시.length}곳 중 8곳` : '');
    /* 리포트 안 「막대」 바로 밑으로(b736 시안 순서). 칸이 없으면 제자리. */
    ($('nextspot') || 성향칸).appendChild(갈곳);
  }
}

/* 지도를 여는 길. `openMap` 을 직접 import 하면 map.js ↔ anal.js 고리가
   생기지는 않지만(map 은 anal 을 모릅니다), 단추를 누르는 쪽이 이미 있어
   그것을 씁니다 — 여는 절차가 두 벌이 되지 않게. */
function openMapSafe(){ $('openmap')?.click(); }
