/* ── 도시 평가 자료 ──────────────────────────────────────────────────
 * 내가 매긴 별점 · 남들 평균 · 다녀온 곳. **네 화면이 같이 씁니다**
 * (기록 · 도시 상세 · 홈 발자국 · 보관함). 그래서 한 곳이 어긋나면
 * 네 곳이 같이 어긋납니다 — b224 에서 실제로 그랬습니다.
 *
 * 여기서 규칙 셋을 못 박습니다:
 *
 *   1. **못 받아오면 아무것도 안 바꿉니다.**
 *      `refreshVisited` 가 오류를 안 보고 `v.data || []` 로 넘어가고 있었습니다.
 *      실패하면 data 가 null 이라 **다녀온 곳이 통째로 빈 Set** 이 됩니다.
 *      홈 화면 '내 발자국'이 이걸 부르므로, 그때 실패하면 세계지도가 하얘집니다.
 *      (b224 에서 보관함만 오류를 안 봐서 평가가 통째로 비던 것과 같은 모양입니다.)
 *
 *   2. **사람이 바뀌면 전부 비웁니다.**
 *      로그아웃에도 로그인에도 이걸 비우는 코드가 없었습니다. 같은 기기에서
 *      계정을 바꾸면 앞사람 별점이 화면에 남습니다.
 *
 *   3. **별점과 다녀온 곳은 같이 움직입니다.**
 *      별을 매기면 그 도시는 다녀온 곳이 됩니다. 둘을 따로 적으면 어긋납니다.
 *
 * 층: 아무것도 import 하지 않습니다. 서버도 화면도 모릅니다 —
 * 받아오는 일은 app.js 가 하고, 받은 것을 넣기만 합니다.
 */

/* 내가 매긴 것. { city_id: {stars, want, comment, updated_at} } */
export let myRates = {};
/* 내 별점을 서버에서 한 번이라도 받았나(b797). ⚠ `myRates` 가 비었는지로는 «0곳»과 «아직 안
   받음»을 못 가릅니다 — 도시 화면이 안 받은 채로 빈 일기 칸을 띄우면, 거기 써서 저장하는 순간
   서버의 원래 일기를 덮습니다(SNS 점검에서 찾음: 링크로 들어와 친구가 매긴 도시를 열었을 때). */
export let 별받음 = false;
/* 남들까지 합친 평균. { city_id: {avg, n} } */
export let cityStat = {};
/* 다녀온 곳. 별점을 매겼거나 지난 여행의 구간 도시 — **저장하지 않고 셉니다.**
   켜고 끄는 스위치가 없으니 어긋날 자리도 없습니다. */
export let visited = new Set();
/* 방금 매긴 것. 이번 화면에서는 목록에 남겨둡니다 — 잘못 눌렀으면 바로 고쳐야 합니다. */
export let justRated = new Set();
/* ⚠ `rateFilter` 를 걷었습니다(b671) — 평가 탭의 갈래줄을 없앴기
   때문입니다(index.html 의 `#r_filter` 자리 주석). 값을 넣는 곳이
   하나도 안 남아 「살아 있는 것처럼 보이는 죽은 값」이 됩니다. */

/* ── 받아온 것을 넣기 ────────────────────────────────────────────────
 * 셋을 **한 번에** 받습니다. 하나씩 넣게 두면 별점만 새것이고 평균은 옛것인
 * 순간이 생깁니다. 그리고 **하나라도 실패하면 아무것도 안 바꿉니다.**
 * 넣었는지 아닌지를 돌려주므로 부르는 쪽이 화면을 어떻게 할지 정할 수 있습니다. */
export function setRateData({ mine, stats, vis }){
  if (mine?.error || !mine?.data) return false;
  myRates  = Object.fromEntries(mine.data.map(r => [r.city_id, r]));
  별받음 = true;
  /* 평균과 다녀온 곳은 **없어도 화면이 돌아갑니다**(평균은 안 보이고,
     다녀온 표시가 안 붙을 뿐). 그래서 여기서 받으면 넣고 아니면 그대로 둡니다 —
     내 별점만 왔는데 통째로 버리면 정작 볼 수 있는 것까지 못 보게 됩니다. */
  if (!stats?.error && stats?.data)
    cityStat = Object.fromEntries(stats.data.map(s => [s.city_id, s]));
  setVisited(vis);
  return true;
}

/* 다녀온 곳만 다시. **여기가 1번 규칙의 자리입니다.**
   `{ data, error }` 를 통째로 받습니다 — `data` 만 받으면 "못 받은 것"과
   "정말로 한 곳도 없는 것"을 가릴 수가 없습니다. 그게 원래 버그였습니다. */
