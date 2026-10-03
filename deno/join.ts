// =====================================================================
// 초대 링크 — Deno Deploy
//
// 왜 Supabase 가 아니라 여기인가
//   처음엔 Supabase 엣지 함수로 만들었습니다. 코드는 잘 돌았는데
//   **카톡에 카드가 아예 안 떴습니다.** 재보니 응답 헤더에 이게 있었습니다.
//     Server: cloudflare
//     set-cookie: __cf_bm=…        ← Cloudflare 봇 감지
//   Supabase 엣지 함수는 Cloudflare 봇 관리 뒤에 있습니다. 제 curl 은
//   통과했지만 카톡 스크래퍼(한국 데이터센터 IP + 봇 UA)는 걸립니다.
//   같은 링크를 github.io 주소로 보내면 카드가 떴습니다(Fastly, 봇 관리 없음).
//   그래서 **Cloudflare 를 안 지나는 자리**로 옮깁니다.
//
// ⚠ **사진도 여기를 거칩니다.** 카톡이 supabase.co 를 못 긁는 것이라면,
//   페이지만 옮기고 og:image 를 supabase 스토리지 주소로 두면 카드는 뜨는데
//   사진만 빈 채로 뜹니다. 그래서 `/img?c=CODE` 로 우리가 대신 받아 넘깁니다.
//   카톡은 이 주소 하나만 만나고 supabase.co 는 한 번도 안 만납니다.
//
//   아무 주소나 넘겨주는 통로가 아닙니다 — 주소는 초대 코드로 DB 에서
//   꺼낸 것만 씁니다. 밖에서 준 주소는 안 받습니다. 그리고 우리 스토리지가
//   아닌 곳으로 나가면 거절합니다(아래 `OK_HOST`).
//
// 올리는 법
//   1. https://deno.com/deploy → New Project → Playground
//   2. 이 파일 내용을 그대로 붙여넣고 Save & Deploy
//   3. Settings → Environment Variables 에 둘을 넣습니다
//        SB_URL   https://qahqqhjleqfrsjiixnas.supabase.co
//        SB_ANON  sb_publishable_… (db.js 에 있는 그 값. 공개해도 되는 열쇠입니다)
//   4. 나온 주소를 알려주시면 member.js 의 JOIN_URL 을 그리로 맞춥니다.
//      (2026-10-01 부터 https://join.keyro.deno.net/ — Deno 조직 slug keyro · 앱 이름 join)
//
//   db/069_peek_invite_photo.sql 이 먼저 돌아 있어야 사진이 나옵니다.
//
// 안 되는 것
//   코드가 틀렸거나 만료됐으면 여행 이름을 **안 알려줍니다.** 그냥 앱 카드가
//   뜹니다 — 카드는 코드를 아무거나 넣어보는 사람에게도 보이는 자리라,
//   "없는 코드" 와 "만료됨" 을 갈라주면 코드를 긁는 데 쓸 수 있습니다.
// =====================================================================

const APP  = 'https://keyrotrip.github.io/';
const ICON = APP + 'icons/keyro-512.png';

const SB   = Deno.env.get('SB_URL')  || '';
const ANON = Deno.env.get('SB_ANON') || '';

/* 사진을 대신 받아올 때, 여기서 나가는 것만 허용합니다.
   DB 에서 꺼낸 주소라 이미 우리 것이지만, 스토리지 설정이 바뀌어 남의
   주소가 섞여 들어와도 여기서 막힙니다. 통로를 열어두지 않습니다.
   ⚠ **여기서 터지면 안 됩니다.** 전에는 `new URL(SB)` 를 그냥 적었는데,
     환경변수를 넣기 전에 배포하면 `new URL(undefined)` 로 모듈이 시작조차
     못 해서 **배포가 통째로 실패했습니다**(재봄). 그러면 무엇이 잘못됐는지
     화면에 아무것도 안 남습니다. 못 읽으면 빈 값으로 두고 앱 카드로 갑니다. */
const OK_HOST = (() => { try { return new URL(SB).host; } catch { return ''; } })();

/* HTML 안에 남의 글을 넣습니다. 여행 이름은 사용자가 직접 친 글자입니다.
   따옴표 하나만 새도 og:title 이 거기서 끊기고, 뒤가 태그로 읽힙니다. */
const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* 2026-09-12 → 9월 12일. 카드 한 줄에 들어가야 해서 연도는 뺍니다 —
   초대는 대개 코앞의 여행이고, 해가 다르면 어차피 앱에서 보입니다. */
const md = (d: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? `${+m[2]}월 ${+m[3]}일` : '';
};
const range = (a: string, b: string) => {
  const x = md(a), y = md(b);
  return !x ? '' : (!y || x === y) ? x : `${x} – ${y}`;
};

