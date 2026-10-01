/* ── 붙여넣은 지도 링크에서 위치 찾기 ─────────────────────────────────
 * 사용자가 실제로 하던 일: 구글 지도에서 '공유'로 링크를 복사해 메모에
 * 붙여넣습니다. 그런데 그건 **글자로만 남았습니다** — 지도에는 안 뜨고,
 * 좌표를 채우려면 어느 탭에 숨어 있는지도 모르는 단추를 찾아야 했습니다.
 *
 * 그래서 **붙여넣는 순간 알아챕니다**(`sniffMapLink`). 링크에서 좌표를
 * 뽑을 수 있으면 바로 쓰고, 짧은 주소(`maps.app.goo.gl`)처럼 좌표가 안
 * 들어 있으면 이름으로 물어봅니다(`osmLookup`, cands.js).
 *
 * 좌표가 있어야 일정 지도에 핀이 찍히고 이동 시간이 계산됩니다 —
 * 그 둘이 이 앱에서 지도 링크가 쓸모 있어지는 이유입니다.
 *
 * ── app.js 에서 떼어낸 서른한 번째 조각입니다(b355) ──────────────────
 * app.js 만 아는 것은 셋 — 날짜 줄 다시 그리기, 기능 스위치, 일정 다시 받기.
 * `geoAsked`(이미 물어본 것)와 `geoTimer` 도 여기 것이라 같이 왔습니다.
 *
 * 층: dom.js · db.js · net.js · trip.js · ui.js 와 이미 떼어낸
 *     planline.js · planmap.js · planview.js · cands.js 를 씁니다. */
import { $, toast } from './dom.js?v=b820';
import { featOn } from './flags.js?v=b820';
import { sb } from './db.js?v=b820';
import { fail, write } from './net.js?v=b820';
import { trip, plans, legs, setPlans, editPlanId, setEditPlanId,
         planSeedGeo, setPlanSeedGeo } from './trip.js?v=b820';
import { arm } from './ui.js?v=b820';
import { drawCats } from './planline.js?v=b820';
import { drawPlanMap } from './planmap.js?v=b820';
import { drawPlans } from './planview.js?v=b820';
import { osmLookup, addressQueries, 여행기준 } from './cands.js?v=b820';
import { distKm, legFirst } from './calc.js?v=b820';

let ctx = { drawDays: () => {}, loadPlans: async () => {} };
export function setGeocodeCtx(o){ ctx = { ...ctx, ...o }; }

/* 일정 칸을 새로 열 때 앞사람 흔적을 지웁니다. app.js 가 두 변수를
   직접 비우던 자리인데, 변수가 여기로 왔으니 길도 여기서 냅니다.
   (b339 의 resetPick, b341 의 resetRateHtml 과 같은 꼴) */
/* 이번에 찾을 때 쓴 기준점. 아래 「멀다」 판정이 같은 점을 씁니다 —
   두 번 세면 두 값이 갈립니다. */
let 기준점 = null;
export function resetGeo(){
  planGeo = null; geoAsked = ""; 기준점 = null;
  $("p_geonote").classList.add("hide");
}

/* ── 붙여넣은 지도 링크에서 위치 찾기 ───────────────────────────────
 * 사용자가 실제로 하던 일: 구글 지도에서 '공유'로 링크를 복사해 메모에
 * 붙여넣습니다. 그런데 그건 **글자로만 남았습니다** — 지도에는 안 뜨고,
 * 좌표를 채우려면 어느 탭에 숨어 있는지도 모르는 단추를 찾아야 했습니다.
 *
 * **짧은 주소(maps.app.goo.gl)는 브라우저에서 못 폅니다.** 리다이렉트를
 * 읽어야 하는데 구글이 CORS 를 안 줍니다. 서버(chat 함수의 mode:'map')가
 * 폅니다 — 거기 이미 펴고 뽑는 코드가 있고, AI 는 안 씁니다(한도 안 닳음).
 *
 * 같은 링크를 두 번 묻지 않습니다. 글자를 고칠 때마다 나가면 안 됩니다. */
let planGeo = null, geoAsked = '';
const MAPURL = /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.[a-z.]+\/maps)\S*/i;

