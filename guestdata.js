/* ── 방명록 — 서버에 묻고 적는 곳 (2026-10-16, db/138) ───────────────────────────
 * 데이터 모듈(personadata · tripdata 와 같은 규칙): 질의만 둡니다. 화면 판단은 guestbook.js.
 * ⚠ 표(guestbook)는 앱이 직접 못 읽습니다(정책 없음) — 비밀 글을 서버가 걸러 주는 함수로만.
 * 층: db 만 읽습니다. */
import { sb } from './db.js?v=b888';

/* 그 사람 방명록 — 비밀 글은 주인·쓴 사람이 아니면 본문·이름이 비어(null) 옵니다 */
export const 방명록읽기 = owner => sb.rpc('guestbook_list', { p_owner: owner });
/* 내 방명록 숫자 { total, waiting(답 안 단 글) } — 보관함 칸 */
export const 내방명록숫자 = () => sb.rpc('my_guestbook_stats');
export const 방명록쓰기 = (owner, body, secret) =>
  sb.rpc('guestbook_add', { p_owner: owner, p_body: body, p_secret: !!secret });
/* 주인의 한 줄 답 — 빈 글이면 답을 지웁니다 */
export const 방명록답 = (id, reply) => sb.rpc('guestbook_reply', { p_id: id, p_reply: reply });
export const 방명록지우기 = id => sb.rpc('guestbook_del', { p_id: id });
/* 사유는 사람 신고와 같은 다섯 가지 중 하나(db/101 people_reports) */
export const 방명록신고 = (id, reason) => sb.rpc('guestbook_report', { p_id: id, p_reason: reason });
