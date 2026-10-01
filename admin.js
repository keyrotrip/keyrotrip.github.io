/* ── 관리자 화면 ───────────────────────────────────────────────────────
 * 대시보드 · 조절. 관리자만 보는 화면 전부입니다.
 *
 * ('바뀐 것' 변경 이력은 b386 에서 걷었습니다 — 아래 그 자리에 사연.)
 *
 * **여기는 앱 상태를 하나도 안 봅니다.** trip · plans · me · legs 어느 것도
 * 읽지 않고, 필요한 숫자는 전부 서버 함수(admin_stats · admin_settings)에서
 * 받아옵니다. 그래서 통째로 떼어낼 수 있었습니다 — 옮기기 전에 실제로
 * 세어보고 확인했습니다.
 *
 * 화면을 뜯어도 남의 자료는 안 나옵니다. 서버 쪽 함수가 is_admin() 을
 * 확인하므로 여기서 막는 것은 그저 안 보여주는 것뿐입니다.
 */
import { $, esc, toast, copyText, toTop, coverDeck, emptyDo } from './dom.js?v=b820';
import { sb } from './db.js?v=b820';
import { fail, netTimeout } from './net.js?v=b820';
/* 사람 신고의 「보기」(b789) — 그 사람 화면을 대시보드 위에 엽니다. */
import { openPerson } from './people.js?v=b820';
/* 기능 스위치를 바꾸면 그 자리에서 화면에 먹입니다(b491) — flags.js 머리말. */
import { reapplyFeatures } from './flags.js?v=b820';
/* 「사용」 칸(b815) — 유튜브 스튜디오처럼. 관리자 화면을 열 때 받습니다(로그인마다 세지 않게). */
import { loadUsage } from './adminuse.js?v=b820';

/* ── 칸 셋 「사용 | 비용 | 문제」(b815, 사용자가 고름) ─────────────────────────
 * 분석 탭의 「성향 | 별점 | 어워즈」(anal.js)와 같은 모양·같은 규칙 — 고른 칸은 앱이 켜져 있는 동안 기억합니다.
 * 사용 = 가입·쓴 사람·별점·흐름(adminuse.js) · 비용 = AI·검색 한도와 「조절」 · 문제 = 오류·신고·로그인 시험. */
let 지금칸 = 'use';
function 칸보이기(){
  for (const [k, id] of [['use', 'adm_use'], ['cost', 'adm_cost'], ['prob', 'adm_prob']])
    $(id)?.classList.toggle('hide', 지금칸 !== k);
  document.querySelectorAll('#adm_tabs [data-adm]').forEach(b => {
    const on = b.dataset.adm === 지금칸;
    b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on));
  });
}
$('adm_tabs')?.addEventListener('click', e => {
  const b = e.target.closest('[data-adm]');
  if (!b || b.dataset.adm === 지금칸) return;
  지금칸 = b.dataset.adm;
  칸보이기();
  if (지금칸 === 'use') loadUsage();
});

/* ── 관리자 대시보드 ────────────────────────────────────────────────
 * 표를 하나씩 열어보게 하면 결국 안 봅니다. 한 화면에 모읍니다.
 * **숫자만 냅니다** — 누가 어디를 갔는지는 관리자도 볼 이유가 없습니다.
 * 서버 쪽 함수가 is_admin() 을 확인하므로 화면을 뜯어도 못 봅니다. */
