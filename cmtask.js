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
import { esc, toast, avatarImg, fitImage } from './dom.js?v=b892';
import { 이름먼저 } from './nameask.js?v=b892';   /* 이름이 남에게 처음 보일 때 「이름을 정하고 남길까요?」(2026-10-16) */
import { sb } from './db.js?v=b892';
import { netTimeout } from './net.js?v=b892';
/* 「내 추천 지우기」를 한 번 더 눌러 정하는 장치. ui.js 는 dom.js 만 읽어 고리가 없습니다. */
import { arm } from './ui.js?v=b892';

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
  /* 관리자는 세 도시 제한 없이(b863, 사용자: 「3번 다 질문해서 이제 질문이 뜨지도 않는데?」 — 시험하려면 늘 떠야 함) */
  return window.__관리자 === true || c.includes(id) || c.length < 3;
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
    <div class="cmform"${얇게 ? ' data-kbtop="prev"' : ' data-kbtop'}></div>
  </div>`;
}

/* 맛집만 묻는 줄(b880) — 「다녀온 뒤 평가」 화면에는 한줄평 칸이 **이미 있어서**
   한줄평 단추를 또 달면 같은 것을 두 군데서 받게 됩니다.
 ⚠ **★4.5 문턱도 하루 셋 제한도 안 겁니다**(사용자: 「여행 일정으로 다녀온 건
   4.5 안 넘어도 한줄평, 맛집 추천 다 넣게 해」). 평가 탭에서 «지나가다» 묻는 것과
   달리, 여기는 다녀와서 한 번 작정하고 쓰는 자리입니다 — 그래서 `묻었다`(하루 셋
   셈)도 안 적습니다. 그 제한이 이 화면까지 따라오면 도시 넷째부터는 못 씁니다.
 ⚠ 이미 추천한 도시면 빈 글을 줍니다 — 같은 도시에 두 번 받지 않습니다. */
export function 맛집줄Html(id, 이름){
  if (맛집했나(id)) return '';
  return `<div class="cmask thin" data-city="${esc(id)}" data-name="${esc(이름)}">
    <div class="cmbtns"><button type="button" class="cmbtn" data-cmopen="food">🍽 맛집 추천하기 ›</button></div>
    <div class="cmform" data-kbtop="prev"></div>
  </div>`;
}

/* 칸 — 맛집(가게 이름 + 한줄평) / 한줄평 */
/* b868(사용자: 「이게 넌 직관적이라고 생각해?」) — 설명 글(<small>)을 걷고, 맛집 둘째 칸은 「한줄평」 대신 「어땠는지 한 마디」(도시 한줄평과 말이 겹쳤음).
   도시 화면 「추천하고 싶은 맛집이 있나요?」 줄(짧게)은 질문 글 없이 그 줄이 칸 두 개로 펼쳐집니다(.cvwritebox). */
function 칸Html(k, 이름, 짧게 = false){
  if (k === 'food') return `${짧게 ? '' : `<div class="cmq">${esc(이름)} 맛집 한 곳 추천한다면?</div>`}
    <div class="${짧게 ? 'cvwritebox' : 'cmfoodbox'}">
    <input type="search" enterkeyhint="done" class="cmfield" data-f="name" name="fdshop" maxlength="40" autocomplete="off" autocapitalize="off" placeholder="추천 장소" aria-label="추천 장소">
    <input type="search" enterkeyhint="done" class="cmfield" data-f="note" maxlength="60" autocomplete="off" placeholder="어땠는지 한 마디" aria-label="어땠는지 한 마디">
    ${사진칸()}
    <div class="cmrow"><button type="button" class="ghost cmclose" data-cmclose>${짧게 ? '취소' : '닫기'}</button><button type="button" class="cmsave" data-cmsave="food" disabled>등록</button></div></div>`;
  return `<div class="cmq">${esc(이름)}, 한 줄로 남긴다면?</div>
    <input type="search" enterkeyhint="done" class="cmfield" data-f="cmt" maxlength="200" autocomplete="off" placeholder="한줄평" aria-label="${esc(이름)} 한줄평">
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
  판._사진 = null; 판._사진뺌 = false;   /* 취소했다 다시 열면 고른 사진도 버림(b870 검토 — 안 보이는 옛 사진이 같이 올라갔음) */
  판.querySelectorAll('[data-cmopen]').forEach(b => b.classList.toggle('on', !같은 && b.dataset.cmopen === k));
  칸.innerHTML = 같은 ? '' : 칸Html(k, 판.dataset.name, 판.classList.contains('fdadd'));
  접기(판, !같은 && k === 'food');
  /* ⚠ 누른 그 자리에서 바로 커서를 넣습니다(b862, 사용자: 「키보드 활성화하면 오류 생겨 한번생기고 다시 누르면 정상」).
     setTimeout 으로 미루면 아이폰은 «누름» 밖의 focus 로 보고 키보드를 반쯤만 다룹니다 — 화면이 한 번 밀린 채 남았습니다.
     칸은 바로 위에서 innerHTML 로 이미 붙어 있습니다. */
  if (!같은) 칸.querySelector('input')?.focus();
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

