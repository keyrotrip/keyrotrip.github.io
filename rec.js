/* ⚠⚠ **이 파일에는 추천이 두 가지 들어 있습니다. 하나만 화면에 씁니다.** ⚠⚠
 *
 *   · `similarPicks` — **씁니다.** 닮은 도시로 고릅니다(성향 카드 화면).
 *   · `tasteOf`·`recommend` — **안 씁니다.** 태그 하나로만 고르던 옛 방식.
 *
 * 둘 다 같은 방법으로 재고 나서 가른 것입니다. 재는 법은 **감추고 맞히기** —
 * 좋아한 도시를 하나씩 감추고 나머지로만 계산해 그 도시가 몇 등으로
 * 올라오는지 봅니다. 순위가 낮을수록 좋고, 아무렇게나 하면 50% 입니다.
 * (해외 24곳 기준입니다. 국내를 넣으면 "부산 좋아했으니 통영" 같은 쉬운
 *  문제라 숫자가 부풀려집니다.)
 *
 *     태그만 (옛 방식)                   61.2%   ← 무작위보다 나쁨
 *     거리+유명도만                      42.1%
 *     거리+유명도+태그                   44.9%
 *     거리+유명도+나라+태그              17.9%   ← 씁니다. 상위10% 적중 42%
 *     평균 성향(FMDP)에 맞는 도시 고르기  55.6%   ← 무작위보다 나쁨
 *
 * ── 두 가지를 배웠습니다. 둘 다 안 잊는 것이 중요합니다 ──
 *
 * **1) 평균으로 고르면 안 됩니다.** "네 코드가 FMDP 니까 FMDP 스러운 도시"는
 * 그럴듯하지만 재보면 무작위보다 나쁩니다(55.6%). 좋아한 도시들의 개척
 * 점수를 재보니 **평균 31 · 표준편차 35 · 최소 5 · 최대 100** 이었습니다 —
 * 아주 이름난 곳도 좋아하고 아주 숨은 곳도 좋아합니다. 그 둘의 평균은
 * "적당히 이름난 곳"인데 **한 번도 좋아한 적 없는 가운데**입니다.
 * 그래서 평균을 버리고 **좋아한 도시 하나하나와 닮은 곳**을 찾습니다.
 * 성향 코드는 카드에 쓸 것이지 추천에 쓸 것이 아닙니다.
 *
 * **2) 태그는 혼자서는 못 쓰지만 버릴 것도 아닙니다.** 태그만 쓰면 61.2%,
 * 즉 무작위보다 나쁩니다(아래 옛 주석의 진단 그대로입니다 — 조합이
 * 100가지뿐이라 469곳이 줄줄이 동점입니다. 실제로 태그만으로 고른 상위
 * 열 곳이 가오슝·겐트·골드코스트·과나후아토… 로 **가나다순**이었습니다.
 * 전부 동점이라 정렬이 이름순으로 떨어진 것입니다).
 * 그런데 거리·유명도·나라가 후보를 먼저 좁힌 **뒤에** 얹으면
 * 44.9% → **17.9%** 로 뜁니다. 태그는 469곳을 가르기엔 해상도가 모자라도,
 * 이미 좁혀진 스무 곳을 줄 세우기엔 충분합니다.
 *
 * ── 알고 쓰는 약점 ──
 * 나라가 같으면 점수를 얹기 때문에 **이미 다녀온 나라 쪽으로 기웁니다.**
 * 안 그러면 정확도가 17.9% → 44.9% 로 무너져서 그냥 둔 것입니다. 대신
 * 나라 중복을 걷어내고, "안 가본 나라"는 **반대 성향 칸**에서 따로 냅니다.
 * 그 칸은 **정확도를 주장하지 않습니다** — 가 본 적 없는 결이라 애초에
 * 맞히기로 잴 수가 없습니다. 두 칸의 성격이 다른 것이 핵심입니다.
 *
 * ── 아래는 옛 방식(tasteOf·recommend)에 대한 기록입니다 ──
 * 지우지 않는 이유: 왜 태그만으로는 안 되는지가 여기 적혀 있고, 그걸
 * 잊으면 언젠가 "태그로 추천하면 되겠네" 로 되돌아옵니다.
 *
 * 만들고 나서 재본 숫자:
 *
 *     가운뎃값 순위   상위 36%   (아무렇게나 하면 50%)
 *     상위 10% 적중   14%        (아무렇게나 하면 10%)
 *     상위 25% 적중   31%        (아무렇게나 하면 25%)
 *
 * **무작위보다 약간 나은 수준입니다.** 실제로 좋아한 부다페스트·보스턴·
 * 류블랴나가 300등 밖으로 밀렸습니다.
 *
 * 원인은 점수식이 아니라 **자료의 해상도**였습니다. 태그 조합이 100가지뿐이라
 * 469곳을 가르는데, `[유적]` 하나만 붙은 **39곳이 완전히 동점**입니다
 * (탈린·옥스퍼드·요크·뭄바이·부하라…). 그리고 `유적` 은 469곳 중 48%,
 * 좋아한 35곳 중 15곳에 붙어 있어서 **너무 흔해 아무 말도 못 하는 태그**인데,
 * lift 계산이 이걸 음수로 만들어 멀쩡한 곳들을 밀어냈습니다.
 *
 * **무작위와 다를 바 없는 것을 "취향에 맞는 곳"이라 내놓는 것이 제일 나쁩니다.**
 * 이 판단은 지금도 그대로입니다. 바뀐 것은 **태그를 혼자 쓰지 않게 된 것**
 * 뿐입니다(맨 위 참고). 태그가 촘촘해지거나(10개 → 30~40개) 사용자가 늘어
 * 협업 필터링이 가능해지면 그때 이 방식을 다시 보십시오.
 * 살릴 때는 **반드시 다시 재고** 나서 붙이십시오.
 *
 * ── rec.js — 취향으로 다음 도시를 고릅니다 ────────────────────────────
 *
 * **왜 AI 가 아니라 계산인가.**
 * 추천을 Gemini 에게 부탁하면 넷이 따라옵니다:
 *   · 같은 질문에 다른 답이 나옵니다
 *   · 요청마다 비용이 듭니다 (무료 등급 1,500회/일을 여럿이 나눠 씁니다)
 *   · **비행기모드에서 안 됩니다** — 이 앱의 다른 강점과 정면으로 부딪힙니다
 *   · 규칙을 안 지킵니다 — "담아둔 곳은 빼라"를 세 번 적었는데 세 번 다 어겼습니다
 * 여기 있는 것은 전부 로컬 계산입니다. `cities` 는 이미 localStorage 에
 * 캐시되고 별점도 메모리에 있으므로 **연결이 없어도 돕니다.**
 *
 * LLM 은 **자료를 만들 때 한 번** 썼습니다(도시 태그, db/068). 런타임에는 안 씁니다.
 *
 * ── 점수를 어떻게 내는가 ──
 * 1) **기저율로 나눕니다.** 처음엔 "좋아한 도시의 태그를 더하기"로 했더니
 *    `도시`(469곳 중 48%에 붙음)가 1등이 됐습니다. 취향이 아니라 흔해서입니다.
 *    그래서 **좋아한 것에서의 비율 − 전체에서의 비율**(lift)로 봅니다.
 * 2) **표본이 적으면 약하게 봅니다.** 싫어한 도시가 5곳뿐일 때 한 곳이 20%를
 *    움직여서, 실제로 `미식`이 "내 30% vs 전체 25%"인데도 음수로 나왔습니다.
 *    15곳쯤 돼야 온전히 반영합니다.
 * 3) 도시 점수는 태그 점수의 합을 **√(태그 수)로 나눕니다.** 안 나누면 태그가
 *    많은 도시가 늘 이기고, 개수로 나누면 태그 하나짜리가 늘 이깁니다.
 * 4) `fame` 은 아주 약하게만 얹습니다(0.012). 세게 주면 취향과 무관하게
 *    유명한 곳만 나옵니다 — 그건 추천이 아니라 목록입니다.
 */

