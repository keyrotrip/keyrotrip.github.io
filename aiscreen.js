/* ── AI 화면 — 여닫기와 대화 ──────────────────────────────────────────
 * 시트로 올라오는 AI 화면입니다. 대화를 받아 그리고, 화면을 여닫고,
 * 대화를 지웁니다. **답변 하나하나에 'AI가 생성한 답변입니다' 를 답니다** —
 * 인공지능기본법 제31조가 요구하는 것은 결과물 표시라, 화면에 한 번
 * 적어두는 것으로는 대신할 수 없습니다.
 *
 * ── app.js 에서 떼어낸 스물네 번째 조각입니다(b348) ──────────────────
 * app.js 만 아는 것은 **로그인한 사람 하나**입니다.
 *
 * 두 곳에 떨어져 있던 것을 이었습니다 — 'AI 대화'(대화 그리기)와, 한참 뒤
 * '내 자료 내려받기' 범위에 섞여 있던 여닫기·지우기. 붙어 있느냐가 아니라
 * 하는 일이 같으냐로 자릅니다(b342 에서 배운 것).
 *
 * 종 알림은 **같이 안 왔습니다.** 바로 옆줄에 있었지만 그건 notify.js 것입니다.
 *
 * 층: dom.js · db.js · net.js · trip.js · ui.js 와 이미 떼어낸
 *     ai.js · aiui.js · cards.js · plancheck.js 를 씁니다. */
import { $, esc, toast, md } from './dom.js?v=b833';
import { sb } from './db.js?v=b833';
import { fail, netTimeout, netIsDown } from './net.js?v=b833';
import { trip, plans } from './trip.js?v=b833';
import { arm, disarm, syncSheets } from './ui.js?v=b833';
import { aiTripId, setAiTripId, clearSuggested } from './ai.js?v=b833';
import { loadAi } from './plancheck.js?v=b833';
import { clearLastTake } from './cards.js?v=b833';

let ctx = { me: () => null };
export function setAiScreenCtx(o){ ctx = { ...ctx, ...o }; }

/* ── AI 대화 ────────────────────────────────────────────────────────
 * 키는 화면에 없습니다. Edge Function 뒤에 있고 우리는 그 함수만 부릅니다.
 * 대화는 사람별로 나눠 저장합니다 — 섞이면 AI 가 남의 질문을 맥락으로 씁니다
 * ("아까 말한 그 라멘집"이 다른 사람 대화일 수 있습니다). */
/* 늦은 답 막기(b799) — 여행을 바꾸면 앞 여행의 대화가 늦게 와서 새 여행 아래 그려질 수 있었습니다
   (cards.js 의 runReview 와 같은 수법). */
let 대화차례 = 0;
export async function loadChats(tripId){
  const 이번 = ++대화차례;
  /* AI 는 서버가 있어야 합니다. 오프라인이면 물어봐도 답이 안 옵니다.
     "불러오는 중…"을 남겨두면 하루 종일 기다리게 됩니다. 못 쓴다고 적습니다.
     입력칸도 막습니다 — 쓸 수 있게 두면 써 보고 나서야 안 되는 걸 압니다. */
  if (netIsDown()){
    $('chat').innerHTML = '<div class="empty">연결이 없어 AI 는 지금 쓸 수 없어요.<br>' +
      '일정과 지출은 그대로 보실 수 있어요.</div>';
    $('ai_msg').disabled = true; $('ai_send').disabled = true;
    return;
  }
  $('ai_msg').disabled = false; $('ai_send').disabled = false;

  /* 여행을 안 골랐을 때 나눈 대화도 남깁니다 (029). trip_id 가 비어 있는 줄입니다.
     eq 로는 null 을 못 찾습니다 — is 를 써야 합니다. */
  let q = sb.from('chats').select('role,content').eq('user_id', ctx.me().id);
  q = tripId ? q.eq('trip_id', tripId) : q.is('trip_id', null);
  const { data } = await netTimeout(q.order('created_at').limit(40));
  if (이번 !== 대화차례) return;
  drawChats(data || []);
  /* 쓴 횟수와 **남은 횟수를 따로** 적습니다. 전에는 "3/15회"였는데,
     이건 읽는 사람이 빼야 남은 수가 나옵니다 — 정작 궁금한 쪽을 안 알려준
     셈입니다. 한도가 없으면 limit 이 null 로 옵니다(db/046). 그때 그대로
     찍으면 "3/null회"가 되므로 남은 자리에는 '무제한'을 적습니다. */
  const { data: left } = await sb.rpc('ai_left');
  if (left) $('ai_left').textContent = left.limit == null
    ? `오늘 ${left.used}회 · 남은 횟수 무제한`
    : `오늘 ${left.used}회 · 남은 ${Math.max(0, left.limit - left.used)}회`;
}

