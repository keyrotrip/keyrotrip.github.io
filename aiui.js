/* ── AI 대화 화면의 부품들 ───────────────────────────────────────────
 * 답을 기다릴 때 뜨는 점 세 개, 사진 첨부, 답에 붙는 출처 표시.
 * **대화 자체(무엇을 묻고 무엇을 받는지)는 ai.js 와 app.js 가 합니다.**
 * 여기는 그 주변 화면 조각들입니다.
 *
 * ── app.js 에서 떼어낸 다섯 번째 조각입니다(b326) ───────────────────
 * AI 덩어리 전체(약 680줄)는 여행 상태(trip·plans)와 얽혀 있어 한 번에
 * 못 뗍니다. 그중 **얽힘이 적은 앞부분만** 가져왔습니다 — 밖에서 쓰는 것이
 * 셋(fitJpeg·drawSources·SHOT_MAX)뿐이고, 첨부한 사진 목록은 여기 안에만
 * 있습니다.
 * 큰 덩어리는 작은 조각부터 떼어내면 남은 것이 저절로 작아집니다.
 *
 * 층: dom.js 만 씁니다. 여행도 로그인한 사람도 모릅니다. */
import { $, esc, toast } from './dom.js?v=b817';
import { sb } from './db.js?v=b817';
import { fail } from './net.js?v=b817';

/* 대화를 저장할 때 로그인한 사람이 필요합니다. app.js 만 아는 값이라 받습니다 —
   로그인할 때마다 바뀌므로 값이 아니라 **함수**로 받습니다. */
let ctx = { me: () => null, aiToBottom: () => {}, loadChats: async () => {},
            drawCards: () => {} };
export function setAiUiCtx(o){ ctx = { ...ctx, ...o }; }

/* ── 답을 기다리는 동안 ──────────────────────────────────────────────
 * 보내기 단추만 흐려지는 것으로는 "지금 무슨 일이 벌어지고 있다"가 안 읽힙니다.
 * 20초쯤 걸리는데 화면이 멈춘 것처럼 보이면 다시 누르게 됩니다.
 * 대화가 이어지는 자리, 곧 **AI 가 말할 자리에** 점 세 개를 띄웁니다.
 * 저장하지 않습니다 — 답이 오면 loadChats 가 화면을 다시 그리면서 사라집니다. */
export function showTyping(){
  hideTyping();
  const box = $('chat');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'msg ai typing';
  el.id = 'typing';
  el.setAttribute('aria-label', '답변을 만드는 중');
  el.innerHTML = '<i></i><i></i><i></i>';
  box.appendChild(el);
  ctx.aiToBottom();
}
export function hideTyping(){ document.getElementById('typing')?.remove(); }

/* 여러 줄 입력칸. 쓴 만큼 늘어나야 자기가 뭘 쓰는지 보입니다.
   height 를 먼저 비워야 줄어들 때도 따라 줄어듭니다 — 안 그러면 한 번 커진
   채로 안 돌아옵니다.

   **b173 에서 이 칸을 contenteditable 로 바꿨다가 b174 에서 되돌렸습니다.**
   iOS 가 textarea 위에 붙이는 ∧ ∨ ✓ 막대를 없애려던 것이었는데, 재보니
   contenteditable 에도 똑같이 붙습니다 — 홈 화면 앱 vv.h 가 424 에서 1px 도
   안 움직였습니다. 그러면 placeholder·글자수·한글 조합을 손으로 흉내 낸
   코드만 남습니다. 브라우저가 이미 맞게 해주는 것을 다시 만들 이유가 없습니다.
   **막대는 없앨 수 없습니다. 덮는 쪽으로 가야 합니다.** */
export function growMsg(){
  const el = $('ai_msg');
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}
$('ai_msg').addEventListener('input', growMsg);

$('ai_msg').addEventListener('keydown', e => {
  /* 줄바꿈이 필요할 때가 있습니다. Enter 는 보내기, Shift+Enter 는 줄바꿈.
     한글 조합 중(isComposing)에 Enter 를 가로채면 마지막 글자가 잘려 나갑니다. */
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing){
    e.preventDefault(); $('ai_send').click();
  }
});

/* 빠른 질문(추천 문구 4개)은 b178 에서 걷어냈습니다. */

/* ── 사진 첨부 ──────────────────────────────────────────────────────
 * 간판·메뉴판·티켓을 찍어 물어보는 자리입니다. 글로 옮겨 적는 것보다 빠릅니다.
 * 그대로 보내면 4MB 짜리가 올라갑니다. 로밍에서 그건 안 됩니다.
 * 긴 쪽을 1024 로 줄이고 JPEG 로 다시 굽습니다 — 글자를 읽을 만큼은 남습니다.
 * 프로필 사진용 shrink 를 쓰지 않는 이유는 그건 정사각으로 잘라내기 때문입니다.
 * 메뉴판이 잘리면 물어볼 것이 사라집니다. */
