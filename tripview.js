/* ── 여행 상세의 뼈대 — 날짜 줄 · 일정 받아오기 · 정보 수정 ───────────
 * 여행 하나를 열었을 때 화면을 세우는 자리입니다.
 *
 *   `drawDays`     Day 1 · Day 2 … 날짜 줄. 여덟 곳이 부릅니다.
 *   `loadPlans`    일정을 서버에서 받아 그립니다. **열다섯 곳**이 부릅니다.
 *   `backToList`   여행에서 빠져나갈 때 열려 있던 화면을 다 닫습니다.
 *   정보 수정      제목 · 날짜 · 예산. 날짜를 바꾸면 일정도 같이 밀립니다
 *                  (`shiftDays`) — 안 그러면 3박 4일이 2박이 되면서 마지막
 *                  날 일정이 갈 곳을 잃습니다.
 *
 * ── app.js 에서 떼어낸 서른세 번째 조각입니다(b357) ──────────────────
 * SPLIT.md 에 오래 'ctx 12, 일정 화면과 깊이 물려 있다 — 일정 뒤에' 라고
 * 적어둔 자리입니다. 일정 화면(planview)·구간(legs)·탭(tabs)이 먼저 나가니
 * **넷으로 줄었습니다.** 순서가 값을 정합니다.
 *
 * `backToList` 가 닫는 화면이 많은 것은 이 앱이 시트를 겹쳐 쓰기 때문입니다 —
 * 여행 → 도시 → 지도처럼 쌓인 것을 한 번에 걷어내야 목록이 제대로 보입니다.
 *
 * 층: 아래층과 이미 떼어낸 조각 여럿을 씁니다. 그쪽은 이 파일을 안 부릅니다. */
import { $, esc, toast, coverDeck } from './dom.js?v=b819';
import { photosOpen, closePhotos } from './photoview.js?v=b819';
import { sb } from './db.js?v=b819';
import { fail, netTimeout, drawOffbar, NOROW } from './net.js?v=b819';
import { D1, asDate, ymd, dayLabel, todayYmd } from './calc.js?v=b819';
import { trip, plans, legs, pickedDay, catFilter,
         setPickedDay, setPlans, setCatFilter, clearTrip } from './trip.js?v=b819';
import { drawCats, catsOpen, setCatsOpen } from './planline.js?v=b819';
import { drawPlanMap } from './planmap.js?v=b819';
import { drawPlans } from './planview.js?v=b819';
import { legIn, fillCityList } from './legs.js?v=b819';
import { inTrip } from './tabs.js?v=b819';
import { closeAi } from './aiscreen.js?v=b819';
import { closeDraft } from './draft.js?v=b819';
import { closeReview } from './home.js?v=b819';
/* 연속 평가(b409). 기록 탭을 통째로 덮으므로 뒤로가기가 여기를 먼저 닫습니다. */
import { closeSpree } from './spree.js?v=b819';
import { closeCity, isCityOpen } from './city.js?v=b819';
import { closeMap, closeCountries } from './map.js?v=b819';
import { closePersona } from './persona.js?v=b819';
/* 지구본 나라 카드(b555). 뒤로가기 사슬이 이것부터 닫습니다. */
import { 시트닫기 } from './home.js?v=b819';
import { closeShelf, 거르개닫기 } from './shelf.js?v=b819';
import { 나라거르개닫기 } from './rating.js?v=b819';
import { closeDiary } from './diary.js?v=b819';
import { closeDocs } from './prep.js?v=b819';
import { is16Open, is16Grid, close16, close16Grid } from './p16.js?v=b819';
import { isPersonOpen, personBack } from './people.js?v=b819';
import { isFriendsOpen, closeFriends } from './friends.js?v=b819';
import { isSetSubOpen, closeSetSub } from './setnav.js?v=b819';
/* 다시 간 도시 시트(성향 v2) — 분석 탭 위에 뜨는 시트라 사슬 맨 위쪽에서 닫습니다. */
import { isVisitsOpen, closeVisits } from './visits.js?v=b819';

let ctx = { appTab: () => '', showApp: () => {},
            openTrip: async () => {}, drawToday: () => {} };
export function setTripViewCtx(o){ ctx = { ...ctx, ...o }; }

