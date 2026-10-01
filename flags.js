/* ── 만든 사람이 켜고 끄는 것들 ───────────────────────────────────────
 * 서버(`app_flags`)에 적어두고 앱이 뜰 때 한 번 읽습니다. 배포하지 않고도
 * 기능을 끄거나 안내를 띄울 수 있습니다 — 문제가 생겼을 때 **되돌리기보다
 * 끄는 것이 빠릅니다.**
 *
 *   `flags.features`  기능별 스위치. **없으면 켜진 것으로 봅니다**(`featOn`) —
 *                     새 기능을 낼 때마다 서버에 줄을 넣어야 하면 잊습니다.
 *   `flags.readonly`  읽기 전용. 고치는 단추를 다 잠급니다.
 *   `flags.signup`    새 가입을 받을지.
 *   `flags.notice`    화면 위에 띄우는 안내 한 줄.
 *
 * ── app.js 에서 떼어낸 서른여섯 번째 조각입니다(b360) ────────────────
 * **딸린 것이 0 입니다.** 58줄로 작지만 뗀 값이 따로 있습니다 —
 * `planview.js` 와 `geocode.js` 가 `featOn`·`flags` 를 **ctx 로 받고**
 * 있었는데 이제 직접 import 합니다. 그쪽 ctx 가 각각 둘씩 줄었습니다.
 * **작은 것을 아래로 내리면 위쪽 여럿이 가벼워집니다**(b351 의 putHtml 과 같은 꼴).
 *
 * 층: db.js · net.js · dom.js 만 씁니다. */
import { sb } from './db.js?v=b817';
import { netTimeout, setReadOnly } from './net.js?v=b817';
/* `$` 를 안 가져온 채로 b360 에 나갔습니다. drawNotice 와 applyFeatures 가
   async 안에서 도는 터라 조용한 unhandledrejection 으로만 남았고, 화면에는
   아무 표시도 안 났습니다 — 공지줄·기능 스위치·읽기전용이 통째로 안 걸린
   채였습니다. check-refs 가 `$` 를 못 보고 있었습니다(b362 에서 고침). */
import { $ } from './dom.js?v=b817';

/* ── 만든 사람이 켜고 끄는 것들 ─────────────────────────────────────
 * 일이 터졌을 때 **배포를 기다리지 않아도 되게** 하는 값들입니다(db/066).
 * 배포는 몇 분 걸리고 그 사이에도 돈이 나가거나 잘못된 알림이 계속 갑니다.
 *
 * **못 읽으면 전부 켜진 것으로 봅니다.** "설정을 못 읽었으니 다 꺼둔다"는
 * 앱을 멈추는 것과 같습니다 — 오프라인에서 특히 그렇습니다.
 * 066 을 아직 안 올린 곳에서도 같은 이유로 그대로 돕니다. */
export let flags = { notice:{ text:'' }, signup:true, readonly:false, features:{} };
export const featOn = k => flags.features?.[k] !== false;

/* ⚠ **부팅에 두 번 불립니다.** 로그인 화면용으로 한 번(맨 아래 `loadFlags().then`),
   로그인이 끝나고 또 한 번. 이미 들어와 있는 사람은 둘이 나란히 나갑니다 —
   재보니 **685ms + 701ms**, 둘 다 첫 화면을 기다리게 하는 자리였습니다.
   부르는 쪽 둘 다 이유가 있어서 어느 하나를 지우기보다, **돌고 있으면 그 약속을
   같이 씁니다.** 끝나면 비우므로 나중에 다시 부르면 새로 받아옵니다
   (관리자가 스위치를 바꾸고 새로고침하는 길이 살아 있어야 합니다). */
let flagsP = null;
export function loadFlags(){
  if (flagsP) return flagsP;
  flagsP = (async () => {
    const r = await netTimeout(sb.rpc('public_flags'), 4000);
    if (r.error || !r.data) return;        /* 조용히 지금 값을 지킵니다 */
    flags = { ...flags, ...r.data };
    drawNotice();
    applyFeatures();
  })().finally(() => { flagsP = null; });
  return flagsP;
}