async function sniffMapLink(){
  if (!featOn('maplink')) return;
  const hit = ($('p_memo').value + ' ' + $('p_title').value).match(MAPURL);
  const note = $('p_geonote');
  if (!hit){ geoAsked = ''; planGeo = null; note.classList.add('hide'); return; }
  const url = hit[0];
  if (url === geoAsked) return;
  geoAsked = url;

  note.classList.remove('hide');
  note.textContent = '지도에서 위치를 찾는 중…';
  /* ⚠ **찾는 동안 「넣기」를 잠급니다 (b388).** 서버가 링크를 펴는 데 몇 초
     걸리는데 그 사이에도 단추가 눌렸습니다. 빨리 누르는 사람은 **좌표 없이**
     저장되고 왜 없는지 모릅니다(실측: 0.5초 뒤 누름 → 좌표 없음).
     기다리는 동안 무엇을 기다리는지도 단추에 적어둡니다 — 잠긴 단추만
     보여주면 고장으로 읽힙니다. */
  const 단추 = $('p_create'), 원래글 = 단추.textContent;
  단추.disabled = true; 단추.textContent = '위치 찾는 중…';
  const 풀기 = () => { 단추.disabled = false; 단추.textContent = 원래글; };

  const r = await sb.functions.invoke('chat', { body:{ mode:'map', message:url } });
  if (r.error || r.data?.error){
    풀기();
    planGeo = null;
    note.textContent = '이 링크를 읽지 못했어요. 그냥 넣어도 괜찮아요.';
    return;
  }

  let { name, lat, lng } = r.data || {};
  /* **주소는 나오는데 좌표는 없는 링크가 많습니다.** 실제로 재봤습니다:
       maps.app.goo.gl/18Sbe4… → 이름 "OZEKI Tokyo Gallery, 1 Chome-2-6 …"
       좌표 null
     구글이 짧은 주소를 펼 때 좌표 없이 주소만 실어 보내는 판이 있습니다.
     그러면 우리에게는 **주소 한 줄**이 남는데, 그건 이미 좌표로 바꿀 수
     있습니다 — 앱이 '좌표 채우기'에서 쓰는 그 검색입니다. 이어 붙입니다. */
  if (lat == null && name){
    note.textContent = '주소로 위치를 찾는 중…';
    /* ⚠⚠ **주소를 «그대로» 물으면 일본에서는 한 곳도 안 나옵니다(b564).** ⚠⚠
       구글이 주는 꼴(「일본 〒104-0061 Tokyo, Chuo City, Ginza, 6 Chome−4−16 …」)
       을 OSM 은 못 읽습니다 — 실측 0건. `addressQueries` 가 「번지 동네, 구,
       도, Japan」 꼴로 바꿔 줍니다(그 함수 머리말에 잰 값이 있습니다).
       ⚠ 그래도 안 되면 **원문 그대로** 한 번 더 봅니다 — 일본이 아닌 나라
         에서는 원문이 더 나을 수 있습니다. */
    /* ⚠⚠ **여기가 아무 울타리도 없이 묻던 자리였습니다(b730).** ⚠⚠
       `osmLookup(q)` — 나라도, 기준점도, 반경도 안 넘겼습니다. 그러면
       **지구 어디든** 걸립니다. 좌표 채우기(cands.js)는 b388 부터 나라와
       기준점으로 걸러 왔는데 **이 길만 빠져 있었습니다.** 그러고도 화면은
       「위치를 찾았어요」라고 말합니다 — 확신에 찬 거짓말입니다.
       ⚠ 날짜는 폼에 적힌 날을 씁니다. 아직 안 골랐으면 여행 첫날로 봅니다. */
    const 날 = $('p_date')?.value || trip?.start_date || '';
    const leg = legFirst(legs, 날);
    const 나라 = leg?.country || trip?.country || '';
    기준점 = 여행기준(날);
    for (const q of [...addressQueries(name), name]){
      const hit = await osmLookup(q, { country: 나라, near: 기준점 });
      if (hit === 'stop') break;
      if (hit){ lat = hit.lat; lng = hit.lng; break; }
      await new Promise(r => setTimeout(r, 1100));
    }
  }

  /* 주소로 한 번 더 찾는 갈래까지 끝난 뒤에 풉니다 — 여기가 진짜 끝입니다. */
  풀기();
  if (lat == null){
    planGeo = null;
    /* **못 찾아도 넣기는 됩니다.** 위치가 없을 뿐입니다 — 막으면 안 됩니다. */
    note.textContent = name
      ? `${name} · 지도 위치는 못 찾았어요. 그냥 넣어도 괜찮아요.`
      : '이 링크에서는 위치를 못 찾았어요. 그냥 넣어도 괜찮아요.';
    if (name && !$('p_title').value.trim()) $('p_title').value = name.split(',')[0].trim();
    return;
  }
  planGeo = { lat, lng };
  /* ⚠⚠ **멀면 «멀다»고 말합니다(b730).** ⚠⚠ 링크에 좌표가 들어 있는
     경우에는 위 울타리를 안 지나갑니다 — 구글이 준 값을 그대로 믿습니다.
     그런데 그것도 틀릴 수 있고(짧은 링크가 엉뚱한 곳을 펴는 경우),
     틀린 좌표는 「888분 이동」 같은 그럴듯한 숫자로 바뀝니다.
     막지는 않습니다 — 진짜로 먼 데를 넣는 날도 있습니다. 대신 **묻습니다.**
   ⚠ 30km 는 b388 의 사고(41.2km)보다 안쪽입니다. */
  const 멀다 = (() => {
    const b = 기준점 || 여행기준($('p_date')?.value || trip?.start_date || '');
    if (!b) return 0;
    const d = distKm(b[0], b[1], lat, lng);
    return d != null && d > 30 ? Math.round(d) : 0;
  })();
  note.textContent = (name ? `위치를 찾았어요 · ${name.split(',')[0].trim()}`
                           : '위치를 찾았어요')
                   + (멀다 ? ` · ⚠ 그날 있는 곳에서 ${멀다}km 떨어져 있어요` : '');
  /* 제목이 비어 있으면 채워줍니다. 링크만 붙여넣고 이름을 또 치게 할
     이유가 없습니다. 이미 적었으면 안 건드립니다. */
  if (r.data.name && !$('p_title').value.trim()) $('p_title').value = r.data.name;
}
let geoTimer = null;
['p_memo', 'p_title'].forEach(id => $(id).addEventListener('input', () => {
  clearTimeout(geoTimer); geoTimer = setTimeout(sniffMapLink, 500);
}));

