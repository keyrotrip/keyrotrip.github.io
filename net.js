/* ── 연결이 없을 때 ────────────────────────────────────────────────────
 * 여행지에서 데이터가 안 터지면 지금까지는 아무것도 못 했습니다.
 * 이 층이 그 사이에 들어갑니다. **이 앱에서 제일 값진 구조입니다** —
 * 고칠 때는 반드시 실기기 비행기모드로 확인하세요.
 *
 *   1. 저장을 보내본다
 *   2. 네트워크 때문에 실패하면 큐에 쌓고 성공한 척한다 (화면은 이미 바뀐 뒤)
 *   3. 연결이 돌아오면 쌓인 것을 순서대로 흘려보낸다
 *
 * 성공한 척해도 되는 것은 **네트워크 실패뿐**입니다.
 * 권한(RLS)이나 형식 오류는 다시 보내도 똑같이 실패하므로 그대로 알려줍니다 —
 * 여기서 삼키면 사용자는 저장된 줄 알고 여행을 갑니다.
 *
 * **fail 이 왜 여기 있나**: fail 은 오류 상자를 띄우는 함수라 화면 쪽처럼
 * 보이지만, 하는 일의 절반이 "이게 연결 문제인가"를 가려서 빨간 오류 대신
 * 오프라인 안내를 내는 것입니다(isOffline · drawOffbar 를 부릅니다).
 * dom.js 에 두면 dom → net → dom 순환이 생깁니다. 여기가 맞습니다.
 *
 * 밖에서 가져오는 것은 dom.js 와 db.js 뿐입니다. 둘 다 잎이라 순환이 없습니다.
 */
import { $, toast } from './dom.js?v=b830';
import { sb } from './db.js?v=b830';

/* 큐가 다 나간 뒤에 화면을 서버 값으로 맞추는 일은 app.js 가 압니다.
   여기서 trip 이나 loadPlans 를 직접 부르면 net → app 으로 거꾸로 기대게 되어
   순환이 납니다. 무엇을 할지는 app.js 가 넣어줍니다. */
let onDrained = null;
export const setOnDrained = fn => { onDrained = fn; };

/* 오류 원문을 어디에 남길지도 app.js 가 압니다(logError 는 로그인 상태와
   client_errors 표를 봅니다). 같은 이유로 넣어받습니다. */
let logErr = null;
export const setErrLogger = fn => { logErr = fn; };

/* ── 서버 말을 사람 말로 ────────────────────────────────────────────────
 * 전에는 서버가 준 것을 그대로 띄웠습니다. 그러면 화면에
 *   `new row violates row-level security policy for table "plans"`
 * 같은 영어가 뜨고, 그마저 없으면 JSON 이 통째로 떴습니다.
 * **사용자가 할 수 있는 일이 하나도 없는 글자입니다.**
 *
 * 여기서 옮기고, 원문은 화면 대신 기록으로 보냅니다 — 원문이 필요한 것은
 * 사용자가 아니라 고치는 사람입니다.
 *
 * **문자열로 넘어온 것은 우리가 쓴 한국어이므로 그대로 둡니다.** */
const SORRY = '잘 안 됐어요. 잠시 뒤 다시 해보시고, ' +
              '계속 안 되면 프로필 → 버그 신고로 알려주세요.';

function human(e){
  /* **P0001 은 우리가 쓴 말입니다.** DB 함수의 `raise exception` 이 내는 코드라
     본문이 이미 한국어입니다. 그대로 보여줍니다.
     전에는 이것도 아래 정규식에 안 걸려 SORRY 로 덮였습니다 —
     초대가 **만료됐는지 · 없는 코드인지 · 다 썼는지**를 사용자가 알 수가 없었고,
     SORRY 의 "잠시 뒤 다시 해보세요"는 **만료된 초대에는 틀린 안내**입니다.
     기다려도 안 되는 것을 기다리라고 하고 있었습니다. */
  if (e?.code === 'P0001' && e?.message) return String(e.message);

  const s = String(e?.code || '') + ' ' + String(e?.message || e?.error_description || e?.hint || '');
  if (/row-level security|42501|permission denied/i.test(s))
    return '권한이 없어요. 이 여행을 고칠 수 있는지 확인해주세요.';
  if (/JWT|PGRST301|token is expired|not authenticated|invalid claim/i.test(s))
    return '로그인이 풀렸어요. 다시 로그인해주세요.';
  if (/duplicate key|23505|already (exists|registered)/i.test(s))
    return '이미 있어요.';
  if (/23503|foreign key/i.test(s))
    return '이어져 있는 것이 있어서 지울 수 없어요.';
  if (/22P02|invalid input syntax|invalid text representation/i.test(s))
    return '적어주신 값을 알아보지 못했어요. 다시 확인해주세요.';
  if (/too large|413|exceeded the maximum/i.test(s))
    return '파일이 너무 커요. 더 작은 것으로 올려주세요.';
  if (/rate limit|429|too many requests/i.test(s))
    return '너무 자주 눌렀어요. 잠시 뒤에 다시 해주세요.';
  return SORRY;
}

