/* ── 알림 설정 · 잠금화면 알림 ────────────────────────────────────────
 * **무엇을 알릴지**(notify_all · 종류별 스위치, 홈 시간대)와
 * **어떻게 받을지**(이 기기를 Web Push 에 등록할지) 둘입니다.
 * 스위치를 두 벌 두면 하나를 껐는데 다른 쪽으로 계속 옵니다 — 그래서
 * 아래 푸시 스위치는 **기기 등록만** 맡고, 무엇을 보낼지는 위가 정합니다.
 *
 * ── app.js 에서 떼어낸 열여섯 번째 조각입니다(b342) ──────────────────
 * app.js 안에서 이 둘 사이에 **상관없는 것 둘**이 끼어 있었습니다 —
 * '만든 사람이 켜고 끄는 것들'(기능 스위치)과 '알림을 눌렀을 때'(여행 열기).
 * 앞은 앱 껍데기고 뒤는 여행 화면을 부르므로 **두고 왔습니다.**
 * 줄이 붙어 있다고 한 덩어리인 것은 아닙니다.
 *
 * app.js 만 아는 것은 둘입니다 — 로그인한 사람, 종 다시 세기(`loadNotifs`).
 * 밖으로 나가는 길은 `loadNotifPrefs` 하나입니다.
 *
 * 층: dom.js · db.js · net.js 만 씁니다. */
import { $, esc, toast } from './dom.js?v=b892';
import { sb } from './db.js?v=b892';
import { fail, netTimeout, netIsDown, NOROW } from './net.js?v=b892';
/* 「읽은 알림 지우기」를 한 번 더 눌러 정하는 장치(b799). ui.js 는 dom.js 만 읽어 고리가 없습니다. */
import { arm, disarm } from './ui.js?v=b892';

let ctx = { me: () => null, openPerson: () => {}, openFriends: () => {}, openCityRev: () => {}, openFoodNote: () => {}, openCity: () => {} };
export function setNotifyCtx(o){ ctx = { ...ctx, ...o }; }

/* ── 알림 설정 ──────────────────────────────────────────────────────
 * 끌 수 없는 알림은 결국 앱 자체를 지우게 만듭니다.
 * **화면에서 숨기는 것이 아니라 서버에서 아예 안 만듭니다** (035 의 notify_wants).
 * 화면에서 거르면 줄은 계속 쌓이고, 기기를 바꾸면 안 보이던 것이 우르르 나옵니다.
 *
 * 나중에 잠금화면 알림(푸시)을 붙일 때 이 스위치들을 그대로 씁니다 —
 * "무엇을 알릴지"는 여기서 정하고, 그때는 "어떻게 받을지" 하나만 더 붙입니다. */
/* 처음엔 종류별로 셋을 두었는데 알림이 셋뿐이라 설정이 알림보다 복잡했습니다.
   스위치 하나로 줄였습니다. **표의 종류별 칸(035)은 그대로 둡니다** —
   기본값이 켬이라 전체 스위치만 보면 되고, 나중에 다시 나누고 싶으면
   화면만 붙이면 됩니다. 안 쓰는 칸을 지우려고 마이그레이션을 또 돌릴 이유가 없습니다. */
export async function loadNotifPrefs(){
  /* **`*` 를 씁니다.** 칸을 하나씩 적었더니 064·065 를 올릴 때마다 여기도
     고쳐야 했고, 한 번 빠뜨리면 "설정이 저장은 되는데 다시 열면 사라진다"가
     됩니다. 아직 안 올린 곳에서는 그 칸이 안 올 뿐 질의는 성공합니다 —
     칸 이름을 적으면 그때는 질의 자체가 실패해서 카드가 통째로 사라집니다. */
  const { data, error } = await sb.from('user_prefs')
    .select('*').eq('user_id', ctx.me().id).maybeSingle();
  /* 035 를 아직 안 올렸으면 칸이 없어서 질의가 실패합니다.
     그때는 설정 카드를 아예 숨깁니다 — 눌러도 저장이 안 되는 스위치를 두면 안 됩니다. */
  if (error){ $('notifprefcard').classList.add('hide'); return; }
  $('notifprefcard').classList.remove('hide');
  $('nf_all').checked = data ? data.notify_all !== false : true;
  /* 064 를 아직 안 올린 곳에서는 칸이 없습니다. 그때는 기본값으로 그립니다 —
     화면이 비는 것보다 낫고, 저장할 때 오류가 뜨면 그때 알게 됩니다. */
  putKinds(data?.notify_plan || 'first', data?.notify_flight !== false);
  saveHomeTz(data?.home_tz);
  drawPushRow();
}

