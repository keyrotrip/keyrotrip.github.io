/* ── 여행 열기 · 머리말 · 실시간 ──────────────────────────────────────
 * 여행 하나를 여는 입구입니다(`openTrip`, 열네 곳이 부릅니다).
 * 서버에서 여행을 받아 화면을 세우고, 일정·지출·일행·예약을 한꺼번에
 * 불러옵니다. 머리말(제목·날짜·통화)도 여기서 그립니다.
 *
 * **실시간도 여기 있습니다.** 일행이 있는 여행은 남이 고친 것이 바로
 * 보여야 합니다 — Supabase 채널을 하나 열어두고, 바뀐 표만 골라 다시
 * 받아옵니다. `bumpTimer` 로 몰아서 처리하는 이유는 한 번에 여러 줄이
 * 바뀌면 그만큼 다시 받게 되기 때문입니다.
 *
 * 여는 것과 지켜보는 것을 한 파일에 둔 이유: **여행을 열 때 채널을 열고
 * 나갈 때 닫습니다.** 떨어뜨리면 한쪽만 고치는 날이 오고, 그러면 채널이
 * 남아 도는 것을 아무도 모릅니다.
 *
 * ── app.js 에서 떼어낸 서른다섯 번째 조각입니다(b359) ────────────────
 * app.js 만 아는 것은 둘 — 로그인한 사람, 지금 어느 앱 탭인지.
 * `channel`·`bumpTimer`·`bumpPending` 은 실시간의 상태라 같이 왔습니다.
 *
 * 층: 아래층과 이미 떼어낸 조각 여럿을 씁니다. 그쪽은 이 파일을 안 부릅니다. */
import { $, esc } from './dom.js?v=b837';
import { sb } from './db.js?v=b837';
import { fail, netTimeout, netIsDown, drawOffbar, cacheGet, cacheSet } from './net.js?v=b837';
import { D1, asDate, dateRange, localTime, todayYmd } from './calc.js?v=b837';
import { trip, plans, legs, members, expenses, bookings,
         setTrip, setPickedDay } from './trip.js?v=b837';
import { loadCities } from './citysearch.js?v=b837';
import { clearCityOpen } from './city.js?v=b837';
import { loadReview } from './review.js?v=b837';
import { loadMembers } from './member.js?v=b837';
import { loadExpenses } from './expense.js?v=b837';
import { loadBookings, loadPacking, loadLinks } from './prep.js?v=b837';
import { inTrip, showTab } from './tabs.js?v=b837';
import { loadLegs, fillCityList } from './legs.js?v=b837';
import { loadPlans, backToList, openedOnToday } from './tripview.js?v=b837';

let ctx = { me: () => null, appTab: () => '' };
export function setOpenTripCtx(o){ ctx = { ...ctx, ...o }; }

/* 실시간의 상태. **app.js 의 let 뭉치에 있던 것을 여기로 옮겼습니다(b359).**
   `channel` 은 지금 열어둔 Supabase 채널, `bumpTimer`·`bumpPending` 은
   바뀐 표를 몰아서 다시 받으려고 잠깐 들고 있는 것입니다.

   ⚠ 옮길 때 app.js 에서 지우고 여기 적는 것을 빼먹어 `channel is not
   defined` 가 났습니다. **check-refs 는 이것을 못 잡습니다** — 지운 순간
   저장소 어디에도 없는 이름이 되어 후보에서 빠지기 때문입니다
   (그 파일 머리말의 '여기서 못 잡는 것' 그대로). 브라우저가 잡았습니다. */
let channel = null, bumpTimer = null, bumpPending = null;

/* ── 날짜 적는 법 ─────────────────────────────────────────────────────
 * `2026-09-12 ~ 2026-09-15` 는 기계가 쓰는 모양입니다. 사람은 이렇게 안 씁니다.
 * 게다가 화면마다 달랐습니다 — 목록은 `2026-09-12 ~ 2026-09-15`,
 * 여행 안은 `09-12 ~ 09-15`. 같은 정보가 두 모양이면 읽는 사람이 두 번 읽습니다.
 *
 * 여기 하나로 모읍니다.
 *   같은 달        9월 12일 – 15일
 *   달이 다름      9월 28일 – 10월 3일
 *   해가 다르면    2027년 1월 3일 – 6일   (올해면 해를 안 적습니다)
 */

/* dateRange/dayLabel 은 calc.js 로 옮겼습니다 (맨 위 import). */