export async function loadAdmin(){
  /* 들어가는 문은 프로필 우상단 아이콘 하나입니다. 관리자가 아니면 서버가
     막고, 그때 아이콘도 숨깁니다 — 눌러도 아무 일이 없는 단추를 두면 안 됩니다. */
  const show = on => $('dashbtn').classList.toggle('hide', !on);
  /* 기본 2.5초로는 모자랍니다 — 표 열몇 개를 세는 함수라 첫 호출이 느립니다.
     화면을 막고 있는 것이 아니니 넉넉하게 줍니다. */
  const r = await netTimeout(sb.rpc('admin_stats'), 8000);
  if (r.error || !r.data){ show(false); return; }
  /* 처리방침에 "오류 90일, 신고 1년"이라고 적었으니 실제로 지워져야 합니다(042).
     따로 도는 장치가 없어서 관리자가 대시보드를 열 때 한 번씩 치웁니다.
     결과를 기다릴 이유는 없습니다 — 화면과 상관없는 뒷일입니다. */
  sb.rpc('sweep_retention').then(() => {}, () => {});
  show(true);
  /* ⚠ **b820: 잠깐 켭니다** — 새로 담은 홈 화면 앱(keyrotrip)에서 탭바가 바닥에서 59 떠 있습니다(사용자 사진,
     예전 아이콘은 바닥에 붙어 있었음). 그 59 자리를 앱이 칠할 수 있는지 재고 나면 **다시 끕니다.** */
  window.startRuler?.();
  /* **눈금자는 자동으로 안 켭니다.** 다시 재야 할 때는 여기에 이 한 줄을
     되살리십시오: `window.startRuler?.();`

     ── 켰다 끈 기록 ────────────────────────────────────────────────
     b240 → b242 : 새 여행 시트가 키보드 뒤에 앉던 것. b241 에서 잡음.
     b574 → b577 : 지출 추가 시트가 키보드 뒤에 앉던 것. **b576 에서 잡음.**
       읽은 값이 답을 그대로 줬습니다:
           키보드 없음  inner 793  client 793
           키보드 올림  inner 424  client 793  vv.h 424  off 369
       **`innerHeight` 가 레이아웃이 아니라 「보이는 창」을 따라가고 있었고**,
       그래서 「키보드 올라왔나」가 424−424=0 으로 늘 거짓이었습니다.
       고친 뒤 같은 화면에서 `키보드차 369` · `덮개 h 793 / 문서 793` 확인.

     ⚠ **이 문제는 짐작으로 고친 판 여섯(b165·b170·b171·b173·b175·b176)이
       전부 틀렸습니다.** 맞은 것은 언제나 재고 나서 나왔습니다.
       다음에 또 나면 고치기 전에 먼저 이 한 줄을 켜십시오.
     ⚠ 홈 화면 앱은 사파리와 저장 공간이 달라 `?kb=1` 이 안 넘어갑니다 —
       거기서 재는 길은 이 한 줄뿐입니다.
     사파리에서는 주소 끝에 `?kb=1` 로도 켜지지만, **홈 화면 앱은 저장 공간이
     달라 그 길이 없습니다** — 거기서 재려면 반드시 여기를 켜야 합니다.
     켠 뒤 초록 상자를 손가락으로 누르면 빨강(fixed)·파랑(absolute) 자가 켜집니다. */
  /* 조절 칸도 같이 채웁니다. 여기서 기다리지 않습니다 — 통계와 상관없는
     별개 요청이라 순서대로 하면 화면만 늦게 뜹니다. */
  loadSettings();
  사람신고();                /* 처리 안 한 사람 신고(b789) — 아래 */
  const d = r.data;

  const n   = v => Number(v ?? 0).toLocaleString('ko-KR');
  const num = v => Number(v ?? 0);

  /* ⚠ 여기 `tile()`(요약 띠 한 칸)이 있었는데 **b380 에서 부르는 곳이 0 이
     됐습니다.** 요약 띠 자체를 걷었기 때문입니다(아래 그 자리에 사연).
     쓰는 데가 없어진 함수는 남겨두면 다음 사람이 "왜 안 쓰지" 를 한 번
     생각하게 됩니다. `.atiles`·`.atile` CSS 도 같이 걷었습니다. */

  /* 예산 막대. 숫자만 늘어놓으면 "많은 건가?"를 판단 못 합니다.
     80% 를 넘으면 색이 바뀝니다 — 그때부터는 손을 써야 합니다. */
  const bar = (title, used, budget, pct, foot) => {
    if (!budget) return '';
    const p = Math.min(num(pct), 100);
    const tone = p >= 90 ? 'bad' : p >= 70 ? 'warn' : '';
    return `<div class="abar ${tone}">
      <div class="t"><span>${esc(title)}</span>
        <span class="p">${n(used)} / ${n(budget)} · ${p}%</span></div>
      <div class="track"><i style="width:${p}%"></i></div>
      ${foot ? `<div class="f">${esc(foot)}</div>` : ''}</div>`;
  };

  /* 표는 .row 를 쓰다가 글자가 너무 커서 한 줄이 화면을 다 먹었습니다.
     여기는 숫자를 훑는 자리라 촘촘해야 합니다. 전용 줄을 씁니다. */
  const grp = (title, rows) =>
    `<div class="agrp">${esc(title)}</div>` +
    rows.filter(Boolean).map(([k, v, m]) => `<div class="arow">
      <span class="k">${esc(k)}${m ? `<span class="m">${esc(m)}</span>` : ''}</span>
      <span class="v">${esc(v)}</span></div>`).join('');

  /* 예산이 며칠 남았는지. 최근 7일 평균으로 나눈 값이라 어제 갑자기 몰렸으면
     짧게 나옵니다. 정확한 예언이 아니라 "슬슬 봐야 하나"의 신호입니다. */
  const days = d.ai_days_left == null ? '아직 쓴 기록이 없어 계산할 수 없습니다'
    : num(d.ai_days_left) > 60 ? `하루 평균 ${n(d.ai_avg)}회. 여유 있습니다`
    : `하루 평균 ${n(d.ai_avg)}회 · 이 속도면 ${n(d.ai_days_left)}일 뒤에 예산을 다 씁니다`;

  const blocked = num(d.ai_blocked_7d);
  const saved   = num(d.se_hits_month);

  $('adm_stats').innerHTML =
    /* 손을 써야 하는 것이 있으면 맨 위입니다. 표 안에 묻으면 안 봅니다. */
    /* **"아래 조절에서 바꾸세요"라고만 하고 갈 길을 안 줬습니다.** 조절이
       한 겹 안으로 들어갔으니 더 그렇습니다 — 눌러서 바로 가게 합니다.
       그리고 한 번 보고 판단했으면 닫을 수 있어야 합니다. 안 그러면 늘
       빨간 상자가 떠 있어서, 정말 급할 때도 배경처럼 지나칩니다.
       숫자가 늘면 다시 뜹니다(닫은 값과 다르면). */
    (blocked && String(blocked) !== localStorage.getItem('t2:adm:seenblk')
      ? `<div class="awarn">최근 7일 동안 <b>${n(blocked)}번</b> 한도에 막혔습니다.
       ${num(d.ai_blocked_today) ? `오늘만 ${n(d.ai_blocked_today)}번입니다. ` : ''}
       더 쓰고 싶은데 못 쓴 사람이 있다는 뜻이라 자주 막히면 다시 안 옵니다.
       <div style="margin-top:10px; display:flex; gap:8px">
         <button class="small" id="adm_goset">한도 바꾸기</button>
         <button class="ghost" id="adm_hideblk" data-blk="${esc(String(blocked))}">
           알겠어요</button>
       </div></div>` : '') +

    /* ⚠ 여기 요약 띠(`.atiles`) 넉 장이 있었습니다 — **b380 에서 걷었습니다.**
       가입자 · 최근 7일 쓴 사람 · 만들어진 여행 · 오늘 AI. 재보니 **넷 다 아래
       상세에 그대로 또 나옵니다**(`최근 30일 203회` 는 세 번 나왔습니다).
       요약이 아래를 줄여주는 것이 아니라 같은 말을 한 번 더 하는 것이라,
       빼도 잃는 정보가 0 입니다. 대시보드가 2,848px 이었던 이유의 한 몫입니다. */
    `<div class="agrp">이번 달 얼마나 썼나</div>` +
    bar('AI · Gemini', d.ai_month, d.ai_budget, d.ai_pct, days) +
    bar('웹 검색 · Tavily', d.se_month, d.se_budget, d.se_pct,
        saved ? `보관함이 ${n(saved)}번 막아줘서 그만큼 크레딧을 안 썼습니다`
              : '아직 보관함이 막아준 검색이 없습니다') +
    `<div class="anote">여기 예산은 <b>직접 정해둔 값</b>이에요.
      구글·Tavily가 알려주는 실제 잔여량이 아닙니다 — 그건 각 콘솔에서만 볼 수 있어서,
      거기서 확인한 뒤 <code>app_config</code> 에 옮겨 적어야 맞습니다.</div>` +

    /* ⚠⚠ **「쓰는 사람」·「쌓인 자료」 두 묶음을 걷었습니다(b815).** ⚠⚠
       「사용」 칸(adminuse.js · db/112)이 더 정확히 말합니다. 여기 숫자는 틀린 데가 있었습니다 —
       「최근 7일 쓴 사람」은 일정·지출·별점을 «고친» 사람만(보기만 한 사람 0), 「가입만 하고 안 쓴 사람」은
       여행 0개로 셌습니다(별점만 매긴 사람도 «안 쓴 사람»). 이제 이 칸은 **돈 드는 것**(AI·검색)만 봅니다.
       여행 쪽 숫자(지금 여행 중 · 일행과 함께 쓰는 여행)는 사용 칸 「지금까지 쌓인 것」으로 갔습니다. */
    grp('AI · Gemini', [
      ['오늘', n(d.ai_today) + '회', `어제는 ${n(d.ai_yday)}회였습니다`],
      ['최근 7일', n(d.ai_7d) + '회', `하루 평균 ${n(d.ai_avg)}회`],
      ['최근 30일', n(d.ai_30d) + '회'],
      ['이번 달 누적', n(d.ai_month) + '회',
       `예산 ${n(d.ai_budget)}회 가운데 ${n(d.ai_left)}회 남았습니다`],
      ['그중 일정 검토 (7일)', n(d.ai_review_7d) + '회',
       '일반 대화와 따로 셉니다. 아까워서 안 쓰게 되면 안 되니까요'],
      ['오늘 가장 많이 쓴 사람', n(d.ai_top_today) + '회', '한 사람 기준'],
      ['한도에 막힌 횟수', `오늘 ${n(d.ai_blocked_today)}회 · 7일 ${n(d.ai_blocked_7d)}회`,
       '0이 아니면 더 쓰고 싶은데 못 쓴 사람이 있다는 뜻입니다'],
    ]) +
    grp('웹 검색 · Tavily', [
      ['오늘 나간 검색', n(d.se_today) + '회', '실제로 크레딧을 쓴 횟수입니다'],
      ['최근 7일', n(d.se_7d) + '회'],
      ['이번 달 누적', n(d.se_month) + '회',
       `예산 ${n(d.se_budget)}회 가운데 ${n(d.se_left)}회 남았습니다`],
      ['보관함이 막아준 검색', n(d.se_hits_month) + '회',
       '같은 검색을 다시 안 해서 아낀 크레딧입니다'],
      ['지금 담아둔 검색', n(d.se_cached) + '건',
       '6시간이 지나면 지웁니다. 누적이 아니라 현재 보관량입니다'],
    ]);
  /* 「문제」 칸의 숫자 둘(b815 — 대시보드를 「사용 | 비용 | 문제」로 나누며 비용 칸에서 옮김). */
  const 문제칸 = $('adm_probnum');
  if (문제칸) 문제칸.innerHTML = grp('오류와 신고', [
      ['앱이 터진 횟수', `오늘 ${n(d.errors_today)}건 · 7일 ${n(d.errors_7d)}건`],
      ['아직 안 읽은 신고', n(d.reports_open) + '건', `지금까지 받은 신고 ${n(d.reports_total)}건`],
    ]);
  /* 문제가 있으면 칸 이름에 점 하나 — 다른 칸을 보고 있어도 «여기 볼 것이 있다»가 보이게. */
  $('adm_tabs')?.querySelector('[data-adm="prob"]')?.classList.toggle('hasdot',
    num(d.errors_today) > 0 || num(d.reports_open) > 0);

  /* 빨간 상자의 두 단추. 다시 그릴 때마다 새로 달아야 하므로 여기 둡니다. */
  $('adm_goset')?.addEventListener('click', () => setPane(true));
  $('adm_hideblk')?.addEventListener('click', e => {
    localStorage.setItem('t2:adm:seenblk', e.currentTarget.dataset.blk);
    e.currentTarget.closest('.awarn')?.remove();
  });

  const f = await netTimeout(sb.rpc('admin_feed'), 8000);
  const all = f.data || [];

  /* ── 옛 오류는 접습니다 (b380) ────────────────────────────────────────
   * 오류는 90일 보관이라(db/042) **두 달치가 한 목록에 섞입니다.** 실제로
   * `shelfKind`(b326) 나 b311 짜리처럼 **이미 고친 것**이 위에 그대로 쌓여
   * 있어서, 지금 급한 것을 찾으려면 눈으로 걸러야 했습니다.
   * 오늘 이 목록으로 라이브 버그 둘을 잡았는데, 그건 새 줄이 위에 있었기
   * 때문입니다 — 옛것이 많아지면 그 값이 사라집니다.
   *
   * **오류만 7일로 자릅니다. 신고는 그대로 둡니다** — 2주 전에 온 신고도
   * 아직 안 읽었으면 여전히 할 일입니다. 시간이 지난다고 없어지지 않습니다.
   * 접은 개수는 적어 둡니다. 조용히 사라지면 "왜 안 보이지"가 됩니다. */
  /* ⚠ **날짜로 자르는 것으로는 모자랐습니다 (b385).** 7일로 잘라도 목록이
     화면을 가득 채웠습니다 — b326·b361·b362 에서 난 오류가 다 이레 안이라
     그대로 남았기 때문입니다. **그것들은 이미 고친 것**입니다.
     오류에서 중요한 것은 '언제 났나'가 아니라 **'지금 판에서도 나나'** 입니다.
     그래서 판으로 가릅니다. 지난 판 것은 접어두고 개수만 보여줍니다.
     날짜 자르기(7일)는 그대로 둡니다 — 판이 안 적힌 옛 기록이 있습니다. */
  const 이레전 = Date.now() - 7 * 864e5;
  const 지금판 = ($('build')?.textContent || '').trim();
  const 옛오류 = (x) => x.kind === '오류' &&
                        new Date(x.at || 0).getTime() < 이레전;
  const rows = all.filter(x => !옛오류(x));
  const 날짜접힘 = all.length - rows.length;

  /* 신고는 판과 무관합니다 — 2주 전 신고도 안 읽었으면 아직 할 일입니다. */
  const 지난판오류 = (x) => x.kind === '오류' && 지금판 && x.build && x.build !== 지금판;
  const 지금 = rows.filter(x => !지난판오류(x));
  const 지난 = rows.filter(지난판오류);

  const 줄 = x => `<div class="arow">
      <span class="k"><b>${esc(x.kind)}</b> ${esc(String(x.body).slice(0, 120))}
        <span class="m">${esc((x.at || '').slice(0, 16).replace('T', ' '))}${
          x.build ? ' · ' + esc(x.build) : ''}</span></span>
      ${Number(x.n) > 1 ? `<span class="v">${x.n}회</span>` : ''}</div>`;

  $('adm_feedcard').classList.toggle('hide', !rows.length && !날짜접힘);
  $('adm_feed').innerHTML = 지금.map(줄).join('')
    + (!지금.length && (지난.length || 날짜접힘)
        ? `<div class="empty">지금 판(${esc(지금판)})에서 난 오류는 없어요.</div>` : '')
    + (지난.length ? `<div class="anote">
        <button class="small" id="adm_oldbtn" style="width:100%">
          지난 판에서 난 오류 ${지난.length}건 보기</button>
        <div id="adm_old" class="hide" style="margin-top:6px">${지난.map(줄).join('')}</div>
      </div>` : '')
    + (날짜접힘 ? `<div class="anote">7일보다 오래된 오류 ${날짜접힘}건은 접었습니다.
        전부 보려면 프로필 → <b>내 계정</b>의 '최근에 생긴 문제'.</div>` : '')
    + (!rows.length ? `<div class="empty">최근 7일에는 아무 일도 없었어요.</div>` : '');

  $('adm_oldbtn')?.addEventListener('click', e => {
    const box = $('adm_old'), 접힘 = box.classList.toggle('hide');
    e.currentTarget.textContent = 접힘
      ? `지난 판에서 난 오류 ${지난.length}건 보기`
      : `지난 판 오류 접기`;
  });
}