/* **집이 어느 시간대인지 브라우저만 압니다.**
 * 출국편 알림이 1시간 일찍 오던 것을 여기서 막습니다 — 사람이 적는 출발
 * 시각은 표에 적힌 그대로, 즉 **출발 공항의 현지 시각**입니다. 그런데 우리는
 * 출발 공항을 모릅니다. 여행 첫날까지의 비행기는 집에서 뜬다고 보고(065),
 * 그 '집'이 어디인지를 여기서 알려줍니다.
 *
 * **바뀌었을 때만 씁니다.** 설정 화면을 열 때마다 upsert 하면 쓸 일 없는
 * 쓰기가 계속 나갑니다. 이사하거나 오래 머무는 곳이 바뀌면 그때 한 번입니다. */
async function saveHomeTz(now){
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
  if (!tz || tz === now) return;
  /* 065 를 아직 안 올렸으면 칸이 없어 실패합니다. 조용히 넘어갑니다 —
     이건 사용자가 부탁한 일이 아니라 우리가 알아서 하는 일입니다. */
  await sb.from('user_prefs')
    .upsert({ user_id: ctx.me().id, home_tz: tz }, { onConflict:'user_id' });
}

/* 고른 것을 화면에 얹습니다. 저장한 뒤에도 이 함수로 다시 그립니다 —
   두 곳에서 따로 칠하면 한쪽만 고치게 됩니다. */
function putKinds(plan, flight){
  document.querySelectorAll('#nf_plan [data-pl]').forEach(b =>
    b.classList.toggle('on', b.dataset.pl === plan));
  $('nf_flight').checked = flight;
}

async function saveKinds(row){
  $('nferr').classList.add('hide');
  const r = await sb.from('user_prefs')
    .upsert({ user_id: ctx.me().id, ...row }, { onConflict:'user_id' })
    .select('notify_plan,notify_flight');
  if (r.error || !r.data?.length){
    await loadNotifPrefs();               /* 화면을 진짜 값으로 되돌립니다 */
    return fail(r.error || NOROW.save, 'nf');
  }
  putKinds(r.data[0].notify_plan, r.data[0].notify_flight);
  return true;
}

$('nf_plan').addEventListener('click', async e => {
  const b = e.target.closest('[data-pl]'); if (!b) return;
  /* 먼저 칠하고 저장합니다. 기다렸다 칠하면 누른 것이 안 눌린 것처럼 보입니다. */
  putKinds(b.dataset.pl, $('nf_flight').checked);
  if (await saveKinds({ notify_plan: b.dataset.pl }))
    toast({ all:'모든 일정을 알려드려요', first:'그날 첫 일정만 알려드려요',
            off:'일정 알림을 껐어요' }[b.dataset.pl]);
});

$('notifprefcard').addEventListener('change', async e => {
  if (e.target.id !== 'nf_flight') return;
  await saveKinds({ notify_flight: $('nf_flight').checked });
});