/* 여러 장을 붙일 수 있습니다. 메뉴판이 두 장으로 나뉘어 있거나
   가게 앞과 안을 같이 보여줘야 할 때가 있습니다.
   대신 장수를 막습니다 — 한 번에 다 올리면 함수가 거절하고 요금도 그만큼 듭니다. */
export const SHOT_MAX = 4;
export let aiShots = [];                        /* [{mime, data(base64), url}] */

export function fitJpeg(file, max = 1024){
  return new Promise((ok, no) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width  = Math.round(img.width  * s);
      cv.height = Math.round(img.height * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      /* dataURL 은 "data:image/jpeg;base64,...." 입니다. 쉼표 뒤가 알맹이입니다. */
      const url = cv.toDataURL('image/jpeg', 0.82);
      ok({ mime:'image/jpeg', data:url.slice(url.indexOf(',') + 1), url });
    };
    img.onerror = () => no(new Error('사진을 읽지 못했어요.'));
    img.src = URL.createObjectURL(file);
  });
}

$('ai_cam').addEventListener('click', () => $('ai_file').click());
export function drawShot(){
  $('ai_shotwrap').classList.toggle('hide', !aiShots.length);
  $('ai_shotwrap').innerHTML = aiShots.map((s, i) =>
    `<span class="shot1"><img src="${s.url}" alt="">
       <button class="x" data-shotx="${i}" aria-label="빼기">×</button></span>`).join('') +
    (aiShots.length ? `<span class="shotn">${aiShots.length}/${SHOT_MAX}</span>` : '');
}
$('ai_shotwrap').addEventListener('click', e => {
  const b = e.target.closest('[data-shotx]'); if (!b) return;
  aiShots.splice(+b.dataset.shotx, 1);
  drawShot();
});
$('ai_file').addEventListener('change', async e => {
  const files = [...(e.target.files || [])];
  e.target.value = '';                   /* 같은 사진을 또 골라도 걸리게 */
  if (!files.length) return;
  $('aierr').classList.add('hide');
  for (const f of files){
    if (aiShots.length >= SHOT_MAX){ toast(`사진은 ${SHOT_MAX}장까지예요.`); break; }
    let s;
    try { s = await fitJpeg(f); } catch (err){ return fail(err, 'ai'); }
    /* 여기서도 너무 크면 함수가 거절합니다. 대략 1.4배로 부풀어 오릅니다. */
    if (s.data.length > 2_600_000){ toast('너무 큰 사진 한 장은 건너뛰었어요.'); continue; }
    aiShots.push(s);
  }
  drawShot();
});

/* ── 출처 ───────────────────────────────────────────────────────────
 * AI 가 무엇을 보고 답했는지 답니다. 인터넷 검색이 아니라 **이 앱의 자료** 중
 * 무엇을 근거로 삼았는지입니다 — 그건 우리가 확인할 수 있습니다.
 * "일반지식"이 붙었다면 우리가 확인해 준 것이 아무것도 없다는 뜻입니다. */
/* 넷을 더 답니다 — 서버가 AI 에게 일행 · 예약 · 준비물 · 내 별점을 같이
   넘기게 됐습니다(2026-08-10). **모르는 이름은 아래 filter 가 조용히 버리므로**
   서버만 고치고 여기를 안 고치면 근거 칩이 안 뜹니다. */
export const SRC_KO = { plans:'이 여행 일정', expenses:'지출 기록', legs:'여행 구간',
                 trip:'여행 정보', members:'일행', bookings:'예약',
                 packing:'준비물', ratings:'내가 매긴 별점', prefs:'내 취향',
                 placerates:'내가 매긴 장소 별점', candidates:'담아둔 곳',
                 general:'일반 지식 — 직접 확인이 필요해요' };
export function drawSources(list, web){
  const box = $('aisrc'); if (!box) return;
  const arr = (Array.isArray(list) ? list : []).filter(s => SRC_KO[s]);
  const links = Array.isArray(web) ? web.filter(w => w?.link) : [];
  box.classList.toggle('hide', !arr.length && !links.length);
  box.innerHTML =
    (arr.length ? '<b>근거</b>' + arr.map(s =>
       `<span class="srcchip${s === 'general' ? ' warn' : ''}">${esc(SRC_KO[s])}</span>`).join('')
     : '') +
    /* 검색해서 답한 경우에는 어디서 읽었는지 **링크째** 답니다.
       눌러서 직접 볼 수 있어야 "검색했다"는 말이 확인 가능한 말이 됩니다.
       영업시간·가격은 틀렸을 때 여행이 어긋나므로 특히 그렇습니다. */
    (links.length
      ? `<div class="weblinks"><b>검색해서 답했어요</b>` +
        links.map((w, i) => `<a href="${esc(w.link)}" target="_blank" rel="noopener">
             ${i + 1}. ${esc(w.title || w.link)}</a>`).join('') + '</div>'
      : '');
}

/* 예시를 누르면 **바로 보냅니다.** 입력칸에 넣어만 주면 한 번 더 눌러야 하고,
   그러면 예시가 "고르는 것"이 아니라 "지우고 다시 쓰는 것"이 됩니다.
   빈 화면에서만 보이므로 대화가 시작되면 저절로 사라집니다. */
