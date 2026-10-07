/* ── 성향이 바뀌면 알려주기(b526) ──────────────────────────────────────
 * **락인에서 마지막까지 빠져 있던 것**입니다. 평가는 하루에 몰아 하고
 * 끝낼 수 있어서, 이 앱에는 **주기적으로 다시 열 이유**가 없었습니다.
 * 후보가 둘이었는데(다녀온 뒤 알림 · 성향 변화 알림) 이쪽을 골랐습니다 —
 * 코드가 실제로 바뀌는 **사건**이라 지어낼 필요가 없고, 재는 함수도
 * 이미 있습니다(card.js 의 personaAxes).
 *
 * ⚠ **푸시가 아닙니다.** 푸시는 일행 기능이 실제로 쓰인 뒤에 켜기로 한
 *   것이라(상용화 메모), 지금은 **앱을 열었을 때 홈 맨 위에** 뜹니다.
 * ⚠ **처음 본 코드는 알리지 않습니다.** 「바뀌었다」는 견줄 것이 있어야
 *   성립합니다 — 첫 계산은 조용히 적어만 둡니다.
 * ⚠ 기기마다 따로 셉니다(localStorage). 계정에 두려면 표가 하나 필요한데,
 *   두 기기에서 한 번씩 보는 것은 나쁜 일이 아니라 그냥 둡니다.
 *
 * ── 언제 적는가 ── 여기서 두 번 틀렸습니다 ───────────────────────────
 * ⚠⚠ **b526: 그리기 «전» 에 적었습니다.** 홈이 한 번 더 그려지며 카드가
 *   지워지면, 이미 적힌 코드와 견주니 「그대로」가 되어 **영영 다시 안
 *   떴습니다.** 저장된 코드는 새 것인데 화면에는 아무것도 없었습니다.
 * ⚠⚠ **b527: 그린 «직후» 에 적었습니다. 이것도 같은 이유로 안 됩니다** —
 *   그리는 것과 **사용자가 보는 것**은 다른 일입니다. 홈은 그 뒤에도
 *   다시 그려지고, 그때 카드는 지워지는데 코드는 이미 적혀 있습니다.
 *   (실측: 저장 FMDP, 화면 아무것도 없음. 두 판 연속 같은 증상.)
 * ⚠⚠ **b528: 사용자가 «치울 때» 적습니다.** 「닫기」나 「보러 가기」를
 *   누르는 것이 곧 봤다는 증거입니다. 그전까지는 홈을 그릴 때마다 다시
 *   붙습니다 — 그게 「다시 열 이유」의 뜻이기도 합니다.
 */
import { $, esc } from './dom.js?v=b831';
import { sb } from './db.js?v=b831';
import { netTimeout } from './net.js?v=b831';
import { cities } from './cities.js?v=b831';
import { personaAxes, personaShiftWhy, PERSONA16, PERSONA_VER } from './card.js?v=b831';

let ctx = { me: () => null, 열기: () => {} };
export function setShiftCtx(o){ ctx = { ...ctx, ...o }; }

/* ⚠⚠ **계정마다 따로 적습니다(b529).** 처음엔 열쇠 하나(`t2:pcode`)에
   적고 로그아웃·로그인에 지웠는데, **지우는 줄을 로그인 쪽에도 넣어서**
   앱을 열 때마다 기준이 사라졌습니다 — 늘 「처음 본 코드」가 되어 알림이
   영영 안 떴습니다(실측: 씨앗을 심어도 저장값이 새 코드로만 남음).
   계정 id 를 열쇠에 넣으면 지울 일이 아예 없습니다. 같은 기기에서 계정을
   바꿔도 서로 안 섞입니다. */
const KEY = uid => 't2:pcode:' + uid;
/* 성향이 서는 문턱 — **해외 10곳**(2026-10-03 사용자). persona.js · people.js · rating.js 와 **같은 값**이어야
   합니다 — 여기만 낮으면 아직 유형이 없는 사람에게 「바뀌었다」고 합니다.
   ⚠ 올린 날(b828) 해외 5~9곳이던 사람은 여기서 서버 코드가 지워집니다(아래 「문턱 아래로 내려가면 지웁니다」). */
const 문턱 = 10;

const 읽기 = uid => { try { return localStorage.getItem(KEY(uid)) || ''; } catch { return ''; } };
const 쓰기 = (uid, v) => { try { localStorage.setItem(KEY(uid), v); } catch {} };
/* v3: 마지막으로 «본» 계산 방법(card.js PERSONA_VER). 계산 방법이 바뀐 뒤 처음 보는 바뀜이면 알림의 이유 한 줄이
   그 탓도 말합니다(personaShiftWhy 셋째 값). 적어 둔 것이 없으면(전부터 쓰던 기기) 2판으로 봅니다. */
