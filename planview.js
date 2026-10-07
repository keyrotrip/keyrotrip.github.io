/* ── 일정 화면 — 그리기와 끌어서 순서 바꾸기 ──────────────────────────
 * 하루치 일정을 줄로 그리고, 손가락으로 끌어 순서를 바꿉니다.
 *
 * **목록은 `date · start_time · sort_order` 로 줄을 세웁니다**(loadPlans).
 * 그래서 `sort_order` 만 바꾸면 **시각이 있는 줄은 놓자마자 제자리로**
 * 돌아갑니다 — 그 사연은 아래 주석에 그대로 있습니다.
 *
 * ── app.js 에서 떼어낸 서른 번째 조각입니다(b354) ────────────────────
 * SPLIT.md 가 오래 '마지막' 이라고 적어둔 자리입니다. 처음 쟀을 때 ctx 가
 * **11** 이었는데, 다른 조각을 떼어내면서 **5 → 4** 로 떨어졌습니다.
 * 아래층으로 내린 것들(`putHtml`·`planline`·`plancheck`)이 여기서 쓰던
 * 것들이라 그렇습니다 — **얽힌 것을 먼저 풀면 어려운 자리도 싸집니다.**
 *
 * `legFor` 는 `legNear(legs, 날짜)` 한 줄 래퍼라 그냥 버리고 직접 부릅니다
 * (b335 에 expense.js 에서 한 것과 같습니다).
 *
 * app.js 만 아는 것은 셋 — 기능 스위치 둘, 일정 다시 받기.
 *
 * 층: dom.js · net.js · calc.js · trip.js 와 이미 떼어낸
 *     planline.js · planmap.js · plancheck.js 를 씁니다. */
import { $, esc, emptyDo } from './dom.js?v=b835';
import { featOn, flags } from './flags.js?v=b835';
import { fail, write } from './net.js?v=b835';
import { dayLabel, hm, hop, money, legNear, 좌표수상, 같은곳, 붙은칸, 이동줄인가 } from './calc.js?v=b835';
import { trip, plans, legs, expenses, setPlans, pickedDay, catFilter } from './trip.js?v=b835';
import { dayStat, lineChips, nice, parseMemo } from './planline.js?v=b835';
import { drawPlanMap, mapLinks } from './planmap.js?v=b835';
import { STAY_MIN, mins } from './plancheck.js?v=b835';
/* 좌표 없는 줄에서 그 한 곳만 찾습니다. **cands.js 는 이 파일을 안 부르므로
   고리가 안 생깁니다**(b375 에 확인). */
import { fillOnePlan } from './cands.js?v=b835';

let ctx = { loadPlans: async () => {} };
export function setPlanViewCtx(o){ ctx = { ...ctx, ...o }; }

/* 어느 일정 줄을 펼쳐 놓았나. **app.js 에 있던 것을 여기로 옮겼습니다(b354)** —
   그리는 쪽이 여기라 여기가 맞습니다. Set 이라 import 한 쪽과 같은 것을
   보므로, 누르는 손잡이(app.js)가 add/delete 해도 여기 그대로 보입니다 —
   값이 아니라 그릇이라서 그렇습니다. */
export const openPlans = new Set();

/* ── 끌어서 순서 바꾸기 ─────────────────────────────────────────────
 * **목록은 `date · start_time · sort_order` 로 줄을 세웁니다**(loadPlans).
 * 그래서 `sort_order` 만 바꾸면 시각이 있는 줄은 **놓자마자 제자리로
 * 돌아갑니다.** 순서를 손으로 바꾸려면 시각을 같이 다뤄야 합니다.
 *
 * 규칙은 하나입니다 — **시각은 그 자리에 그대로 있고 일정만 자리를 옮깁니다.**
 * 하루의 시각들을 자리표로 보고, 새 순서에 앞에서부터 다시 나눠 줍니다.
 *   09:00 A · 12:00 B · 15:00 C   에서 A 를 맨 뒤로 끌면
 *   09:00 B · 12:00 C · 15:00 A
 * 하루의 뼈대(언제 움직이는가)가 안 흔들리고, 도로 끌면 그대로 되돌아옵니다.
 * 시각이 없는 줄은 없는 채로 남고 `sort_order` 만 따라갑니다.
 *
 * **분류로 거르는 중에는 손잡이를 안 답니다.** 걸러진 목록에서 끌면
 * 화면에 없는 줄의 시각까지 섞여 돌아갑니다 — 보이지 않는 것이 바뀝니다. */
