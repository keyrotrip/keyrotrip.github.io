/* ── 한줄평 · 맛집 추천 묻기(b861) ─────────────────────────────────────────────
 * 사용자(10-13): 「유저들한테 후기를 쓰게 어떻게 유도를 할지」 → 「후기를 맛집추천도 많이 녹이는건 어때 어쨋든 기록으로 남으니까」
 *   → 맛집은 따로 칸(시안 C, db/124) · 「별점 매기고 뜨면 이탈이 심해지지 않을까?」 → «단추 한 줄만»:
 *   별을 ★4.5 이상 매긴 직후 「✎ 한줄평 남기기」(왼쪽) · 「🍽 맛집 추천하기」(오른쪽) 한 줄. 누른 사람에게만 그 자리에서 칸이 열립니다.
 *   하루 세 도시까지만 묻고(이 폰) · ×(목록의 얇은 줄)를 누르면 그 도시는 다시 안 묻고 · 빠르게 매기기에서는 안 묻습니다.
 *   맛집 칸이 열리면 지구본 카드의 큰 별은 「오사카 · 내 별점 ★5」 한 줄로 접힙니다(「이 별이 맛집 별점인가」 오해 막기 — 사용자 지적).
 *   칸: 맛집 = 「가게 이름」(필수) + 「한줄평」(선택) · 한줄평 = 한 칸. 예시 문구·질문 칩은 넣지 않습니다(사용자: 「예시는 다 빼」 · 칩 「빼라」).
 * 저장: 한줄평은 saveRate(rating.js — ctx 로 받음, 고리 막기) · 맛집은 food_add(db/124).
 * 누르기는 document 에 한 번 — 지구본 카드 · 평가 탭 줄 · 도시 화면 어디에 붙어도 같은 처리.
 */
import { esc, toast } from './dom.js?v=b861';
import { sb } from './db.js?v=b861';
import { netTimeout } from './net.js?v=b861';
/* 「내 추천 지우기」를 한 번 더 눌러 정하는 장치. ui.js 는 dom.js 만 읽어 고리가 없습니다. */
import { arm } from './ui.js?v=b861';

/* ⚠ 기다리는 시간(검토에서 찾음): netTimeout 기본 2.5초는 «오프라인» 판정까지 켭니다 — 느린 폰 망에서 저장은 됐는데
   「timeout」 오류 + 20초 오프라인 띠가 떴습니다. 쓰기는 10초, 읽기는 8초. 오류 글은 한국어로. */
const 오류말 = r => /timeout|offline|fetch/i.test(r?.error?.message || '') || !r
  ? '연결이 느려요. 잠시 뒤 다시 해주세요.' : (r.error.message || '저장하지 못했어요. 잠시 뒤 다시 해주세요.');

let ctx = { saveRate: async () => false, me: () => null, onFood: () => {} };
export function setCmtCtx(o){ ctx = { ...ctx, ...o }; }

/* ── 묻는 횟수 · 그만 묻기 · 이미 추천한 도시 ─────────────────────────────── */
const 나 = () => ctx.me()?.id || '';   /* 계정마다 따로(세 번째 검토 — 로그아웃 뒤 다른 계정이 앞 사람의 하루 셋·그만을 물려받았음) */
const 오늘 = () => new Date().toLocaleDateString('sv');   /* 이 폰의 날짜(UTC 로 하면 한국 아침 9시에 바뀜 — 검토에서 찾음) */
function 오늘묻은(){ try { const o = JSON.parse(localStorage.getItem('t2:cmday:' + 나()) || '{}'); return o.d === 오늘() ? (o.c || []) : []; } catch { return []; } }
function 묻었다(id){ try { const c = 오늘묻은(); if (!c.includes(id)){ c.push(id); localStorage.setItem('t2:cmday:' + 나(), JSON.stringify({ d: 오늘(), c })); } } catch {} }
const 그만 = id => { try { return localStorage.getItem('t2:cmskip:' + 나() + ':' + id) === '1'; } catch { return false; } };
let 맛집한곳 = null;                       /* 내가 맛집을 추천한 도시(my_food_cities) — 로그인 뒤 한 번 받음 */
export async function loadMyFoods(){
  if (!ctx.me()) return;
  const 누구 = 나();
  const r = await netTimeout(sb.rpc('my_food_cities'), 8000);
  if (r && !r.error && 누구 === 나()) 맛집한곳 = new Set((r.data || []).map(x => x.city_id));
}
/* 로그아웃하면 앞 계정의 것을 버립니다(같은 화면에서 다른 계정으로 들어오는 경우). */
export function resetMyFoods(){ 맛집한곳 = null; }
const 맛집했나 = id => 맛집한곳?.has(id) === true;

/* 물을까 — ★4.5 이상 · 그만 안 눌렀고 · 오늘 세 도시 안(이미 물은 도시는 다시 그려도 됨) · 한줄평이나 맛집 중 남은 게 있을 때 */
export function 물을까(id, 별, 한줄){
  if (별 == null || Number(별) < 4.5 || 그만(id)) return false;
  if (String(한줄 || '').trim() && 맛집했나(id)) return false;
  const c = 오늘묻은();
  return c.includes(id) || c.length < 3;
}

