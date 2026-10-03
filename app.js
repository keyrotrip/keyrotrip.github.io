/* ── 진입점 ────────────────────────────────────────────────────────
 * 층은 이렇게 흐릅니다. 위가 아래에 기대고, 거꾸로는 없습니다(순환 참조 방지).
 *   dom.js · db.js · calc.js · stars.js   ← 아무것도 import 안 하는 잎
 *   net.js · ui.js   (dom.js 만)
 *   admin.js  (dom.js · db.js · net.js)
 *   app.js    ← 여기. 나머지 전부
 */
/* ⚠⚠ **판 번호를 붙입니다(b792, 사용자: 「남극 없는데??」).** ⚠⚠ 여태 이 한 줄만
   `?v=` 가 없어서 sw.js 의 「나머지 파일」 가지(캐시 먼저 · 뒤에서 새로 받기)를 탔고,
   아이폰이 워커를 일찍 멈추면 **남극(b780)·안도라(b788)를 넣기 전 파일**이 폰에
   계속 남았습니다. index.html 의 modulepreload 는 `?v=` 가 붙어 있어 주소가 달라
   미리 받기도 헛돌았습니다. 이제 bump.sh 가 다른 파일과 같이 올립니다. */
import { WORLD_PATHS } from './world.js?v=b826';
import { sb } from './db.js?v=b826';

/* JOIN_URL 은 member.js 로 옮겼습니다(b337) — 쓰는 곳이 거기 한 줄뿐이라
   여기 둘 이유가 없었습니다. 왜 앱 주소가 아닌지도 같이 옮겼습니다. */
import { $, esc, toast, copyText, md, avatarOf, avatarImg, emptyDo,
         putHtml, dropHtml, toTop, coverDeck } from './dom.js?v=b826';
import { starHtml, paintStars, armStarDrag } from './stars.js?v=b826';
import { fail, offNote, cacheGet, cacheSet, netIsDown, netTimeout, isOffline,
         write, flushQueue, drawOffbar, setOnDrained,
         setErrLogger, setReadOnly, NOROW, forgetLocal } from './net.js?v=b826';
import { loadAdmin } from './admin.js?v=b826';
import { markDay } from './dayseen.js?v=b826';
import { googleLogin, oauthLogin } from './glogin.js?v=b826';
/* 취향으로 다음 도시를 고르는 계산. **AI 를 안 씁니다** — 오프라인에서도
   돌아야 하고, 같은 자료에는 늘 같은 답이 나와야 합니다(rec.js 맨 위 참고). */
/* ⚠ **화면은 아직 이걸 하나도 안 씁니다.** `__recCheck` 만 씁니다.
   취향 계산은 재보니 무작위와 별 차이가 없었고(rec.js 맨 위),
   확실한 것만 고르는 `certainPicks` 는 홈에 카드로 붙였다가 뺐습니다(b291) —
   '가보고 싶은 곳' 보관함에 이미 있는 걸 홈에 한 번 더 보여줄 뿐이었습니다.
   계산 자체는 멀쩡하니 남겨둡니다. 쓸 자리가 생기면 여기서 가져다 쓰면 됩니다. */
import { recommend, tasteOf, scoreCity, certainPicks } from './rec.js?v=b826';
import { arm, disarm, syncSheets, setSheetCloser, onSwipeX } from './ui.js?v=b826';
/* 지금 열려 있는 여행. 이름은 **살아 있는 연결**이라 읽는 쪽은 예전 그대로입니다.
   값을 넣는 것은 set* 를 지나가야 합니다 — 여기서 `trip = x` 라고 쓰면
   브라우저가 문법 오류를 내고 앱이 아예 안 뜹니다. 그게 이 분리의 핵심입니다. */
import { trip, plans, legs, members, expenses, bookings, transitLines,
         pickedDay, tab, catFilter, settleOn, todayOn, editPlanId,
         setTrip, clearTrip, setTripCloser,
         setPlans, setLegs, setMembers, setExpenses, setBookings, setTransitLines,
         setPickedDay, setTab, setCatFilter, setSettleOn, setTodayOn,
         setEditPlanId, setPlanSeedGeo, nameOf } from './trip.js?v=b826';
/* 도시 평가. 네 화면이 같이 쓰는 자료라 한 곳이 어긋나면 넷이 같이 어긋납니다. */
import { myRates, cityStat, visited, justRated, avgTail,   /* rateFilter 는 b671 에 뺌 */
         setRateData, setVisited, applyRate, putCityStat,
         clearJustRated, clearRates } from './rate.js?v=b826';
/* 도시 사전과 찾기. 한 번 받으면 안 바뀝니다 — 여행이 바뀌어도 사람이 바뀌어도. */
import { cities, countryName, countryInfo, continentOf,
         useCities, search } from './cities.js?v=b826';   /* addCity 는 b670 에 뺌 */
/* 여행 비서가 방금 내놓은 카드. 화면의 번호가 여기를 찾아가므로 통째로 갈아끼웁니다. */
import { suggested, aiTripId,
         setSuggested, clearSuggested, setAiTripId } from './ai.js?v=b826';
/* 성향 카드 화면. app.js 에서 떼어낸 첫 조각입니다(b321) — persona.js 머리말 참고. */
import { openPersona, closePersona, setPersonaCtx,
         personaBackTo } from './persona.js?v=b826';
import { setShiftCtx, clearPcode } from './pshift.js?v=b826';
/* 세계지도·다녀온 국가. app.js 에서 떼어낸 두 번째 조각입니다(b322) —
   map.js 머리말 참고. UN_COUNTRIES 도 거기서 내보냅니다(두 곳에 적으면
   언젠가 한쪽만 고칩니다). */
import { openMap, closeMap, openCountries, closeCountries,
         shutBigMap, UN_COUNTRIES, setMapCtx } from './map.js?v=b826';
/* 보관함·배지. app.js 에서 떼어낸 세 번째 조각입니다(b323) — shelf.js 머리말 참고. */
import { openShelf, closeShelf, setShelfCtx } from './shelf.js?v=b826';
/* 일기장(b538) — 도시마다 남긴 일기를 한 장씩 넘겨 봅니다. */
import { openDiary, closeDiary, setDiaryCtx, diaryBackTo } from './diary.js?v=b826';
/* 도시 한 곳 화면. app.js 에서 떼어낸 네 번째 조각입니다(b324) — city.js 머리말 참고.
   map.js·shelf.js 도 openCity 를 쓰는데, 이제 ctx 로 넘기지 않고 그쪽이 직접
   import 합니다. 떼어낼수록 얽힘이 줄어드는 자리였습니다. */
import { openCity, closeCity, setCityCtx,
         isCityOpen, clearCityOpen } from './city.js?v=b826';
/* AI 대화 화면의 부품(점 세 개·사진 첨부·출처). 다섯 번째 조각입니다(b326) —
   aiui.js 머리말 참고. AI 덩어리 전체는 여행 상태와 얽혀 있어 못 뗐고,
   얽힘이 적은 앞부분만 가져왔습니다. */
import { showTyping, hideTyping, growMsg, fitJpeg, drawShot, drawSources,
         aiShots, SHOT_MAX, SRC_KO, setAiUiCtx } from './aiui.js?v=b826';
/* 여행 리포트. app.js 에서 떼어낸 여섯 번째 조각입니다(b333) — report.js 머리말 참고.
   이 화면은 끝에서 다른 화면으로 이어져서 ctx 가 깁니다(함수 다섯). */
import { drawReport, renderAiCard, setReportCtx } from './report.js?v=b826';
/* AI 제안 카드. app.js 에서 떼어낸 일곱 번째 조각입니다(b334) — cards.js 머리말 참고.
   LVCOLOR(검토 등급 색)도 거기서 내보냅니다 — 두 곳에 적으면 한쪽만 고칩니다. */
import { drawCards, openPlanForm, runReview,
         LVCOLOR, setCardsCtx } from './cards.js?v=b826';
import { loadExpenses, setExpenseCtx } from './expense.js?v=b826';
import { loadBookings, loadPacking, loadLinks, closeDocs } from './prep.js?v=b826';
import { loadMembers, handleJoin, ROLE_KO, setMemberCtx } from './member.js?v=b826';
import { drawPlanMap, mapLinks, memoMapUrl, splitParts, ensureLeaflet } from './planmap.js?v=b826';
import { loadCities, drawHits, drawPop, pick, picked, resetPick } from './citysearch.js?v=b826';
import { applyTs, setMyAvatar, setMyBio, setMyName, resetMyName, setProfileCtx } from './profile.js?v=b826';
import { loadReview, setReviewCtx } from './review.js?v=b826';
import { loadRateData, loadRatings, drawRatings, saveRate, refreshVisited,
         tripSub, resetRateHtml, setRatingCtx, 평가처음으로, 확정봤음 } from './rating.js?v=b826';
import { loadNotifPrefs, loadNotifs, setNotifyCtx } from './notify.js?v=b826';
/* 팔로우(b789) — 다른 사람 화면과 친구 화면. 둘 다 무엇 위에서든 뜨는
   덮개라 ctx 로 서로를 잇습니다(people ↔ friends 가 직접 import 하면 고리). */
import { openPerson, resetPerson, isPersonOpen, setPeopleCtx } from './people.js?v=b826';
/* 설정 목록 → 항목 화면(b790). 열고 닫을 때 늘 목록부터, ← 는 항목 안이면 목록으로. */
import { resetSetNav, isSetSubOpen, closeSetSub } from './setnav.js?v=b826';
import { openFriends, closeFriends, setFriendsCtx, loadSocialCounts,
         loadSocialPrefs, openByLink, shareProfile } from './friends.js?v=b826';
import { openNew, movePrefs, setNewTripCtx } from './newtrip.js?v=b826';
/* 로그인 전 맛보기 평가(b406) — 화면은 b799 에 걷었습니다(사용자: 「로그인 화면에 이것도
   지워버리자」). 그때 매겨 둔 별점을 계정으로 옮기는 것만 남았습니다(try.js 머리말). */
import { claimTryRates } from './try.js?v=b826';
/* 체크 카드로 들어온 사람(b488). 링크 ?check=eu 가 여기로 떨어집니다. */
/* 궁합 링크(?mate=CODE)를 주소에서 받아 담아둡니다 — mate.js 머리말 참고. */
import { catchMate } from './mate.js?v=b826';
/* 연속 평가 — 넘기며 매기기(b409). 기록 탭에서 들어갑니다. spree.js 머리말 참고. */
import { openSpree, closeSpree, setSpreeCtx, spreeBackTo } from './spree.js?v=b826';
/* 분석 탭(b439) — 성향·지도로 가는 입구. 화면은 anal.js 가 그립니다. */
import { loadAnal, setAnalCtx, 성향칸으로 } from './anal.js?v=b826';
import { loadHome, loadFootprint, heroTint, tripPhoto, closeReview,
         openTripReport, resetHomeSig, setHomeCtx, 기록처음으로 } from './home.js?v=b826';
import { hhmm, osmLookup, setCandsCtx } from './cands.js?v=b826';
import './selfcheck.js?v=b826';
import { guessCat, setBringCtx } from './bring.js?v=b826';
import { loadTrash, TAB_TRASH, setTrashCtx } from './trash.js?v=b826';
import { review, mins, STAY_MIN, loadAi, setPlanCheckCtx } from './plancheck.js?v=b826';
import { openAi, closeAi, loadChats, aiToBottom, setAiScreenCtx } from './aiscreen.js?v=b826';
import { setAccountCtx } from './account.js?v=b826';
import { openDraft, closeDraft, setDraftCtx } from './draft.js?v=b826';
import { loadTrips, tripFilter, setTripFilter, setTripListCtx } from './triplist.js?v=b826';
import { inTrip, showTab, setTabsCtx } from './tabs.js?v=b826';
import { drawPlans, openPlans, setPlanViewCtx } from './planview.js?v=b826';
import { resetGeo, setGeocodeCtx } from './geocode.js?v=b826';
import { loadLegs, legIn, legFor, fillCityList, setLegsCtx } from './legs.js?v=b826';
import { drawDays, loadPlans, backToList, setTripViewCtx } from './tripview.js?v=b826';
import { drawToday } from './today.js?v=b826';
import { openTrip, fetchTrip, drawTripHeader, unwatch, setOpenTripCtx } from './opentrip.js?v=b826';
import { flags, featOn, loadFlags } from './flags.js?v=b826';
import { setSwRegCtx } from './swreg.js?v=b826';
import { drawCats, parseMemo, nice, lineChips, dayStat,
         catsOpen, setCatsOpen, setPlanLineCtx } from './planline.js?v=b826';
import { distKm, travel, hop, settleMath, dateRange, dayLabel, localTime, money,
         legAt, legNear, legFirst, travelMinutes, NO_CENTS, D1, asDate, hm, ymd, todayYmd } from './calc.js?v=b826';

/* persona.js 는 app.js 를 import 하지 않습니다 — 그러면 app → persona → app
   으로 고리가 생깁니다. app.js 만 아는 셋을 여기서 넣어줍니다.
   me 는 로그인할 때마다 바뀌므로 값이 아니라 함수로 줍니다. 값으로 주면
   로그인 전의 null 을 영영 들고 있게 됩니다.
   loadCities·showApp 은 함수 선언이라 여기서 참조해도 됩니다(끌어올려집니다). */
setPersonaCtx({ me: () => me, loadCities, showApp, 성향보기 });
/* ── 성향 보러 가기(b822) ─────────────────────────────────────────────
 * 여는 길은 이것 하나입니다: #openpersona(평가 탭 안내 줄의 data-go · 빠른 평가 · 성향 변화 알림) →
 * persona.js 의 openPersona → 여기. 「내 여행 성향 보기 ›」는 5곳째를 매긴 순간에 뜹니다(rating.js 「확정된 순간」).
 * ⚠ 칸을 «먼저» 고릅니다 — showApp 이 부르는 loadAnal 이 고른 칸(지금칸)을 보입니다. 맨 위로는 탭을 옮긴 «뒤»
 *   (판찾기는 아래 const 라 여기 선언 줄에서가 아니라 «부를 때» 읽습니다 — 앱이 다 뜬 뒤라 괜찮습니다).
 * ⚠ 보러 갔으면 「확정」 단추는 걷습니다 — 평가 탭에 돌아와도 다시 안 뜹니다. */
