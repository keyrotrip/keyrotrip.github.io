/* ── 구글 로그인(b816) — 구글에서 바로 로그인 표(ID 토큰)를 받아 들어갑니다 ─────────────────────────
 * 사용자: 「계정 로그인할때 빨간 동그라미 안 주소가 너무 피싱사이트 같은데 해결 못해?」 — 구글 화면에
 *   「qahqq….supabase.co(으)로 이동」이 떴습니다. 옛 길이 Supabase 를 거쳐 돌아와서 그 주소가 보였습니다.
 *   → 시험 페이지(gsitest.html, b814)로 셋을 재 봄 → PC·아이폰 홈 화면 앱(iOS 18.7)에서 ②·③ 다 됨 →
 *   사용자가 「② 화면 넘기기」를 고름. 같은 날 주소도 keyrotrip.github.io 로 옮김(사용자).
 * 길: 단추(googleLogin) → 구글(response_type=id_token · nonce=sha256(raw) · state) → login.html#id_token=…
 *   → sb.auth.signInWithIdToken({ provider:'google', token, nonce: raw }) → 앱 첫 주소.
 *   구글 화면에는 이 앱의 주소가 뜹니다(「keyrotrip.github.io(으)로 이동」).
 * ⚠⚠ 구글 콘솔(OAuth 클라이언트 「trip」)의 **승인된 리디렉션 URI 에 `<앱 주소>/login.html`**, 승인된 JS 원본에
 *   `<앱 주소>` 가 있어야 합니다. 없으면 구글이 redirect_uri_mismatch 를 띄우고 **아무도 못 들어옵니다.**
 *   주소를 옮길 때 가장 먼저 할 일 — 확인은 구글 인증 주소를 curl 로 불러 302 가 signin 으로 가는지(signin/oauth/error
 *   면 아직). memory domain-move 에 적어 둠.
 * ⚠ 옛 길(Supabase OAuth)은 oauthLogin 으로 남깁니다. 기기에 잠깐 적을 수가 없을 때(app.js)와 login.html 이
 *   실패했을 때의 「예전 방식으로 로그인」이 씁니다 — 새 길이 막혀도 아무도 못 들어오는 일이 없게.
 *   그 길은 Supabase 의 Redirect URLs 에 앱 주소가 있어야 돌아옵니다(memory domain-move 1번).
 * ⚠ 범위는 `openid email` 뿐입니다 — 이름·사진은 안 받습니다(db/104 의 약속). 계정을 늘 고르게 합니다
 *   (`select_account` — 우리 로그아웃은 구글 세션을 안 끊어서, 안 물으면 방금 나온 계정으로 되돌아옵니다).
 * ⚠ 받은 표는 화면·주소·기록 어디에도 안 남깁니다(login.html 이 주소 꼬리를 db.js 보다 먼저 지움).
 * 층: db 만 씁니다. */
import { sb } from './db.js?v=b830';

export const GOOGLE_CLIENT_ID = '96116457629-vlk2pfe1vr359plthoth9dlcp6ljd1tv.apps.googleusercontent.com';
/* 구글로 떠나기 전에 적어 두는 것(state·raw). t2: — 로그아웃하면 forgetLocal 이 지웁니다. */
export const LOGIN_WAIT_KEY = 't2:glogin';

const 무작위 = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  .replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' })[c]);
export const sha256hex = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
  .map(b => b.toString(16).padStart(2, '0')).join('');
/* 앱 첫 주소. login.html 도 같은 폴더라 어디서 불러도 같습니다(`…/`). */
export const appHome = () => new URL('./', location.href).href;
/* 구글이 돌려보낼 곳 — 구글 콘솔의 「승인된 리디렉션 URI」와 **글자까지 같아야** 합니다. */
export const loginReturn = () => new URL('login.html', location.href).href;

/* 새 길. 구글로 떠납니다 — 돌아오지 않으므로 끝까지 기다릴 것이 없습니다.
   기기에 못 적으면(사생활 보호 창 등) 던집니다 — 부르는 쪽이 옛 길로 갑니다. */
export async function googleLogin(){
  const state = 무작위(), raw = 무작위();
  localStorage.setItem(LOGIN_WAIT_KEY, JSON.stringify({ state, raw, at: Date.now() }));
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.search = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID, redirect_uri: loginReturn(), response_type: 'id_token',
    scope: 'openid email', nonce: await sha256hex(raw), state, prompt: 'select_account',
  }).toString();
  location.assign(u.toString());
}

/* 옛 길(b815 까지의 로그인) — 구글 화면에 supabase.co 가 뜹니다. 막혔을 때만 씁니다. */
export function oauthLogin(){
  return sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: appHome(), scopes: 'openid email', queryParams: { prompt: 'select_account' } },
  });
}
