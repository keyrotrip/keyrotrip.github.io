/* ── 새 여행 만들기 — 네 단계 마법사 ──────────────────────────────────
 * '＋ 새 여행' 을 누르면 열리는 네 단계와 그 안의 달력입니다.
 *   1 어디로   2 언제   3 취향   4 이름과 갈래(AI 초안 / 직접)
 *
 * ── app.js 에서 떼어낸 열일곱 번째 조각입니다(b343) ──────────────────
 * `여행 만들기` · `새 여행 단계 화면` · `달력` 셋은 app.js 에서 나란히
 * 붙어 있었고 실제로도 한 덩어리입니다 — 달력은 2단계에서만 쓰고,
 * `wizStep` 하나가 셋을 다 몰고 다닙니다. 그래서 통째로 왔습니다.
 *
 * app.js 만 아는 것은 넷입니다 — 로그인한 사람, 여행 목록 다시 받기,
 * 여행 열기, AI 초안 화면 열기. 마지막 둘은 **다 만든 다음에** 가는 곳이라
 * 이 조각이 알 필요가 없는 것들입니다.
 *
 * ⚠ `movePrefs` 는 여기 있지만 **AI 초안 화면도 부릅니다.** 취향 칸을
 * 두 화면이 **DOM 하나로 같이 쓰기** 때문입니다(두 벌로 만들면 한쪽만
 * 고치는 날이 옵니다). 그래서 내보냅니다.
 *
 * 층: dom.js · db.js · net.js · calc.js · citysearch.js 만 씁니다. */
import { $ } from './dom.js?v=b820';
import { sb } from './db.js?v=b820';
import { fail } from './net.js?v=b820';
import { todayYmd } from './calc.js?v=b820';
import { loadCities, drawHits, drawPop, picked, resetPick } from './citysearch.js?v=b820';

/* app.js 만 아는 것 넷. **`me` 는 값이 아니라 함수로** — 로그인할 때마다
   바뀌는데 값으로 받으면 처음 것을 붙들고 있습니다. */
let ctx = { me: () => null, loadTrips: async () => {},
            openTrip: async () => {}, openDraft: () => {} };
export function setNewTripCtx(o){ ctx = { ...ctx, ...o }; }

/* ── 여행 만들기 ────────────────────────────────────────────────────
 * 새 여행을 만드는 화면입니다. 홈의 '시작'에서만 옵니다.
 * 여행 탭의 '일정 추가'는 **다른 일**입니다 — 이미 있는 여행에 일정을
 * 채우는 것이라 초안 화면(openDraft)으로 갑니다. 둘을 갈라둡니다. */
export async function openNew(){
  $('newcard').classList.remove('hide');
  await loadCities();
  /* 날짜는 미리 채우지 않습니다. 달력에서 직접 고르는 편이 빠르고,
     미리 채워두면 '오늘 출발'인 채로 지나쳐 버립니다. */
  drawPop();
  wizShow(1);
}

/* 여행 탭 '일정 추가' — 여행을 만드는 것이 아니라, 이미 있는 여행에
   일정을 채우는 자리입니다. 그래서 초안 화면을 그대로 엽니다. */
$('newbtn').addEventListener('click', () => ctx.openDraft());
/* '＋ 새 여행' — 어디로·언제부터 정하는 4단계 화면. 홈의 AI 카드가
   '다음 여행' 이야기를 하게 되면서 여기 말고는 갈 길이 없어졌습니다. */
$('newtripbtn').addEventListener('click', () => openNew());

$('cancel').addEventListener('click', () => {
  $('newcard').classList.add('hide');
  $('formerr').classList.add('hide');
});

/* ── 새 여행 단계 화면 ────────────────────────────────────────────────
 * 예전에는 제목·도시·나라·시작·끝을 한 화면에서 다 물었습니다. 빈 칸이
 * 여섯 개 있는 화면은 채우기 전에 닫게 됩니다. 한 번에 하나만 묻습니다.
 *
 *   1 어디로  2 언제  3 취향  4 이름과 갈래(AI / 직접)
 *
 * **제목은 안 묻습니다.** 도시를 고르면 "도쿄 여행"으로 지어두고 마지막에
 * 고칠 수 있게 합니다 — 물어볼 것이 하나 줄고, 대개는 그대로 씁니다.
 *
 * 취향 칸은 초안 화면과 **DOM 하나를 같이 씁니다**(movePrefs). 두 벌로
 * 만들면 언젠가 한쪽만 고칩니다. */
