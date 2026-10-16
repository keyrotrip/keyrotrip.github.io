/* chat 함수의 «시간 예산 · 입력 상한 · DB 실패 · 요청별 설정» 시험 — `deno test supabase/tests/`
 *
 * 왜 있나(2026-10-16):
 *   - 모델 이름을 전역 변수(activeModel)에 담아 동시에 온 요청끼리 섞일 수 있었습니다.
 *   - Gemini·Tavily 부름에 시간 상한이 없거나 요청 전체 마감이 없었습니다.
 *   - 필수 DB 조회가 실패해도 «빈 자료»로 답했고, 내부 오류 글을 사용자에게 그대로 돌려줬습니다.
 *
 * ⚠⚠ **모의 네트워크로만 돕니다.** globalThis.fetch 를 가짜로 바꿔 Supabase·Gemini·Tavily 가
 *   부르는 주소를 흉내 냅니다. 운영 API·남의 서버에 아무것도 보내지 않습니다.
 * ⚠ 여기 적은 열쇠·주소는 모두 시험용 가짜입니다. */
import { assert, assertEquals } from 'jsr:@std/assert@1';

const SB = 'http://sb.test';
Deno.env.set('SUPABASE_URL', SB);
Deno.env.set('SUPABASE_ANON_KEY', 'anon-fake-test-key');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'srv-fake-test-key');
Deno.env.set('GEMINI_KEY', 'gem-fake-test-key');
Deno.env.set('TAVILY_KEY', 'tav-fake-test-key');

// deno-lint-ignore no-explicit-any
const 원래serve = Deno.serve; (Deno as any).serve = () => ({ finished: Promise.resolve(), shutdown: () => {} });
const chat = await import('../functions/chat/index.ts');
// deno-lint-ignore no-explicit-any
(Deno as any).serve = 원래serve;
const { 처리, callGemini, webSearch } = chat;

/* ── 모의 네트워크 ───────────────────────────────────────────────────── */
type 길 = (u: URL, init: RequestInit & { bodyText: string }) => Response | Promise<Response> | 'hang';
let 길들: [RegExp, 길][] = [];
let 불림: { url: string; body: string }[] = [];
const 원래fetch = globalThis.fetch;
const 가짜fetch = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const bodyText = typeof init.body === 'string' ? init.body : '';
  불림.push({ url, body: bodyText });
  const u = new URL(url);
  const hit = 길들.find(([re]) => re.test(u.origin + u.pathname));
  if (!hit) return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  const r = await hit[1](u, { ...init, bodyText });
  if (r !== 'hang') return r;
  return await new Promise<Response>((_, bad) => {
    init.signal?.addEventListener('abort', () => bad(new DOMException('aborted', 'AbortError')));
  });
};
const J = (v: unknown, status = 200, h: Record<string, string> = {}) =>
  new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', ...h } });
const 늦게 = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
/* maybeSingle() 이 어떤 Accept 로 묻든 한 줄을 돌려줍니다. */
const 한줄 = (init: RequestInit, row: unknown) => {
  const acc = new Headers(init.headers).get('accept') ?? '';
  return acc.includes('vnd.pgrst.object') ? J(row) : J(row == null ? [] : [row]);
};
const 제미니답 = (text: string) => J({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] });
/* Gemini 로 간 부름: [모델, 마지막 user 글] */
const 제미니부름 = () => 불림.filter((c) => c.url.includes('generativelanguage'))
  .map((c) => {
    const m = c.url.match(/models\/([^:]+):/)?.[1] ?? '';
    // deno-lint-ignore no-explicit-any
    const cs = JSON.parse(c.body).contents as any[];
    const 마지막 = cs[cs.length - 1].parts.map((p: { text?: string }) => p.text ?? '').join('');
    // deno-lint-ignore no-explicit-any
    const 전부 = cs.map((x: any) => x.parts.map((p: { text?: string }) => p.text ?? '').join('')).join('\n');
    return { 모델: m, 마지막, 전부 };
  });