const 판KEY = uid => 't2:pver:' + uid;
const 판읽기 = uid => { try { return Number(localStorage.getItem(판KEY(uid)) || 2); } catch { return PERSONA_VER; } };
const 판쓰기 = uid => { try { localStorage.setItem(판KEY(uid), String(PERSONA_VER)); } catch {} };

/* 아직 안 치운 알림. 홈을 다시 그려도 이것이 남아 있으면 다시 붙습니다. */
let 대기 = null;

/* 로그아웃하면 화면에 남은 알림만 버립니다. **적어둔 코드는 안 지웁니다** —
   계정 id 로 갈라 두어서 서로 안 섞이고, 다시 들어왔을 때 견줄 기준이
   남아 있는 편이 맞습니다. */
export function clearPcode(){ 대기 = null; }

/* ── 팔로워에게 보일 성향(b789) ───────────────────────────────────────
 * 다른 사람 화면(people.js)은 내 별점을 다 받지 않고(별점을 숨길 수도
 * 있습니다) `profiles.persona` 네 글자만 읽습니다. 여기서 올려 둡니다.
 * ⚠ **바뀐 때만** 보냅니다 — 홈은 자주 다시 그려집니다. 마지막으로 올린
 *   값을 기기에 적어 두고 같으면 안 보냅니다. 못 올리면 안 적으므로 다음에
 *   다시 해 봅니다(101_follow.sql 을 돌리기 전에도 조용히 넘어갑니다).
 * ⚠ 문턱(해외 10곳) 아래로 내려가면 지웁니다 — 남겨 두면 옛 성향이 계속 보입니다. */
const 올린열쇠 = uid => 't2:psrv:' + uid;
/* ⚠ v2(110): 코드와 함께 **네 축 숫자**(profiles.persona_ax)도 올립니다 — 사람 화면이 막대를 그 사람 것과
   똑같이 그리려면 필요합니다(다시 간 횟수는 남에게 안 가서 거기서 새로 세면 어긋납니다).
   기기에 적는 값은 「코드|네 숫자」입니다. 110 을 아직 안 돌렸으면 숫자 칸이 없다고 거절되므로 코드만 다시
   보냅니다 — 그 앱 켜 있는 동안은 숫자를 더 안 보내 봅니다(`숫자칸없음`). */
let 숫자칸없음 = false;
export function savePersona(uid, code, ax = null){
  const 숫자 = code && ax ? [ax.개척, ax.단골, ax.모험, ax.만족].map(v => Math.round(v)) : null;
  const 값 = (code || '') + (숫자 && !숫자칸없음 ? '|' + 숫자.join(',') : '');
  try { if ((localStorage.getItem(올린열쇠(uid)) ?? '') === 값) return; } catch { return; }
  서버코드 = { uid, code: code || null };
  const 보냄 = 숫자칸없음 ? { persona: code } : { persona: code, persona_ax: 숫자 };
  sb.from('profiles').update(보냄).eq('id', uid)
    .then(r => {
      if (r.error && !숫자칸없음 && /persona_ax/.test(r.error.message || '')){
        숫자칸없음 = true;
        return sb.from('profiles').update({ persona: code }).eq('id', uid)
          .then(r2 => { if (!r2.error) try { localStorage.setItem(올린열쇠(uid), code || ''); } catch {} });
      }
      if (!r.error) try { localStorage.setItem(올린열쇠(uid), 값); } catch {}
    })
    .catch(() => {});
}

/* ── 지난번 코드(v2 흔들림 막기) ──────────────────────────────────────
 * 성향은 이제 **지난번 코드**를 알아야 셉니다 — 가운데 근처에서는 글자를 붙잡습니다(card.js personaAxes).
 * 기준은 **서버에 적힌 것**(profiles.persona) 하나입니다. 기기마다 따로 두면 폰과 PC 가 다른 유형을
 * 붙잡습니다. 못 받아오면 이 기기가 마지막으로 올린 것(`t2:psrv:`)을 씁니다.
 * ⚠ 한 번 받으면 앱이 켜 있는 동안 기억합니다 — 홈과 분석 탭이 자주 다시 그려집니다. 올릴 때 같이 고칩니다. */
let 서버코드 = { uid: null, code: undefined };
/* 이미 받아 둔 것만(기다리지 않음) — 사람 화면(people.js)의 「내 코드」가 궁합을 셀 때 씁니다. 없으면 null. */
export const knownPersona = uid =>
  (uid && 서버코드.uid === uid && 서버코드.code !== undefined) ? 서버코드.code : null;