$('adm_refresh').addEventListener('click', loadAdmin);
$('adm_probrefresh')?.addEventListener('click', loadAdmin);   /* 문제 칸(b815) */

/* ── 사람 신고(b789) ─────────────────────────────────────────────────
 * 팔로우가 생기면서 받기 시작한 신고입니다(db/101). **처리 안 한 것만**
 * 보입니다 — 「처리함」을 누르면 빠집니다. 같은 사람이 여러 번 신고됐으면
 * 그 수를 같이 적습니다(여러 사람에게 신고당하는 것이 신호입니다).
 * ⚠ 이름·사진은 서버 함수(db/102)로 받습니다 — profiles 는 일행만 읽힙니다.
 *   102 를 안 돌렸으면 함수가 없어 카드째 숨습니다.
 * ⚠ 처리 안 한 것이 있으면 프로필의 대시보드 아이콘에 점을 찍습니다 —
 *   대시보드를 안 열면 신고가 온 줄 모릅니다. */
async function 사람신고(){
  const 카드 = $('adm_repcard'), 칸 = $('adm_reports');
  if (!카드 || !칸) return;
  const r = await netTimeout(sb.rpc('admin_people_reports'), 8000);
  if (!r || r.error){ 카드.classList.add('hide'); $('dashdot')?.classList.add('hide'); return; }
  const 목록 = r.data || [];
  카드.classList.remove('hide');
  $('adm_repn').textContent = 목록.length ? String(목록.length) : '';
  $('dashdot')?.classList.toggle('hide', !목록.length);
  칸.innerHTML = 목록.length ? 목록.map(x => `<div class="arow">
      <span class="k"><b>${esc(x.reason)}</b> ${esc(x.target_name || '이름 없음')}${
          x.target_total > 1 ? ` · <b>이 사람 신고 ${x.target_total}건</b>` : ''}
        ${x.detail ? `<span class="m">“${esc(x.detail)}”</span>` : ''}
        <span class="m">${esc(x.reporter_name || '이름 없음')}님이 · ${
          esc(new Date(x.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric',
                                                              hour: '2-digit', minute: '2-digit' }))}</span></span>
      <span class="abtns">
        <button class="small" data-repwho="${esc(x.target)}">보기</button>
        <button class="small" data-repdone="${esc(String(x.id))}">처리함</button></span>
    </div>`).join('')
    : emptyDo('처리할 신고가 없어요.');
}
$('adm_reports')?.addEventListener('click', async e => {
  const 누구 = e.target.closest('[data-repwho]');
  if (누구) return openPerson(누구.dataset.repwho);
  const b = e.target.closest('[data-repdone]'); if (!b) return;
  b.disabled = true;
  /* 101 의 정책(preports_admin)이 관리자에게만 고치기를 허락합니다.
     `select` 를 붙여야 막혔을 때(0줄) 조용히 성공한 척하지 않습니다. */
  const r = await netTimeout(sb.from('people_reports')
    .update({ handled_at: new Date().toISOString() })
    .eq('id', Number(b.dataset.repdone)).select('id'));
  if (!r || r.error || !r.data?.length){ b.disabled = false; toast('처리하지 못했어요'); return; }
  toast('처리했어요');
  사람신고();
});