const TRIP = '11111111-2222-4333-8444-555555555555';
const 기본길 = (덧: [RegExp, 길][] = []) => {
  불림 = [];
  길들 = [
    ...덧,
    [/\/auth\/v1\/user$/, () => J({ id: 'user-1', aud: 'authenticated', role: 'authenticated', email: 'a@test' })],
    [/\/rest\/v1\/rpc\/public_flags$/, () => J({ ai: true })],
    [/\/rest\/v1\/rpc\/ai_take$/, () => J({ ok: true, used: 1, limit: 20 })],
    [/\/rest\/v1\/app_settings$/, () => J([{ key: 'ai_model', value: { name: 'model-설정' } }])],
    [/\/rest\/v1\/trips$/, (_u, i) => 한줄(i, { title: '시험 여행', destination: '도쿄', country: 'JP',
        start_date: '2026-11-01', end_date: '2026-11-03', timezone: 'Asia/Tokyo', currency: 'JPY',
        home_currency: 'KRW', walk_max_km: 1, transit_factor: 3, transit_base_min: 10 })],
    [/\/rest\/v1\/user_prefs$/, (_u, i) => 한줄(i, null)],
    [/generativelanguage\.googleapis\.com/, () => 제미니답(JSON.stringify({ reply: '답이에요' }))],
  ];
  globalThis.fetch = 가짜fetch as typeof fetch;
};
const 끝 = () => { globalThis.fetch = 원래fetch; };
const 요청 = (body: unknown, h: Record<string, string> = {}) =>
  new Request('http://fn.test/chat', {
    method: 'POST',
    headers: { authorization: 'Bearer user-jwt-fake', 'content-type': 'application/json', ...h },
    body: JSON.stringify(body),
  });
const 답 = async (r: Response) => ({ status: r.status, body: await r.json() });

/* ── 1. 오류 글을 사용자에게 그대로 돌려주지 않는다 ─────────────────── */
Deno.test('ai_take 가 DB 오류면 멈추고, 내부 오류 글은 답에 안 싣는다', async () => {
  기본길([[/\/rest\/v1\/rpc\/ai_take$/, () => J({ code: '42P01', message: 'relation "ai_usage" does not exist' }, 500)]]);
  try {
    const r = await 답(await 처리(요청({ message: '안녕' })));
    assertEquals(r.status, 500);
    const 글 = JSON.stringify(r.body);
    assert(!글.includes('ai_usage') && !글.includes('42P01'), '내부 오류 글이 새면 안 됨: ' + 글);
    assert(typeof r.body.ref === 'string' && r.body.ref.length === 8, '문의용 번호');
    assertEquals(제미니부름().length, 0, '사용량을 못 셌으면 AI 를 부르지 않음');
  } finally { 끝(); }
});

Deno.test('예상 못 한 예외도 쉬운 말과 번호만 돌려준다', async () => {
  기본길([[/generativelanguage\.googleapis\.com/, () => new Response('<html>not json</html>', { status: 200 })]]);
  try {
    const r = await 답(await 처리(요청({ message: '안녕' })));
    assertEquals(r.status, 500);
    assert(!JSON.stringify(r.body).includes('JSON'), 'SyntaxError 글이 새면 안 됨');
    assert(r.body.ref);
  } finally { 끝(); }
});

/* ── 2. 입력 상한 · 모양 검사 ──────────────────────────────────────── */
Deno.test('글이 상한을 넘으면 400, 사용량도 안 세고 AI 도 안 부른다', async () => {
  기본길();
  try {
    const r = await 답(await 처리(요청({ message: 'ㄱ'.repeat(6001) })));
    assertEquals(r.status, 400);
    assert(!불림.some((c) => c.url.includes('ai_take')), 'ai_take 를 부르면 안 됨');
    assertEquals(제미니부름().length, 0);
    /* 불러오기는 더 깁니다(화면이 8,000자까지 보냄) */
    const r2 = await 답(await 처리(요청({ mode: 'import', trip_id: TRIP, message: 'ㄱ'.repeat(8000) })));
    assert(r2.status !== 400, '불러오기 8,000자는 받아야 함');
  } finally { 끝(); }
});

