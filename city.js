/* ── 도시 한 곳 화면 ─────────────────────────────────────────────────
 * 목록 어디서든 도시를 누르면 열리는 화면입니다. 사진·설명·별점·한줄평·
 * 지도로 가는 길이 여기 있습니다.
 *
 * ── app.js 에서 떼어낸 네 번째 조각입니다(b324) ─────────────────────
 * 이 조각을 고른 이유가 앞의 셋과 다릅니다. 작아서가 아니라,
 * **`openCity` 가 여러 곳에서 불리기 때문**입니다 — map.js 와 shelf.js 가
 * ctx 로 받아 쓰고 있었습니다. 모듈이 되면 셋 다 그냥 import 하면 되고
 * ctx 에서 한 줄씩 빠집니다. 떼어낼수록 얽힘이 줄어드는 자리입니다.
 *
 * app.js 만 아는 것은 셋입니다 — 로그인한 사람, 별점 저장, 기록 목록 다시
 * 그리기. 별점 저장은 평가 화면(app.js)에 있고, 그건 네 화면이 같이 쓰는
 * 자료를 건드리므로 여기로 가져오면 안 됩니다.
 *
 * 층: dom.js · db.js · cities.js · rate.js · stars.js · net.js 만 씁니다. */
import { $, esc, avatarImg, emptyDo, fitImage, toast } from './dom.js?v=b883';
import { sb } from './db.js?v=b883';
import { cities, countryName, countryInfo, continentOf, cityCountry } from './cities.js?v=b883';
import { myRates, cityStat, visited, 별받음 } from './rate.js?v=b883';
import { starHtml, starValue } from './stars.js?v=b883';
import { localTime } from './calc.js?v=b883';
import { fail, netIsDown } from './net.js?v=b883';
/* 후기 줄·후기 화면(b858). cityrev.js 는 이 파일을 안 읽습니다(도시 열기는 ctx 로) — 고리 없음. */
import { revRowsHtml } from './cityrev.js?v=b883';
/* 「○○ 맛집 추천」 칸(b861, db/124) — cmtask.js 는 이 파일을 안 읽습니다(고리 없음). */
import { foodsHtml } from './cmtask.js?v=b883';

/* 지금 열려 있는 도시. **app.js 에 있던 것을 여기로 옮겼습니다(b329)** —
   여닫는 것은 이 파일이 하는데 변수만 저쪽에 있어서, 떼어낸 뒤
   'cityOpen is not defined' 로 도시 화면이 빈 채로 열렸습니다.
   app.js 는 읽고 비우는 길만 씁니다(아래 둘). */
/* ── 덱 밖 판 일곱 (b646) ─────────────────────────────────────────────
 * `personapane`·`shelfpane`·`mappane`·`ctrypane`·`diarypane`·`setpane`·
 * `admpane` 은 app.js 가 부팅 때 **덱 밖으로 꺼내** `#signedin` 의 형제로
 * 만듭니다(app.js 550줄 근처). 마크업에는 `#setview` 안에 적혀 있어서
 * 파일만 읽으면 「덱 안」으로 보입니다 — **실제 자리는 실행 뒤에 다릅니다.**
 *
 * ⚠⚠ **그래서 `#tabdeck` 만 숨기면 이 일곱은 그대로 남습니다.**
 *   사용자 신고: 「매긴 곳에서 도시로 들어가니까 하단에 매긴 곳 리스트가
 *   그대로 살아 있어서 화면이 짬뽕」 — 정확히 이것입니다.
 *   재보니 `#shelfpane` 이 1244px 로 서 있는 채 도시 화면이 그 위에
 *   얹혀 있었습니다.
 * ⚠ **문서가 두 화면만큼 길어지므로 스크롤도 어긋납니다** — 「위아래가
 *   잘린다」가 여기서 나옵니다(app.js b502 주석에 같은 병의 기록이
 *   있습니다: 설정이 홈 아래에 매달려 1218px 더 굴렀다).
 * ⚠ **판을 늘리면 이 목록도 늘려야 합니다.** app.js 에 두 곳, 여기 한 곳
 *   — 셋이 같은 일곱을 압니다. */
/* ⚠⚠ **여기에 안 적으면 그 판이 도시 화면 «위»에 남습니다(b687).**
   b682 에 `#cmappane`(나라 지도)을 만들고 이 목록에 안 넣었더니, 나라
   지도에서 도시 카드를 눌러 도시로 들어가도 **도시 화면이 나라 지도 밑에
   깔려** 안 보였습니다(사용자 신고). 뒤로가기도 그래서 이상해 보였습니다 —
   한 번 눌러도 «안 보이던» 도시가 닫힐 뿐이라 아무 일도 안 한 것 같습니다.
   ⚠ 판을 새로 만들면 **이 줄에 더하는 것까지가 그 일**입니다. */
const 덱밖판 = ['personapane', 'shelfpane', 'mappane', 'ctrypane', 'cmappane',
                'diarypane', 'setpane', 'notifpane', 'admpane', 'p16pane', 'editpane'];
/* 팔로우의 두 덮개(b789) — 친구 화면·사람 화면. 화면 전체를 덮는 판이라
   도시를 그 «위»에 열려면 가렸다가 닫을 때 되살려야 합니다.
   ⚠ 위 열 개와 다릅니다 — 덱 밖으로 꺼낸 판이 아니라 **덱 위에 뜬 판**입니다.
     그래서 이것만 가렸었다면 닫을 때 덱도 같이 되살립니다(closeCity). */
const 덮개 = ['friendview', 'whoview', 'actview'];   /* actview — ♡ 알림(b859) */

/* ── 도시 겹(b789) ────────────────────────────────────────────────────
 * 도시를 열면서 «내가» 가린 판을 적어 두고 닫을 때 그대로 되돌립니다 —
 * 어디서 들어왔든 그 자리로 돌아가야 합니다. 여태는 한 겹(`가린판`)이었는데,
 * 도시 → 친구 이름 → 친구 화면 → 친구가 매긴 **다른 도시**로 갈 수 있게 되어
 * 겹을 쌓습니다. 뒤로 한 번에 한 겹씩: 다른 도시 → 친구 화면 → 처음 도시.
 *   { id, 가린: [그때 가린 판], y: 스크롤, 쓰던: 저장 안 한 글 }
 * ⚠⚠ **다시 그리기(별 누른 뒤·한줄평 저장 뒤)는 겹을 건드리지 않습니다.**
 *   b788 까지는 다시 그릴 때마다 `가린판` 을 새로 셌는데, 그때는 이미 다
 *   가려져 있어서 **빈 목록으로 덮였습니다** — 보관함에서 도시를 열고 별을
 *   누른 뒤 뒤로 가면 보관함이 아니라 프로필로 떨어졌습니다. */
let 층 = [];
let 일기모드 = false;        /* b862 — 아래 openCity 의 「일기 쓰기 화면」 */