function 성향보기(){
  확정봤음();
  성향칸으로();
  showApp('anal');
  toTop(판찾기('anal'));
}
/* 연속 평가가 끝나면 기록 목록을 다시 그립니다 — 방금 매긴 것이 빠져야 합니다.
   홈은 지문만 비우고(resetHomeSig) 탭을 옮길 때 알아서 다시 그립니다. */
/* ⚠ **showApp 을 빠뜨리면 「그만」 이 들어온 자리로 안 돌아갑니다(b426).**
   b423 에서 spreeBackTo 를 만들어 놓고 정작 여기서 showApp 을 안 넘겨서
   ctx.showApp?.() 이 undefined 라 **아무 일도 안 했습니다.** 오류도 안 납니다
   — 옵셔널 호출이라 조용히 지나갑니다. 실기기에서 눌러보고 알았습니다. */
/* ⚠ **showApp 을 꼭 넘깁니다.** 안 넘기면 옵셔널 호출이라 오류 없이
   조용히 아무 일도 안 합니다 — b423~b425 에서 세 판을 그렇게 날렸습니다. */
setAnalCtx({ me: () => me, showApp });
setSpreeCtx({ me: () => me, showApp,
              afterSpree: () => { resetRateHtml(); loadRatings(); } });
$('spreego')?.addEventListener('click', () => openSpree());
/* ⚠⚠ **showApp 이 빠져 있었습니다(b322 ~ b784).** ⚠⚠ map.js 의 「나온 자리로」
   (b453)가 `ctx.showApp` 을 부르는데 여기서 안 넘겨 빈 함수가 돌았습니다 —
   기록 탭 → 지구본 「자세히 ›」 → 뒤로 가면 **하단바는 기록인데 화면은 빈
   프로필 칸**(사용자 사진, b785). 이제 tools/ctx.pl 이 이런 것을 잡습니다. */
setMapCtx({ me: () => me, loadCities, showApp });
/* ⚠ 전에는 여기 `todayYmd: () => todayYmd()` 처럼 화살표로 감싼 줄이 있었습니다.
   `const` 화살표는 끌어올려지지 않아서 이 줄에서는 아직 없었기 때문입니다
   (Cannot access 'todayYmd' before initialization — 앱이 통째로 안 떴습니다).
   b335 에서 `ymd`·`todayYmd` 를 calc.js 로 내리면서 그 걱정이 사라졌습니다 —
   import 는 끌어올려지고, 쓰는 쪽이 직접 가져오니 ctx 에서 아예 빠집니다. */
setShelfCtx({ me: () => me, loadFootprint, openTrip, appTab: () => appTab });
setDiaryCtx({ me: () => me, loadCities, openCity, showApp });
$('opendiary')?.addEventListener('click', () => openDiary());
/* ⚠ 보관함의 「일기」 타일(b757). 여태는 home.js 가 통을 기록 탭으로
   옮길 때 거기서 달았는데, 통이 프로필에 눌러앉았으므로 여기서 한 번만
   답니다 — 홈을 다시 그려도 다시 달리지 않습니다.
   ⚠ 여는 절차는 위 `#opendiary` 하나뿐입니다. 두 벌로 적지 마십시오.
   ⚠ 「어디서 왔나」를 안 적습니다 — 프로필에서 열었으므로 닫으면
     diary.js 가 기본값대로 프로필로 돌려보냅니다. */
$('diaryrow')?.addEventListener('click', () => $('opendiary')?.click());
setCityCtx({ me: () => me, saveRate, drawRatings, openTrip,
             loadHome, appTab: () => appTab, openPerson,
             loadRateData });   /* 내 별점을 아직 안 받았으면 도시가 먼저 받습니다(b797) */
setAiUiCtx({ me: () => me, aiToBottom, loadChats, drawCards });
setReportCtx({ me: () => me, openAi, openDraft, openNew, closeReview, loadChats });
setCardsCtx({ closeAi, loadPlans, review });          /* me 는 안 씁니다(b490) */
/* 지출은 app.js 에서 둘만 알면 됩니다 — 누가 로그인했나, 일정을 다시 그려라.
   (지출이 일정 줄에 금액으로 붙어서 지출을 고치면 일정도 다시 그려야 합니다.) */
setExpenseCtx({ me: () => me, drawPlans });
setMemberCtx({ me: () => me, loadTrips, openTrip, openPerson });
setProfileCtx({ me: () => me });
setReviewCtx({ me: () => me });
setRatingCtx({ me: () => me, fillCityList, showApp });
setNotifyCtx({ me: () => me, openPerson, openFriends });
/* ⚠ 팔로우 두 화면(b789). **넷 다 넣습니다** — 빠지면 단추가 오류 없이
   아무 일도 안 합니다([[ctx-injection-trap]]). tools/ctx.pl 이 봅니다. */
setPeopleCtx({ me: () => me, openFriends, onFollowChange: loadSocialCounts });
setFriendsCtx({ me: () => me, openPerson });
$('friendrow')?.addEventListener('click', () => openFriends('feed'));
/* 프로필 머리의 단추 둘(b791, 왓챠처럼). 「프로필 수정」은 profile.js 가 직접 답니다. */
$('shareprof')?.addEventListener('click', () => shareProfile());
$('findfriend')?.addEventListener('click', () => openFriends('feed', { 찾기: true }));
setAiScreenCtx({ me: () => me });
setAccountCtx({ me: () => me, logError });
setDraftCtx({ me: () => me, fillCityList, showApp, openTrip });
setTripListCtx({ me: () => me, openTrip, logError });
setTabsCtx({ appTab: () => appTab, showApp });
setPlanLineCtx({ drawDays, drawPlans });
setPlanViewCtx({ loadPlans });
/* 빈 일정 화면의 「AI 로 하루씩 짜기」. 보이지 않는 단추를 `data-go` 가
   대신 누릅니다(planview.js 의 emptyDo). 초안을 아는 곳이 여기라 여기서 잇습니다. */
$('draftbtn')?.addEventListener('click', () => { if (trip?.id) openDraft(trip.id, true); });
setGeocodeCtx({ drawDays, loadPlans });
setLegsCtx({ drawDays, drawTripHeader, fetchTrip });
setTripViewCtx({ appTab: () => appTab, showApp, openTrip, drawToday });
setOpenTripCtx({ me: () => me, appTab: () => appTab });
setSwRegCtx({ logError });
setNewTripCtx({ me: () => me, loadTrips, openTrip, openDraft });
/* spreeBackTo 는 spree.js 것입니다. home 이 직접 import 하면 고리가
   생기므로 여기서 넣어 줍니다(spree.js 의 「들어온 자리로」 참고). */
/* ⚠ `openTrip` 을 **다시 넣습니다(b631).** b490 에 「읽는 곳이 0」이라
     걷었던 것인데, 오늘의 인사 줄을 누르면 그 여행이 열려야 합니다.
     ⚠ 안 넣으면 기본값(빈 함수)이 조용히 돌아 **아무 일도 안 납니다** —
       오류도 안 납니다. [[ctx-injection-trap]] 그 자체입니다. */
setHomeCtx({ me: () => me, showApp, spreeBackTo, openTrip });
/* 성향 변화 알림(b526). 여는 절차는 홈의 「지도 열기」와 같은 수법입니다 —
   리포트는 프로필 위에 얹히는 판이라 프로필을 거쳐야 하고, 「홈에서 왔다」를
   적어두어야 닫을 때 홈으로 돌아옵니다. */
setShiftCtx({ me: () => me, 열기: () => {
  personaBackTo('home');
  showApp('set', 'home');
  $('openpersona')?.click();
} });


/* ── 별을 끌어서 매기기(b491) ─────────────────────────────────────────
 * 문서 하나에 **한 번만** 답니다. 화면마다 달면 한 번 끌 때 여러 번
 * 매겨집니다 — 별은 여섯 화면에 나오고 전부 같은 markup 입니다.
 * ⚠ **로그인 화면에서도 돌아야 합니다.** 맛보기 평가(try.js)가 거기
 *   있습니다. 그래서 render 안이 아니라 여기(모듈 최상단)입니다.
 * 뗄 때 그 자리에 «누른 것»을 만들어 보내므로 여섯 화면의 기존 처리는
 * 하나도 안 바뀝니다 — stars.js 머리말 참고. */
armStarDrag();
setCandsCtx({ loadPlans, openAi, loadChats });
/* ⚠ loadPlans 를 **다시** 넘깁니다(b784). b490 에는 안 썼지만, 표로 넣기
   (sheetimp.js)는 넣자마자·위치를 찍은 뒤 일정을 다시 그려야 합니다.
   안 넘기면 기본값(빈 함수)이 조용히 돌아 화면이 안 바뀝니다 — ctx 주입 덫. */
setBringCtx({ openAi, loadChats, loadPlans });
setTrashCtx({ loadPlans });
setPlanCheckCtx({ loadChats });

/* 지도 좌표를 제자리에 넣습니다. 쓰는 쪽(핀 · 발자국 미니지도)보다 먼저여야 합니다.
   **이 줄은 진입점에 있어야 합니다** — 모듈이 아니라 화면에 쓰는 일이고,
   world.js 를 쓰는 곳이 여기뿐입니다. */
document.getElementById('worldland').innerHTML = WORLD_PATHS;

const t0 = performance.now();
/* **여행 하나에 딸린 것은 여기 없습니다** — trip.js 가 지킵니다(맨 위 import).
   읽기는 예전과 똑같이 `trip.id`·`plans.length` 로 씁니다(살아 있는 연결).
   값을 넣을 때만 `setPlans(...)` 처럼 문을 지나갑니다.
   아래 남은 것은 **여행과 상관없이 앱 전체가 쓰는 것**들입니다 —
   로그인한 사람, 도시 목록, 어느 앱 탭인지, 평가 화면 상태. */
let me = null,
    /* picked · hitList · cursor 는 citysearch.js 로 옮겼습니다(b339) —
       pick() 이 그리로 가면서 여기 남길 이유가 없어졌습니다. */

    appTab = 'home';

/* 기기에 저장해 둔 글자 크기를 그리기 전에 먼저 씌웁니다 — 안 그러면 한 번 깜빡입니다. */
{
  const v = localStorage.getItem('t2:ts');
  if (v) document.documentElement.style.setProperty('--ts', v);
}

/* lastHtml · putHtml · dropHtml 은 dom.js 로 내렸습니다(b351, 맨 위 import).
   $ 하나만 쓰는 것이라 거기가 맞고, 네 화면이 쓰므로 app.js 에 두면
   떼어낸 조각마다 ctx 가 두 줄씩 늘어납니다. */

/* 자체 점검 표시(`mark`)와 그것을 채우던 질의 셋을 걷었습니다 (b278).
   "부르는 곳이 여러 군데라 함수는 남겨둔다"고 적혀 있었는데 **세어보니
   부르는 곳은 자체 점검 하나뿐이었고**, 값을 쓰는 자리(`#d0`·`#v0`)는
   어느 파일에도 없었습니다. 즉 `mark` 는 늘 첫 줄에서 되돌아왔고
   **점검 결과는 아무도 못 보는 채로 버려지고 있었습니다.**
   그런데도 부팅마다 countries · cities · transit_grades 개수를 세러
   서버에 세 번 다녀왔습니다.
   다시 필요하면 **관리자 대시보드에 자리를 만들고** 거기서 부르십시오 —
   보는 자리 없이 되살리면 같은 일이 반복됩니다. */

/* 여기까지 왔으면 화면 코드가 살아 있다는 뜻입니다.
   index.html 의 "화면을 못 불러왔어요" 상자를 걷습니다. */
window.__t2booted = true;
document.getElementById('bootfail')?.remove();

/* 오프라인 큐가 다 나간 뒤에 무엇을 다시 받아올지는 여기가 압니다.
   net.js 는 trip 도 loadPlans 도 몰라야 하므로 넣어줍니다. */
setOnDrained(async () => {
  /* 일정 탭에 서 있을 때만 갱신합니다. 전에는 `#listview` 가 안 숨었나로
     봤는데, 덱에서는 다섯이 늘 보이므로 **탭 이름**으로 물어야 합니다(b474). */
  if (trip && appTab === 'trips') await loadPlans();
});

/* fail() 이 서버 오류를 한국어로 바꿔 보여주고 **원문은 여기로** 보냅니다.
   원문이 필요한 것은 사용자가 아니라 고치는 사람입니다. */
setErrLogger((msg, src) => logError(msg, src));

/* ui.js 의 시트는 AI 시트 닫는 법을 모릅니다(뒤로가기 기록을 같이 다룹니다).
   넣어줍니다. closeAi 는 function 선언이라 아래에 있어도 여기서 잡힙니다. */
setSheetCloser(() => closeAi());

/* trip.js 는 실시간 구독을 모릅니다(서버를 모르는 파일입니다). 넣어줍니다 —
   이제 여행을 닫을 때 구독 끊는 것을 따로 기억할 필요가 없습니다.
   전에는 네 곳에서 `unwatch(); trip = null;` 을 각자 적고 있었습니다. */
/* 여행을 닫을 때 딸려 닫혀야 하는 것들. **여기 한 곳에 모읍니다** —
   여행을 닫는 길이 넷이었고 이미 서로 달랐던 것이 trip.js 를 만든 이유입니다.
   서류는 여행 위를 덮는 판이라, 안 닫으면 여행을 나갔는데 앞 여행의
   예약번호가 화면에 남습니다. */
setTripCloser(() => { unwatch(); $('docview').classList.add('hide'); });


/* ── 서비스 워커 ──────────────────────────────────────────────────────
 * 등록과 새 판 확인은 swreg.js 로 옮겼습니다(b361, 서른일곱 번째 조각).
 * ctx 는 하나(logError)이고 내보내는 것이 없습니다 — 스스로 등록하고
 * 스스로 지켜봅니다. */