Deno.test('모양이 틀린 trip_id · mode · message 는 400', async () => {
  기본길();
  try {
    assertEquals((await 처리(요청({ message: '안녕', trip_id: 'abc' }))).status, 400);
    assertEquals((await 처리(요청({ message: '안녕', trip_id: { x: 1 } }))).status, 400);
    assertEquals((await 처리(요청({ message: '안녕', mode: 'admin' }))).status, 400);
    assertEquals((await 처리(요청({ message: { a: 1 } }))).status, 400);
    assertEquals(제미니부름().length, 0);
  } finally { 끝(); }
});

Deno.test('본문이 너무 크면 413(머리의 길이로도, 실제 받은 양으로도)', async () => {
  기본길();
  try {
    assertEquals((await 처리(요청({ message: '안녕' }, { 'content-length': '20000000' }))).status, 413);
    /* 길이 머리 없이 흘려 보내는 큰 본문 */
    const 큼 = new TextEncoder().encode('{"message":"' + 'a'.repeat(9_600_000) + '"}');
    let 보낸 = 0;
    const 흐름 = new ReadableStream<Uint8Array>({
      pull(c) { if (보낸 >= 큼.length) return c.close(); c.enqueue(큼.subarray(보낸, 보낸 + 65536)); 보낸 += 65536; },
    });
    const req = new Request('http://fn.test/chat', {
      method: 'POST', headers: { authorization: 'Bearer user-jwt-fake' }, body: 흐름,
      // deno-lint-ignore no-explicit-any
      ...({ duplex: 'half' } as any),
    });
    assertEquals((await 처리(req)).status, 413);
  } finally { 끝(); }
});

/* ── 3. 필수 DB 조회 실패를 «빈 자료»로 처리하지 않는다 ─────────────── */
Deno.test('여행을 못 읽으면 503 — «여행 없음»으로 답하지 않는다', async () => {
  기본길([[/\/rest\/v1\/trips$/, () => J({ code: '57014', message: 'canceling statement due to statement timeout' }, 500)]]);
  try {
    const r = await 답(await 처리(요청({ message: '내일 뭐 해?', trip_id: TRIP })));
    assertEquals(r.status, 503);
    assert(!JSON.stringify(r.body).includes('statement'));
    assertEquals(제미니부름().length, 0);
  } finally { 끝(); }
});

Deno.test('일정(plans)을 못 읽어도 503', async () => {
  기본길([[/\/rest\/v1\/plans$/, () => J({ code: 'XX000', message: 'internal' }, 500)]]);
  try {
    assertEquals((await 처리(요청({ message: '내일 뭐 해?', trip_id: TRIP }))).status, 503);
    assertEquals(제미니부름().length, 0);
  } finally { 끝(); }
});

Deno.test('없는(남의) 여행이면 404', async () => {
  기본길([[/\/rest\/v1\/trips$/, (_u, i) => 한줄(i, null)]]);
  try {
    assertEquals((await 처리(요청({ message: '내일 뭐 해?', trip_id: TRIP }))).status, 404);
    assertEquals(제미니부름().length, 0);
  } finally { 끝(); }
});

Deno.test('지출을 못 읽으면 답은 하되, AI 에게 «없음»이 아니라 «못 읽음»으로 준다', async () => {
  기본길([[/\/rest\/v1\/expenses$/, () => J({ code: 'XX000', message: 'boom' }, 500)]]);
  try {
    const r = await 처리(요청({ message: '돈 얼마나 썼어?', trip_id: TRIP }));
    assertEquals(r.status, 200);
    const 글 = 제미니부름()[0].전부;
    const 자리 = 글.lastIndexOf('[최근 지출]');   // 앞쪽은 근거 이름표(SRC_MAP)에 나오는 것
    const 지출칸 = 글.slice(자리, 자리 + 120);
    assert(지출칸.includes('못 읽었다'), 지출칸);
    assert(!지출칸.includes('- (없음)'), 지출칸);
  } finally { 끝(); }
});

