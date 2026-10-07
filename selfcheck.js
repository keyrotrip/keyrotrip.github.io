/* ── 콘솔에서 돌리는 자체 점검 셋 ─────────────────────────────────────
 * 화면에서는 **틀려도 그럴듯해 보이는 것들**을 기계에 물어봅니다.
 *   `__designCheck()`  글자 크기·굵기 규칙이 뒤집혔나
 *   `__recCheck()`     추천 점수식이 지어낸 사람에게도 말이 되나
 *   `__mapCheck()`     '지도에서 보기' 주소가 엉뚱한 곳으로 가나
 *
 * 셋 다 `window` 에 답니다. 크롬 콘솔에서 이름만 치면 돕니다.
 *
 * ── app.js 에서 떼어낸 스무 번째 조각입니다(b345) ────────────────────
 * **딸린 것이 0 입니다.** 앱 상태를 하나도 안 봅니다 — 지어낸 값과
 * 화면에 이미 그려진 것만 봅니다. 그래서 어느 화면에도 안 얽힙니다.
 *
 * ⚠ **app.js 의 머리말이 내용과 어긋나 있었습니다.** '추천 검사' 머리말
 * 아래에 `parseMemo`·`nice`·`lineChips`·`drawCats`·`dayStat` — 일정 줄을
 * 그리는 부품들이 같이 들어 있었습니다. 그것들은 일정 화면 것이라
 * **두고 왔습니다.** 머리말만 믿고 잘랐으면 검사 파일에 그리기 코드가
 * 딸려 나왔을 것입니다. 자를 때는 `선언` 을 세어 보십시오.
 *
 * 점검을 왜 코드로 두나: 셋 다 **실제로 틀린 적이 있고 눈으로는 못 잡았습니다.**
 * 사연은 각 머리말에 그대로 남겨뒀습니다.
 *
 * 층: 아래층만 씁니다(rec.js · calc.js · planmap.js · cities.js). */
import { recommend, scoreCity, tasteOf, similarPicks } from './rec.js?v=b830';
import { cityFameP } from './calc.js?v=b830';
import { mapLinks, memoMapUrl } from './planmap.js?v=b830';
import { search } from './cities.js?v=b830';

/* ── 디자인 규칙 검사 ────────────────────────────────────────────────
 * **같은 뒤집힘을 세 번 만났습니다** — 홈(b268) · 일정/지출(b270) ·
 * 여행 목록(b279). 뿌리는 늘 같습니다: `b` 에 크기를 안 적으면 본문
 * 기본값(17px/700)을 받아 **항목 이름이 카드 제목을 이깁니다.**
 * 눈으로 훑어서는 세 번 다 못 잡았고, 재보고서야 잡았습니다.
 * 그래서 규칙을 코드에 둡니다. 화면을 새로 만들면 콘솔에서 돌리십시오.
 *
 *   카드 제목 17/700 › 구역 머리 15/700 › 항목 15/600 › 설명 13/400
 *
 * 배율(--ts)을 걷어내고 **설계값으로** 잽니다 — 사용자가 '작게'로 보고
 * 있으면 모든 수가 0.9배로 나와서 규칙과 안 맞습니다. */