/* ── 조절 ────────────────────────────────────────────────────────────
 * 코드에 박아두면 껐다 켤 때마다 개발 도구를 열어야 합니다. 운영하는 사람이
 * 그래야 한다면 그건 아직 만들다 만 것입니다. 값은 DB(app_settings)에 있고
 * 모양 검사는 admin_setting_set 이 합니다 — 화면만 믿으면 콘솔에서
 * 아무 값이나 넣을 수 있습니다. */
async function loadSettings(){
  const { data, error } = await sb.rpc('admin_settings');
  if (error){ $('s_note').textContent = '설정을 못 읽었어요: ' + (error.message || ''); return; }
  const a = data?.ai_limit || {}, w = data?.web_search || {}, m = data?.ai_model || {};
  $('s_ailimit').checked = !!a.on;
  $('s_ai_day').value    = a.day  ?? 15;
  $('s_ai_trip').value   = a.trip ?? 30;
  $('s_web').checked     = w.on !== false;
  $('s_model').value     = m.name || 'gemini-3.6-flash';
  syncSetRow();
  $('s_note').textContent = '고르는 즉시 모두에게 적용됩니다.';

  /* 비상 스위치는 **저장을 안 거칩니다.** 급할 때 두 번 누르게 하면 안 됩니다.
     066 을 아직 안 올렸으면 값이 없습니다 — 그때는 켜진 것으로 봅니다.
     "설정을 못 읽었으니 다 꺼둔다"는 앱을 멈추는 것과 같습니다. */
  const on = k => data?.[k]?.on !== false;
  $('s_aion').checked     = on('ai_on');
  $('s_signup').checked   = on('signup_on');
  $('s_push').checked     = on('push_on');
  $('s_readonly').checked = data?.readonly?.on === true;   /* 이건 꺼짐이 기본 */

  const nt = data?.notice || {};
  $('s_notice').value = nt.text || '';
  document.querySelectorAll('#s_tone [data-tone]').forEach(b =>
    b.classList.toggle('on', b.dataset.tone === (nt.tone || 'info')));

  const f = data?.features || {};
  document.querySelectorAll('[data-feat]').forEach(el =>
    el.checked = f[el.dataset.feat] !== false);

  /* 접어둔 카드의 요약과 맨 위 상태 줄은 이 값으로 만듭니다. 마지막에 한 번
     셉니다 — 카드를 접어두므로 **요약이 유일한 창**입니다. */
  syncSetState();
}