$('p_create').addEventListener('click', async () => {
  $('planformerr').classList.add('hide');
  /* 붙여넣고 바로 눌렀을 수 있습니다. 아직 안 물어봤으면 여기서 물어봅니다. */
  await sniffMapLink();
  const title = $('p_title').value.trim(), date = $('p_date').value;
  const st = $('p_start').value, et = $('p_end').value;

  if (!title) return fail('무엇을 하는지 적어주세요.', 'planform');
  if (!date)  return fail('날짜를 골라주세요.', 'planform');
  if (st && et && et < st) return fail('끝나는 시각이 시작보다 빨라요.', 'planform');

  /* 같은 날 맨 뒤로 보냅니다. 소수를 쓰면 나중에 둘 사이에 끼울 때
     그 둘만 건드리면 됩니다 — 같이 편집할 때 서로의 순서를 안 덮습니다. */
  const sameDay = plans.filter(p => p.date === date);
  const sort = sameDay.length ? Math.max(...sameDay.map(p => +p.sort_order)) + 1 : 0;

  const row = {
    title, date,
    start_time: st || null, end_time: et || null,
    category: $('p_cat').value || null,
    memo: $('p_memo').value.trim() || null,
  };
  /* ── 낙관적 저장 ──
     서버 대답을 기다리는 동안 화면을 붙잡아 두지 않습니다. 먼저 반영하고 뒤에서 보냅니다.
     여행지에서는 이 기다림이 5초씩 걸립니다. 그동안 앱이 멈춘 것처럼 보였습니다.
     실패하면 되돌립니다 — 되돌릴 수 있게 이전 모습을 들고 있습니다. */
  const editing = editPlanId;
  const before  = editing ? { ...plans.find(p => p.id === editing) } : null;
  const tmpId   = 'tmp:' + Math.random().toString(36).slice(2);

  /* 카드나 후보에서 넘어온 좌표. 폼에는 칸이 없어서 따로 들고 있었습니다.
     **고치는 중일 때는 쓰지 않습니다** — 그 일정이 이미 가진 좌표를 덮습니다. */
  /* **붙여넣은 지도 링크가 먼저입니다.** 방금 사람이 직접 준 위치라
     카드에서 딸려온 것보다 확실합니다. 고치는 중이어도 링크를 새로
     붙여넣었으면 그건 "여기로 바꿔달라"는 뜻이므로 씁니다. */
  const geo = planGeo || ((!editing && planSeedGeo) ? planSeedGeo : null);

  if (editing){
    const i = plans.findIndex(p => p.id === editing);
    if (i >= 0) plans[i] = { ...plans[i], ...row };
  } else {
    plans.push({ id: tmpId, trip_id: trip.id, sort_order: sort,
                 lat: geo?.lat ?? null, lng: geo?.lng ?? null,
                 move_note:null, ...row });
  }
  plans.sort((a, b) => a.date.localeCompare(b.date)
    || String(a.start_time ?? '~').localeCompare(String(b.start_time ?? '~'))
    || (+a.sort_order) - (+b.sort_order));

  $('p_title').value = ''; $('p_memo').value = '';
  $('p_start').value = ''; $('p_end').value = '';
  setEditPlanId(null);
  $('plancard').classList.add('hide');
  ctx.drawDays(); drawCats(); drawPlans(); drawPlanMap();

  setPlanSeedGeo(null);             /* 한 번 쓰고 비웁니다. 다음 일정에 묻으면 안 됩니다 */
  /* **고칠 때도 좌표를 같이 보냅니다.** 전에는 넣을 때만 실려서, 이미 있는
     일정에 지도 링크를 붙여넣어도 지도에 안 떴습니다 — 그 일정을 지우고
     다시 만들어야 했습니다. 링크를 새로 붙여넣은 경우(planGeo)만 덮습니다. */
  const r = await write(editing
    ? { table:'plans', action:'update', id:editing,
        row:{ ...row, ...(planGeo || {}) } }
    : { table:'plans', action:'insert',
        row:{ trip_id: trip.id, sort_order: sort, ...row, ...(geo || {}) } });

  if (!r.ok){
    /* 되돌립니다. 저장 안 된 것이 화면에 남아 있으면 여행 중에 그걸 믿고 움직입니다. */
    if (editing){ const i = plans.findIndex(p => p.id === editing); if (i >= 0) plans[i] = before; }
    else setPlans(plans.filter(p => p.id !== tmpId));
    ctx.drawDays(); drawCats(); drawPlans(); drawPlanMap();
    $('plancard').classList.remove('hide');
    return fail(r.why, 'planform');
  }
  if (r.queued) return toast('연결이 없어 들고 있어요. 터지면 바로 보냅니다.');
  await ctx.loadPlans();                       /* 임시 id 를 진짜 id 로 바꿉니다 */
});