window.__designCheck = () => {
  const ts = parseFloat(getComputedStyle(document.documentElement)
               .getPropertyValue('--ts')) || 1;
  const out = [], seen = new Set();
  for (const e of document.querySelectorAll('main *, #aiview *')){
    if (!e.offsetParent) continue;
    const box = e.getBoundingClientRect(); if (box.height < 6) continue;
    /* 자기가 직접 글자를 갖고 있는 것만 봅니다. 감싸는 상자는 자식의
       크기를 물려받아 보여서 엉뚱하게 걸립니다. */
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const g = getComputedStyle(e);
    const fs = Math.round(parseFloat(g.fontSize) / ts), fw = +g.fontWeight;
    const tag = e.tagName, key = tag + '.' + (e.className || '-');
    const say = (rule, why) => { const k = rule + key; if (seen.has(k)) return;
      seen.add(k); out.push({ 규칙:rule, 자리:key, 값:`${fs}px/${fw}`,
        글자:e.textContent.trim().replace(/\s+/g, ' ').slice(0, 20), 왜:why }); };

    /* 히어로 숫자(D-3)와 카드 제목은 일부러 큽니다 — 빼고 봅니다.
       ⚠ **계단을 벌리면서 눈금도 같이 올렸습니다**(b293). 카드 제목이
         17 › 21, 항목 이름이 15 › 17 이 됐는데, 눈금을 17 에 두면 이제
         **항목 이름이 전부 걸립니다.** 규칙이 화면보다 옛것이면 매번
         걸리는 것을 무시하게 되고, 그러면 진짜가 섞여도 안 보입니다. */
    const big = fs >= 21 && fw >= 700;
    /* `.dd`(D-1 숫자)와 `.ht`(그 아래 여행 이름)는 히어로입니다 — 사진 위에
       크게 얹는 자리라 카드 제목 규격을 안 따릅니다. 빼고 봅니다. */
    const 제목 = /^H[12]$/.test(tag) || e.closest('h1,h2')
                 || e.classList.contains('dd') || e.classList.contains('ht');
    if (big && !제목) say('①제목처럼 큼', tag === 'B'
      ? 'b 에 크기를 안 적어 본문 기본값을 받았습니다 → 17/600'
      : '21/700 은 카드 제목 자리입니다');
    /* 굵기는 셋뿐입니다(400·600·700). 650·750 은 폰트에 없어서 브라우저가
       흉내 내고, 선명해지는 대신 뭉갭니다. 새로 끼어들면 여기서 걸립니다. */
    if (![400, 600, 700].includes(fw)) say('④굵기 셋 밖', `${fw} — 400·600·700 만 씁니다`);
    if (e.classList.contains('memo') && (fs > 13 || fw >= 600))
      say('②설명 규격밖', '설명은 13/400 회색입니다');
    /* ③ 은 **이미 보고 그대로 두기로 한 것입니다** (2026-08-11, 사용자 결정).
       머리줄의 작은 단추 여덟이 31~36px 로 44 에 못 미칩니다. 다 키우면
       머리줄이 통째로 두꺼워져 사진 중심 방향과 어긋나서, 실기기에서 눌러보고
       답답할 때 손보기로 했습니다. **아래 결과가 나와도 할 일이 아닙니다** —
       새로 생긴 것이 있는지 보는 눈금으로만 쓰십시오. */
    if ((tag === 'BUTTON' || tag === 'A') && box.height < 44 && e.textContent.trim())
      say('③손가락 자리(둘 것)', `${Math.round(box.width)}×${Math.round(box.height)} — 44 미만`);
  }
  if (out.length) console.table(out); else console.log('디자인 규칙 위반 없음 ✅');
  return { 위반:out.length, 항목:out };
};

/* ── 추천 검사 ───────────────────────────────────────────────────────
 * 점수식은 **틀려도 화면에서는 그럴듯해 보입니다** — 도시 이름이 나오니까요.
 * 실제로 만들면서 두 번 틀렸고 둘 다 눈으로는 못 잡았습니다:
 *   1) 기저율로 안 나눠서 `도시`(48%에 붙음)가 취향 1등이 됐습니다
 *   2) 싫어한 도시가 5곳뿐인데 그대로 반영해 `미식`이 "내 30% vs 전체 25%"
 *      인데도 음수로 나왔습니다
 * 그래서 **지어낸 사람**으로 돌려봅니다. 실제 자료로만 보면 내 취향 하나만
 * 확인하게 되고, 그건 표본 하나입니다. */
