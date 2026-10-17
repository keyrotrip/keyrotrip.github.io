/* ── 이름 정하기 묻기 (2026-10-16) ──────────────────────────────────────────────
 * 사용자: 닉네임을 안 바꾼 사람이 많다 → 「1·2번으로 가자」
 *   ① 이름이 남에게 처음 보이는 순간 — 한줄평·맛집 추천·답글·방명록을 남기거나 팔로우할 때, 그 자리에서
 *      「이름을 정하고 남길까요?」. 정하든 「나중에」든 하던 일은 그대로 이어집니다(막지 않음).
 *   ② 가입 직후 한 번 — 앱을 열고 이름이 오면 「기로에서 쓸 이름을 정해 주세요」(계정마다 한 번).
 * 「아직 안 정한 이름」 = 비었음 · 기본 이름 「여행자 1234」(db/120) · 메일 앞부분 그대로(옛 기본) — profile.js 의 안내 줄과 같은 셈.
 * 얼마나 자주: ②는 계정마다 한 번. ①은 마지막으로 물은 뒤 7일이 지나야 다시 — ①·② 어느 쪽이든 물으면 둘 다 7일 쉼.
 *   적는 곳은 이 기기(localStorage t2:nameask:<uid>) — 다른 기기에서는 한 번 더 물을 수 있습니다.
 * ⚠ 뒤로가기 = 「나중에」. tripview.js 사슬 «맨 위»에서 닫습니다(이 판은 사람·도시 화면 위에도 뜸 — 따로 popstate 를
 *   달면 사슬이 아래 화면까지 같이 닫습니다).
 * ⚠ 저장 규칙은 프로필 변경(profile.js 「확인」)과 같습니다 — 겹치면 23505 · 못 쓰는 이름 23514 · 30자 넘으면 22001(db/100).
 * 층: dom · db · net 만 읽습니다. 지금 이름은 profile.js 가 알려 주고(이름상태), 저장 뒤 화면 맞추기는 ctx.onSaved(app.js). */
import { esc, toast, josa } from './dom.js?v=b890';
import { sb } from './db.js?v=b890';
import { netTimeout } from './net.js?v=b890';

let ctx = { me: () => null, onSaved: () => {} };
export function setNameAskCtx(o){ ctx = { ...ctx, ...o }; }

/* profile.js 의 setMyName·resetMyName 이 부릅니다 — 받음=false 면 아직 서버 이름을 모릅니다(그동안은 안 물음). */
let 지금이름 = null, 메일앞 = '', 받음 = false;
export function 이름상태(이름, 메일, 서버에서받음){ 지금이름 = 이름 || null; 메일앞 = 메일 || ''; 받음 = !!서버에서받음; }

/* 서버 name_key(db/100: NFKC → 빈칸·보이지 않는 글자 빼기 → 소문자) 흉내 — profile.js 와 같은 식 */
const 키 = s => String(s || '').normalize('NFKC').replace(/[\s­ᅟᅠ᠎​-‏⁠ㅤ﻿ﾠ]+/g, '').toLowerCase();
export function 이름안정함(){
  if (!받음) return false;
  if (!지금이름) return true;
  return /^여행자\d{4,6}$/.test(키(지금이름)) || (!!메일앞 && 키(지금이름) === 키(메일앞));
}

const 쉼 = 7 * 864e5;
const 열쇠 = () => `t2:nameask:${ctx.me()?.id || ''}`;
function 기록(){ try { return JSON.parse(localStorage.getItem(열쇠()) || '{}') || {}; } catch { return {}; } }
function 적기(o){ try { localStorage.setItem(열쇠(), JSON.stringify({ ...기록(), ...o })); } catch {} }

/* 묻고(필요하면) 닫힐 때까지 기다립니다. 때: 'act'(①) · 'first'(②). 안 물으면 바로 돌아옵니다. */
export async function 이름먼저(때 = 'act'){
  if (!ctx.me() || 팝 || !이름안정함()) return;
  const 전 = 기록();
  /* 7일 안에 물었으면 어느 쪽이든 쉼 — ①로 막 물은 사람에게 다음 실행에서 ②를 또 띄우지 않게 */
  if (Date.now() - (전.at || 0) < 쉼 || (때 === 'first' && 전.first)) return;
  적기({ at: Date.now(), ...(때 === 'first' ? { first: 1 } : {}) });
  return new Promise(끝 => 그리기(때, 끝));
}

/* ── 판 — 성향 바뀜 알림의 카드 팝업(.pshpop/.pshcard) 틀 그대로 ─────────────────────── */
let 팝 = null, 끝냄 = null, 물음 = 0, 타이머 = 0;
export const 이름묻기열림 = () => !!팝;