/* ── 오류 남기기 ────────────────────────────────────────────────────
 * 남이 쓰기 시작하면 "안 돼요" 한 마디만 오고 무엇이 터졌는지 알 길이 없습니다.
 * 화면에서 터진 것을 조용히 남겨둡니다.
 *
 * 남기는 것: 메시지 · 어느 파일 몇 줄 · 스택 앞부분 · 빌드 번호 · 브라우저.
 * 안 남기는 것: 일정 · 지출 · 대화 내용. 오류를 고치는 데 필요 없습니다.
 *
 * 조심할 것 둘:
 *   1. 로그인 전에는 못 보냅니다(RLS 가 user_id = auth.uid() 를 요구). 그냥 넘어갑니다.
 *   2. 오류 하나가 무한히 반복될 수 있습니다 — 같은 메시지는 한 번만,
 *      한 번 켤 때 최대 다섯 개까지만 보냅니다. 안 그러면 오류가 오류를 부릅니다. */
const errSeen = new Set();
let errSent = 0;
async function logError(message, source, stack){
  if (!me?.id || errSent >= 5) return;
  const key = String(message).slice(0, 120);
  if (errSeen.has(key)) return;
  errSeen.add(key); errSent++;
  try {
    await sb.from('client_errors').insert({
      user_id: me.id,
      build: $('build')?.textContent || '',
      message: String(message).slice(0, 500),
      source: String(source || '').slice(0, 300),
      stack: String(stack || '').slice(0, 2000),
      ua: navigator.userAgent.slice(0, 300),
    });
  } catch {}   /* 오류를 남기다 터지면 그건 그냥 놓아줍니다 */
}
addEventListener('error', e => {
  /* 이미지가 안 불러와진 것도 여기로 옵니다. 그건 오류가 아니라 흔한 일입니다. */
  if (e.target && e.target !== window) return;
  logError(e.message, `${e.filename}:${e.lineno}:${e.colno}`, e.error?.stack);
});
addEventListener('unhandledrejection', e => {
  const r = e.reason;
  logError(r?.message || String(r), 'promise', r?.stack);
});

/* ── 알림 설정 ────────────────────────────────────────────────────────
 * 알림 설정과 잠금화면 알림(Web Push)은 notify.js 로 옮겼습니다
 * (b342, 열여섯 번째 조각). ctx 는 둘(me · loadNotifs)입니다.
 * **그 둘 사이에 있던 '만든 사람이 켜고 끄는 것들'과 '알림을 눌렀을 때'는
 * 여기 남깁니다** — 앞은 앱 껍데기고 뒤는 여행 화면을 부릅니다. */
/* ── 만든 사람이 켜고 끄는 것들 ───────────────────────────────────────
 * flags.js 로 옮겼습니다(b360, 서른여섯 번째 조각). 딸린 것이 없습니다.
 * planview.js 와 geocode.js 가 ctx 로 받던 featOn·flags 를 이제 직접
 * import 합니다 — 그쪽 ctx 가 각각 둘씩 줄었습니다. */
/* ── 알림을 눌렀을 때 ───────────────────────────────────────────────
 * 알림에 `./?t=<여행>&d=<날짜>` 를 실어 보냅니다(065). 오는 길이 둘입니다.
 *   · 앱이 꺼져 있었다 → 그 주소로 새로 열립니다. 부팅 뒤에 읽습니다
 *   · 앱이 켜져 있었다 → 서비스워커가 postMessage 로 일러줍니다.
 *     **새로 불러오지 않습니다** — 보던 것이 날아가면 안 됩니다
 *
 * **주소는 읽고 나서 지웁니다.** 안 지우면 새로고침할 때마다 같은 여행이
 * 다시 열리고, 뒤로가기가 이상해집니다. */
async function openFromUrl(href){
  let u; try { u = new URL(href, location.href); } catch { return; }
  const t = u.searchParams.get('t'), d = u.searchParams.get('d');
  if (!t) return;
  history.replaceState(history.state, '', location.pathname);
  await openTrip(t);
  /* 그 날만 보여줍니다 — 열흘짜리 여행에서 오늘을 다시 찾게 하면
     알림으로 데려온 뜻이 없습니다. */
  if (d && (plans || []).some(p => p.date === d)){
    setPickedDay(d);
    drawDays(); drawCats(); drawPlans(); drawPlanMap();
  }
}
navigator.serviceWorker?.addEventListener('message', e => {
  if (e.data?.t2 === 'open') openFromUrl(e.data.url);
});

/* ── 내 계정 ──────────────────────────────────────────────────────────
 * 탈퇴 · 버그 신고 · 내 자료 내려받기는 account.js 로 옮겼습니다
 * (b349, 스물다섯 번째 조각). ctx 는 둘(me · logError)이고 **내보내는 것이
 * 없습니다** — 셋 다 자기 단추에 자기가 붙습니다. */
/* ── 로그인 ─────────────────────────────────────────────────────── */
/* ⚠⚠ **b816: 구글에서 바로 로그인 표를 받는 길로 바꿨습니다(glogin.js · login.html).** ⚠⚠
   옛 길(Supabase OAuth)은 구글 화면에 「qahqq….supabase.co(으)로 이동」을 띄웠습니다(사용자: 「피싱사이트 같은데」).
   새 길은 앱 주소를 띄웁니다. 시험 페이지(gsitest.html)로 PC·아이폰 홈 화면 앱에서 재 보고 사용자가 고른 것.
   기기에 잠깐 적을 수가 없으면(googleLogin 이 던짐) 옛 길로 갑니다 — 로그인이 막히면 안 됩니다.
   아래 주석 둘(이메일만 · 늘 계정 고르기)은 새 길에도 그대로입니다(glogin.js 가 같은 값을 씁니다). */
$('login').addEventListener('click', async () => {
  $('login').disabled = true;
  try { await googleLogin(); return; }
  catch (e){ console.warn('@glogin', e); }
  /* 여기부터 옛 길. 돌아올 주소를 명시합니다. Supabase 의 Redirect URLs 에 이 주소가
     등록돼 있어야 하고, 없으면 Site URL 로 튕겨 엉뚱한 데로 갑니다. */
  /* **이메일만 받습니다.**
     범위를 안 적으면 구글에 profile 까지 달라고 해서 이름과 프로필 사진이 딸려 옵니다.
     그건 기본값이라 그랬을 뿐, 우리가 필요해서 요청한 게 아니었습니다.
     이름은 본인이 정하고 사진도 본인이 올립니다 — 둘 다 앱 안에 이미 있습니다.
     안 쓰는 남의 정보를 갖고 있을 이유가 없습니다. */
  /* ⚠ **어느 계정으로 들어갈지 늘 물어봅니다.**
     안 적으면 구글은 브라우저에 로그인된 계정이 하나일 때 **묻지 않고**
     그걸로 들어갑니다. 그래서 우리 앱에서 로그아웃하고 다시 눌러도
     방금 나온 그 계정으로 되돌아왔습니다 — 우리 로그아웃은 우리 세션만
     끊고 구글 세션은 그대로라, 사용자 눈에는 로그아웃이 안 된 것처럼
     보입니다. 계정이 둘 이상인 사람에게는 원래 물어봐서, 계정 하나로
     시험하면 이 문제가 안 보입니다.
     `select_account` 는 계정만 다시 고르게 합니다 — `consent` 와 달리
     권한 동의 화면을 매번 띄우지 않습니다. */
  const { error } = await oauthLogin();
  if (error){ $('login').disabled = false; fail(error); }
});
/* 구글 화면에서 「뒤로」로 돌아오면 브라우저가 떠나기 전 화면을 그대로 되살립니다(bfcache) — 단추가 꺼진 채로.
   그러면 다시 누를 수가 없습니다. 되살아난 화면이면 단추를 켭니다. */
addEventListener('pageshow', e => { if (e.persisted) $('login').disabled = false; });

/* 가입을 막아뒀으면 **로그인 화면에서 미리 알려줍니다.** 진짜 관문은 서버
   트리거지만(db/066), 거기까지 갔다 오면 구글을 한 바퀴 돌고 나서
   "알 수 없는 오류"만 봅니다. 이미 쓰던 사람은 그대로 들어옵니다 —
   막히는 것은 **새로 만들어지는 계정**뿐이라 단추는 안 감춥니다. */
loadFlags().then(() => {
  if (flags.signup === false && $('signedout') && !$('signedout').classList.contains('hide')){
    const p = document.createElement('p');
    p.className = 'memo';
    p.style.cssText = 'text-align:center; margin-top:12px';
    p.textContent = '지금은 새로 가입할 수 없어요. 이미 쓰시던 분은 그대로 들어오실 수 있어요.';
    $('login').after(p);
  }
});

$('logout').addEventListener('click', async () => {
  /* **잠금화면 알림부터 뗍니다.** 안 떼면 이 기기는 계속 이 사람의 일정을
     알립니다 — 같은 기기를 다음 사람이 써도요. 로그아웃한 계정의 일정이
     남의 잠금화면에 뜨면 그건 자료가 새는 것입니다.
     로그아웃 뒤에는 RLS 때문에 표에서 지울 수가 없으니 **먼저** 합니다. */
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    if (sub){
      await sb.from('push_subs').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {}
  /* ⚠⚠ **이 기기에 남은 내 자료도 지웁니다(b716, b698 점검 아홉째).**
     못 보낸 저장 대기줄(`t2:queue`)이 그대로 남아 다음 사람에게 흘러갔습니다.
     자세한 사연은 net.js 의 `forgetLocal` 주석에 있습니다. */
  forgetLocal();
  await sb.auth.signOut();
  location.replace(location.pathname);      /* 주소에 붙은 토큰 조각을 지웁니다 */
});

/* ── 도시 검색 ──────────────────────────────────────────────────── */
/* 도시 검색·'많이 가는 곳'·도시 자료 받아오기는 citysearch.js 로 옮겼습니다
   (b339, 열두 번째 조각). **딸린 것이 없어 ctx 가 없습니다.**
   flagOf 는 그 김에 dom.js 로 내렸습니다 — map.js 가 같은 계산을 인라인으로
   한 번 더 갖고 있었습니다. */
/* ── 여행 만들기 ──────────────────────────────────────────────────────
 * 네 단계 마법사(어디로 · 언제 · 취향 · 이름)와 달력은 newtrip.js 로
 * 옮겼습니다(b343, 열일곱 번째 조각). ctx 는 넷입니다 —
 * me · loadTrips · openTrip · openDraft. 뒤의 셋은 **다 만든 다음에**
 * 가는 곳이라 그 조각이 알 필요가 없는 것들입니다. */
/* ── 여행 목록 ──────────────────────────────────────────────────── */
/* ── 앱 하단바 ─────────────────────────────────────────────────────
 * 여행 안에서는 일정/지출/일행 탭바가, 밖에서는 이 바가 나옵니다.
 * 로그아웃과 보관함이 목록 위에 얹혀 있던 것을 여기로 내렸습니다. */
/* ⚠ 두 번째 인자 `표시탭`(b458). 지도·성향은 **프로필 화면 안에 얹히는
     판**이라 열려면 setview 를 켜야 합니다. 그런데 분석·홈에서 열었는데도
     **하단바가 프로필로 넘어갔습니다** — 「분석에서 자세히 보기」를 눌렀는데
     내가 프로필에 온 것처럼 보입니다.
     화면은 setview 를 켜되 **하단바 표시만** 왔던 탭에 남깁니다.
     appTab 은 그대로 t 입니다 — 여러 곳이 「지금 어느 화면인가」로 읽으므로
     거짓말을 시키면 안 됩니다. 하단바는 보이는 것만 맞추면 됩니다. */
/* ── 탭이 바뀔 때 새 화면이 밀려 들어옵니다(b470) ─────────────────────
 * ⚠ **b469 에 「손가락을 따라 끌리게」를 넣었다가 되돌렸습니다.** 두 화면을
 *   `position:fixed` 로 겹쳐 매 프레임 옮겼더니, 실기기에서 두 화면이
 *   동시에 보이고 심하게 버벅였습니다. 탭 화면은 프로필의 여행 목록처럼
 *   무거운 것이 있어서 매 프레임 옮길 만한 것이 아니고, 끌기가 끝나기
 *   전에 다음 쓸기가 시작되면 뒷정리끼리 서로를 덮어썼습니다.
 * ⚠ 여기서는 **끝난 뒤 한 번만** 애니메이션합니다. 손가락을 따라오지는
 *   않지만 「뚝 끊김」은 사라지고, 겹칠 상태가 아예 없습니다.
 *   새 화면 하나에 클래스만 붙였다 떼므로 되돌릴 것도 없습니다. */
let 지난탭 = null;
const 탭순서 = () => [...document.querySelectorAll('#appbar button[data-a]')]
  .map(b => b.dataset.a);
/* ── 탭 화면의 높이를 잽니다(b471) ────────────────────────────────────
 * `.tabpane` 은 `100dvh - 위 - 아래` 로 높이를 잡는데, **위**를 CSS 로는
 * 못 씁니다 — 상단바가 안전영역만큼 위로 확장돼 있고(음수 마진), 오프라인
 * 띠나 공지 띠가 뜨면 그만큼 더 내려옵니다.
 * 그래서 **보이는 탭 화면의 실제 시작 y** 를 재서 변수에 넣습니다.
 * ⚠ 재기 전에 문서 스크롤을 더합니다 — 문서가 조금이라도 굴러가 있으면
 *   `getBoundingClientRect().top` 이 그만큼 작게 나옵니다.
 * ⚠ 화면 회전·키보드·주소창 접힘마다 다시 잽니다. iOS 는 주소창이 접힐 때
 *   `resize` 대신 `visualViewport` 만 움직이는 경우가 있습니다. */
function 덱높이맞추기(){
  /* ⚠ **덱이 숨어 있으면 재지 않습니다(b474).** 여행·도시 화면을 열면 덱이
     통째로 사라지는데, 그때 재면 0 이 나와 화면이 통째로 길어집니다.
     전에 쓰던 값을 그대로 두는 편이 낫습니다. */
  /* ⚠⚠ **여행 안에서는 «여행 화면»의 위를 잽니다(b759).** ⚠⚠
     b759 부터 상단바는 **탭에서 사라지고 여행 안에서만** 나옵니다
     (app.css 의 `body:not(.intrip) .topbar`). 그래서 탭의 위와 여행의
     위가 **다른 값**입니다 — 전에는 상단바가 늘 있어서 같았습니다.
     덱이 숨어 있다고 그냥 두면 여행 화면이 상단바 높이만큼 길어져서
     아래가 탭바에 깔립니다.
   ⚠ 도시·지도·일기처럼 «덮는 판»도 덱을 숨기지만 그것들은 상단바가
     없는 탭 쪽 값이 맞습니다 — 그래서 여행 화면이 «보일 때»만 갈아탑니다.
     안 보이면 예전처럼 옛 값을 그대로 둡니다(b474). */
  const 여행중 = 덱.classList.contains("hide");
  const el = 여행중
    ? ($('tripview')?.classList.contains('hide') ? null : $('tripview'))
    : 덱.children[0];
  if (!el) return;
  /* ⚠⚠ **0 도 제대로 된 값입니다(b764).** ⚠⚠ 여태는 `if (!위) return` 이라
     0 이 나오면 「아직 안 붙었다」로 보고 옛 값을 그대로 뒀습니다. 그런데
     b764 부터 기록 탭의 덱은 **화면 맨 위(0)에서 시작합니다** — 그러면
     `--deck-top` 이 영영 옛 값(61 따위)에 머물러 화면이 그만큼 길어지고
     아래가 탭바에 깔립니다.
   ⚠ 「아직 안 붙었나」는 **크기**로 봅니다. 안 붙은 요소는 폭도 높이도
     0 입니다 — 자리가 0 인 것과 다릅니다. */
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return;
  const 위 = Math.max(0, Math.round(r.top + window.scrollY));
  document.documentElement.style.setProperty('--deck-top', 위 + 'px');
}
addEventListener('resize', 덱높이맞추기);
addEventListener('orientationchange', () => setTimeout(덱높이맞추기, 120));
/* 여행에 들고 날 때(tabs.js 의 `inTrip`). 상단바가 여행 안에서만 나오므로
   그때마다 화면이 시작하는 y 가 달라집니다 — 위 ⚠⚠ 참고. */
addEventListener('t2:remeasure', 덱높이맞추기);
visualViewport?.addEventListener('resize', 덱높이맞추기);
/* ⚠ **다시 재는 때를 넓힙니다(b567).** 앱을 뒤로 보냈다 돌아오거나 주소창이
   접히면 `resize` 가 안 오는 경우가 있습니다 — 그때 옛 값이 남아 화면
   높이가 어긋납니다. 값이 같으면 아무 일도 안 하므로 자주 불러도 쌉니다. */
addEventListener('pageshow', () => setTimeout(덱높이맞추기, 60));
addEventListener('focus', () => setTimeout(덱높이맞추기, 60));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') setTimeout(덱높이맞추기, 60);
});
/* ── 돌아오면 종·친구 요청 점을 다시 셉니다(b797, SNS 점검에서 찾음) ─────────
 * 앱을 켜 둔 채 다른 앱에 갔다 오면(아이폰 홈 화면 앱은 대개 이렇게 삽니다) 그사이 온 팔로우
 * 요청·알림이 **탭을 바꾸기 전까지** 안 떴습니다 — 세는 곳이 프로필 탭 열기(showApp 'set')뿐이었습니다.
 * ⚠ 세기만 합니다(읽음 처리는 종을 눌러 열 때 — b760 과 같음). 30초에 한 번까지만 —
 *   켜고 끄기를 빨리 되풀이해도 질의가 쌓이지 않게. */