export async function fetchTrip(id){
  const { data, error } = await netTimeout(sb.from('trips')
    .select('*, trip_members(user_id,role)').eq('id', id).maybeSingle());
  /* 여행 한 줄을 못 받으면 그 안으로 아예 못 들어갑니다 — 일정도 지출도 그 뒤입니다.
     캐시는 그 여행을 **한 번 열었을 때** 생깁니다. 비행기모드에서 목록에는 셋이 보이는데
     열어본 적 없는 것을 누르면 "여행을 열지 못했습니다"가 났습니다.
     그래서 목록 캐시에서 최소한을 꺼내 만들어서라도 엽니다 —
     제목·날짜·목적지는 거기 다 있습니다. 빈 화면보다 낫습니다. */
  if (error){
    let old = cacheGet('trip:' + id);
    if (!old){
      const listed = [...(cacheGet('trips:up') || []), ...(cacheGet('trips:past') || [])]
        .find(t => t.id === id);
      if (listed) old = { ...listed, home_currency: listed.currency || 'KRW' };
    }
    if (!old){ fail(error, 'trip'); return false; }
    setTrip(old);
    trip.myRole = (old.trip_members || []).find(m => m.user_id === ctx.me().id)?.role || '';
    drawOffbar();
    return true;
  }
  /* 행이 안 오면 내보내졌거나 여행이 지워진 것입니다. RLS 가 그렇게 만듭니다. */
  if (!data) return false;
  cacheSet('trip:' + id, data);
  setTrip(data);
  trip.myRole = (data.trip_members || []).find(m => m.user_id === ctx.me().id)?.role || '';
  return true;
}

/* localTime 은 calc.js 로 옮겼습니다 (맨 위 import). */

export function drawTripHeader(){
  const days = Math.round((asDate(trip.end_date) - asDate(trip.start_date)) / D1) + 1;
  $('t_title').textContent = trip.title;
  const now = localTime(trip.timezone);
  /* 한 줄로 붙입니다. 지도가 더 잘 보여야 하는 자리라 머리말은 짧을수록 낫습니다.
     연도는 뻔하니 뺍니다 — 목록에서 이미 봤습니다. */
  $('t_meta').textContent = [
    /* 제목과 목적지가 같으면 한 번만 씁니다 — "도쿄 / 도쿄 · 09-12…"는 군더더기입니다. */
    trip.destination === trip.title ? null : trip.destination,
    `${dateRange(trip.start_date, trip.end_date)} · ${days}일`,
    trip.currency, now,
  ].filter(Boolean).join(' · ');
  /* 보기만 가능한 사람에겐 고치는 버튼을 숨깁니다. 막는 것은 RLS 입니다. */
  $('addplanbtn').classList.toggle('hide', trip.myRole === 'viewer');
  $('addexpbtn').classList.toggle('hide', trip.myRole === 'viewer');
  /* 예약 「추가」도 같이(b799) — 여기만 빠져 있어 보기 전용 일행이 눌렀다 저장에서 실패했습니다. */
  $('addbookbtn')?.classList.toggle('hide', trip.myRole === 'viewer');
  $('editbtn').classList.toggle('hide', trip.myRole === 'viewer');
}

export async function openTrip(id){
  if (!await fetchTrip(id))
    return fail(!netIsDown()
      ? '여행을 열지 못했어요.'
      : '연결이 없어서 못 열어요. 한 번이라도 열어본 여행은 비행기모드에서도 열립니다.',
      'trip');
  /* ⚠ **여행 중이면 오늘 날짜부터 엽니다(b805, 사용자 결정 — 밖에서 받은 리포트 P1-5).** 전에는 늘
     「모든 날」이라 여행 둘째 날에 열어도 나흘 치가 한꺼번에 펼쳐졌습니다. 여행 전후는 그대로
     「모든 날」 — 계획을 짤 때는 전체가 보여야 합니다(리포트의 「출발 전엔 Day 1」은 안 따름).
     오늘 일정이 하나도 없으면 첫 일정을 받자마자 「모든 날」로 돌립니다(tripview.js 의 openedOnToday). */
  const 오늘 = todayYmd();
  const 여행중 = !!trip?.start_date && trip.start_date <= 오늘 && 오늘 <= trip.end_date;
  setPickedDay(여행중 ? 오늘 : null);
  if (여행중) openedOnToday(trip.id);
  /* 기록을 하나 쌓아야 화면 밀어서 뒤로 가기가 됩니다.
     이미 여행 안이면(다른 여행으로 건너뛴 경우) 또 쌓지 않습니다. */
  if (history.state?.t2 !== 'trip') history.pushState({ t2:'trip' }, '');

  /* 여행은 어느 탭에서든 열립니다 — 홈에서 열면 홈이 아래에 그대로 남아 있었습니다.
     앱 단계 화면은 하나도 빠짐없이 덮습니다. 돌아갈 탭은 ctx.appTab() 이 기억합니다. */
  /* 탭 화면 다섯은 이제 덱 한 덩어리입니다(b474) — 낱개로 숨기면 덱 안에서
     가로 위치가 밀립니다. */
  ['tabdeck','aiview','cityview','draftview','reviewview']
    .forEach(v => $(v).classList.add('hide'));
  clearCityOpen();
  /* 하단바는 그대로 둡니다. 여행은 '여행' 탭 안쪽이므로 거기에 불을 켭니다 —
     지금 앱의 어디에 있는지가 계속 보여야 합니다. */
  document.querySelectorAll('#appbar button').forEach(b =>
    b.classList.toggle('is-on', b.dataset.a === 'trips'));
  /* 상단바에 여행 안 구역을 띄우고 앱 이름을 접습니다 (app.css 의 .tstrip). */
  inTrip(true);
  $('tripview').classList.remove('hide');
  $('plancard').classList.add('hide');
  $('editcard').classList.add('hide');
  $('expcard').classList.add('hide');
  $('invitebox').classList.add('hide');

  drawTripHeader();
  document.body.classList.add('hastab');
  showTab('plans');
  /* 여기가 여행을 여는 체감 속도를 정합니다. 예전에는 왕복 다섯 번을 **차례로**
     기다렸습니다 — 여행 → 구간 → 검토 → 나머지 → 지출·준비물.
     서울 서버라도 휴대폰에서 한 번에 100ms 안팎이라 그대로 쌓입니다.
     서로 필요 없는 것끼리는 같이 보냅니다.

     남겨둔 순서 두 가지는 이유가 있습니다.
       · 구간(legs) 먼저 — 날짜 칩에 도시 이름이 붙고 지출 통화가 여기서 정해집니다.
         나중에 오면 칩을 한 번 그린 뒤 다시 그려야 합니다.
       · 일행 먼저 — 지출과 준비물이 사람 이름을 씁니다.
     대신 일행은 구간을 기다릴 이유가 없어 **같이 출발**시킵니다. */
  const membersP = loadMembers();
  const citiesP  = loadCities();
  await loadLegs();
  await Promise.all([
    loadPlans(), loadBookings(), loadLinks(), citiesP,
    membersP.then(() => Promise.all([loadExpenses(), loadPacking()])),
  ]);
  fillCityList();
  watch();
  /* 일정 검토 배지는 숫자 하나입니다. 이걸 기다리느라 화면 전체가 늦을 이유가
     없습니다. 뒤로 보냅니다 — 늦게 와도 배지만 나중에 켜집니다. */
  loadReview();
}