/* 서버가 **0줄**을 처리했다는 것은 거의 항상 권한이 없다는 뜻입니다 —
   RLS 가 막으면 Postgres 는 오류를 내지 않고 조용히 0건을 돌려줍니다.
   전에는 화면에 '(0건)' 이라고 적었는데, 그건 DB 가 센 줄 수라 사용자에게는
   아무 뜻이 없습니다. 무엇을 확인해야 하는지 적습니다. */
export const NOROW = {
  save: '저장하지 못했어요. 고칠 권한이 있는지 확인해주세요.',
  del:  '지우지 못했어요. 지울 권한이 있는지 확인해주세요.',
  edit: '바꾸지 못했어요. 고칠 권한이 있는지 확인해주세요.',
};

export function fail(e, where){
  /* 오류 상자를 **손으로 적은 목록**에서 찾고 있었습니다. 목록에 없으면
     숨겨진 #err 로 떨어지는데 그 카드는 안 열리므로 **오류가 아무 데도
     안 보였습니다.** 조용한 실패라 사용자는 저장된 줄 알고 넘어갑니다.
     실제로 'imp'(불러오기)와 's'(조절)가 목록에서 빠져 있었습니다.

     목록에 있던 24개가 전부 `<이름>err` 규칙 그대로였습니다. 목록은 중복이고
     새 화면을 만들 때마다 빠뜨리게 만드는 함정이라 규칙으로 바꿉니다.
     그래도 못 찾으면 #err 로 갑니다 — 그때는 카드도 함께 엽니다. */
  const box = (where && $(where + 'err')) || $('err');
  if (!where || box === $('err')) $('errcard').classList.remove('hide');
  box.classList.remove('hide');
  /* 연결이 끊겨서 못 받아온 것을 빨간 오류로 띄우면 고장으로 보입니다.
     비행기모드에서 화면마다 빨간 상자가 떴습니다. 그건 오류가 아니라 상태입니다.
     사용자가 잘못 적어서 나는 오류(문자열로 넘어옵니다)는 그대로 둡니다 —
     그건 연결과 상관없이 고쳐야 하는 것입니다. */
  if (typeof e !== 'string' && isOffline(e)){
    box.textContent = '지금은 연결이 없어요. 받아둔 내용만 보여드려요.';
    drawOffbar();
    return;
  }
  /* 문자열은 우리가 쓴 한국어입니다. 그대로 보여줍니다. */
  if (typeof e === 'string'){ box.textContent = e; return; }

  /* 서버가 준 것은 영어이거나 JSON 입니다. 옮겨서 보여주고 원문은 기록으로. */
  box.textContent = human(e);
  try {
    logErr?.(`[${where || '-'}] ${e?.code || ''} ${e?.message || JSON.stringify(e)}`.slice(0, 400),
             'fail');
  } catch {}
}

/* 큐는 localStorage 에 둡니다. 앱을 껐다 켜도 남아야 합니다. */
const QKEY = 't2:queue';

/* ── 이 기기에 남은 내 자료를 지웁니다(b716, b698 점검 아홉째) ────────
 * ⚠⚠ **로그아웃이 이걸 «안» 했습니다.** 탈퇴(account.js)는 하고 있었는데
 *   로그아웃은 `signOut()` 하고 새로 고칠 뿐이라, **못 보낸 저장 대기줄
 *   (`t2:queue`)과 받아둔 자료가 그대로 남아 다음 사람에게 넘어갔습니다.**
 *   대기줄은 더 나쁩니다 — 다음 사람이 로그인하면 그 줄이 흘러 나갑니다.
 * ⚠ 「내 것」만 지우는 게 아니라 `t2:` 를 통째로 지웁니다. 남는 것이
 *   무엇인지 세어 가며 지우면 새 열쇠를 만들 때마다 빠뜨립니다 —
 *   지구본/평면 같은 취향 하나 잃는 값이 훨씬 쌉니다.
 * ⚠ 여기에 두는 이유는 대기줄의 «주인»이 이 파일이기 때문입니다.
 *   부르는 곳은 둘(로그아웃·탈퇴)이고, 규칙은 한 곳에 있어야 합니다. */