/* 단추 한 줄. 얇게 = 평가 탭 목록용(글자 한 줄 + ×). 부르는 쪽이 물을까()로 거른 뒤 부릅니다. */
export function 묻기Html(id, 이름, 한줄, 얇게 = false){
  묻었다(id);
  const 한줄남음 = !String(한줄 || '').trim(), 맛집남음 = !맛집했나(id);
  const 단추 = (k, 글) => `<button type="button" class="cmbtn" data-cmopen="${k}">${글}</button>`;
  return `<div class="cmask${얇게 ? ' thin' : ''}" data-city="${esc(id)}" data-name="${esc(이름)}">
    <div class="cmbtns">${한줄남음 ? 단추('cmt', 얇게 ? '✎ 한줄평 ›' : '✎ 한줄평 남기기') : ''}${
      맛집남음 ? 단추('food', 얇게 ? '🍽 맛집 추천하기 ›' : '🍽 맛집 추천하기') : ''}${
      얇게 ? '<button type="button" class="cmx" data-cmskip aria-label="이 도시는 그만 묻기">×</button>' : ''}</div>
    <div class="cmform"></div>
  </div>`;
}

/* 칸 — 맛집(가게 이름 + 한줄평) / 한줄평 */
function 칸Html(k, 이름){
  if (k === 'food') return `<div class="cmq">${esc(이름)} 맛집 한 곳 추천한다면?<small>별점 없이 가게 이름만 남기면 돼요 · 다음에 갈 사람에게 큰 도움이 돼요</small></div>
    <input type="text" class="cmfield" data-f="name" maxlength="40" autocomplete="off" placeholder="가게 이름" aria-label="가게 이름">
    <input type="text" class="cmfield" data-f="note" maxlength="60" autocomplete="off" placeholder="한줄평" aria-label="가게 한줄평">
    <div class="cmrow"><button type="button" class="ghost cmclose" data-cmclose>닫기</button><button type="button" class="cmsave" data-cmsave="food" disabled>등록</button></div>`;
  return `<div class="cmq">${esc(이름)}, 한 줄로 남긴다면?<small>다음에 갈 사람에게 큰 도움이 돼요</small></div>
    <input type="text" class="cmfield" data-f="cmt" maxlength="200" autocomplete="off" placeholder="한줄평" aria-label="${esc(이름)} 한줄평">
    <div class="cmrow"><button type="button" class="ghost cmclose" data-cmclose>닫기</button><button type="button" class="cmsave" data-cmsave="cmt" disabled>등록</button></div>`;
}

/* 지구본 카드의 큰 별 접기(맛집 칸이 열린 동안) — 카드(.gsbody)에 .cmfolded, 칸 위에 작은 한 줄 */
function 접기(판, on){
  const 카드 = 판.closest('.gsbody'); if (!카드) return;
  카드.classList.toggle('cmfolded', on);
  판.querySelector('.cmmini')?.remove();
  if (on){
    const 별 = 카드.querySelector('.gsask .stars');
    const v = [...(별?.querySelectorAll('.st i') || [])].reduce((s, i) => s + (parseFloat(i.style.width) || 0) / 100, 0);
    판.insertAdjacentHTML('afterbegin', `<div class="cmmini"><span>${esc(판.dataset.name)} · 내 별점</span><b><i>★</i> ${v ? Number(v.toFixed(1)) : ''}</b>
      <button type="button" class="ghost" data-cmunfold>별 바꾸기</button></div>`);
  }
}

function 열기(판, k){
  const 칸 = 판.querySelector('.cmform');
  const 같은 = 판.dataset.open === k;
  판.dataset.open = 같은 ? '' : k;
  판.querySelectorAll('[data-cmopen]').forEach(b => b.classList.toggle('on', !같은 && b.dataset.cmopen === k));
  칸.innerHTML = 같은 ? '' : 칸Html(k, 판.dataset.name);
  접기(판, !같은 && k === 'food');
  if (!같은) setTimeout(() => 칸.querySelector('input')?.focus(), 0);
}

document.addEventListener('click', async e => {
  const 판 = e.target.closest('.cmask'); if (!판) return;
  const 열 = e.target.closest('[data-cmopen]');
  if (열) return 열기(판, 열.dataset.cmopen);
  if (e.target.closest('[data-cmclose], [data-cmunfold]')) return 열기(판, 판.dataset.open);
  if (e.target.closest('[data-cmskip]')){
    try { localStorage.setItem('t2:cmskip:' + 나() + ':' + 판.dataset.city, '1'); } catch {}
    판.remove(); return;
  }
  const 저장 = e.target.closest('[data-cmsave]');
  if (저장) return 남기기(판, 저장);
});
document.addEventListener('input', e => {
  const 판 = e.target.closest?.('.cmask'); if (!판) return;
  const 필수 = 판.querySelector('[data-f="name"], [data-f="cmt"]');
  const 단추 = 판.querySelector('[data-cmsave]');
  if (단추) 단추.disabled = !필수?.value.trim();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.isComposing || e.target.tagName !== 'INPUT') return;
  const 판 = e.target.closest?.('.cmask'); if (!판) return;
  e.preventDefault();
  const 단추 = 판.querySelector('[data-cmsave]');
  if (단추 && !단추.disabled) 남기기(판, 단추);
});