/* ── 정상값 ──────────────────────────────────────────────────────────
 * **아무 일도 없을 때의 스위치 자리**입니다. 여기서 벗어나 있으면 누군가
 * 껐다는 뜻이고, 껐다는 것은 대개 사고가 났다는 뜻입니다.
 * loadSettings 의 기본값 읽기(`!== false`)와 같은 값이라야 합니다 —
 * 한쪽만 고치면 "기본과 다름"이 거짓말을 합니다. */
const 정상 = { ai_on:true, signup_on:true, push_on:true, readonly:false,
               push:true, docs:true, reorder:true, maplink:true };   /* swipe 는 b781 에 걷음 */
const 스위치이름 = { ai_on:'AI', signup_on:'가입', push_on:'알림', readonly:'점검 모드',
                     push:'잠금화면 알림', docs:'여행 서류',
                     reorder:'끌어서 순서', maplink:'지도 링크' };

/* ⚠ **위험한 셋만 묻습니다.** 알림 끄기까지 물으면 확인창이 흔해져서
   정작 점검 모드에서도 그냥 누르게 됩니다. 값은 '이 자리로 갈 때 묻는다'. */
const 물어볼것 = { ai_on:false, signup_on:false, readonly:true };
const 물음말 = {
  ai_on:     'AI 를 끕니다. 모든 AI 기능이 즉시 멈춰요.',
  signup_on: '새 가입을 막습니다. 쓰던 사람은 그대로예요.',
  readonly:  '점검 모드를 켭니다. 지금 쓰는 모든 사람이 읽기만 됩니다.',
};

/* 스위치 하나가 어디 있는지. 화면 값을 봅니다 — 서버 값을 또 들고 있으면
   둘이 갈라집니다. */
const 스위치값 = () => {
  const v = {};
  document.querySelectorAll('#setadmpane [data-now]').forEach(el => v[el.dataset.now] = el.checked);
  document.querySelectorAll('#setadmpane [data-feat]').forEach(el => v[el.dataset.feat] = el.checked);
  return v;
};