Deno.test('대화 기록을 못 읽으면 되묻게 알린다(처음 대화로 꾸미지 않음)', async () => {
  기본길([[/\/rest\/v1\/chats$/, () => J({ code: 'XX000', message: 'boom' }, 500)]]);
  try {
    assertEquals((await 처리(요청({ message: '1번 넣어줘' }))).status, 200);
    assert(제미니부름()[0].전부.includes('앞서 나눈 대화를 서버 사정으로 지금 못 읽었다'));
  } finally { 끝(); }
});

Deno.test('설정을 못 읽으면 기본 모델 · 웹 검색은 끈 것으로', async () => {
  기본길([[/\/rest\/v1\/app_settings$/, () => J({ code: 'XX000', message: 'boom' }, 500)]]);
  try {
    assertEquals((await 처리(요청({ message: '근처 맛집 추천해줘' }))).status, 200);
    assert(!불림.some((c) => c.url.includes('tavily')), '설정을 모르면 돈 드는 검색은 안 함');
    assertEquals(제미니부름()[0].모델, 'gemini-3.6-flash');
  } finally { 끝(); }
});

/* ── 4. 요청별 설정 — 동시에 온 요청끼리 모델이 섞이지 않는다 ─────── */
Deno.test('동시에 온 두 요청은 각자 읽은 모델을 쓴다', async () => {
  /* A 가 설정(model-A)을 먼저 읽고, 대화 기록을 읽느라 기다리는 사이 B 가 설정(model-B)을 읽습니다.
     전역 변수였을 때는 A 가 AI 를 부를 때 B 의 값(model-B)을 썼습니다 — 옛 코드로 돌려 확인함. */
  let 설정n = 0, 기록n = 0;
  기본길([
    [/\/rest\/v1\/app_settings$/, async () => {
      if (설정n++ === 0) return J([{ key: 'ai_model', value: { name: 'model-A' } }]);
      await 늦게(40); return J([{ key: 'ai_model', value: { name: 'model-B' } }]);
    }],
    [/\/rest\/v1\/chats$/, async () => { if (기록n++ === 0) await 늦게(120); return J([]); }],
  ]);
  try {
    const [a, b] = await Promise.all([처리(요청({ message: '질문A' })), 처리(요청({ message: '질문B' }))]);
    assertEquals([a.status, b.status], [200, 200]);
    const 부름 = 제미니부름();
    assertEquals(부름.find((x) => x.마지막 === '질문A')?.모델, 'model-A');
    assertEquals(부름.find((x) => x.마지막 === '질문B')?.모델, 'model-B');
  } finally { 끝(); }
});

Deno.test('지난 대화 읽기가 웹 검색과 겹친다(차례로 더해지지 않음)', async () => {
  /* 2026-10-16 실측: 검색+대화 읽기 3.4초가 차례로 더해졌음. 둘 다 300ms 걸리게 해서 합이 ~600 이 아니라 ~300 인지. */
  기본길([
    [/api\.tavily\.com/, async () => { await 늦게(300); return J({ results: [{ title: '가게', content: '설명', url: 'https://a.example/', score: 0.8 }] }); }],
    [/\/rest\/v1\/chats$/, async () => { await 늦게(300); return J([]); }],
  ]);
  try {
    const t = Date.now();
    assertEquals((await 처리(요청({ message: '근처 맛집 추천해줘' }))).status, 200);
    const 걸림 = Date.now() - t;
    assert(불림.some((c) => c.url.includes('tavily')), '검색을 했어야 함');
    assert(걸림 < 520, `겹쳤으면 300ms 남짓이어야 함 — ${걸림}ms`);
  } finally { 끝(); }
});