/* ── 언제 공지를 띄우나 (b724, 사용자 결정: 「진짜 중요한 것만」) ───────
 * ⚠⚠ **잣대 하나: 「모르고 지나가면 사용자가 손해를 보는가.」** ⚠⚠
 *   「알아두면 좋은 것」은 공지가 아닙니다 — 그건 그 기능이 있는 화면에서
 *   말하면 됩니다. 이 띠는 **모든 화면 맨 위에 붙어 안 없어지므로**,
 *   가벼운 것에 쓰면 다음에 진짜 급할 때 아무도 안 읽습니다.
 *
 *   띄울 것
 *     · 자료가 샜거나 잘못 나갔을 때(방침 14항)
 *     · 저장한 것이 사라졌거나 되돌렸을 때 — 「몇 시부터 몇 시 사이」를 적습니다
 *     · 알림을 껐을 때(push_on off) — 기다리는 알림이 안 갑니다
 *     · AI 를 껐을 때(ai_on off) — 눌러도 안 되면 고장으로 보입니다
 *     · 서비스를 닫거나 유료로 바꿀 때
 *     · **불리한** 방침·약관 변경(시행 30일 전부터. privacy.html 16항)
 *
 *   띄우지 말 것
 *     · 새 기능 알림 · 팁 · 이벤트
 *     · 이미 하던 일을 방침에 더 정확히 적는 변경 — 방침 페이지가 합니다
 *       (b720~b723 에서 실제로 겪은 자리입니다. 띄웠다가 내렸습니다)
 *     · **점검 중** — 안 적어도 아래 `applyFeatures` 가 빨간 띠를 스스로 냅니다
 *
 * ⚠⚠ **로그아웃 상태에서는 안 뜹니다.** 이 띠는 `#signedin` 안에 삽니다
 *   (index.html). 그래서 **「가입을 잠시 막았어요」는 이 띠로 못 알립니다** —
 *   그건 로그인 화면이 따로 말해야 합니다(`flags.signup`).
 *
 * ── 공지 ── 「다시 보지 않기」가 있습니다(b722, 사용자 요청) ──────────
 * ⚠⚠ **끈 것은 «그 공지»뿐입니다.** 열쇠를 «글에서» 뽑아 적어 둡니다 —
 *   만든 사람이 새 공지를 올리면 글이 달라지니 열쇠도 달라지고, 껐던
 *   사람에게도 **다시 뜹니다.** 「공지를 껐다」로 적어 두면 그 뒤로
 *   무슨 일이 나도 말을 걸 수가 없습니다(db/066: 이것이 사용자에게 말을
 *   걸 유일한 수단입니다).
 * ⚠⚠ **빨간 띠(warn)는 못 끕니다.** 그것은 「지금 이런 상태다」이지
 *   읽고 넘길 안내가 아닙니다 — 점검 중인 줄 모르고 저장을 눌러 보게 됩니다.
 * ⚠ 글은 **`textContent` 로** 넣습니다. 만든 사람이 적는 글이지만
 *   HTML 로 넣으면 그 칸이 곧 구멍입니다. 단추는 «요소로» 덧붙입니다.
 * ⚠ 열쇠는 기기에만 둡니다(localStorage). 폰에서 껐다고 노트북에서도
 *   꺼질 이유가 없고, 서버에 사람마다 적을 만한 일도 아닙니다.
 * ⚠ 로그아웃하면 같이 지워집니다(net.js 의 `forgetLocal`) — 다음 사람에게
 *   「이미 읽은 것」으로 넘어가면 안 됩니다. */
const 공지열쇠 = t => {
  let h = 0;
  for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return String(h);
};
const 공지껐나 = t => {
  try { return localStorage.getItem('t2:noticeoff') === 공지열쇠(t); } catch { return false; }
};
function drawNotice(){
  const t = String(flags.notice?.text || '').trim();
  const el = $('noticebar');
  const 경고 = flags.notice?.tone === 'warn';
  el.classList.toggle('warn', 경고);
  if (!t || (!경고 && 공지껐나(t))){ el.classList.add('hide'); el.textContent = ''; return; }
  el.classList.remove('hide');
  el.textContent = t;
  if (경고) return;                     /* 빨간 띠에는 끄는 단추를 안 답니다 */
  const x = document.createElement('button');
  x.type = 'button'; x.className = 'nbx';
  x.textContent = '다시 보지 않기';
  x.onclick = () => {
    try { localStorage.setItem('t2:noticeoff', 공지열쇠(t)); } catch {}
    el.classList.add('hide');
  };
  el.appendChild(x);
}

/* 기능 스위치. **화면에서 감추기만 합니다** — 진짜로 막는 것은 서버 쪽
   함수입니다(AI·알림). 여기서 감추는 것은 "눌러도 안 되는 단추를 두지
   않기 위해서"입니다. */
function applyFeatures(){
  $('pushrow')?.classList.toggle('hide', !featOn('push'));
  $('pushkinds')?.classList.toggle('hide', !featOn('push'));
  $('docbtn')?.classList.toggle('hide', !featOn('docs'));
  document.body.classList.toggle('noreorder', !featOn('reorder'));
  /* ⚠ 탭 좌우 스와이프 스위치(`swipe`, b491)는 b781 에 걷었습니다 — 스와이프
     자체를 없앴습니다(app.css 의 #tabdeck). 서버에 값이 남아 있어도 안 읽습니다. */
  document.body.classList.toggle('readonly', !!flags.readonly);
  /* **진짜로 막는 것은 여기입니다.** 화면에서 단추를 흐리게 하는 것은
     안내일 뿐이고, 저장은 write() 한 곳을 지나므로 거기서 막습니다. */
  setReadOnly(!!flags.readonly);
  /* 점검 중이면 왜 안 되는지 위에 띄웁니다. 공지가 따로 있으면 그쪽이
     먼저입니다 — 만든 사람이 적은 말이 더 정확합니다. */
  if (flags.readonly && !String(flags.notice?.text || '').trim()){
    $('noticebar').classList.remove('hide');
    $('noticebar').classList.add('warn');
    $('noticebar').textContent = '지금은 점검 중이에요. 보기만 되고 저장은 잠시 뒤에 돼요.';
  }
}


/* ── 관리자 화면에서 바꾸면 그 자리에서 먹게 ──────────────────────────
 * 전에는 서버에만 쓰고 화면은 그대로였습니다. 스위치를 껐는데 아무 일도
 * 안 일어나니 **안 먹은 줄 알고** 다시 누르게 됩니다 — 새로고침해야
 * 달라졌습니다. 기능 스위치 전부에 해당합니다(b491).
 * ⚠ 서버에 **먼저 쓰고 나서** 부릅니다. 화면부터 바꾸면 저장이 실패했을
 *   때 화면과 서버가 갈립니다. */
export function reapplyFeatures(row){
  flags.features = { ...(flags.features || {}), ...(row || {}) };
  applyFeatures();
}