let 돌아와셈 = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !me) return;
  if (Date.now() - 돌아와셈 < 30e3) return;
  돌아와셈 = Date.now();
  loadNotifs(); loadSocialCounts();
});
/* 글꼴이 늦게 오면 상단바 높이가 한 번 더 바뀝니다. 두 번 더 재둡니다. */
setTimeout(덱높이맞추기, 400);
setTimeout(덱높이맞추기, 1200);

/* ── 문서 자체는 굴러가면 안 됩니다 (b567 → b575 에서 «방법»을 바꿈) ────
 * 상단바·하단바는 `fixed` 이고 본문은 «안쪽 스크롤러»라, 문서가 조금이라도
 * 굴러가면 본문만 위로 밀려 바 밑으로 들어갑니다.
 *
 * ⚠⚠ **b567 은 이것을 «스크롤이 올 때마다 0 으로 되돌리기»로 막았습니다.
 *   그게 화면이 덜덜거린 원인입니다.** ⚠⚠
 *   사용자 지적: 「위아래 스크롤할 때 부드럽지 않고 덜덜덜거리면서 화면이
 *   제대로 스크롤이 안 되네」. 당연합니다 — 손가락이 미는 중에 우리가 매
 *   스크롤마다 `scrollTo(0,0)` 을 부르면 **손과 코드가 서로 잡아당깁니다.**
 *   게다가 b567 커밋에 제 손으로 「제 노트북에서는 재현이 안 됩니다 —
 *   가장 그럴듯한 원인을 막은 것이지 실측으로 잡은 게 아닙니다」라고 적어
 *   놓고 그대로 뒀습니다. **재현 못 한 방어는 새 병을 만듭니다.**
 *
 * · 게다가 b568 에서 여행 머리를 스크롤러 «안»으로 넣어서, 원래 막으려던
 *   증상 자체가 사라졌습니다. 남은 것은 부작용뿐이었습니다.
 * · 이제는 **틀을 튕기지 않게 하는 것**(CSS `overscroll-behavior`)으로 막고,
 *   스크롤이 도는 동안에는 아무 일도 안 합니다.
 * ⚠ `scrollRestoration` 만 남깁니다 — 뒤로가기로 돌아올 때 브라우저가 옛
 *   스크롤 자리를 되살리는 것을 막습니다. 이건 한 번만 하는 설정이라
 *   스크롤 중에 아무 값도 안 씁니다. */
try { history.scrollRestoration = 'manual'; } catch {}

/* 탭 이름 → 화면 id. **한 곳에서만 적습니다** — 두 벌로 두면
   언젠가 한쪽만 고칩니다(b472). */
const 탭화면 = { home:'homeview', rate:'rateview', anal:'analview',
                 trips:'listview', set:'setview' };
const 판찾기 = t => $(탭화면[t]);

/* ══ 탭 덱 ══════════════════════════════════════════════════════════════
 * **탭 다섯을 가로로 나란히 놓고 브라우저에게 넘기기를 맡깁니다(b474).**
 *
 * b469 에서 자바스크립트로 「손가락 따라 끌기」를 만들었다가 되돌렸습니다.
 * 「지금 어디까지 끌렸나」를 변수로 들고 있으면 그 사이에 무슨 일이든
 * 끼어들 수 있었습니다 — 관성이 남은 채 자리를 옮기거나, 뒷정리끼리
 * 엇갈려 두 화면이 겹쳐 보였습니다.
 * **스크롤 위치에는 그런 틈이 없습니다.** 관성도 스냅도 브라우저 몫입니다.
 *
 * ⚠ **덱 순서는 하단바 순서에서 읽습니다.** 여기 또 적으면 스와이프 방향과
 *   하단바가 언젠가 반대로 움직입니다.
 * ⚠ 다섯은 이제 **늘 붙어 있습니다**(hide 를 안 씁니다). 덱 안에서 한 칸이
 *   `display:none` 이 되면 그 뒤 칸들의 가로 위치가 통째로 밀립니다.
 *   탭 밖 화면(여행·도시·초안…)을 열 때는 **덱을 통째로** 숨깁니다. */
const 덱 = document.createElement('div');
덱.id = 'tabdeck';
{
  const 첫 = 판찾기(탭순서()[0]) || $('homeview');
  첫.parentNode.insertBefore(덱, 첫);
  탭순서().forEach(t => {
    const el = 판찾기(t);
    if (!el) return;
    el.classList.remove('hide');
    덱.appendChild(el);
  });
}

/* ── 덮는 판을 덱 밖으로(b481) ───────────────────────────────────────
 * 지도·성향·보관함·설정·대시보드는 `#setview` **안**에 있었습니다. 그러면
 * 프로필 칸이 통째로 무거워지고, 지도를 보다가 옆으로 밀리면 탭이
 * 넘어가 버립니다 — 지도는 손가락으로 끌어 옮기는 화면이라 그런 일이
 * 자주 납니다.
 * 덱 밖 형제로 꺼내고 `.tabpane` 을 붙입니다 — 높이·스크롤·아래 여백을
 * 탭 화면과 **같은 규칙**으로 받습니다. `#tabdeck > .tabpane` 만 가로
 * 칸이 되므로 밖에서는 그냥 한 화면입니다.
 * ⚠ 여는 쪽에서 `coverDeck(true)` 로 덱을 숨깁니다(dom.js). */
for (const id of ['personapane', 'shelfpane', 'mappane', 'ctrypane', 'diarypane',
                  'setpane', 'notifpane', 'admpane', 'p16pane', 'editpane']){
  const el = $(id);
  if (!el) continue;
  el.classList.add('tabpane');
  $('signedin').appendChild(el);
}

/* 덱에서 지금 몇 번째 칸인가. 폭이 0 일 때(화면이 숨어 있을 때) 나눗셈이
   NaN 이 되지 않게 1 로 막습니다. */
const 칸폭 = () => 덱.clientWidth || 1;
const 지금칸 = () => Math.round(덱.scrollLeft / 칸폭());

/* ⚠ **덱을 옮기는 것과 「탭이 바뀌었다」를 알리는 것은 다른 일입니다.**
 *   하단바를 누르면 여기서 옮기고, 손가락으로 밀면 브라우저가 옮깁니다.
 *   어느 쪽이든 **멎은 뒤에** 아래 `닿았다` 가 한 번 정리합니다. */
/* ⚠⚠ **옮기는 동안에는 판정을 잠급니다(b476).** ⚠⚠
   하단바에서 홈 → 평가를 누르면 하단바가 「평가 → 홈 → 평가」로 두 번
   깜빡였습니다. 덱이 **부드럽게** 지나가는 동안 중간 칸이 60% 넘게 보이는
   순간이 있고, 그때 판정이 끼어들어 `showApp("home")` 을 부른 것입니다.
   목적지는 이미 정해져 있으니 도착할 때까지 아무 말도 듣지 않습니다. */
let 덱잠금 = false, 덱잠금타이머 = 0;
/* ── 하단바로 옮길 때 «밀려 들어오기»(b782) ─────────────────────────────
 * ⚠⚠ **b781 에 생긴 삐걱임의 정체.** 덱을 손가락으로 못 밀게
 *   (`overflow-x:hidden`) 하자 iOS 가 이 칸의 부드러운 스크롤을 **앱 본체
 *   (메인 스레드)에서** 굴리게 됐습니다. 하단바를 누르면 본체는 새 탭을
 *   그리느라 바쁘고, 그동안 스크롤은 출발을 못 합니다 → 150ms 되박기가
 *   목표로 순간이동 → 늦게 출발한 스크롤이 **처음 자리부터** 다시 굴러감.
 *   사용자가 본 그대로입니다: 「넘어가야 할 탭이 잠깐 나왔다가 기존 탭으로
 *   돌아갔다가 넘어간다」. 크롬에서도 열한 번 중 여섯 번이 150ms 안에
 *   출발을 못 했습니다(크롬은 늦은 것을 버려서 뒤로는 안 갔습니다).
 *   b780 까지는 칸이 `auto` 라 iOS 가 스크롤을 본체 밖에서 굴려서 몰랐습니다.
 * ⚠ 이제 자리는 즉시 넣고, 보이는 움직임만 판 둘의 **CSS transform 전환**
 *   으로 합니다. iOS 는 이 전환을 본체와 따로(Core Animation) 돌리므로 새
 *   탭을 그리는 중에도 안 멈추고, 자리를 쓰는 주인이 하나라 되돌아갈 일이
 *   없습니다.
 * ⚠ 끝은 **transitionend** 로 압니다. 고정 시간으로 걷었더니 출발이 늦은 날
 *   (홈을 그리는 동안) 중간에 걷혀 뚝 떨어졌습니다 — 크롬에서 재서 걸렸습니다.
 *   안 오는 환경(숨은 창·전환 취소)을 위해 1.2초 뒤에도 한 번 걷습니다.
 * ⚠ 판에 transform 이 걸린 동안은 그 안의 `position:fixed` 가 판을 기준으로
 *   섭니다(홈의 떠 있는 칩). 판이 화면과 같은 크기라 멈춰 있을 때는 자리가
 *   같고, 들어오는 동안 판과 같이 움직입니다. 0.34초만입니다. */