$('chat').addEventListener('click', e => {
  const b = e.target.closest('[data-ask]'); if (!b) return;
  $('ai_msg').value = b.dataset.ask;
  $('ai_send').click();
});

$('ai_send').addEventListener('click', async () => {
  const shots = aiShots.slice();
  /* 사진만 보내도 됩니다. "이거 뭐야?"를 매번 타이핑하게 할 이유가 없습니다. */
  const msg = $('ai_msg').value.trim() ||
              (shots.length ? '이 사진에 대해 알려줘.' : '');
  const tripId = $('ai_trip').value;
  $('aierr').classList.add('hide');
  if (!msg) return;
  $('ai_msg').value = ''; growMsg();   /* 여러 줄로 늘어나 있던 것을 한 줄로 되돌립니다 */
  $('cards').innerHTML = '';
  aiShots = []; drawShot();
  $('aisrc').classList.add('hide');
  /* 글자를 갈아끼우면 안에 있는 비행기 그림이 사라집니다.
     흐리게만 하고 그림은 그대로 둡니다. */
  $('ai_send').disabled = true; $('ai_send').classList.add('sending');

  /* 물어본 것을 먼저 남깁니다. 답이 실패해도 무엇을 물었는지는 보여야 합니다.
     여행을 안 골랐으면 trip_id 를 비워 둡니다 — 그것도 남습니다 (029).
     사진 자체는 저장하지 않습니다 — 대화 기록이 금방 수십 MB 가 됩니다. */
  await sb.from('chats').insert({ trip_id: tripId || null, user_id: ctx.me().id,
                                  role: 'user',
                                  content: (shots.length ? `[사진 ${shots.length}장] ` : '') + msg });
  await ctx.loadChats(tripId);
  showTyping();          /* 답이 올 자리에 점 세 개. 화면이 멈춘 게 아니라는 표시 */

  /* 사진을 붙이면 점 세 개가 **영원히** 돌았습니다. 요청이 끝나지도, 실패하지도
     않으면 화면은 알 길이 없습니다 — 원인이 무엇이든 그 상태로 두면 안 됩니다.
     기다릴 시간을 정해두고, 넘으면 그렇다고 말합니다.
     사진은 올려 보내는 것 자체가 오래 걸려 넉넉히 줍니다. */
  const wait = shots.length ? 150000 : 90000;
  const { data, error } = await Promise.race([
    sb.functions.invoke('chat',
      { body: { trip_id: tripId || null, message: msg,
                /* 한 장만 보낼 때도 images 로 보냅니다. 서버가 옛 image 도 받아주지만
                   보내는 쪽이 두 갈래면 언젠가 한쪽만 고칩니다. */
                images: shots.map(s => ({ mime: s.mime, data: s.data })) } }),
    new Promise(r => setTimeout(() => r({ data:null, error:{ message:
      shots.length
        ? `사진을 읽는 데 ${Math.round(wait / 1000)}초를 넘겼어요. ` +
          '사진을 한 장으로 줄이거나 다시 찍어서 올려보세요.'
        : `답을 기다린 시간이 ${Math.round(wait / 1000)}초를 넘겼어요. 다시 물어봐주세요.`
    } }), wait)),
  ]);

  $('ai_send').disabled = false; $('ai_send').classList.remove('sending');
  hideTyping();          /* 실패해도 반드시 걷습니다. 남으면 영영 생각하는 척합니다 */

  if (error){
    /* 함수가 오류를 내면 본문에 이유가 들어 있습니다. 그대로 보여줍니다. */
    let why = error.message;
    try { why = (await error.context?.json())?.error || why; } catch {}
    /* 예전에는 'Failed to send'(요청이 도중에 끊김)까지 "함수가 안 올라갔다"로
       묶어놨습니다. 둘은 전혀 다릅니다 — 하나는 배포 문제고 하나는 서버가
       일하다 죽은 것입니다. 같은 문구를 내놓으니 엉뚱한 데를 보게 됩니다. */
    return fail(
      /not found|404/i.test(why)
        ? 'AI 기능이 아직 준비되지 않았어요. 만든 사람에게 알려주세요.'
      : /Failed to send|Load failed|NetworkError/i.test(why)
        ? '답을 만들다 끊겼어요. 글이 너무 길거나 링크가 무거우면 그럴 수 있어요. ' +
          '링크를 하나만 넣거나 글을 줄여서 다시 해보세요.'
      : why, 'ai');
  }
  if (data?.error) return fail(data.error, 'ai');

  await sb.from('chats').insert({ trip_id: tripId || null, user_id: ctx.me().id,
                                  role: 'model', content: data.reply });
  await ctx.loadChats(tripId);
  drawSources(data.sources, data.web);
  ctx.drawCards(data);
  /* drawChats 안에서 한 번 내리지만 그때는 출처와 제안 카드가 아직 없습니다.
     다 그리고 나서 한 번 더 내려야 새 답변의 끝이 보입니다. */
  ctx.aiToBottom();
});