/* ── 여행 정보 수정 ─────────────────────────────────────────────── */
$('editbtn').addEventListener('click', () => {
  $('editcard').classList.toggle('hide');
  $('editerr').classList.add('hide');
  if ($('editcard').classList.contains('hide')) return;
  $('e_title').value = trip.title;
  $('e_start').value = trip.start_date;
  $('e_end').value   = trip.end_date;
  /* 예산은 정산 통화 기준입니다. 어느 돈인지 안 적으면 엔인지 원인지 모릅니다. */
  $('e_budget').value = trip.budget ? Number(trip.budget).toLocaleString('ko-KR') : '';
  $('e_budgetcur').textContent = trip.home_currency ? `· ${trip.home_currency}` : '';
  $('e_shift').checked = true;
  syncShiftText();
  fillCityList();
  /* 새 구간 기본값: 마지막 구간 다음 날부터 여행 끝까지 */
  const last = legs[legs.length - 1];
  $('g_start').value = last ? ymd(new Date(asDate(last.end_date).getTime() + D1))
                            : trip.start_date;
  $('g_end').value = trip.end_date;
});
$('e_cancel').addEventListener('click', () => {
  $('editcard').classList.add('hide'); $('editerr').classList.add('hide');
});

/* 며칠 밀리는지 미리 보여줍니다. 체크만 있고 숫자가 없으면
   무슨 일이 일어날지 모른 채 누르게 됩니다. */
function shiftDays(){
  if (!$('e_start').value) return 0;
  return Math.round((asDate($('e_start').value) - asDate(trip.start_date)) / D1);
}
function syncShiftText(){
  const n = shiftDays();
  $('e_end').min = $('e_start').value || '';
  $('e_shifttext').textContent = n === 0
    ? '일정도 같이 옮기기 (날짜를 바꾸면 켜집니다)'
    : `일정 ${plans.length}개를 ${Math.abs(n)}일 ${n > 0 ? '뒤로' : '앞으로'} 옮기기`;
}
$('e_start').addEventListener('change', () => {
  /* 시작을 옮기면 끝도 같이 끌고 갑니다. 기간을 유지하는 쪽이 흔한 뜻입니다. */
  const n = shiftDays();
  if (n !== 0) $('e_end').value = ymd(new Date(asDate(trip.end_date).getTime() + n * D1));
  syncShiftText();
});
$('e_end').addEventListener('change', syncShiftText);

$('e_save').addEventListener('click', async () => {
  const btn = $('e_save');
  $('editerr').classList.add('hide');
  const title = $('e_title').value.trim();
  const start = $('e_start').value, end = $('e_end').value;

  if (!title)       return fail('제목을 적어주세요.', 'edit');
  if (!start || !end) return fail('날짜를 골라주세요.', 'edit');
  if (end < start)  return fail('끝나는 날이 시작보다 빨라요.', 'edit');
  const days = Math.round((asDate(end) - asDate(start)) / D1) + 1;
  if (days > 365)   return fail(`${days}일은 너무 길어요. 날짜를 다시 봐주세요.`, 'edit');

  /* 1,500,000 처럼 쉼표를 넣는 사람이 많습니다. 지출 칸과 같은 방식으로 걸러냅니다. */
  const braw = $('e_budget').value.replace(/[,\s]/g, '');
  const budget = braw === '' ? null : Number(braw);
  if (budget !== null && (!isFinite(budget) || budget <= 0))
    return fail('예산을 숫자로 적어주세요. 비워두셔도 됩니다.', 'edit');

  const n = shiftDays();
  btn.disabled = true; btn.innerHTML = '<span class="load">저장 중…</span>';

  let up = await sb.from('trips')
    .update({ title, start_date: start, end_date: end, budget }).eq('id', trip.id)
    .select('id');
  /* 034 를 아직 안 올렸으면 budget 칸이 없어서 통째로 실패합니다.
     그때는 예산만 빼고 나머지는 저장되게 합니다. */
  if (up.error && /budget/i.test(up.error.message || '')){
    up = await sb.from('trips')
      .update({ title, start_date: start, end_date: end }).eq('id', trip.id).select('id');
    if (!up.error) toast('예산은 아직 저장되지 않아요. 곧 됩니다.');
  }

  if (!up.error && up.data?.length && n !== 0 && $('e_shift').checked && plans.length){
    /* 한 줄씩 고치면 요청이 여러 번 나가고 중간에 끊기면 반만 옮겨집니다.
       서버 함수 하나로 한 번에 처리합니다. */
    const sh = await sb.rpc('shift_trip_days', { p_trip: trip.id, p_days: n });
    if (sh.error){ btn.disabled = false; btn.textContent = '저장';
                   return fail(sh.error, 'edit'); }
  }

  btn.disabled = false; btn.textContent = '저장';
  if (up.error) return fail(up.error, 'edit');
  if (!up.data?.length)
    return fail(NOROW.edit, 'edit');

  $('editcard').classList.add('hide');
  setPickedDay(null);
  await ctx.openTrip(trip.id);
});