async function 남기기(판, 단추){
  const k = 단추.dataset.cmsave, id = 판.dataset.city;
  단추.disabled = true;
  let 글 = '';
  if (k === 'food'){
    const 이름 = 판.querySelector('[data-f="name"]').value.trim(), 말 = 판.querySelector('[data-f="note"]').value.trim();
    const r = await netTimeout(sb.rpc('food_add', { p_city: id, p_name: 이름, p_note: 말 || null }), 10000);
    if (!r || r.error){ 단추.disabled = false; toast(오류말(r)); return; }
    (맛집한곳 ||= new Set()).add(id);
    글 = `🍽 맛집을 추천했어요 · <span>${esc(이름)}</span>`;
    ctx.onFood(id);
  } else {
    const v = 판.querySelector('[data-f="cmt"]').value.trim();
    const 됐나 = await ctx.saveRate(id, { comment: v }, true);
    if (됐나 === false){ 단추.disabled = false; toast('저장하지 못했어요. 잠시 뒤 다시 해주세요.'); return; }
    글 = `✎ 한줄평을 남겼어요 · <span>${esc(v)}</span>`;
  }
  /* 남긴 것은 단추에서 빼고, 아래에 한 줄 남깁니다. 둘 다 했으면 단추 줄은 걷힙니다. */
  접기(판, false);
  판.dataset.open = '';
  판.querySelector('.cmform').innerHTML = '';
  if (!판.classList.contains('fdadd')) 판.querySelector(`[data-cmopen="${k}"]`)?.remove();
  판.querySelectorAll('[data-cmopen]').forEach(b => b.classList.remove('on'));
  if (!판.querySelector('[data-cmopen]')) 판.querySelector('.cmbtns')?.remove();
  판.insertAdjacentHTML('beforeend', `<div class="cmdone">${글}</div>`);
}

/* ── 도시 화면 「○○ 맛집 추천」(city.js 가 부름) ─────────────────────────────── */
export async function foodsHtml(id, 이름){
  const r = await netTimeout(sb.rpc('city_foods_list', { p_city: id }), 8000);
  if (!r || r.error) return '';                    /* SQL 전이거나 못 받음 — 칸을 통째로 안 그림 */
  const l = r.data || [];
  const 줄 = l.slice(0, 5).map((f, i) => `<div class="fdrow"><span class="n">${i + 1}</span><div class="b">
      <b>${esc(f.name)}</b><small>${f.n > 1 ? `${f.n}명이 추천` : '1명'}${f.mine ? ' · 나도 추천' : ''}</small>${
        f.mine ? `<button type="button" class="fddel" data-fddel="${esc(f.name)}" data-city="${esc(id)}">내 추천 지우기</button>` : ''}
      ${f.note ? `<div>「${esc(f.note)}」 — ${esc(f.note_by || '여행자')}</div>` : ''}</div></div>`).join('');
  return `<div class="fdsec"><div class="fdhd"><b>🍽 ${esc(이름)} 맛집 추천${l.length ? ` <span>${l.length}</span>` : ''}</b></div>
    ${l.length ? 줄 : '<div class="fdempty">아직 추천이 없어요 — 첫 번째로 추천해 보세요</div>'}
    ${ctx.me() ? `<div class="cmask fdadd" data-city="${esc(id)}" data-name="${esc(이름)}">
      <div class="cmbtns"><button type="button" class="cmbtn wide" data-cmopen="food">+ 내 맛집 추천하기</button></div><div class="cmform"></div></div>` : ''}
  </div>`;
}

/* 내 추천 지우기(검토에서 찾음 — 잘못 쓴 가게 이름이 내 이름과 함께 남는데 지울 길이 없었습니다, db/125 food_del_mine).
   한 번 더 눌러 정합니다(ui.js 의 arm). */
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-fddel]'); if (!b) return;
  if (b.dataset.armed !== '1'){ arm(b, '한 번 더 누르면 지워요'); return; }
  b.disabled = true;
  const r = await netTimeout(sb.rpc('food_del_mine', { p_city: b.dataset.city, p_name: b.dataset.fddel }), 10000);
  if (!r || r.error){ b.disabled = false; toast(오류말(r)); return; }
  toast('추천을 지웠어요');
  loadMyFoods();             /* 그 도시에 내 추천이 안 남았으면 「🍽 맛집 추천하기」를 다시 물을 수 있게(두 번째 검토) */
  ctx.onFood(b.dataset.city);
});