/* ── 요약과 상태 줄 ─────────────────────────────────────────────────
 * 카드를 접어두므로 **제목 옆 한 줄이 유일한 창**입니다. 여기가 거짓말을
 * 하면 접어둔 것이 위험해집니다. 그릴 때마다 다시 셉니다. */
function syncSetState(){
  const v = 스위치값();
  const 다름 = k => v[k] !== undefined && v[k] !== 정상[k];

  const 비상키 = ['ai_on', 'signup_on', 'push_on', 'readonly'];
  const 기능키 = ['push', 'docs', 'reorder', 'maplink'];
  const 비상다름 = 비상키.filter(다름), 기능다름 = 기능키.filter(다름);

  const 줄 = (다름목록, 정상말) => 다름목록.length
    ? `${다름목록.map(k => 스위치이름[k]).join(' · ')} — ${다름목록.length}개`
    : 정상말;
  $('s_emsum').textContent   = 줄(비상다름, '다 정상');
  $('s_featsum').textContent = 줄(기능다름, '4개 다 켜짐');
  /* 이상할 때만 색을 씁니다. 늘 색이 있으면 색이 아무 말도 안 합니다. */
  $('s_emsum').style.color   = 비상다름.length ? 'var(--bad)' : '';
  $('s_featsum').style.color = 기능다름.length ? 'var(--bad)' : '';

  const 전부 = [...비상다름, ...기능다름];
  $('s_statecard').classList.toggle('hide', !전부.length);
  if (전부.length){
    $('s_statetitle').textContent = `기본과 다른 것 ${전부.length}개`;
    $('s_statelist').textContent =
      전부.map(k => `${스위치이름[k]} ${정상[k] ? '꺼짐' : '켜짐'}`).join(' · ');
  }
}

/* 접기. 이상하면 저절로 펴 둡니다 — 접힌 채로 두면 못 보고 지나갑니다. */
$('setadmpane').addEventListener('click', e => {
  const h = e.target.closest('.sfold'); if (!h) return;
  const body = $(h.dataset.fold);
  const 접힘 = body.classList.toggle('hide');
  h.querySelector('.val:last-child').textContent = 접힘 ? '›' : '⌄';
});

/* 켬/끔 하나짜리들. **누르는 즉시 나갑니다.** 실패하면 화면을 되돌립니다 —
   껐다고 보이는데 안 꺼져 있으면 그게 제일 나쁩니다. */
async function 스위치보내기(key, want){
  $('s_swnote').textContent = '보내는 중…';
  const r = await sb.rpc('admin_setting_set', { p_key:key, p_value:{ on:want } });
  const el = document.querySelector(`#setadmpane [data-now="${key}"]`);
  if (r.error){
    if (el) el.checked = !want;
    $('s_swnote').textContent = '못 바꿨어요: ' + (r.error.message || '');
    syncSetState();
    return false;
  }
  if (el) el.checked = want;
  $('s_swnote').textContent = { ai_on: want ? 'AI 를 켰어요' : 'AI 를 껐어요',
    signup_on: want ? '가입을 다시 받아요' : '새 가입을 막았어요',
    push_on:   want ? '알림을 다시 보내요' : '알림을 멈췄어요',
    readonly:  want ? '점검 모드입니다 — 모두 읽기만 됩니다' : '점검 모드를 껐어요',
  }[key] || '바꿨어요';
  syncSetState();
  return true;
}

/* 확인을 기다리는 동안 무엇을 하려던 것인지. 확인 줄은 하나뿐이라 여기 둡니다. */
let 기다리는것 = null;
function 물어보기(key, want){
  기다리는것 = { key, want };
  $('s_confirmq').textContent = 물음말[key] || '정말 바꿀까요?';
  $('s_confirmyes').textContent = want ? '켤게요' : '끌게요';
  $('s_confirm').classList.remove('hide');
  $('s_confirm').scrollIntoView({ block:'nearest', behavior:'smooth' });
}
const 확인닫기 = () => { 기다리는것 = null; $('s_confirm').classList.add('hide'); };
$('s_confirmno').addEventListener('click', 확인닫기);
$('s_confirmyes').addEventListener('click', async () => {
  const j = 기다리는것; 확인닫기();
  if (j) await 스위치보내기(j.key, j.want);
});

$('setadmpane').addEventListener('change', async e => {
  const el = e.target.closest('[data-now]'); if (!el) return;
  const key = el.dataset.now, want = el.checked;
  /* ⚠ **묻는 동안에는 스위치를 원래 자리로 되돌려 둡니다.** 옮겨 놓고 물으면
     아직 안 보냈는데 이미 바뀐 것처럼 보입니다 — 취소해도 찝찝합니다. */
  if (물어볼것[key] === want){ el.checked = !want; return 물어보기(key, want); }
  확인닫기();
  await 스위치보내기(key, want);
});

/* 기능 스위치는 하나의 값(객체) 안에 같이 삽니다. 통째로 보냅니다. */
$('setadmpane').addEventListener('change', async e => {
  if (!e.target.closest('[data-feat]')) return;
  const row = {};
  document.querySelectorAll('[data-feat]').forEach(el => row[el.dataset.feat] = el.checked);
  const r = await sb.rpc('admin_setting_set', { p_key:'features', p_value:row });
  if (r.error) toast('못 바꿨어요: ' + (r.error.message || ''));
  else {
    /* ⚠ **저장이 된 뒤에 화면에 먹입니다(b491).** 새로고침해야 달라지면
       스위치를 껐는데 아무 일도 안 일어나 안 먹은 줄 압니다. 화면부터
       바꾸면 저장 실패 때 화면과 서버가 갈립니다 — 순서가 중요합니다. */
    reapplyFeatures(row);
    toast('기능 스위치를 바꿨어요');
  }
  syncSetState();
});