/* 여행에 들어갈 때 브라우저 기록을 하나 쌓아 뒀습니다(openTrip).
   그래야 아이폰에서 화면을 밀어 뒤로 가기가 됩니다.
   ← 버튼도 같은 길로 보내야 기록과 화면이 어긋나지 않습니다. */
export function backToList(fromPop){
  if (!fromPop && history.state?.t2 === 'trip'){ history.back(); return; }
  clearTrip();
  $('tripview').classList.add('hide'); inTrip(false);
  ctx.showApp(ctx.appTab() === 'set' ? 'trips' : ctx.appTab());
}
$('backbtn').addEventListener('click', () => backToList());
/* 뒤로 갈 때는 **위에 얹힌 것부터** 닫습니다. 순서가 곧 화면의 층입니다.
   여기 순서가 뒤집혀 있어서, 여행 안에서 여행 비서를 열고 닫으면 비서가 아니라
   **여행이 닫혔습니다** — trip 검사가 aiview 검사보다 위에 있어서 그 줄까지
   가지도 못했습니다. 시트는 여행 위에 뜨는 것이니 항상 먼저 봅니다. */
window.addEventListener('popstate', () => {
  /* 0) 사진 크게 보기가 **제일 위**입니다(b581) — 전체 화면을 덮고, 무엇
        위에서든 열립니다(일기장에서도 후기에서도). 그래서 맨 먼저 봅니다. */
  if (photosOpen()) return closePhotos(true);
  /* 0-1) 다른 사람 화면·친구 화면(b789). 도시 화면·멤버·알림 **위에서**
        열리고, 거기서 다른 판을 더 열지 않습니다 — 그래서 사진 바로 다음입니다.
        사람 화면은 친구 화면 위에서도 열리므로 사람을 먼저 묻습니다. */
  if (isPersonOpen()) return personBack(true);   /* 들어간 판(b799)이 있으면 한 겹만 */
  if (isFriendsOpen()) return closeFriends(true);
  /* 0-2) 다시 간 도시 시트(성향 v2) — 분석 탭 위에 얹히고, 거기서 다른 판을 안 엽니다. */
  if (isVisitsOpen()) return closeVisits(true);
  /* 1) 화면 위에 떠 있는 것 */
  /* 지구본에서 나라를 눌러 뜬 카드가 제일 위입니다(b555) — 다른 무엇보다
     늦게 열리고 화면 아래에 얹힙니다. */
  /* ⚠⚠ **이 줄 하나가 뒤로가기를 통째로 죽이고 있었습니다(b647).**
     예전엔 `if (!$('gsheet')?.classList.contains('hide'))` 였습니다.
     `#gsheet` 는 **마크업에 없고** 지구본에서 나라를 누를 때야
     home.js 가 만듭니다. 그 전까지는 `$('gsheet')` 가 null 이므로
       null?.classList.contains('hide')  →  undefined
       !undefined                        →  **true**
     가 되어 **모든 뒤로가기가 여기서 멈췄습니다.** 시트닫기는
     판이 없으면 조용히 돌아오고, `return` 이 사슬을 끊습니다 —
     도시도 보관함도 일기도 여행도 뒤로가기로 안 닫혔습니다.
     사용자 신고 「화면이 짬뽕」「위아래가 잘리는 스크롤 오류」가
     상당 부분 이것입니다 — 닫힐 줄 알았던 판이 계속 서 있었습니다.
     ⚠ **`?.` 는 「없을 때 터지는 것」만 막습니다 — 그 값을 부정하면
       없는 것이 「있고 열려 있다」로 변합니다.** 없는 것을 물을 때는
       있는지를 먼저 묻고, 그 뒤에 상태를 묻습니다. */
  if ($('gsheet') && !$('gsheet').classList.contains('hide')) return 시트닫기(true);
  if (!$('aiview').classList.contains('hide')) return closeAi(true);
  /* 2) 통째로 덮는 화면 */
  /* 서류가 제일 위입니다 — 여행 안에서 열리고 그 위를 다 덮습니다. */
  if (!$('docview').classList.contains('hide')) return closeDocs(true);
  if (isCityOpen()) return closeCity(true);
  /* 연속 평가는 기록 탭을 통째로 덮습니다(b409). 도시 화면보다 아래, 검토보다 위. */
  if (!$('spreeview').classList.contains('hide')) return closeSpree(true);
  if (!$('reviewview').classList.contains('hide')) return closeReview(true);
  if (!$('draftview').classList.contains('hide')) return closeDraft(true);
  /* ⚠⚠ **보관함 «시트»가 보관함보다 위입니다(b673).** 보관함 위에 얹혀
     열리므로 먼저 닫혀야 합니다. 이 줄이 아래로 내려가면 뒤로가기 한 번에
     시트와 보관함이 같이 닫힙니다.
   ⚠ `#shsheet` 는 **마크업에 있습니다**(만들어 쓰지 않습니다) — 그래서
     b647 의 `?.` 덫이 안 생깁니다. 그래도 있는지를 먼저 묻습니다. */
  if ($('shsheet') && !$('shsheet').classList.contains('hide'))
    return 거르개닫기(true);
  /* ⚠⚠ **도감이 제일 위입니다(b737).** 분석 탭을 덮는 판입니다.
     첫 화면은 카드 캐러셀이고, 「모아보기」 격자가 «한 겹 더» 얹힙니다.
     그래서 격자를 먼저 묻습니다 — 차례를 바꾸면 격자에서 뒤로가기 한 번에
     도감까지 같이 닫힙니다.
     ⚠ 도시 화면(city.js)보다 «아래»입니다 — 도감에서는 도시로 못 갑니다. */
  if (is16Grid()) return close16Grid(true);
  if (is16Open()) return close16(true);
  /* 평가 탭 거르개 시트(b676). 보관함 시트와 같은 층입니다 — 둘이 동시에
     열릴 일은 없지만 차례는 정해 둡니다. */
  if ($('rtsheet') && !$('rtsheet').classList.contains('hide'))
    return 나라거르개닫기(true);
  if (!$('shelfpane').classList.contains('hide')) return closeShelf(true);
  if (!$('diarypane').classList.contains('hide')) return closeDiary(true);
  if (!$('personapane').classList.contains('hide')) return closePersona(true);
  /* ⚠ **프로필 안의 두 겹(b760)** — 종이 여는 알림(`#notifpane`)과 톱니가
     여는 설정(`#setpane`). 둘 다 프로필 위에 한 겹 얹히므로 여기가 자리입니다.
   ⚠ 닫는 일이 클래스 토글뿐이라 **여기서 바로** 합니다. app.js 의 함수를
     불러 쓰면 tripview ↔ app 고리가 생깁니다.
   ⚠ 설정은 뒤로가기 기록을 안 쌓습니다(`#setback` 이 그 일을 합니다).
     그래도 사슬에 둡니다 — 알림에서 설정으로 넘어간 뒤의 뒤로가기가
     여기까지 내려옵니다. */
  /* 설정의 항목 화면(b790) — 설정 «안»의 한 겹이라 설정보다 먼저 봅니다.
     안 그러면 알림 화면에서 뒤로가기 한 번에 설정이 통째로 닫힙니다. */
  if (isSetSubOpen()) return closeSetSub(true);
  for (const id of ['notifpane', 'setpane', 'editpane']){
    const el = $(id);
    if (el && !el.classList.contains('hide')){
      el.classList.add('hide');
      $('profpane')?.classList.remove('hide');
      coverDeck(false);
      return;
    }
  }
  /* ⚠ 나라 지도(#cmappane)는 b707 에 없앴습니다 — 지구본이 직접 도시까지
     보여주므로 그 판이 아예 안 만들어집니다. 사슬에서도 뺐습니다. */
  if (!$('ctrypane').classList.contains('hide')) return closeCountries(true);
  if (!$('mappane').classList.contains('hide')) return closeMap(true);
  /* 3) 마지막이 여행입니다. 위의 것들이 다 닫힌 뒤에야 여기로 옵니다. */
  if (trip) return backToList(true);
});