window.__recCheck = () => {
  const T = [];
  const t = (name, ok, detail) => T.push({ 검사:name, 결과: ok ? 'OK' : '틀림', detail });
  /* 태그가 다른 가짜 도시들 */
  const mk = (id, tags, fame = 2) =>
    ({ id, name:id, country:id.slice(0, 2), tags, fame, image_url:'x' });
  const world = [
    mk('a1', ['해변']), mk('a2', ['해변']), mk('a3', ['해변']), mk('a4', ['해변']),
    mk('b1', ['미술']), mk('b2', ['미술']),
    mk('c1', ['도시']), mk('c2', ['도시']), mk('c3', ['도시']), mk('c4', ['도시']),
    mk('d1', ['자연']), mk('d2', ['자연']),
  ];
  /* ① 흔한 태그가 취향으로 둔갑하지 않는가 — 위 1) 을 막는 검사 */
  {
    /* 도시(4곳)와 미술(2곳) 을 똑같이 하나씩 좋아했다. 비율로 보면 미술이 세다. */
    const r = [{ city_id:'c1', stars:5 }, { city_id:'b1', stars:5 }];
    const ts = tasteOf(world, r);
    t('흔한 태그가 취향으로 둔갑하지 않는다', ts['미술'] > ts['도시'],
      `미술 ${ts['미술'].toFixed(3)} vs 도시 ${ts['도시'].toFixed(3)}`);
  }
  /* ② 싫어함이 적을 때 과하게 반영되지 않는가 — 위 2) 를 막는 검사 */
  {
    const many = [...Array(15)].map((_, i) => ({ city_id:'a' + (i % 4 + 1), stars:5 }));
    const one  = [...many, { city_id:'b1', stars:1 }];
    const A = tasteOf(world, many), B = tasteOf(world, one);
    t('싫어함 한 건이 취향을 뒤집지 못한다',
      Math.abs(B['해변'] - A['해변']) < 0.25,
      `해변 ${A['해변'].toFixed(3)} → ${B['해변'].toFixed(3)}`);
  }
  /* ③ 아무것도 안 매긴 사람에게 터지지 않는가 */
  {
    const r = recommend(world, [], {});
    t('별점이 하나도 없어도 안 터진다', Array.isArray(r.main), `${r.main.length}곳`);
  }
  /* ④ 이미 매긴 곳·다녀온 곳이 추천에 안 나오는가 */
  {
    const r = recommend(world, [{ city_id:'a1', stars:5 }], { visited:new Set(['a2']) });
    const ids = [...r.main, ...r.other].map(x => x.city.id);
    t('매긴 곳·다녀온 곳은 빠진다', !ids.includes('a1') && !ids.includes('a2'), ids.join(','));
  }
  /* ⑤ 같은 나라가 두 번 나오지 않는가 */
  {
    const same = [...Array(6)].map((_, i) => mk('kr' + i, ['미술']));
    const r = recommend([...world, ...same], [{ city_id:'b1', stars:5 }], {});
    const cs = [...r.main, ...r.other].map(x => x.city.country);
    t('같은 나라가 두 번 안 나온다', cs.length === new Set(cs).size, cs.join(','));
  }
  /* ⑥ 태그가 없는 도시는 점수를 못 낸다(그대로 두면 0 점으로 섞입니다) */
  t('태그 없는 도시는 점수가 없다', scoreCity({ tags:[] }, {}) === null, '');
  /* ⑦ 이유가 붙는가 — 이유 없는 추천은 무작위와 구별되지 않습니다 */
  {
    const r = recommend(world, [{ city_id:'b1', stars:5 }], {});
    t('왜 나왔는지가 붙는다', r.main.every(x => Array.isArray(x.why)),
      r.main[0] ? r.main[0].why.join('·') : '-');
  }
  /* ── 닮은 도시(similarPicks) — 화면에 실제로 나가는 쪽입니다(b395) ──
     위 ①~⑦ 은 이제 화면에 안 쓰는 옛 방식을 지킵니다. 아래가 진짜입니다.

     좌표를 붙인 세계를 따로 만듭니다 — 거리 자(cityDistP)가 좌표를 보므로
     좌표가 없으면 전부 50 점이 되어 **거리 항이 통째로 죽습니다.**
     그러면 "거리가 닮은 곳을 고른다"를 검사한다고 해 놓고 실제로는
     태그만 보게 됩니다. */
  const geo = (id, tags, fame, la, ln, country) =>
    ({ id, name:id, country, tags, fame, center_lat:la, center_lng:ln, image_url:'x' });
  const W2 = [
    /* 일본 — 가깝고 이름남 */
    geo('jp1', ['도시','미식'], 1, 34.7, 135.5, 'JP'),
    geo('jp2', ['도시','미식'], 1, 35.7, 139.7, 'JP'),
    geo('jp3', ['도시','미식'], 1, 33.6, 130.4, 'JP'),
    /* 스위스 — 멀고 자연 */
    geo('ch1', ['자연','산'], 2, 46.6, 8.0, 'CH'),
    geo('ch2', ['자연','산'], 2, 46.0, 7.7, 'CH'),
    /* 남미 — 아주 멀고 결이 다름 */
    geo('pe1', ['유적'], 3, -13.5, -71.9, 'PE'),
    geo('cl1', ['유적'], 3, -33.4, -70.6, 'CL'),
    /* 국내 — 추천에서 빠져야 합니다 */
    geo('kr1', ['도시','미식'], 1, 37.5, 127.0, 'KR'),
  ];
  /* ⑧ 이유가 붙는가. **이유 없는 추천은 무작위와 구별되지 않습니다.** */
  {
    const r = similarPicks(W2, [{ city_id:'jp1', stars:5 }], {});
    t('닮은 도시 — 어느 곳과 닮았는지가 붙는다',
      r.match.length > 0 && r.match.every(x => x.seed && x.seed.id),
      r.match.map(x => `${x.city.id}←${x.seed?.id}`).join(' '));
  }
  /* ⑨ 국내는 추천에 안 나오는가. 성향 축에서 뺀 것과 같은 이유입니다 —
        "목포를 추천합니다"는 이 앱이 팔 것이 아닙니다. */
  {
    const r = similarPicks(W2, [{ city_id:'jp1', stars:5 }], {});
    const ids = [...r.match, ...r.opposite].map(x => x.city.id);
    t('국내(KR)는 추천에서 빠진다', !ids.includes('kr1'), ids.join(','));
  }
  /* ⑩ **반대 칸이 정말 반대인가.** 일본을 좋아한 사람에게 어울리는 곳은
        일본 결이어야 하고, 반대 칸은 남미처럼 먼 결이어야 합니다.
        이 검사가 없으면 두 칸이 슬그머니 같은 목록이 됩니다.

        ⚠ **n:1 로 부릅니다.** 기본값 4 로 두면 어울리는 칸이 나라마다 한
        곳씩 넷을 가져가 이 작은 세계(도시 여덟)를 다 먹고, 반대 칸에는
        남는 것만 떨어집니다. 진짜 목록 469곳에서는 안 생기는 일이라
        **검사 쪽을 맞춥니다.**

        ⚠ 어울리는 곳을 `jp2` 로 못 박았다가 틀렸습니다(b395). 후쿠오카(jp3)가
        도쿄(jp2)보다 오사카에서 가까워서 jp3 가 맞습니다. **나라만 봅니다** —
        어느 일본 도시가 1등인지는 자를 조금만 손봐도 바뀌는데, 그때마다
        검사가 빨개지면 아무도 안 봅니다. */
  {
    const r = similarPicks(W2, [{ city_id:'jp1', stars:5 }], { n:1 });
    const 맞 = r.match[0]?.city, 반 = r.opposite[0]?.city;
    t('어울리는 곳과 반대인 곳이 다른 쪽을 가리킨다',
      맞?.country === 'JP' && ['PE','CL'].includes(반?.country),
      `어울림 ${맞?.id}(${맞?.country}) · 반대 ${반?.id}(${반?.country})`);
  }
  /* ⑪ 반대 칸은 **안 가본 나라**에서만 고르는가. 다녀온 나라에서 고르면
        모험이 아니라 그냥 "일본인데 결이 다른 곳"입니다. */
  {
    /* ⚠ 여기도 n:1 입니다. 기본값 4 로 두었더니 어울리는 칸이 남은 네 나라를
       다 가져가서 **반대 칸이 빈 채로 통과**했습니다(b395). 빈 목록은
       "JP 가 없다"를 언제나 만족시킵니다 — 아무것도 안 보고 OK 가 뜨는
       검사는 검사가 아닙니다. 그래서 **비어 있으면 틀림**으로 셉니다. */
    const r = similarPicks(W2, [{ city_id:'jp1', stars:5 }, { city_id:'ch1', stars:4 }], { n:1 });
    const cs = r.opposite.map(x => x.city.country);
    t('반대 칸은 안 가본 나라에서만 고른다',
      cs.length > 0 && !cs.includes('JP') && !cs.includes('CH'), cs.join(',') || '(비었음)');
  }
  /* ⑫ 한 도시가 두 칸에 동시에 나오지 않는가 — 둘 중 하나는 거짓말입니다. */
  {
    const r = similarPicks(W2, [{ city_id:'jp1', stars:5 }], {});
    const a = new Set(r.match.map(x => x.city.id));
    t('같은 도시가 두 칸에 겹치지 않는다',
      r.opposite.every(x => !a.has(x.city.id)),
      r.opposite.map(x => x.city.id).join(','));
  }
  /* ⑬ 매긴 곳·가고 싶다 한 곳·다녀온 곳은 빠지는가 */
  {
    const r = similarPicks(W2, [{ city_id:'jp1', stars:5 }, { city_id:'jp2', want:true }],
                           { visited:new Set(['jp3']) });
    const ids = [...r.match, ...r.opposite].map(x => x.city.id);
    t('이미 말한 곳·다녀온 곳은 빠진다',
      !ids.some(id => ['jp1','jp2','jp3'].includes(id)), ids.join(','));
  }
  /* ⑭ 씨앗이 없어도 안 터지는가 (별점도 없고 가고 싶다도 없는 사람) */
  {
    const r = similarPicks(W2, [], {});
    t('좋아한 곳이 하나도 없어도 안 터진다',
      Array.isArray(r.match) && r.match.length === 0 && r.seeds === 0, `씨앗 ${r.seeds}`);
  }
  /* ⑮ 같은 나라가 두 번 나오지 않는가. 같은 나라 +25 때문에 안 걷어내면
        일본이 목록을 통째로 먹습니다(실제로 상위 열 곳에 나하·후라노·
        나라·사세보가 다 들어왔습니다). */
  {
    const many = [...Array(6)].map((_, i) => geo('jx' + i, ['도시','미식'], 1, 35 + i * .1, 139, 'JP'));
    const r = similarPicks([...W2, ...many], [{ city_id:'jp1', stars:5 }], {});
    const cs = r.match.map(x => x.city.country);
    t('어울리는 곳에 같은 나라가 두 번 안 나온다',
      cs.length === new Set(cs).size, cs.join(','));
  }
  /* ⑯ **자가 card.js 와 같은가.** calc.js 로 옮겨 한 벌만 두었는데, 누가
        rec.js 안에 다시 베껴 넣으면 이 검사가 잡습니다. 유명도 1 과 3 은
        자의 양 끝이라 붙어 있으면 안 됩니다. */
  t('유명도 자가 살아 있다 (1 과 3 이 붙어 있지 않다)',
    Math.abs(cityFameP({ fame:1 }) - cityFameP({ fame:3 })) > 60,
    `${cityFameP({ fame:1 })} vs ${cityFameP({ fame:3 })}`);

  const bad = T.filter(x => x.결과 !== 'OK');
  console.table(T);
  bad.forEach(x => console.error('✗ ' + x.검사 + ' — ' + x.detail));
  return { 전체:T.length, 틀림:bad.length };
};