/* ── 4-2. 생각 정도(GEMINI_THINKING_ADMIN · GEMINI_THINKING) ─────────── */
const 생각부름 = () => 불림.filter((c) => c.url.includes('generativelanguage'))
  .map((c) => JSON.parse(c.body).generationConfig?.thinkingConfig ?? null);
const 관리자길 = (참: boolean): [RegExp, 길] => [/\/rest\/v1\/rpc\/is_admin$/, () => J(참)];
const 비밀값지우기 = () => { Deno.env.delete('GEMINI_THINKING'); Deno.env.delete('GEMINI_THINKING_ADMIN'); };

Deno.test('생각설정: 정도 낱말·숫자만 받고 나머지는 안 씀', () => {
  assertEquals(chat.생각설정('low')?.cfg, { thinkingConfig: { thinkingLevel: 'low' } });
  assertEquals(chat.생각설정(' Minimal ')?.cfg, { thinkingConfig: { thinkingLevel: 'minimal' } });
  assertEquals(chat.생각설정('512')?.cfg, { thinkingConfig: { thinkingBudget: 512 } });
  for (const v of ['', undefined, null, 'off', 'low; drop', '-1', '1.5']) assertEquals(chat.생각설정(v), null, String(v));
});

Deno.test('관리자 전용 값: 관리자면 생각 «낮음»으로 묻는다', async () => {
  Deno.env.set('GEMINI_THINKING_ADMIN', 'low');
  기본길([관리자길(true)]);
  try {
    assertEquals((await 처리(요청({ message: '안녕' }))).status, 200);
    assertEquals(생각부름(), [{ thinkingLevel: 'low' }]);
  } finally { 끝(); 비밀값지우기(); }
});

Deno.test('관리자 전용 값: 관리자가 아니면 지금과 똑같이(설정 없음)', async () => {
  Deno.env.set('GEMINI_THINKING_ADMIN', 'low');
  기본길([관리자길(false)]);
  try {
    assertEquals((await 처리(요청({ message: '안녕' }))).status, 200);
    assertEquals(생각부름(), [null]);
  } finally { 끝(); 비밀값지우기(); }
});

Deno.test('관리자인지 못 물으면 관리자가 아닌 것으로(지금과 같게)', async () => {
  Deno.env.set('GEMINI_THINKING_ADMIN', 'low');
  기본길([[/\/rest\/v1\/rpc\/is_admin$/, () => J({ message: 'boom' }, 500)]]);
  try {
    assertEquals((await 처리(요청({ message: '안녕' }))).status, 200);
    assertEquals(생각부름(), [null]);
  } finally { 끝(); 비밀값지우기(); }
});

Deno.test('값이 없으면 관리자인지 묻지도 않는다', async () => {
  기본길([관리자길(true)]);
  try {
    assertEquals((await 처리(요청({ message: '안녕' }))).status, 200);
    assert(!불림.some((c) => c.url.includes('is_admin')), 'is_admin 을 부르면 안 됨');
    assertEquals(생각부름(), [null]);
  } finally { 끝(); }
});

Deno.test('모두에게 값: 관리자가 아니어도 쓰고, 관리자인지 안 묻는다', async () => {
  Deno.env.set('GEMINI_THINKING', 'low');
  기본길([관리자길(false)]);
  try {
    assertEquals((await 처리(요청({ message: '안녕' }))).status, 200);
    assert(!불림.some((c) => c.url.includes('is_admin')));
    assertEquals(생각부름(), [{ thinkingLevel: 'low' }]);
  } finally { 끝(); 비밀값지우기(); }
});

Deno.test('일정 초안에는 생각 설정을 안 건다(대화에만)', async () => {
  Deno.env.set('GEMINI_THINKING', 'low');
  기본길([[/generativelanguage\.googleapis\.com/, () => 제미니답(JSON.stringify({ reply: '초안', actions: [] }))]]);
  try {
    assertEquals((await 처리(요청({ mode: 'draft', trip_id: TRIP }))).status, 200);
    assertEquals(생각부름(), [null]);
  } finally { 끝(); 비밀값지우기(); }
});