/* ── 실시간 ─────────────────────────────────────────────────────────
 * 도쿄 앱은 8초마다 getRevision 을 물어보고 다르면 화면을 통째로 덮었습니다.
 * 여기서는 바뀐 표만 듣고 그 부분만 다시 그립니다. REV 는 없앴습니다.
 * 여러 변경이 몰아쳐 올 때 매번 다시 그리면 화면이 떨리므로 잠깐 모았다 한 번 그립니다. */
function watch(){
  unwatch();
  const f = 'trip_id=eq.' + trip.id;
  channel = sb.channel('trip:' + trip.id)
    .on('postgres_changes', { event:'*', schema:'public', table:'plans',        filter:f },
        () => bump('plans'))
    .on('postgres_changes', { event:'*', schema:'public', table:'expenses',     filter:f },
        () => bump('expenses'))
    .on('postgres_changes', { event:'*', schema:'public', table:'bookings',     filter:f },
        () => bump('prep'))
    .on('postgres_changes', { event:'*', schema:'public', table:'packing',      filter:f },
        () => bump('prep'))
    .on('postgres_changes', { event:'*', schema:'public', table:'links',        filter:f },
        () => bump('expenses'))
    .on('postgres_changes', { event:'*', schema:'public', table:'trip_legs',    filter:f },
        () => bump('legs'))
    .on('postgres_changes', { event:'*', schema:'public', table:'trip_members', filter:f },
        () => bump('members'))
    .on('postgres_changes', { event:'*', schema:'public', table:'trips',
                              filter:'id=eq.' + trip.id },
        () => bump('trip'))
    /* ⚠ 여기서 `#live`(● 바로 반영) 를 켜고 껐습니다. **b367 에서 없앴습니다** —
       사연은 index.html 의 그 자리에 적어뒀습니다. 구독은 그대로 하고
       상태만 화면에 안 알립니다. */
    .subscribe();
}
export function unwatch(){
  if (channel){ sb.removeChannel(channel); channel = null; }
  clearTimeout(bumpTimer); bumpPending = null;
}
function bump(what){
  (bumpPending ||= new Set()).add(what);
  clearTimeout(bumpTimer);
  bumpTimer = setTimeout(async () => {
    const s = bumpPending; bumpPending = null;
    if (!trip) return;
    if (s.has('trip')){
      /* 여행 자체가 바뀌었습니다. 내가 빠졌거나 지워졌으면 목록으로 돌려보냅니다. */
      if (!await fetchTrip(trip.id)){
        backToList();
        return fail('이 여행에서 나갔거나 여행이 지워졌어요.', 'trip');
      }
      drawTripHeader();
    }
    /* 구간이 바뀌면 날짜 칩의 도시와 지출 통화가 따라 바뀝니다. */
    if (s.has('legs')){ await loadLegs(); await loadReview(); }
    if (s.has('trip')) await loadReview();   /* 날짜가 바뀌면 끝난 여행인지도 바뀝니다 */
    if (s.has('plans') || s.has('trip') || s.has('legs')) await loadPlans();
    /* 일행이 바뀌면 지출에 찍힌 이름과 정산 인원도 따라 바뀝니다. */
    if (s.has('members')) { await loadMembers(); await loadExpenses(); await loadPacking(); }
    else if (s.has('expenses')) await loadExpenses();
    if (s.has('prep'))
      await Promise.all([loadBookings(), loadPacking(), loadLinks()]);
  }, 250);
}

