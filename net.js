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
import { $, toast, esc } from './dom.js?v=b888';
import { sb } from './db.js?v=b888';

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
  실패 = [];         /* 저장 못 한 것 목록도 앞사람 것입니다(2026-10-16) */
  try {
    Object.keys(localStorage).filter(k => k.startsWith('t2:'))
      .forEach(k => localStorage.removeItem(k));
  } catch {}
}
let queue = [];
try { queue = JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch { queue = []; }
const qsave = () => { try { localStorage.setItem(QKEY, JSON.stringify(queue)); } catch {} };

/* ── 저장 못 한 것 (2026-10-16) ─────────────────────────────────────────
 * ⚠⚠ **전에는 대기줄에서 «네트워크 아닌 이유»로 실패한 것을 그냥 지웠습니다.** ⚠⚠
 *   토스트 한 줄(「그 내용만 다시 넣어주세요」)만 남고, 무엇이 안 됐는지는 볼 길이
 *   없었습니다 — 비행기모드에서 넣은 지출 셋 중 하나가 조용히 사라진 셈입니다.
 * → 버리지 않고 여기 모아 둡니다. 오프라인 띠에 「저장 못 한 것 N건」이 뜨고,
 *   누르면 무엇이 왜 안 됐는지 보고 «다시 보내기»·«버리기»를 고릅니다.
 * ⚠ 기기에만 있습니다(대기줄과 같은 자리). 로그아웃하면 같이 지웁니다(forgetLocal). */
const FKEY = 't2:queue:failed';
let 실패 = [];
try { 실패 = JSON.parse(localStorage.getItem(FKEY) || '[]'); } catch { 실패 = []; }
const fsave = () => { try { localStorage.setItem(FKEY, JSON.stringify(실패)); } catch {} };
const 실패담기 = (job, why) => {
  실패.push({ job, why: String(why || '').slice(0, 300), at: new Date().toISOString() });
  fsave();
};

/* 오프라인에서 못 쓰는 자리에 "불러오는 중…"을 남겨두면 하루 종일 기다리게 됩니다.
   기다려도 안 온다는 것을 그 자리에 그대로 적습니다. */
const OFFNOTE = '<div class="empty">연결이 없어 지금은 볼 수 없어요.<br>' +
                '연결되면 바로 나옵니다.</div>';
/* 화면 조각 하나를 "지금은 못 봅니다"로 바꿉니다. 이미 뭔가 그려져 있으면 두고요 —
   받아둔 내용이 있는데 안내로 덮어버리면 오히려 손해입니다. */
export function offNote(id){
  const el = $(id); if (!el) return;
  /* (`.pcard` 를 뺐습니다(b857) — 옛 성향 카드 이름표라 이제 아무 데서도 안 만듭니다. tools/stale.pl 이 잡음.) */
  if (el.querySelector('.rrow, .plan, .row, .ev, .trip')) return;
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

/* ── 다시 보내도 두 번 안 들어가게(2026-10-16) ──────────────────────────
 * ⚠ **추가(insert)는 응답만 잃어도 다시 보내면 줄이 둘이 됩니다.** 서버에는 들어갔는데
 *   연결이 끊겨 답을 못 받으면(터널·엘리베이터) 「네트워크 실패」로 보고 대기줄에 쌓고,
 *   연결이 돌아오면 같은 것을 또 넣었습니다.
 * → 처음 보낼 때 **기기에서 id 를 정해** 같이 보냅니다. 다시 보내면 같은 키라 서버가
 *   `23505`(이미 있음)로 막고, 아래 `판정` 이 그 줄이 정말 있는지 확인해 «저장됨»으로 봅니다.
 * ⚠ `write()` 로 들어오는 표(plans·expenses)는 둘 다 `id uuid` 기본키라 기기가 정한 id 를
 *   받습니다(db/001). 다른 표를 더할 때 그 표의 id 꼴부터 보십시오.
 * ⚠ 부르는 쪽 객체를 고치지 않으려고 복사해서 붙입니다. 이미 id 가 있으면 그대로 둡니다. */
function 준비(job){
  if (job.action !== 'insert' || !job.row || job.row.id) return job;
  const id = globalThis.crypto?.randomUUID?.();
  return id ? { ...job, row: { id, ...job.row } } : job;
}

/* ── 보낸 결과를 판정하는 곳은 **여기 하나**입니다(2026-10-16) ──────────────
 * ⚠⚠ **전에는 둘이 서로 다른 기준을 썼습니다.** ⚠⚠ `write()` 는 «오류 없고 1건 이상»을
 *   성공으로 봤는데, `flushQueue()` 는 «오류만 없으면» 성공으로 봤습니다. 그래서
 *   권한(RLS)에 걸려 **0건 반영된** 대기줄 항목은 성공으로 치고 버렸습니다 —
 *   화면에는 저장된 것처럼 남는데 서버에는 없는 상태가 됩니다.
 * 돌려주는 것: {ok:true, id} · {ok:false, norow:true} · {ok:false, error} */
async function 판정(job, r){
  if (r.error){
    /* 같은 추가를 다시 보낸 경우 — 첫 시도가 사실은 들어갔는데 답만 못 받은 것입니다. */
    if (job.action === 'insert' && r.error.code === '23505' && job.row?.id){
      const 있나 = await sb.from(job.table).select('id').eq('id', job.row.id).maybeSingle();
      if (있나.error) return { ok:false, error:있나.error };
      if (있나.data?.id) return { ok:true, id:있나.data.id };
    }
    return { ok:false, error:r.error };
  }
  if (!r.data?.length) return { ok:false, norow:true };
  return { ok:true, id:r.data[0].id };
}
/* 0건일 때 사람에게 할 말 — 동작마다 다릅니다. */
const 영건말 = job => job.action === 'delete' ? NOROW.del
                   : job.action === 'update' ? NOROW.edit : NOROW.save;

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
  job = 준비(job);                    /* 추가면 기기 id 를 붙입니다(위 머리말) */
  try {
    const v = await 판정(job, await send(job));
    if (v.ok) return { ok:true, id:v.id };
    if (v.norow) return { ok:false, why: 영건말(job) };
    throw v.error;
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
  let 새실패 = 0;
  while (queue.length){
    const job = 준비(queue[0]);     /* 예전 판이 쌓아 둔 추가에도 id 를 붙입니다 */
    queue[0] = job; qsave();        /* 붙인 id 를 먼저 적어 둡니다 — 여기서 끊겨도 다음에 같은 id 로 */
    let v;
    try { v = await 판정(job, await send(job)); }
    catch (e){ v = { ok:false, error:e }; }
    /* 또 끊겼습니다. 버리지 않고 다음 기회에 이어서 — 판정이 돌려준 오류도 같이 봅니다. */
    if (!v.ok && v.error && isOffline(v.error)) break;
    queue.shift();
    /* ⚠ 0건도 실패입니다(write 와 같은 기준). 버리지 않고 «저장 못 한 것»으로 옮깁니다.
       표 이름·영어 원문은 기록으로 보내고(logErr), 목록에는 사람 말을 둡니다. */
    if (!v.ok){
      새실패++;
      실패담기(job, v.norow ? 영건말(job) : human(v.error));
      logErr?.(`큐 저장 실패: ${job.action} ${job.table} · ${v.norow ? '0건' : (v.error?.message || v.error)}`, 'queue');
    }
    qsave();
  }
  flushing = false;
  drawOffbar();
  if (새실패) toast(`저장 못 한 것이 ${새실패}건 있어요. 위 띠를 눌러 확인해 주세요.`);
  /* 큐가 다 나갔으면 서버 쪽 진짜 값으로 화면을 맞춥니다.
     무엇을 다시 받아올지는 app.js 가 setOnDrained 로 넣어줍니다. */
  if (!queue.length) await onDrained?.();
}

/* ── 저장 못 한 것 보기·복구 (2026-10-16) ─────────────────────────────── */
const 표이름 = { plans:'일정', expenses:'지출' };
const 동작이름 = { insert:'추가', update:'수정', delete:'삭제' };
const 무엇 = j => `${표이름[j.table] || j.table} ${동작이름[j.action] || j.action}`
                + (j.row?.title ? ` · ${j.row.title}` : '');
export const failedSaves = () => 실패.map(f => ({ 무엇: 무엇(f.job), 이유: f.why, 언제: f.at }));

/* 전부 다시 대기줄 «앞»으로 넣고 흘려보냅니다. 앞인 까닭: 실패한 것이 뒤에 쌓인 것보다
   먼저 들어온 것이라 순서를 지켜야 합니다(같은 일정의 추가 → 수정 같은 짝). */
export async function retryFailed(){
  if (!실패.length) return 0;
  const n = 실패.length;
  queue.unshift(...실패.map(f => f.job));
  실패 = []; fsave(); qsave();
  await flushQueue();
  return n;
}
export function dropFailed(){ 실패 = []; fsave(); drawOffbar(); }

/* 목록 판 — 띠를 누르면 뜹니다. 성향 바뀜 알림(b854)과 같은 틀(.pshpop/.pshcard)입니다.
   ⚠ 뒤로가기 기록을 남기지 않습니다(덮는 판이 아니라 잠깐 보는 상자). 화면이 바뀌면 닫습니다. */
function 실패보기(){
  if (!실패.length) return;
  document.getElementById('failpop')?.remove();
  const 판 = document.createElement('div');
  판.id = 'failpop'; 판.className = 'pshpop';
  판.innerHTML = `<div class="pshcard" role="dialog" aria-label="저장 못 한 것">
    <h3 class="pshtitle">저장 못 한 것 ${실패.length}건</h3>
    <ul class="failist">${실패.map(f => `<li><b>${esc(무엇(f.job))}</b><span>${esc(f.why)}</span></li>`).join('')}</ul>
    <div class="pshbtns">
      <button type="button" class="primary" data-fail="retry">다시 보내기</button>
      <button type="button" data-fail="drop">버리기</button>
      <button type="button" class="pshx" data-fail="close">닫기</button>
    </div></div>`;
  const 닫기 = () => 판.remove();
  판.addEventListener('click', async e => {
    if (e.target === 판) return 닫기();
    const 무 = e.target.closest('[data-fail]')?.dataset.fail; if (!무) return;
    if (무 === 'close') return 닫기();
    if (무 === 'drop'){
      /* 되돌릴 수 없는 일이라 한 번 묻습니다. */
      if (!confirm('버리면 이 내용은 다시 볼 수 없어요. 버릴까요?')) return;
      dropFailed(); 닫기(); return toast('버렸어요');
    }
    if (무 === 'retry'){
      닫기();
      if (netIsDown()) return toast('연결이 돌아오면 다시 보내 볼게요');
      await retryFailed();
      if (!실패.length) toast('다시 보냈어요');
    }
  });
  document.body.appendChild(판);
}
if (typeof window !== 'undefined')
  addEventListener('popstate', () => document.getElementById('failpop')?.remove());

export function drawOffbar(){
  const bar = $('offbar'); if (!bar) return;
  const off = netIsDown(), n = queue.length, f = 실패.length;
  bar.classList.toggle('hide', !off && !n && !f);
  let 글 = off
    ? (n ? `오프라인 · 저장할 것 ${n}건을 들고 있어요` : '오프라인 · 지금 보고 있는 것은 마지막으로 받아둔 내용이에요')
    : (n ? `보내는 중… 남은 것 ${n}건` : '');
  /* 저장 못 한 것이 있으면 띠가 그 목록으로 가는 단추가 됩니다(2026-10-16). */
  if (f) 글 = (글 ? 글 + ' · ' : '') + `저장 못 한 것 ${f}건 · 눌러서 보기`;
  bar.textContent = 글;
  bar.classList.toggle('tap', !!f);
  bar.onclick = f ? 실패보기 : null;
}
addEventListener('online',  () => { drawOffbar(); flushQueue(); });
addEventListener('offline', drawOffbar);

/* 개발용. 콘솔에서 큐 상태를 볼 수 있습니다 — 비행기모드로 시험할 때
   화면의 띠만 보고는 안에 뭐가 쌓였는지 알 수가 없습니다. */
if (typeof window !== 'undefined') window.__queue = () => ({
  쌓인것: queue.length, 목록: queue.map(j => `${j.action} ${j.table}`),
  저장못함: 실패.length,
  보내는중: flushing, 연결끊김: netIsDown(),
});