/* 자(尺)는 calc.js 한 곳에만 둡니다. card.js 의 성향 축과 **같은 자**입니다 —
   베껴 두면 "성향은 멀리(D) 라는데 추천은 가까운 데만 준다"가 됩니다. */
import { cityFameP, cityDistP } from './calc.js?v=b832';

/* ── 닮은 도시 ────────────────────────────────────────────────────────
 * 두 도시가 얼마나 닮았는지. 맨 위에서 잰 바로 그 식입니다 —
 * **숫자를 바꾸면 17.9% 라는 값이 더 이상 이 식을 가리키지 않습니다.**
 * 고칠 일이 있으면 고치고 나서 다시 재고, 맨 위 표를 같이 고치십시오.
 *
 * 넷을 더합니다:
 *   · 유명도·거리가 얼마나 가까운가 (기본 100 에서 어긋난 만큼 뺍니다)
 *   · 태그가 얼마나 겹치는가        (최대 +40)
 *   · 같은 나라인가                 (+25)
 *
 * **+25 가 큽니다.** 이것 하나로 44.9% → 17.9% 가 됩니다. 대신 이미 다녀온
 * 나라 쪽으로 기울므로, 부르는 쪽에서 나라 중복을 걷어내야 합니다. */
const 겹침 = (a, b) => {
  const A = new Set(a.tags || []), B = new Set(b.tags || []);
  if (!A.size && !B.size) return 0;
  let i = 0;
  for (const t of A) if (B.has(t)) i++;
  return i / (A.size + B.size - i);
};