let 미끄럼 = null;
function 미끄럼걷기(){
  if (!미끄럼) return;
  const { 판들, 끝 } = 미끄럼;
  미끄럼 = null;
  clearTimeout(끝);
  판들.forEach(p => { p.style.transition = ''; p.style.transform = ''; });
}
function 덱으로(t, 부드럽게, 다시){
  const i = 탭순서().indexOf(t);
  if (i < 0) return;
  /* ⚠⚠ **폭이 0 이면 옮기지 «않고» 다시 옵니다(b729).** ⚠⚠
     `칸폭()` 은 폭이 0 일 때 나눗셈이 NaN 이 되지 않게 **1** 을 돌려줍니다.
     그 1 을 그대로 곱하면 목표가 「3px」 같은 헛값이 되고, 덱은 사실상
     0번 칸에 선 채로 «옮겼다»고 칩니다 — 하단바와 화면이 갈리는 길입니다.
     여행 화면을 닫고 덱을 방금 되살린 참이라 아직 폭이 없을 수 있습니다.
   ⚠ **잠금(`덱잠금`)을 걸기 «전»에 봅니다.** 걸어 놓고 여기서 돌아가면
     푸는 타이머를 못 걸어 **판정이 영영 잠깁니다**(손가락 스와이프로 탭이
     안 바뀝니다).
   ⚠ **스무 번(약 1.2초)까지만.** 끝없이 되물으면 덱이 영영 안 열리는
     자리에서 60ms 짜리 타이머가 영원히 돕니다(globe.js 가 같은 이유로
     마흔 번에서 끊습니다). */
  if (!덱.clientWidth){
    if ((다시 || 0) < 20) setTimeout(() => 덱으로(t, false, (다시 || 0) + 1), 60);
    return;
  }
  /* ⚠ **`scrollTo({behavior:"smooth"})` 를 안 씁니다.** 스크롤 칸에서는 그것이
     아예 안 도는 환경이 있습니다 — b471 에서 `toTop` 을 그 이유로 고쳤는데
     여기서 또 썼고, 재보니 덱이 0 에서 꿈쩍도 안 했습니다.
     **값은 직접 넣습니다** — 끝 자리는 반드시 그 칸입니다. 부드러움은
     b782 부터 CSS 스크롤이 아니라 판의 transform 이 맡습니다(위 머리말). */
  덱잠금 = true;
  clearTimeout(덱잠금타이머);
  미끄럼걷기();
  const 폭 = 칸폭(), 전 = 지금칸();
  /* ⚠⚠ **자리는 «즉시» 옮깁니다(b782).** app.css 의 #tabdeck 이 이제
     `scroll-behavior:auto` 라 대입이 곧 도착입니다. 눈에 보이는 미끄러짐은
     아래에서 판 둘의 transform 으로 따로 합니다.
     ⚠ b492 의 「smooth 가 대입을 삼킨다 → 150ms 뒤 되박기」는 걷었습니다.
       smooth 를 안 쓰니 삼킬 것이 없고, 그 되박기가 바로 b781 의 삐걱임을
       만든 짝이었습니다(위 `미끄럼` 머리말). */
  덱.scrollLeft = i * 폭;
  /* ⚠⚠ **잠금을 풀면서 «정말 그 칸에 섰나»를 한 번 더 봅니다(b729).** ⚠⚠
     엉뚱한 데 멎으면(도중에 폭이 바뀌거나) 하단바는 평가인데 화면은
     분석입니다. 반올림한 칸 번호가 아니라 **픽셀로** 봅니다 — 폭이 바뀐
     뒤에는 번호는 맞아도 두 탭이 조금씩 걸칠 수 있습니다. */
  const 풀기 = 늦게 => {
    clearTimeout(덱잠금타이머);
    덱잠금타이머 = setTimeout(() => {
      덱잠금 = false;
      if (!덱.classList.contains('hide') && 덱.clientWidth
          && Math.abs(덱.scrollLeft - i * 칸폭()) > 1)
        덱.scrollLeft = i * 칸폭();
    }, 늦게);
  };
  const 옛 = 덱.children[전], 새 = 덱.children[i];
  if (!부드럽게 || 전 === i || !옛 || !새
      || matchMedia('(prefers-reduced-motion: reduce)').matches) return 풀기(0);
  /* 옛 판은 이제 (전-i)칸 떨어진 자리에 있습니다. 화면으로 당겨 놓고 거기서
     밀어냅니다. 새 판은 한 칸 옆에서 들어옵니다 — 멀리 떨어진 탭이어도
     중간 탭들을 스치지 않습니다. 둘은 붙어서 가므로 겹칠 일이 없습니다. */
  const 방향 = i > 전 ? 1 : -1, 옛자리 = (i - 전) * 폭;
  옛.style.transition = 새.style.transition = 'none';
  옛.style.transform = `translateX(${옛자리}px)`;
  새.style.transform = `translateX(${방향 * 폭}px)`;
  /* 출발 자리를 스타일로 한 번 확정시켜야 전환이 거기서 출발합니다. */
  void getComputedStyle(옛).transform; void getComputedStyle(새).transform;
  옛.style.transition = 새.style.transition = 'transform .34s cubic-bezier(.22,.61,.36,1)';
  옛.style.transform = `translateX(${옛자리 - 방향 * 폭}px)`;
  새.style.transform = 'translateX(0)';
  const 이번 = { 판들: [옛, 새], 끝: 0 };
  /* transitionend 는 **거품처럼 올라옵니다** — 판 안의 단추 전환이 끝나도
     옵니다. 판 자신의 transform 인지 보고 받습니다. */
  const 마침 = e => {
    if (e && (e.target !== 새 || e.propertyName !== 'transform')) return;
    새.removeEventListener('transitionend', 마침);
    새.removeEventListener('transitioncancel', 마침);
    if (미끄럼 !== 이번) return;              /* 그사이 다른 탭을 눌렀습니다 */
    미끄럼걷기();
    풀기(60);
  };
  새.addEventListener('transitionend', 마침);
  새.addEventListener('transitioncancel', 마침);
  이번.끝 = setTimeout(마침, 1200);
  미끄럼 = 이번;
}
/* ── 폭이 바뀌면 지금 칸에 다시 앉힙니다(b782) ─────────────────────────
 * 스냅을 걷었으므로(app.css 의 #tabdeck) 창 폭이 바뀌어도 브라우저가 칸을
 * 맞춰 주지 않습니다 — 화면을 돌리면 두 탭이 반씩 걸칩니다.
 * 미끄러지는 중이면 그쪽이 끝에서(`풀기`) 맞춥니다. */
function 덱칸맞추기(){
  if (미끄럼 || 덱.classList.contains('hide') || !덱.clientWidth) return;
  const i = 탭순서().indexOf(appTab);
  if (i >= 0 && Math.abs(덱.scrollLeft - i * 칸폭()) > 1) 덱.scrollLeft = i * 칸폭();
}
addEventListener('resize', 덱칸맞추기);
addEventListener('orientationchange', () => setTimeout(덱칸맞추기, 120));
/* 탭 하나를 여는 절차. **화면을 고르는 일은 덱이 맡습니다** — 여기서는
   덮고 있던 것들을 걷고, 내용을 채우고, 덱을 그 칸으로 보냅니다. */
function showApp(t, 표시탭, 이미덱에){
  appTab = t;
  /* ⚠⚠ **지금 어느 탭인지를 body 에 적습니다(b709).** ⚠⚠
     탭 덱은 «가로 스크롤»이라 안 보이는 탭도 `display:none` 이 아닙니다.
     그래서 그 안에 있는 `position:fixed` 짜리는 **스크롤을 벗어나 다섯 탭
     내내 화면에 남습니다** — 기록 탭의 플로팅 칩(b704)이 평가·분석·여행·
     프로필 위에도 떠 있었습니다(실측으로 걸렸습니다).
     ⚠ 판을 숨기는 것으로는 못 고칩니다(덱은 판을 안 숨깁니다).
       「지금 무슨 탭인가」를 CSS 가 알아야 합니다. */
  try { document.body.dataset.tab = t || ''; } catch {}
  shutBigMap();
  /* 여행이 열려 있으면 먼저 닫습니다. 안 닫으면 여행 화면이 탭 화면 아래에
     그대로 남습니다 — 홈에서 발자국을 누르면 프로필 밑에 여행이 붙어 있었습니다.
     backToList 가 이미 닫고 부르는 경우에도 다시 해서 탈은 없습니다. */
  if (trip) clearTrip();
  $('tripview').classList.add('hide'); inTrip(false);

  $('draftview').classList.add('hide');
  $('reviewview').classList.add('hide');
  /* 연속 평가도 걷습니다(b409) — 탭을 옮겼는데 그 화면이 덮고 있으면 안 됩니다.
     하단 탭을 되살리는 것까지 closeSpree 가 합니다. */
  if (!$('spreeview').classList.contains('hide')) closeSpree(true);
  /* 프로필 위에 얹히는 판 여섯은 탭을 옮기면 같이 걷습니다 —
     안 걷으면 홈으로 나갔는데 그 판이 그대로 덮고 있습니다.
     ⚠ **국가 목록 한 줄만 있었습니다(b502).** 설정을 열어둔 채 탭바를
       누르면 설정이 안 닫혀서, 홈 화면 **아래에 설정 페이지가 통째로
       매달렸습니다**(실측: 문서가 1218px 더 굴러갔습니다).
       판을 늘릴 때 여기 목록도 같이 늘려야 합니다 — app.js 위쪽에서
       `.tabpane` 을 달아주는 목록과 같은 여섯입니다. */
  for (const id of ['ctrypane', 'setpane', 'notifpane', 'personapane', 'diarypane',
                    'shelfpane', 'mappane', 'admpane', 'p16pane', 'editpane'])
    $(id)?.classList.add('hide');
  $('cityview').classList.add('hide'); clearCityOpen();
  /* 도시 밑에 가려진 채 남은 친구 화면(b789) — 도시가 닫혔으니 되살아날 길이
     없습니다. 치워 두지 않으면 다음에 사람 화면을 열 때 옛 사람이 끼어듭니다.
     ⚠ 보이는 것은 건드리지 않습니다(덮개가 떠 있는데 탭이 바뀔 일은 없지만). */
  if (!isPersonOpen()) resetPerson();
  $('aiview').classList.add('hide');   /* 비서는 탭이 아니라 시트입니다 */
  $('newcard').classList.add('hide');
  /* (옛 이름 바꾸기 칸 #namebox 는 b791 에 「프로필 변경」 판으로 갔습니다 — 위 목록의 editpane) */
  /* ⚠ **탭 화면 다섯은 이제 안 숨깁니다(b474).** 덱 안에서 한 칸이 사라지면
     그 뒤 칸들의 가로 위치가 통째로 밀립니다. 덱만 되살립니다. */
  /* 하단바가 보여 주던 탭 — 아래 `덱으로` 가 미끄러질지를 이것으로 정합니다(b785). */
  const 보이던탭 = document.querySelector('#appbar button.is-on')?.dataset.a;
  덱.classList.remove('hide');
  document.querySelectorAll('#appbar button').forEach(b =>
    b.classList.toggle('is-on', b.dataset.a === (표시탭 || t)));
  /* ⚠⚠ **보관함이 프로필로 돌아갔으므로 «둘 다»에서 부릅니다(b757).** ⚠⚠
     b550 에 기록 탭으로 옮기면서 프로필 쪽 호출을 걷었는데, 이제 카드가
     프로필에 있습니다 — 한쪽만 부르면 다른 쪽에서 0 만 보입니다.
     두 번 불러도 손해가 없습니다(같은 질의 몇 개, 그리고 대개 이미
     받아둔 값입니다). 「어느 탭이 채우나」를 따지다 또 0 을 보느니
     부르는 편이 낫습니다. */
  if (t === 'home')      { loadHome(); loadFootprint(); }
  /* ⚠ **설정 알맹이도 여기서 채웁니다(b554).** 전에는 톱니를 누를 때
     채웠는데, 이제 프로필 탭이 곧 설정이라 탭을 여는 것이 그 순간입니다.
     ⚠ `loadAdmin` 은 관리자 아이콘을 켤지 정합니다 — 안 부르면 대시보드가
       영영 안 열립니다(그 아래 옛 주석 참고). */
  /* ⚠ 여기서는 **세기만** 합니다(b760). 읽음으로 치는 것은 종을 눌러
     알림 화면을 열 때입니다 — 프로필을 스쳐 지났다고 읽은 것은 아닙니다. */
  else if (t === 'set')  { showProfile(false); loadFootprint(); loadNotifs();
                           loadNotifPrefs(); loadAdmin();
                           loadSocialCounts(); loadSocialPrefs(); }
  else if (t === 'ai')   loadAi();
  else if (t === 'rate') loadRatings();
  else if (t === 'anal') loadAnal();
  else                   loadTrips();
  /* ⚠ **손가락으로 밀어서 온 경우에는 덱을 다시 옮기지 않습니다.** 이미 그
     칸에 서 있는데 또 `scrollTo` 를 하면 방금 멎은 스크롤을 건드려 튑니다. */
  if (!이미덱에){
    /* ⚠⚠ **하단바 탭이 그대로면 미끄러지지 않고 바로 옮깁니다(b785).** ⚠⚠
       지구본 「자세히 ›」는 하단바를 기록에 둔 채 덱을 프로필 칸으로 보냅니다
       (지도가 프로필 위에 얹히는 판이라, home.js 의 `지도열기`). 지도를 닫고
       기록으로 돌아올 때 미끄러지면 **가려져 있던 프로필 칸(판이 걷혀 빈 칸)이
       0.34초 스쳐 지나갑니다.** 사용자 눈에는 탭이 바뀐 적이 없으니 움직일 것도
       없습니다. 하단바를 눌러 탭이 바뀔 때는 예전처럼 밀려 들어옵니다(b782). */
    덱으로(t, 보이던탭 !== (표시탭 || t));
    /* ── 하단바로 옮기면 **그 화면 맨 위로**(b546, 사용자 결정) ──────────
     * ⚠⚠ **b471 을 뒤집는 것입니다.** 그때는 「탭 화면이 각자 스크롤러라
     *   보던 자리가 저절로 남는다」를 그대로 두기로 했습니다(그때도 사용자
     *   결정). 실기기에서 써보니 **탭을 눌러 들어왔는데 위가 잘려 있는**
     *   것이 고장으로 읽혔습니다 — 프로필을 열었는데 사진이 반만 보였습니다.
     * ⚠ **손가락으로 밀어서 온 경우(`이미덱에`)는 안 건드립니다.** 옆으로
     *   훑어보는 중인데 자리를 옮기면 방금 멎은 스크롤과 다툽니다.
     *   같은 이유로 위 `덱으로` 도 그때는 안 부릅니다.
     * ⚠⚠ **CSS `scroll-behavior:smooth` 가 대입을 삼킵니다(b492).** ⚠⚠
     *   `.tabpane` 은 기본이 smooth 라 `scrollTop = 0` 이 아무 일도 안 하는
     *   환경이 있습니다. 덱을 옮길 때와 **같은 수법**으로 잠깐 꺼 둡니다. */
    const 칸 = 덱.children[탭순서().indexOf(t)];
    if (칸){
      칸.style.scrollBehavior = 'auto';
      칸.scrollTop = 0;
      칸.style.scrollBehavior = '';
    }
  }
  덱높이맞추기();
}

/* ── 어느 칸에 서 있나 — **보이는 것으로 판정합니다**(b474) ─────────────
 * 처음에는 `scroll` · `scrollend` 로 「멎었나」를 물었습니다. 그런데
 * `scrollend` 는 자바스크립트로 `scrollLeft` 를 넣은 경우 안 오고,
 * `scroll` 도 안 나는 환경이 있습니다(재보니 0 회였습니다).
 *
 * **화면에 무엇이 보이는가**는 그런 사정과 무관합니다. IntersectionObserver
 * 로 「60% 넘게 보이는 칸」을 물으면, 손가락으로 밀든 코드로 옮기든 답이
 * 같습니다. 스냅이 걸려 있어 60% 를 넘는 칸은 늘 하나뿐입니다.
 *
 * ⚠ 이미 그 탭이면 아무것도 안 합니다 — 하단바를 눌러 온 경우 showApp 이
 *   먼저 돌았으므로, 여기서 또 부르면 load 가 두 번 돕니다.
 * ⚠ 덱이 숨어 있을 때(여행·도시 화면)는 무시합니다. 숨는 순간 「안 보임」이
 *   쏟아지는데 거기에 반응하면 엉뚱한 탭으로 튑니다. */