/* ── 전부 되돌리기 ───────────────────────────────────────────────────
 * **되돌리는 쪽은 안 묻습니다.** 켜는 것·점검을 끄는 것은 다 안전한 방향이고,
 * 급할 때 두 번 누르게 하면 안 됩니다(비상 스위치와 같은 이유). */
$('s_reset').addEventListener('click', async () => {
  const b = $('s_reset');
  b.disabled = true; b.innerHTML = '<span class="load">되돌리는 중…</span>';
  확인닫기();
  const jobs = [['ai_on', { on:true }], ['signup_on', { on:true }],
                ['push_on', { on:true }], ['readonly', { on:false }],
                ['features', { push:true, docs:true, reorder:true, maplink:true }]];
  let 실패 = null;
  for (const [key, value] of jobs){
    const { error } = await sb.rpc('admin_setting_set', { p_key:key, p_value:value });
    if (error){ 실패 = error; break; }
  }
  b.disabled = false; b.textContent = '전부 되돌리기';
  if (실패) return toast('못 되돌렸어요: ' + (실패.message || ''));
  await loadSettings();
  toast('전부 기본값으로 되돌렸어요');
});

$('s_tone').addEventListener('click', e => {
  const b = e.target.closest('[data-tone]'); if (!b) return;
  document.querySelectorAll('#s_tone [data-tone]').forEach(x =>
    x.classList.toggle('on', x === b));
});
$('s_noticesave').addEventListener('click', async () => {
  const b = $('s_noticesave');
  b.disabled = true; b.innerHTML = '<span class="load">보내는 중…</span>';
  const tone = document.querySelector('#s_tone .on')?.dataset.tone || 'info';
  const r = await sb.rpc('admin_setting_set',
    { p_key:'notice', p_value:{ text: $('s_notice').value, tone } });
  b.disabled = false; b.textContent = '띄우기';
  if (r.error) return toast('못 띄웠어요: ' + (r.error.message || ''));
  toast($('s_notice').value.trim() ? '공지를 띄웠어요' : '공지를 내렸어요');
});
/* 한도를 끈 상태에서 숫자 칸은 아무 뜻이 없습니다. 흐려서 그렇다고 알립니다 —
   지우면 켤 때 무슨 값이었는지 못 봅니다. */
function syncSetRow(){
  const on = $('s_ailimit').checked;
  $('s_ailimit_nums').style.opacity = on ? '' : '.45';
  $('s_ai_day').disabled = $('s_ai_trip').disabled = !on;
}

/* ── 조절 세 가지도 즉시 나갑니다 (b387) ──────────────────────────────
 * ⚠ 저장 단추가 있던 자리입니다. 한 화면에서 어떤 것은 즉시 나가고 어떤
 *   것은 저장을 눌러야 했습니다 — 한도를 고치고 저장을 안 누르면 안 바뀌는데,
 *   바로 옆 점검 모드는 손끝만 스쳐도 전원이 읽기 전용이 됐습니다.
 *
 * 숫자 칸은 `change` 로 받습니다. 한 글자마다 보내면 '5' 를 지우고 '50' 을
 * 치는 사이에 **한도 5** 가 잠깐 살아 있게 됩니다. `change` 는 칸을 벗어날
 * 때 한 번만 옵니다.
 * 값이 비었거나 범위 밖이면 안 보냅니다 — 서버가 막아주긴 하지만, 막힌
 * 것을 화면이 모르면 사용자는 바뀐 줄 압니다. */
async function 조절보내기(key, value, 말){
  $('serr').classList.add('hide');
  $('s_note').textContent = '보내는 중…';
  const { error } = await sb.rpc('admin_setting_set', { p_key:key, p_value:value });
  if (error){ $('s_note').textContent = '못 바꿨어요.'; return fail(error, 's'); }
  $('s_note').textContent = 말 + ' 곧바로 모두에게 적용됩니다.';
}
const 한도값 = () => ({ on: $('s_ailimit').checked,
                        day: Number($('s_ai_day').value),
                        trip: Number($('s_ai_trip').value) });
const 한도성함 = () => {
  const v = 한도값();
  return Number.isFinite(v.day) && v.day >= 1 && v.day <= 10000
      && Number.isFinite(v.trip) && v.trip >= 1 && v.trip <= 10000;
};
$('s_ailimit').addEventListener('change', async () => {
  syncSetRow();
  if (!한도성함()) return;
  await 조절보내기('ai_limit', 한도값(),
    $('s_ailimit').checked ? '하루 한도를 켰어요.' : '하루 한도를 껐어요.');
});
for (const id of ['s_ai_day', 's_ai_trip'])
  $(id).addEventListener('change', async () => {
    if (!한도성함()){ $('s_note').textContent = '한도는 1~10000 사이여야 해요.'; return; }
    await 조절보내기('ai_limit', 한도값(), '한도를 바꿨어요.');
  });
$('s_web').addEventListener('change', async () =>
  await 조절보내기('web_search', { on: $('s_web').checked },
    $('s_web').checked ? '웹 검색을 켰어요.' : '웹 검색을 껐어요.'));
$('s_model').addEventListener('change', async () =>
  await 조절보내기('ai_model', { name: $('s_model').value }, '모델을 바꿨어요.'));

/* 통계는 프로필 우상단 아이콘으로만 들어갑니다. 설정 안에도 문을 두었다가
   같은 문이 둘이 되어 없앴습니다. loadAdmin 이 로그인할 때 미리 다 받아두므로
   여는 것은 즉시입니다. */