export function citySim(a, b){
  return 100
    - (Math.abs(cityFameP(a) - cityFameP(b)) + Math.abs(cityDistP(a) - cityDistP(b))) / 2
    + 40 * 겹침(a, b)
    + (a.country && a.country === b.country ? 25 : 0);
}

/**
 * 어울리는 곳과 반대인 곳을 고릅니다. 전부 로컬 계산이라 오프라인에서도 됩니다.
 *
 * ⚠ **두 칸의 성격이 다릅니다.** `match` 는 재서 정한 것이고(17.9%),
 *   `opposite` 는 **정확도를 주장하지 않습니다** — 가 본 적 없는 결이라
 *   맞히기로 잴 수가 없습니다. 화면 문구도 그렇게 갈라야 합니다.
 *
 * @param cities  tags · image_url · fame · 좌표를 가진 도시 목록
 * @param rates   내 city_ratings 줄 (city_id · stars · want)
 * @param opts    { visited:Set, n:4, home:'KR' }
 * @returns { match:[{city,seed,score}], opposite:[{city,score}], seeds:수 }
 */
export function similarPicks(cities, rates, opts = {}){
  const { visited = new Set(), n = 4, home = 'KR' } = opts;
  const byId = new Map((cities || []).map(c => [c.id, c]));
  const 쓸만 = c => c && c.tags?.length && c.image_url;

  /* 씨앗 — 좋아한 곳과 가보고 싶다고 한 곳. `want` 를 넣는 이유는 그것도
     본인이 직접 말한 취향이기 때문입니다. 별점만 쓰면 아직 안 가본 결이
     통째로 빠집니다. */
  const seeds = (rates || [])
    .filter(r => (r.stars ?? 0) >= LIKE || r.want)
    .map(r => byId.get(r.city_id)).filter(쓸만);
  if (!seeds.length) return { match: [], opposite: [], seeds: 0 };

  /* 이미 말한 곳(매겼거나 가고 싶다 했거나)과 다녀온 곳은 뺍니다.
     **국내도 뺍니다** — "목포를 추천합니다"는 이 앱이 팔 것이 아니고,
     같은 이유로 성향 축에서도 국내를 뺐습니다(card.js 의 국내 규칙). */
  const 말한곳 = new Set((rates || []).map(r => r.city_id));
  const pool = (cities || []).filter(c =>
    쓸만(c) && c.country !== home && !말한곳.has(c.id) && !visited.has(c.id));

  /* **평균이 아니라 제일 닮은 씨앗 하나로 봅니다.** 평균을 내면 다시
     "가운데"를 고르게 되어 맨 위의 55.6% 로 돌아갑니다. 그리고 어느
     씨앗이 이겼는지를 같이 들고 나갑니다 — 화면에서 "오사카와 닮았어요"
     라고 말할 수 있어야 합니다. **이유 없는 추천은 무작위와 구별되지
     않습니다.** */
  const 점수 = pool.map(city => {
    let seed = null, score = -Infinity;
    for (const s of seeds){
      const v = citySim(city, s);
      if (v > score){ score = v; seed = s; }
    }
    return { city, seed, score };
  });

  /* 나라마다 한 곳씩만. 위 +25 때문에 안 걷어내면 일본이 목록을 통째로
     먹습니다(실제로 상위 열 곳에 나하·후라노·나라·사세보가 다 들어왔습니다). */
  const 골라 = (list, count) => {
    const 쓴나라 = new Set(), out = [];
    for (const x of list){
      if (out.length >= count) break;
      if (쓴나라.has(x.city.country)) continue;
      out.push(x); 쓴나라.add(x.city.country);
    }
    return out;
  };

  const match = 골라([...점수].sort((a, b) => b.score - a.score), n);

  /* ── 반대 성향 ──
     **안 가본 나라에서만 고릅니다.** 여기까지 와서 "일본인데 결이 다른 곳"을
     주면 모험이 아닙니다. 그리고 제일 안 닮은 쪽부터 냅니다.
     match 에 이미 나간 곳은 뺍니다 — 한 화면에 같은 도시가 두 번 있으면
     둘 중 하나는 거짓말입니다. */
  const 가본나라 = new Set((rates || [])
    .filter(r => r.stars != null).map(r => byId.get(r.city_id)?.country).filter(Boolean));
  for (const id of visited){ const c = byId.get(id); if (c?.country) 가본나라.add(c.country); }
  const 나간곳 = new Set(match.map(x => x.city.id));
  const opposite = 골라(
    점수.filter(x => !가본나라.has(x.city.country) && !나간곳.has(x.city.id))
        .sort((a, b) => a.score - b.score), n);

  return { match, opposite, seeds: seeds.length };
}