function 닿았다(el){
  if (덱.classList.contains('hide')) return;
  /* 하단바를 눌러 옮기는 중이면 목적지가 이미 정해져 있습니다. 지나가는
     칸에 반응하면 하단바가 두 번 깜빡입니다(위 덱잠금 주석 참고). */
  if (덱잠금) return;
  const t = 탭순서()[[...덱.children].indexOf(el)];
  if (!t || t === appTab) return;
  showApp(t, null, true);
}
{
  const 눈 = new IntersectionObserver(목록 => {
    const 온전한 = 목록
      .filter(e => e.isIntersecting && e.intersectionRatio >= 0.6)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (온전한) 닿았다(온전한.target);
  }, { root: 덱, threshold: [0.6, 0.9] });
  [...덱.children].forEach(el => 눈.observe(el));
  /* ⚠ **보는 눈 하나만 두지 않습니다.** IntersectionObserver 가 안 도는
     환경을 만났습니다(화면이 뒤로 물러나 있으면 아무것도 안 옵니다).
     스크롤이 멎은 뒤 한 번 더 물어봅니다 — 둘 다 불려도 「이미 그 탭이면
     아무것도 안 함」이라 탈이 없습니다. */
  let 타이머 = 0;
  const 나중에 = () => {
    clearTimeout(타이머);
    타이머 = setTimeout(() => 닿았다(덱.children[지금칸()]), 130);
  };
  덱.addEventListener('scroll', 나중에, { passive:true });
  덱.addEventListener('scrollend', 나중에, { passive:true });
  /* ⚠ 「손가락이 닿으면 잠금을 바로 푼다」(pointerdown)가 여기 있었습니다 —
     미끄러지는 도중에 사용자가 밀 수 있어서였습니다. b781 부터 덱은 손가락으로
     안 밀리므로 b782 에 걷었습니다. 남겨 두면 미끄러지는 중에 판을 건드리기만
     해도 잠금이 풀려, 지나가는 칸에 반응해 하단바가 깜빡입니다. */
}
$("appbar").addEventListener("click", e => {
  const b = e.target.closest("button[data-a]");
  if (!b) return;
  /* ⚠ **같은 탭을 다시 누르면 맨 위로(b471).** 보던 자리를 남기기로 했으니
     맨 위로 갈 길이 하나는 있어야 합니다. iOS 앱들이 다 이렇게 합니다.
     ⚠ 판정은 **덱이 보이는가**로 합니다(b474). 탭 화면 다섯은 이제 안
       숨기므로 「그 화면이 닫혔나」로는 알 수가 없습니다 — 여행이나 도시를
       열어 둔 상태에서 하단바를 누르면 그 탭으로 **돌아와야** 합니다. */
  /* ⚠⚠ **`appTab` 만 보면 안 됩니다(b729).** ⚠⚠
     `showApp` 은 **맨 첫 줄에서** `appTab = t` 를 박아 놓고 그 뒤에 덱을
     옮깁니다. 그래서 덱 이동이 한 번이라도 실패하면 —
       · `appTab` 은 이미 'rate'
       · 덱은 아직 'anal' 칸
     이 되고, 그 뒤로 평가를 누를 때마다 이 줄이 「같은 탭 재선택」으로 보고
     **맨 위로만 하고 돌아갑니다.** `showApp` 이 다시는 안 불려서 새로고침
     전까지 풀리지 않습니다(외부 QA 리포트 2026-09-09 의 P1 —
     「여러 번 눌러도 그대로, 새로고침 후에만 정상화」).
     ⚠ **`appTab` 은 「가려던 곳」이고 `지금칸()` 은 「지금 서 있는 곳」입니다.**
       재선택인지 아닌지는 뒤엣것으로 물어야 합니다. 둘이 어긋나 있으면
       그것 자체가 「덱을 옮겨야 한다」는 뜻이라, 그냥 showApp 으로 갑니다. */
  const 덱보임 = !덱.classList.contains('hide');
  const 선칸 = 덱보임 ? 탭순서()[지금칸()] : null;
  if (b.dataset.a === appTab && 덱보임 && 선칸 === b.dataset.a){
    탭처음으로(appTab);          /* 같은 탭 다시 누르기 = 그 탭 첫 화면 */
    return;
  }
  showApp(b.dataset.a);
});
/* ── 같은 탭 다시 누르기 = 그 탭 «첫 화면»(b786) ─────────────────────────
 * 사용자: 「하단바 버튼으로 이동한 상태에서 그 버튼 한번 더 누르면 그 탭 제일 처음
 *   화면으로 돌아가게 해줘」. b471 은 «맨 위로»만 했습니다 — 기록 탭에서 지구본을
 *   당겨 둔 채 기록을 다시 눌러도 그대로였습니다.
 * 맨 위로 + 탭마다 처음 모습:
 *   기록 — 나라 시트 닫기 · 넘김 카드 첫 장 「전체」 · 지구본 처음 자리(home.js)
 *   평가 — 검색어 · 대륙/국가 거르개 풀기 · 거르개 시트 닫기(rating.js)
 *   여행 — 「다가오는」
 *   분석 · 프로필 — 맨 위로(덮는 판은 덱을 가리므로 이 길이 아니라 showApp 이 닫습니다)
 * ⚠ 탭마다 «처음 모습»을 아는 것은 그 화면의 파일입니다. 여기서는 부르기만 합니다. */
function 탭처음으로(t){
  toTop(판찾기(t));
  if (t === 'home') 기록처음으로();
  else if (t === 'rate') 평가처음으로();
  else if (t === 'trips' && tripFilter !== 'up'){
    setTripFilter('up');
    document.querySelectorAll('#tripfilter button').forEach(x =>
      x.classList.toggle('on', x.dataset.f === tripFilter));
    loadTrips();
  }
}

$('tripfilter').addEventListener('click', e => {
  const b = e.target.closest('button[data-f]'); if (!b) return;
  setTripFilter(b.dataset.f);
  document.querySelectorAll('#tripfilter button').forEach(x =>
    x.classList.toggle('on', x.dataset.f === tripFilter));
  loadTrips();
});

/* ── 일정 검토 ────────────────────────────────────────────────────────
 * 계산만으로 하는 일정 검토는 plancheck.js 로 옮겼습니다
 * (b347, 스물세 번째 조각). ctx 는 하나(loadChats)입니다.
 * `loadAi`(AI 남은 횟수)도 그 범위에 섞여 있어 같이 갔습니다 — 여기
 * 홀로 남길 20줄이 아니라서지, 거기가 옳은 자리라서는 아닙니다. */
/* ── AI 대화 ──────────────────────────────────────────────────────────
 * AI 화면 여닫기와 대화 그리기는 aiscreen.js 로 옮겼습니다
 * (b348, 스물네 번째 조각). ctx 는 하나(me)입니다. */
/* ── 평가 ───────────────────────────────────────────────────────────
 * 일정 앱은 1년에 두 번 열립니다. 돌아올 이유를 만드는 자리입니다.
 * 추천은 하지 않습니다 — 예상 별점은 근거보다 세게 들리고,
 * 여행은 틀렸을 때 대가가 영화와 다릅니다.
 * 남들 평균은 예측이 아니라 사실이라 보여주되 몇 명이 매겼는지 같이 답니다. */
/* starHtml · paintStars 는 stars.js 로 옮겼습니다 (맨 위 import).
   다섯 화면이 같은 모양으로 그려야 하는 것이라 한곳에 모았습니다.
   (「★ 4 기록」 딱지 markRated 는 b823 에 걷었습니다 — stars.js 주석.) */


/* ── 평가 ─────────────────────────────────────────────────────────────
 * 평가 화면과 평가 자료 받아오기는 rating.js 로 옮겼습니다
 * (b341, 열다섯 번째 조각). ctx 는 셋(me · fillCityList · showApp)입니다.
 * `rateShown`·`rateObs` 도 그리로 갔습니다 — 쓰는 곳이 거기뿐이었습니다. */
/* ── 홈 ───────────────────────────────────────────────────────────────
 * 홈 · 여기 가봤어요 · 내 발자국은 home.js 로 옮겼습니다
 * (b344, 열여덟 번째 조각). 셋이 서로를 부르므로 한 파일입니다.
 * ctx 는 셋(me · openTrip · showApp)입니다. */
/* ── 갈 만한 곳 · 빈 시간 ─────────────────────────────────────────────
 * 후보 모으기 · 좌표 채우기 · 빈 시간 찾기는 cands.js 로 옮겼습니다
 * (b344, 열아홉 번째 조각). ctx 는 셋(loadPlans · openAi · loadChats)입니다. */
/* ── AI 일정 초안 ─────────────────────────────────────────────────────
 * draft.js 로 옮겼습니다(b350, 스물여섯 번째 조각).
 * ctx 는 넷(me · fillCityList · showApp · openTrip)입니다.
 * **아래 showProfile 부터는 화면 전환 가족이라 남겼습니다** — 위 머리말이
 * 그것까지 덮고 있었을 뿐입니다. */

function showProfile(setting){
  shutBigMap();
  $('shelfpane').classList.add('hide');
  $('diarypane').classList.add('hide');
  $('personapane').classList.add('hide');
  $('mappane').classList.add('hide');        /* 지도가 열려 있었으면 같이 닫습니다 */
  $('ctrypane').classList.add('hide');       /* 국가 목록도 같이 */
  /* 대시보드는 설정 위에 한 겹 더 얹힌 화면입니다. 안 닫으면 프로필로 나갔다
     들어와도 통계가 그대로 남아 있습니다. */
  $('admpane').classList.add('hide');
  /* ⚠ 알림 화면도 같이 닫습니다(b760) — 종에서 톱니로 바로 넘어가도
     한 겹만 보여야 합니다. */
  $('notifpane').classList.add('hide');
  $('editpane')?.classList.add('hide');      /* 프로필 변경(b791)도 한 겹 */
  $('profpane').classList.toggle('hide', setting);
  $('setpane').classList.toggle('hide', !setting);
  resetSetNav();              /* 설정은 늘 목록부터(b790, setnav.js) */
  /* ⚠ **설정도 이제 덮는 판입니다(b481).** 열면 덱을 숨기고 닫으면 되살립니다.
     위에서 다른 판들을 다 닫았으므로, 여기 한 줄이 그 전부를 정리합니다 —
     어느 판에서 왔든 프로필로 나가면 덱이 돌아옵니다. */
  coverDeck(setting);
  /* 프로필 안에서 판을 갈아탈 때는 맨 위부터 보는 것이 맞습니다 —
     지도를 보다가 보관함을 열었는데 중간부터 보이면 이상합니다. */
  toTop(setting ? $("setpane") : $("setview"));
}
/* loadAdmin 을 여기서 불러야 합니다. 안 그러면 **영영 안 열립니다** —
   프로필 아이콘(#dashbtn)을 켤지 말지가 여기 결과로 정해집니다.
   설정을 열 때도 한 번 더 부릅니다 — 숫자가 오래되면 안 되니까요.
   관리자가 아니면 서버가 막고 아이콘은 숨은 채로 남습니다. */
/* ⚠⚠ **톱니가 돌아왔습니다(b760, 사용자 결정).** ⚠⚠
   b554 에 「설정이 프로필 탭 본문이 되었으므로 톱니를 지웠다」고 적고,
   「`showProfile(true)` 를 부르는 곳은 이제 없습니다」로 끝냈던 자리입니다.
   그 사이에 보관함이 프로필 맨 위로 오고(b757) 기록 탭이 지구본 하나가
   되면서(b758·b759), 프로필이 **「내 기록을 여는 곳」**이 됐습니다 —
   설정 여섯이 그 밑에 깔려 있으면 스크롤의 대부분이 설정입니다.
   사용자: 「설정기능은 왓챠처럼 톱니바퀴 만들고 그 안으로 다 넣자,
   보관함 기능에 집중하게」.
   ⚠ 껍데기를 남겨 뒀기에 되돌리는 데 이 줄 하나로 됐습니다. 다음에 또
     무엇을 걷을 때도 **여닫는 절차는 남기십시오.** */
/* ⚠ **뒤로가기 기록을 쌓습니다(b761, 사용자 신고: 「종은 뒤로가기 되는데
   설정은 뒤로가기 안된다」).** 종은 b760 에 `pushState` 를 넣었는데 톱니는
   빠져 있었습니다 — 판을 새로 열면서 기록을 안 쌓으면 뒤로가기가 그
   판을 건너뛰고 **앱을 나가 버립니다.**
 ⚠ 닫는 쪽(`#setback`)도 같이 봐야 합니다 — 기록을 쌓았으면 닫을 때
   `history.back()` 으로 돌려놔야 기록이 한 칸 남지 않습니다. */
$('gear')?.addEventListener('click', () => {
  showProfile(true);
  if (history.state?.t2 !== 'set') history.pushState({ t2:'set' }, '');
});

/* ── 종 ── 받은 알림(b760) ────────────────────────────────────────────
 * ⚠ 설정과 **다른 화면**입니다. 여기 오는 이유는 「뭐 왔나」고 설정에
 *   가는 이유는 「그만 오게 하자」입니다.
 * ⚠ `true` 는 「보러 온 것」 — 1.2초 뒤에 읽음으로 칩니다(notify.js). */
$('bellbtn')?.addEventListener('click', () => {
  $('profpane').classList.add('hide');
  $('setpane').classList.add('hide');
  $('notifpane').classList.remove('hide');
  coverDeck(true);
  toTop($('notifpane'));
  if (history.state?.t2 !== 'notif') history.pushState({ t2:'notif' }, '');
  loadNotifs(true);
});
$('notifback')?.addEventListener('click', () => {
  if (history.state?.t2 === 'notif') return history.back();
  $('notifpane').classList.add('hide');
  $('profpane').classList.remove('hide');
  coverDeck(false);
});

