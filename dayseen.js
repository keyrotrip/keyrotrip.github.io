/* ── 앱 연 날(b815, db/112) ─────────────────────────────────────────────
 * 관리자 「사용」 칸의 「쓴 사람」이 이것을 셉니다(adminuse.js). 사용자가 고른 것: 「앱 연 날을 기록」.
 * 하루 한 번 **날짜만** 서버에 남깁니다(touch_day — 시각·IP·화면은 안 남김).
 * 처리방침 4차 개정(2026-10-01) 2·3·4항과 짝입니다 — 400일 뒤 지우고(sweep_retention), 탈퇴하면 바로 지웁니다.
 *
 * ⚠ 기기에 「오늘 이미 남겼다」를 적어 둡니다(`t2:dayseen` = 사람|서울 날짜) — 열 때마다 서버에 묻지 않게.
 *   사람을 같이 적는 것은 로그아웃 없이 계정을 바꾸는 길(app.js 「사람이 바뀌면」)이 있어서입니다.
 *   로그아웃하면 forgetLocal 이 t2: 를 다 지웁니다.
 * ⚠ 홈 화면 앱은 며칠씩 안 닫히고 뒤에 있다 돌아옵니다 — 화면이 다시 보일 때(visibilitychange)도 봅니다.
 * ⚠ 날짜는 서울 기준입니다(서버 touch_day 와 같은 자). 기기 시계가 다른 나라여도 같은 날로 셉니다.
 * ⚠ 실패해도(112 를 안 돌렸거나 끊김) 아무 말 안 합니다 — 안 적었으니 다음에 다시 합니다.
 * 층: db 만 씁니다. 화면은 모릅니다. */
import { sb } from './db.js?v=b836';

const 열쇠 = 't2:dayseen';
let 누구 = null;
let 보내는중 = false;
/* 'en-CA' 는 2026-10-01 꼴로 씁니다. */
const 서울날 = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

export function markDay(uid){
  누구 = uid || null;
  if (!누구 || 보내는중) return;
  const 값 = `${누구}|${서울날()}`;
  try { if (localStorage.getItem(열쇠) === 값) return; } catch {}
  보내는중 = true;
  sb.rpc('touch_day')
    .then(r => { if (!r.error){ try { localStorage.setItem(열쇠, 값); } catch {} } })
    .catch(() => {})
    .finally(() => { 보내는중 = false; });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && 누구) markDay(누구);
});