window.__mapCheck = () => {
  const T = [];
  const t = (name, got, want) => T.push({ name, ok: got === want, got, want });
  const S = 'https://www.google.com/maps/search/';

  /* 1. 사용자가 손으로 짚은 주소가 제일 먼저다 — 좌표가 있어도 */
  t('메모의 짧은 주소를 그대로 연다',
    mapLinks({ title:'아카리조명', memo:'https://maps.app.goo.gl/vykxwqgPhrYdhTf16?g_st=ipc' }, '도쿄').see,
    'https://maps.app.goo.gl/vykxwqgPhrYdhTf16?g_st=ipc');
  t('메모의 주소가 좌표를 이긴다',
    mapLinks({ title:'아카리조명', lat:35.6, lng:139.7, memo:'https://maps.app.goo.gl/x' }, '도쿄').see,
    'https://maps.app.goo.gl/x');

  /* 2. 좌표가 있으면 그 자리를 보면서 이름을 찾는다 */
  t('좌표는 @lat,lng 로 자리를 잡는다',
    mapLinks({ title:'콜로세오', lat:41.8902, lng:12.4922 }, '로마').see,
    S + '%EC%BD%9C%EB%A1%9C%EC%84%B8%EC%98%A4/@41.8902,12.4922,17z');
  t('이름이 없으면 좌표에 핀만 찍는다',
    mapLinks({ title:'', lat:41.8902, lng:12.4922 }, '로마').see,
    S + '?api=1&query=41.8902,12.4922');

  /* 3. 둘 다 없으면 이름 + 도시 — 이것이 '엉뚱한 곳'을 막는 마지막 그물 */
  t('좌표도 주소도 없으면 도시를 붙인다',
    mapLinks({ title:'아카리조명' }, '도쿄').see,
    S + '?api=1&query=%EC%95%84%EC%B9%B4%EB%A6%AC%EC%A1%B0%EB%AA%85%20%EB%8F%84%EC%BF%84');

  /* 4. 길찾기는 짧은 주소로 못 간다 — 목적지를 알아야 하므로 좌표/이름으로 */
  t('길찾기는 좌표를 쓴다',
    mapLinks({ title:'콜로세오', lat:41.89, lng:12.49, memo:'https://maps.app.goo.gl/x' }, '로마').go,
    'https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=41.89,12.49');

  /* 5. 지도가 아닌 주소는 안 물어야 한다 — 블로그 링크를 메모에 적는 일이 잦다 */
  t('블로그 주소는 지도로 안 쓴다',
    memoMapUrl('참고 https://blog.naver.com/abc/123'), null);
  t('문장 끝의 마침표는 주소에서 뗀다',
    memoMapUrl('여기다 https://maps.app.goo.gl/abc.'), 'https://maps.app.goo.gl/abc');
  t('구글 지도 긴 주소도 받는다',
    memoMapUrl('https://www.google.com/maps/place/Tokyo/@35.6,139.7,12z'),
    'https://www.google.com/maps/place/Tokyo/@35.6,139.7,12z');
  t('goo.gl 이라도 지도가 아니면 안 쓴다', memoMapUrl('https://goo.gl/abcd'), null);

  const bad = T.filter(x => !x.ok);
  console.table(T.map(x => ({ 검사:x.name, 결과:x.ok ? 'OK' : '틀림' })));
  bad.forEach(x => console.error(`✗ ${x.name}\n  나온 것: ${x.got}\n  나와야: ${x.want}`));
  return { 전체:T.length, 틀림:bad.length };
};