let cityOpen = null;
export const isCityOpen = () => cityOpen != null;
/* 지금 열린 도시(b858) — 후기 화면(cityrev.js)이 「도시로」를 누를 때 같은 도시면 다시 안 엽니다. */
export const openCityId = () => cityOpen?.id ?? null;
/* 후기 화면에서 좋아요·답글을 바꾸고 돌아왔을 때 후기 칸만 다시(b858) */
export async function refreshCityReviews(){
  const id = cityOpen?.id; if (!id) return;
  const { data } = await sb.rpc('city_comments', { p_city: id });
  if (cityOpen?.id !== id) return;
  const 후기 = 내것먼저(data || []);
  if (data){ const 수 = Math.max(cityStat[id]?.n_comment ?? 0, 후기.length); $('cv_comments').innerHTML = revRowsHtml(후기.slice(0, 3), id, 수); 한줄평머리(수); 내한줄보기(); }
}
/* 내 한줄평은 목록 맨 위에(b866, 사용자: 「한줄평 모아져 있는데 거기서 내가 수정 삭제 하면 되는거 아냐?」) —
   그 줄에 「수정 · 삭제」가 붙습니다(cityrev.js 반응줄). 그래서 위 「내 한줄평 · 수정 · 삭제」 줄은 내 글이 목록에 있으면 숨깁니다. */
const 내것먼저 = l => { const 나 = ctx.me()?.id; return 나 ? [...l.filter(x => x.user_id === 나), ...l.filter(x => x.user_id !== 나)] : l; };
/* 「한줄평 N · 좋아요 순」 제목 줄(b867, index.html .cvsechd) — 둘 이상일 때만 정렬 말을 답니다 */
function 한줄평머리(수){
  $('cv_cmtn').textContent = 수 ? String(수) : '';
  $('cv_cmtsort').textContent = 수 > 1 ? '좋아요 순' : '';
}
const 목록에내것 = () => !!$('cv_comments')?.querySelector('[data-cvmyedit]');
/* 맛집 추천 칸만 다시(b861) — 내가 추천을 남긴 뒤(cmtask.js 의 onFood). */
export async function refreshCityFoods(강제 = false){   /* 강제 = 내가 방금 남기거나 고친 뒤(cmtask onFood) */
  const id = cityOpen?.id; if (!id) return;
  const c = cities.find(x => x.id === id);
  /* ⚠ 맛집 칸에 쓰는 중이면(「+ 내 맛집 추천하기」·그 자리 수정) 갈아 끼우지 않습니다 · 못 받았으면(h 가 '') 그대로 둡니다
     (b866 검토 — 한줄평 좋아요만 누르고 돌아와도 이 함수가 돌아 쓰던 글이 날아가거나 칸이 통째로 사라졌습니다). */
  const h = await foodsHtml(id, c?.name || '');
  if (cityOpen?.id !== id || !h || (!강제 && document.activeElement?.closest?.('#cv_foods'))) return;
  $('cv_foods').innerHTML = h;
}
/* 탭을 옮기면(app.js 의 showApp) 도시가 통째로 닫힙니다 — 겹도 같이 버립니다. */
export function clearCityOpen(){ cityOpen = null; 층 = []; }

let ctx = { me: () => null, saveRate: async () => {}, drawRatings: () => {},
            openTrip: async () => {}, loadHome: async () => {}, appTab: () => '',
            openPerson: () => {}, loadRateData: async () => ({}) };
export function setCityCtx(o){ ctx = { ...ctx, ...o }; }

/* ── 도시 상세 ──────────────────────────────────────────────────────
 * 왓챠는 포스터를 누르면 작품 페이지가 열립니다. 여행앱에서는 그보다 쓸모가
 * 있는데, **내가 그 도시에서 뭘 했는지**를 같이 보여줄 수 있기 때문입니다.
 * 일정에 이미 다 적혀 있으니 새로 입력받을 것이 없습니다. */