export async function prevPersona(uid){
  if (!uid) return null;
  if (서버코드.uid === uid && 서버코드.code !== undefined) return 서버코드.code;
  const r = await netTimeout(sb.from('profiles').select('persona').eq('id', uid).maybeSingle());
  if (r && !r.error){
    서버코드 = { uid, code: r.data?.persona || null };
    return 서버코드.code;
  }
  try { return (localStorage.getItem(올린열쇠(uid)) || '').split('|')[0] || null; } catch { return null; }
}

/* ── 재고, 바뀌었으면 알린다 ──────────────────────────────────────────
 * 홈이 다 그려진 뒤에 부릅니다. **화면을 막지 않습니다** — 늦게 와서
 * 맨 위에 한 줄 얹히는 편이, 이것 때문에 홈이 늦게 뜨는 것보다 낫습니다.
 * ⚠ 못 받아오면 **아무 일도 안 합니다.** 반쯤 아는 상태로 「바뀌었다」고
 *   말하면 안 됩니다 — 끊긴 것이지 바뀐 것이 아닙니다.
 * ⚠ 이미 잡아둔 알림이 있으면 **다시 묻지 않고 붙이기만** 합니다.
 *   홈은 자주 다시 그려집니다 — 그때마다 질의를 보내면 안 됩니다. */
export async function checkPersonaShift(){
  if (대기) return 그리기();
  const me = ctx.me();
  if (!me) return;
  /* v2: 다시 간 횟수(visits)도 받고, 지난번 코드(서버)를 넘겨 흔들림을 막습니다. */
  const [r, 전코드] = await Promise.all([
    netTimeout(sb.from('city_ratings')
      .select('city_id,stars,visits').eq('user_id', me.id).not('stars', 'is', null)),
    prevPersona(me.id)]);
  if (!r || r.error || !Array.isArray(r.data)) return;
  /* ⚠ 도시 목록이 아직 없으면 해외를 못 가립니다 — 그때 세면 해외 0곳으로 보고 서버 코드를 지워 버립니다. */
  if (!(cities || []).length) return;
  const ax = personaAxes(r.data, { cities, prev: 전코드 });
  /* v2: 문턱은 **해외** 곳 수(국내는 성향에 안 들어감 — card.js personaAxes 머리). v3: 10곳. */
  if (ax.해외 < 문턱){ savePersona(me.id, null); return; }
  const 지금 = ax?.code;
  if (!지금 || 지금.length !== 4) return;
  savePersona(me.id, 지금, ax);

  const 전 = 읽기(me.id);
  if (!전){ 쓰기(me.id, 지금); 판쓰기(me.id); return; }   /* 처음 본 코드는 견줄 기준일 뿐입니다 */
  if (전 === 지금){ 판쓰기(me.id); return; }   /* 안 바뀌었으면 새 계산 방법도 «본» 것으로 */
  대기 = { 전, 지금, uid: me.id, 규칙: 판읽기(me.id) < PERSONA_VER };
  그리기();
}

/* 치웠다 = 봤다. 그때 적습니다(위 머리말의 b528). */
function 치움(){
  if (대기){ 쓰기(대기.uid, 대기.지금); 판쓰기(대기.uid); }
  대기 = null;
}

function 그리기(){
  const 홈 = $('home');
  if (!홈 || !대기 || 홈.querySelector('.pshift')) return;
  const { 전, 지금 } = 대기;
  const 앞 = PERSONA16[전]?.n || '', 뒤 = PERSONA16[지금]?.n || '';

  const 칸 = document.createElement('div');
  칸.className = 'card pshift';
  칸.innerHTML = `
    <div class="psh-t">성향이 바뀌었어요</div>
    <div class="psh-row">
      <span class="psh-old"><b>${esc(전)}</b><span>${esc(앞)}</span></span>
      <i class="psh-ar">→</i>
      <span class="psh-new"><b>${esc(지금)}</b><span>${esc(뒤)}</span></span>
    </div>
    <div class="memo">${esc(personaShiftWhy(전, 지금, 대기.규칙) || '최근에 매긴 곳들이 그렇게 말해요.')}</div>
    <div class="psh-btns">
      <button class="primary psh-go">뭐가 달라졌는지 보기</button>
      <button class="small psh-x">닫기</button>
    </div>`;
  칸.querySelector('.psh-x').onclick = () => { 칸.remove(); 치움(); };
  칸.querySelector('.psh-go').onclick = () => { 칸.remove(); 치움(); ctx.열기(); };
  홈.prepend(칸);
}
