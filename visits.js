/* ── 다시 간 도시(성향 v2, 2026-09-30) ─────────────────────────────────
 * 사용자: 「성향은 여러번 똑같은 도시까지 녹일 수 있고 좀 더 다양성있게 로직을 짜보자」
 *   → 명세(2.2~2.3) · 시안 ② → 사용자가 고름.
 * 매긴 도시 목록에서 **다시 간 곳만 +** 를 누릅니다. 별점을 매길 때는 묻지 않습니다(명세 2.1 —
 * 별점 흐름에 한 단계도 더하지 않기). 여는 곳은 분석 탭 두 군데(persona.js 의 카드 · 「왜 인가요」 끝 줄).
 *
 * ⚠ **한 번이라도 저장하면 매긴 줄마다 숫자(1 이상)가 적힙니다** — 그게 「알려줬다」의 표시입니다
 *   (card.js personaAxes 의 `알려줌`). 그래서 처음 저장은 안 바꾼 줄(1번)까지 다 적고, 그 뒤로는 바뀐
 *   줄만 적습니다. 비어 있는 것을 「한 번도 안 갔다」로 읽지 않기 위해서입니다.
 * ⚠ 이 칸만 바꾸면 110 의 트리거가 updated_at 을 그대로 둡니다 — 일기장·보관함 최신순이 안 흔들립니다.
 *   UPDATE 만 보냅니다(upsert 아님) — 없는 줄을 새로 만들 일이 없습니다.
 * ⚠ 설명 줄(「한 번 여행에서 둘러봤으면 1번…」)은 **사용자가 뺐습니다**(2026-09-30: 「이 설명은 빼자」).
 * ⚠ 5 는 「5번 이상」입니다(109 의 제약이 1~5).
 *
 * 층: dom.js · db.js · cities.js. persona.js 를 import 하지 않습니다(고리) — 저장 뒤 할 일은 받아서 부릅니다.
 * 뒤로가기는 tripview.js 의 사슬이 닫습니다(isVisitsOpen · closeVisits). */
import { $, esc, toast } from './dom.js?v=b822';
import { sb } from './db.js?v=b822';
import { cities } from './cities.js?v=b822';

let 판 = null;   /* { uid, 줄, 값: Map(도시 → 1~5), 처음, 다음 } */

export const isVisitsOpen = () => !!판;

export function closeVisits(fromPop){
  if (!판) return;
  if (!fromPop && history.state?.t2 === 'visits'){ history.back(); return; }
  판 = null;
  $('visitsheet')?.remove();
}

export function openVisits(uid, rows, 다음){
  if (!uid || !rows?.length || 판) return;
  const 이름 = id => (cities || []).find(c => c.id === id)?.name || id;
  const 값 = new Map(rows.map(r => [r.city_id, Math.min(5, Math.max(1, Math.round(Number(r.visits) || 1)))]));
  /* 이미 여러 번이라고 한 곳이 위, 그다음 별점 높은 곳 — 좋아한 곳을 다시 가기 쉽습니다. */
  const 줄 = rows.map(r => ({ id: r.city_id, name: 이름(r.city_id), stars: Number(r.stars), 원래: r.visits ?? null }))
    .sort((a, b) => (값.get(b.id) - 값.get(a.id)) || (b.stars - a.stars) || a.name.localeCompare(b.name, 'ko'));
  판 = { uid, 줄, 값, 처음: !rows.some(r => r.visits != null), 다음 };

  const el = document.createElement('div');
  el.id = 'visitsheet';
  el.className = 'sheet';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', '다시 간 도시');
  el.innerHTML = `
    <div class="shdim" data-vs="x"></div>
    <div class="shwrap"><div class="shcard">
      <div class="shhead"><span>다시 간 도시</span>
        <button type="button" class="shdone" data-vs="x">닫기</button></div>
      <div class="vsbody">
        <div class="memo">모든 도시는 1번으로 돼 있어요. 다시 간 곳만 +를 눌러 주세요.</div>
        <input type="search" id="vsq" placeholder="도시 찾기" autocomplete="off" enterkeyhint="search">
        <div id="vslist"></div>
      </div>
      <div class="vsfoot"><button type="button" class="primary" id="vssave">저장하기</button></div>
    </div></div>`;
  document.body.appendChild(el);
  목록('');
  el.addEventListener('click', e => {
    if (e.target.closest('[data-vs="x"]')) return closeVisits();
    const b = e.target.closest('button[data-d]');
    if (!b || !판) return;
    const row = b.closest('.vsrow'), id = row?.dataset.id;
    if (!id) return;
    const v = Math.min(5, Math.max(1, 판.값.get(id) + Number(b.dataset.d)));
    판.값.set(id, v);
    row.outerHTML = 한줄(판.줄.find(x => x.id === id));
  });
  $('vsq').addEventListener('input', e => 목록(e.target.value));
  $('vssave').onclick = 저장;
  history.pushState({ t2:'visits' }, '');
}

function 한줄(x){
  const v = 판.값.get(x.id);
  return `<div class="vsrow${v > 1 ? ' up' : ''}" data-id="${esc(x.id)}">
    <span class="vsname">${esc(x.name)}<i>★${esc(x.stars)}</i></span>
    <span class="vsstep">
      <button type="button" data-d="-1" aria-label="${esc(x.name)} 한 번 빼기"${v <= 1 ? ' disabled' : ''}>−</button>
      <b>${v >= 5 ? '5번+' : v + '번'}</b>
      <button type="button" data-d="1" aria-label="${esc(x.name)} 한 번 더하기"${v >= 5 ? ' disabled' : ''}>+</button>
    </span></div>`;
}

function 목록(q){
  const 찾기 = String(q || '').trim();
  const 보일 = 판.줄.filter(x => !찾기 || x.name.includes(찾기));
  $('vslist').innerHTML = 보일.length ? 보일.map(한줄).join('')
    : `<div class="empty" style="padding:18px 6px">「${esc(찾기)}」은(는) 매긴 도시에 없어요</div>`;
}

async function 저장(){
  if (!판) return;
  const { uid, 줄, 값, 처음 } = 판;
  const 보낼 = 줄.filter(x => 처음 || x.원래 !== 값.get(x.id));
  if (!보낼.length){ closeVisits(); return; }
  const btn = $('vssave');
  btn.disabled = true; btn.textContent = '저장하는 중…';
  /* 같은 횟수끼리 묶어 한 번에 — 처음 저장이 일흔 곳이어도 요청은 많아야 다섯 번입니다. */
  const 묶음 = new Map();
  for (const x of 보낼){ const v = 값.get(x.id); if (!묶음.has(v)) 묶음.set(v, []); 묶음.get(v).push(x.id); }
  const rs = await Promise.all([...묶음].map(([v, ids]) =>
    sb.from('city_ratings').update({ visits: v }).eq('user_id', uid).in('city_id', ids)));
  const 틀림 = rs.find(r => r.error);
  if (틀림){
    btn.disabled = false; btn.textContent = '저장하기';
    toast('저장하지 못했어요. 다시 눌러 주세요.');
    self.reportError?.(new Error('다시 간 도시 저장: ' + (틀림.error.message || '')));
    return;
  }
  const 다음 = 판.다음;
  closeVisits();
  toast('저장했어요');
  다음?.();
}
