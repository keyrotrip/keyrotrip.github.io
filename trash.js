/* ── 지운 것 되살리기 ─────────────────────────────────────────────────
 * 일정·지출·예약은 지워도 **바로 없애지 않습니다**(`deleted_at` 만 찍습니다).
 * 잘못 지운 것을 그 자리에서 되돌릴 수 있어야 하기 때문입니다 —
 * 일행이 있는 여행에서는 남이 지운 것을 되살릴 일도 생깁니다.
 *
 * ── app.js 에서 떼어낸 스물두 번째 조각입니다(b346) ──────────────────
 * app.js 만 아는 것은 **하나** — 되살린 뒤 일정 다시 그리기.
 *
 * `TAB_TRASH` 도 같이 왔습니다. 탭을 옮길 때 "이 탭에 지운 것이 있나" 를
 * 보는 표인데, 표가 아는 것은 **어느 탭이 어느 테이블을 쓰나** 라서
 * 여기 있는 것이 맞습니다. 탭 쪽에서 import 해 갑니다.
 *
 * 층: dom.js · db.js · net.js · trip.js · ui.js 와 이미 떼어낸
 *     expense.js · prep.js 를 씁니다. 그쪽은 이 파일을 안 부릅니다. */
import { $, esc, toast } from './dom.js?v=b823';
import { sb } from './db.js?v=b823';
import { fail, netTimeout, drawOffbar, isOffline, NOROW } from './net.js?v=b823';
import { trip, plans, expenses, bookings, tab } from './trip.js?v=b823';
import { arm, disarm } from './ui.js?v=b823';
import { loadExpenses } from './expense.js?v=b823';
import { loadBookings } from './prep.js?v=b823';

let ctx = { loadPlans: async () => {} };
export function setTrashCtx(o){ ctx = { ...ctx, ...o }; }
/* 어느 탭이 어느 테이블의 지운 줄을 보나. **app.js 의 탭 구역에 있던
   것을 여기로 옮겼습니다(b346)** — 표가 아는 것은 테이블 이름이라
   여기가 맞습니다. 탭 쪽에서 import 해 갑니다. */
export const TAB_TRASH = { plans:"plan", exp:"expense", prep:"booking" };


/* ── 지운 것 되살리기 ────────────────────────────────────────────────
 * 지울 때 deleted_at 만 찍고 진짜로는 안 지워 왔습니다. 그런데 되살리는 길이
 * 없어서 결국 영영 지운 것과 같았습니다. 여기가 그 길입니다.
 * 표 셋(일정·지출·예약)을 각각 물으면 화면 코드가 세 배가 되므로
 * 032 의 deleted_items 가 한 번에 모아 줍니다. */
const TRASH_KO = { plan:'일정', expense:'지출', booking:'예약' };
$('trashhead').addEventListener('click', () => {
  const open = $('trash').classList.toggle('hide');
  $('trashcaret').textContent = open ? '펴기' : '접기';
});
const TRASH_TABLE = { plan:'plans', expense:'expenses', booking:'bookings' };

export async function loadTrash(){
  const card = $('card-trash');
  const kind = TAB_TRASH[tab];
  /* 되살릴 것이 없으면 카드를 아예 안 보여줍니다. "지운 것이 없어요"만 적힌
     빈 카드는 매번 자리만 먹고, 그걸 보려고 탭을 여는 사람은 없습니다. */
  const hideCard = () => card.classList.add('hide');
  if (!kind) return hideCard();

  $('trasherr').classList.add('hide');
  const { data, error } = await netTimeout(sb.rpc('deleted_items', { p_trip: trip.id }));
  if (error){
    /* 못 불러오면 조용히 접습니다. 되살리기는 급한 기능이 아니라
       여기서 오류 상자를 띄우면 정작 보러 온 일정 위에 얹힙니다. */
    if (isOffline(error)) drawOffbar();
    return hideCard();
  }

  const rows = (data || []).filter(r => r.kind === kind);
  if (!rows.length) return hideCard();

  card.classList.remove('hide');
  $('trashtitle').textContent = `지운 ${TRASH_KO[kind]}`;
  $('trashcount').textContent = `${rows.length}개`;
  /* 탭을 옮기면 다시 접습니다. 한 번 편 채로 따라다니면 접은 뜻이 없습니다. */
  $('trash').classList.add('hide');
  $('trashcaret').textContent = '펴기';
  /* 되살리기 옆에 '완전 삭제'를 둡니다. 지운 것이 여기 계속 쌓이면
     목록이 길어져 정작 되살릴 것을 못 찾습니다. 진짜로 지우는 것이라
     한 번 더 물어봅니다(arm) — 되살릴 길이 그때는 없습니다. */
  $('trash').innerHTML = rows.map(r => `<div class="arow">
      <span class="k"><b>${esc(r.title)}</b>
        <span class="m">${esc(r.sub || '')}</span></span>
      ${trip.myRole === 'viewer' ? ''
        : `<button class="ghost" data-undel="${esc(r.kind)}:${esc(r.id)}"
                   style="color:var(--primary); padding:4px 6px">되살리기</button>
           <button class="ghost" data-zap="${esc(r.kind)}:${esc(r.id)}"
                   style="color:var(--bad, #c0392b); padding:4px 6px">완전 삭제</button>`}
      </div>`).join('');
}

/* 되살렸든 지웠든 원래 자리도 다시 그려야 합니다. */
async function afterTrash(kind){
  await loadTrash();
  if (kind === 'plan')    await ctx.loadPlans();
  if (kind === 'expense') await loadExpenses();
  if (kind === 'booking') await loadBookings();
}

$('trash').addEventListener('click', async e => {
  const z = e.target.closest('[data-zap]');
  if (z){
    /* 한 번 더 묻습니다. 여기서 지우면 정말 없어집니다. */
    if (z.dataset.armed !== '1'){ arm(z, '정말 지울까요?'); return; }
    const [kind, id] = z.dataset.zap.split(':');
    z.disabled = true; z.innerHTML = '<span class="load">지우는 중…</span>';
    /* 이미 지운 것만 지웁니다. deleted_at 조건을 빼면, 그 사이 딴 기기에서
       되살려 놓은 줄까지 여기서 없앨 수 있습니다. */
    const r = await sb.from(TRASH_TABLE[kind]).delete()
      .eq('id', id).not('deleted_at', 'is', null).select('id');
    z.disabled = false; disarm(z); z.textContent = '완전 삭제';
    if (r.error) return fail(r.error, 'trash');
    if (!r.data?.length) return fail(NOROW.del, 'trash');
    toast('완전히 지웠어요.');
    return afterTrash(kind);
  }

  const b = e.target.closest('[data-undel]'); if (!b) return;
  const [kind, id] = b.dataset.undel.split(':');
  b.disabled = true; b.innerHTML = '<span class="load">되살리는 중…</span>';
  const r = await sb.from(TRASH_TABLE[kind])
    .update({ deleted_at: null }).eq('id', id).select('id');
  b.disabled = false; b.textContent = '되살리기';
  if (r.error) return fail(r.error, 'trash');
  if (!r.data?.length) return fail('되살리지 못했어요. 다시 눌러주세요.', 'trash');
  toast('되살렸어요.');
  await afterTrash(kind);
});