$('notifprefcard').addEventListener('change', async e => {
  if (e.target.id !== 'nf_all') return;
  $('nferr').classList.add('hide');
  const on = $('nf_all').checked;
  /* 설정 줄이 아직 없는 계정도 있어서 upsert 로 넣습니다. */
  const r = await sb.from('user_prefs')
    .upsert({ user_id: ctx.me().id, notify_all: on }, { onConflict:'user_id' })
    .select('user_id');
  if (r.error){ $('nf_all').checked = !on; return fail(r.error, 'nf'); }
  if (!r.data?.length){ $('nf_all').checked = !on;
                        return fail(NOROW.save, 'nf'); }
  toast(on ? '알림을 다시 받아요' : '알림을 껐어요');
  loadNotifs();          /* 껐으면 종에 남아 있던 개수도 다시 셉니다 */
});

/* ── 잠금화면 알림 (Web Push) ───────────────────────────────────────
 * `notify_all` 이 "무엇을 알릴지"이고, 여기는 "어떻게 받을지"입니다.
 * 스위치를 두 벌 두면 하나를 껐는데 다른 쪽으로 계속 옵니다 —
 * 그래서 이 스위치는 **기기 등록**만 맡습니다. 무엇을 보낼지는
 * 위 스위치가 정합니다(035 의 notify_wants).
 *
 * **아이폰은 홈 화면에 담아야만 됩니다.** 사파리 탭에서는 `PushManager`
 * 자체가 없습니다. 눌러도 안 되는 스위치를 두면 고장으로 보이므로,
 * 못 하는 자리에서는 왜 못 하는지 적어둡니다. */
const VAPID_PUB = 'BKHqArbSZ6R78C-rwKrRs42lvSgYadpp5LLGfJUh2Xg4jzbcJiUv_5NanYsyYoRaeJtGuD9w7cs51vP1xveNBqM';

/* base64url → 바이트. 브라우저가 이 꼴로만 키를 받습니다. */
function b64ToBytes(s){
  const p = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4);
  const raw = atob(p);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

const pushOk = () => 'serviceWorker' in navigator && 'PushManager' in window
                  && 'Notification' in window;

async function drawPushRow(){
  const sw = $('nf_push'), why = $('pushwhy');
  why.classList.add('hide');
  /* **종류 고르기는 켜져 있을 때만 보여줍니다.** 안 받는 사람에게 무엇을
     받을지 묻는 칸이 세 줄 서 있으면 설정이 알림보다 복잡해집니다. */
  const kinds = on => $('pushkinds').classList.toggle('hide', !on);
  kinds(false);
  if (!pushOk()){
    sw.checked = false; sw.disabled = true;
    why.textContent = matchMedia('(display-mode: standalone)').matches
      ? '이 기기는 잠금화면 알림을 지원하지 않아요.'
      : '홈 화면에 담아서 열면 잠금화면 알림을 켤 수 있어요. ' +
        '(공유 → 홈 화면에 추가)';
    why.classList.remove('hide');
    return;
  }
  if (Notification.permission === 'denied'){
    sw.checked = false; sw.disabled = true;
    why.textContent = '기기 설정에서 이 앱의 알림이 꺼져 있어요. 거기서 켜주세요.';
    why.classList.remove('hide');
    return;
  }
  sw.disabled = false;
  const reg = await navigator.serviceWorker.getRegistration();
  sw.checked = !!(await reg?.pushManager.getSubscription());
  kinds(sw.checked);
}

$('notifprefcard').addEventListener('change', async e => {
  if (e.target.id !== 'nf_push') return;
  const on = $('nf_push').checked;
  $('nferr').classList.add('hide');
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg){ $('nf_push').checked = false; return fail('앱을 새로고침한 뒤 다시 켜주세요.', 'nf'); }

  if (!on){
    try { localStorage.setItem(끔열쇠(), '1'); } catch {}   /* 직접 끈 사람은 아래 「처음 쓸 때 묻기」가 다시 안 켬 */
    const sub = await reg.pushManager.getSubscription();
    if (sub){
      /* **표에서 먼저 지우고 기기에서 뗍니다.** 순서가 반대면 표에 죽은
         주소가 남아 보낼 때마다 실패합니다. */
      await sb.from('push_subs').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
    toast('잠금화면 알림을 껐어요');
    return drawPushRow();
  }

  try { localStorage.removeItem(끔열쇠()); } catch {}
  /* 허락은 **사용자가 무언가를 누른 그 순간**에만 물을 수 있습니다(스위치를 켠 지금). */
  const perm = await Notification.requestPermission();
  if (perm !== 'granted'){ $('nf_push').checked = false; return drawPushRow(); }
  const 됨 = await 기기등록(reg);
  if (됨 !== true){ $('nf_push').checked = false; return fail(됨, 'nf'); }
  toast('이제 잠금화면으로 알려드려요');
  drawPushRow();
});