/* 태그 열 개는 db/068 이 정한 것과 같아야 합니다. 여기서 새로 적지 않고
   실제 자료에서 뽑아 씁니다 — 두 곳에 적으면 한쪽만 고치게 됩니다. */

/* 좋아함/싫어함의 경계. 4점 이상이거나 '가보고 싶어요'면 좋아한 것,
   2.5점 이하면 싫어한 것. 3점 언저리는 **아무 말도 안 한 것**으로 봅니다 —
   억지로 한쪽에 넣으면 취향이 흐려집니다. */
const LIKE = 4, DISLIKE = 2.5;
/* 이 수만큼 모여야 그 신호를 온전히 믿습니다. */
const FULL = 15;

/* 취향 벡터를 만듭니다. cities 는 tags 를 가진 목록, rates 는 city_ratings 줄.
   돌려주는 것: { 태그: 점수 }. 양수면 내 취향, 음수면 아닙니다. */
export function tasteOf(cities, rates){
  const byId = Object.fromEntries(cities.map(c => [c.id, c]));
  const tags = [...new Set(cities.flatMap(c => c.tags || []))];
  if (!tags.length) return {};

  const base = {};
  for (const t of tags)
    base[t] = cities.filter(c => (c.tags || []).includes(t)).length / cities.length;

  const has = c => c?.tags?.length;
  const liked    = rates.filter(r => (r.stars ?? 0) >= LIKE || r.want)
                        .map(r => byId[r.city_id]).filter(has);
  const disliked = rates.filter(r => r.stars != null && r.stars <= DISLIKE)
                        .map(r => byId[r.city_id]).filter(has);

  const share = (set, t) => set.length ? set.filter(c => c.tags.includes(t)).length / set.length : 0;
  const wL = Math.min(1, liked.length / FULL);
  const wD = Math.min(1, disliked.length / FULL);

  const taste = {};
  for (const t of tags)
    /* 싫어함은 0.6 만 봅니다. "안 좋았다"는 "좋았다"보다 이유가 다양해서
       (날씨·동행·컨디션) 태그 탓으로 돌리기 어렵습니다. */
    taste[t] = ((share(liked, t) - base[t]) * wL) - ((share(disliked, t) - base[t]) * wD * 0.6);
  return taste;
}

/* 한 도시의 점수. 위 3)·4) 참고. */
export function scoreCity(city, taste){
  const t = city.tags || [];
  if (!t.length) return null;
  const sum = t.reduce((a, x) => a + (taste[x] || 0), 0);
  return sum / Math.sqrt(t.length) + (3 - (city.fame ?? 2)) * 0.012;
}

/* 왜 이게 나왔는지. **점수만 내놓으면 사용자는 이유를 모릅니다** —
   추천은 이유가 없으면 무작위와 구별되지 않습니다. */
const whyOf = (city, taste) =>
  (city.tags || []).filter(t => (taste[t] || 0) > 0)
    .sort((a, b) => taste[b] - taste[a]).slice(0, 2);

/**
 * 다음에 갈 만한 도시를 고릅니다. 전부 로컬 계산이라 오프라인에서도 됩니다.
 *
 * @param cities  tags 를 가진 도시 목록
 * @param rates   내 city_ratings 줄 (city_id · stars · want)
 * @param opts    { visited:Set, skip:Set, n:5, other:3 }
 * @returns { taste, top, main, other }
 */