export function setVisited(res){
  if (!res || res.error || !res.data) return false;
  visited = new Set(res.data.map(v => v.city_id));
  return true;
}

/* ── 하나를 고칠 때 ──────────────────────────────────────────────────
 * 별점을 저장하고 나서 부릅니다. **별점·방금 매긴 것·다녀온 곳을 한 번에**
 * 맞춥니다 — 셋을 따로 적으면 그중 하나를 빠뜨립니다.
 * 별을 지운 경우는 여기서 다녀온 곳을 못 정합니다(지난 여행 기록이 있으면
 * 그대로 다녀온 곳입니다). 서버에 다시 물어야 하므로 그건 부르는 쪽 몫입니다 —
 * 다시 물어야 하는지를 돌려줍니다. */
export function applyRate(cityId, row, patch){
  myRates[cityId] = { ...(myRates[cityId] || {}), ...(row || {}) };
  if (!('stars' in patch)) return { recount: false };
  if (patch.stars != null){
    justRated.add(cityId);
    visited.add(cityId);
    return { recount: false };
  }
  return { recount: true };      /* 별을 지웠다 — 다녀온 곳을 서버에 다시 물어야 합니다 */
}

/* ── 한 도시를 통째로 잊습니다(b407) ─────────────────────────────────
 * **별점을 지우는 것과 다릅니다.** 지우는 것(`stars: null`)은 줄을 남기고,
 * 남은 줄은 "이미 물어본 곳"(아래 `넘긴줄`)이라 **뒤로 밀립니다**.
 *
 * 그래서 둘을 갈라야 합니다:
 *   · **「다른 여행지」(옛 「안 가봤어요」)** → 줄을 남깁니다. 빠른 평가와 평가 탭 목록에서
 *     처음 보는 곳 «뒤로» 갑니다. ⚠ **안 지웁니다 — 다시 나와야 맞습니다**(아래 `넘긴줄`).
 *   · **별점 취소**(잘못 눌렀다) → 줄을 지웁니다. 처음 보는 곳과 같이 **앞에서 다시 물어야 합니다.**
 *
 * 안 가르면 잘못 눌러 취소한 도시가 뒤로 밀려 한참 안 나옵니다. 화면 안에서는
 * 주머니에 돌려놨는데 새로고침하면 밀리는, 눈에 잘 안 띄는 종류입니다. */
export function removeRate(cityId){
  delete myRates[cityId];
  justRated.delete(cityId);
  /* `visited` 는 지난 여행에서도 옵니다 — 여기서 지워도 부르는 쪽이
     `refreshVisited()` 로 서버에 다시 물어 맞춥니다. */
  visited.delete(cityId);
}

/* ── 「다른 여행지」로 넘긴 줄(b843) ─────────────────────────────────────
 * 별도 ♡도 없고, 한줄평·일기도 없고, «다녀옴»(been — b754 「사진에서 찾기」가 남긴 옛 줄)도 아닌 줄입니다.
 * ⚠⚠ **넘긴 곳은 «뒤로» 갈 뿐 안 빠집니다(10-12 사용자: 「나중에 또 평가할 수도 있으니까 다시 나오는게
 *   맞지 않나? 다시는 안나오면 문제가 있지」).** 그사이 다녀왔으면 매길 수 있어야 합니다.
 *   그 전에는 넘긴 곳이 처음 보는 곳과 섞여 유명한 순으로 다시 앞에 왔습니다 — 재 보니 빠른 평가 첫 묶음
 *   38곳 중 27곳이 이미 넘긴 곳이었습니다(넘긴 35곳 전부 다시 나옴). 그래서 «빼지 않고 뒤로» 입니다.
 * ⚠ 빠른 평가(spree.js)와 평가 탭 목록(rating.js) 둘이 이 하나로 가릅니다 — 따로 적으면 갈립니다.
 *   빠른 평가는 제 질의로 받은 줄을 넘기므로 그 질의에도 같은 칸(been·comment·journal·journal_photo)이 있어야 합니다. */
export const 넘긴줄 = r => !!r && r.stars == null && !r.want && !r.been
  && !(r.comment || '').trim() && !(r.journal || '').trim() && !r.journal_photo;