/* md · avatarOf · avatarImg 는 dom.js 로 내렸습니다(b335, 맨 위 import).
   여기 있는 동안 city.js 와 report.js 가 import 없이 쓰고 있었습니다 —
   둘 다 템플릿 문자열 안이라 검사가 못 봤습니다. */

function drawChats(rows){
  /* 이름표를 떼고 좌우로 갈랐습니다. 누가 한 말인지 읽지 않아도 보입니다.
     답변마다 붙는 'AI 생성' 꼬리표는 멋이 아니라 의무입니다 —
     인공지능기본법(2026.1.22 시행) 제31조가 생성형 AI 결과물에 그 사실을
     표시하라고 정합니다. 화면에 한 번만 적어두는 것으로는 '결과물 표시'가
     아니라서, 답변 하나하나에 답니다. */
  /* 빈 상태일 때만 대화칸을 키워 안내와 예시를 가운데 세웁니다.
     **스크롤 상자(.aiscroll)는 건드리지 않습니다** — 거기를 손댔다가
     aiToBottom 이 엉뚱한 상자를 굴리던 사고가 이미 한 번 있었습니다. */
  $('chat').classList.toggle('isempty', !rows.length);
  $('chat').innerHTML = rows.length
    ? rows.map(m => m.role === 'user'
        ? `<div class="msg me">${md(m.content)}</div>`
        : `<div class="msg ai">${md(m.content)}<div class="aitag">AI가 생성한 답변입니다 · 영업시간·요금은 직접 확인해 주세요</div></div>`
      ).join('')
    /* 빈 화면에 붙던 안내(생성형 AI · 미국 Google 서버 전송)는 b178 에서
       뺐습니다. **답변마다 붙는 aitag 는 그대로 둡니다** — 인공지능기본법
       제31조가 요구하는 것은 결과물 표시라서 저 안내로는 대신할 수 없습니다.
       국외 이전 고지는 개인정보처리방침 7번에 그대로 있습니다. */
    /* **처음 열면 411px 가 빈 흰 자리였습니다** (실제 화면에서 잼).
       안내 한 줄만 있고 그 아래가 통째로 비었습니다. 대화창의 제일 큰 벽은
       "뭘 물어야 하지"인데, 그 벽 앞에 빈 화면을 내주고 있었던 것입니다.
       **눌러서 바로 보내지는 예시를 깝니다.** 한 번 눌러보면 어떤 것을
       물을 수 있는지 알게 되고, 다음부터는 자기 말로 칩니다.
       여행을 고른 상태면 그 여행에 대한 것을 묻습니다 — 고르개가 바로
       위에 있는데 예시가 일반적인 이야기면 둘이 따로 놉니다. */
    : `<div class="empty">${aiTripId ? '이 여행에 대해 물어보세요.' : '어디로 갈지, 뭘 챙길지 아무거나 물어보세요.'}</div>
       <div class="asks">${(aiTripId
          /* ⚠ **일정이 있느냐로 갈립니다 (b388).** 전에는 여행만 고르면
             "비 오면 뭐 하지?" "이 일정 너무 빡빡한가?" "근처 맛집 알려줘"가
             떴는데, **셋 다 일정이 있어야 뜻이 있는 질문**입니다.
             빈 여행에서 눌러도 AI 가 답할 거리가 없습니다.
             그 상황의 첫 질문은 "일정 짜줘"입니다. */
          ? (plans || []).length
            ? ['비 오면 뭐 하지?', '이 일정 너무 빡빡한가?', '근처 맛집 알려줘', '뭘 챙겨야 해?']
            : ['하루에 4~5개씩 일정 짜줘', '첫날 동선 짜줘', '꼭 가야 할 곳 알려줘', '뭘 챙겨야 해?']
          : ['3박 4일로 어디가 좋을까?', '지금 가기 좋은 곳은?', '혼자 가기 좋은 도시', '예산 100만원이면?']
        ).map(q => `<button type="button" class="ask" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
  aiToBottom();
}