const canReorder = () =>
  trip?.myRole !== 'viewer' && !catFilter && featOn('reorder') && !flags.readonly;

let dragOn = null;      /* {el, hole, id, date, dy, ids} */

function evRows(date){
  return [...$('plans').querySelectorAll(`.ev[data-d="${CSS.escape(date)}"]`)];
}

/* ── 꾹 눌러야 끌립니다 (b367) ────────────────────────────────────────
 * 전에는 손잡이에 손가락이 닿는 순간 바로 끌기가 시작됐고, 손잡이에는
 * `touch-action:none` 이 걸려 있어 **브라우저가 그 자리에서는 스크롤을
 * 아예 못 했습니다.** 손잡이 폭이 28px 인데 일정 줄마다 하나씩 있으니,
 * 목록을 굴리려다 거기 닿으면 굴러가는 대신 일정이 끌려갔습니다 —
 * 사용자가 "스크롤하다가 자꾸 눌러져서 일정이 꼬인다"고 한 것이 이것입니다.
 *
 * 이제 **가만히 누르고 있어야** 시작합니다. 그 전에 손가락이 움직이면
 * 굴리려는 것으로 보고 없던 일로 합니다.
 *   · 손잡이의 `touch-action` 을 `pan-y` 로 바꿨습니다(app.css) — 평소에는
 *     브라우저가 그냥 굴립니다.
 *   · 끌기가 시작된 뒤에는 `touchmove` 를 막아 굴림을 끊습니다. **iOS 는
 *     `pointermove` 의 preventDefault 로는 안 멈춥니다** — 아래 따로 답니다.
 *   · 아직 안 움직였을 때 시작하므로 굴림이 시작되기 전에 가로챕니다.
 * 마우스는 그대로 바로 끕니다 — 굴리기와 헷갈릴 일이 없습니다. */
const HOLD_MS = 320, MOVE_TOL = 8;

/* 핀 아이콘. 「위치 찾기」와 「위치 확인」 둘이 같은 그림을 씁니다(b732) —
   두 번 적으면 한쪽만 고치는 날이 옵니다.
   ⚠ 크기는 CSS 로 줍니다(`.nogeo svg`) — b561 에 0×0 으로 찌그러진 함정. */