/* ── 이름난 관광지 차례(b852) ───────────────────────────────────────────
 * 사용자(10-12): 「평가 탭 스크롤 내리면서 매길 때 무조건 제일 유명한 관광지들이 위로 오게해줘」.
 * fame 은 세 칸뿐이고 1칸만 76곳이라, 그 안을 가나다로 놓으면 강릉·경주·괌·광주·교토·나트랑·대구·대전 …
 * 이 맨 위였습니다(재 봄). pop_rank 는 나라마다 한 곳(16곳)이라 오사카·후쿠오카가 없습니다.
 * 그래서 차례를 따로 둡니다 — **해외 먼저**(성향은 해외 10곳으로 확정되므로), 그다음 국내 관광지.
 * 근거: 인천공항 노선 여객(간사이 › 나리타 › 후쿠오카 › 방콕 › 다낭 — 2023 업계 집계), 기존 pop_rank,
 *   그리고 누구나 아는 곳. **판단이 섞인 표입니다** — 고치려면 이 표만 손보면 됩니다(목록·부채가 같이 따라감).
 * 여기 없는 곳은 이 뒤에 예전처럼(fame → pop_rank → 가나다) 옵니다. */
const 인기표 = [
  'osaka', 'tokyo', 'fukuoka', 'bangkok', 'danang', 'taipei', 'hongkong', 'paris', 'singapore', 'cebu',
  'kyoto', 'okinawa', 'sapporo', 'nhatrang', 'guam', 'newyork', 'london', 'rome', 'barcelona', 'shanghai',
  'hanoi', 'hochiminh', 'macau', 'bali', 'saipan', 'phuket', 'boracay', 'kualalumpur', 'chiangmai', 'honolulu',
  'losangeles', 'lasvegas', 'sanfrancisco', 'sydney', 'prague', 'venice', 'florence', 'istanbul', 'beijing', 'nagoya',
  /* 국내 */
  'jeju', 'busan', 'seoul', 'gangneung', 'gyeongju', 'yeosu', 'jeonju', 'sokcho', 'seogwipo', 'tongyeong',
];
const 인기자리 = new Map(인기표.map((id, i) => [id, i]));
/* 작을수록 위. 표에 없으면 999. */
export const 인기 = c => 인기자리.get(c?.id) ?? 999;

/* 도시 하나의 평균. 없으면 지웁니다 — 남겨두면 옛 평균이 계속 보입니다. */
export function putCityStat(cityId, row){
  if (row) cityStat[cityId] = row; else delete cityStat[cityId];
}

/* 기록 화면에 다시 들어왔습니다. 방금 매긴 것은 이제 목록에서 빠집니다. */
export function clearJustRated(){ justRated.clear(); }

/* ── 사람이 바뀔 때 ──────────────────────────────────────────────────
 * 2번 규칙. 로그아웃·로그인 양쪽에서 이 한 곳을 부릅니다. */
export function clearRates(){
  myRates = {}; cityStat = {}; 별받음 = false;
  visited = new Set(); justRated = new Set();
}

/* ── 자가검사 (개발용) ─────────────────────────────────────────────────
 * 콘솔에서 __rateCheck(). 로그인도 서버도 필요 없습니다.
 * 위에 적은 규칙 셋을 그대로 봅니다.
 */
