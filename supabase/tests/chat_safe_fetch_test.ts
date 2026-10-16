/* chat 함수의 «안전한 바깥 요청» 시험 — `deno test supabase/tests/`
 *
 * ⚠⚠ **모의 네트워크로만 돕니다.** 진짜 fetch·DNS 는 한 번도 안 부릅니다 — `__시험용망` 으로
 *   가짜 fetch·가짜 DNS 를 끼웁니다. 운영 API·남의 서버에 아무것도 보내지 않습니다.
 * ⚠ 함수 파일을 그대로 불러옵니다. 불러오는 순간 `Deno.serve` 가 서버를 띄우므로 시험 동안만
 *   막습니다(함수 코드는 안 건드립니다). */
import { assert, assertEquals } from 'jsr:@std/assert@1';

// deno-lint-ignore no-explicit-any
const 원래serve = Deno.serve; (Deno as any).serve = () => ({ finished: Promise.resolve(), shutdown: () => {} });
const chat = await import('../functions/chat/index.ts');
// deno-lint-ignore no-explicit-any
(Deno as any).serve = 원래serve;
const { 막힌주소, 주소검사, 안전요청, __시험용망, readLinks, 기본해석 } = chat;

/* ── 모의 네트워크 ───────────────────────────────────────────────────── */
type 가짜응답 = { status?: number; headers?: Record<string, string>; body?: string | Uint8Array[]; 늦게?: number; 안끝남?: boolean };
let 길: Record<string, 가짜응답> = {};
let dns: Record<string, string[] | null> = {};
let 불림: string[] = [];
let 당겨감 = 0;
const 흐름 = (조각: Uint8Array[]) => new ReadableStream<Uint8Array>({
  pull(c) { const v = 조각.shift(); 당겨감++; if (v) c.enqueue(v); else c.close(); },
});
const 가짜fetch = (u: string, i?: RequestInit): Promise<Response> => {
  불림.push(u);
  const r = 길[u];
  return new Promise((ok, bad) => {
    const 끝 = () => {
      if (!r) return ok(new Response('없음', { status: 404 }));
      const body = typeof r.body === 'string' ? r.body : r.body ? 흐름([...r.body]) : '';
      ok(new Response(body, { status: r.status ?? 200, headers: r.headers ?? { 'content-type': 'text/html' } }));
    };
    let 타이머 = 0;
    i?.signal?.addEventListener('abort', () => { clearTimeout(타이머); bad(new DOMException('aborted', 'AbortError')); });
    if (r?.안끝남) return;                      // 끊길 때까지 안 돌아옴
    타이머 = setTimeout(끝, r?.늦게 ?? 0);
  });
};
const 가짜dns = (host: string) => Promise.resolve(host in dns ? dns[host] : ['93.184.216.34']);
const 새로 = () => { 길 = {}; dns = {}; 불림 = []; 당겨감 = 0; __시험용망({ fetch: 가짜fetch, resolve: 가짜dns }); };

/* ── 1. 주소만 보고 막는 것 ─────────────────────────────────────────── */
Deno.test('막힌주소: 내부·예약 대역은 막고 공인 주소는 둔다', () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.5.4', '172.31.255.255', '192.168.1.1', '169.254.169.254',
                    '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '::1', '::', '::ffff:127.0.0.1',
                    '::ffff:7f00:1', '::ffff:169.254.169.254', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'fe80::1%eth0',
                    '64:ff9b::7f00:1', '[::1]', '2001:db8::1', 'ff02::1', '이상한값'])
    assert(막힌주소(ip), ip + ' 는 막혀야 함');
  for (const ip of ['8.8.8.8', '93.184.216.34', '172.32.0.1', '100.128.0.1', '2606:4700::1111', '::ffff:8.8.8.8'])
    assertEquals(막힌주소(ip), false, ip + ' 는 공인 주소');
});

Deno.test('주소검사: 꼴로 막는 것(스킴·포트·아이디·내부 이름·숫자 IP 여러 꼴)', async () => {
  새로();
  const 막힘 = ['http://127.0.0.1/', 'http://2130706433/', 'http://0x7f.1/', 'http://0177.0.0.1/', 'http://127.1/',
               'http://[::1]/', 'http://[::ffff:169.254.169.254]/', 'http://localhost/', 'http://a.localhost/',
               'http://metadata.google.internal/', 'http://printer.local/', 'http://intranet/', 'ftp://example.com/',
               'file:///etc/passwd', 'http://example.com:8080/', 'http://u:p@example.com/', '주소아님'];
  for (const u of 막힘) assertEquals((await 주소검사(u)).ok, false, u + ' 는 막혀야 함');
  assertEquals((await 주소검사('https://blog.naver.com/abc/123')).ok, true);
  assertEquals((await 주소검사('https://example.com:443/x')).ok, true);
});

Deno.test('주소검사: 이름이 내부 주소로 풀리면 막는다(하나라도)', async () => {
  새로();
  dns['evil.example'] = ['10.0.0.5'];
  dns['mixed.example'] = ['8.8.8.8', '127.0.0.1'];
  dns['meta.example'] = ['::ffff:169.254.169.254'];
  dns['none.example'] = [];
  for (const h of ['evil', 'mixed', 'meta', 'none'])
    assertEquals((await 주소검사(`https://${h}.example/`)).ok, false, h);
});