/* 여행 중이라 「오늘」로 연 여행(b805) — opentrip.js 의 openTrip 이 적습니다. 첫 일정이 오면 한 번만 봅니다:
   오늘 일정이 하나도 없으면 「모든 날」로 돌립니다. 그대로 두면 여는 순간 「이 날은 아직 비어 있어요」 빈 판만
   서고(위 오늘 카드도 일정이 없으면 안 뜹니다) 다른 날을 보려면 한 번 더 눌러야 합니다 — 예전처럼 전체가 낫습니다.
   첫 번만 보는 이유 — 그 뒤에 사용자가 고른 날은 건드리지 않습니다. */
let 오늘로연여행 = null;
export function openedOnToday(id){ 오늘로연여행 = id; }

export async function loadPlans(){
  $('planerr').classList.add('hide');
  /* ⚠ **늦은 답 막기(b799, GPT 리포트 P0-2).** 여행 A 를 열다 곧바로 B 로 가면 A 의 답이 늦게
     와서 B 화면에 그려지고, 저장 열쇠도 기다린 «뒤의» trip.id(=B)로 만들어져 B 이름으로
     담겼습니다. 묻기 전에 여행을 잡아 두고, 답이 오면 아직 그 여행인지 봅니다.
     (지출·일행·예약·준비물·링크·구간 불러오기도 같은 수법 — 거기엔 짧게만 적었습니다.) */
  const 그여행 = trip.id;
  const { data, error } = await netTimeout(sb.from('plans')
    .select('id,date,start_time,end_time,category,title,memo,move_note,sort_order,lat,lng')
    .eq('trip_id', 그여행)
    .is('deleted_at', null)                     /* 숨긴 것은 빼고 봅니다 */
    .order('date').order('start_time', { nullsFirst:false }).order('sort_order'));
  if (trip?.id !== 그여행) return;
  const 오늘확인 = rows => {
    if (오늘로연여행 !== 그여행) return;
    오늘로연여행 = null;
    if (pickedDay && !(rows || []).some(p => p.date === pickedDay)) setPickedDay(null);
  };

  /* 못 받아왔을 때 마지막으로 받아둔 것을 씁니다.
     여행 중에 데이터가 끊겼다고 일정이 빈 화면이 되면 안 됩니다.
     대신 오래된 것을 보고 있다고 위에 띄웁니다 (offbar). */
  const ck = 't2:cache:plans:' + 그여행;
  if (error){
    let old = null;
    try { old = JSON.parse(localStorage.getItem(ck) || 'null'); } catch {}
    if (!old){ $('plans').innerHTML = ''; return fail(error, 'plan'); }
    setPlans(old); 오늘확인(old); drawDays(); drawCats(); drawPlans(); drawPlanMap(); drawOffbar();
    return;
  }
  try { localStorage.setItem(ck, JSON.stringify(data)); } catch {}
  setPlans(data);
  오늘확인(data);
  drawDays();
  drawCats();
  drawPlans();
  drawPlanMap();
  ctx.drawToday();       /* 여행 중이면 맨 위에 오늘 카드 */
}

