/* push 함수의 «누가 부를 수 있나»(allowed) 시험 — `deno test supabase/tests/`
 *
 * 왜 있나(2026-10-16): 전에는 `sb_secret_` 로 시작하기만 하거나, 서명 없이 payload 에
 * role:service_role 만 적힌 JWT 를 «서버 열쇠»로 받았습니다. 그 둘이 다시 들어오지
 * 않게 못 박습니다.
 *
 * ⚠ 함수 파일을 그대로 불러옵니다. 불러오는 순간 `Deno.serve` 가 서버를 띄우므로 그것만
 *   시험 동안 막습니다(함수 코드는 안 건드립니다). 바깥으로 나가는 요청은 없습니다.
 * ⚠ 여기 적은 열쇠들은 시험용 가짜입니다. */
import { assertEquals } from 'jsr:@std/assert@1';

Deno.env.set('SUPABASE_URL', 'http://localhost:54321');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'srv-fake-test-key-1234567890');
Deno.env.set('VAPID_PUBLIC', 'x');
Deno.env.set('VAPID_PRIVATE', 'y');

const 원래serve = Deno.serve;
// deno-lint-ignore no-explicit-any
(Deno as any).serve = () => ({ finished: Promise.resolve(), shutdown: () => {} });
const { allowed, 같은비밀 } = await import('../functions/push/index.ts');
// deno-lint-ignore no-explicit-any
(Deno as any).serve = 원래serve;

const SRV = 'srv-fake-test-key-1234567890';
const CRON = 'cron-fake-test-key-abcdefghij';
const 요청 = (h: Record<string, string>) => new Request('http://x/push', { method: 'POST', headers: h });
const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
/* 서명 없는(가짜 서명) JWT — payload 만 꾸민 것 */
const 꾸민JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'service_role' })}.fakesig`;

const env둘다 = { cron: CRON, srv: SRV };
const env옛 = { cron: '', srv: SRV };

Deno.test('서명 없이 payload 만 꾸민 service_role JWT 는 막는다(전에는 통과)', () => {
  assertEquals(allowed(요청({ authorization: `Bearer ${꾸민JWT}` }), env옛).ok, false);
  assertEquals(allowed(요청({ authorization: `Bearer ${꾸민JWT}` }), env둘다).ok, false);
});

Deno.test('sb_secret_ 로 «시작하기만» 하는 것은 막는다(전에는 통과)', () => {
  assertEquals(allowed(요청({ authorization: 'Bearer sb_secret_anything' }), env옛).ok, false);
});

Deno.test('B: 함수의 service_role 키와 글자까지 같으면 통과', () => {
  assertEquals(allowed(요청({ authorization: `Bearer ${SRV}` }), env옛).ok, true);
  assertEquals(allowed(요청({ authorization: `bearer   ${SRV}` }), env옛).ok, true);
});

Deno.test('B: 한 글자라도 다르거나 앞만 같으면 막는다', () => {
  assertEquals(allowed(요청({ authorization: `Bearer ${SRV}x` }), env옛).ok, false);
  assertEquals(allowed(요청({ authorization: `Bearer ${SRV.slice(0, -1)}` }), env옛).ok, false);
  assertEquals(allowed(요청({}), env옛).ok, false);
});

Deno.test('A: x-cron-secret 이 맞으면 Authorization 없이도 통과', () => {
  assertEquals(allowed(요청({ 'x-cron-secret': CRON }), env둘다).ok, true);
});

Deno.test('A: x-cron-secret 이 틀리면 맞는 Bearer 가 같이 와도 막는다', () => {
  assertEquals(allowed(요청({ 'x-cron-secret': CRON + 'x', authorization: `Bearer ${SRV}` }), env둘다).ok, false);
});

Deno.test('옮기는 중: 함수에 cron 비밀값이 없으면 머리를 무시하고 B 로 판단', () => {
  assertEquals(allowed(요청({ 'x-cron-secret': 'whatever', authorization: `Bearer ${SRV}` }), env옛).ok, true);
  assertEquals(allowed(요청({ 'x-cron-secret': 'whatever' }), env옛).ok, false);
});

Deno.test('옮기는 중: 함수에 cron 비밀값이 있어도 머리 없이 맞는 Bearer 면 통과(B)', () => {
  assertEquals(allowed(요청({ authorization: `Bearer ${SRV}` }), env둘다).ok, true);
});

Deno.test('비밀값이 하나도 없으면 아무것도 안 받는다', () => {
  const 빈 = { cron: '', srv: '' };
  assertEquals(allowed(요청({ authorization: 'Bearer ' }), 빈).ok, false);
  assertEquals(allowed(요청({ authorization: `Bearer ${SRV}`, 'x-cron-secret': CRON }), 빈).ok, false);
});

Deno.test('막을 때 돌려주는 말에 비밀값이 안 실린다', () => {
  const r = allowed(요청({ authorization: `Bearer ${SRV.slice(0, 10)}` }), env둘다);
  assertEquals(r.ok, false);
  assertEquals(r.kind.includes(SRV.slice(0, 6)) || r.kind.includes(CRON.slice(0, 6)), false);
});

Deno.test('같은비밀: 같음·다름·길이 다름·빈 값', () => {
  assertEquals(같은비밀('abc', 'abc'), true);
  assertEquals(같은비밀('abc', 'abd'), false);
  assertEquals(같은비밀('abc', 'abcd'), false);
  assertEquals(같은비밀('', ''), false);
  assertEquals(같은비밀('한글열쇠', '한글열쇠'), true);
});