const WIZ_TITLES = {
  1: '어디로 가시나요?',
  2: '언제 가시나요?',
  3: '이름을 정해주세요',
  4: '어떤 여행이 좋으세요?',
};
let wizStep = 1;

/* 취향 칸 한 벌을 필요한 자리로 옮겨 담습니다. */
export function movePrefs(slotId){
  const slot = $(slotId), block = $('prefblock');
  if (slot && block && block.parentElement !== slot) slot.appendChild(block);
}

function wizShow(n){
  wizStep = Math.min(4, Math.max(1, n));
  $('newcard').querySelectorAll('.wizstep').forEach(s =>
    s.classList.toggle('hide', +s.dataset.step !== wizStep));
  $('wiztitle').textContent = WIZ_TITLES[wizStep];
  $('wizfill').style.width = (wizStep * 25) + '%';
  $('wizback').classList.toggle('hide', wizStep === 1);
  /* 3단계에는 아래 '계속'이 없습니다 — 두 카드가 곧 결정입니다.
     그러면 아래 칸이 통째로 빌 수 있으니 구분선도 같이 걷습니다.
     4단계(취향)는 AI 를 고른 사람만 오므로 단추가 바로 '일정 짜기'입니다. */
  $('wiznext').classList.toggle('hide', wizStep === 3);
  $('wizfoot').classList.toggle('empty', wizStep === 3);
  $('wiznext').textContent = wizStep === 4 ? '일정 짜기' : '계속';
  $('formerr').classList.add('hide');
  /* 단계를 넘길 때마다 위로. 달력을 한참 내렸다가 다음으로 가면
     새 단계가 가운데쯤부터 보입니다. */
  $('newcard').querySelector('.wizbody').scrollTop = 0;
  wizDays();                          /* 2단계가 아니면 스스로 지웁니다 */
  if (wizStep === 2) wizCal(true);
  if (wizStep === 3) wizAutoTitle();
  if (wizStep === 4) movePrefs('wiz_prefslot');
}

/* 이름은 안 묻고 지어둡니다. 대개는 그대로 씁니다.
   비워둔 것을 손대지는 않습니다 — 직접 고쳐 쓴 이름을 덮으면 안 됩니다. */
function wizAutoTitle(){
  if ($('f_title').value.trim()) return;
  const dest = picked ? picked.name : $('f_q').value.trim();
  if (dest) $('f_title').value = `${dest} 여행`;
}

/* 다음으로 넘어가기 전에 그 단계에서 필요한 것만 봅니다.
   마지막에 몰아서 검사하면 어느 단계로 돌아가야 하는지 모릅니다. */
function wizCheck(n){
  if (n === 1){
    const dest = picked ? picked.name : $('f_q').value.trim();
    if (!dest) return '어디로 가는지 알려주세요.';
    if (!picked && !$('f_country').value) return '어느 나라인지 골라주세요.';
  }
  if (n === 2){
    const s = $('f_start').value, e = $('f_end').value;
    if (!s || !e) return '날짜를 골라주세요.';
    if (e < s)    return '끝나는 날이 시작보다 빨라요.';
    const days = Math.round((new Date(e) - new Date(s)) / 864e5) + 1;
    if (days > 365) return `${days}일은 너무 길어요. 날짜를 다시 봐주세요.`;
  }
  return '';
}

$('wiznext').addEventListener('click', () => {
  /* 4단계는 취향 화면입니다. 여기 단추는 '계속'이 아니라 '일정 짜기'라
     넘어갈 곳이 없습니다 — 만들고 바로 짜기 시작합니다. */
  if (wizStep === 4) return createTrip(true);
  const why = wizCheck(wizStep);
  if (why) return fail(why, 'form');
  wizShow(wizStep + 1);
});
$('wizback').addEventListener('click', () => wizShow(wizStep - 1));