function shortLabel(d){
  const lab = dayLabel(d, trip);
  const base = lab.startsWith('Day') ? lab.split(' · ')[0]
                                     : lab.split(' · ')[1] + ' ' + d.slice(5).replace('-','/');
  /* 도시를 여럿 도는 여행이면 Day 번호만으로는 어디인지 모릅니다.
     **그 날이 실제로 들어 있는 구간만** 씁니다. 가장 가까운 구간으로
     떨어뜨리면 어느 날이든 도시 이름이 붙는데, 그게 틀린 이름이면
     "Day 1 · 바젤" 같은 것이 나옵니다. 모르면 안 적는 편이 낫습니다. */
  const l = legs.length > 1 ? legIn(d) : null;
  return l ? `${base} · ${l.destination}` : base;
}

export function drawDays(){
  /* 여행 기간의 날짜 + 기간 밖에 일정이 있는 날짜를 합칩니다.
     한국에서 미리 산 항공권처럼 기간 밖 일정이 실제로 생깁니다. */
  const set = new Set();
  for (let d = asDate(trip.start_date);
       ymd(d) <= trip.end_date; d = new Date(d.getTime() + D1)) set.add(ymd(d));
  plans.forEach(p => set.add(p.date));
  const list = [...set].sort();

  /* 그냥 '전체'라고만 적혀 있었습니다. 바로 아래 분류 칩도 '전체'로 시작해서
     같은 글자가 두 줄에 나란히 놓였고, 어느 것이 날짜고 어느 것이 분류인지
     알 수가 없었습니다. 라벨을 따로 붙이면 세로가 더 길어지므로
     (칩 줄이 이미 화면을 많이 먹습니다) 칩 자신이 말하게 합니다. */
  const all = `<button class="day${pickedDay === null ? ' on' : ''}" data-day="">모든 날</button>`;

  /* 짧은 여행은 칩이 한눈에 들어와서 낫습니다.
     길어지면 칩이 벽이 됩니다 — 29일짜리는 세 줄을 잡아먹었습니다.
     그때는 고르는 칸 하나로 바꿉니다. */
  /* ⚠⚠ **「분류」를 날짜 줄에서 «제목 줄»로 옮겼습니다(b642).**
     전에는 이 줄 맨 끝에 칩으로 붙였고, 그 근거가 「날짜 줄이 이미
     옆으로 굴러가서 자리가 공짜」였습니다. **그게 틀렸습니다** —
     굴러가는 줄의 끝은 «공짜 자리»가 아니라 **안 보이는 자리**입니다.
     날이 많은 여행에서 분류가 오른쪽 밖으로 밀려 아예 안 보였습니다
     (사용자 지적). 제목 줄은 안 굴러가므로 언제나 같은 자리입니다.
     ⚠ 상태(거르는 중인 분류 이름·켜짐)는 그대로 나릅니다 — 자리만
       옮긴 것이지 뜻을 줄인 것이 아닙니다. */
  const used = new Set(plans.map(p => p.category).filter(Boolean));
  {
    const cb = $('catbtn');
    if (cb){
      cb.classList.toggle('hide', used.size < 2);
      cb.classList.toggle('on', !!(catFilter || catsOpen));
      cb.textContent = catFilter || '분류';
    }
  }

  /* 오늘 칩에는 「· 오늘」(b805) — 여행 중에 열면 이 칩이 켜진 채로 열립니다(opentrip.js). 왜 이 날이
     골라져 있는지를 칩이 스스로 말합니다. */
  const 오늘 = todayYmd(), 오늘말 = d => (d === 오늘 ? ' · 오늘' : '');
  if (list.length <= 12){
    $('days').innerHTML = all + list.map(d =>
      `<button class="day${pickedDay === d ? ' on' : ''}" data-day="${esc(d)}">` +
      `${esc(shortLabel(d) + 오늘말(d))}</button>`).join('');
  } else {
    $('days').innerHTML = all +
      `<select id="daysel"><option value="">날짜 고르기…</option>` +
      list.map(d => `<option value="${esc(d)}"${pickedDay === d ? ' selected' : ''}>` +
                    `${esc(dayLabel(d, trip) + 오늘말(d))}</option>`).join('') +
      `</select>`;
  }
  /* 옆으로 굴러가는 줄이라, 고른 날이 화면 밖이면 안 보입니다.
     Day 9 를 골라두고 돌아왔을 때 어디가 켜져 있는지 알 수가 없습니다. */
  const on = $('days').querySelector('.day.on[data-day]');
  if (on) on.scrollIntoView({ block:'nearest', inline:'center' });
}

/* 분류 칩 줄을 폈는지. 거르는 중이면 강제로 펴 둡니다 — 접힌 채로 걸러지면
   왜 목록이 짧은지 알 길이 없습니다. */
/* catsOpen 은 planline.js 로 갔습니다(b353) — 읽는 곳이 거기 drawCats
   뿐입니다. 누르는 손잡이는 여기 남아 setCatsOpen 으로 넣습니다. */
/* ⚠ 손잡이도 제목 줄로 따라갑니다. `#catbtn` 은 «다시 안 만들어지는»
   단추라 위임할 필요 없이 한 번만 답니다(칩은 매번 새로 그려져서
   `#days` 에 위임하고 있었습니다). */
$('catbtn').addEventListener('click', () => {
  setCatsOpen(!catsOpen);
  if (!catsOpen && catFilter) setCatFilter('');
  drawDays(); drawCats(); drawPlans(); drawPlanMap();
});

$('days').addEventListener('change', e => {
  if (e.target.id !== 'daysel') return;
  setPickedDay(e.target.value || null);
  drawDays(); drawCats(); drawPlans(); drawPlanMap();
});