Deno.test('모델이 생각 설정을 거절하면(400) 설정 없이 같은 모델로 다시 묻는다', async () => {
  Deno.env.set('GEMINI_THINKING_ADMIN', 'low');
  let n = 0;
  기본길([관리자길(true), [/generativelanguage\.googleapis\.com/, () =>
    n++ === 0 ? J({ error: { message: 'Unknown name "thinkingLevel"' } }, 400)
              : 제미니답(JSON.stringify({ reply: '답이에요' }))]]);
  try {
    const r = await 답(await 처리(요청({ message: '안녕' })));
    assertEquals(r.status, 200);
    assertEquals(r.body.reply, '답이에요');
    assertEquals(생각부름(), [{ thinkingLevel: 'low' }, null]);
    const 모델들 = 불림.filter((c) => c.url.includes('generativelanguage')).map((c) => c.url.match(/models\/([^:]+):/)?.[1]);
    assertEquals(모델들, ['model-설정', 'model-설정'], '가벼운 모델로 떨어지면 안 됨');
  } finally { 끝(); 비밀값지우기(); }
});

/* ── 5. 바깥 호출의 시간 상한 ──────────────────────────────────────── */
Deno.test('callGemini: 마감이 지났으면 부르지 않고 599', async () => {
  기본길();
  try {
    const r = await callGemini('m', 'k', [], 0, {}, 0, Date.now() + 500);
    assertEquals(r.code, 599);
    assertEquals(불림.length, 0);
  } finally { 끝(); }
});

Deno.test('callGemini: 답이 안 오면 기다림에서 끊고 599(던지지 않음)', async () => {
  기본길([[/generativelanguage\.googleapis\.com/, () => 'hang']]);
  try {
    const t = Date.now();
    const r = await callGemini('m', 'k', [], 0, {}, 3200);
    assertEquals(r.code, 599);
    assert(Date.now() - t < 6000, '기다림 근처에서 끊겨야 함');
  } finally { 끝(); }
});

Deno.test('callGemini: 요청 마감이 기다림보다 먼저면 마감에서 끊는다', async () => {
  기본길([[/generativelanguage\.googleapis\.com/, () => 'hang']]);
  try {
    const t = Date.now();
    const r = await callGemini('m', 'k', [], 0, {}, 45000, Date.now() + 3300);
    assertEquals(r.code, 599);
    assert(Date.now() - t < 6000);
  } finally { 끝(); }
});

const 가짜admin = {
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
                 upsert: () => Promise.resolve({}) }),
  rpc: () => Promise.resolve({}),
};

Deno.test('webSearch: 마감이 모자라면 부르지 않고 null(크레딧 안 나감)', async () => {
  기본길();
  try {
    assertEquals(await webSearch('k', 가짜admin, '도쿄 맛집', 5, null, Date.now() + 500), null);
    assert(!불림.some((c) => c.url.includes('tavily')));
  } finally { 끝(); }
});

Deno.test('webSearch: Tavily 가 안 돌아오면 마감에서 끊고 null', async () => {
  기본길([[/api\.tavily\.com/, () => 'hang']]);
  try {
    const t = Date.now();
    assertEquals(await webSearch('k', 가짜admin, '도쿄 맛집', 5, null, Date.now() + 3300), null);
    assert(Date.now() - t < 6000);
  } finally { 끝(); }
});

Deno.test('webSearch: 정상 답은 그대로 거른다', async () => {
  기본길([[/api\.tavily\.com/, () => J({ results: [
    { title: '좋은 곳', content: '설명', url: 'https://a.example/1', score: 0.7 },
    { title: '먼 곳', content: '설명', url: 'https://b.example/2', score: 0.1 },
  ] })]]);
  try {
    const r = await webSearch('k', 가짜admin, '도쿄 맛집', 5, null, Date.now() + 20000);
    assertEquals(r?.length, 1);
    assertEquals(r?.[0].title, '좋은 곳');
  } finally { 끝(); }
});