/* ── 달력 ────────────────────────────────────────────────────────────
 * 날짜 칸 두 개는 기기 선택기를 두 번 열게 하고, 며칠짜리인지도 안 보입니다.
 * 여기서는 시작을 누르고 끝을 누릅니다. 고른 값은 숨은 f_start/f_end 에
 * 그대로 담기므로, 날짜를 읽는 쪽 코드는 하나도 안 바뀝니다.
 *
 * 오늘부터 14달을 한 번에 그려 세로로 굴립니다. 화살표로 달을 넘기게 하면
 * 월말에서 시작해 다음 달에 끝나는 여행이 두 화면에 걸립니다. */
const CAL_MONTHS = 14;
/* seek 를 주면 이미 고른 날이 보이는 자리로 굴려줍니다 — 뒤로 갔다 오면
   달력이 오늘 달부터 다시 시작해서 고른 날을 또 찾게 됩니다. */
function wizCal(seek){
  const today = new Date(); today.setHours(0,0,0,0);
  /* **로컬 자정을 ymd(UTC)로 돌리면 안 됩니다** — KST 에서는 하루 종일 전날이
     나와서 달력의 '오늘'이 늘 하루 앞을 가리켰습니다. 달력은 사람이 보는
     날짜이므로 로컬로 읽습니다. */
  const tkey  = todayYmd();
  const s = $('f_start').value, e = $('f_end').value;
  let html = '';
  for (let m = 0; m < CAL_MONTHS; m++){
    const first = new Date(today.getFullYear(), today.getMonth() + m, 1);
    const y = first.getFullYear(), mo = first.getMonth();
    const last = new Date(y, mo + 1, 0).getDate();
    let cells = '<span></span>'.repeat(first.getDay());
    for (let d = 1; d <= last; d++){
      const k = `${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      /* 지난 날은 못 고릅니다. 고를 수 있게 두면 나중에 "왜 지난 여행이
         다가오는 목록에 없냐"는 이야기가 됩니다. */
      const off = k < tkey;
      const cls = [
        off ? '' : (k === s ? 's' : ''), off ? '' : (k === e ? 'e' : ''),
        (!off && s && e && k > s && k < e) ? 'in' : '',
        k === tkey ? 'today' : '',
      ].filter(Boolean).join(' ');
      cells += `<button type="button" class="cd ${cls}" data-d="${k}"${off ? ' disabled' : ''}><i>${d}</i></button>`;
    }
    html += `<div class="calmon"><h3>${y}년 ${mo+1}월</h3><div class="calgrid">${cells}</div></div>`;
  }
  $('wizcal').innerHTML = html;
  wizDays();
  if (seek && s){
    const cell = $('wizcal').querySelector(`[data-d="${s}"]`);
    cell?.closest('.calmon')?.scrollIntoView({ block:'start' });
  }
}

/* 누를 때마다: 시작이 없거나 이미 둘 다 골랐으면 새로 시작합니다.
   시작보다 앞을 누르면 그 날이 새 시작이 됩니다 — "다시 처음부터"보다
   그쪽이 하려던 일에 가깝습니다. */
$('wizcal').addEventListener('click', ev => {
  const b = ev.target.closest('.cd'); if (!b || b.disabled) return;
  const k = b.dataset.d, s = $('f_start').value, e = $('f_end').value;
  if (!s || e || k < s){ $('f_start').value = k; $('f_end').value = ''; }
  else                   $('f_end').value = k;
  wizCal();
});

/* 며칠인지 바로 보여줍니다. 날짜 두 개를 머릿속으로 빼게 하지 않습니다.
   달력을 보고 있을 때만 적습니다 — 뒤 단계까지 따라다니면 그 자리에
   'AI가 짜줄게요'를 눌러야 하는데 날짜가 대신 앉아 있습니다. */
function wizDays(){
  const s = $('f_start').value, e = $('f_end').value;
  if (wizStep !== 2) return void ($('wizdays').textContent = '');
  $('wizdays').textContent =
    !s ? '' :
    !e ? `${s.slice(5).replace('-','월 ')}일 — 끝나는 날도 눌러주세요` :
         `${s.slice(5).replace('-','.')} – ${e.slice(5).replace('-','.')} · ` +
         `${Math.round((new Date(e) - new Date(s)) / 864e5) + 1}일`;
}

/* 갈래. 직접 채울 사람은 **여기서 끝납니다** — 취향을 물어봐야 쓸 데가
   없습니다. AI 에게 맡길 사람만 취향 화면으로 한 장 더 갑니다. */
$('wiz_manual').addEventListener('click', () => createTrip(false));
$('wiz_ai').addEventListener('click',     () => wizShow(4));

async function createTrip(withAi){
  /* 누른 단추에 '만드는 중…'을 겁니다. AI 쪽은 취향 화면의 '일정 짜기'가
     그 자리입니다 — 갈래 카드는 이미 지난 장이라 거기 걸면 안 보입니다. */
  const btn = withAi ? $('wiznext') : $('wiz_manual');
  $('formerr').classList.add('hide');

  const title = $('f_title').value.trim();
  /* 도시를 골랐으면 그 이름, 아니면 위 칸에 친 그대로. */
  const dest  = picked ? picked.name : $('f_q').value.trim();
  const start = $('f_start').value, end = $('f_end').value;

  /* 단계마다 이미 봤지만 여기서 한 번 더 봅니다. 단계를 건너뛸 길이
     생기더라도 (뒤로 갔다 오거나, 날짜 칸을 키보드로 직접 치거나)
     빈 여행이 만들어지지는 않게 합니다. */
  if (!title)                return fail('이름을 적어주세요.', 'form');
  const why = wizCheck(1) || wizCheck(2);
  if (why)                   return fail(why, 'form');

  /* 도시를 골랐으면 나라·시간대·통화·이동상수는 DB 트리거가 채웁니다.
     목록에 없는 곳이면 나라만 넘기고, 통화와 언어는 나라에서 옵니다.

     id 를 여기서 미리 정합니다. .select('id') 로 돌려받으려 하면
     "new row violates row-level security policy for table trips" 로 막힙니다.
     넣는 것 자체는 되는데 **돌려주는 줄을 읽을 권한이 그 순간에 없어서**입니다 —
     trips 읽기 정책이 can_read_trip(참여자인가)인데, 참여자 줄은 INSERT
     트리거가 끝난 뒤에 생깁니다. 방금 만든 여행도 그 찰나에는 못 읽습니다.
     id 를 미리 정하면 돌려받을 이유가 없어집니다. */
  const id = (crypto.randomUUID ? crypto.randomUUID()
                                : URL.createObjectURL(new Blob()).slice(-36));
  const row = { id, created_by: ctx.me().id,
                title, destination: dest, start_date: start, end_date: end };
  if (picked) row.city_id = picked.id;
  else        row.country = $('f_country').value;

  const label = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="load">만드는 중…</span>';
  const { error } = await sb.from('trips').insert(row);
  btn.disabled = false; btn.innerHTML = label;
  if (error) return fail(error, 'form');

  wizReset();
  await ctx.loadTrips();

  /* 여기서 갈립니다. 직접 채우겠다면 만든 여행을 바로 열어줍니다 —
     목록으로 돌려보내면 방금 만든 것을 다시 찾아 눌러야 합니다.
     AI 에게 맡기겠다면 초안 화면을 그 여행으로 열고 바로 짜기 시작합니다.
     취향 칸은 같은 DOM 이라 고른 그대로 따라갑니다. */
  if (withAi){ await ctx.openDraft(id, true); $('d_go').click(); }
  else         ctx.openTrip(id);
}

/* 다음에 열 때 앞사람 흔적이 남아 있으면 안 됩니다. */
function wizReset(){
  $('newcard').classList.add('hide');
  $('f_title').value = ''; $('f_q').value = '';
  $('f_start').value = ''; $('f_end').value = '';
  $('wizdays').textContent = '';
  resetPick();
  $('f_q').classList.remove('hide');
  drawHits();                       /* 빈 값이면 후보와 나라 칸을 같이 접습니다 */
  wizStep = 1;                      /* 화면은 이미 닫혔으니 그리지 않고 자리만 되돌립니다 */
}