/* 이 기기를 푸시 받을 곳으로 등록(허락은 이미 받은 뒤) — 됐으면 true, 아니면 오류(글·객체).
   스위치와 「처음 쓸 때 묻기」(아래)가 같이 씁니다 — 두 벌이면 언젠가 갈라집니다. */
async function 기기등록(reg){
  reg = reg || await navigator.serviceWorker.getRegistration();
  if (!reg) return '앱을 새로고침한 뒤 다시 켜주세요.';
  let sub;
  try {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUB) });
  } catch { return '알림을 켜지 못했어요. 잠시 뒤 다시 눌러주세요.'; }
  const j = sub.toJSON();
  const r = await sb.from('push_subs').upsert({
    user_id: ctx.me().id, endpoint: sub.endpoint,
    p256dh: j.keys.p256dh, auth: j.keys.auth,
    ua: navigator.userAgent.slice(0, 200),
  }, { onConflict: 'endpoint' }).select('id');
  if (r.error || !r.data?.length){
    await sub.unsubscribe();          /* 표에 못 넣었으면 기기 등록도 물립니다 */
    return r.error || NOROW.save;
  }
  /* **집 시간대를 여기서도 씁니다.** loadNotifPrefs 는 «설정 화면을 열었다»에 기대고 있어서,
     켜는 자리에서 챙기지 않으면 출국편 알림이 1시간 일찍 옵니다. */
  saveHomeTz();
  return true;
}

/* ── 처음 쓸 때 한 번 「알림 허용?」(2026-10-17) ─────────────────────────────
 * 사용자: 「대부분 앱들도 기본이 알람 켜져 있고, 사용자들이 듣기 싫으면 직접 끄잖아」 → 앱을 열면 한 번 묻기.
 * 폰의 허락 창은 글을 못 바꾸므로 그 앞에 «우리 카드» 하나(사용자가 고른 글):
 *   「친구 소식, 바로 받아 볼까요?」 / 「방명록 · 답글 · 팔로우 소식과 여행 일정 30분 전 알림을 폰으로 받아요. 언제든 설정에서 끌 수 있어요.」
 *   [알림 켜기] → 그 누름 안에서 폰의 허락 창 → 허락이면 등록(「잠금화면 알림을 켰어요」) · [나중에]·바깥·뒤로 → 7일 쉼
 *   거절한 사람(denied)·설정에서 직접 끈 사람(t2:pushoff)은 다시 안 물음 · 이미 허락했는데 이 기기 등록이 없으면 조용히 등록
 *   아이폰 사파리 탭처럼 못 받는 곳은 건너뜀 · 다른 카드(이름 묻기 등 .pshpop)가 떠 있으면 닫힐 때까지 기다림.
 * ⚠ requestPermission 은 누름 처리 «안에서 곧바로» 불러야 합니다(먼저 await 하면 사파리가 누름으로 안 침).
 * ⚠ 뒤로가기 = 「나중에」 — tripview.js 사슬 맨 위(알림묻기열림/닫기). */