function 그리기(때, 끝){
  /* 「여행자 1234」로 · 「서윤」으로 — 조사는 josa(빈 화면 규칙) */
  const 이름 = 지금이름 || '여행자';
  const 보임 = `「${esc(이름)}」${josa(이름, '으로', '로').slice(이름.length)}`;
  const 제목 = 때 === 'first' ? '기로에서 쓸 이름을 정해 주세요' : '이름을 정하고 남길까요?';
  const 말 = 때 === 'first'
    ? `지금은 ${보임} 보여요. 이름을 정하면 친구가 나를 찾고 알아볼 수 있어요.`
    : `다른 사람에게는 지금 이름 ${보임} 보여요.`;
  끝냄 = 끝;
  팝 = document.createElement('div');
  팝.className = 'pshpop';
  팝.innerHTML = `<div class="pshcard nmcard" role="dialog" aria-modal="true" aria-label="${esc(제목)}">
      <p class="pshtitle">${esc(제목)}</p>
      <p class="nmsub">${말}</p>
      <input class="nmin" type="text" maxlength="30" autocomplete="nickname" placeholder="이름(닉네임)" aria-label="이름">
      <p class="nmhint" aria-live="polite"></p>
      <div class="pshbtns">
        <button type="button" class="primary nmok" disabled>이 이름으로 정하기</button>
        <button type="button" class="pshx nmlater">나중에</button>
      </div>
    </div>`;
  const 칸 = 팝.querySelector('.nmin'), 확인 = 팝.querySelector('.nmok');
  칸.addEventListener('input', () => 살피기(칸, 확인));
  칸.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && !확인.disabled){ e.preventDefault(); 저장(칸, 확인); } });
  확인.onclick = () => 저장(칸, 확인);
  팝.querySelector('.nmlater').onclick = () => 이름묻기닫기();
  /* 바깥(어둡게 깐 자리)을 누르면 「나중에」 */
  팝.addEventListener('click', e => { if (e.target === 팝) 이름묻기닫기(); });
  document.body.appendChild(팝);
  if (history.state?.t2 !== 'nameask') history.pushState({ t2:'nameask' }, '');
  /* 키보드는 누를 때 — 저절로 띄우면 아이폰에서 판이 키보드에 밀립니다 */
}

function 알림(글, 결){
  const h = 팝?.querySelector('.nmhint'); if (!h) return;
  h.textContent = 글 || ''; h.dataset.s = 결 || '';
}
const 말들 = {
  ok:       ['쓸 수 있는 이름이에요.', 'ok'],
  taken:    ['이미 있는 이름이에요. 다른 이름을 골라 주세요.', 'bad'],
  reserved: ['쓸 수 없는 이름이에요.', 'bad'],
  long:     ['이름은 30자까지 쓸 수 있어요.', 'bad'],
};
/* 치고 0.35초 멈추면 서버에 묻습니다(name_free — 프로필 변경과 같음). 묻는 게 실패하면 말없이 저장은 열어 둡니다. */
function 살피기(칸, 확인){
  clearTimeout(타이머);
  const 번 = ++물음, v = 칸.value.trim();
  확인.disabled = !키(v) || 키(v) === 키(지금이름);
  if (!키(v)) return 알림('');
  타이머 = setTimeout(async () => {
    let r; try { r = await sb.rpc('name_free', { n: v }); } catch { return; }
    if (번 !== 물음 || !팝) return;
    const 말 = !r.error && 말들[r.data];
    if (!말) return 알림('');
    알림(...말);
    if (말[1] === 'bad') 확인.disabled = true;
  }, 350);
}

async function 저장(칸, 확인){
  const 이름 = 칸.value.trim(), 나 = ctx.me();
  if (!이름 || !나) return;
  ++물음; clearTimeout(타이머);
  확인.disabled = true;
  const r = await netTimeout(sb.from('profiles').update({ display_name: 이름 }).eq('id', 나.id).select('id'));
  if (!팝) return;
  if (!r || r.error || !r.data?.length){
    const 말 = { '23505': 말들.taken, '23514': 말들.reserved, '22001': 말들.long }[r?.error?.code];
    알림(...(말 || [r?.error?.message || '저장하지 못했어요. 연결을 확인해 주세요.', 'bad']));
    확인.disabled = false;
    return;
  }
  지금이름 = 이름;
  ctx.onSaved(이름);
  toast(`이제 「${이름}」${josa(이름, '으로', '로').slice(이름.length)} 보여요`);
  이름묻기닫기();
}

/* 닫기 — 단추에서 부르면 뒤로가기를 거치고(사슬이 다시 불러 진짜로 닫음), 사슬에서 부르면(뒤로온것) 바로 닫습니다. */
export function 이름묻기닫기(뒤로온것){
  if (!팝) return;
  if (!뒤로온것 && history.state?.t2 === 'nameask'){ history.back(); return; }
  ++물음; clearTimeout(타이머);
  팝.remove(); 팝 = null;
  const f = 끝냄; 끝냄 = null;
  f?.();
}
addEventListener('keydown', e => { if (e.key === 'Escape' && 팝) 이름묻기닫기(); });