Deno.test('주소검사: DNS 를 못 푸는 환경이면 알려진 블로그·지도 이름만 받는다', async () => {
  새로();
  __시험용망({ resolve: () => Promise.resolve(null) });
  assertEquals((await 주소검사('https://m.blog.naver.com/x')).ok, true);
  assertEquals((await 주소검사('https://maps.app.goo.gl/abc')).ok, true);
  assertEquals((await 주소검사('https://www.google.co.kr/maps/place/x')).ok, true);
  assertEquals((await 주소검사('https://unknown-blog.example/x')).ok, false);
  assertEquals((await 주소검사('https://google.evil.com/')).ok, false);
});

/* ── 2. 리다이렉트 매 단계 ───────────────────────────────────────────── */
Deno.test('리다이렉트로 메타데이터 주소에 가려 하면 막고, 그곳엔 요청이 안 나간다', async () => {
  새로();
  길['https://pub.example/a'] = { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } };
  const r = await 안전요청('https://pub.example/a', { ms: 1000, maxBytes: 1000 });
  assertEquals(r.ok, false);
  assertEquals(불림, ['https://pub.example/a']);
});

Deno.test('리다이렉트 대상 «이름»이 내부로 풀려도 막는다', async () => {
  새로();
  dns['inner.example'] = ['192.168.0.10'];
  길['https://pub.example/a'] = { status: 301, headers: { location: 'https://inner.example/x' } };
  const r = await 안전요청('https://pub.example/a', { ms: 1000, maxBytes: 1000 });
  assertEquals(r.ok, false);
  assertEquals(불림.length, 1);
});

Deno.test('상대 리다이렉트도 풀어서 다시 검사하고 따라간다(최종 주소 돌려줌)', async () => {
  새로();
  길['https://pub.example/a'] = { status: 302, headers: { location: '/b' } };
  길['https://pub.example/b'] = { status: 200, headers: { 'content-type': 'text/html' }, body: '<p>본문</p>' };
  const r = await 안전요청('https://pub.example/a', { ms: 1000, maxBytes: 1000 });
  assert(r.ok);
  if (r.ok) { assertEquals(r.url, 'https://pub.example/b'); assertEquals(r.text, '<p>본문</p>'); }
});

Deno.test('리다이렉트는 최대 4번', async () => {
  새로();
  for (let i = 0; i < 10; i++) 길[`https://pub.example/${i}`] = { status: 302, headers: { location: `/${i + 1}` } };
  const r = await 안전요청('https://pub.example/0', { ms: 1000, maxBytes: 1000 });
  assertEquals(r.ok, false);
  assertEquals(불림.length, 5);            // 처음 + 리다이렉트 4번
});

/* ── 3. 크기 · 종류 · 시간 ──────────────────────────────────────────── */
Deno.test('본문은 상한에서 끊고 나머지는 안 받는다(Content-Length 가 없어도)', async () => {
  새로();
  const 조각 = Array.from({ length: 50 }, () => new TextEncoder().encode('a'.repeat(100_000)));
  길['https://big.example/'] = { status: 200, headers: { 'content-type': 'text/html' }, body: 조각 };
  const r = await 안전요청('https://big.example/', { ms: 2000, maxBytes: 250_000 });
  assert(r.ok);
  if (r.ok) { assertEquals(r.text.length, 250_000); assertEquals(r.truncated, true); }
  assert(당겨감 <= 4, `흘려 받은 조각 ${당겨감}개 — 상한 뒤로 더 받으면 안 됨`);
});

Deno.test('Content-Length 가 대놓고 크면 아예 안 받는다', async () => {
  새로();
  길['https://big.example/'] = { status: 200, headers: { 'content-type': 'text/html', 'content-length': '999999999' }, body: 'x' };
  assertEquals((await 안전요청('https://big.example/', { ms: 1000, maxBytes: 1000 })).ok, false);
});

Deno.test('글이 아닌 것(그림 등)은 안 받는다', async () => {
  새로();
  길['https://img.example/a.jpg'] = { status: 200, headers: { 'content-type': 'image/jpeg' }, body: 'x' };
  assertEquals((await 안전요청('https://img.example/a.jpg', { ms: 1000, maxBytes: 1000 })).ok, false);
});

Deno.test('응답이 안 오면 제한 시간에 끊는다', async () => {
  새로();
  길['https://slow.example/'] = { 안끝남: true };
  const 시작 = Date.now();
  const r = await 안전요청('https://slow.example/', { ms: 150, maxBytes: 1000 });
  assertEquals(r.ok, false);
  assert(Date.now() - 시작 < 1500, '제한 시간 안에 돌아와야 함');
});

