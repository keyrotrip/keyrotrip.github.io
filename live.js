/* ── 지금 앱을 켜 둔 사람(b875) ──────────────────────────────────────────
 * 사용자(10-14): 「실시간으로 지금 앱을 켜고 있는 사람 수도 알 수 있나?」 → 시안 → 아무도 없으면 줄을 안 띄움 · 처리방침은 안 건드림.
 * Supabase 실시간 «접속 표시(presence)» 방 하나(`online`)에 들어갑니다. 서버 표에 아무것도 안 남습니다(SQL 없음).
 *   · 이름·계정 아이디는 안 보냅니다 — 앱을 켤 때마다 새로 만든 «무작위 번호»가 열쇠이고,
 *     같이 보내는 것은 홈 화면 앱인지(a) · 애플/안드로이드(d) 둘뿐입니다(dayseen.js 의 기기 판별과 같은 자).
 *   · 화면이 안 보이면(다른 앱으로 넘어감) 방에서 나가고, 다시 보이면 들어갑니다 — 「켜 두고 있다」 = 화면에 떠 있음.
 *   · 관리자 계정과 「로기」(통계에서 빼는 계정, db/131 stats_ignore)는 들어가지 않습니다 — 대시보드 숫자에서 빠지게.
 *     로기는 서버 표를 앱이 못 읽어서 이름으로 가립니다(131 이 넣을 때도 이름으로 찾았음).
 * ⚠ 방은 누구나 들을 수 있습니다 — 그래서 사람을 알아볼 것은 아예 안 보냅니다. 숫자는 관리자 화면만 그립니다.
 * ⚠ 실패해도(실시간이 끊김) 아무 말 안 합니다. 층: db 만 씁니다. */
import { sb } from './db.js?v=b886';

const 번호 = (() => { try { return crypto.randomUUID(); } catch { return String(Math.random()).slice(2) + Date.now(); } })();
const 앱인가 = () => !!navigator.standalone || matchMedia('(display-mode: standalone)').matches;
const 기기 = () => {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return null;
};

let 방 = null, 들어감 = false, 빠짐 = true, 듣는이 = null;
function 방열기(){
  if (방) return 방;
  방 = sb.channel('online', { config: { presence: { key: 번호 } } });
  방.on('presence', { event: 'sync' }, () => 듣는이?.(지금()));
  방.subscribe(st => { if (st === 'SUBSCRIBED'){ 들어감 = true; 알리기(); } });
  return 방;
}
function 알리기(){
  if (!방 || !들어감) return;
  if (!빠짐 && document.visibilityState === 'visible') 방.track({ a: 앱인가() ? 1 : 0, d: 기기() }).catch(() => {});
  else 방.untrack().catch(() => {});
}

/* 로그인 뒤 한 번(app.js) — 관리자인지 알고 나서 부릅니다. */
export async function liveJoin(uid, 관리자){
  if (!uid) return;
  let 로기 = false;
  if (!관리자){
    try {
      const r = await sb.from('profiles').select('display_name').eq('id', uid).maybeSingle();
      로기 = String(r.data?.display_name || '').trim() === '로기';
    } catch {}
  }
  빠짐 = !!관리자 || 로기;
  방열기(); 알리기();
}
/* 로그아웃 — 방에서 나갑니다. */
export function liveLeave(){ 빠짐 = true; 알리기(); }

/* 지금 방에 있는 사람 — { n, 앱, 웹, ios, and } */
export function 지금(){
  const 판 = 방?.presenceState?.() || {};
  const 다 = Object.values(판).map(v => v?.[0] || {});
  return { n: 다.length,
           앱: 다.filter(x => x.a === 1).length, 웹: 다.filter(x => x.a !== 1).length,
           ios: 다.filter(x => x.d === 'ios').length, and: 다.filter(x => x.d === 'android').length };
}
/* 대시보드가 듣습니다(adminuse.js) — 바뀔 때마다 cb(지금()). 듣기만 하고 들어가지는 않습니다(관리자는 빠짐). */
export function liveWatch(cb){ 듣는이 = cb; 방열기(); cb(지금()); }

document.addEventListener('visibilitychange', 알리기);