/* 상단 홈 단추. 여행 안이든 보관함이든 성향 카드든 한 번에 빠져나옵니다.
   showApp 이 여행을 닫고 큰 지도도 걷어내므로 따로 치울 것이 없습니다.
   깊이 들어간 화면들은 뒤로가기 기록을 쌓아뒀으니 그것부터 비워야
   홈에서 뒤로가기를 눌렀을 때 다시 그 안으로 들어가지 않습니다. */
$('setback')?.addEventListener('click', () => {
  /* 쌓아 둔 기록이 있으면 그것부터 되돌립니다 — 그래야 뒤로가기와
     ← 단추가 같은 자리로 데려갑니다(b761). popstate 가 실제로 닫습니다
     (tripview.js 의 사슬). */
  /* 항목 안(알림·계정 …)이면 목록으로 한 겹만(b790). */
  if (isSetSubOpen()) return closeSetSub();
  if (history.state?.t2 === 'set') return history.back();
  showProfile(false);
});

/* 내 자료 내려받기도 account.js 로 갔습니다(b349). 아래 '보관함·지도 열기'
   손잡이는 **여기 남깁니다** — 바로 붙어 있었지만 화면 넘기기입니다. */

/* 보관함과 숫자를 누르면 평가 탭으로 걸러서 보냅니다. */
/* ⚠ **`#setview` 만 듣고 있었습니다(b452).** 지도 화면(#mappane)과 성향
   화면(#personapane)은 그 **밖에** 있어서, 거기 있는 같은 숫자 타일을
   눌러도 아무 일이 없었습니다. 화면마다 핸들러를 복사하면 언젠가 한쪽만
   고쳐지므로 **문서 전체에서 한 번** 듣습니다 — 여는 절차는 여기 한 곳. */
document.addEventListener('click', e => {
  /* 국가 타일은 나라 목록으로. 보관함은 도시가 주인공이라 "어느 나라를 갔나"에
     답을 못 합니다 — 그 답은 국기가 깔린 나라 목록에 있습니다.
     ⚠ **어디서 눌렀는지를 넘깁니다(b505).** 지도 화면에도 같은 타일이
       있는데, 닫을 때 프로필로 떨어지면 보던 지도를 잃습니다. */
  const 나라 = e.target.closest('button[data-openmap]');
  if (나라) return openCountries(나라.closest('#mappane') ? 'map' : null);
  const b = e.target.closest('button[data-shelf]'); if (!b) return;
  /* 다녀온 여행 칸은 없앴습니다. 여행 탭에 이미 있습니다. */
  openShelf(b.dataset.shelf);
});
/* ── AI 화면 여닫기 ───────────────────────────────────────────────────
 * openAi · closeAi · 대화 지우기는 aiscreen.js 로 갔습니다(b348).
 * 바로 아래 있던 **종 알림은 notify.js 로** 갔습니다 — 옆줄에 있었을 뿐
 * 상관없는 것이었습니다. */
/* ── 프로필 ───────────────────────────────────────────────────────────
 * 사진·이름·글자 크기는 profile.js 로 옮겼습니다(b340, 열세 번째 조각).
 * ctx 는 하나(me)입니다. `myAvatar` 도 그리로 갔습니다 — 아래 로그인
 * 직후에 채우는 자리는 setMyAvatar 로 넣습니다. */
/* ── 여행 목록 ────────────────────────────────────────────────────────
 * 여행 목록과 카드 사진 채우기는 triplist.js 로 옮겼습니다
 * (b351, 스물일곱 번째 조각). ctx 는 셋(me · openTrip · logError)입니다.
 * `tripFilter` 도 그리로 갔습니다 — 아래 거르개 단추는 setTripFilter 로
 * 넣습니다(밖에서 `=` 로 넣으면 import 한 값은 안 바뀝니다). */
/* ── 여행 상세 ──────────────────────────────────────────────────── */
/* ymd · todayYmd 는 calc.js 로 내렸습니다(b335, 맨 위 import). 왜 둘인지,
   왜 하나는 UTC 고 하나는 로컬인지는 거기 적어뒀습니다. shelf.js·cards.js 가
   ctx 로 받던 것도 걷었습니다 — 이제 각자 import 합니다. */
/* hm 은 calc.js 로 내렸습니다(b335, 맨 위 import). city.js 도 씁니다. */

/* 문서의 표시 규칙 그대로입니다.
     여행 기간 안  Day 1 · 9월 12일 토요일
     시작 전       9월 5일 · 여행 전
     끝난 뒤       9월 18일 · 여행 후
   Day 번호는 start_date 로 계산합니다. 저장하지 않습니다. */
/* ── 여행 열기 · 실시간 ───────────────────────────────────────────────
 * openTrip · fetchTrip · drawTripHeader 와 실시간(watch/unwatch)은
 * opentrip.js 로 옮겼습니다(b359, 서른다섯 번째 조각).
 * ctx 는 둘(me · appTab)입니다. channel · bumpTimer · bumpPending 도
 * 그리로 갔습니다 — 실시간의 상태입니다. */
/* ── 구간 ─────────────────────────────────────────────────────────────
 * 구간(날짜를 도시로 나눈 것)과 도시 고르개 채우기는 legs.js 로
 * 옮겼습니다(b356, 서른두 번째 조각).
 * ctx 는 셋(drawDays · drawTripHeader · fetchTrip)입니다. */
/* ── 여행 후기 ────────────────────────────────────────────────────────
 * 후기·후기 사진은 review.js 로 옮겼습니다(b340, 열네 번째 조각).
 * ctx 는 하나(me)입니다. `myReview` 도 그리로 갔습니다 — 쓰는 곳이
 * 거기뿐이었습니다. */
/* ── 여행 상세의 뼈대 ─────────────────────────────────────────────────
 * 날짜 줄(drawDays) · 일정 받아오기(loadPlans) · 정보 수정 · 목록으로
 * 돌아가기(backToList)는 tripview.js 로 옮겼습니다
 * (b357, 서른세 번째 조각). ctx 는 넷(appTab · showApp · openTrip · drawToday). */
/* ── 일정 줄 그리기 부품 ──────────────────────────────────────────────
 * drawCats · parseMemo · nice · lineChips · dayStat 는 planline.js 로
 * 옮겼습니다(b353, 스물아홉 번째 조각). ctx 는 둘(drawDays · drawPlans).
 * b345 에 '추천 검사' 머리말 아래 섞여 있던 것을 그때는 두고 갔던 것입니다. */
/* ── 일정 화면 ────────────────────────────────────────────────────────
 * 일정 그리기(drawPlans)와 끌어서 순서 바꾸기는 planview.js 로 옮겼습니다
 * (b354, 서른 번째 조각). ctx 는 셋(featOn · flags · loadPlans).
 * `openPlans`(펼친 줄) 도 그리로 갔습니다 — Set 이라 아래 손잡이가
 * add/delete 해도 저쪽이 같은 것을 봅니다. */
/* ── 일정 불러오기 ────────────────────────────────────────────────────
 * 분류 짐작과 파일·사진에서 불러오기는 bring.js 로 옮겼습니다
 * (b346, 스물한 번째 조각). ctx 는 셋(openAi · loadChats · loadPlans)입니다. */
/* ── 오늘 화면 ────────────────────────────────────────────────────────
 * 날씨와 '오늘' 카드는 today.js 로 옮겼습니다(b358, 서른네 번째 조각).
 * **딸린 것이 없어 ctx 가 없습니다.** */
/* ── 지운 것 되살리기 ─────────────────────────────────────────────────
 * trash.js 로 옮겼습니다(b346, 스물두 번째 조각). ctx 는 하나(loadPlans).
 * TAB_TRASH 도 그리로 갔습니다 — 아래 탭 구역이 거기서 가져다 씁니다. */
/* ── 탭 ───────────────────────────────────────────────────────────────
 * 여행 상세의 네 구역(일정·지출·준비·일행)과 좌우 쓸어 넘기기는
 * tabs.js 로 옮겼습니다(b352, 스물여덟 번째 조각).
 * ctx 는 둘(appTab · showApp)입니다. */
/* ── 지출 ───────────────────────────────────────────────────────── */
/* 지출·환율·정산은 expense.js 로 옮겼습니다(b335, 여덟 번째 조각).
   nameOf 는 지출 것이 아니라 일행 것이라 trip.js 로 내렸습니다 — 후기·
   준비물·일행 화면도 그것을 씁니다. */
/* ── 여행 준비 ────────────────────────────────────────────────────────
 * 예약·서류·준비물·링크는 prep.js 로 옮겼습니다(b336, 아홉 번째 조각).
 * **딸린 것이 하나도 없어서 ctx 가 없습니다** — 여기서 넘겨줄 것이 없습니다.
 * 밖에서 부르는 길 넷만 맨 위에서 가져옵니다. */
/* ── 일행 · 초대 링크 ─────────────────────────────────────────────────
 * 일행 목록·권한, 초대 링크 만들기·거두기, 링크로 들어온 사람 넣기는
 * member.js 로 옮겼습니다(b337, 열 번째 조각). ctx 셋을 넘깁니다.
 * ROLE_KO 는 거기서 내보냅니다 — 여행 목록 배지도 같은 것을 씁니다. */
/* ── 일정 추가 · 삭제 ───────────────────────────────────────────── */
$('addplanbtn').addEventListener('click', () => {
  setEditPlanId(null); $('p_create').textContent = '넣기';
  $('p_formtitle').textContent = '일정 추가';   /* 고치기에서 돌아올 때 되돌립니다 */
  /* 손으로 새로 여는 것이므로 앞서 카드에서 들고 온 좌표는 버립니다.
     openPlanForm 은 이 뒤에 다시 채웁니다. */
  setPlanSeedGeo(null);
  /* 앞서 붙여넣은 링크의 결과도 같이 버립니다. 안 그러면 다음 일정에
     엉뚱한 위치가 딸려 들어갑니다 — 조용히 틀리는 종류입니다. */
  resetGeo();
  $('plancard').classList.toggle('hide');
  if ($('plancard').classList.contains('hide')) return;
  $('p_date').value = pickedDay || trip.start_date;
  $('p_date').min = '';                    /* 여행 기간 밖도 넣을 수 있어야 합니다 */
  $('p_cat').dataset.touched = '';         /* 새 폼이니 짐작을 다시 켭니다 */
  /* ⚠ **여기서 아무것도 스크롤하지 않습니다. 초점도 주지 않습니다**(b366).
     전에는 `$('p_title').focus()` 가 있었고, 그것이 두 가지를 하고 있었습니다 —
     키보드를 띄우고, 겸사겸사 폼으로 화면을 끌어가고.

     **그런데 끌어갈 곳이 문서 맨 아래였습니다.** `#plancard` 는 일정 목록
     전체를 지나 있습니다. 그래서 `추가` 를 누르면 화면이 맨 밑으로
     굴러갔습니다 — 사용자가 그렇게 말해줬고, 재보니 스크롤 0 → 5881 이었습니다.

     끌어갈 필요가 애초에 없습니다. `plancard` 는 `SHEETS` 에 있어서
     `syncSheets` 가 `.assheet`(`position:fixed`, 화면 바닥)로 바꿉니다.
     **다만 그 변환은 MutationObserver 라 한 박자 늦게 옵니다** — 누르는
     순간에는 아직 문서 아래의 보통 요소라, 그때 스크롤하면 맨 밑으로 갑니다.
     재서 확인했습니다(누른 직후 `position: static`, 잠시 뒤 `fixed`).
     **시트로 뜨는 것에는 scrollIntoView 를 걸지 마십시오.**

     초점도 안 줍니다. 열자마자 키보드가 화면 절반을 덮으면, 날짜나 분류를
     먼저 정하려던 사람은 그것부터 내려야 합니다. 칸을 누르면 그때 올라옵니다. */
});

/* 제목·메모를 치는 대로 분류를 짐작해 미리 골라둡니다.
   직접 고른 적이 있으면 그때부터 안 건드립니다. */
$('p_cat').addEventListener('change', () => { $('p_cat').dataset.touched = '1'; });
for (const id of ['p_title', 'p_memo'])
  $(id).addEventListener('input', () => {
    if ($('p_cat').dataset.touched === '1') return;
    const g = guessCat($('p_title').value + ' ' + $('p_memo').value);
    if (g) $('p_cat').value = g;
  });
$('p_cancel').addEventListener('click', () => {
  $('plancard').classList.add('hide'); $('planformerr').classList.add('hide');
});

/* ── 붙여넣은 지도 링크에서 위치 찾기 ─────────────────────────────────
 * geocode.js 로 옮겼습니다(b355, 서른한 번째 조각).
 * ctx 는 셋(drawDays · featOn · loadPlans)입니다.
 * `planGeo`·`geoAsked` 도 그리로 갔습니다 — 위 일정 칸이 비우던 자리는
 * `resetGeo()` 로 바뀌었습니다. */
/* ── 첫 화면 사진 ────────────────────────────────────────────────────
 * 앱을 처음 보는 사람이 제일 먼저 보는 화면인데 도시 사진을 469장
 * 가지고도 한 장을 안 쓰고 채도 높은 그러데이션을 깔고 있었습니다.
 *
 * **한 번 고른 도시를 캐시에 담아둡니다.** 열 때마다 바뀌면 같은 앱으로
 * 안 보이고, 무엇보다 로그인 전에는 이 화면이 전부라 연결이 없을 때도
 * 뭐라도 나와야 합니다. 못 받으면 그냥 안 깝니다 — `.hello` 의 짙은
 * 바탕이 이미 흰 글자를 읽히게 하므로 화면이 깨지지 않습니다.
 *
 * `cities` 는 anon 으로도 읽힙니다(로그인 전에 부르는 이유). */
/* ⚠ **`helloPhoto` 를 걷었습니다(b475).** 첫 화면의 큰 사진을 없애면서
   그것을 받아오던 절차도 같이 지웁니다. 도시 60곳을 조회하던 왕복 하나가
   줄어서 첫 화면이 조금 빨라집니다.
   (지우기 전에는 `#hellopic` 에 무작위 도시 사진을 깔고 `#hellowhere` 에
    그 도시 이름을 적었습니다. 둘 다 index.html 에서 없앴습니다.) */