const 끔열쇠 = () => 't2:pushoff:' + (ctx.me()?.id || '');
const 물음열쇠 = () => 't2:pushask:' + (ctx.me()?.id || '');
let 카드 = null, 기다림 = 0;
export const 알림묻기열림 = () => !!카드;
export async function pushAutoAsk(){
  if (!pushOk() || !ctx.me()) return;
  try { if (localStorage.getItem(끔열쇠()) === '1') return; } catch {}
  if (Notification.permission === 'denied') return;
  if (Notification.permission === 'granted'){
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg && !(await reg.pushManager.getSubscription())) 기기등록(reg);
    return;
  }
  try { if (Date.now() - Number(localStorage.getItem(물음열쇠()) || 0) < 7 * 864e5) return; } catch {}
  clearTimeout(기다림);
  let 번 = 0;
  const 띄우기 = () => {
    if (카드 || !ctx.me() || Notification.permission !== 'default') return;
    /* 다른 카드(이름 묻기·성향 바뀜 등)가 떠 있으면 3초 뒤 다시 — 두 장이 겹치지 않게(1분까지) */
    if (document.querySelector('.pshpop')){ if (++번 < 20) 기다림 = setTimeout(띄우기, 3000); return; }
    try { localStorage.setItem(물음열쇠(), String(Date.now())); } catch {}
    카드 = document.createElement('div');
    카드.className = 'pshpop';
    카드.innerHTML = `<div class="pshcard nmcard pushask" role="dialog" aria-modal="true" aria-label="알림 받기">
        <div class="pabell" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
          stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg></div>
        <p class="pshtitle">친구 소식, 바로 받아 볼까요?</p>
        <p class="nmsub">방명록 · 답글 · 팔로우 소식과<br>여행 일정 30분 전 알림을 폰으로 받아요.<br>언제든 설정에서 끌 수 있어요.</p>
        <div class="pshbtns"><button type="button" class="primary paok">알림 켜기</button>
          <button type="button" class="pshx palater">나중에</button></div>
      </div>`;
    카드.querySelector('.paok').onclick = () => {
      /* 이 누름 «안에서 곧바로» 폰의 창(사파리 규칙) — 그다음에 카드를 닫습니다 */
      const 물음 = Notification.requestPermission();
      알림묻기닫기();
      물음.then(async perm => {
        if (perm === 'granted' && (await 기기등록()) === true) toast('잠금화면 알림을 켰어요 · 설정에서 끌 수 있어요');
      }).catch(() => {});
    };
    카드.querySelector('.palater').onclick = () => 알림묻기닫기();
    카드.addEventListener('click', e => { if (e.target === 카드) 알림묻기닫기(); });
    document.body.appendChild(카드);
    if (history.state?.t2 !== 'pushask') history.pushState({ t2:'pushask' }, '');
  };
  기다림 = setTimeout(띄우기, 2500);   /* 첫 화면이 자리 잡은 뒤 */
}
/* 닫기 — 단추에서 부르면 뒤로가기를 거치고(사슬이 다시 불러 진짜로 닫음), 사슬에서 부르면(뒤로온것) 바로 닫습니다. */
export function 알림묻기닫기(뒤로온것){
  if (!카드) return;
  if (!뒤로온것 && history.state?.t2 === 'pushask'){ history.back(); return; }
  카드.remove(); 카드 = null;
}


/* ── 종 알림 — 읽는 자리 ──────────────────────────────────────────────
 * 만드는 쪽은 서버(db/063)입니다. 여기는 읽고 보여주고 읽음 표시만 합니다.
 * **app.js 에서 여기로 옮겼습니다(b348).** 원래는 AI 화면 여닫기 바로 옆에
 * 있었는데 상관없는 것이었습니다 — 알림은 알림 파일이 맞습니다.
 * 덕분에 이 파일의 ctx 에서 `loadNotifs` 가 빠졌습니다(둘 → 하나). */