const CODE_OK = (c: string) => /^[A-Z0-9]{4,32}$/.test(c);

async function peek(code: string) {
  if (!SB || !ANON) return null;   /* 환경변수가 없으면 물어볼 데가 없습니다 */
  try {
    const r = await fetch(`${SB}/rest/v1/rpc/peek_invite`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`,
                 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_code: code }),
      signal: AbortSignal.timeout(4000),   /* 크롤러는 오래 안 기다립니다 */
    });
    const t = await r.json();
    return (t && t.title && !t.expired) ? t : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  const url  = new URL(req.url);
  const code = (url.searchParams.get('c') || '').trim().toUpperCase();
  const self = url.origin;

  /* ── 사진 대신 받아 넘기기 ─────────────────────────────────────── */
  if (url.pathname === '/img') {
    if (!CODE_OK(code)) return new Response(null, { status: 404 });
    const t = await peek(code);
    let src: URL;
    try { src = new URL(String(t?.image_url || '')); }
    catch { return Response.redirect(ICON, 302); }
    if (!OK_HOST || src.host !== OK_HOST) return Response.redirect(ICON, 302);

    const r = await fetch(src, { signal: AbortSignal.timeout(6000) });
    if (!r.ok || !r.body) return Response.redirect(ICON, 302);
    return new Response(r.body, {
      headers: {
        'Content-Type': r.headers.get('content-type') || 'image/jpeg',
        /* 사진은 안 바뀝니다. 크롤러가 오래 들고 있어도 됩니다. */
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  /* ── 미리보기 카드 + 앱으로 보내기 ─────────────────────────────── */
  /* ⚠ **이 둘은 코드를 못 읽었을 때만 쓰입니다**(만료·오타·코드 없이 접속).
     코드가 살아 있으면 아래에서 여행 이름으로 덮어씁니다.
     그러니 여기는 "무슨 여행"이 아니라 **무슨 앱인지**를 말해야 합니다.
     앱 얼굴을 b397 에서 평가 쪽으로 돌렸으므로 여기도 같이 맞춥니다 —
     한쪽만 고치면 같은 앱이 두 가지로 소개됩니다(index.html 의 og 참고). */
  let title = '기로 — 나는 어떤 여행자일까';
  let desc  = '다녀온 해외 도시 열 곳만 매기면 16가지 중 내 여행 성향이 나와요. 일정도 여기서 짭니다.';
  let img   = ICON;
  let card  = 'summary';

  if (CODE_OK(code)) {
    const t = await peek(code);
    if (t) {
      title = `${t.title} · 같이 가실래요?`;
      desc  = [t.destination, range(t.start_date, t.end_date)]
                .filter(Boolean).join(' · ');
      if (t.image_url) {
        img  = `${self}/img?c=${encodeURIComponent(code)}`;
        card = 'summary_large_image';
      }
    }
  }

  /* 사람이 갈 곳. 코드가 이상하면 코드 없이 앱만 엽니다. */
  const go = APP + (code ? '?join=' + encodeURIComponent(code) : '');
  /* ⚠ og:url 은 `req.url` 로 만들지 않습니다. 앞단을 지나면서 http 로 보이거나
     경로가 달라 보이는 일이 있습니다(Supabase 에서 실제로 그랬습니다). */
  const here = self + (code ? '/?c=' + encodeURIComponent(code) : '/');

  const html = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="기로">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:url" content="${esc(here)}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="${card}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<meta name="description" content="${esc(desc)}">
<!-- 자바스크립트가 막혀 있어도 결국 앱으로 갑니다. 크롤러는 이걸 안 따라갑니다. -->
<meta http-equiv="refresh" content="2;url=${esc(go)}">
<style>
  html{color-scheme:light dark}
  body{margin:0;height:100dvh;display:grid;place-items:center;
       font:15px/1.6 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",
            "Malgun Gothic",sans-serif;color:#11141A;background:#fff;
       text-align:center;padding:24px}
  @media (prefers-color-scheme:dark){body{color:#f5f5f7;background:#11141A}}
  a{color:#0066cc}
</style>
</head><body>
<div>
  <p>${esc(title)}</p>
  <p><a href="${esc(go)}">열리지 않으면 여기를 누르세요</a></p>
</div>
<script>location.replace(${JSON.stringify(go)});</script>
</body></html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      /* 크롤러가 한 번 받아간 카드를 오래 들고 있으면, 여행 이름을 고쳐도
         옛 카드가 계속 뜹니다. 5분이면 여러 명이 같은 링크를 열 때는
         재활용되고, 고친 것은 곧 반영됩니다. */
      'Cache-Control': 'public, max-age=300',
    },
  });
});