/* ── 화면 전환 ──────────────────────────────────────────────────── */
async function render(session){
  /* 스플래시를 걷습니다. **여기가 맞는 자리입니다** — 어느 화면을 보여줄지
     정해진 순간이라, 걷고 나면 빈 화면이 아니라 실제 화면이 나옵니다.
     더 일찍(코드가 살아난 시점) 걷으면 로그인 화면인지 홈인지 정하기 전이라
     한 번 깜빡입니다. 다음 칠에 걷어서 아래의 class 갈아끼우기가 먼저
     화면에 반영되게 합니다.
     안 불려도 index.html 이 3.2초면 스스로 걷습니다 — 끄는 길이 둘입니다. */
  requestAnimationFrame(() => window.__hideSplash?.());
  if (!session){
    clearTrip(); document.body.classList.remove('hastab');
    $('signedin').classList.add('hide'); $('signedout').classList.remove('hide');
    $('errcard').classList.add('hide');
    $('aibtn').classList.add('hide');
    $('sub').textContent = '로그인하면 여행을 만들 수 있어요.';
    me = null;
    /* 사람·친구 화면은 화면 전체를 덮는 판입니다(b789) — 안 닫으면
       로그인 화면 위에 앞사람의 친구 목록이 남습니다. */
    resetPerson(); closeFriends(true);

    /* (맛보기 평가 drawTry 는 b799 에 걷었습니다 — 로그인 화면은 머리말과 「시작하기」뿐.
       ⚠ 체크 카드(?check=eu, b507)·맛보기가 없어도 옛 링크로 들어오면 이 로그인 화면이
       그대로 뜹니다 — 빈 화면은 안 납니다.) */
    /* **앞사람 것을 남기지 않습니다.** 별점·다녀온 곳은 사람마다 다른데
       여태 로그아웃에도 로그인에도 비우는 코드가 없었습니다. 같은 기기에서
       계정을 바꾸면 앞사람 별점이 화면에 남았습니다. */
    clearRates(); resetRateHtml(); resetHomeSig(); dropHtml('trips');
    /* 성향 코드도 앞사람 것입니다(b526) — 안 지우면 계정을 바꾼 사람에게
       「성향이 바뀌었어요」가 뜹니다. 바뀐 것이 아니라 사람이 바뀐 것입니다. */
    clearPcode();

    /* 초대 링크로 왔으면 어떤 여행인지 먼저 보여줍니다.
       아직 참여자가 아니라 trips 를 못 읽으므로 이름과 날짜만 주는 함수를 씁니다. */
    const code = sessionStorage.getItem('t2:join');
    if (code){
      const { data } = await sb.rpc('peek_invite', { p_code: code });
      if (data){
        $('joinnote').classList.remove('hide');
        $('joinname').textContent = data.title;
        $('joinwhen').textContent = data.expired
          ? '만료된 초대예요'
          : `${data.destination} · ${dateRange(data.start_date, data.end_date)} · ` +
            `${ROLE_KO[data.role] || data.role}로 참여`;
      }
    }
    return;
  }
  if (me?.id === session.user.id) return;      /* 토큰 갱신마다 다시 그리지 않습니다 */
  /* **여기까지 왔으면 다른 사람입니다**(같은 사람이면 위에서 돌아갑니다).
     로그아웃을 안 거치고 바로 갈아타는 길도 있으므로 여기서도 비웁니다. */
  clearRates(); resetRateHtml(); resetHomeSig(); dropHtml('trips');
    /* 성향 코드도 앞사람 것입니다(b526) — 안 지우면 계정을 바꾼 사람에게
       「성향이 바뀌었어요」가 뜹니다. 바뀐 것이 아니라 사람이 바뀐 것입니다. */
    clearPcode();
  /* 사람이 바뀌면 앞사람 화면을 반드시 다시 그립니다 */
  me = session.user;
  resetPerson(); closeFriends(true);         /* 앞사람의 사람·친구 화면(b789) */

  $('signedout').classList.add('hide'); $('signedin').classList.remove('hide');
  /* ── 맛보기로 매긴 것을 계정으로 옮깁니다(b406) ───────────────────────
     ⚠ **이게 없으면 맛보기를 안 하느니만 못합니다.** 로그인했더니 방금 매긴
       다섯 곳이 날아가 있으면 사람이 화를 냅니다.
     ⚠ **기다립니다.** 아래 화면 그리기(loadRateData·loadHome)보다 먼저 들어가야
       옮긴 별점이 첫 화면에 바로 보입니다. 뒤에 두면 "따라온다더니 없네" 가
       한 번 스쳤다가 나중에 나타납니다 — 그 한 번이 신뢰를 깎습니다.
     ⚠ 이미 계정에 있는 도시는 안 덮습니다. 옮기다 실패하면 담아둔 것을 안
       지웁니다(다음 로그인에 다시 시도). 자세한 것은 try.js. */
  try { await claimTryRates(me.id); } catch {}
  clearTrip();
  $('tripview').classList.add('hide'); inTrip(false);  /* 다시 그릴 때는 목록부터 */
  $('appbar').classList.remove('hide');
  document.body.classList.add('hastab');
  $('sub').textContent = '';

  const meta = me.user_metadata || {};
  $('mail').textContent = me.email || '';
  /* 우리 통에 올린 사진과 바꾼 이름을 먼저 씁니다. 없으면 구글 것.
     이름을 구글 것만 보고 있어서, 바꿔도 다시 열면 되돌아왔습니다. */
  /* 이름·사진·글자 크기는 **기다리지 않습니다.**
     비행기모드에서 부팅이 14초 걸렸습니다. 화면은 캐시로 진작 나와 있는데
     이 질의들을 기다리느라 앱이 멈춰 있었습니다.
     먼저 아는 값(구글 계정 정보, 지난번 글자 크기)으로 그려두고,
     서버 값이 오면 그때 덮어씁니다. 안 와도 앱은 돕니다. */
  /* 구글에서 이름·사진을 안 받습니다(위 로그인 범위 참고).
     처음에는 이메일 앞부분을 이름으로 씁니다. 본인이 바꾸면 그게 남습니다.
     ⚠ 서버 이름이 오기 전까지만입니다 — 서버 이름이 비었으면 「이름을 정해 주세요」로
       바뀝니다(b797, profile.js 의 setMyName). */
  resetMyName();
  $('name').textContent = (me.email || '').split('@')[0];
  applyTs(localStorage.getItem('t2:ts') || 1);
  setMyAvatar('');
  setMyBio('');              /* 앞사람 소개를 남기지 않습니다(b791) */
  /* 사진을 올린 적이 없으면 여기서 끝입니다. src 를 비워두면 흰 네모가 됩니다 —
     이름 첫 글자를 그려 넣습니다. 아래에서 진짜 사진이 오면 갈아 끼웁니다. */
  $('avatar').src = avatarOf(me.id, $('name').textContent);

  /* ⚠ 칸 이름을 적지 않고 `*` 로 받습니다(b791) — 소개(bio)는 db/103 을 돌려야
     생기는데, 없는 칸을 적으면 질의가 통째로 실패해서 이름·사진까지 안 옵니다. */
  sb.from('profiles').select('*').eq('id', me.id).maybeSingle()
    .then(r => {
      if (!r.data) return;
      /* 비어 있어도 부릅니다 — 메일 앞부분이 이름처럼 남지 않게(b797). */
      setMyName(r.data.display_name);
      setMyBio(r.data.bio);
      if (r.data.avatar_url){ setMyAvatar(r.data.avatar_url); $('avatar').src = r.data.avatar_url; }
      /* 별명이 늦게 와도 맞게. 이름이 없으면 메일 앞부분의 첫 글자(「이름을 정해 주세요」의 「이」가 아니라). */
      else $('avatar').src = avatarOf(me.id, r.data.display_name || (me.email || '').split('@')[0]);
    }).catch(() => {});

  /* 다른 기기에서 바꾼 글자 크기가 있으면 그걸 따릅니다. 늦게 와도 됩니다. */
  sb.from('user_prefs').select('text_scale').eq('user_id', me.id).maybeSingle()
    .then(r => {
      if (!r.data?.text_scale) return;
      applyTs(r.data.text_scale);
      localStorage.setItem('t2:ts', r.data.text_scale);
    }).catch(() => {});

  /* 대시보드 아이콘은 프로필 화면에 있습니다. 설정을 열 때 켜면 프로필을 봐도
     안 보입니다 — 로그인하자마자 한 번 확인합니다. 관리자가 아니면 서버가
     막고 아이콘은 숨은 채로 남습니다. */
  loadAdmin();
  /* 앱 연 날 — 하루 한 번 날짜만(b815, dayseen.js · db/112). 관리자 「사용」 칸의 「쓴 사람」. */
  markDay(me.id);

  /* ⚠ 종은 b759 에 없어졌습니다 — 알림은 프로필 카드에 있고, 그 카드는
     로그인해야 보이는 화면 안이라 따로 켤 것이 없습니다. */
  $('aibtn').classList.remove('hide');
  /* 빌드 번호는 만든 사람만 봅니다. 앱 안에서는 아무도 자기를 관리자로 못 만듭니다 —
     admins 표에 쓰기 정책이 아예 없어서 SQL 편집기로만 넣을 수 있습니다 (038). */
  sb.rpc('is_admin').then(r => {
    const admin = r.data === true;
    $('foot').classList.toggle('hide', !admin);
  }).catch(() => {});
  /* 출발 하루 전 알림. 시간이 되면 저절로 도는 장치가 없어서 앱을 열 때 확인합니다.
     여러 번 불러도 한 번만 생깁니다 (032 의 ensure_trip_reminders). */
  sb.rpc('ensure_trip_reminders').then(() => loadNotifs()).catch(() => loadNotifs());
  /* 만든 사람이 켜고 끈 것들. 기다리지 않습니다 — 못 읽어도 전부 켜진
     것으로 보고 그대로 돕니다(db/066). */
  loadFlags();
  /* 지난번에 못 보낸 저장이 남아 있을 수 있습니다. 켜자마자 흘려보냅니다. */
  drawOffbar(); flushQueue();
  /* 오프라인이면 홈이 어차피 "볼 수 없어요"입니다. 그럴 땐 여행 목록으로 엽니다 —
     받아둔 일정이 거기 있습니다. 열자마자 쓸 수 있는 화면을 보여주는 것이 맞습니다. */
  showApp(netIsDown() ? 'trips' : 'home');
  /* 초대 링크로 들어왔으면 로그인 직후 그 여행으로 바로 보냅니다.
     목록만 보여주면 어디로 가야 하는지 몰라 헤맵니다.
     기다리지 않습니다 — 초대 코드가 없으면 아무 일도 안 하는데,
     오프라인에서 이걸 기다리느라 첫 화면이 늦어졌습니다. */
  handleJoin();
  /* 알림을 눌러서 앱이 꺼진 채로 열렸으면 주소에 여행이 실려 있습니다.
     `showApp` 뒤에 부릅니다 — 먼저 부르면 홈이 그 위를 덮습니다. */
  openFromUrl(location.href);
  /* 프로필 링크로 왔으면 그 사람 화면을 엽니다(b789). 한 번 쓰면 지웁니다 —
     안 지우면 로그인이 새로 될 때마다(계정 전환) 다시 열립니다. */
  const plink = sessionStorage.getItem('t2:plink');
  if (plink){ sessionStorage.removeItem('t2:plink'); openByLink(plink); }

}

/* ── 시작 ───────────────────────────────────────────────────────── */
/* 프로필 링크(?p=CODE, b789)도 초대 링크와 같은 까닭으로 먼저 담아둡니다.
   ⚠ **아래 `?join=` 보다 먼저, 제 것만 지웁니다.** 그쪽은 주소를 통째로
     지우므로 뒤에 두면 코드를 못 읽고, 여기서 통째로 지우면 그쪽이 못 읽습니다. */
{
  const q = new URLSearchParams(location.search);
  const code = q.get('p');
  if (code){
    sessionStorage.setItem('t2:plink', code.trim().toUpperCase());
    q.delete('p');
    const 나머지 = q.toString();
    history.replaceState(null, '', location.pathname + (나머지 ? '?' + 나머지 : ''));
  }
}
/* 초대 링크(?join=CODE)로 들어왔을 수 있습니다. 로그인을 거쳐야 쓸 수 있으므로
   먼저 담아두고 주소는 지웁니다 — 구글에 다녀오는 동안 사라지면 안 됩니다. */
{
  const code = new URLSearchParams(location.search).get('join');
  if (code){
    sessionStorage.setItem('t2:join', code.trim().toUpperCase());
    history.replaceState(null, '', location.pathname);
  }
}
/* 궁합 링크(?mate=FMDP)도 같은 이유로 먼저 담아둡니다 — 구글에 다녀오는
   동안 주소가 사라집니다. 담는 것은 코드 네 글자뿐입니다(mate.js). */
catchMate();

/* 로그인 확인을 무한정 기다리지 않습니다.
   오프라인에서 토큰이 만료돼 있으면 supabase 가 새로 받으러 나가는데,
   그게 안 돌아와서 화면이 "불러오는 중…"에 멈춰 있었습니다.
   3초 안에 답이 없으면 저장해 둔 로그인 정보를 그대로 씁니다 —
   토큰이 낡았어도 화면은 캐시로 돌아가고, 연결되면 알아서 갱신됩니다. */
function storedSession(){
  try {
    const s = JSON.parse(localStorage.getItem('t2-auth') || 'null');
    return s?.access_token && s?.user ? s : null;
  } catch { return null; }
}
/* 끊긴 걸 이미 아는 상태면 물어보지도 않습니다. 저장해 둔 것을 바로 씁니다.
   3초를 기다렸다 캐시를 쓰나, 바로 캐시를 쓰나 결과가 같은데
   앞의 3초는 화면이 멈춰 있는 시간입니다. 그게 "처음 열 때 느리다"의 정체였습니다. */
const session = !netIsDown()
  ? await Promise.race([
      sb.auth.getSession().then(r => r.data.session).catch(() => storedSession()),
      new Promise(r => setTimeout(() => r(storedSession()), 3000)),
    ])
  : storedSession();
await render(session);
sb.auth.onAuthStateChange((_e, s) => { render(s); });

$('ms').textContent = Math.round(performance.now() - t0) + 'ms';