/* 사진 한 장 고르는 줄(b870) — 고른 파일은 판에 들고 있다가(판._사진) 등록할 때 올립니다 */
function 사진칸(지금 = ''){
  return `<div class="cmph"><label class="cmphpick"><input type="file" accept="image/*" data-f="photo" hidden>
      <span class="cmphbox"${지금 ? ` style="background-image:url('${esc(String(지금).replace(/['()\\]/g, encodeURIComponent))}')"` : ''}>${지금 ? '' : '📷'}</span><span class="cmphtxt">${지금 ? '사진 바꾸기' : '사진 한 장'}</span></label>
      <button type="button" class="ghost cmphx${지금 ? '' : ' hide'}" data-cmphx>빼기</button></div>`;
}
document.addEventListener('change', e => {
  const 칸 = e.target.closest?.('[data-f="photo"]'); if (!칸) return;
  const 파일 = 칸.files?.[0]; if (!파일) return;
  if (!/^image\//.test(파일.type || 'image/')){ toast('사진만 올릴 수 있어요'); 칸.value = ''; return; }
  const 묶음 = 칸.closest('.cmask, .fdedit'); if (!묶음) return;
  묶음._사진 = 파일; 묶음._사진뺌 = false;
  const 상자 = 칸.closest('.cmph');
  if (묶음._미리) URL.revokeObjectURL(묶음._미리);
  묶음._미리 = URL.createObjectURL(파일);
  상자.querySelector('.cmphbox').style.backgroundImage = `url('${묶음._미리}')`;
  상자.querySelector('.cmphbox').textContent = '';
  상자.querySelector('.cmphtxt').textContent = '사진 바꾸기';
  상자.querySelector('.cmphx').classList.remove('hide');
});
document.addEventListener('click', e => {
  const x = e.target.closest('[data-cmphx]'); if (!x) return;
  const 묶음 = x.closest('.cmask, .fdedit'); if (!묶음) return;
  묶음._사진 = null; 묶음._사진뺌 = true;
  const 상자 = x.closest('.cmph');
  상자.querySelector('input').value = '';
  상자.querySelector('.cmphbox').style.backgroundImage = ''; 상자.querySelector('.cmphbox').textContent = '📷';
  상자.querySelector('.cmphtxt').textContent = '사진 한 장';
  x.classList.add('hide');
});
/* 사진 올리기 — 긴 변 1200 으로 줄여 JPEG 로 다시 굽고(위치 정보 EXIF 가 빠짐) 내 폴더에 올린 뒤 그 추천 줄에 주소를 답니다(db/129). */
export async function 맛집사진올리기(foodId, 파일, 옛주소 = ''){
  const me = ctx.me(); if (!me || !foodId || !파일) return false;
  let path = '';
  try {
    const blob = await fitImage(파일, 1200, 0.82);
    path = `${me.id}/${foodId}-${Date.now()}.jpg`;
    const up = await netTimeout(sb.storage.from('food-photos').upload(path, blob, { contentType: 'image/jpeg' }), 20000);
    if (!up || up.error) throw (up?.error || new Error('timeout'));
    const url = sb.storage.from('food-photos').getPublicUrl(path).data.publicUrl;
    const r = await netTimeout(sb.rpc('food_photo_set', { p_id: foodId, p_url: url }), 10000);
    if (!r || r.error) throw (r?.error || new Error('timeout'));
    if (옛주소) 맛집사진파일지우기(옛주소);   /* 바꾼 옛 사진 파일은 지움(검토 — 주소로 계속 보였음) */
    return true;
  } catch (err) {
    if (path) sb.storage.from('food-photos').remove([path]).catch(() => {});   /* 달지 못한 새 파일은 치움 */
    toast(/신고된 사진/.test(err?.message || '') ? err.message : '사진은 올리지 못했어요 — 글은 남았어요');
    return false;
  }
}
/* 내 사진 파일 지우기 — 공개 주소에서 «내 폴더» 안 경로만 꺼냅니다(남의 것은 저장소 규칙이 막음). 실패해도 조용히. */
export function 맛집사진파일지우기(주소){
  const me = ctx.me(); const 경로 = String(주소 || '').split('/food-photos/')[1]?.split('?')[0];
  if (!me || !경로 || !경로.startsWith(me.id + '/')) return;
  sb.storage.from('food-photos').remove([decodeURIComponent(경로)]).catch(() => {});
}

async function 남기기(판, 단추){
  const k = 단추.dataset.cmsave, id = 판.dataset.city;
  단추.disabled = true;
  let 글 = '';
  if (k === 'food'){
    const 이름 = 판.querySelector('[data-f="name"]').value.trim(), 말 = 판.querySelector('[data-f="note"]').value.trim();
    /* 사진은 글과 같이 보입니다(글 없는 추천은 줄에 안 나옴) — 사진만 넣었으면 한 마디를 먼저 청합니다(b870) */
    if (판._사진 && !말){ 단추.disabled = false; toast('사진을 넣으려면 한 마디도 적어 주세요'); 판.querySelector('[data-f="note"]')?.focus(); return; }
    await 이름먼저();
    const r = await netTimeout(sb.rpc('food_add', { p_city: id, p_name: 이름, p_note: 말 || null }), 10000);
    if (!r || r.error){ 단추.disabled = false; toast(오류말(r)); return; }
    (맛집한곳 ||= new Set()).add(id);
    if (판._사진){ await 맛집사진올리기(r.data, 판._사진); 판._사진 = null; }
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
  /* 줄은 한줄평 줄과 같은 모양(b862, 사용자: 「맛집도 한줄평이랑 같은 줄 모양으로 가자」) — 가게 이름 · 쓴 사람(사진·이름, 누르면 그 사람) · 한줄평 ·
     「추천 N」 단추. 「나도 추천」은 글을 안 쓰고 단추만 누르면 됩니다(사용자: 「동의하면 직접 적는게 아니라 추천 버튼만 누르면되게」).
     ⚠ 「1명 · 나도 추천」 같은 말은 걷었습니다(사용자: 「이게 무슨말이야」) — 내가 눌렀는지는 단추 색이 말합니다. */
  /* b866(사용자: 「따봉은 내가 올렸을땐 안눌러져있고 다른 사람이 눌러야지 · 따봉 한번 더 눌러서 글 삭제 하느게 세상에 어딨냐 · 여기도 수정 삭제」):
     · 내가 «글까지» 쓴 가게의 👍 는 칠하지도 누르지도 않습니다(내 한줄평 ♡ 와 같음) — mine_note(db/127), SQL 전이면 대표 글이 내 것인지로.
     · 글 없이 👍 만 누른 가게는 칠해지고, 다시 누르면 빠집니다(지워질 글이 없으니 한 번에).
     · 지우기는 내 글 줄의 「삭제」로만(두 번 눌러 정함). 대표 글은 내 글이 먼저라(db/127) 늘 찾을 수 있습니다.
     · 💬 = 그 글의 답글(cityrev.js 의 'fn' 판) · 글 쓴 사람이 여럿이면 「추천 글 N개 더 보기」('fs' 판). */
  const 나 = ctx.me()?.id;
  const 줄 = l.slice(0, 5).map((f, i) => {
    const 내글 = f.mine_note ?? (!!f.mine && !!나 && f.note_uid === 나);
    const 눌림 = !!f.mine && !내글;
    const 내대표 = !!나 && f.note && f.note_uid === 나;
    return `<div class="crvrow fdrow2">
      <div class="fdname"><span class="fdi" aria-hidden="true">${포크}</span><b>${esc(f.name)}</b>
        <button type="button" class="fdrec${눌림 ? ' on' : ''}" data-fdrec="${esc(f.name)}" data-city="${esc(id)}"
        aria-pressed="${눌림 ? 'true' : 'false'}"${!나 || 내글 ? ' disabled' : ''}>${엄지(눌림)}<span class="num">${f.n > 1 ? f.n - 1 : ''}</span></button></div>
      ${f.note ? `<div class="fdbody"><div class="fdl">${f.note_uid ? `<button class="ghost crvwho" data-person="${esc(f.note_uid)}">${avatarImg(f.note_avatar, f.note_uid, f.note_by,
          'width:36px;height:36px;border-radius:50%;object-fit:cover;flex:none', 'thumb')}<b>${esc(f.note_by || '여행자')}</b></button>`
        : `<div class="crvwho"><b>${esc(f.note_by || '여행자')}</b></div>`}
      <div class="crvtxt fdtxt"${f.note_id ? ` data-fdnote="${f.note_id}" data-city="${esc(id)}"` : ''}>${esc(f.note)}</div></div>
      ${f.note_photo ? `<img class="fdph" src="${esc(f.note_photo)}" alt="" loading="lazy"${f.note_id ? ` data-fdnote="${f.note_id}" data-city="${esc(id)}"` : ''} onerror="this.remove()">` : ''}</div>
      <div class="crvact">${f.note_id ? `<button type="button" class="crvrep" data-fdnote="${f.note_id}" data-city="${esc(id)}"
          aria-label="답글${f.n_reply ? ` ${f.n_reply}개` : ' 달기'}">${말풍선}<span class="num">${f.n_reply || ''}</span></button>` : ''}
        ${내대표 ? `<span class="crvmyb"><button type="button" class="ghost" data-fdedit="${esc(f.name)}" data-city="${esc(id)}" data-fdid="${f.note_id || ''}" data-photo="${esc(f.note_photo || '')}">수정</button><button type="button" class="ghost" data-fddel="${esc(f.name)}" data-city="${esc(id)}" data-photo="${esc(f.note_photo || '')}">삭제</button></span>` : ''}
      </div>
      ${(f.n_notes || 0) > 1 ? `<button type="button" class="ghost fdmore" data-fdshop="${esc(f.name)}" data-city="${esc(id)}">추천 글 ${f.n_notes - 1}개 더 보기 ›</button>` : ''}` : ''}
    </div>`;
  }).join('');
  /* b867(사용자 시안 승인): 한줄평 칸과 같은 틀 — 제목 줄(.cvsechd) · 바로 밑 «쓰는 줄»(한줄평 칸과 같은 모양) · 줄들 · 빈 줄은 한 줄만(부제 걷음). */
  return `<div class="fdsec"><div class="cvsechd"><b>맛집 추천</b>${l.length ? `<span class="n">${l.length}</span>` : ''}</div>
    ${ctx.me() ? `<div class="cmask fdadd" data-city="${esc(id)}" data-name="${esc(이름)}">
      <div class="cmbtns"><button type="button" class="cmbtn wide cvwrite" data-cmopen="food"><span>추천하고 싶은 맛집이 있나요?</span><b>추천하기</b></button></div><div class="cmform" data-kbtop></div></div>` : ''}
    ${l.length ? 줄 : '<div class="secempty">아직 추천이 없어요</div>'}
  </div>`;
}

/* 「추천」 단추(b862) — 안 눌렀으면 같은 이름으로 food_add(한줄평 없이) · 눌렀으면 food_del_mine.
   ⚠ 내가 한줄평까지 쓴 가게면 그 글도 같이 지워지므로 한 번 더 눌러 정합니다(ui.js 의 arm). 단추 하나 누르기로 글이 사라지면 안 됩니다. */
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-fdrec]'); if (!b || b.disabled) return;
  if (!ctx.me()) return;
  /* 칠해진 👍 = 글 없이 누른 추천뿐(내가 글을 쓴 가게는 disabled — 위 foodsHtml). 그래서 빼도 지워질 글이 없어 한 번에 뺍니다(b866). */
  const 켜짐 = b.classList.contains('on');
  b.disabled = true;
  if (!켜짐) await 이름먼저();
  const r = 켜짐
    ? await netTimeout(sb.rpc('food_del_mine', { p_city: b.dataset.city, p_name: b.dataset.fdrec }), 10000)
    : await netTimeout(sb.rpc('food_add', { p_city: b.dataset.city, p_name: b.dataset.fdrec, p_note: null }), 10000);
  if (!r || r.error){ b.disabled = false; toast(오류말(r)); return; }
  toast(켜짐 ? '추천을 뺐어요' : '추천했어요');
  loadMyFoods();             /* 그 도시에 내 추천이 남았는지로 「🍽 맛집 추천하기」를 물을지가 갈립니다 */
  ctx.onFood(b.dataset.city);
});
/* 내 추천 글 「수정 · 삭제」(b866, 사용자: 「여기도 똑같이 수정 삭제 있어야하고」) — 한줄평 줄과 같은 자리.
   수정 = 그 자리에서 글 칸으로 바뀜(장소 이름은 그대로, 글만) → food_add 가 같은 가게 줄의 글을 고칩니다(db/124 on conflict).
   삭제 = 두 번 눌러 정함(ui.js arm) → food_del_mine(그 가게 내 추천째 · 답글도 같이). */