export function recommend(cities, rates, opts = {}){
  const { visited = new Set(), skip = new Set(), n = 5, other = 3 } = opts;
  const taste = tasteOf(cities, rates);
  const order = Object.entries(taste).sort((a, b) => b[1] - a[1]);
  const topTag = order[0]?.[0] || null;

  const rated = new Set(rates.map(r => r.city_id));
  const pool = cities
    /* 이미 매겼거나 다녀온 곳은 뺍니다. **사진이 없는 곳도 뺍니다** —
       추천 카드는 사진이 주인공이라 빈 칸이 섞이면 목록이 망가집니다. */
    .filter(c => c.tags?.length && c.image_url
                 && !rated.has(c.id) && !visited.has(c.id) && !skip.has(c.id))
    .map(c => ({ city:c, score:scoreCity(c, taste), why:whyOf(c, taste) }))
    .sort((a, b) => b.score - a.score);

  /* **같은 나라를 두 번 넣지 않습니다.** 취향이 뚜렷하면 한 나라가 목록을
     통째로 먹습니다(실제로 일본만 넷이 나온 적이 있습니다). */
  const usedCountry = new Set();
  const take = (list, count) => {
    const out = [];
    for (const x of list){
      if (out.length >= count) break;
      if (usedCountry.has(x.city.country)) continue;
      out.push(x); usedCountry.add(x.city.country);
    }
    return out;
  };

  const main = take(pool, n);
  /* **취향대로만 주면 목록이 한 색입니다.** 실제로 여덟 곳 중 일곱이
     `미술` 이었습니다. 억지로 흩지 않고(취향이 진짜 그러니까), 제일 센 태그가
     **없는** 곳에서 몇 개를 따로 뽑아 다른 결을 보여줍니다. */
  const others = topTag ? take(pool.filter(x => !x.city.tags.includes(topTag)), other) : [];

  return { taste, top: order, topTag, main, other: others };
}

/* ── 확실한 것만 ─────────────────────────────────────────────────────
 * 위 취향 계산이 무작위와 별 차이 없다고 나와서(맨 위 주석), 화면에는
 * **계산도 짐작도 없이 사실만** 냅니다.
 *
 * 셋 다 "이게 왜 나왔는지"를 한 줄로 댈 수 있습니다. 그게 이 방식의 전부입니다 —
 * 정확도를 주장하지 않으니 틀릴 일이 없습니다.
 *
 *   1) 가보고 싶다고 **본인이 표시**했는데 아직 안 간 곳
 *   2) 다녀왔는데 아직 별점을 안 매긴 곳
 *   3) 다녀온 나라의 다른 도시
 *
 * 순서에 뜻이 있습니다. 1번은 본인이 직접 말한 것이라 제일 셉니다.
 * 2번은 이 앱의 축(다녀온 뒤의 기록)으로 데려갑니다.
 * 3번은 **추천이 아니라 안내**입니다 — "이탈리아에 이런 도시도 있어요".
 * 그래서 제목에도 '추천'이라는 말을 쓰지 않습니다.
 */
export function certainPicks(cities, rates, visited, limit = 6){
  const byId = Object.fromEntries(cities.map(c => [c.id, c]));
  const has  = c => c && c.image_url;
  const rated = new Set(rates.filter(r => r.stars != null).map(r => r.city_id));

  /* 1. 가보고 싶다 → 아직 안 감. **이미 다녀온 것은 저절로 빠집니다** —
        표시를 지우게 하지 않아도 목록이 알아서 줄어듭니다. */
  const wish = rates.filter(r => r.want && !visited.has(r.city_id))
                    .map(r => byId[r.city_id]).filter(has);

  /* 2. 다녀왔는데 안 매긴 곳. 별점이 이 앱의 재료라 여기가 제일 값진 빈칸입니다. */
  const todo = [...visited].filter(id => !rated.has(id)).map(id => byId[id]).filter(has);

  /* 3. 다녀온 나라의 다른 도시. **나라마다 한 곳씩만** 냅니다 —
        안 그러면 일본 도시 여섯이 줄줄이 나옵니다. 이름난 순(fame 1이 위)으로. */
  const goneCountries = new Set([...visited].map(id => byId[id]?.country).filter(Boolean));
  const seen = new Set();
  const near = cities
    .filter(c => has(c) && goneCountries.has(c.country)
                 && !visited.has(c.id) && !rated.has(c.id))
    .sort((a, b) => (a.fame ?? 9) - (b.fame ?? 9) || a.name.localeCompare(b.name))
    .filter(c => !seen.has(c.country) && seen.add(c.country));

  /* 앞의 것부터 채웁니다. 셋을 섞지 않습니다 — 한 카드 안에 다른 뜻이
     섞이면 "이게 왜 여기 있지"가 됩니다. */
  if (wish.length) return { kind:'wish', title:'가보고 싶다고 하셨죠',
                            memo:'아직 안 다녀오신 곳이에요', list:wish.slice(0, limit) };
  if (todo.length) return { kind:'todo', title:'다녀오셨네요, 어떠셨어요?',
                            memo:'별점을 매기면 기록이 쌓여요', list:todo.slice(0, limit) };
  if (near.length) return { kind:'near', title:'다녀오신 나라의 다른 도시',
                            memo:'같은 나라에 이런 곳도 있어요', list:near.slice(0, limit) };
  return null;
}