/* ⚠⚠ **종이 없어졌습니다(b759, 사용자 결정).** ⚠⚠
   상단바에 떠 있던 종과 그 아래 펼쳐지던 판(`#notifpanel`)을 걷고, 받은
   알림을 **프로필의 「알림」 카드**에 펼쳐 뒀습니다. 그러면 알림을 보러
   가는 것과 알림을 끄고 켜는 것이 한자리에 모입니다.
   ⚠ 여닫는 것이 없어졌으므로 **여는 처리기도 없습니다.** 프로필 탭을
     열 때 app.js 가 `loadNotifs(true)` 를 부릅니다.
   ⚠ 「읽었다」로 치는 때는 그대로 **1.2초 뒤**입니다 — 어느 것이 새
     것이었는지 눈에 한 번 들어와야 하니까요. 다만 판정이 「판이 열려
     있나」에서 「아직 프로필에 있나」로 바뀌었습니다. */
let readTimer = null;
function 읽음처리(){
  clearTimeout(readTimer);
  readTimer = setTimeout(async () => {
    /* 그새 딴 탭으로 갔으면 그만둡니다 — 스쳐 지나간 것은 본 것이 아닙니다. */
    if (document.body.dataset.tab !== 'set') return;
    if ($('notifpane')?.classList.contains('hide')) return;   /* 벌써 나갔으면 그만 */
    const r = await netTimeout(sb.from('notifications')
      .update({ read_at: new Date().toISOString() }).is('read_at', null).select('id'));
    if (!r.error && r.data?.length) loadNotifs();
  }, 1200);
}

/* `본것` 이 참이면 **1.2초 뒤에 읽은 것으로 칩니다.** 프로필 탭을 연
   때만 참입니다 — 앱을 켤 때와 설정을 바꿀 때도 이 함수를 부르는데,
   그때 읽음 처리를 하면 보지도 않은 알림이 지워집니다. */
