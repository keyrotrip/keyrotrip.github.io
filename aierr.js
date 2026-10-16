/* ── AI(chat 함수) 오류를 사람 말로 — 한 곳 (2026-10-16) ────────────────────────────
 *
 * 왜: AI 를 부르는 화면 다섯(aiui · bring · draft · report · sheetimp)이 오류 글을 저마다 꺼냈습니다.
 *   같은 일을 다섯 번 적으니 갈라졌습니다 — draft.js 는 연결이 끊긴 것(Failed to send)을
 *   «AI 기능이 아직 준비되지 않았어요»로 보여 줬습니다(aiui.js 는 둘을 이미 갈라 두었는데).
 *
 * 무엇을 돌려주나 — 사용자에게 보일 한 줄:
 *   1. 서버가 보낸 말(본문의 error)이 있으면 그것 + «(문의 번호 xxxxxxxx)» — 사용량 초과(429)·
 *      시간 초과(504)·입력 오류(400) 문구는 서버(chat/index.ts)가 정합니다. 번호는 함수 로그의 [번호].
 *   2. 본문이 없으면 상태로: 404 = 함수 없음 · 504/546 = 시간 초과 · 연결 끊김 · 그 밖.
 *
 * ⚠ `error.context` 의 본문은 한 번만 읽힙니다 — 부르는 쪽에서 먼저 읽지 마십시오.
 * ⚠ 화면이 스스로 기다리다 포기한 것(aiui 의 90초)은 부르는 쪽 문구를 그대로 씁니다(`화면시간초과`).
 * 층: 아무것도 안 읽습니다(잎). */
const 끊김꼴 = /Failed to send|Failed to fetch|Load failed|NetworkError|network/i;
const 번호붙이기 = (말, ref) => (ref ? `${말} (문의 번호 ${ref})` : 말);

export async function AI오류글(error, data){
  if (error?.화면시간초과) return String(error.message || '');
  /* 함수가 정상(2xx)으로 답했는데 error 를 담은 경우 — AI 를 꺼 둠 · 읽을 것이 없음 등 */
  if (!error) return data?.error ? 번호붙이기(String(data.error), data.ref) : '';
  const 상태 = error.context?.status;
  let 몸 = null;
  try { 몸 = await error.context?.json?.(); } catch { /* 본문이 JSON 이 아님 */ }
  if (몸?.error) return 번호붙이기(String(몸.error), 몸.ref);
  const m = String(error.message || '');
  if (상태 === 404 || /not found/i.test(m)) return 'AI 기능이 아직 준비되지 않았어요. 만든 사람에게 알려주세요.';
  if (상태 === 504 || 상태 === 546) return '답을 만드는 데 시간이 너무 걸렸어요. 잠시 뒤 다시 해주세요.';
  if (끊김꼴.test(m))
    return '답을 받다 연결이 끊겼어요. 인터넷을 확인하고 다시 해주세요. ' +
           '글이 아주 길거나 링크가 무거우면 그럴 수도 있어요.';
  return '잠시 문제가 생겼어요. 조금 뒤 다시 해주세요.';
}