export async function openCity(id, 옵션 = {}){
  const c = (cities || []).find(x => x.id === id);
  if (!c) return;
  /* ⚠⚠ **내 별점이 아직 안 왔으면 먼저 받습니다(b797, SNS 점검에서 찾음).** ⚠⚠
   *   내 별·한줄평·일기·가고 싶은 곳은 `myRates` 에서 그리는데, 그건 평가 탭(이나 홈 지구본의
   *   나라 카드)을 열어야 받아졌습니다. 친구 소식의 도시 칩 · 친구가 매긴 도시 · 프로필 링크로
   *   들어온 뒤 연 도시는 **내 기록이 빈 채로** 떴고 — 도쿄에 별 4·한줄평·일기가 있는 계정인데
   *   셋 다 빈칸(재 봄) — 그 빈 일기 칸에 써서 저장하면 **원래 일기를 덮었습니다.**
   * ⚠ 홈의 나라 카드(home.js `나라카드`)와 같은 방식: 기다리는 사이 뒤로를 눌렀으면 그만둡니다.
   * ⚠ 비행기모드면 안 기다립니다(매달리는 fetch — 서비스워커 머리말). 대신 아래에서 한줄평·
   *   일기를 잠급니다. 다시 그리기(되돌림·다시)는 이미 받은 뒤라 건너뜁니다. */
  if (!별받음 && !옵션.되돌림 && !옵션.다시 && !netIsDown()){
    const 그때 = history.state?.t2 ?? null;
    try { await ctx.loadRateData(); } catch {}
    if ((history.state?.t2 ?? null) !== 그때) return;
  }
  /* 위 겹을 닫고 아래 도시로 «돌아와서» 다시 그리는 중인가(closeCity 가 부름).
     그때는 기록도 판도 건드리지 않고, 그 겹에 적어 둔 스크롤·글을 되살립니다. */
  const 되돌림 = 옵션.되돌림 || null;
  /* 별·한줄평을 저장한 뒤 «같은 도시를» 다시 그리는 중인가(아래 두 곳).
     ⚠ 그때도 겹·판·기록을 건드리지 않습니다 — 저장하는 사이에 친구 이름을
       눌러 사람 화면이 위에 떴을 수 있는데, 그걸 «새로 연다»로 읽으면
       사람 화면을 가리고 기록을 한 칸 더 쌓습니다. */
  const 다시 = !!옵션.다시 && cityOpen?.id === id;
  /* ⚠⚠ **쓰던 글을 붙잡아 둡니다(b716, b698 점검 넷째).** ⚠⚠
   *   이 함수는 «다시 그리기»로도 쓰입니다 — 별을 누르면 평균과 도장을
   *   새로 받으려고 `openCity(id)` 를 다시 부릅니다. 그런데 아래에서
   *   칸을 저장된 값으로 덮어써서, **일기를 쓰다 별을 누르면 쓰던 글이
   *   통째로 날아갔습니다**(사용자가 겪은 자리).
   * ⚠ «같은 도시로 다시 열 때»만입니다. 다른 도시로 가면 그 도시의 글이
   *   나와야 합니다.
   * ⚠ 저장된 것과 같으면 되살릴 것이 없습니다 — 저장 직후의 다시 그리기가
   *   그 경우라, 굳이 손대지 않습니다. */
  const 같은곳 = cityOpen?.id === id;
  const 쓰던한줄 = 같은곳 ? ($('cv_note')?.value ?? null) : (되돌림?.쓰던?.한줄 ?? null);
  const 쓰던일기 = 같은곳 ? ($('cv_journal')?.value ?? null) : (되돌림?.쓰던?.일기 ?? null);
  /* 지금 보이는 판 — 도시가 가려야 할 것. 스크롤도 같이 적습니다(덮개는
     제 스크롤을 갖고 있어서, 가렸다 되살릴 때 제자리로 돌려놓아야 합니다). */
  const 보이는 = (되돌림 || 다시) ? []
    : [...덱밖판, ...덮개].filter(p => $(p) && !$(p).classList.contains('hide'))
                          .map(p => ({ p, y: $(p).scrollTop }));
  if (되돌림 || 다시){ /* 겹은 그대로(되돌림이면 closeCity 가 이미 걷었습니다) */ }
  else if (!cityOpen) 층 = [{ id, 가린: 보이는 }];
  else if (보이는.length){
    /* 도시 위에 뜬 판(친구·사람 화면)에서 또 도시를 엶 — 한 겹 더 쌓습니다.
       아래 도시의 스크롤과 쓰던 글을 적어 둡니다(돌아올 때 되살림). */
    const 아래 = 층[층.length - 1];
    if (아래){
      아래.y = window.scrollY;
      아래.쓰던 = { 한줄: $('cv_note')?.value ?? null, 일기: $('cv_journal')?.value ?? null };
    }
    층.push({ id, 가린: 보이는 });
  }
  else if (층.length) 층[층.length - 1].id = id;     /* 다시 그리기 — 겹은 그대로 */
  else 층 = [{ id, 가린: [] }];
  cityOpen = c;
  /* 일기 쓰기 화면(b862) — 일기장에서 열 때만. 도시 화면에는 일기 칸이 없습니다(app.css #cityview.cvjmode).
     다시 그리기는 그대로 두고, 위 겹을 닫고 돌아올 때는 그 겹에 적어 둔 대로. */
  if (되돌림) 일기모드 = !!층[층.length - 1]?.일기;
  else if (!다시) 일기모드 = !!옵션.일기;
  if (층.length) 층[층.length - 1].일기 = 일기모드;
  $('cityview').classList.toggle('cvjmode', 일기모드);
  $('cv_jtitle').textContent = 일기모드 ? `${c.name} 일기` : '내 일기';
  if (!되돌림 && !다시 && history.state?.t2 !== 'city') history.pushState({ t2:'city' }, '');

  /* 홈에서도 지도에서도 도시를 열 수 있습니다 — 열린 탭이 뭐든 다 덮어야 합니다.
     setview 안쪽(프로필/지도/설정) 상태는 건드리지 않아서 닫으면 그대로 돌아옵니다. */
  /* 탭 화면 다섯은 덱 한 덩어리입니다(b474) — 낱개로 숨기면 덱 안에서
     가로 위치가 밀립니다. */
  /* ⚠ 덱«과» 덱 밖 판·덮개를 같이 가립니다(위 주석). 지금 보이는 것만
     겹에 적어 두었다가 닫을 때 그것만 되살립니다. */
  보이는.forEach(x => $(x.p).classList.add('hide'));
  $('tabdeck').classList.add('hide');
  $('cityview').classList.remove('hide');
  window.scrollTo({ top:0 });

  const r = myRates[id] || {}, s = cityStat[id];
  /* 큰 사진(image_lg, 사진 개편 db/109)을 위층에, 작은 것을 아래층에 둡니다. 큰 것이 오는 동안이나
     못 받았을 때 아래 작은 것이 비칩니다. 둘 다 `center/cover` 를 받습니다(값 하나가 층마다 되풀이). */
  $('cv_hero').style.backgroundImage = [...new Set([c.image_lg, c.image_url].filter(Boolean))]
    .map(u => `url("${u}")`).join(', ');
  $('cv_hero').classList.toggle('ph', !c.image_url);
  $('cv_hero').textContent = c.image_url ? '' : c.name.slice(0, 1);
  $('cv_name').textContent = c.name;
  $('cv_sub').textContent = [cityCountry(c), c.name_local,
                             visited.has(id) ? '다녀옴' : null].filter(Boolean).join(' · ');
  /* 다녀온 곳이면 도장을 찍습니다(b604). 나라 코드 두 자는 여권 도장의
     문법이고, 우리가 이미 갖고 있는 값이라 새로 받아올 것이 없습니다.
     ⚠ 없을 때 «비우지» 않고 `hide` 로 숨깁니다 — 다음 도시가 다녀온
       곳이면 다시 채우는데, 비워두면 그새 한 번 빈 원이 보입니다. */
  {
    const 갔다 = visited.has(id);
    $('cv_stamp').classList.toggle('hide', !갔다);
    if (갔다){
      $('cv_stamp').innerHTML =
        `<b>${esc(String(c.country || '').toUpperCase())}</b><i>다녀옴</i>`;
      /* ⚠⚠ **도장은 매번 다르게 찍힙니다(b629).** 여태 모든 도시가
         -11°·같은 농도였습니다 — 그러면 「찍은 것」이 아니라 「인쇄된
         딱지」로 보입니다. 사람이 손으로 찍으면 각도도 힘도 매번 다릅니다.
         ⚠ **아무 값이나(random) 쓰면 안 됩니다.** 화면을 다시 그릴 때마다
           같은 도시의 도장이 달라지면 그건 불규칙이 아니라 «고장»입니다.
           도시 id 에서 수를 뽑아 씁니다 — **도시마다 다르고, 같은 도시는
           언제나 같습니다.**
         ⚠ 농도는 좁게(.86~1.0)만 흔듭니다. 더 넓히면 어두운 사진 위에서
           옅은 쪽이 안 읽힙니다(b606 에서 겪은 것). */
      let 씨 = 0;
      for (const ch of String(id)) 씨 = (씨 * 31 + ch.charCodeAt(0)) >>> 0;
      $('cv_stamp').style.setProperty('--rot', (-15 + (씨 % 11)) + 'deg');
      /* ⚠⚠ **`>>` 가 아니라 `>>>` 입니다(b630).** `씨` 는 `>>> 0` 이라
         2^31 을 넘을 수 있는데, `>>` 는 그걸 **음수**로 읽습니다. 그러면
         `% 15` 도 음수가 되어 86 - 12 = **74** 가 나옵니다 — 제가 정한
         하한(.86)을 뚫고 어두운 사진 위에서 안 읽히는 도장이 생깁니다.
         실제로 가평이 0.74 였습니다(재보고 잡음).
         ⚠ 자바스크립트에서 «부호 없는 수»를 다룰 때는 자리 옮기기도
           `>>>` 로 맞춰야 합니다. 한쪽만 부호 없이 두면 이렇게 샙니다. */
      $('cv_stamp').style.setProperty('--ink', (86 + ((씨 >>> 5) % 15)) / 100);
    }
  }
  $('cv_avg').textContent  = s?.n_rated ? Number(s.avg_stars).toFixed(1) : '–';
  /* 후기 수(b858) — 누르면 아래 후기 칸으로 내려갑니다. */
  /* b868: 「· 한줄평 N」 걷음(사용자: 「바로 밑에 있잖아」) — 아래 한줄평 칸 제목이 같은 수를 말합니다 */
  $('cv_avgn').textContent = s?.n_rated ? `${s.n_rated}명이 매김` : '아직 아무도 안 매김';
  $('cv_stars').innerHTML  = starHtml(r.stars);
  $('cv_want').classList.toggle('on', !!r.want);
  $('cv_note').value = r.comment || '';
  $('cv_journal').value = r.journal || '';
  /* 위 `쓰던한줄`·`쓰던일기` 주석 참고 — 저장 안 한 글을 되돌려 놓습니다. */
  if (!같은곳) 한줄고침 = false;
  if (쓰던한줄 != null && 쓰던한줄.trim() !== (r.comment || '').trim()){
    $('cv_note').value = 쓰던한줄;
    한줄고침 = true;                     /* 고치던 글이 있으면 칸을 연 채로 */
  }
  if (쓰던일기 != null && 쓰던일기.trim() !== (r.journal || '').trim())
    $('cv_journal').value = 쓰던일기;
  /* 내 기록을 끝내 못 받았으면(비행기모드) 한줄평·일기를 잠급니다(b797 — 위 openCity 머리).
     빈 칸에 써서 저장하면 연결이 돌아올 때 서버의 원래 글을 덮습니다. 별은 그 칸만 쓰므로 둡니다. */
  const 잠금 = !별받음;
  $('cv_note').readOnly = 잠금; $('cv_journal').readOnly = 잠금;
  if (잠금 && !되돌림 && !다시) toast('연결이 없어 내 기록을 못 받았어요 — 한줄평·일기는 연결되면 쓸 수 있어요');
  cvNoteDirty();
  내한줄보기();
  사진불러오기();
  일기바뀜();



  /* 위키백과 요약. 없는 도시는 아래 사실만 보여줍니다. */
  $('cv_about').classList.toggle('hide', !c.summary);
  if (c.summary){
    $('cv_summary').textContent = c.summary;
    $('cv_src').href = c.summary_url || '#';
  }
  /* API 없이 이미 아는 것들 — 나라·대륙·통화·시간대.
     '다니기'(대중교통 등급)는 걷어냈습니다. 등급을 알아도 할 수 있는 일이
     없고, 정작 필요한 것은 이동 시간인데 그건 일정 화면이 따로 말해줍니다.
     transit_grade 자체는 그 계산에 계속 쓰이므로 DB 에는 그대로 둡니다. */
  $('cv_facts').innerHTML = [
    /* ⚠⚠ **속령은 모국의 대륙을 씁니다(b670, 사용자: 「괌은 미국으로
       가야지」).** 여기만 `c.country`(GU) 를 그대로 써서 「오세아니아」가
       나왔습니다. 앱의 다른 곳은 전부 모국을 씁니다 —
       깃발·지구본은 `c.cc`(cities.js), 대륙 합계는 서버가
       `coalesce(np.continent, n.continent)`(db/076). **이 한 줄만
       빠져 있어서**, 괌이 깃발에서는 미국인데 도시 페이지에서는
       오세아니아였습니다.
     ⚠ 지리로는 괌이 오세아니아가 맞습니다. 그래도 앱이 「괌의 나라는
       미국」이라고 말하기로 정한 이상(db/076), 대륙도 거기 따라야
       **합이 맞습니다** — 안 그러면 「미국 = 북아메리카」인데 괌만
       오세아니아로 세어져 대륙 숫자가 안 맞습니다. */
    ['대륙', continentOf[countryInfo[c.country]?.parent_code || c.country]],
    ['통화', c.currency],
    ['현지 시각', (localTime(c.timezone) || '').replace('현지 ', '')],
  ].filter(([, v]) => v).map(([k, v]) =>
    `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');

  /* ── 내가 팔로우하는 사람들(b789) ── Letterboxd 의 친구 평점 · Beli 의 「친구 점수」.
     매겼거나 한줄평을 썼거나 다녀온 사람. 별점을 숨긴 사람은 별 없이 이름만.
     ⚠ SQL(101)을 안 돌렸으면 함수가 없어 조용히 비웁니다.
     ⚠ 한줄평과 **같이** 받습니다 — 차례로 받으면 한줄평이 한 번 더 늦게 뜹니다. */
  const [{ data: fr }, { data: cm }] = await Promise.all([
    sb.rpc('city_friends', { p_city: id }),
    sb.rpc('city_comments', { p_city: id }),
  ]);
  if (cityOpen?.id !== id) return;       /* 그사이 다른 도시로 갔습니다 */
  const 친구 = fr || [];
  const 별 = 친구.filter(x => x.stars != null).map(x => Number(x.stars));
  /* ── 팔로우하는 사람들 — 한 줄로 묶고 누르면 펼침(b861, 사용자: 「한줄평이랑 팔로우한 사람 UI가 이질적이다」 → 시안 B) ──
     전에는 사람마다 큰 별 다섯 개 줄이라, 바로 아래 한줄평의 「★ 3.0」 네모와 별 모양이 둘이었습니다.
     접힌 줄: 사진 둘 겹침 · 「팔로우하는 사람 N명이 다녀왔어요」 · 친구 평균 ★ · 이름 셋까지. 펼치면 한 사람 한 줄(사진 · 이름 · 「★ 3.0」 네모). */
  const 평균 = 별.length ? (별.reduce((a, b) => a + b, 0) / 별.length).toFixed(1) : null;
  const 이름들 = 친구.slice(0, 3).map(x => esc(x.name || '여행자')).join(' · ') + (친구.length > 3 ? ` 외 ${친구.length - 3}명` : '');
  const 사진 = (x, px) => avatarImg(x.avatar_url, x.user_id, x.name || '여행자',
    `width:${px}px; height:${px}px; border-radius:50%; object-fit:cover; flex:none`, 'thumb');
  /* 펼쳐 둔 채 별을 누르거나 한줄평을 저장하면(다시 그림) 접히지 않게 — 펼친 채로 되돌립니다(두 번째 검토). */
  const 펼쳐있었나 = 다시 && !!$('cv_friends').querySelector('.frsum.open');
  $('cv_friends').innerHTML = 친구.length
    ? `<div class="cvfr2">
        <button type="button" class="frsum" data-frsum aria-expanded="false">
          <span class="actav${친구.length > 1 ? ' two' : ''}">${친구.slice(0, 2).map(x => 사진(x, 친구.length > 1 ? 32 : 40)).join('')}</span>
          <span class="t"><b>팔로우하는 사람 ${친구.length}명이 다녀왔어요</b>
            <span>${평균 ? `친구 평균 <i class="frsumstar">★</i> ${평균} · ` : ''}${이름들}</span></span>
          <span class="actgo" aria-hidden="true">›</span></button>
        <div class="frsumlist" hidden>${친구.map(x => `<button type="button" class="ghost frsumrow" data-person="${esc(x.user_id)}">
            ${사진(x, 36)}<b>${esc(x.name || '여행자')}</b>${
            x.stars != null ? `<span class="crvpill"><i aria-hidden="true">★</i>${Number(x.stars).toFixed(1)}</span>` : '<span class="memo">다녀왔어요</span>'}</button>`).join('')}</div>
      </div>`
    : '';
  if (펼쳐있었나) $('cv_friends').querySelector('[data-frsum]')?.click();

  /* 후기(b858, 왓챠처럼) — 좋아요 순 셋 + 「모두 보기」. 별점만 매긴 사람은 안 나옵니다 — 이름이 걸리니까요.
     ⚠ 팔로우하는 사람 후기도 여기 나옵니다(「팔로잉」 딱지) — 그래서 위 친구 칸에서는 한줄평 글을 뺐습니다.
     ⚠ 내 후기도 나옵니다 — 남이 누른 좋아요·답글을 보려면. 내 줄 하트는 못 누릅니다.
     ⚠ 수는 city_stats 의 n_comment(db/122)를 먼저, 없으면(SQL 전) 받은 줄 수. */
  const 후기 = 내것먼저(cm || []);
  const 후기수 = Math.max(cityStat[id]?.n_comment ?? 0, 후기.length);
  /* 못 받았으면(cm 이 없음) 비워 둡니다 — 「첫 한줄평」은 «정말 없을 때»만(b859). */
  $('cv_comments').innerHTML = cm ? revRowsHtml(후기.slice(0, 3), id, 후기수) : '';
  한줄평머리(cm ? 후기수 : 0);
  내한줄보기();   /* 목록에 내 글이 올라왔으면 위 줄을 숨기게(b866) */
  /* 맛집 추천(b861) — 한줄평 칸 아래. 못 받으면(SQL 전) 칸을 안 그립니다.
     ⚠ 같은 도시를 다시 그릴 때(별 누름·한줄평 저장 — 다시:true)는 비우지 않습니다(검토에서 찾음): 비우면 화면이 줄었다 늘며
       스크롤이 튀고, 열어 둔 「+ 내 맛집 추천하기」 칸의 쓰던 글이 날아갑니다. 그 칸에 손가락이 있으면 갈아 끼우지도 않습니다. */
  const 맛칸 = $('cv_foods');
  /* 같은 도시를 «그 자리에서» 다시 그릴 때(다시·되돌림)만 남깁니다 — 나중에 같은 도시를 새로 열거나 다른 계정으로 들어오면
     지난번 것(앞 계정의 「내 추천 지우기」까지)이 잠깐 보였습니다(두 번째 검토). */
  if (맛칸.dataset.city !== id || (!다시 && !되돌림)){ 맛칸.innerHTML = ''; 맛칸.dataset.city = id; }
  foodsHtml(id, c.name).then(h => {
    if (cityOpen?.id !== id || 맛칸.contains(document.activeElement)) return;
    맛칸.innerHTML = h;
  });
  /* 위 겹에서 돌아왔으면 보던 자리로(b789). 친구·한줄평 칸이 다 그려진
     «뒤»에 옮깁니다 — 먼저 옮기면 페이지가 아직 짧아서 중간에 걸립니다. */
  if (되돌림?.y) window.scrollTo({ top: 되돌림.y });
}

/* 가렸던 판을 되살립니다 — 덮개는 제 스크롤까지(가려지면 0 으로 읽힘). */
function 되살리기(가린){
  가린.forEach(({ p, y }) => {
    const el = $(p); if (!el) return;
    el.classList.remove('hide');
    if (y && el.scrollTop !== y) el.scrollTop = y;
  });
}

export function closeCity(fromPop){
  if (!fromPop && history.state?.t2 === 'city'){ history.back(); return; }
  const 위 = 층.pop() || { 가린: [] };
  /* 겹이 남았으면 — 친구 화면을 거쳐 도시 «위에» 연 도시였습니다(b789).
     아래 도시를 다시 그리고, 그 위에 떠 있던 판(사람·친구 화면)을 되살립니다.
     뒤로 한 번에 한 겹입니다. 도시 화면은 닫지 않습니다. */
  if (층.length){
    const 아래 = 층[층.length - 1];
    openCity(아래.id, { 되돌림: 아래 });
    되살리기(위.가린);
    return;
  }
  cityOpen = null;
  $('cityview').classList.add('hide');
  /* ⚠ **판에서 들어왔으면 그 판으로 돌아갑니다(b646).** 덱을 되살리면
     안 됩니다 — 그 판이 이미 덱을 덮고 있었고, 둘 다 보이면 또 겹칩니다.
   ⚠ 다만 **덮개만** 가렸었다면(친구·사람 화면에서 왔다면) 덱도 되살립니다 —
     덮개는 덱 위에 뜬 판이라, 덱이 없으면 덮개를 닫는 순간 빈 화면입니다. */
  if (위.가린.length){
    되살리기(위.가린);
    /* 일기장에서 일기를 쓰고 돌아옴(b862) — 방금 쓴 글이 일기장에 보이게 다시 폅니다(diary.js). */
    if (위.가린.some(x => x.p === 'diarypane')) dispatchEvent(new Event('t2:diaryagain'));
    if (위.가린.some(x => !덮개.includes(x.p))) return;
  }
  /* 열었던 탭으로 돌아갑니다 — 덱은 그 칸에 그대로 서 있으므로 되살리기만
     하면 됩니다(b474). 내용 갱신은 탭마다 다르니 그것만 나눕니다. */
  $('tabdeck').classList.remove('hide');
  if (ctx.appTab() === 'home') ctx.loadHome();
  else if (ctx.appTab() === 'rate') ctx.drawRatings();
}

$('cityview').addEventListener('click', async e => {
  /* 한줄평·친구 칸의 이름(b789) — 그 사람 프로필이 도시 화면 «위»에 덮여 열립니다. */
  /* 팔로우하는 사람들 접힌 줄 → 펼치기·접기(b861) */
  const 묶음 = e.target.closest('[data-frsum]');
  if (묶음){
    const 목록 = 묶음.nextElementSibling, 연다 = 목록.hidden;
    목록.hidden = !연다; 묶음.setAttribute('aria-expanded', 연다 ? 'true' : 'false');
    묶음.classList.toggle('open', 연다);
    return;
  }
  const 누구 = e.target.closest('[data-person]');
  if (누구){ ctx.openPerson(누구.dataset.person); return; }

  /* ⚠⚠ **`await` 를 건너면 `cityOpen` 이 없어질 수 있습니다(b691).**
     저장하는 동안 뒤로를 누르면 `closeCity` 가 `cityOpen = null` 로 만드는데,
     돌아와서 `cityOpen.id` 를 읽으면 TypeError 입니다. 화면에는 안 뜨고
     오류 기록에만 남습니다.
     → **아이디를 먼저 붙잡고**, 돌아와서는 «아직 그 도시인가»를 묻습니다. */
  const st = e.target.closest('#cv_stars .st');
  if (st){
    const id = cityOpen?.id; if (!id) return;
    const v = starValue(st, e.clientX);   /* 반칸 규칙은 stars.js 한 곳(b491) */
    const cur = myRates[id]?.stars;
    await ctx.saveRate(id, { stars: Number(cur) === v ? null : v });
    if (cityOpen?.id !== id) return;      /* 그새 닫혔거나 다른 도시로 갔다 */
    return openCity(id, { 다시: true });
  }
  if (e.target.closest('#cv_want')){
    const id = cityOpen?.id; if (!id) return;
    await ctx.saveRate(id, { want: !myRates[id]?.want });
    if (cityOpen?.id !== id) return;
    $('cv_want').classList.toggle('on', !!myRates[id]?.want);
  }
});
/* 쓴 것이 저장된 것과 다를 때만 버튼이 살아납니다 —
   눌러도 아무 일 없는 버튼이 켜져 있으면 저장됐는지 헷갈립니다. */
function cvNoteDirty(){
  const now   = $('cv_note').value.trim();
  const saved = (myRates[cityOpen?.id]?.comment || '').trim();
  const b = $('cv_save');
  b.disabled = now === saved;
  /* ⚠⚠ **「지우기」는 «지울 것이 있을 때»만 적습니다(b661).** 빈 칸이면
     저장된 것이 없어도 「지우기」라고 적고 있었습니다 — 아무것도 없는데
     「지우기」를 내미는 셈입니다. b660 까지는 저장 뒤에 글자가
     「…했어요」로 «남아» 있어서 이 덫이 안 보였고, 단추를 쉬는 모양으로
     되돌리게 만든 뒤에 드러났습니다.
     ⚠ 잠겨 있어 누를 수는 없지만, **단추는 못 눌러도 글자를 읽힙니다.**
     「막혀 있으니 아무 글자나 괜찮다」가 아닙니다. */
  b.textContent = now ? '등록' : (saved ? '지우기' : '등록');
}
/* 내 한줄평이 있으면 칸 대신 「내 한줄평 · 수정 · 삭제」 한 줄(b862, 왓챠처럼 — 사용자: 「한줄평 등록했는데 왜 그대로 남아있냐」).
   칸에 저장된 글이 그대로 남아 있어서 «안 올라간 것»처럼 읽혔습니다. 「수정」을 눌러야 칸이 열립니다. */
let 한줄고침 = false;
function 내한줄보기(){
  const saved = (myRates[cityOpen?.id]?.comment || '').trim();
  const 한줄로 = !!saved && !한줄고침;
  $('cv_mine').classList.toggle('hide', !한줄로 || 목록에내것());
  $('cv_noteedit').classList.toggle('hide', 한줄로);
  $('cv_minet').textContent = saved;
  $('cv_cancel').classList.toggle('hide', !saved);       /* 고치다 그만두기 — 저장된 글이 있을 때만 */
  const 잠금 = $('cv_note').readOnly;
  $('cv_mineedit').disabled = 잠금; $('cv_minedel').disabled = 잠금;
  const d = $('cv_minedel'); d.dataset.armed = ''; d.textContent = '삭제'; d.style.fontWeight = '';
}
export function 한줄고치기(){ 한줄고침 = true; 내한줄보기(); const n = $('cv_note'); n.focus(); n.setSelectionRange?.(n.value.length, n.value.length); }
$('cv_mineedit').addEventListener('click', 한줄고치기);
$('cv_cancel').addEventListener('click', () => {
  $('cv_note').value = myRates[cityOpen?.id]?.comment || '';
  한줄고침 = false; cvNoteDirty(); 내한줄보기();
});
/* 목록 내 줄의 「수정 · 삭제」(b866) — 위 칸의 수정·삭제와 같은 길 */
document.addEventListener('click', e => {
  const 고 = e.target.closest('[data-cvmyedit]');
  if (고 && $('cityview').contains(고)){
    e.preventDefault();
    if ($('cv_note').readOnly){ toast('연결이 없어 내 기록을 못 받았어요 — 연결되면 고칠 수 있어요'); return; }
    /* b867(사용자: 「써진 한줄평에서 수정이 돼야하는데 위쪽에서 수정이 됨 · 맛집처럼 그자리에서」) — 그 줄의 글이 칸으로 바뀝니다 */
    const 줄 = 고.closest('.crvrow'), 글칸 = 줄?.querySelector('.crvtxt'); if (!글칸 || 줄.querySelector('.cvedit')) return;
    글칸.insertAdjacentHTML('afterend', `<div class="fdedit cvedit" data-kbtop>
      <input type="search" enterkeyhint="done" class="cmfield" maxlength="200" autocomplete="off" aria-label="내 한줄평 고치기" value="${esc(myRates[cityOpen?.id]?.comment || 글칸.textContent)}">
      <div class="cmrow"><button type="button" class="ghost cmclose" data-cveditx>취소</button><button type="button" class="cmsave" data-cveditsave>저장</button></div></div>`);
    글칸.classList.add('hide'); 줄.querySelector('.crvact')?.classList.add('hide');
    const 칸 = 줄.querySelector('.cvedit input'); 칸.focus(); 칸.setSelectionRange?.(칸.value.length, 칸.value.length);
    return;
  }
  if (e.target.closest('[data-cveditx]') && $('cityview').contains(e.target)){
    const 줄 = e.target.closest('.crvrow'); 줄?.querySelector('.cvedit')?.remove();
    줄?.querySelector('.crvtxt')?.classList.remove('hide'); 줄?.querySelector('.crvact')?.classList.remove('hide');
    return;
  }
  const 저 = e.target.closest('[data-cveditsave]');
  if (저 && $('cityview').contains(저)){ e.preventDefault(); 한줄저장(저); return; }
  const 지 = e.target.closest('[data-cvmydel]');
  if (지 && $('cityview').contains(지)){
    e.preventDefault();
    if ($('cv_note').readOnly){ toast('연결이 없어 내 기록을 못 받았어요 — 연결되면 지울 수 있어요'); return; }
    내한줄지우기(지);
  }
});
/* 그 자리 고치기 저장 — 위 칸의 「등록」과 같은 saveRate 길 */
async function 한줄저장(b){
  const id = cityOpen?.id; if (!id) return;
  const v = b.closest('.cvedit')?.querySelector('input')?.value.trim() || '';
  if (!v){ toast('지우려면 「삭제」를 눌러 주세요'); return; }
  b.disabled = true;
  const 됐나 = await ctx.saveRate(id, { comment: v });
  b.disabled = false;
  if (됐나 === false){ toast('저장하지 못했어요. 잠시 뒤 다시 해주세요.'); return; }
  toast('한줄평을 고쳤어요');
  if (cityOpen?.id !== id) return;
  $('cv_note').value = v; cvNoteDirty();
  await openCity(id, { 다시: true });
}
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.isComposing || !e.target.closest?.('.cvedit')) return;
  e.preventDefault(); e.target.closest('.cvedit').querySelector('[data-cveditsave]')?.click();
});
$('cv_minedel').addEventListener('click', () => 내한줄지우기($('cv_minedel')));
async function 내한줄지우기(b){
  const id = cityOpen?.id; if (!id) return;
  if (b.dataset.armed !== '1'){ b.dataset.armed = '1'; b.textContent = '한 번 더 누르면 지워요'; b.style.fontWeight = '600'; return; }
  b.disabled = true;
  const 됐나 = await ctx.saveRate(id, { comment: null });
  b.disabled = false;
  if (됐나 === false){ toast('지우지 못했어요. 잠시 뒤 다시 해주세요.'); return; }
  toast('한줄평을 지웠어요');
  if (cityOpen?.id !== id) return;
  $('cv_note').value = ''; 한줄고침 = false; cvNoteDirty();
  await openCity(id, { 다시: true });
}
$('cv_note').addEventListener('input', cvNoteDirty);
$('cv_save').addEventListener('click', async () => {
  const v = $('cv_note').value.trim() || null;
  const id = cityOpen?.id; if (!id) return;   /* b691 — 아래 주석 참고 */
  $('cv_save').disabled = true;
  const 됐나 = await ctx.saveRate(id, { comment: v });
  /* ⚠⚠ **단추 글자만 바꾸던 것을 토스트로 옮깁니다(b660, 사용자 신고:
     「저장 누르면 저장 됐다는 피드백이 없어서 저장된지 안된지 모르겠어」).**
     글자는 «바뀌고 있었습니다** — 다만 그 단추가 `.ghost` 라 **잠기면
     회색 글자**가 되고, 자리도 안 움직여서 폰에서는 눈에 안 걸립니다.
     실측: 눌러도 4.3초 뒤까지 「등록했어요」가 잠긴 채 그대로 있었습니다 —
     즉 **동작은 맞고 «알림»이 약한 것**이었습니다.
   ⚠ 단추 글자는 **쉬는 모양으로 되돌립니다.** 단추는 「무슨 일이
     일어났나」가 아니라 「누르면 무엇을 하나」를 적는 자리입니다.
     일어난 일은 토스트가 말합니다. */
  /* ⚠ **안 됐으면 됐다고 하지 않습니다(b716).** 위 saveRate 주석 참고 —
     오류 자체는 fail 이 적지만 그 자리가 안 보일 수 있어 여기서도 말합니다. */
  if (됐나 === false){
    $('cv_save').disabled = false;
    toast('저장하지 못했어요. 잠시 뒤 다시 해주세요.');
    return;
  }
  toast(v ? '한줄평을 등록했어요' : '한줄평을 지웠어요');
  if (cityOpen?.id !== id) return;            /* 저장하는 동안 닫혔다 */
  한줄고침 = false;                             /* 등록했으면 한 줄로 접습니다(b862) */
  cvNoteDirty();
  /* 남들 한줄평 목록에 내 것이 바로 끼어들어야 남긴 느낌이 납니다. */
  await openCity(id, { 다시: true });
});



/* ── 내 일기(b537) ────────────────────────────────────────────────────
 * 사용자 결정: 이 앱의 핵심은 다녀온 곳을 남기는 것이고, 나중에 일기장처럼
 * 넘겨 볼 수 있어야 합니다. 그 「남기는 자리」가 여기입니다.
 *
 * ⚠⚠ **한줄평과 다른 칸입니다.** 한줄평(`comment`)은 남들에게 보이고
 *   (city_comments), 일기(`journal`)는 나만 봅니다(db/071). 둘을 한 칸으로
 *   합치면 **공개 한줄평이 공개 일기**가 됩니다 — 처음에 「한줄평을 여러
 *   줄로 바꾸면 된다」고 했다가 그걸 놓쳤습니다.
 * ⚠ 저장은 **누를 때만** 합니다. 자동 저장은 이 칸에 안 맞습니다 — 쓰다
 *   만 문장이 남고, 지우려던 것이 지워진 채로 굳습니다. 한줄평과 같은
 *   규칙으로 둡니다(바뀐 것이 있을 때만 단추가 살아납니다).
 * ⚠ 4000자에서 끊깁니다(db/071 의 check 와 같은 값). 화면에서 먼저
 *   막아야 서버가 거절하기 전에 사용자가 압니다. */
function 일기바뀜(){
  const 칸 = $('cv_journal'), b = $('cv_jsave');
  if (!칸 || !b) return;
  const 지금 = 칸.value.trim();
  const 적힌 = (myRates[cityOpen?.id]?.journal || '').trim();
  b.disabled = 지금 === 적힌;
  /* 위 `cvNoteDirty` 와 **같은 규칙**입니다(b661 주석). */
  b.textContent = 지금 ? '저장' : (적힌 ? '지우기' : '저장');
  /* 남은 글자는 **끝이 가까울 때만** 말합니다. 늘 세고 있으면 일기가
     아니라 원고지가 됩니다. */
  const 남음 = 4000 - 칸.value.length;
  $('cv_jnote').textContent =
    남음 <= 200 ? `${남음}자 남았어요` : (적힌 ? '' : '나만 보는 일기예요.');
  키맞추기();
}

/* 쓴 만큼 칸이 자랍니다 — 네 줄에 갇혀 있으면 길게 쓸 마음이 안 납니다.
   ⚠ 먼저 auto 로 되돌려야 «줄어들 때»도 따라옵니다. */
function 키맞추기(){
  const 칸 = $('cv_journal');
  if (!칸) return;
  칸.style.height = 'auto';
  칸.style.height = Math.min(칸.scrollHeight, 520) + 'px';
}

/* ── 일기 사진 ── 여러 장(b565 한 장 → b573 여러 장, db/073) ──────────
 * ⚠ 통이 **비공개**라 주소가 오래 못 갑니다. 그래서 표에 **서명 주소**를
 *   넣어 두고(db/073 머리말), 열 때마다 남은 시간을 안 따집니다 —
 *   만료돼서 안 보이면 그때 새로 받습니다.
 * ⚠⚠ **경로에 «임의의 이름»을 씁니다: `<내 id>/<도시>/<난수>.jpg`.** ⚠⚠
 *   한 장이던 시절에는 `<내 id>/<도시>.jpg` 로 **이름을 고정해** 덮어썼는데,
 *   여러 장에서 그러면 두 번째 사진이 첫 번째를 지웁니다. 반대로 「1,2,3…」
 *   으로 세면 가운데를 지운 뒤 번호가 겹칩니다. **한 번 쓰고 안 쓰는 이름**
 *   이라야 그런 사고가 아예 안 납니다.
 * ⚠ 통 정책은 **안 고쳐도 됩니다** — 규칙이 「경로 맨 앞 칸이 내 id」라서
 *   한 겹 깊어져도 그대로 맞습니다(db/073 머리말).
 * ⚠ 올리기 전에 줄입니다. 폰 사진은 4MB 가 예사인데 일기장은 한 화면에
 *   스무 장까지 그립니다 — 줄이지 않으면 그 화면이 못 뜹니다.
 * ⚠ **`shrink` 가 아니라 `fitImage`**(b567). 프로필용은 가운데를 정사각으로
 *   잘라내고 작은 사진은 늘립니다 — 1280×1280 정사각이 되고 파일이 되레
 *   커졌습니다(dom.js 의 그 자리 참고). */
const 사진최대 = 8;
let 내사진 = [];

/* ⚠⚠ **한 번 누르면 안 지웁니다(b716, b698 점검 열째).** ⚠⚠
 *   여태 ✕ 를 한 번 누르면 통에서도 표에서도 **바로, 영영** 지워졌습니다.
 *   되돌릴 길이 없고 물어보지도 않았습니다 — 사진 위 6px 자리에 있는
 *   30px 단추라 잘못 누르기도 쉽습니다.
 * ⚠ `confirm()` 은 이 앱에서 안 씁니다(ui.js `arm` 주석: 내장 브라우저에서
 *   막힙니다). 같은 «두 번 눌러 지우기»를 여기서도 씁니다.
 * ⚠ `ui.js` 의 `arm/disarm` 을 그대로 못 씁니다 — 그것은 단추 «글자»를
 *   갈아 끼우는데 이 단추 안에는 그림(svg)이 있었습니다. 그래서 글자
 *   ×(U+00D7, 칩의 닫기와 같은 글자라 폰에서 두부가 안 됩니다)로 바꾸고
 *   여기서 따로 풉니다.
 * ⚠ 다른 데를 누르면 풀립니다 — 물어본 채로 두면 나중에 무심코 눌렀을 때
 *   바로 지워집니다(ui.js 가 같은 이유로 하는 일). */
const 엑스 = '\u00d7';
function 사진무장풀기(){
  document.querySelectorAll('#cv_jgrid .jpdel.ask').forEach(b => {
    b.classList.remove('ask'); b.textContent = 엑스;
  });
}
document.addEventListener('click', e => {
  if (!e.target.closest?.('#cv_jgrid .jpdel.ask')) 사진무장풀기();
}, true);

function 사진그리기(){
  사진무장풀기();
  const 판 = $('cv_jgrid'), 빈 = $('cv_jpick');
  if (!판 || !빈) return;
  판.innerHTML = 내사진.map(p => `<div class="jpcell">
      <img src="${esc(p.url)}" alt="" loading="lazy">
      <button type="button" class="jpdel" data-jpdel="${esc(p.id)}"
              aria-label="이 사진 지우기">${엑스}</button>
    </div>`).join('');
  /* ⚠ 다 찼으면 단추를 **숨깁니다.** 눌리는데 아무 일도 안 나면 고장으로
     보입니다. 몇 장까지인지도 같이 알려줍니다. */
  빈.classList.toggle('hide', 내사진.length >= 사진최대);
  빈.textContent = 내사진.length ? `사진 더 넣기 (${내사진.length}/${사진최대})` : '사진 넣기';
}

async function 사진불러오기(){
  내사진 = [];
  사진그리기();
  if (!cityOpen) return;
  const r = await sb.from('journal_photos')
    .select('id,url,path,sort,created_at')
    .eq('user_id', ctx.me().id).eq('city_id', cityOpen.id)
    .order('sort').order('created_at');
  /* ⚠ 표가 아직 없을 수도 있습니다(db/073 을 안 돌린 상태). 그때는 조용히
     비워 둡니다 — 일기 자체는 멀쩡히 써야 하니 여기서 화면을 막지 않습니다. */
  if (r.error) return;
  내사진 = r.data || [];
  사진그리기();
}

/* 비공개 통에서 볼 수 있는 주소를 받아옵니다. 1년 — 일기는 오래 두고
   보는 것이라 짧게 잡으면 옛 장이 자꾸 깨집니다. */
async function 사진주소(path){
  const r = await sb.storage.from('journal-photos').createSignedUrl(path, 60 * 60 * 24 * 365);
  return r.data?.signedUrl || null;
}

$('cv_jpick')?.addEventListener('click', () => $('cv_jfile').click());
$('cv_jfile')?.addEventListener('change', async e => {
  const 고른것 = [...(e.target.files || [])];
  e.target.value = '';                 /* 같은 파일을 또 골라도 걸리게 */
  if (!고른것.length || !cityOpen) return;
  const 그림 = 고른것.filter(f => /^image\//.test(f.type));
  if (!그림.length) return fail('사진 파일만 올릴 수 있어요.', 'cv');
  /* ⚠ 넘치게 고르면 **앞에서부터** 받고 나머지는 말해 줍니다. 통째로
     거절하면 왜 안 되는지 모른 채 다시 고르게 됩니다. */
  const 넣을것 = 그림.slice(0, Math.max(0, 사진최대 - 내사진.length));
  const 빈 = $('cv_jpick'), 원래 = 빈.textContent;
  빈.disabled = true;
  let 올린수 = 0;
  try {
    for (const f of 넣을것){
      빈.textContent = `올리는 중… ${올린수 + 1}/${넣을것.length}`;
      const blob = await fitImage(f, 1280);
      /* 한 번 쓰고 안 쓰는 이름 — 위 머리말 참고 */
      const 이름 = (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2));
      const path = `${ctx.me().id}/${cityOpen.id}/${이름}.jpg`;
      const up = await sb.storage.from('journal-photos')
        .upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      const url = await 사진주소(path);
      if (!url) throw new Error('사진 주소를 못 받았어요.');
      const ins = await sb.from('journal_photos')
        .insert({ user_id: ctx.me().id, city_id: cityOpen.id,
                  path, url, sort: 내사진.length + 올린수 })
        .select('id,url,path,sort').single();
      if (ins.error){
        /* ⚠ 줄을 못 넣었으면 **올린 파일도 도로 지웁니다.** 안 그러면
           아무 데서도 안 보이는 파일이 통에 남아 용량만 먹습니다. */
        await sb.storage.from('journal-photos').remove([path]);
        throw ins.error;
      }
      내사진.push(ins.data);
      올린수++;
      사진그리기();
    }
    if (그림.length > 넣을것.length)
      fail(`사진은 ${사진최대}장까지예요. ${넣을것.length}장만 넣었어요.`, 'cv');
  } catch (err) {
    fail(/relation|does not exist|schema cache/i.test(err.message || '')
      ? '사진 여러 장 저장이 아직 준비되지 않았어요. 만든 사람에게 알려주세요(db/073).'
      : /bucket|not found/i.test(err.message || '')
      ? '사진 저장 공간이 아직 준비되지 않았어요. 만든 사람에게 알려주세요(db/072).'
      : err, 'cv');
  }
  빈.disabled = false;
  사진그리기();
  if (!내사진.length) 빈.textContent = 원래;
});

/* ⚠ 단추가 사진마다 하나라 **위임**으로 받습니다. 그려질 때마다 새로
   붙이면 그린 횟수만큼 쌓여서 한 번 눌러도 여러 번 지웁니다. */
$('cv_jgrid')?.addEventListener('click', async e => {
  const b = e.target.closest('[data-jpdel]'); if (!b) return;
  const id = b.dataset.jpdel;
  const p = 내사진.find(x => x.id === id);
  if (!p) return;
  /* 첫 누름은 «묻는 것»입니다(위 주석). */
  if (!b.classList.contains('ask')){
    사진무장풀기();
    b.classList.add('ask'); b.textContent = '지울까요?';
    return;
  }
  b.disabled = true;
  /* ⚠⚠ **표를 «먼저» 지웁니다(b716).** 전에는 통(파일)을 먼저 지웠는데,
     그러고 표에서 실패하면 **사진은 없어졌는데 줄은 남아** 깨진 그림이
     됩니다. 반대 차례면 최악이 「아무 데서도 안 보이는 파일이 남는 것」
     뿐이라 되돌릴 여지가 있습니다. */
  const d = await sb.from('journal_photos').delete().eq('id', id);
  if (d.error){ b.disabled = false; 사진무장풀기(); return fail(d.error, 'cv'); }
  await sb.storage.from('journal-photos').remove([p.path]);
  내사진 = 내사진.filter(x => x.id !== id);
  사진그리기();
});

$('cv_journal')?.addEventListener('input', 일기바뀜);
$('cv_jsave')?.addEventListener('click', async () => {
  if (!cityOpen) return;
  const v = $('cv_journal').value.trim() || null;
  $('cv_jsave').disabled = true;
  await ctx.saveRate(cityOpen.id, { journal: v }, true);
  /* 한줄평과 **같은 규칙**입니다(위 cv_save 주석) — 일어난 일은 토스트가,
     단추는 쉬는 모양으로. `일기바뀜` 이 잠금·글자·쪽지를 한 번에 맞춥니다. */
  toast(v ? '일기를 저장했어요' : '일기를 지웠어요');
  일기바뀜();
});

/* 일기 쓰기 화면의 ‹ — 뒤로 한 번이면 일기장(일기장은 덱 밖 판이라 closeCity 가 되살립니다) */
$('cv_jback')?.addEventListener('click', () => history.back());