export async function loadNotifs(본것){
  /* 알림은 서버에만 있습니다. 오프라인이면 종 숫자도 못 셉니다. */
  if (netIsDown()){
    $('notifs').innerHTML = '<div class="empty">연결이 없어 알림은 지금 볼 수 없어요.</div>';
    $('readall').classList.add('hide');
    return;
  }
  const { data, error } = await sb.from('notifications')
    /* '*' — city_id(db/122, 후기 알림)가 없는 서버에서도 그대로 돕니다. 칸 이름을 적으면 SQL 전엔 알림이 통째로 안 옵니다. */
    .select('*')
    .order('created_at', { ascending:false }).limit(30);
  const unread = (data || []).filter(n => !n.read_at).length;
  /* ⚠ 하단바 「프로필」 점(b759)·프로필 종 점(b760)은 b861 에 껐습니다(사용자: 「프로필은 없애고 하트랑 기록탭 아이콘위에
     점 뜨는걸로 하자」). 종을 걷어 알림이 기록 탭 ♡ 로 갔는데 프로필에 점이 남으면 거기서는 끌 길이 없었습니다.
     이제 점은 기록 탭 ♡ 와 하단바 「기록」 두 곳 — activity.js 의 heartDot 이 같이 칠합니다. */
  $('settabdot')?.classList.add('hide');
  /* 기록 탭 ♡ · 하단바 「기록」 점(b859 · b861, activity.js) — 사건으로(그 파일을 읽으면 고리) */
  window.dispatchEvent(new CustomEvent('t2:heartdot', { detail: { 알림: !!unread } }));
  if (본것 && unread) 읽음처리();

  if (error || !data?.length){
    $('notifs').innerHTML = '<div class="empty">알림이 없어요.</div>';
    $('readall').classList.add('hide');
    return;
  }
  /* ── 「읽은 알림 지우기」 하나(b799, GPT 리포트에서 찾음) ─────────────────
   * ⚠⚠ **전에는 이 단추가 보는 사이에 바뀌었습니다.** 안 읽은 것이 있으면 「모두 읽음」,
   *   없으면 「지우기」였는데 — 알림을 열면 1.2초 뒤 저절로 모두 읽음 처리(위 `읽음처리`)가
   *   되면서 다시 그려져, 「모두 읽음」을 누르려던 손가락 밑에서 「지우기」로 바뀌었습니다.
   *   그리고 「지우기」는 확인 없이 **영구 삭제**였습니다.
   * → 이름을 고정하고 한 번 더 눌러야 지웁니다(ui.js 의 arm). 「모두 읽음」은 뺐습니다 —
   *   열면 저절로 되므로 단추로 둘 이유가 없습니다.
   * ⚠ 다시 그릴 때는 눌러 둔 것을 풉니다(disarm) — 숫자가 바뀌었을 수 있으니 다시 누르게. */
  const 읽은 = data.filter(n => n.read_at).length;
  const 단추 = $('readall');
  disarm(단추);
  단추.textContent = '읽은 알림 지우기';
  단추.dataset.n = String(읽은);
  단추.classList.toggle('hide', !읽은);

  /* 팔로우 알림(b789)은 누를 수 있습니다 — 요청이면 받은 요청 목록, 아니면 그 사람. */
  /* 후기 좋아요·답글 알림(b858)은 그 후기 화면으로 — 내 후기이므로 쓴 사람은 나, 도시는 city_id. */
  $('notifs').innerHTML = data.map(n => {
    const 사람 = (/^follow_/.test(n.kind || '') && n.actor_id) || (/^review_/.test(n.kind || '') && n.city_id)
             || (/^food_(reply|mention)$/.test(n.kind || '') && n.food_id) || (n.kind === 'food_like' && n.city_id);   /* 맛집 답글(b866) — 그 추천 글로 */
    return `<div class="row"${사람 ? ` data-nkind="${esc(n.kind)}" data-actor="${esc(n.actor_id || '')}"
                                     data-city="${esc(n.city_id || '')}" data-food="${n.food_id || ''}" data-auth="${esc(n.ref_author || '')}" style="cursor:pointer"` : ''}>
       <span class="label"${n.read_at ? ' style="opacity:.55"' : ''}>
       ${esc(n.body)}${사람 ? ' ›' : ''}</span>
     <span class="val">${esc(n.created_at.slice(5,10))}</span></div>`;
  }).join('');
}
$('notifs')?.addEventListener('click', e => {
  const r = e.target.closest('[data-actor]'); if (!r) return;
  if (/^food_(reply|mention)$/.test(r.dataset.nkind) && r.dataset.food) ctx.openFoodNote(r.dataset.food, r.dataset.city);
  else if (r.dataset.nkind === 'food_like' && r.dataset.city) ctx.openCity(r.dataset.city);
  else if (/^review_/.test(r.dataset.nkind) && r.dataset.city) ctx.openCityRev(r.dataset.auth || ctx.me()?.id, r.dataset.city);
  else if (r.dataset.nkind === 'follow_request') ctx.openFriends('requests');
  else ctx.openPerson(r.dataset.actor);
});
$('readall').addEventListener('click', async e => {
  e.stopPropagation();
  const b = $('readall');
  /* 한 번 더 눌러야 지웁니다(b799, 위 머리말) — 지운 것은 되돌릴 수 없습니다. */
  if (b.dataset.armed !== '1'){ arm(b, `한 번 더 누르면 읽은 알림 ${b.dataset.n || ''}개를 지워요`); return; }
  disarm(b);
  b.disabled = true;           /* 지우는 동안 두 번 안 가게 */
  try {
    /* 읽은 것만 지웁니다. 안 읽은 것이 사이에 있으면 그건 남깁니다. */
    const r = await netTimeout(sb.from('notifications').delete()
      .not('read_at', 'is', null).select('id'));
    if (r.error) return fail(r.error);
    /* 039 를 안 올렸으면 정책이 없어 0건이 지워집니다. 조용히 넘어가면
       버튼이 고장 난 것처럼 보입니다. */
    if (!r.data?.length) return toast('지우지 못했어요. 잠시 뒤 다시 해주세요.');
    toast(`읽은 알림 ${r.data.length}개를 지웠어요`);
  } finally { b.disabled = false; }
  loadNotifs();
});