/* 새 답변이 와도 화면이 그대로라 스크롤을 내려야만 읽을 수 있었습니다.
   **#chat 을 굴리고 있었는데 그건 스크롤 상자가 아닙니다.** 대화·근거·제안 카드를
   한 덩어리로 묶으면서 스크롤이 바깥 .aiscroll 로 옮겨졌는데(app.css),
   굴리는 코드는 옛 상자에 그대로 남아 있었습니다. 아무 일도 안 일어난 것입니다.
   답변 뒤에는 출처와 제안 카드가 더 붙으므로, 그것들이 그려진 **다음 프레임**에
   한 번 더 내립니다. 안 그러면 카드 높이만큼 모자랍니다. */
export function aiToBottom(){
  const box = document.querySelector('.aichat .aiscroll');
  if (!box) return;
  const go = () => { box.scrollTop = box.scrollHeight; };
  go();
  requestAnimationFrame(go);
}


export function openAi(){
  if (trip) setAiTripId(trip.id);
  /* ⚠ 알림판(`#notifpanel`)을 닫던 줄이 여기 있었습니다 — b759 에 그 판이
     프로필 카드로 들어가면서 «떠 있는 것»이 아니게 됐습니다. */
  $('aiview').classList.remove('hide');
  $('sheetbg').classList.remove('hide');
  document.body.classList.add('sheeton');
  if (history.state?.t2 !== 'ai') history.pushState({ t2:'ai' }, '');
  loadAi();
}
export function closeAi(fromPop){
  if (!fromPop && history.state?.t2 === 'ai'){ history.back(); return; }
  $('aiview').classList.add('hide');
  /* 다른 시트가 열려 있을 수도 있으니 뒷판은 그쪽 규칙에 맡깁니다. */
  syncSheets();
}
$('aibtn').addEventListener('click', openAi);
/* 여행 안 위 줄의 ✦ AI(b777). 같은 창을 엽니다 — 여행이 열려 있으므로
   openAi 가 그 여행을 골라 둡니다. */
$('tripaibtn').addEventListener('click', openAi);
$('ai_close').addEventListener('click', () => closeAi());

/* 대화 지우기. 여행 없이 나눈 것은 trip_id 가 비어 있어 is 로 지웁니다. */
$('ai_wipe').addEventListener('click', async e => {
  const b = e.currentTarget;
  const id = $('ai_trip').value;
  /* ⚠ **무엇을 지우는지 적습니다(b799, GPT 리포트).** 전에는 「정말 지울까요?」뿐이었는데, 화면에
     보이는 최근 40개가 아니라 **이 여행에서 나눈 내 대화 전부**가 지워집니다(AI 가 기억하는
     앞 대화도 같이). 숫자는 못 적습니다 — 화면은 40개까지만 받아서 몇 개인지 모릅니다. */
  if (b.dataset.armed !== '1'){
    arm(b, id ? '한 번 더 누르면 이 여행의 AI 대화를 모두 지워요'
              : '한 번 더 누르면 여행 없이 나눈 AI 대화를 모두 지워요');
    return;
  }
  let q = sb.from('chats').delete().eq('user_id', ctx.me().id);
  q = id ? q.eq('trip_id', id) : q.is('trip_id', null);
  b.disabled = true;                 /* 지우는 동안 두 번 안 가게(b799) */
  const r = await q.select('id');
  b.disabled = false;
  disarm(b);
  if (r.error) return fail(r.error, 'ai');
  await loadChats(id);
  /* 대화만 지우고 **제안 카드는 그대로 뒀습니다.** 화면에서 보면 지우기를
     눌렀는데 일정 목록이 안 없어지는 것이라 고장으로 보입니다.
     카드는 그 대화에 딸린 것이니 같이 걷습니다. 출처 줄도 마찬가지입니다. */
  $('cards').innerHTML = '';
  $('aisrc').classList.add('hide');
  /* null 로 두면 안 됩니다 — 다른 곳이 suggested.actions 를 그대로 읽습니다.
     처음 모양(빈 배열 둘)으로 되돌립니다. */
  clearSuggested();
  clearLastTake();
  toast(`${r.data?.length ?? 0}개를 지웠어요`);
});