Deno.test('제한 시간은 리다이렉트 전체에 한 번 — 단계마다 새로 주지 않는다', async () => {
  새로();
  for (let i = 0; i < 4; i++)
    길[`https://pub.example/${i}`] = { status: 302, 늦게: 80, headers: { location: `/${i + 1}` } };
  길['https://pub.example/4'] = { status: 200, 늦게: 80, body: 'ok' };
  const r = await 안전요청('https://pub.example/0', { ms: 200, maxBytes: 1000 });
  assertEquals(r.ok, false, '80ms × 5단계 > 200ms 이면 시간 초과여야 함');
});

/* ── 4. 실제 입구(readLinks)로 — 블로그 iframe · 지도 단축 주소 ────────── */
Deno.test('블로그 글의 iframe 이 내부 주소를 가리켜도 따라가지 않는다', async () => {
  새로();
  길['https://pub.example/post'] = { status: 200, headers: { 'content-type': 'text/html' },
    body: '<html><body><iframe src="http://169.254.169.254/latest/"></iframe></body></html>' };
  await readLinks('이거 봐 https://pub.example/post');
  assertEquals(불림.some((u) => u.includes('169.254')), false);
});

Deno.test('지도 링크처럼 보여도 이름이 goo.gl 이 아니면 받지 않는다(전에는 ?goo.gl 로 통과)', async () => {
  새로();
  길['https://maps.google.evil.com/?goo.gl'] = { status: 302, headers: { location: 'http://169.254.169.254/' } };
  await readLinks('https://maps.google.evil.com/?goo.gl');
  assertEquals(불림.includes('https://maps.google.evil.com/?goo.gl'), false);
  assertEquals(불림.some((u) => u.includes('169.254')), false);
});

Deno.test('진짜 지도 단축 주소는 한 단계씩 검사하며 펼친다', async () => {
  새로();
  길['https://maps.app.goo.gl/abc'] = { status: 302, headers: { location: 'https://www.google.com/maps/place/Tokyo+Tower/@35.6586,139.7454,17z' } };
  길['https://www.google.com/maps/place/Tokyo+Tower/@35.6586,139.7454,17z'] = { status: 200, body: '<html></html>' };
  const r = await readLinks('https://maps.app.goo.gl/abc');
  assertEquals(r.maps?.length, 1);
  assertEquals(r.maps?.[0]?.name, 'Tokyo Tower');
  assertEquals(불림.length, 2);
});

/* ── 느린 DNS(2026-10-16 — 밖 리뷰: «DNS 조회에도 대기 제한») ─────────────────────── */
Deno.test('DNS 가 답을 안 주면 요청 제한 시간에서 끊고 받으러 가지 않는다', async () => {
  새로();
  __시험용망({ fetch: 가짜fetch, resolve: () => new Promise(() => {}) });   // 영영 안 돌아오는 DNS
  const t = Date.now();
  const r = await 안전요청('https://slow-dns.example/a', { ms: 300, maxBytes: 1000 });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.why, '시간 초과');
  assert(Date.now() - t < 2000, '제한 시간 근처에서 끊겨야 함');
  assertEquals(불림.length, 0, 'DNS 가 안 끝났으면 받으러 가면 안 됨');
});

Deno.test('기본해석: Deno.resolveDns 가 영영 안 돌아오면 3초 뒤 «확인 불가»(null)', async () => {
  // deno-lint-ignore no-explicit-any
  const D = Deno as any; const 원래 = D.resolveDns;
  D.resolveDns = (_h: string, _t: string, o?: { signal?: AbortSignal }) => new Promise((_ok, bad) => {
    o?.signal?.addEventListener('abort', () => bad(new DOMException('aborted', 'AbortError')));
  });
  try {
    const t = Date.now();
    assertEquals(await 기본해석('slow.example'), null);
    const 걸림 = Date.now() - t;
    assert(걸림 >= 2900 && 걸림 < 4500, `3초 근처여야 함 — ${걸림}ms`);
  } finally { D.resolveDns = 원래; }
});

Deno.test('기본해석: 정상이면 A·AAAA 를 합쳐 돌려준다 · 이름 없음은 빈 목록', async () => {
  // deno-lint-ignore no-explicit-any
  const D = Deno as any; const 원래 = D.resolveDns;
  D.resolveDns = (h: string, t: string) => h === 'none.example'
    ? Promise.reject(new Deno.errors.NotFound('x'))
    : Promise.resolve(t === 'A' ? ['93.184.216.34'] : ['2606:4700::1111']);
  try {
    assertEquals(await 기본해석('ok.example'), ['93.184.216.34', '2606:4700::1111']);
    assertEquals(await 기본해석('none.example'), []);
  } finally { D.resolveDns = 원래; }
});

Deno.test('응답이 중간에 멈추면(본문이 안 끝남) 제한 시간에서 끊는다', async () => {
  새로();
  /* 머리는 바로 오고 본문 흐름이 멈춘 서버 */
  __시험용망({ fetch: (_u: string, i?: RequestInit) => Promise.resolve(new Response(new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode('<html>앞부분'));
      i?.signal?.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError')));
    },
  }), { status: 200, headers: { 'content-type': 'text/html' } })), resolve: 가짜dns });
  const t = Date.now();
  const r = await 안전요청('https://stall.example/a', { ms: 300, maxBytes: 100000 });
  assertEquals(r.ok, false);
  assert(Date.now() - t < 2000);
});