const 핀아이콘 = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
  ><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle
      cx="12" cy="10" r="2.4"/></svg>`;
let holdTimer = null, holdAt = null;

const cancelHold = () => { clearTimeout(holdTimer); holdTimer = null; holdAt = null; };

function startDrag(grip, x, y, pointerId){
  const el = grip.closest('.ev');
  if (!el) return;
  const r = el.getBoundingClientRect();
  /* 손가락을 붙잡아 둡니다. 안 그러면 목록 밖(지도 위 등)으로 나가는 순간
     움직임이 끊깁니다. **못 붙잡아도 그냥 갑니다** — 붙잡기는 나아지자고
     하는 것이지 없으면 못 하는 일이 아닙니다. */
  try { if (pointerId != null) grip.setPointerCapture(pointerId); } catch {}
  document.body.classList.add('reordering');

  /* 빈 칸은 **같은 높이**로 만들어 둡니다. 안 그러면 들어올리는 순간
     목록이 위로 솟아서 손가락 밑이 딴 곳이 됩니다. */
  el.style.width  = r.width + 'px';
  el.style.height = r.height + 'px';
  const hole = el.cloneNode(true);
  hole.classList.add('hole');
  hole.removeAttribute('data-ev');
  el.after(hole);

  el.classList.add('lift');
  el.style.left = r.left + 'px';
  el.style.top  = r.top + 'px';

  dragOn = { el, hole, grip, id: el.dataset.ev, date: el.dataset.d,
             dy: y - r.top, top: r.top };
}

/* '지도에 안 떠요' 를 누르면 그 한 곳만 찾습니다(b376).
   ⚠ **`<button>` 이라 줄 펼치기와 안 부딪힙니다** — today.js 의 펼치기
   손잡이가 `closest('a, button')` 을 먼저 걸러냅니다.
   찾는 동안 글자를 바꿔 살아 있다는 것을 보입니다. 못 찾으면 왜 그런지와
   무엇을 하면 되는지를 그 자리에 남깁니다 — 다시 눌러도 같은 결과라
   재촉해봐야 소용이 없기 때문입니다. */
$('plans').addEventListener('click', async e => {
  const b = e.target.closest('[data-geo]'); if (!b) return;
  e.stopPropagation();
  if (b.disabled) return;
  const p = plans.find(x => x.id === b.dataset.geo);
  b.disabled = true; b.textContent = '찾는 중…';
  b.title = '';
  /* ⚠ **메모까지 넘깁니다(b571).** 거기 주소가 들어 있고,
     사실 이름보다 그쪽이 훨씬 잘 잡힙니다. 안 넘겨서 못 찾고 있었습니다. */
  const ok = await fillOnePlan(b.dataset.geo, p?.title || '', p?.date, p?.memo);
  if (ok === true) return;                       /* loadPlans 가 다시 그립니다 */
  b.disabled = false;
  /* 못 찾았을 때 **되는 길**을 알려줍니다 (b388). 전에는 "이름으로 못 찾았어요"
     로 끝나서, 이름을 몇 번 고쳐보다 포기하게 됐습니다(고쳐도 대개 안 됩니다).
     지도 링크는 확실히 됩니다 — 실측 오차 0.00km. */
  /* ⚠ 못 찾았을 때도 **무엇을 하면 되는지**로 적습니다(b566). 「지도에 안
     떠요」로 돌려놓으면 방금 누른 것이 아무 일도 안 한 것처럼 보입니다.
     ⚠ 한도에 걸린 것(`stop`)과 못 찾은 것은 다릅니다 — 앞의 것은 **기다리면
       되는 일**이고 뒤의 것은 **사람이 할 일**입니다. 같은 말로 뭉뚱그리면
       기다려도 되는데 주소를 고치러 갑니다. */
  b.textContent = ok === 'stop' ? '잠시 뒤 다시' : '못 찾았어요 · 지도 링크 붙여넣기';
  b.title = ok === 'stop'
    ? '지도 검색이 잠시 막혔어요. 조금 뒤에 다시 눌러보세요.'
    : '이름과 메모로는 못 찾았어요. 「수정」의 메모 칸에 구글 지도 링크나 주소를 붙여넣으면 잡힙니다.';
  b.classList.toggle('miss', ok !== 'stop');
}, false);

$('plans').addEventListener('pointerdown', e => {
  const grip = e.target.closest('[data-grip]');
  if (!grip || dragOn) return;
  if (e.pointerType === 'mouse'){
    e.preventDefault();
    return startDrag(grip, e.clientX, e.clientY, e.pointerId);
  }
  /* **여기서 preventDefault 를 하면 안 됩니다.** 하는 순간 굴림이 막혀서
     고친 뜻이 없어집니다. 가만히 있는지 지켜보기만 합니다. */
  holdAt = { x:e.clientX, y:e.clientY, grip, pointerId:e.pointerId };
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => {
    if (!holdAt) return;
    const h = holdAt; holdAt = null; holdTimer = null;
    startDrag(h.grip, h.x, h.y, h.pointerId);
  }, HOLD_MS);
}, false);

/* 끌기가 시작된 뒤에만 굴림을 끊습니다. **iOS 에서는 이 줄이 있어야 멈춥니다** —
   `pointermove` 의 preventDefault 로는 밑에서 도는 touchmove 가 안 막힙니다.
   `passive:false` 여야 preventDefault 가 먹습니다. */
$('plans').addEventListener('touchmove', e => { if (dragOn) e.preventDefault(); },
                            { passive:false });

$('plans').addEventListener('pointermove', e => {
  /* 아직 기다리는 중이면, 움직였는지만 봅니다 — 움직였으면 굴리려는 것입니다. */
  if (holdAt && !dragOn){
    if (Math.abs(e.clientY - holdAt.y) > MOVE_TOL ||
        Math.abs(e.clientX - holdAt.x) > MOVE_TOL) cancelHold();
    return;
  }
  if (!dragOn) return;
  e.preventDefault();
  const y = e.clientY - dragOn.dy;
  dragOn.el.style.top = y + 'px';

  /* 화면 끝에 닿으면 목록을 굴려 줍니다. 안 그러면 하루가 길 때
     화면 밖으로는 아예 못 옮깁니다. */
  const edge = 90;
  if (e.clientY < edge)                 scrollBy(0, -12);
  else if (e.clientY > innerHeight - edge) scrollBy(0, 12);

  /* **같은 날 안에서만 옮깁니다.** 날을 옮기는 것은 수정 폼의 날짜 칸이
     할 일입니다 — 끌어서 넘기면 어느 날에 놓였는지 확인할 자리가 없습니다. */
  const mid  = y + dragOn.el.offsetHeight / 2;
  const rows = evRows(dragOn.date).filter(r => r !== dragOn.el && r !== dragOn.hole);
  if (!rows.length) return;

  /* **줄과 줄 사이에는 빈 자리가 있습니다** — 날짜 머리글, 이동 시간 줄.
     거기에 놓으면 걸리는 줄이 없어서 아무 일도 안 일어났습니다.
     실제로 끌어보고 알았습니다: 아래로는 되는데 **위로는 안 갔습니다**.
     첫 줄 위는 날짜 머리글 자리라 그 위에 놓을 방법이 아예 없었습니다.
     그래서 위아래 끝은 따로 봅니다. */
  const first = rows[0].getBoundingClientRect();
  const last  = rows[rows.length - 1].getBoundingClientRect();
  if (mid < first.top + first.height / 2) return void rows[0].before(dragOn.hole);
  if (mid > last.top + last.height / 2)   return void rows[rows.length - 1].after(dragOn.hole);

  for (const row of rows){
    const rr = row.getBoundingClientRect();
    if (mid > rr.top && mid < rr.bottom){
      row[mid > rr.top + rr.height / 2 ? 'after' : 'before'](dragOn.hole);
      break;
    }
  }
}, false);

async function dropOrder(){
  const d = dragOn; if (!d) return;
  dragOn = null;
  document.body.classList.remove('reordering');
  d.el.classList.remove('lift');
  d.el.removeAttribute('style');
  d.hole.replaceWith(d.el);

  /* 화면에 보이는 새 순서 그대로 읽습니다. */
  const ids = evRows(d.date).map(x => x.dataset.ev);
  const day = plans.filter(p => p.date === d.date);
  if (ids.length !== day.length) return drawPlans();   /* 어긋나면 다시 그립니다 */

  const slots = day.map(p => ({ s:p.start_time, e:p.end_time }));
  const next  = ids.map(id => day.find(p => p.id === id));
  if (next.some(p => !p)) return drawPlans();

  /* 바뀐 것만 씁니다. 안 바뀐 줄까지 쓰면 실시간이 남에게 열 번 튑니다. */
  const jobs = [];
  next.forEach((p, i) => {
    const s = slots[i].s, e = slots[i].e;
    if (p.start_time === s && p.end_time === e && +p.sort_order === i) return;
    p.start_time = s; p.end_time = e; p.sort_order = i;
    jobs.push({ table:'plans', action:'update', id:p.id,
                row:{ start_time:s, end_time:e, sort_order:i } });
  });
  if (!jobs.length) return;

  /* 먼저 화면부터 맞춥니다 — 저장을 기다리는 동안 손을 뗀 자리에 그대로
     있어야 옮겨진 것으로 보입니다. */
  setPlans([...plans].sort((a, b) =>
    a.date.localeCompare(b.date)
    || (a.start_time || '99:99').localeCompare(b.start_time || '99:99')
    || (+a.sort_order) - (+b.sort_order)));
  drawPlans(); drawPlanMap();

  for (const j of jobs){
    const r = await write(j);
    if (!r.ok){ await ctx.loadPlans(); return fail(r.why, 'plan'); }
  }
}
/* ⚠ **기다리는 중이면 먼저 끕니다.** 안 끄면 손을 뗀 뒤에 타이머가 터져
   손가락도 없는데 줄이 들어올려집니다. `pointercancel` 은 브라우저가 굴림을
   가져갈 때도 오므로 여기가 "굴리려던 것이었다"를 아는 자리이기도 합니다. */
const endPointer = e => { cancelHold(); dropOrder(e); };
$('plans').addEventListener('pointerup', endPointer, false);
$('plans').addEventListener('pointercancel', endPointer, false);

export function drawPlans(){
  let show = pickedDay ? plans.filter(p => p.date === pickedDay) : plans;
  if (catFilter) show = show.filter(p => p.category === catFilter);
  if (!show.length){
    /* 날을 골라 둔 채로 비어 있는 것은 **여행에 일정이 없는 것과 다릅니다** —
       다른 날에는 있을 수 있습니다. 그래서 단추를 안 답니다(달면 머리말의
       `추가` 가 CSS 규칙에 걸려 사라지는데, 여기서는 그것이 유일한 길입니다). */
    $('plans').innerHTML = pickedDay
      ? emptyDo('이 날은 아직 비어 있어요.', null, null,
                '위에서 모든 날을 누르면 전체가 보여요.')
      /* ⚠ **길이 둘입니다 (b388).** 전에는 「첫 일정 넣기」(직접 적기)뿐이라
         여행 안에서는 AI 로 짜러 갈 수가 없었습니다 — 홈 히어로에는 있는
         길인데 여행을 열고 들어오면 사라졌습니다. */
      : emptyDo('아직 일정이 없어요.', '첫 일정 넣기', 'addplanbtn',
                '첫 줄만 넣으면 나머지는 이어서 채우기 쉬워요.',
                { label:'AI 로 하루씩 짜기', go:'draftbtn' });
    return;
  }
  let html = '', last = null, prev = null;
  for (const p of show){
    /* 앞 일정과 이 일정 사이에 얼마나 걸리는지. 좌표가 둘 다 있어야 잽니다.
       시간이 모자라면 빨갛게 — 이게 "이 하루가 물리적으로 가능한가"입니다. */
    /* ⚠ **수상한 좌표로는 이동을 안 잽니다(b733).** 273km 짜리 좌표가
       박혀 있으면 「888분 이동」이 그려집니다 — 없는 것보다 나쁩니다.
       판정은 calc.js 의 `좌표수상` 한 곳입니다(그쪽 주석에 사연). */
    /* ⚠ `plans` 를 같이 넘깁니다(b785) — 같은 날 다른 곳과 이어진 좌표는 구간
       도시에서 멀어도 멀쩡한 것으로 봅니다(calc.js 의 `좌표수상` 머리말). */
    if (prev && prev.date === p.date &&
        !좌표수상(prev, legs, 120, plans) && !좌표수상(p, legs, 120, plans)){
      const h = hop(prev, p, legs);
      /* ⚠ 같은 곳(50m 안)은 줄을 안 그립니다(b785, 사용자: 「온천에서 가이세키 저녁처럼
         0.0km 인데 뜨는 경우만 없게」). 딱 붙은 칸·이동 일정 앞은 줄은 그리고 경고만
         안 합니다 — calc.js 의 `붙은칸`·`이동줄인가` 머리말. */
      if (h && !같은곳(h)){
        let warn = '';
        if (prev.start_time && p.start_time && !붙은칸(prev, p) && !이동줄인가(p)){
          const end = prev.end_time ? mins(prev.end_time)
                    : mins(prev.start_time) + (STAY_MIN[prev.category] ?? 30);
          const gap = mins(p.start_time) - end;
          /* 음수면 "-20분밖에 없어요"가 됩니다. 앞 일정이 이미 넘겼다는 뜻입니다. */
          if (gap < h.min)
            warn = gap < 0 ? ' · 앞 일정이 이미 넘겼어요' : ` · ${gap}분밖에 없어요`;
        }
        html += `<div class="hopline${warn ? ' bad' : ''}">
          ${h.walk ? '도보' : '이동'} 약 ${h.min}분 · ${h.km.toFixed(1)}km${esc(warn)}</div>`;
      }
    }
    prev = p;

    if (p.date !== last){                       /* 전체 보기에서 날짜가 바뀌면 머리글 */
      if (!pickedDay){
        const l = legs.length > 1 ? legNear(legs, p.date) : null;
        /* 날짜 옆에 그날 요약을 답니다 — 어느 날이 빡빡한지 여기서 바로 보입니다. */
        html += `<div class="daysep">${esc(dayLabel(p.date, trip))}` +
                `${l ? ' · ' + esc(l.destination) : ''}` +
                `<span class="dstat">${esc(dayStat(p.date))}</span></div>`;
      }
      last = p.date;
    }
    const when = p.start_time ? hm(p.start_time) + (p.end_time ? `<br>~${hm(p.end_time)}` : '')
                              : '<span style="opacity:.45">–</span>';
    /* 분류는 색으로 먼저 읽히게 합니다 — 메모를 안 읽어도 눈으로 찾게 됩니다. */
    const k = p.category ? 'k-' + p.category : '';
    const mm = parseMemo([p.memo, p.move_note].filter(Boolean).join(' / '));
    /* 그 자리에서 실제로 쓴 돈. **예상(메모의 cost)과 갈라 적습니다** —
       "예상 3,000엔"과 "쓴 돈 3,400엔"은 다른 이야기고, 여행 중에 궁금한
       것은 뒤쪽입니다. 환산값이 없는 줄(환율을 못 받은 날)은 빼고 셉니다.
       한 푼도 안 쓴 일정에는 아무것도 안 답니다 — ₩0 이 줄마다 붙으면
       실제로 쓴 줄이 안 보입니다. */
    const spent = (expenses || [])
      .filter(x => x.plan_id === p.id && x.amount_home != null)
      .reduce((s, x) => s + Number(x.amount_home), 0);
    /* 부제에는 값만. 자세한 것은 펼쳐야 나옵니다.
       ⚠ **분류(`p.category`)를 여기서 뺐습니다(b368).** 왼쪽 색점이 이미 같은
       것을 말하고 있어서 **한 줄에 같은 정보가 두 번** 나왔습니다 — `● 이동`.
       색점만 남깁니다. 색과 이름을 짝지을 곳은 있습니다: 날짜 줄 끝의
       `분류` 를 누르면 나오는 칩 줄(`#cats`)이 **카드와 같은 `--kc` 색으로**
       `● 이동`·`● 숙소` 를 그립니다(planline.js 의 drawCats). 그게 범례입니다.
       색만으로는 못 읽는 경우를 위해 색점에 이름을 달아 둡니다(아래 title). */
    /* ⚠ 쉼표로 자르다가 **천 단위 쉼표까지 잘랐습니다**(b369 에서 고침).
       `가격: 1인당 약 1,200엔` 이 `1인당 약 1` 로 나왔습니다 — 값이 여럿일 때
       첫 번째만 쓰려던 것인데, 그 구분자는 `·` 이거나 `쉼표+빈칸` 입니다.
       숫자 안의 쉼표는 뒤에 빈칸이 없습니다. 분류를 뺀 지금은 부제에 이것만
       남아서 더 눈에 띕니다. */
    const sub = [mm.cost ? mm.cost.split(/·|,\s/)[0].trim() : null,
                 spent ? money(spent, trip.home_currency) : null]
                  .filter(Boolean).join(' · ');
    /* 이름만으로는 어느 나라인지 모릅니다. 그날 구간의 도시를 같이 넘깁니다
       (구간이 하나뿐이면 여행의 대표 도시). */
    const ml = mapLinks(p, legNear(legs, p.date)?.destination || trip?.destination);
    const open = openPlans.has(p.id);

    html += `<div class="ev${open ? ' is-open' : ''}" data-ev="${esc(p.id)}"
                  data-d="${esc(p.date)}">
      <div class="ev__row">
        <div class="when">${when}</div>
        <span class="kdot ${esc(k)}"${
          p.category ? ` title="${esc(p.category)}" aria-label="${esc(p.category)}"` : ''}></span>
        <div class="body"><b>${esc(p.title)}${
          /* 좌표가 없으면 지도에도 안 뜨고 이동 시간도 못 잽니다(b376).
             **띠로 크게 알리지 않습니다** — 못 찾는 곳이면 영영 안 사라져서
             재촉만 됩니다. 그 줄에 작게 사실만 적고, 누르면 그 한 곳만
             찾아봅니다. 말투는 후보 카드가 이미 쓰는 것과 같게 둡니다.
             ⚠ **`<b>` 안에 넣습니다.** 밖에 두면 `.ev .body b` 가
             `display:block` 이라 아랫줄로 떨어져 줄 높이가 49 → 74px 로
             부풉니다(재봄). 제목 끝에 이어 붙어야 합니다. */
          /* ⚠⚠ **글자가 「지도에 안 떠요」였습니다(b566 에 고침).** 사용자
             지적: 「이게 좌표를 찾는 건지 알 수가 없어」. 그 말은 **상태**만
             말하고 **누르면 무슨 일이 일어나는지**는 말하지 않습니다 —
             단추인 줄도 모릅니다.
             이제 **「위치 찾기」**입니다. 「찾기」가 곧 누르라는 뜻이고,
             앞에 붙은 핀이 「위치가 없다」는 상태까지 같이 말합니다.
             ⚠ 아이콘 크기는 **CSS 로** 줍니다(b561 에 0×0 으로 찌그러진
               그 함정). `.nogeo svg` 참고. */
          /* ⚠ **좌표가 «틀린» 경우도 같은 단추로 말합니다(b733).** 없는 것과
             틀린 것은 사용자가 할 일이 같습니다 — 다시 찾는 것. 다만 «왜»가
             다르므로 글자와 설명을 갈라 적습니다. 지도에서 빼기만 하면
             왜 안 보이는지 알 수가 없습니다. */
          (() => {
            if (p.lat == null) return `<button class="nogeo" data-geo="${esc(p.id)}"
              title="지도에 안 떠요. 눌러서 위치를 찾아봅니다."
              >${핀아이콘}위치 찾기</button>`;
            const 멀 = 좌표수상(p, legs, 120, plans);
            return 멀 ? `<button class="nogeo" data-geo="${esc(p.id)}"
              title="그날 있는 곳에서 ${멀}km 떨어져 있어요. 위치가 틀린 것 같아 지도에서 뺐어요. 눌러서 다시 찾아봅니다."
              >${핀아이콘}위치 확인</button>` : '';
          })()}</b>${''}
          <span class="memo">${esc(sub)}${
            /* 노선은 이동 메모에 적혀 있습니다. 제목에도 있을 수 있어 같이 봅니다. */
            ''}${lineChips((mm.move || '') + ' ' + (p.title || ''))}</span></div>
        ${/* `›` 를 뗐습니다(b368) — 장식이었고 오른쪽에 열을 하나 더
              만들었습니다. 펼치는 것은 줄 아무 데나 누르면 됩니다. */''}${
        canReorder() ? `
        <span class="grip" data-grip aria-label="끌어서 순서 바꾸기">≡</span>` : ''}
      </div>
      <div class="detail">
        ${mm.move ? `<div class="drow"><b>이동</b> ${esc(nice(mm.move))}</div>` : ''}
        ${mm.cost ? `<div class="drow"><b>예상</b> ${esc(nice(mm.cost))}</div>` : ''}
        ${mm.notes.map(n => `<div class="dnote">${esc(nice(n))}</div>`).join('')}
        <div class="dacts">
          <a href="${esc(ml.see)}" target="_blank" rel="noopener">지도에서 보기</a>
          <a href="${esc(ml.go)}" target="_blank" rel="noopener">길찾기</a>
          ${trip.myRole === 'viewer' ? '' :
            `<button class="ghost" data-pact="edit" data-id="${esc(p.id)}">수정</button>
             <button class="ghost" data-pact="del" data-id="${esc(p.id)}"
                     style="color:var(--bad); margin-left:auto">삭제</button>`}
        </div>
      </div>
    </div>`;
  }
  $('plans').innerHTML = html;
}