$('plans').addEventListener('click', async e => {
  const b = e.target.closest('button[data-pact]'); if (!b) return;
  const id = b.dataset.id;

  /* 고치기 — 일정 칸을 그 줄 내용으로 채워 엽니다. 새로 적게 하지 않습니다. */
  if (b.dataset.pact === 'edit'){
    const p = plans.find(x => x.id === id); if (!p) return;
    /* ⚠⚠ **먼저 닫습니다(b717, b698 점검 여섯째).** ⚠⚠
       `addplanbtn` 은 «토글»입니다. 그래서 일정 추가 폼이 **이미 열려
       있을 때** 「수정」을 누르면 이 클릭이 폼을 도로 «닫았습니다** —
       그러고 나서 아래 줄들이 안 보이는 칸을 채우고 `editPlanId` 까지
       세웁니다. 화면에서는 「수정을 눌렀더니 폼이 사라졌다」로 보이고,
       속으로는 고치기 상태가 남습니다.
       ⚠ cards.js 의 `openPlanForm` 은 이 함정을 알고 같은 줄을 갖고
         있었습니다 — **여기만 빠져 있었습니다.** 고칠 때 둘을 같이 보십시오. */
    $('plancard').classList.add('hide');
    $('addplanbtn').click();
    $('p_title').value = p.title || '';
    $('p_date').value  = p.date || '';
    $('p_start').value = p.start_time ? p.start_time.slice(0,5) : '';
    $('p_end').value   = p.end_time ? p.end_time.slice(0,5) : '';
    $('p_cat').value   = p.category || '';
    $('p_memo').value  = p.memo || '';
    setEditPlanId(id);
    $('p_create').textContent = '고치기';
    /* 제목도 같이 바꿉니다 (b388). 단추는 「고치기」인데 제목이 「일정 추가」라
       서로 다른 말을 했습니다 — 새로 만드는 줄 알고 취소하게 됩니다. */
    $('p_formtitle').textContent = '일정 고치기';
    return;
  }

  if (b.dataset.armed !== '1'){          /* 확인창을 안 쓰는 이유는 목록 쪽과 같습니다 */
    arm(b, '정말 지울까요?'); return;
  }
  /* 지우는 것도 먼저 화면에서 뺍니다. 진짜로 지우지는 않고 숨깁니다 —
     여럿이 쓰면 남이 지운 것을 되살릴 방법이 필요합니다. */
  const gone = plans.find(p => p.id === id);
  setPlans(plans.filter(p => p.id !== id));
  ctx.drawDays(); drawCats(); drawPlans(); drawPlanMap();

  const r = await write({ table:'plans', action:'delete', id });
  if (!r.ok){
    if (gone) plans.push(gone);
    ctx.drawDays(); drawCats(); drawPlans(); drawPlanMap();
    return fail(r.why, 'plan');
  }
  if (r.queued) return toast('연결이 없어 들고 있어요. 터지면 바로 보냅니다.');
  await ctx.loadPlans();
});