export function forgetLocal(){
  queue = [];
  try {
    Object.keys(localStorage).filter(k => k.startsWith('t2:'))
      .forEach(k => localStorage.removeItem(k));
  } catch {}
}
let queue = [];
try { queue = JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch { queue = []; }
const qsave = () => { try { localStorage.setItem(QKEY, JSON.stringify(queue)); } catch {} };

/* 오프라인에서 못 쓰는 자리에 "불러오는 중…"을 남겨두면 하루 종일 기다리게 됩니다.
   기다려도 안 온다는 것을 그 자리에 그대로 적습니다. */
const OFFNOTE = '<div class="empty">연결이 없어 지금은 볼 수 없어요.<br>' +
                '연결되면 바로 나옵니다.</div>';
/* 화면 조각 하나를 "지금은 못 봅니다"로 바꿉니다. 이미 뭔가 그려져 있으면 두고요 —
   받아둔 내용이 있는데 안내로 덮어버리면 오히려 손해입니다. */
export function offNote(id){
  const el = $(id); if (!el) return;
  if (el.querySelector('.rrow, .plan, .row, .ev, .trip, .pcard')) return;
  el.innerHTML = OFFNOTE;
}

/* ── 마지막으로 받아둔 것 ─────────────────────────────────────────────
 * 비행기모드에서 앱은 열렸는데 화면이 "불러오는 중…"에서 멈춰 있었습니다.
 * 껍데기(html·js)만 캐시하고 **내용**은 아무것도 안 들고 있었기 때문입니다.
 * 받아올 때마다 여기 적어두고, 못 받아오면 이걸 씁니다.
 * 오래된 것을 보고 있다는 사실은 위쪽 띠(offbar)로 알립니다. */
export const cacheGet = k => { try { return JSON.parse(localStorage.getItem('t2:cache:' + k) || 'null'); }
                               catch { return null; } };
export const cacheSet = (k, v) => { try { localStorage.setItem('t2:cache:' + k, JSON.stringify(v)); }
                                    catch {} };   /* 용량이 차면 조용히 넘어갑니다 */

/* ── 기다리다 멈추지 않게 ────────────────────────────────────────────
 * 비행기모드에서 Supabase 요청이 **거절되지도 않고 그냥 매달립니다.**
 * 제 코드는 "오류가 나면 캐시를 쓴다"였는데 오류가 안 나니 영원히 기다렸고,
 * 화면이 "불러오는 중…"에 멈춰 있었습니다. 부팅이 14초 걸린 것도 같은 이유입니다.
 *
 * 그래서 시간을 끊습니다. 시간이 지나면 오류인 척 돌려주고,
 * 아래 isOffline 이 그걸 연결 문제로 알아봐서 캐시로 넘어갑니다.
  * 어차피 안 올 것을 4초씩 기다릴 이유가 없습니다. */
/* **브라우저 말을 믿으면 안 됩니다.**
   비행기모드인데 navigator.onLine 이 true 를 돌려줍니다 (아이폰 홈 화면 앱에서 흔합니다).
   그래서 "오프라인이면 건너뛰기"가 하나도 안 걸렸고, 오프라인 띠도 안 떴습니다.
   대신 **실제로 실패했는지**를 기억합니다. 한 번 안 오면 잠시 아무것도 안 물어봅니다 —
   화면 하나에 요청이 대여섯 개라 그게 다 더해지면 눈에 띄게 굼떠집니다. */
let netDownUntil = 0;
const NET_REST = 20000;                 /* 한 번 실패하면 20초간 쉽니다 */
export const netIsDown = () => !navigator.onLine || Date.now() < netDownUntil;

export function netTimeout(p, ms){
  /* 쉬는 중이면 요청 자체를 안 만듭니다.
     p 를 건드리지 않으므로 나가지 않습니다 — supabase 질의는 await 할 때 나갑니다. */
  if (netIsDown())
    return Promise.resolve({ data:null, error:{ message:'offline · 연결이 없습니다' } });
  /* 처음 한 번은 재봐야 압니다. 그 한 번만 짧게 기다립니다. */
  const wait = ms ?? 2500;
  return Promise.race([
    Promise.resolve(p).catch(error => ({ data:null, error })),
    new Promise(r => setTimeout(
      () => r({ data:null, error:{ message:'timeout · 응답이 없습니다' } }), wait)),
  ]).then(r => {
    if (r?.error && isOffline(r.error)){
      netDownUntil = Date.now() + NET_REST;
      drawOffbar();                      /* 이제야 오프라인인 걸 알았으니 띠를 띄웁니다 */
    } else if (r && !r.error) {
      netDownUntil = 0;                  /* 하나라도 오면 다시 정상으로 봅니다 */
    }
    return r;
  });
}

/* 네트워크가 끊겨서 실패한 것인지 가려냅니다.
   supabase-js 는 연결이 안 되면 fetch 의 TypeError 를 그대로 던집니다.
   위 netTimeout 이 만들어 낸 'timeout' 도 같은 것으로 봅니다. */
export function isOffline(err){
  if (netIsDown()) return true;
  const m = String(err?.message || err || '');
  return /Failed to fetch|NetworkError|Load failed|network|timeout|ECONN/i.test(m);
}

/* 저장 한 건. table·action·payload 만 남기면 나중에 그대로 재생할 수 있습니다. */
async function send(job){
  const q = sb.from(job.table);
  if (job.action === 'insert') return await q.insert(job.row).select('id');
  if (job.action === 'update') return await q.update(job.row).eq('id', job.id).select('id');
  if (job.action === 'delete')
    return await q.update({ deleted_at: new Date().toISOString() })
                  .eq('id', job.id).select('id');
  throw new Error('모르는 동작: ' + job.action);
}

/* 화면에서 부르는 쪽. 성공하면 {ok:true}, 큐에 쌓였으면 {ok:true, queued:true}. */
/* 점검 모드. 켜져 있으면 **쓰기를 아예 안 보냅니다** — SQL 을 돌리는
   동안 들어온 저장은 어긋난 표에 앉습니다. 큐에도 안 쌓습니다: 나중에
   흘려보내면 그것도 점검 중에 들어간 것과 같아집니다.
   여기 한 곳에서 막습니다 — 부르는 곳이 서른 군데라 거기서 막으면 샙니다. */
let readOnly = false;
export function setReadOnly(on){ readOnly = !!on; }

export async function write(job){
  if (readOnly) return { ok:false, why:'지금은 점검 중이라 저장할 수 없어요. 잠시 뒤 다시 해주세요.' };
  try {
    const r = await send(job);
    if (r.error) throw r.error;
    if (!r.data?.length) return { ok:false, why: NOROW.save };
    return { ok:true, id:r.data[0].id };
  } catch (e){
    if (!isOffline(e)) return { ok:false, why:e };
    queue.push(job); qsave(); drawOffbar();
    return { ok:true, queued:true };
  }
}

let flushing = false;
export async function flushQueue(){
  if (flushing || !queue.length || netIsDown()) return;
  flushing = true;
  drawOffbar();
  while (queue.length){
    const job = queue[0];
    try {
      const r = await send(job);
      if (r.error) throw r.error;
      queue.shift();                       /* 보냈으면 뺍니다 */
    } catch (e){
      if (isOffline(e)) break;             /* 또 끊겼습니다. 다음 기회에 이어서 */
      /* 네트워크가 아닌 이유로 실패한 것은 다시 보내도 같습니다.
         무한히 붙잡고 있으면 뒤에 쌓인 것까지 못 나갑니다. 버리고 알립니다. */
      queue.shift();
      /* 표 이름(trip_members…)과 영어 오류를 그대로 띄우고 있었습니다.
         사용자가 할 수 있는 일이 없는 글자라 기록으로 보냅니다. */
      logErr?.(`큐 저장 실패: ${job.action} ${job.table} · ${e?.message || e}`, 'queue');
      toast('저장 하나가 안 됐어요. 그 내용만 다시 넣어주세요.');
    }
    qsave();
  }
  flushing = false;
  drawOffbar();
  /* 큐가 다 나갔으면 서버 쪽 진짜 값으로 화면을 맞춥니다.
     무엇을 다시 받아올지는 app.js 가 setOnDrained 로 넣어줍니다. */
  if (!queue.length) await onDrained?.();
}

export function drawOffbar(){
  const bar = $('offbar'); if (!bar) return;
  const off = netIsDown(), n = queue.length;
  bar.classList.toggle('hide', !off && !n);
  bar.textContent = off
    ? (n ? `오프라인 · 저장할 것 ${n}건을 들고 있어요` : '오프라인 · 지금 보고 있는 것은 마지막으로 받아둔 내용이에요')
    : (n ? `보내는 중… 남은 것 ${n}건` : '');
}
addEventListener('online',  () => { drawOffbar(); flushQueue(); });
addEventListener('offline', drawOffbar);

/* 개발용. 콘솔에서 큐 상태를 볼 수 있습니다 — 비행기모드로 시험할 때
   화면의 띠만 보고는 안에 뭐가 쌓였는지 알 수가 없습니다. */
if (typeof window !== 'undefined') window.__queue = () => ({
  쌓인것: queue.length, 목록: queue.map(j => `${j.action} ${j.table}`),
  보내는중: flushing, 연결끊김: netIsDown(),
});