$('dashbtn').addEventListener('click', () => {
  $('profpane').classList.add('hide');
  $('admpane').classList.remove('hide');
  coverDeck(true);
  toTop($('admpane'));
  칸보이기();
  /* 「사용」 숫자는 여기서 받습니다(b815) — loadAdmin 은 로그인마다 돌아서(관리자인지 보려고) 거기 두면
     관리자가 아닌 사람까지 세는 함수를 부르게 됩니다. */
  if (지금칸 === 'use') loadUsage();
});
/* 조절은 한 겹 안입니다. 관리자 화면을 열 때마다 스위치 다섯이 맨 위를
   먹었는데, 실제로 바꾸는 일은 몇 달에 한 번입니다.
   다른 카드를 다 감추지는 않습니다 — 한 화면 안에서 자리만 바꿉니다.
   그래야 '뒤로'가 앱을 나가는 것과 안 헷갈립니다. */
const setPane = on => {
  $('setadmpane').classList.toggle('hide', !on);
  /* 나머지를 **묶음째** 감춥니다. 카드를 하나씩 감추면, 원래 숨어 있던 것
     (신고가 없을 때의 adm_feedcard)까지 되살아납니다.
     조절이 사이에 끼어 있어 묶음이 둘입니다. */
  $('adm_main').classList.toggle('hide', on);
  $('adm_dash').classList.toggle('hide', on);
  toTop($('admpane'));
};
$('adm_setopen').addEventListener('click', () => setPane(true));
$('adm_setback').addEventListener('click', () => setPane(false));

$('admback').addEventListener('click', () => {
  coverDeck(false);
  $('admpane').classList.add('hide');
  /* 조절을 열어둔 채로 나갔다 들어오면 그 화면이 그대로 남습니다.
     대시보드로 되돌려 놓습니다 — 들어올 때는 늘 같은 화면이어야 합니다. */
  setPane(false);
  $('profpane').classList.remove('hide');
  toTop($('admpane'));
});

/* 도시 사진을 Pexels 핫링크에서 우리 Storage 로 옮기는 일회용 카드가 여기
   있었습니다. 2026-08-08 에 469 곳 전부 옮긴 것을 확인하고 걷어냈습니다
   (image_url 이 전부 우리 storage 주소이고 pexels 는 0 곳).
   supabase/functions/migrate-images 도 같이 지웠습니다. */

/* ⚠ **'바뀐 것'(변경 이력) 화면을 걷었습니다 (b386).**
 *  changes.js 에 판마다 무엇이 바뀌었는지 손으로 적어두는 화면이었습니다.
 *  그런데 맨 위 항목이 b174–b181(2026-08-06)에 멈춰 있었습니다 —
 *  **203판, 2주가 비어 있었습니다.** 관리자만 보는 화면이라 아무도 안 채웠습니다.
 *
 *  같은 기록이 git 에 이미 있고, **그쪽은 커밋할 때마다 저절로 최신**입니다.
 *  손으로 쓰는 사본을 두면 반드시 어긋나고 실제로 어긋났습니다. 안 맞는
 *  변경 이력은 없는 것보다 나쁩니다 — 앱이 멈춘 것처럼 보입니다.
 *  다시 필요해지면 손으로 쓰지 말고 git log 에서 만들어내야 합니다.
 *  같이 걷은 것: index.html 의 `adm_chgcard`·`chgpane`, changes.js,
 *  sw.js 의 미리담기 한 줄. */

/* 내가 낸 오류만 봅니다(RLS 가 그렇게 막아 뒀습니다).
   문의할 때 붙일 수 있게 복사도 됩니다 — 스크린샷보다 이쪽이 고치기 쉽습니다. */
$('errbtn').addEventListener('click', async () => {
  const box = $('errlist'), btn = $('errbtn');
  if (!box.classList.contains('hide')){ box.classList.add('hide'); btn.textContent = '확인'; return; }
  btn.disabled = true; btn.innerHTML = '<span class="load">보는 중…</span>';
  const { data, error } = await sb.from('client_errors')
    .select('created_at,build,message,source')
    .order('created_at', { ascending:false }).limit(20);
  btn.disabled = false; btn.textContent = '닫기';
  box.classList.remove('hide');
  if (error){
    box.innerHTML = `<div class="empty" style="text-align:left">오류 기록을 못 읽었어요.<br>
      <span class="memo">${esc(error.message || '')}</span></div>`;
    return;
  }
  const rows = data || [];
  $('errnote').textContent = rows.length
    ? `최근 ${rows.length}건이 남아 있어요` : '남아 있는 문제가 없어요';
  box.innerHTML = rows.length
    ? rows.map(r => `<div class="row">
        <span class="label"><b style="font-size:calc(13px * var(--ts))">${esc(r.message)}</b>
          <div class="memo">${esc((r.created_at || '').slice(0, 16).replace('T', ' '))}
            · ${esc(r.build || '')} · ${esc(r.source || '')}</div></span></div>`).join('') +
      `<div style="margin-top:10px; display:flex; gap:8px">
         <button class="small" id="errcopy">복사해서 보내기</button></div>
       <div class="empty" style="text-align:left; padding-top:8px">
         복사한 내용을 만든 사람에게 보내주세요. 일정·지출 내용은 들어 있지 않아요.</div>`
    : `<div class="empty">아직 남아 있는 문제가 없어요.</div>`;
  if ($('errcopy')) $('errcopy').onclick = async () => {
    const txt = rows.map(r =>
      `${(r.created_at || '').slice(0, 19)} [${r.build}] ${r.message} @ ${r.source}`).join('\n');
    $('errcopy').textContent = await copyText(txt) ? '복사했어요' : '복사하지 못했어요';
  };
});