if (typeof window !== 'undefined') window.__rateCheck = () => {
  const out = [];
  const bad = (name, msgs) =>
    out.push({ 항목:name, 결과: msgs.length ? '✗ ' + msgs.join(' / ') : '✓' });

  const 원래 = { myRates, cityStat, visited, justRated };

  const 채우기 = () => {
    clearRates();
    setRateData({
      mine:  { data: [{ city_id:'tokyo', stars:5 }, { city_id:'paris', stars:4 }] },
      stats: { data: [{ city_id:'tokyo', avg:4.2 }] },
      vis:   { data: [{ city_id:'tokyo' }, { city_id:'paris' }] },
    });
  };

  /* 1. 못 받아오면 아무것도 안 바꾼다 — 이 파일을 만든 이유입니다. */
  {
    채우기();
    const m = [];
    /* 오류가 온 경우 */
    setVisited({ data: null, error: { message:'연결 없음' } });
    if (visited.size !== 2) m.push(`오류가 왔는데 다녀온 곳이 ${visited.size}개로 바뀜`);
    /* data 가 null 인 경우 (오류 표시 없이 비어서 오는 일이 실제로 있습니다) */
    setVisited({ data: null });
    if (visited.size !== 2) m.push(`data 가 null 인데 ${visited.size}개로 바뀜`);
    /* 아예 안 온 경우 */
    setVisited(undefined);
    if (visited.size !== 2) m.push('응답이 없는데 바뀜');
    /* 내 별점을 못 받으면 셋 다 그대로여야 합니다 */
    setRateData({ mine: { error:{ message:'연결 없음' } } });
    if (Object.keys(myRates).length !== 2) m.push('별점을 못 받았는데 있던 것이 사라짐');
    bad('못 받아오면 아무것도 안 바꾸는가', m);
  }

  /* 2. 정말로 비어서 온 것은 비워야 한다 — 1번을 과하게 하면 이게 막힙니다.
        (별점을 다 지운 사람은 다녀온 곳이 0이 되는 것이 맞습니다.) */
  {
    채우기();
    setVisited({ data: [] });
    bad('정말 비어서 온 것은 비우는가',
        visited.size === 0 ? [] : [`${visited.size}개가 남음`]);
  }

  /* 3. 별을 매기면 다녀온 곳에도 들어간다 */
  {
    채우기();
    const m = [];
    const r1 = applyRate('roma', { city_id:'roma', stars:5 }, { stars:5 });
    if (!visited.has('roma'))    m.push('다녀온 곳에 안 들어감');
    if (!justRated.has('roma'))  m.push('방금 매긴 것에 안 들어감');
    if (myRates.roma?.stars !== 5) m.push('별점이 안 들어감');
    if (r1.recount)              m.push('별을 매겼는데 다시 세라고 함');
    /* 별을 지우면 다녀온 곳은 여기서 못 정합니다 — 다시 세라고 해야 합니다. */
    const r2 = applyRate('roma', { city_id:'roma', stars:null }, { stars:null });
    if (!r2.recount)             m.push('별을 지웠는데 다시 세라고 안 함');
    /* 하트만 눌렀을 때는 다녀온 곳과 상관이 없습니다. */
    const r3 = applyRate('lisboa', { city_id:'lisboa', want:true }, { want:true });
    if (visited.has('lisboa'))   m.push('하트만 눌렀는데 다녀온 곳이 됨');
    if (r3.recount)              m.push('하트인데 다시 세라고 함');
    bad('별점과 다녀온 곳이 같이 움직이는가', m);
  }

  /* 4. 고치던 것을 덮어쓰지 않는다 — 별점만 보내도 한줄평이 남아야 합니다. */
  {
    채우기();
    applyRate('tokyo', { comment:'좋았어요' }, { comment:'좋았어요' });
    applyRate('tokyo', { stars:3 }, { stars:3 });
    bad('한 칸만 고쳐도 나머지가 남는가',
        myRates.tokyo?.comment === '좋았어요' && myRates.tokyo?.stars === 3
          ? [] : ['다른 칸이 지워짐']);
  }

  /* 5. 사람이 바뀌면 전부 빈다 */
  {
    채우기();
    applyRate('roma', { stars:5 }, { stars:5 });
    clearRates();
    const m = [];
    if (Object.keys(myRates).length)  m.push('별점이 남음');
    if (Object.keys(cityStat).length) m.push('평균이 남음');
    if (visited.size)                 m.push('다녀온 곳이 남음');
    if (justRated.size)               m.push('방금 매긴 것이 남음');
    bad('사람이 바뀌면 전부 비는가', m);
  }

  /* 6. 평균이 없어지면 지운다 — 남겨두면 옛 평균이 계속 보입니다. */
  {
    채우기();
    putCityStat('tokyo', null);
    bad('평균이 없어지면 지우는가',
        'tokyo' in cityStat ? ['옛 평균이 남음'] : []);
  }

  /* 되돌려 놓기 */
  myRates = 원래.myRates; cityStat = 원래.cityStat;
  visited = 원래.visited; justRated = 원래.justRated;

  console.table(out);
  const ng = out.filter(o => o.결과 !== '✓');
  console.log(ng.length ? `✗ ${ng.length}건 틀림` : `✓ ${out.length}건 모두 통과`);
  return out;
};
/* ── 남들 평균 한 조각 ────────────────────────────────────────────────
 * `· 평균 4.2 (7명)` 을 만듭니다. 기록 탭과 보관함이 같이 씁니다 —
 * 두 곳에 따로 적어두면 한쪽만 고치게 됩니다.
 *
 * ⚠ **`n_rated` 에는 나도 들어 있습니다.** 그래서 나 말고 한 명이라도
 *   더 매겼을 때만 답니다. 안 그러면 내가 매긴 도시 목록에서 `★★★☆☆`
 *   바로 옆에 `평균 3.0 (1명)` 이 붙습니다 — 내 별점을 숫자로 한 번 더
 *   읽어주는 것이라 아무 말도 안 하는 것과 같습니다.
 *   기록 탭처럼 내가 안 매긴 도시가 섞인 목록에서는 `n_rated` 가 1이어도
 *   그건 남 한 명이므로 그대로 나옵니다. 그래서 숫자를 빼서 셉니다. */
export function avgTail(stat, mine){
  const others = (stat?.n_rated || 0) - (mine?.stars != null ? 1 : 0);
  return others > 0
    ? ` · 평균 ${Number(stat.avg_stars).toFixed(1)} (${stat.n_rated}명)` : '';
}