document.addEventListener('click', async e => {
  const 고 = e.target.closest('[data-fdedit]');
  if (고){
    const 줄 = 고.closest('.fdrow2'), 글칸 = 줄?.querySelector('.fdtxt'); if (!글칸 || 줄.querySelector('.fdedit')) return;
    글칸.insertAdjacentHTML('afterend', `<div class="fdedit" data-kbtop>
      <input type="search" enterkeyhint="done" class="cmfield" maxlength="60" autocomplete="off" aria-label="추천 글 고치기" value="${esc(글칸.textContent)}">
      ${사진칸(고.dataset.photo)}
      <div class="cmrow"><button type="button" class="ghost cmclose" data-fdeditx>취소</button>
        <button type="button" class="cmsave" data-fdeditsave="${esc(고.dataset.fdedit)}" data-city="${esc(고.dataset.city)}" data-fdid="${esc(고.dataset.fdid)}" data-photo="${esc(고.dataset.photo || '')}">저장</button></div></div>`);
    글칸.classList.add('hide');
    const 칸 = 줄.querySelector('.fdedit input'); 칸.focus(); 칸.setSelectionRange?.(칸.value.length, 칸.value.length);
    return;
  }
  if (e.target.closest('[data-fdeditx]')){
    const 줄 = e.target.closest('.fdrow2'); 줄?.querySelector('.fdedit')?.remove(); 줄?.querySelector('.fdtxt')?.classList.remove('hide');
    return;
  }
  const 저 = e.target.closest('[data-fdeditsave]');
  if (저){
    const 글 = 저.closest('.fdedit')?.querySelector('input')?.value.trim() || '';
    if (!글){ toast('글을 지우려면 「삭제」를 눌러 주세요'); return; }
    저.disabled = true;
    const r = await netTimeout(sb.rpc('food_add', { p_city: 저.dataset.city, p_name: 저.dataset.fdeditsave, p_note: 글 }), 10000);
    if (!r || r.error){ 저.disabled = false; toast(오류말(r)); return; }
    /* 사진 바꾸기·빼기(b870) — 고른 게 있으면 올려 달고, 「빼기」를 눌렀으면 주소를 지웁니다 */
    const 묶음 = 저.closest('.fdedit'), fid = Number(저.dataset.fdid) || r.data, 옛 = 저.dataset.photo || '';
    let 사진됨 = true;
    if (묶음._사진) 사진됨 = await 맛집사진올리기(fid, 묶음._사진, 옛);
    else if (묶음._사진뺌 && 옛){
      const x = await netTimeout(sb.rpc('food_photo_set', { p_id: fid, p_url: null }), 10000);
      if (x && !x.error) 맛집사진파일지우기(옛); else 사진됨 = false;
    }
    저.disabled = false;
    if (!사진됨){ ctx.onFood(저.dataset.city); return; }   /* 사진 쪽 알림(위)이 덮이지 않게 */
    toast('추천 글을 고쳤어요');
    ctx.onFood(저.dataset.city);
    return;
  }
  const 지 = e.target.closest('[data-fddel]');
  if (지){
    if (지.dataset.armed !== '1'){ arm(지, '한 번 더 누르면 지워요'); return; }
    지.disabled = true;
    const r = await netTimeout(sb.rpc('food_del_mine', { p_city: 지.dataset.city, p_name: 지.dataset.fddel }), 10000);
    if (!r || r.error){ 지.disabled = false; toast(오류말(r)); return; }
    toast('추천을 지웠어요');
    if (지.dataset.photo) 맛집사진파일지우기(지.dataset.photo);   /* 추천을 지우면 사진 파일도(b870 검토) */
    loadMyFoods();
    ctx.onFood(지.dataset.city);
  }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.isComposing || !e.target.closest?.('.fdedit')) return;
  e.preventDefault(); e.target.closest('.fdedit').querySelector('[data-fdeditsave]')?.click();
});
/* 포크·나이프 — 가게 줄 맨 앞(b867, 한줄평 줄과 구별) */
const 포크 = '<svg class="crvic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v8m-2.5-8v5a2.5 2.5 0 0 0 5 0V3M7 11v10m10-18c-2 1.5-3 4-3 7v3h3v8"/></svg>';
const 말풍선 = '<svg class="crvic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 5.5h15v10.5H10l-5.5 4v-4z"/></svg>';
/* 엄지 그림 — 한줄평의 하트처럼 선 그림, 누르면 채움 */
function 엄지(on){
  return `<svg class="crvic fdic${on ? ' on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11H3V10h4Zm0 0 4-7c1.7 0 2.7 1.2 2.4 2.9L13 9h5.6c1.3 0 2.2 1.2 1.9 2.4l-1.8 7.6c-.2.9-1 1.5-1.9 1.5H7"/></svg>`;
}

