// =====================================================================
// AI 대화 — Supabase Edge Function
//
// 왜 서버가 필요한가
//   화면은 공개 저장소에 그대로 올라갑니다. 거기 API 키를 두면 전 세계에 공개됩니다.
//   키는 이 함수의 비밀값(Secrets)에만 두고, 화면은 이 함수만 부릅니다.
//
// 올리는 법 (CLI 없이 대시보드에서)
//   1. Supabase → Edge Functions → Deploy a new function → 이름 chat
//   2. 이 파일 내용을 그대로 붙여넣고 Deploy
//   3. Edge Functions → Secrets 에 GEMINI_KEY 추가 (값은 대시보드에만 넣습니다)
//
// 안전장치 (문서 7장)
//   - AI 는 직접 쓰지 않습니다. 말만 하고, 저장은 사용자가 화면에서 합니다.
//   - 여행 자료는 부른 사람의 토큰으로 읽습니다. RLS 가 그대로 걸리므로
//     남의 여행 id 를 넣어도 아무것도 안 나옵니다.
//   - 사용량은 서비스 키로만 셉니다. 화면에서 건너뛸 수 없습니다.
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';   // 판을 못박음(2026-10-16) — 시험한 판 = 배포하는 판

const MODEL = 'gemini-3.6-flash';              // 도쿄 앱에서 쓰던 것과 같은 모델
const MODEL_FALLBACK = 'gemini-3.5-flash-lite'; // 한도(429)에 걸리면 가벼운 쪽으로

/* 관리자가 화면에서 고른 모델(db/047)은 **요청마다** 설정에서 읽어 그 요청 안에서만
   씁니다(아래 핸들러의 `모델`). 예전엔 전역 변수(activeModel)에 담았는데, 한 함수
   인스턴스가 요청 여럿을 동시에 받으므로 설정을 못 읽은 요청이 다른 요청의 값을 그대로
   이어 쓰거나, 관리자가 바꾼 순간 진행 중인 요청의 모델이 중간에 바뀔 수 있었습니다
   (2026-10-16). 설정을 못 읽으면 위의 MODEL 로 갑니다. */

/* ── 시간 예산(2026-10-16) ──────────────────────────────────────────────
   함수 한도(150초)에 닿으면 플랫폼이 546 으로 끊고, 화면은 이유를 모른 채 기다립니다.
   한 요청 전체에 **하나의 마감**을 두고, 바깥 호출 하나하나에도 상한을 둡니다.
   - 요청 전체: 120초(한도 150초 안에서 답을 꾸릴 여유 30초)
   - Gemini 한 번: 60초(장소·주소 모드는 더 짧게 따로 줍니다)
   - Tavily 한 번: 12초
   남은 시간이 모자라면 부르지 않고 599 로 돌려줍니다 — 부르는 쪽은 실패로 다룹니다. */
const 요청예산ms = 120_000;
const GEMINI_한번ms = 60_000;
const TAVILY_한번ms = 12_000;
const 최소남은ms = 3_000;          // 이보다 적게 남았으면 새로 부르지 않습니다

/* ── 입력 상한(2026-10-16) ── 화면 코드는 누구나 고칠 수 있으므로 서버가 다시 봅니다.
   화면이 보내는 실제 크기(불러오기 8,000자 · 리포트 한마디 수백 자)보다 넉넉히. */
const 요청최대바이트 = 9_500_000;   // 사진 넷(합 8MB, base64) + 글
const 글상한 = { chat: 6000, import: 9000, map: 2000 } as const;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });

/* 서버에서 만드는 클라이언트는 세션을 담아 둘 곳도, 토큰을 갱신할 까닭도 없습니다.
   기본값 그대로면 요청마다 클라이언트 둘이 **갱신용 타이머(setInterval)를 켜고 안 끕니다**
   — 시험(chat_handler_test)이 잡았습니다(2026-10-16). Supabase 가 서버에 권하는 설정입니다. */
const 서버용인증 = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

/* ⚠ `extra`(생성 설정 덧붙이기)와 `기다림`(ms, 0 이면 제한 없음)은 b784 에 더했습니다.
   **안 넘기면 예전과 똑같이** 돕니다 — 대화·초안·불러오기는 그대로입니다.
   ⚠⚠ places 모드가 세 줄짜리에도 **150초를 채우고 546(WORKER_RESOURCE_LIMIT)** 으로
     죽었습니다(2026-09-28 실측). 여기엔 시간 제한도 답 길이 제한도 없어서, 모델이
     답을 끝없이 이어 쓰면(JSON 뒤 빈칸 반복이 흔한 꼴) 함수 한도까지 붙잡혀 있습니다.
     제한을 넘기면 코드 599 로 돌려줍니다 — 부르는 쪽이 다른 모델로 넘깁니다.
   2026-10-16: 이제 **모든** 부름에 제한이 있습니다. `기다림`을 안 주면 GEMINI_한번ms,
     `마감`(요청 전체의 끝, ms 시각)을 주면 그보다 늦게까지 기다리지 않습니다.
     연결 오류도 던지지 않고 599 로 돌려줍니다 — 부르는 쪽은 모두 code 로 판단합니다. */
export async function callGemini(model: string, key: string, contents: unknown, temp = 0.7,
                          extra: Record<string, unknown> = {}, 기다림 = 0, 마감 = Infinity) {
  const 남은 = Math.min(기다림 || GEMINI_한번ms, 마감 - Date.now());
  if (!(남은 >= 최소남은ms)) return { code: 599, body: '요청 시간 예산을 다 씀' };
  const ac = new AbortController();
  const 타이머 = setTimeout(() => ac.abort(), 남은);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: temp,
            responseMimeType: 'application/json',   // 제안을 카드로 만들려면 형식이 있어야 합니다
            ...extra,
          },
        }),
        signal: ac.signal,
      },
    );
    return { code: res.status, body: await res.text() };
  } catch (e) {
    return { code: 599, body: String(e) };
  } finally {
    clearTimeout(타이머);
  }
}

/* ── AI 가 «속으로 생각하는» 정도(2026-10-16) ─────────────────────────────────────
 * 실측: 대화 답 하나에 Gemini 가 쓴 글자(토큰)의 70~77% 가 «생각»이었습니다(답 442 · 생각 1,506).
 * 관리자 계정에만 «낮음»을 켜 견줘 봤더니(10-16) 생각 0 · AI 2~3초(전엔 7~18초) · 답 품질 괜찮음(사용자 확인)
 *   → **기본을 «낮음»으로** 했습니다(`기본생각`). 비밀값으로 다시 배포 없이 바꿉니다:
 *   GEMINI_THINKING       = (없음) → low(기본) · none → 설정 안 보냄(예전처럼 모델 마음대로) · high 등 → 그 값
 *   GEMINI_THINKING_ADMIN = 값      → GEMINI_THINKING 이 none 일 때만, 관리자 계정(is_admin)에게만 그 값(견줘 볼 때)
 *   값: minimal · low · medium · high(생각 정도) 또는 숫자(생각에 쓸 토큰 상한). 그 밖의 값이면 안 씁니다.
 * 대화(묻고 답하기)에만 씁니다 — 일정 초안·불러오기·장소·주소는 그대로.
 * 모델이 이 설정을 거절하면(400) 설정 없이 같은 모델로 한 번 더 묻습니다(아래 대화 부분). */
export const 기본생각 = 'low';
export function 생각설정(v: string | undefined | null) {
  const s = String(v ?? '').trim().toLowerCase();
  if (/^(minimal|low|medium|high)$/.test(s)) return { 이름: s, cfg: { thinkingConfig: { thinkingLevel: s } } };
  if (/^\d{1,5}$/.test(s)) return { 이름: s + '토큰', cfg: { thinkingConfig: { thinkingBudget: Number(s) } } };
  return null;
}

/* ── Gemini 오류 한 줄로(2026-10-16) ──────────────────────────────────────────────
 * 예전엔 오류 글을 300자에서 잘라 찍어 «어느 한도가 찼는지»가 잘려 나갔습니다(429 실측).
 * 구글이 같이 주는 상세(QuotaFailure · RetryInfo)를 풀어 이렇게 줄입니다:
 *   «RESOURCE_EXHAUSTED · 하루·무료 요청 한도 20번(gemini-3.6-flash) · 41s 뒤 다시»
 * 꼴이 다르면(JSON 이 아니거나 상세가 없으면) 예전처럼 앞 300자. 열쇠는 오류 글에 안 들어 있습니다. */
/* ── «넣었어요» 거짓말 막기(2026-10-16) ───────────────────────────────────────────
 * AI 는 일정을 직접 못 넣습니다 — 카드를 만들고, 사용자가 눌러야 들어갑니다. 그런데 「2번을 둘째 날
 * 저녁 7시에 넣어줘」에 «'야마오'를 일정에 넣었어요»라고 답했습니다(10-16, 사용자 계정으로 물어봄).
 * 프롬프트에도 «제안만 한다»고 적혀 있었습니다 — 부탁은 안 지켜질 때가 있어, 코드로 고칩니다.
 * AI 가 «이미 한 것처럼» 말하는 꼴만 바꿉니다(넣/담 + 었·어 뒀, 추가·등록·저장 + 했·해 뒀).
 * 사용자가 한 것(«넣으셨어요»)·이미 있는 것(«추가되어 있어요»)은 안 건드립니다.
 *   카드가 있으면 → «넣을 수 있게 아래 카드로 만들었어요» · 없으면 → «넣지는 못했어요» */
export function 완료말고치기(말: string, 카드있음: boolean) {
  const 넣기 = /(넣|담)(?:었|았|[어아]\s?(?:뒀|두었|놨|놓았))(?:어요|습니다)/g;   /* 담 은 «았»(담았어요·담아 뒀어요) */
  const 하기 = /(?:추가|등록|저장)(?:했|해\s?(?:뒀|두었|놨|놓았))(?:어요|습니다)/g;
  return String(말 ?? '')
    .replace(넣기, (_m, 동사: string) => 카드있음
      ? `${동사}을 수 있게 아래 카드로 만들었어요` : `${동사}지는 못했어요`)
    .replace(하기, () => 카드있음
      ? '넣을 수 있게 아래 카드로 만들었어요' : '넣지는 못했어요');
}

export function 오류요약(body: unknown) {
  const 원문 = String(body ?? '');
  try {
    // deno-lint-ignore no-explicit-any
    const e: any = JSON.parse(원문)?.error;
    if (!e) return 원문.slice(0, 300);
    // deno-lint-ignore no-explicit-any
    const 상세: any[] = Array.isArray(e.details) ? e.details : [];
    const 한도 = 상세.flatMap((d) => Array.isArray(d?.violations) ? d.violations : [])
      // deno-lint-ignore no-explicit-any
      .map((v: any) => {
        const id = String(v?.quotaId ?? v?.quotaMetric ?? '');
        const 때 = /PerDay/i.test(id) ? '하루' : /PerMinute/i.test(id) ? '분당' : /PerHour/i.test(id) ? '시간당' : '';
        const 무엇 = /Token/i.test(id) ? '토큰' : '요청';
        const 등급 = /FreeTier/i.test(id) ? '·무료' : '';
        const 값 = v?.quotaValue ? ` ${v.quotaValue}${무엇 === '요청' ? '번' : ''}` : '';
        const 모델 = v?.quotaDimensions?.model ? `(${v.quotaDimensions.model})` : '';
        return 때 ? `${때}${등급} ${무엇} 한도${값}${모델}` : (id || '한도');
      });
    const 대기 = 상세.find((d) => d?.retryDelay)?.retryDelay;
    return [e.status || e.code,
            한도.length ? 한도.join(', ') : String(e.message ?? '').replace(/\s+/g, ' ').slice(0, 160),
            대기 ? `${대기} 뒤 다시` : ''].filter(Boolean).join(' · ');
  } catch {
    return 원문.slice(0, 300);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 웹 검색 (Tavily) — 도쿄 앱에서 옮겨왔습니다.
//
// 왜 필요한가: 영업시간·휴무·가격·평점은 우리가 가진 자료에 없습니다.
// 없으면 "직접 확인이 필요합니다"라고만 답하게 되는데, 그건 안 물어본 것과 같습니다.
//
// 키가 없으면 검색을 건너뛰고 그냥 답합니다. 검색이 안 된다고 대화가 막히면 안 됩니다.
// ─────────────────────────────────────────────────────────────────────
const SEARCH_DEPTH = 'advanced';   // basic 은 스니펫이 100자에서 끊겨 별점이 안 담겼습니다
const SEARCH_MIN_SCORE = 0.45;     // 도쿄 앱 실측: 맞는 결과는 0.63~0.77 에 몰렸습니다

/** 이 질문에 검색이 필요한가. 내 일정만 보면 되는 것은 안 합니다. */
function needsSearch(q: string) {
  const t = String(q || '');
  // 내 자료만 보면 되는 질문 — 검색은 크레딧만 씁니다
  if (/일정\s*정리|정리해|요약|비어|빈\s*시간|여유|중복|겹치|예산|얼마나\s*썼|지출|정산|몇\s*시에|우리\s*호텔|예약번호|체크아웃|체크인/.test(t))
    return false;
  // 바뀌는 정보 — 검색해야 맞습니다
  return /영업|휴무|문\s*여|문\s*닫|오픈|마감|예약\s*필요|웨이팅|대기|혼잡|붐비|붐벼|붐빔|사람\s*많|줄\s*서|공사|임시|휴관|휴점|가격|요금|입장료|얼마|환율|날씨|기온|비\s*[와오]|눈\s*[와오]|우산|지금|축제|이벤트|최신|요즘|현재|올해|근처|주변|추천|맛집|평점|후기/.test(t);
}

/** 물음표와 조사를 걷어내 검색어를 만듭니다. 문장 그대로 넣으면 가게 이름이 묻힙니다. */
function searchQuery(text: string, dest: string) {
  const raw = String(text || '').replace(/[?？!！]/g, ' ').replace(/\s+/g, ' ').trim();
  const isRating = /타베로그|별점|평점|리뷰|후기/.test(raw);
  let t = raw
    .replace(/\s*(알려\s*줘|알려\s*주세요|가르쳐\s*줘|추천\s*해\s*줘|궁금해|어때|어떤가|인가요|일까요|맞나요|이야|예요|에요|인가|나요|까요|까|줘)\s*$/, ' ')
    .replace(/몇\s*점|몇\s*시|얼마나|얼마|어디|언제|어떻게|왜|까지|부터/g, ' ')
    .replace(/지금|오늘|요즘|현재|최근/g, ' ');
  if (isRating) t = t.replace(/타베로그|별점|평점|리뷰|후기|점수/g, ' ');
  // 낱말로 떨어져 있는 조사만. 이름 안의 글자는 건드리지 않습니다.
  t = t.replace(/\s(은|는|이|가|을|를|의|에|에서|으로|로|와|과|랑|도|만)\s/g, ' ')
       .replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!t) t = raw.slice(0, 60);              // 다 걷혔으면 원문으로
  if (isRating) return t;                    // 별점은 가게 이름만. 사이트는 아래에서 좁힙니다
  return (dest ? dest + ' ' : '') + t;
}

/** 어느 사이트 안에서 찾을지. 검색어에 'tabelog' 를 적으면 낱말 하나를
    사이트 이름이 차지해 가게 이름의 비중이 떨어집니다. 그래서 도메인으로 넘깁니다. */
function searchDomains(text: string, country: string) {
  if (/타베로그|별점|평점|리뷰|후기/.test(String(text)) && country === 'JP')
    return ['tabelog.com'];
  return null;
}

/* 2026-10-16: Tavily 부름에 제한 시간이 없었습니다 — 붐비면 요청 전체를 함수 한도까지
   붙잡았습니다. 이제 한 번에 TAVILY_한번ms, 그리고 요청의 `마감`을 넘기지 않습니다.
   모자라면 부르지 않고 null(검색 실패)입니다 — 크레딧도 안 나갑니다. */
// deno-lint-ignore no-explicit-any
export async function webSearch(key: string, admin: any, query: string,
                         n: number, domains: string[] | null, 마감 = Infinity) {
  const ck = query + '|' + (domains?.join(',') ?? '');
  // 같은 검색은 다시 안 합니다. Tavily 는 한 번이 크레딧 한 개입니다 (037).
  try {
    const { data } = await admin.from('search_cache')
      .select('results,created_at').eq('key', ck).maybeSingle();
    if (data && Date.now() - new Date(data.created_at).getTime() < 3600_000) {
      // 보관함이 막아준 것도 셉니다(043). 이게 곧 "아낀 크레딧"입니다.
      admin.rpc('search_bump', { p_hit: true }).then(() => {}, () => {});
      return data.results;
    }
  } catch { /* 보관함이 없어도 검색은 됩니다 */ }

  try {
    // deno-lint-ignore no-explicit-any
    const body: Record<string, any> = {
      query, max_results: n, search_depth: SEARCH_DEPTH,
      include_answer: false, include_raw_content: false,
    };
    if (domains?.length) body.include_domains = domains;

    const 남은 = Math.min(TAVILY_한번ms, 마감 - Date.now());
    if (!(남은 >= 최소남은ms)) return null;
    const ac = new AbortController();
    const 타이머 = setTimeout(() => ac.abort(), 남은);
    let res: Response;
    // deno-lint-ignore no-explicit-any
    let raw: any[];
    try {
      res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      // 여기까지 왔으면 크레딧이 나갔습니다. 결과가 비거나 실패해도 나간 것은
      // 나간 것이라 res.ok 와 상관없이 셉니다 — 안 그러면 실제보다 적게 잡힙니다.
      admin.rpc('search_bump', { p_hit: false }).then(() => {}, () => {});
      if (!res.ok) {
        console.error('tavily', res.status);
        await res.body?.cancel().catch(() => {});
        return null;
      }
      raw = (await res.json())?.results ?? [];   // 본문 읽기도 같은 제한 시간 안입니다
    } finally {
      clearTimeout(타이머);
    }
    if (!Array.isArray(raw)) return null;

    // include_domains 는 강제가 아니라 선호입니다. 건수를 못 채우면 다른 사이트로
    // 메워서, tabelog 로 좁혔는데 위키백과가 섞여 들어왔습니다. 우리가 부른 곳만 남깁니다.
    if (domains?.length) {
      raw = raw.filter((it) => {
        const host = (String(it.url || '').match(/^https?:\/\/([^\/?#]+)/i)?.[1] ?? '')
          .toLowerCase();
        return domains.some((d) =>
          host === d.toLowerCase() || host.endsWith('.' + d.toLowerCase()));
      });
    }
    // 관련도가 낮은 것도 버립니다. 도쿄를 물었는데 이탈리아 블로그가 나온 적이 있습니다.
    // score 가 아예 없는 응답이면(형식이 바뀌면) 거르지 않습니다 —
    // 필터 때문에 검색이 통째로 비는 쪽이 더 나쁩니다.
    raw = raw.filter((it) => typeof it.score !== 'number' || it.score >= SEARCH_MIN_SCORE);

    const items = raw.map((it) => ({
      title: String(it.title || '').slice(0, 80),
      snippet: String(it.content || '').replace(/\s+/g, ' ').slice(0, 600),
      link: String(it.url || ''),
    }));

    try {
      await admin.from('search_cache').upsert({ key: ck, results: items, created_at: new Date() });
      await admin.rpc('sweep_search_cache');   // 오래된 것 치우기
    } catch { /* 못 담아도 답은 나갑니다 */ }
    return items;
  } catch (e) {
    /* 시간 초과·연결 오류. 이름만 남깁니다(열쇠가 실린 머리는 오류 글에 안 들어갑니다). */
    console.error('tavily 실패', (e as Error)?.name ?? 'Error');
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 안전한 바깥 요청 (2026-10-16)
//
// 사용자가 붙여 넣은 주소를 **서버가 대신** 받아 옵니다(블로그 · 지도 단축 주소 · iframe).
// 그 주소는 무엇이든 될 수 있습니다 — `http://169.254.169.254/`(클라우드 메타데이터),
// `http://localhost:…`, 사설망, 또는 그런 곳으로 «리다이렉트하는» 바깥 주소.
// ⚠⚠ 전에는 검사 없이 `redirect:'follow'` 로 끝까지 따라갔고, iframe 주소도 그대로 받았고,
//   지도 단축 주소는 주소 «어디에든» goo.gl 글자가 있으면 받았습니다(?x=goo.gl 로 아무 곳이나).
//   본문 크기도 Content-Length 머리만 믿었습니다(머리가 없거나 거짓이면 끝까지 받음).
//
// 그래서 사용자 주소를 받는 길은 전부 아래 `안전요청` 하나를 지납니다.
//   1. 주소 검사 — http/https · 기본 포트(80/443) · 아이디·비번 없음 · 이름 검사(localhost·
//      .local·.internal·한 낱말 이름) · 숫자로 적힌 IP 가 내부·예약 대역이면 막음.
//      `0x7f.1`·`2130706433` 같은 꼴은 URL 해석기가 `127.0.0.1` 로 풀어 줍니다(WHATWG).
//   2. DNS 검사 — 이름을 IP 로 풀어 **하나라도** 내부·예약 대역이면 막음(이름만 바깥인 척).
//   3. 리다이렉트 — 저절로 안 따라갑니다(redirect:'manual'). 매 단계 1·2 를 다시, 최대 4번.
//   4. 시간 — 처음부터 본문 끝까지 **한 번의** 제한(단계마다 새로 주지 않음).
//   5. 크기 — 본문을 흘려 받으며 상한에서 끊음. 글이 아닌 것(그림·영상)은 안 받음.
//
// ⚠ 남는 위험 — DNS 재바인딩: 우리가 이름을 푼 «직후» IP 가 바뀌면 fetch 가 다시 풀 때 다른
//   곳으로 갈 수 있습니다. Deno 의 fetch 에 «이 IP 로만 연결»을 지정할 길이 없어서입니다.
//   (docs/운영-설정-확인.md 「chat 바깥 요청」)
// ⚠ 이 실행 환경에서 DNS 를 못 풀면(Deno.resolveDns 가 없거나 막힘) 2번을 못 합니다. 그때는
//   «알려진 블로그·지도 이름»만 받고 나머지는 막습니다 — 닫힌 쪽으로 기울입니다.
// ⚠ 시험은 모의 네트워크로만: supabase/tests/chat_safe_fetch_test.ts (`__시험용망` 으로 바꿔 끼움).
// ─────────────────────────────────────────────────────────────────────
/** 이름 → IP 들. null 이면 «이 환경에서는 못 풂». */
type 해석기 = (host: string) => Promise<string[] | null>;

const 바깥최대단계 = 4;

/** 점 넷 IPv4 → 숫자 넷. 아니면 null. */
function v4(ip: string): number[] | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  return p.every((n) => n <= 255) ? p : null;
}
function 막힌v4([a, b, c]: number[]): boolean {
  return a === 0 || a === 10 || a === 127 || a >= 224 ||   // this-net · 사설 · 루프백 · 멀티캐스트·예약
    (a === 100 && b >= 64 && b <= 127) ||                   // CGNAT 100.64/10
    (a === 169 && b === 254) ||                             // 링크 로컬(메타데이터 169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) ||                    // 사설
    (a === 192 && b === 168) ||                             // 사설
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||       // IETF · TEST-NET-1
    (a === 192 && b === 88 && c === 99) ||                  // 6to4 릴레이
    (a === 198 && (b === 18 || b === 19)) ||                // 벤치마크
    (a === 198 && b === 51 && c === 100) ||                 // TEST-NET-2
    (a === 203 && b === 0 && c === 113);                    // TEST-NET-3
}
/** IPv6 → 16바이트. 못 읽으면 null. `::ffff:1.2.3.4` 처럼 끝에 IPv4 가 붙은 꼴도 읽습니다. */
function v6(ip: string): number[] | null {
  let s = ip.replace(/^\[|\]$/g, '').toLowerCase();
  const 영역 = s.indexOf('%'); if (영역 >= 0) s = s.slice(0, 영역);        // fe80::1%eth0
  let 꼬리: number[] | null = null;
  const m = s.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (m) { 꼬리 = v4(m[2]); if (!꼬리) return null; s = m[1] + 'X'; }     // 두 칸을 X 하나로
  const 반 = s.split('::');
  if (반.length > 2) return null;
  const 쪼개 = (t: string) => (t ? t.split(':') : []);
  const 앞 = 쪼개(반[0]), 뒤 = 반.length === 2 ? 쪼개(반[1]) : [];
  const 칸수 = (a: string[]) => a.reduce((n, x) => n + (x === 'X' ? 2 : 1), 0);
  const 빈칸 = 반.length === 2 ? 8 - 칸수(앞) - 칸수(뒤) : 0;
  if (반.length === 1 && 칸수(앞) !== 8) return null;
  if (빈칸 < 0) return null;
  const out: number[] = [];
  for (const g of [...앞, ...Array(빈칸).fill('0'), ...뒤]) {
    if (g === 'X') { out.push(...꼬리!); continue; }
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const n = parseInt(g, 16); out.push(n >> 8, n & 255);
  }
  return out.length === 16 ? out : null;
}
function 막힌v6(b: number[]): boolean {
  const 영 = (i: number, j: number) => b.slice(i, j).every((x) => x === 0);
  const 품은 = b.slice(12);
  if (영(0, 16) || (영(0, 15) && b[15] === 1)) return true;                  // :: · ::1
  if (영(0, 10) && b[10] === 0xff && b[11] === 0xff) return 막힌v4(품은);     // ::ffff:a.b.c.d
  if (영(0, 12)) return 막힌v4(품은);                                          // ::a.b.c.d(옛 호환)
  if (b[0] === 0 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && 영(4, 12)) return 막힌v4(품은); // 64:ff9b:: NAT64
  if ((b[0] & 0xfe) === 0xfc) return true;                                    // fc00::/7 사설(ULA)
  if (b[0] === 0xfe && (b[1] & 0x80) === 0x80) return true;                   // fe80::/10 · fec0::/10
  if (b[0] === 0xff) return true;                                             // 멀티캐스트
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true; // 2001:db8:: 문서용
  if (b[0] === 0x01 && 영(1, 8)) return true;                                 // 100::/64 버림
  return false;
}
/** 내부·예약 주소인가. 못 읽는 것도 막습니다(닫힌 쪽). */
export function 막힌주소(ip: string): boolean {
  const a = v4(ip); if (a) return 막힌v4(a);
  const b = v6(ip); if (b) return 막힌v6(b);
  return true;
}

/* DNS 를 못 푸는 환경에서도 받는 이름 — 이 기능이 실제로 받는 곳들(블로그·지도). */
const 알려진이름 = /(^|\.)(naver\.com|naver\.me|tistory\.com|brunch\.co\.kr|velog\.io|blogspot\.com|wordpress\.com|medium\.com|goo\.gl|google\.(com|co\.[a-z]{2}|[a-z]{2}))$/;

/* DNS 한 번에 기다리는 상한(2026-10-16 — 밖 리뷰 지적). 전엔 제한이 없어, DNS 가 답을 안 주면 아래
   `안전요청` 의 제한 시간과 상관없이 그만큼 붙잡혔습니다(제한 시간은 fetch 에만 걸려 있었음).
   넘으면 «확인 불가»(null) — 알려진 블로그·지도만 받습니다. */
const DNS_한번ms = 3000;

export const 기본해석: 해석기 = async (host) => {
  // deno-lint-ignore no-explicit-any
  const R = (Deno as any).resolveDns;
  if (typeof R !== 'function') return null;
  const ac = new AbortController();
  let 못씀 = false;
  const 묻기 = async (t: string): Promise<string[]> => {
    try { return await R(host, t, { signal: ac.signal }) as string[]; }
    catch (e) { if (e instanceof Deno.errors.NotFound) return []; 못씀 = true; return []; }
  };
  let 타이머 = 0;
  const 늦음 = new Promise<'늦음'>((ok) => { 타이머 = setTimeout(() => { ac.abort(); ok('늦음'); }, DNS_한번ms); });
  try {
    const 답 = await Promise.race([Promise.all([묻기('A'), 묻기('AAAA')]), 늦음]);
    if (답 === '늦음') return null;
    const [a, b] = 답;
    if (못씀 && !a.length && !b.length) return null;
    return [...a, ...b];
  } finally { clearTimeout(타이머); }
};

/* 끊김 신호가 오면 기다리던 것을 내려놓습니다(DNS 처럼 스스로는 안 끊기는 일에 씀). */
function 끊기면그만<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException('aborted', 'AbortError'));
  return new Promise<T>((ok, bad) => {
    const 그만 = () => bad(new DOMException('aborted', 'AbortError'));
    signal.addEventListener('abort', 그만, { once: true });
    p.then((v) => { signal.removeEventListener('abort', 그만); ok(v); },
           (e) => { signal.removeEventListener('abort', 그만); bad(e); });
  });
}

/* 시험이 모의 네트워크를 끼울 자리. 운영에서는 진짜 fetch·DNS 입니다. */
const 바깥망 = { fetch: (u: string, i?: RequestInit) => fetch(u, i), resolve: 기본해석 };
export function __시험용망(x: { fetch?: typeof 바깥망.fetch; resolve?: 해석기 }) {
  if (x.fetch) 바깥망.fetch = x.fetch;
  if (x.resolve) 바깥망.resolve = x.resolve;
}

export async function 주소검사(raw: string, 해석: 해석기 = 바깥망.resolve):
    Promise<{ ok: true; url: URL } | { ok: false; why: string }> {
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, why: '주소 꼴이 아님' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, why: 'http·https 만 받음' };
  if (u.username || u.password) return { ok: false, why: '아이디·비번이 든 주소' };
  if (u.port && u.port !== '80' && u.port !== '443') return { ok: false, why: '기본 포트가 아님' };
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return { ok: false, why: '이름이 없음' };
  if (v4(host) || host.startsWith('['))
    return 막힌주소(host) ? { ok: false, why: '내부·예약 주소' } : { ok: true, url: u };
  if (host === 'localhost' || /\.(localhost|local|internal|home\.arpa|lan)$/.test(host) || !host.includes('.'))
    return { ok: false, why: '내부 이름' };
  const ips = await 해석(host).catch(() => null);
  if (ips === null)
    return 알려진이름.test(host) ? { ok: true, url: u }
                                 : { ok: false, why: 'DNS 확인 불가 — 알려진 블로그·지도만 받음' };
  if (!ips.length) return { ok: false, why: '이름을 못 찾음' };
  if (ips.some(막힌주소)) return { ok: false, why: '이름이 내부·예약 주소로 풀림' };
  return { ok: true, url: u };
}

/** 본문을 상한(바이트)까지만 흘려 받습니다. 넘으면 그 자리에서 끊고 나머지는 안 받습니다. */
async function 상한까지(res: Response, max: number): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) return { text: '', truncated: false };
  const r = res.body.getReader();
  const 조각: Uint8Array[] = []; let n = 0, 잘림 = false;
  while (true) {
    const { done, value } = await r.read();
    if (done) break;
    const 남은 = max - n;
    if (value.length >= 남은) {
      조각.push(value.subarray(0, 남은)); n += 남은; 잘림 = true;
      await r.cancel().catch(() => {});
      break;
    }
    조각.push(value); n += value.length;
  }
  const 합 = new Uint8Array(n); let k = 0;
  for (const c of 조각) { 합.set(c, k); k += c.length; }
  return { text: new TextDecoder().decode(합), truncated: 잘림 };
}

export type 안전응답 =
  | { ok: true; status: number; url: string; text: string; truncated: boolean }
  | { ok: false; why: string };

/** 사용자가 준 주소를 받는 **유일한** 길. 실패는 던지지 않고 {ok:false, why} 로 돌려줍니다. */
export async function 안전요청(raw: string, o: {
  ms: number; maxBytes: number; headers?: Record<string, string>;
  maxRedirects?: number; signal?: AbortSignal;
}): Promise<안전응답> {
  const ac = new AbortController();
  const 끊기 = () => ac.abort();
  const t = setTimeout(끊기, o.ms);
  if (o.signal?.aborted) ac.abort();
  o.signal?.addEventListener('abort', 끊기, { once: true });
  const 버리기 = (res: Response) => res.body?.cancel().catch(() => {});
  try {
    let 지금 = raw;
    for (let 단계 = 0; ; 단계++) {
      /* 주소 검사(DNS 포함)도 이 요청의 제한 시간 안에서 — 넘으면 아래 catch 에서 «시간 초과». */
      const 검 = await 끊기면그만(주소검사(지금), ac.signal);
      if (!검.ok) return { ok: false, why: 검.why };
      if (ac.signal.aborted) return { ok: false, why: '시간 초과' };
      const res = await 바깥망.fetch(검.url.href, { signal: ac.signal, redirect: 'manual', headers: o.headers });
      const 갈곳 = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && 갈곳) {
        await 버리기(res);
        if (단계 >= (o.maxRedirects ?? 바깥최대단계)) return { ok: false, why: '리다이렉트가 너무 많음' };
        try { 지금 = new URL(갈곳, 검.url).href; } catch { return { ok: false, why: '리다이렉트 주소가 이상함' }; }
        continue;
      }
      const 종류 = (res.headers.get('content-type') || '').toLowerCase();
      if (종류 && !/text\/|html|xml|json/.test(종류)) { await 버리기(res); return { ok: false, why: '글이 아님' }; }
      if (Number(res.headers.get('content-length') || 0) > o.maxBytes * 4) { await 버리기(res); return { ok: false, why: '너무 큼' }; }
      const { text, truncated } = await 상한까지(res, o.maxBytes);
      return { ok: true, status: res.status, url: 검.url.href, text, truncated };
    }
  } catch {
    return { ok: false, why: ac.signal.aborted ? '시간 초과' : '받지 못함' };
  } finally {
    clearTimeout(t);
    o.signal?.removeEventListener('abort', 끊기);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 블로그 글 읽어오기 — 도쿄 앱에서 옮겨왔습니다.
//
// 남이 짜둔 일정이나 맛집 목록은 대부분 블로그에 있습니다.
// 링크만 던지면 우리가 읽어서 정리합니다. 하나하나 옮겨 적는 수고를 없애는 것이 목적입니다.
//
// 네이버는 본문을 iframe 안에 넣어서, 원래 주소로 받으면 23자짜리 껍데기만 옵니다.
// m.blog.naver.com(모바일)으로 바꾸면 본문이 그대로 옵니다 — 도쿄 앱에서 실측한 것입니다.
//
// 실패하면 null. 부르는 쪽은 없으면 없는 대로 갑니다.
// ─────────────────────────────────────────────────────────────────────
const BLOG_MS   = 8000;   // 한 곳당 최대 대기. 넘으면 버립니다
const BLOG_MAX  = 3;      // 한 번에 읽을 링크 수
const BLOG_CHARS = 9000;  // 한 글에서 가져갈 글자 수
const HTML_MAX  = 400_000; // 받아서 들고 있을 HTML 최대 크기. 본문은 앞쪽에 있습니다

// 본문이 들어 있을 만한 자리. **위에서부터** 찾아 처음 걸리는 것을 씁니다.
// 네이버만 보고 있었더니 티스토리·브런치·벨로그는 페이지 전체가 넘어가서
// 메뉴·사이드바 글자가 일정으로 둔갑했습니다.
const BODY_PATTERNS: RegExp[] = [
  /<div[^>]*class="[^"]*se-main-container[^"]*"[\s\S]*?<\/body>/i,  // 네이버 스마트에디터
  /<div[^>]*id="postViewArea"[\s\S]*?<\/body>/i,                    // 네이버 구 에디터
  /<div[^>]*class="[^"]*(entry-content|article_view|tt_article_useless_p_margin)[^"]*"[\s\S]*?<\/body>/i, // 티스토리
  /<div[^>]*class="[^"]*wrap_body[^"]*"[\s\S]*?<\/body>/i,          // 브런치
  /<article[\s\S]*?<\/article>/i,                                   // 표준
  /<main[\s\S]*?<\/main>/i,
];

/** 시간 제한을 건 받기. 없으면 느린 블로그 하나가 요청 전체를 붙잡습니다.
 *  ⚠ 2026-10-16 부터 `안전요청` 을 지납니다(위 머리말) — 주소·리다이렉트 매 단계·DNS 검사. */
async function fetchText(u: string, ms: number, signal?: AbortSignal) {
  // ── 크기를 재고 받습니다 ──
  // 크기를 안 재고 받으면 큰 페이지에서 손해입니다. 네이버·티스토리 글 한 장의 HTML 이
  // 수 MB 인데 그걸 **셋을 동시에** 받아서, 각각 정규식 여덟 번을 통과시켰습니다.
  // replace 는 그때마다 문자열을 통째로 새로 만듭니다 — 3장 × 3MB × 8번이면
  // 수십 MB 가 순식간에 오갑니다. 로그에 예외 한 줄 없이 shutdown 만 찍힌 것이
  // 그 흔적입니다(예외가 났으면 Uncaught 가 남습니다).
  // 본문은 앞쪽에 있습니다. 뒤쪽은 댓글·추천글·꼬리말이라 잘라도 손해가 없습니다.
  // ⚠ 전에는 Content-Length 머리만 보고 거르고 `res.text()` 로 끝까지 받았습니다 — 머리가
  //   없거나 거짓이면 그대로 다 받았습니다. 이제 흘려 받으며 HTML_MAX 바이트에서 끊습니다.
  const r = await 안전요청(u, {
    ms, maxBytes: HTML_MAX, signal,
    headers: {
      // 모바일 브라우저인 척해야 모바일 본문이 옵니다.
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
                    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile Safari/604.1',
      'Accept-Language': 'ko,en;q=0.8',
    },
  });
  if (!r.ok || r.status < 200 || r.status >= 300) return null;   // 시간 초과·막힌 주소도 여기로
  return r.text;
}

function htmlToText(html: string) {
  let body = html;
  for (const p of BODY_PATTERNS) {
    const m = html.match(p);
    if (m) { body = m[0]; break; }
  }
  // 아래 replace 여덟 번이 그때마다 문자열을 통째로 새로 만듭니다.
  // 본문 자리를 찾았어도 넉넉히 잘라두고 시작합니다 — 우리가 쓸 것은 9000자입니다.
  if (body.length > 120_000) body = body.slice(0, 120_000);
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    // 본문 영역을 못 찾아 페이지 전체를 쓰게 됐을 때 메뉴·꼬리말을 걷어냅니다.
    .replace(/<(nav|header|footer|aside|form|select)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function readBlog(raw: string, signal?: AbortSignal) {
  let u = String(raw || '').trim().replace(/[)\]},.;]+$/, '');  // 문장 끝 기호가 붙어 옵니다
  if (!/^https?:\/\//i.test(u)) return null;
  // 네이버는 본문을 iframe 안에 넣어서 원래 주소로 받으면 껍데기만 옵니다.
  u = u.replace('://blog.naver.com', '://m.blog.naver.com');

  let html = await fetchText(u, BLOG_MS, signal);
  let text = html ? htmlToText(html) : '';

  // 네이버 구형 주소는 모바일로 바꿔도 iframe 껍데기가 옵니다.
  // 그 안에 진짜 주소가 적혀 있으니 한 번만 따라 들어갑니다.
  if (html && text.length < 200) {
    const inner = html.match(/<iframe[^>]+src="([^"]+)"/i)?.[1];
    if (inner) {
      /* ⚠ iframe 주소는 **남이 쓴 페이지**가 정합니다 — `<iframe src="http://169.254.169.254/">`
         를 넣은 글을 링크로 주면 서버가 거기로 갔습니다. 이제 fetchText → 안전요청 이 같은
         검사를 합니다. 상대 주소는 예전처럼 m.blog.naver.com 기준으로 풉니다(`//다른곳` 꼴도). */
      let abs = '';
      try { abs = new URL(inner.replace(/&amp;/g, '&'), 'https://m.blog.naver.com/').href; } catch { /* 이상한 주소는 버림 */ }
      html = abs ? await fetchText(abs, BLOG_MS, signal) : null;
      text = html ? htmlToText(html) : '';
    }
  }

  // 너무 짧으면 껍데기만 온 것입니다. 그걸 근거로 답하면 지어내게 됩니다.
  if (text.length < 200) return null;
  return text.slice(0, BLOG_CHARS);
}

/**
 * 글에서 링크를 찾아 **한꺼번에** 읽습니다.
 * 하나씩 읽으면 세 개에 24초가 걸립니다 — 서로 기다릴 이유가 없습니다.
 * 읽었는지 못 읽었는지를 같이 돌려줍니다. 조용히 실패하면 사용자는
 * "왜 링크를 무시하지?"만 알고 이유를 모릅니다.
 */
// ─────────────────────────────────────────────────────────────────────
// 구글 지도 링크 — **HTML 을 읽으면 안 됩니다.**
//
// 2026-08-06 실측 (https://www.google.com/maps/place/Tokyo+Tower/@35.65,139.74,17z):
//   HTML 216,226자를 받았는데 글자로 바꾸면 **124자**
//   "Google 지도를 보려면 자바스크립트를 사용 설정하세요."
//   og:title 은 "Google Maps" — 장소 이름이 아닙니다.
//
// 지도는 자바스크립트로 그려서 HTML 안에 장소 이름이 없습니다. 그래서
// readBlog 의 "200자 미만이면 껍데기" 검사에 걸려 통째로 버려졌고,
// 사용자에게는 "링크를 못 읽었어요"로만 보였습니다.
//
// **필요한 것은 주소 안에 이미 다 있습니다.** 받아올 이유가 없습니다.
//   /maps/place/<이름>/@<위도>,<경도>,17z
//   /maps/search/<검색어>      ?q=<검색어>      !3d<위도>!4d<경도>
// maps.app.goo.gl 같은 단축 주소만 한 번 따라가 최종 주소를 얻습니다.
// ─────────────────────────────────────────────────────────────────────
const GMAP_RE = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:google\.[a-z.]+\/maps|goo\.gl\/maps|maps\.app\.goo\.gl|maps\.google\.[a-z.]+)/i;
const isGoogleMap = (u: string) => GMAP_RE.test(String(u || '').trim());

/** 단축 주소를 펼칩니다. 실패하면 원래 주소를 그대로 씁니다. */
async function unshortenMap(u: string, signal?: AbortSignal) {
  /* ⚠ 전에는 `/goo\.gl/` 글자가 주소 «어디에든» 있으면 받았습니다 — `http://내부주소/?goo.gl`
     꼴로 아무 곳이나 받게 할 수 있었습니다. 이제 **주소의 이름**이 goo.gl 일 때만 받습니다. */
  let host = '';
  try { host = new URL(u).hostname.toLowerCase(); } catch { return u; }
  if (host !== 'goo.gl' && !host.endsWith('.goo.gl')) return u;   // 이미 긴 주소면 받아올 이유가 없습니다
  try {
    // **UA 를 진짜 브라우저로 바꿨다가 되돌렸습니다.** 그러면 구글이
    // 동의 페이지(consent.google.com)로 보내서, 이름조차 못 뽑게 됐습니다 —
    // 고치기 전보다 나빠졌습니다. 재보고 알았습니다. 원래대로 둡니다.
    // ⚠ 리다이렉트는 안전요청 이 한 단계씩 검사하며 따라갑니다(최종 주소는 r.url).
    const r = await 안전요청(u, { ms: BLOG_MS, maxBytes: HTML_MAX, headers: { 'user-agent': 'Mozilla/5.0' }, signal });
    if (!r.ok) return u;
    const res = { url: r.url };
    const html = r.text;

    // 보통은 302 를 따라가면 res.url 이 긴 주소입니다.
    // 동의 페이지처럼 **지도 주소가 아닌 곳**으로 갔으면 그건 쓰면 안 됩니다.
    //
    // **여기서 `/maps/` 가 들어 있는지로 걸렀다가 물렸습니다.**
    // 이 링크는 `maps.google.com/?q=…` 꼴로 펴지는데 거기엔 `/maps/` 가
    // 없습니다. 그래서 멀쩡한 주소를 버리고 "위치를 못 찾았어요"가 됐습니다.
    // 위에 이미 그 판단을 하는 isGoogleMap 이 있었습니다 — 새로 쓰지 말고
    // 그걸 씁니다. 같은 판단을 두 벌로 적으면 이렇게 갈립니다.
    let full = (res.url && !/goo\.gl/i.test(res.url) && isGoogleMap(res.url))
      ? res.url : '';
    // 302 가 아니라 HTML 로 넘기는 판도 있습니다(meta refresh·스크립트).
    if (!full){
      const m = html.match(/https?:\/\/(?:www\.)?google\.[a-z.]+\/maps\/[^"'\s<>\\]+/i);
      if (m) full = m[0].replace(/&amp;/g, '&');
    }
    if (!full) return u;

    // **주소에 좌표가 없어도 본문에는 남아 있습니다.** 지도 페이지는
    // !3d위도!4d경도 를 어디엔가 싣습니다. 주워서 주소에 붙이면
    // parseMapUrl 이 그대로 읽습니다.
    if (!/@-?\d+\.\d+,-?\d+\.\d+|!3d-?\d+\.\d+/.test(full)){
      const c = html.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
             || html.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (c) full += (full.includes('?') ? '&' : '?') + `t2=!3d${c[1]}!4d${c[2]}`;
    }
    return full;
  } catch { return u; }
}

/** 주소에서 장소 이름과 좌표를 뽑습니다. 글자 하나도 받아오지 않습니다. */
function parseMapUrl(raw: string) {
  let name = '', lat: string | null = null, lng: string | null = null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }

  const path = decodeURIComponent(url.pathname);
  // 이름: /maps/place/<이름>/  또는 /maps/search/<검색어>
  const mp = path.match(/\/maps\/(?:place|search)\/([^/@]+)/);
  if (mp) name = mp[1].replace(/\+/g, ' ').trim();
  // ?q= · ?query= 로 오는 판도 있습니다
  if (!name) name = (url.searchParams.get('q') || url.searchParams.get('query') || '').trim();
  // 이름 자리에 좌표만 들어 있는 경우가 있습니다("35.6,139.7"). 이름이 아닙니다.
  if (/^[-\d.]+,\s*[-\d.]+$/.test(name)) name = '';

  // 좌표: @위도,경도  →  없으면 !3d위도!4d경도  →  없으면 ?q=위도,경도
  const at = raw.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const d3 = raw.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const qc = (url.searchParams.get('q') || '').match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
  // !3d/!4d 가 **장소 자체**의 좌표이고 @ 는 지도 화면의 중심입니다.
  // 둘이 다를 수 있으니 !3d 를 먼저 봅니다.
  const hit = d3 || at || qc;
  if (hit){ lat = hit[1]; lng = hit[2]; }

  if (!name && !lat) return null;             // 건질 게 없으면 링크로 취급하지 않습니다
  return { name, lat, lng };
}

async function readGoogleMap(raw: string, signal?: AbortSignal) {
  const full = await unshortenMap(String(raw || '').trim().replace(/[)\]},.;]+$/, ''), signal);
  const got = parseMapUrl(full);
  if (!got) return null;
  // 글(모델에게 줄 것)과 값(우리가 그대로 쓸 것)을 같이 돌려줍니다.
  return {
    text: [
      got.name ? `장소: ${got.name}` : '장소: (이름이 주소에 없음)',
      got.lat ? `좌표: ${got.lat}, ${got.lng}` : '',
    ].filter(Boolean).join('\n'),
    place: got,
  };
}

/* 시험(supabase/tests/chat_safe_fetch_test.ts)이 부르려고 내보냅니다 — 하는 일은 그대로입니다. */
/* `signal` — 요청 마감(2026-10-16): 끊기면 받던 링크를 다 내려놓습니다. */
export async function readLinks(message: string, signal?: AbortSignal) {
  const urls = [...new Set(String(message ?? '')
    .match(/https?:\/\/[^\s<>"']+/g) ?? [])].slice(0, BLOG_MAX);
  if (!urls.length) return { block: '', report: [] as { link: string; ok: boolean }[] };

  const got = await Promise.all(urls.map(async (u) => {
    if (!isGoogleMap(u)) return { link: u, map: false, text: await readBlog(u, signal), place: null };
    const r = await readGoogleMap(u, signal);
    return { link: u, map: true, text: r?.text ?? null, place: r?.place ?? null };
  }));
  const okOnes = got.filter((g) => g.text);

  const block = okOnes.length
    ? okOnes.map((g) => g.map
        /* 지도 링크는 **장소 하나를 콕 집어 준 것**입니다. 블로그처럼
           "골라 쓰라"고 하면 모델이 흘려보냅니다. 반드시 넣으라고 못 박고,
           좌표는 지어내지 말고 준 값을 그대로 쓰라고 합니다 — 좌표가 틀리면
           이동 시간 검사가 통째로 어긋납니다. */
        ? `\n[사용자가 준 구글 지도 링크] ${g.link}\n` +
          '이 장소는 사용자가 직접 고른 것이다. **반드시 결과에 넣는다.**\n' +
          '좌표가 적혀 있으면 lat·lng 에 그 값을 그대로 쓴다. 어림잡지 않는다.\n' +
          '날짜를 알 수 없으면 일정이 아니라 후보(places)로 낸다.\n' +
          g.text + '\n[지도 끝]\n'
        : `\n[사용자가 준 글] ${g.link}\n` +
          '아래는 그 글의 본문이다. 메뉴·댓글·광고 문구가 섞여 있으니 장소 정보만 골라 쓴다.\n' +
          g.text + '\n[글 끝]\n').join('')
    : '';

  return {
    block,
    report: got.map((g) => ({ link: g.link, ok: !!g.text })),
    /* 지도에서 뽑은 장소를 **그대로** 넘깁니다. 모델을 거치지 않습니다 —
       이름과 좌표를 이미 정확히 쥐고 있는데 다시 물으면 틀립니다.
       실측(2026-08-06): 콜로세움 링크를 넘겼더니 링크는 읽었는데(ok:true)
       actions·places 가 **둘 다 빈 배열**로 왔습니다. 장소 하나에 날짜가
       없으니 모델이 "옮길 일정이 없다"고 판단한 것입니다. */
    maps: got.map((g) => g.place).filter(Boolean) as { name:string; lat:string|null; lng:string|null }[],
  };
}

// ─────────────────────────────────────────────────────────────────────
// 불러오기를 나눠서 동시에
//
// 한 덩어리로 보내면 글이 길수록 오래 걸립니다. 걸리는 시간의 대부분은
// **모델이 답을 써 내려가는 시간**이라 입력이 길면 뽑을 일정도 많아집니다.
// 셋으로 나눠 한꺼번에 보내면 제일 긴 조각만큼만 걸립니다.
//
// **AI 사용 횟수는 그대로 1회입니다.** 세는 것은 ai_take 이고 그건 요청당
// 한 번만 부릅니다. 우리 쪽 비용만 늘고 사용자 한도는 안 닳습니다.
//
// 사진이 붙어 있으면 나누지 않습니다 — 사진은 쪼갤 수가 없고,
// 사진마다 어느 조각에 넣을지 정할 근거도 없습니다.
// ─────────────────────────────────────────────────────────────────────
const IMP_CHUNK = 3500;    // 조각 하나의 글자 수
const IMP_PARTS = 3;       // 최대 조각 수

/** 줄 단위로 자릅니다. 문장 중간에서 끊으면 그 일정이 통째로 사라집니다. */
function splitText(s: string, size: number, maxParts: number) {
  const lines = s.split('\n');
  const out: string[] = [];
  let cur = '';
  for (const ln of lines) {
    if (cur && cur.length + ln.length + 1 > size) { out.push(cur); cur = ''; }
    cur += (cur ? '\n' : '') + ln;
  }
  if (cur) out.push(cur);
  if (out.length <= maxParts) return out;
  // 너무 잘게 나뉘었으면 앞에서부터 뭉쳐 개수를 맞춥니다.
  const per = Math.ceil(out.length / maxParts), merged: string[] = [];
  for (let i = 0; i < out.length; i += per) merged.push(out.slice(i, i + per).join('\n'));
  return merged;
}

/** 한 번 물어보고 글자만 꺼냅니다. 한도(429)에 걸리면 가벼운 모델로 한 번 더. */
// deno-lint-ignore no-explicit-any
async function askGemini(key: string, contents: any[], fast: boolean,
                         모델: string, 마감: number) {
  // 불러오기는 '읽어서 옮기기'입니다. 추론이 아니라 추출이라 가벼운 모델로 충분하고
  // 훨씬 빠릅니다. 실측: 큰 모델로 34초였습니다. 실패하면 큰 모델로 한 번 더.
  // temperature 0 — 옮겨 적는 일에 창의성은 손해입니다.
  /* 한때 fast 를 "가벼운 모델로 바꾸기"로 썼습니다. 34초 → 13초가 됐지만
     **같은 자료에서 일정이 18개에서 15개로 줄었습니다.** 불러오기에서 빠지는 것은
     느린 것보다 나쁩니다 — 사용자는 3개가 없어진 줄 모르고 넘어갑니다.
     모델은 되돌리고, fast 는 이제 **temperature 0** 만 뜻합니다.
     옮겨 적는 일에 무작위성은 손해라 그것만은 남깁니다. */
  const first = 모델;
  const second = MODEL_FALLBACK;
  let r = await callGemini(first, key, contents, fast ? 0 : 0.7, {}, 0, 마감);
  /* 실패하면 **왜** 실패했는지 남깁니다. 성공 경로에만 로그를 두었더니
     TIMING 이 통째로 사라졌고, 그러면 "안 찍힌다"만 알고 이유를 모릅니다. */
  if (r.code !== 200){
    console.log(`ASK ${first} -> ${r.code} ${오류요약(r.body)}`);
    r = await callGemini(second, key, contents, fast ? 0 : 0.7, {}, 0, 마감);
    if (r.code !== 200)
      console.log(`ASK ${second} -> ${r.code} ${오류요약(r.body)}`);
  }
  if (r.code !== 200) return null;
  try {
    const parts = JSON.parse(r.body)?.candidates?.[0]?.content?.parts ?? [];
    const t = parts.map((p: { text?: string }) => p.text ?? '').join('').trim();
    return t || null;
  } catch { return null; }
}

/** 두 좌표 사이 거리(km). 이동 시간과 "너무 먼 좌표 버리기"에 씁니다. */
function distKm(a: number, b: number, c: number, d: number) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (c - a) * r, dLng = (d - b) * r;
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* 요청 하나를 처리합니다. 시험(supabase/tests/chat_handler_test.ts)이 서버 없이 부르려고
   이름을 붙여 내보냅니다 — 하는 일은 예전 Deno.serve(async (req) => …) 와 같습니다. */
export async function 처리(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // ── 단계별 시간 재기 ──
  // 로그에 EarlyDrop(클라이언트가 먼저 끊음)만 찍히고 메모리·CPU 는 멀쩡했습니다
  // (11.8MB / 59ms). 서버가 죽은 게 아니라 브라우저가 기다리다 놓은 것입니다.
  // 그럼 **어디서 오래 걸리는지**를 알아야 하는데 그것도 짐작이었습니다.
  // 각 단계가 몇 ms 인지 찍습니다. 함수 로그에서 그대로 보입니다.
  const T0 = Date.now();
  const lap: string[] = [];
  const mark = (name: string) => lap.push(`${name} ${Date.now() - T0}ms`);
  /* 요청 전체의 끝(위 「시간 예산」). 바깥 호출은 모두 이 시각을 넘기지 않습니다.
     화면이 «이만큼만 기다린다»(wait_ms)고 알려 오면 그보다 앞당깁니다(아래 마감맞추기). */
  let 마감 = T0 + 요청예산ms;
  /* ── 마감 신호(2026-10-16 — 밖 리뷰: «입력 읽기·DB 조회·검색·모델 호출이 같은 마감을 따르게») ──
     Gemini·Tavily 는 `마감` 시각으로 스스로 끊지만, 입력 읽기·DB 조회·링크 읽기는 끊을 길이 없었습니다.
     마감이 되면 이 신호가 켜지고, 그 셋이 다 이 신호로 멈춥니다(DB 는 아래 `마감fetch` 하나로 전부). */
  const 끊김 = new AbortController();
  let 끊김타이머 = setTimeout(() => 끊김.abort(), 요청예산ms);
  const 마감맞추기 = (ms: number) => {
    마감 = Math.min(마감, T0 + ms);
    clearTimeout(끊김타이머);
    끊김타이머 = setTimeout(() => 끊김.abort(), Math.max(0, 마감 - Date.now()));
  };
  const 마감fetch = ((input: string | URL | Request, init: RequestInit = {}) =>
    fetch(input, { ...init, signal: init.signal ? AbortSignal.any([init.signal, 끊김.signal]) : 끊김.signal })
  ) as typeof fetch;
  /* 사용자에게는 쉬운 말과 이 번호만, 로그에는 자세한 까닭과 이 번호를 남깁니다.
     문의가 오면 번호로 로그를 찾습니다(2026-10-16 — 전에는 내부 오류 글을 그대로 돌려줬습니다). */
  const 요청번호 = crypto.randomUUID().slice(0, 8);
  const 늦음말 = '답을 만드는 데 시간이 너무 걸렸어요. 잠시 뒤 다시 해주세요.';
  const 내부오류 = (어디: string, e: unknown, 말 = '잠시 문제가 생겼어요. 조금 뒤 다시 해주세요.',
                    status = 500) => {
    // deno-lint-ignore no-explicit-any
    const x = e as any;
    console.error(`[${요청번호}] ${어디}`, x?.code ?? '', String(x?.message ?? x ?? '').slice(0, 300),
                  끊김.signal.aborted ? '(마감 지남)' : '');
    /* 마감에 걸려 생긴 실패면 «시간이 너무 걸렸다»고 말합니다(DB 가 끊겨 난 오류도 여기로 옵니다). */
    if (끊김.signal.aborted) return json({ error: 늦음말, ref: 요청번호, timeout: true }, 504);
    return json({ error: 말, ref: 요청번호 }, status);
  };

  try {
    const key = Deno.env.get('GEMINI_KEY');
    if (!key) return json({ error: 'AI 기능이 아직 준비되지 않았어요. 만든 사람에게 알려주세요.' }, 500);

    const auth = req.headers.get('Authorization') ?? '';
    if (!auth) return json({ error: '로그인이 필요해요.' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    // 부른 사람의 토큰으로 읽습니다 — RLS 가 그대로 걸립니다.
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth }, fetch: 마감fetch }, auth: 서버용인증,
    });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: '로그인이 필요해요.' }, 401);

    mark('auth');
    /* 크기를 먼저 봅니다 — 다 받은 뒤에 보면 이미 메모리에 올라온 뒤입니다.
       Content-Length 가 없는(나눠 보내는) 요청도 흘려 받으며 상한에서 끊습니다. */
    if (Number(req.headers.get('content-length') ?? 0) > 요청최대바이트)
      return json({ error: '보낸 것이 너무 커요. 사진을 줄이거나 나눠서 보내주세요.' }, 413);
    // deno-lint-ignore no-explicit-any
    let body: any = {};
    {
      /* 입력 읽기도 마감 안에서 — 느리게 흘려 보내는 요청이 함수를 붙잡지 못하게. */
      const 받음 = await 끊기면그만(상한까지(new Response(req.body), 요청최대바이트 + 1), 끊김.signal);
      if (받음.truncated)
        return json({ error: '보낸 것이 너무 커요. 사진을 줄이거나 나눠서 보내주세요.' }, 413);
      try { body = JSON.parse(받음.text || '{}'); } catch { body = {}; }
      if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
    }
    const { trip_id, message, mode, prefs, image, images } = body;
    /* 화면이 기다리는 시간(2026-10-16). 화면이 먼저 포기한 뒤에도 서버가 검색하고 답을 만들면 사용량·돈만
       나갑니다. 그보다 5초 일찍 접습니다(오가는 길 몫). 10초 미만·이상한 값은 무시 — 늘리지는 않습니다. */
    {
      const 화면기다림 = Number(body.wait_ms);
      if (Number.isFinite(화면기다림) && 화면기다림 >= 10_000) 마감맞추기(화면기다림 - 5_000);
    }

    /* 모양 검사(2026-10-16). 예전엔 무엇이 와도 String() 으로 펴서 썼습니다. */
    const 모드들 = [undefined, null, 'map', 'draft', 'import', 'places', 'addr'];
    if (!모드들.includes(mode)) return json({ error: '알 수 없는 요청이에요.' }, 400);
    if (trip_id != null && !(typeof trip_id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trip_id)))
      return json({ error: '어느 여행인지 알 수 없어요.' }, 400);
    if (message != null && typeof message !== 'string')
      return json({ error: '물어볼 말을 글로 적어주세요.' }, 400);
    {
      const 상한 = mode === 'map' ? 글상한.map : mode === 'import' ? 글상한.import : 글상한.chat;
      if (String(message ?? '').length > 상한)
        return json({ error: `한 번에 ${상한.toLocaleString()}자까지 보낼 수 있어요. 나눠서 보내주세요.` }, 400);
    }

    // ── 구글 지도 주소 하나 읽기 ──────────────────────────────────
    // **AI 를 안 씁니다.** 한도도 안 닳고 값도 안 나갑니다 — 주소를 펴서
    // 좌표를 뽑는 일뿐입니다. 그런데 이 일을 브라우저에서는 못 합니다:
    // `maps.app.goo.gl` 짧은 주소는 따라가려면 리다이렉트를 읽어야 하는데
    // 구글이 CORS 를 안 줍니다. 서버에서만 됩니다.
    // 여기 이미 unshortenMap·parseMapUrl 이 있어서 통로만 냅니다 —
    // 함수를 하나 더 만들면 배포할 것이 하나 더 늘 뿐입니다.
    if (mode === 'map'){
      const got = await readGoogleMap(String(message || ''), 끊김.signal);
      if (!got?.place) return json({ error: '이 주소에서는 위치를 못 찾았어요.' }, 200);
      const { name, lat, lng } = got.place;
      return json({ name: name || null,
                    lat: lat == null ? null : Number(lat),
                    lng: lng == null ? null : Number(lng) });
    }
    // ── AI 비상 스위치 ────────────────────────────────────────────
    // **한도만으로는 못 끕니다.** 요금이 새거나 키가 새면 즉시 멈춰야 하는데
    // 배포는 몇 분 걸리고 그 사이에도 돈이 나갑니다(db/066 의 ai_on).
    // **지도 주소 읽기 다음입니다** — 그건 AI 를 안 쓰므로 껐을 때도
    // 살아 있어야 맞습니다.
    try {
      const { data: sw, error: swErr } = await asUser.rpc('public_flags');
      // 못 읽으면 켜진 것으로 봅니다 — 설정을 못 읽었다고 앱을 멈추면 안 됩니다.
      // (그래도 아래 ai_take 가 한도를 셉니다. 그것마저 못 읽으면 거기서 멈춥니다.)
      // 2026-10-16: 못 읽은 것을 조용히 넘기지 않고 로그에 남깁니다.
      if (swErr) console.error(`[${요청번호}] public_flags`, swErr.code ?? '', String(swErr.message ?? '').slice(0, 200));
      if (sw && sw.ai === false)
        return json({ error: 'AI 기능을 잠시 멈춰뒀어요. 곧 다시 열립니다.' }, 200);
    } catch (e) { console.error(`[${요청번호}] public_flags`, String(e).slice(0, 200)); }

    // 초안은 버튼만 눌러도 됩니다. 사용자가 문장을 쓰지 않습니다.
    const draft = mode === 'draft';
    // 불러오기 — 이미 짜둔 일정(엑셀·사진·글)을 읽어 일정 카드로 만듭니다.
    // 초안과 같은 자리를 씁니다. 둘 다 "날짜가 붙은 여러 개"를 내놓기 때문입니다.
    const imp = mode === 'import';
    // 표로 넣은 일정의 «장소 이름» 짓기(b784) — 아래 ai_take 바로 뒤에서 처리하고 끝냅니다.
    const geo = mode === 'places';
    // 이름으로 못 찾은 곳의 «주소» 찾기(b785) — 아래 geo 바로 뒤에서 처리하고 끝냅니다.
    const addrMode = mode === 'addr';

    // 사진. 간판·메뉴판·티켓을 찍어 물어보는 자리입니다.
    // 화면에서 이미 긴 쪽 1024px JPEG 으로 줄여 보냅니다. 여기서는 크기만 다시 봅니다 —
    // 화면 코드는 누구나 고칠 수 있으니 서버에서도 막아야 합니다.
    // 여러 장을 받습니다. 메뉴판이 두 장으로 나뉘어 있는 일이 흔합니다.
    // 옛 화면이 보내던 image(한 장)도 그대로 받습니다 — 배포 순서가 어긋나도 안 깨집니다.
    const shots: { mimeType: string; data: string }[] = [];
    const incoming = Array.isArray(images) ? images : (image ? [image] : []);
    if (incoming.length > 4)
      return json({ error: '사진은 4장까지 올릴 수 있어요.' }, 400);
    let bytes = 0;
    for (const im of incoming) {
      if (!im?.data) continue;
      if (typeof im.data !== 'string') return json({ error: '사진을 읽지 못했어요. 다른 사진으로 해보세요.' }, 400);
      bytes += im.data.length;
      // 한 장씩도 보고 전체도 봅니다. 작은 것 넷이 모여도 요청이 터질 수 있습니다.
      if (im.data.length > 3_000_000 || bytes > 8_000_000)
        return json({ error: '사진이 너무 커요. 더 작은 것으로 올려주세요.' }, 400);
      const mt = String(im.mime ?? 'image/jpeg');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mt))
        return json({ error: '이 사진 형식은 못 읽어요. JPG나 PNG로 올려주세요.' }, 400);
      shots.push({ mimeType: mt, data: im.data });
    }
    const shot = shots.length ? shots[0] : null;   // 아래 검색 건너뛰기 판단에 씁니다

    if (!draft && !geo && !addrMode && !shots.length && (!message || !String(message).trim()))
      return json({ error: '물어볼 말을 적어주세요.' }, 400);
    if ((geo || addrMode) && !(Array.isArray(body.items) && body.items.length))
      return json({ error: '찾을 일정이 없어요.' }, 400);
    if ((draft || imp) && !trip_id)
      return json({ error: '어느 여행인지 골라주세요.' }, 400);
    if (imp && !shots.length && !String(message ?? '').trim())
      return json({ error: '읽을 것이 없어요.' }, 400);

    // ── 사용량과 설정 ── 서비스 키로만. 화면에서 건너뛸 수 없습니다.
    //
    // 설정을 **같이 받아옵니다.** 순서대로 하면 왕복이 하나 더 붙는데,
    // 둘은 서로를 안 기다려도 되는 일입니다.
    // 관리자가 화면에서 바꾸는 값들입니다(db/047). 표가 비었거나 못 읽으면
    // 아래 기본값으로 갑니다 — 설정을 못 읽었다고 답을 안 해주면 안 됩니다.
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
                               { auth: 서버용인증, global: { fetch: 마감fetch } });
    /* 생각 정도(위 「AI 가 속으로 생각하는 정도」) — 대화일 때만. 관리자 전용 값이 있으면 관리자인지도
       **같이** 묻습니다(따로 물으면 왕복이 하나 더 붙습니다). 못 물으면 관리자가 아닌 것으로 — 지금과 같게. */
    const 대화 = !draft && !imp && !geo && !addrMode;
    const 생각모두 = 대화 ? 생각설정(Deno.env.get('GEMINI_THINKING') ?? 기본생각) : null;
    const 생각관리자 = 대화 && !생각모두 ? 생각설정(Deno.env.get('GEMINI_THINKING_ADMIN')) : null;
    const [{ data: take, error: takeErr }, { data: cfgRows, error: cfgErr }, 관리자답] = await Promise.all([
      admin.rpc('ai_take', { p_user: user.id,
                             p_kind: draft ? 'draft' : (imp || geo || addrMode) ? 'import' : 'chat' }),
      admin.from('app_settings').select('key,value'),
      생각관리자
        ? asUser.rpc('is_admin').then((r) => r, () => ({ data: false }))
        : Promise.resolve({ data: false }),
    ]);
    const 생각 = 생각모두 ?? (관리자답?.data === true ? 생각관리자 : null);
    /* 사용량을 못 셌으면 **멈춥니다** — 한도를 모른 채 AI 를 부르면 돈이 샙니다.
       DB 오류 글(표·함수 이름이 들어 있음)은 로그에만, 사용자에겐 쉬운 말만(2026-10-16). */
    if (takeErr) return 내부오류('ai_take', takeErr);
    /* 설정은 «못 읽으면 기본값»을 유지합니다(답을 안 해주는 것보다 낫다 — 위 주석).
       다만 조용히 넘기지 않고 로그에 남기고, 돈이 드는 쪽(웹 검색)은 **끈 것**으로 봅니다 —
       관리자가 꺼 둔 것을 설정을 못 읽었다는 이유로 켜면 안 됩니다. */
    if (cfgErr) console.error(`[${요청번호}] app_settings`, cfgErr.code ?? '', String(cfgErr.message ?? '').slice(0, 200));
    // deno-lint-ignore no-explicit-any
    const cfg: Record<string, any> = cfgErr ? {} :
      // deno-lint-ignore no-explicit-any
      Object.fromEntries((cfgRows ?? []).map((r: any) => [r.key, r.value]));
    // 모델 이름은 DB 쪽에서 이미 목록으로 걸러집니다. 그래도 빈 값이면 기본으로.
    // **이 요청 안에서만** 씁니다(위 MODEL 머리말 — 예전 전역 activeModel).
    const 모델      = String(cfg.ai_model?.name || MODEL);
    const searchOn  = !cfgErr && cfg.web_search?.on !== false;
    if (!take?.ok)
      return json({
        // 여기는 **사람을 잃는 자리**입니다. 쓸모를 느끼는 순간에 막히면
        // 다시 안 옵니다. 얼마나 썼는지, 언제 풀리는지를 분명히 적습니다.
        error: `오늘 쓸 수 있는 ${take?.limit}번을 다 썼어요. ` +
               `내일 다시 열려요.`,
        used: take?.used, limit: take?.limit,
      }, 429);

    mark('ai_take');

    // ── 표로 넣은 일정의 «장소 이름» 짓기(b784) ────────────────────────
    // 표는 화면이 AI 없이 그대로 읽어 넣습니다(sheetimp.js). 여기서는 줄마다
    // «실제로 어디인지»의 **현지 이름만** 짓습니다. 좌표는 적지 않습니다 —
    // 화면이 OSM 으로 찾고 그 줄 지역의 40km 안에서, 이름이 맞는 것만 받습니다.
    // 실측(2026-09-27, 나라=일본): 한국어 이름으로는 OSM 이 10곳 중 1곳만 맞혔고
    // 1곳은 엉뚱한 데였습니다. 일본어 이름으로는 8곳이 맞았습니다.
    // 지역(유후인·벳푸…)은 **기준점**으로만 쓰므로 AI 좌표로 충분합니다 —
    // 몇 km 틀려도 40km 창 안의 진짜 장소는 그대로 걸립니다.
    // **대화 기록(chats)에 안 남깁니다.** 사용자가 쓴 말이 아니라 화면이 부른 일입니다.
    if (geo) {
      // deno-lint-ignore no-explicit-any
      const items: any[] = (body.items as any[]).slice(0, 200);
      const country = String(body.country ?? '').slice(0, 2).toUpperCase();
      const cell = (v: unknown, n: number) =>
        String(v ?? '').replace(/[\t\r\n]+/g, ' ').trim().slice(0, n);
      const table = items.map((it, i) =>
        [i, cell(it?.date, 10), cell(it?.area, 40), cell(it?.title, 100), cell(it?.memo, 160)]
          .join('\t')).join('\n');
      const placeSystem = [
        '너는 여행 일정표의 줄마다 그 일정이 «실제로 일어나는 곳»을 정하는 조수다.',
        `나라: ${country || '모름'}. 받는 것: 번호 · 날짜 · 지역 · 일정 · 메모 (탭으로 나뉨).`,
        '',
        '정하는 법:',
        '- 한 줄에 한 곳. 그 곳의 **현지어 공식 이름**(local)과 **영어 이름**(en)을 쓴다.',
        '  ko 에는 표에 적힌 그 곳의 한국어 이름을 쓴다(「메바에소」·「BAND HOTEL HAKATA」).',
        '  같은 곳이면 줄마다 ko·local 을 똑같이 쓴다 — 화면이 같은 곳끼리 묶는다.',
        '  local 은 그 나라 지도에 적힌 이름이다(일본이면 일본어). 지도 검색에 그대로 넣는다.',
        '  예) 우미지고쿠 → local "海地獄", en "Umi Jigoku"',
        '      캐널시티 하카타 → local "キャナルシティ博多", en "Canal City Hakata"',
        '- 한 줄에 곳이 둘이면(「후쿠오카성터 · 마이즈루공원」) 먼저 적힌 곳을 local 로,',
        '  다른 곳의 현지어 이름을 alt 로 쓴다. 지도에 없을 수 있는 시설(로프웨이·작은 가게)은',
        '  **같은 자리를 가리키는** 다른 이름(탑승역·본관 이름)이 있으면 alt 로 쓴다. 없으면 null.',
        '- 이동하는 줄(「A → B」, 「~ 이동」, 「~행 버스 탑승」, 「렌터카 반납 · 벳푸역 이동」)은',
        '  **도착하는 곳**이다. 항공편 도착·출발은 그 공항이다.',
        '- 줄에 장소 이름이 없어도 **표의 다른 줄로 확실히 알 수 있으면** 그 곳이다.',
        '  예) 숙소에 묵는 날 저녁의 「온천」·「가이세키 저녁」, 다음 날 「조식」 → 그 숙소.',
        '      「체크아웃 · 캐리어 호텔 보관」 → 그 전에 체크인한 호텔.',
        '- 어느 가게인지 모르고 동네만 알면(「텐진·다이묘 저녁」) 그 동네 이름을 쓴다.',
        '- **모르면 null.** 「점심」·「휴식」·「자유시간」처럼 어디인지 표로 알 수 없으면',
        '  local 과 en 을 null 로 둔다. 이름을 지어내지 않는다 — 틀린 이름은 엉뚱한 핀이 된다.',
        '- 지역 칸에 나온 값마다 그 지역의 현지어 이름과 중심 위도·경도를 적는다.',
        '  name 은 지역 칸에 적힌 글자 그대로 쓴다. 「A → B」 꼴이면 B 의 중심이다.',
        '',
        '반드시 아래 JSON 하나만 낸다. 설명이나 코드블록을 덧붙이지 않는다. 모든 번호를 낸다.',
        '{',
        '  "rows": [ { "i": 0, "ko": "우미지고쿠", "local": "海地獄" 또는 null, "alt": null,',
        '              "en": "Umi Jigoku" 또는 null } ],',
        '  "areas": [ { "name": "벳푸", "local": "別府", "lat": 33.28, "lng": 131.49 } ]',
        '}',
      ].join('\n');
      const 물음 = [
        { role: 'user',  parts: [{ text: placeSystem }] },
        { role: 'model', parts: [{ text: '알겠습니다. 확실한 곳만 적겠습니다.' }] },
        { role: 'user',  parts: [{ text: '번호\t날짜\t지역\t일정\t메모\n' + table }] },
      ];
      /* ⚠⚠ **askGemini 를 안 씁니다(b784 실측 — 위 callGemini 머리말).** ⚠⚠
         한 번에 45초까지만 기다리고, 답 길이에 상한을 둡니다(줄마다 60토큰 남짓 +
         여유). 두 번(큰 모델 → 가벼운 모델) 해도 90초라 함수 한도(150초) 안입니다.
         실패하면 **왜** 실패했는지 로그에 남깁니다 — 546 만 보고는 몰랐습니다. */
      const 상한 = Math.min(8192, 2000 + items.length * 60);
      let 답 = '';
      /* 가벼운 모델이 먼저입니다 — 이름 옮기기는 추론이 아니라 옮겨 적기라 충분하고
         빠릅니다. 못 하면 큰 모델이 받습니다. (불러오기에서 가벼운 모델이 «줄을
         빠뜨린» 일이 있었지만, 여기서 빠진 줄은 핀이 안 찍힐 뿐 틀린 핀이 되지는
         않습니다.) */
      for (const m of [MODEL_FALLBACK, 모델]) {
        const r = await callGemini(m, key, 물음, 0, { maxOutputTokens: 상한 }, 45000, 마감);
        if (r.code !== 200) {
          console.log(`PLACES ${m} -> ${r.code} ${오류요약(r.body)} | ${Date.now() - T0}ms`);
          continue;
        }
        try {
          const c = JSON.parse(r.body)?.candidates?.[0];
          답 = (c?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
          if (c?.finishReason && c.finishReason !== 'STOP')
            console.log(`PLACES ${m} 끝난 까닭 ${c.finishReason} · 글자 ${답.length}`);
        } catch { 답 = ''; }
        if (답) break;
      }
      mark('gemini');
      console.log('TIMING places | ' + lap.join(' | ') + ' | 총 ' + (Date.now() - T0) +
                  'ms | 줄 ' + items.length + ' | 답 ' + 답.length + '자');
      if (!답) return json({ error: 'AI가 답을 안 줬어요. 잠시 뒤 다시 해주세요.' }, 502);
      /* 통째로 못 읽으면(상한에 잘림) **읽을 수 있는 줄만** 건집니다. 한 줄이 한
         {…} 라 따로 읽힙니다 — 못 건진 줄은 화면이 「장소 아님」처럼 비워 둡니다. */
      // deno-lint-ignore no-explicit-any
      let o: any = {};
      try { o = JSON.parse(답); } catch {
        const 건짐 = (re: RegExp) => (답.match(re) ?? [])
          .map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
        o = { rows: 건짐(/\{\s*"i"\s*:[^{}]*\}/g), areas: 건짐(/\{\s*"name"\s*:[^{}]*\}/g) };
        console.log(`PLACES 잘린 답에서 건짐: 줄 ${o.rows.length} · 지역 ${o.areas.length}`);
        if (!o.rows.length) return json({ error: '답을 읽지 못했어요.' }, 502);
      }
      const txt = (v: unknown, n: number) =>
        typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null;
      // 번호를 글자("0")로 주는 일이 있어 숫자로 펴서 봅니다.
      const rows = (Array.isArray(o?.rows) ? o.rows : [])
        // deno-lint-ignore no-explicit-any
        .map((r: any) => ({ i: Number(r?.i), ko: txt(r?.ko, 60), local: txt(r?.local, 80),
                            alt: txt(r?.alt, 80), en: txt(r?.en, 80) }))
        .filter((r: { i: number }) => Number.isInteger(r.i) && r.i >= 0 && r.i < items.length);
      const areas = (Array.isArray(o?.areas) ? o.areas : [])
        // deno-lint-ignore no-explicit-any
        .filter((a: any) => a && txt(a.name, 60) && typeof a.lat === 'number' &&
                            typeof a.lng === 'number' && Math.abs(a.lat) <= 90 &&
                            Math.abs(a.lng) <= 180)
        .slice(0, 40)
        // deno-lint-ignore no-explicit-any
        .map((a: any) => ({ name: txt(a.name, 60), local: txt(a.local, 60),
                            lat: a.lat, lng: a.lng }));
      return json({ rows, areas });
    }

    // ── 이름으로 못 찾은 곳의 «주소» 찾기(b785) ────────────────────────────
    // 화면(sheetimp.js 의 `주소로찾기`)이 OSM 에서 이름으로 못 찾은 곳(대개 숙소)만
    // 보냅니다. 사용자: 「호텔 좌표는 너가 넣을 수 있는거아냐?」·「나중에 다 자동화」 —
    // 손으로 한 순서 그대로입니다: 웹에서 그 곳을 검색해 **결과에 적혀 있는** 주소를
    // 옮깁니다. 모델이 기억으로 지어낸 주소는 엉뚱한 번지에 핀을 꽂습니다.
    // 좌표는 화면이 주소로 찾습니다(일본은 국토지리원 — 번지까지, 그 밖은 OSM).
    // 대화 기록(chats)에 안 남깁니다. 검색 열쇠가 없거나 검색이 꺼져 있으면 빈 답입니다.
    if (addrMode) {
      const tavily = Deno.env.get('TAVILY_KEY');
      if (!tavily || !searchOn) return json({ rows: [] });
      // deno-lint-ignore no-explicit-any
      const items: any[] = (body.items as any[]).slice(0, 8);
      const country = String(body.country ?? '').slice(0, 2).toUpperCase();
      const 말 = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
      // deno-lint-ignore no-explicit-any
      const 찾음: any[][] = await Promise.all(items.map(async (it) => {
        const q = [말(it?.name, 60), 말(it?.area, 30), country === 'JP' ? '住所' : 'address']
          .filter(Boolean).join(' ');
        try { return (await webSearch(tavily, admin, q, 5, null, 마감)) ?? []; } catch { return []; }
      }));
      mark('search');
      const 목록 = items.map((it, i) => {
        const hits = 찾음[i].slice(0, 4);
        return `## ${i} · ${말(it?.name, 60)}${it?.en ? ' (' + 말(it.en, 60) + ')' : ''} · ${말(it?.area, 30)}\n` +
          (hits.length
            // deno-lint-ignore no-explicit-any
            ? hits.map((h: any, j: number) => `[${j}] ${h.title}\n${h.link}\n${h.snippet}`).join('\n')
            : '(검색 결과 없음)');
      }).join('\n\n');
      const addrSystem = [
        '너는 검색 결과에서 «그 곳의 주소»를 옮겨 적는 조수다.',
        '- 곳마다 검색 결과가 있다. 그 곳(이름이 같은 호텔·가게·시설)의 주소가 결과에',
        '  **글자로 적혀 있으면** 그대로 옮긴다.',
        '- 결과에 없으면 null. 기억으로 지어내거나 짐작하지 않는다. 다른 지점·비슷한 이름의',
        '  주소를 쓰지 않는다.',
        '- 일본 주소는 일본어 그대로(도도부현부터 번지까지). 우편번호는 빼도 된다.',
        '- src 에는 그 주소를 옮긴 결과의 링크를 그대로 적는다.',
        '',
        '반드시 아래 JSON 하나만 낸다. 설명이나 코드블록을 덧붙이지 않는다.',
        '{ "rows": [ { "i": 0, "addr": "福岡県福岡市中央区春吉2丁目4-14" 또는 null,',
        '              "src": "https://…" 또는 null } ] }',
      ].join('\n');
      let 답 = '';
      for (const m of [MODEL_FALLBACK, 모델]) {
        const r = await callGemini(m, key, [
          { role: 'user',  parts: [{ text: addrSystem }] },
          { role: 'model', parts: [{ text: '알겠습니다. 결과에 적힌 주소만 옮기겠습니다.' }] },
          { role: 'user',  parts: [{ text: 목록 }] },
        ], 0, { maxOutputTokens: 1500 }, 30000, 마감);
        if (r.code !== 200) {
          console.log(`ADDR ${m} -> ${r.code} ${오류요약(r.body)} | ${Date.now() - T0}ms`);
          continue;
        }
        try {
          답 = (JSON.parse(r.body)?.candidates?.[0]?.content?.parts ?? [])
            .map((p: { text?: string }) => p.text ?? '').join('').trim();
        } catch { 답 = ''; }
        if (답) break;
      }
      mark('gemini');
      console.log('TIMING addr | ' + lap.join(' | ') + ' | 총 ' + (Date.now() - T0) +
                  'ms | 곳 ' + items.length + ' | 답 ' + 답.length + '자');
      // deno-lint-ignore no-explicit-any
      let o: any = {};
      try { o = JSON.parse(답); } catch { return json({ rows: [] }); }
      // 링크는 **우리가 보여 준 결과 중 하나**여야 합니다 — 링크까지 지어낸 답은 버립니다.
      const rows = (Array.isArray(o?.rows) ? o.rows : [])
        // deno-lint-ignore no-explicit-any
        .map((r: any) => ({
          i: Number(r?.i),
          addr: typeof r?.addr === 'string' && r.addr.trim() ? r.addr.trim().slice(0, 120) : null,
          src: typeof r?.src === 'string' ? r.src.trim() : null,
        }))
        .filter((r: { i: number; addr: string | null; src: string | null }) =>
          Number.isInteger(r.i) && r.i >= 0 && r.i < items.length && !!r.addr &&
          // deno-lint-ignore no-explicit-any
          찾음[r.i].some((h: any) => h.link === r.src));
      return json({ rows });
    }

    // ── 여행 자료 ── 없으면 없는 대로 답합니다.
    let ctx = '';
    // 링크 읽기를 **여기서 미리 걸어둡니다.** 아래 여행 자료를 받아오는 동안
    // 같이 돌게 하려는 것입니다. 예전에는 자료를 다 받은 뒤에야 시작해서
    // 그 둘이 순서대로 더해졌습니다. 결과는 쓸 자리에서 기다립니다.
    const linksP = readLinks(String(message ?? ''), 끊김.signal);
    /* 지난 대화도 **여기서 미리 출발시킵니다**(2026-10-16). 예전엔 웹 검색이 끝난 뒤에야
       읽기 시작해 그 시간이 그대로 더해졌습니다. 여행 id 만 있으면 되는 일이라 여행 자료·검색과
       같이 돌아도 됩니다. 결과는 아래 「여태 나눈 이야기」에서 기다립니다.
       (`.then` 을 붙여야 실제로 출발합니다 — supabase 질의는 기다리기 전엔 안 나갑니다.) */
    const 기록P = (!imp && !draft)
      ? (trip_id
          ? asUser.from('chats').select('role,content').order('created_at', { ascending: false })
              .limit(12).eq('trip_id', trip_id)
          : asUser.from('chats').select('role,content').order('created_at', { ascending: false })
              .limit(12).is('trip_id', null)
        ).then((r) => r, (e) => ({ data: null, error: { code: '', message: String(e) } }))   /* 일찍 끝나는 길(404·503)에선 아무도 안 기다리므로 던지지 않게 */
      : null;

    // ── 근거 이름은 여기 한 곳에서만 정합니다 ──────────────────────────
    // 2026-08-11 에 이것 때문에 세 번 헛짚었습니다. 새 자료 다섯(일행 · 예약 ·
    // 준비물 · 별점 · 취향)을 넣으면서 **프롬프트 두 곳과 흰 목록 한 곳** 중
    // 흰 목록만 옛날 그대로 두었더니, 모델이 "packing" 을 내도 서버가 버려서
    // 근거 칩이 늘 비었습니다. 화면에서는 "모델이 말을 안 듣는다"로만 보입니다.
    // 왼쪽이 자료 머리글, 오른쪽이 sources 이름입니다. 짝이 한 곳에 있어야
    // 자료를 더할 때 한 줄만 고치면 됩니다.
    const SRC_MAP: [string, string][] = [
      ['plans', '[일정]'], ['expenses', '[최근 지출]'], ['legs', '[구간]'],
      ['trip', '[여행]·[오늘]'], ['members', '[일행]'], ['bookings', '[예약]'],
      ['packing', '[준비물]'], ['ratings', '[높게 준 도시]'], ['prefs', '[취향]'],
      ['placerates', '[높게 준 장소]'], ['candidates', '[추천에서 빼야 할 곳]'],
    ];
    // 'general' 은 자료가 아니라 "내가 원래 알던 것"이라 짝이 없습니다.
    const SRC_ALL = [...SRC_MAP.map(([k]) => k), 'general'];

    // ⚠ **취향과 별점은 사람에게 딸린 것입니다 — 여행 블록 안에 두면 안 됩니다.**
    // 처음에 `if (trip_id)` 안에 넣었다가 물렸습니다(2026-08-11, 실제로 물어봄):
    // 여행을 안 고르고 "다음에 어디 갈까? 내 취향으로 골라줘" 하고 물었더니
    // **"등록된 취향이 없어서 어렵다"**고 답했습니다. 별점이 74개나 있는데요.
    // 여행을 안 골랐을 때가 바로 이 자료가 제일 쓸모 있는 자리입니다.
    // 여행 자료를 받는 동안 같이 돌게 여기서 걸어둡니다.
    /* ⚠ **오늘 날짜는 여행에 딸린 것이 아닙니다.** b274 에서 `[오늘]` 을
       여행 블록 안에 넣었더니, **여행을 안 고르면 AI 가 오늘이 며칠인지
       모릅니다.** 처음부터 끝까지 눌러보다 잡았습니다 —
       "오늘 며칠이야?" 에 "선택된 여행이 없어 알 수 없다"고 답했습니다.
       취향·별점에서 이미 한 번 고친 것과 **똑같은 실수**입니다.
       사람에게 딸린 것과 여행에 딸린 것을 가르는 자리가 여기입니다.
       시간대는 고른 여행이 있으면 그 여행지, 없으면 집(한국)으로 봅니다. */
    const todayIn = (tz?: string) => {
      try { return new Date().toLocaleDateString('en-CA', { timeZone: tz || 'Asia/Seoul' }); }
      catch { return new Date().toLocaleDateString('en-CA'); }
    };

    const meP = Promise.all([
      asUser.from('user_prefs').select('*').maybeSingle(),
      asUser.from('city_ratings')
        .select('stars,comment,cities(name,country)')
        .not('stars', 'is', null).order('stars', { ascending: false }).limit(12),
      /* ⚠ **장소 별점이 도시 별점보다 취향을 훨씬 잘 말합니다** (2026-08-12).
         '도쿄 4.5' 는 도쿄를 좋아한다는 말이지만, '신주쿠 이자카야 4 ·
         메이지 신궁 4 · 하라주쿠 4' 는 **무엇을 하는 것을 좋아하는지**를
         말합니다. 어디로 갈지보다 그 도시에서 뭘 할지를 정할 때 필요한 것이
         이쪽입니다. 재보니 18건이 쌓여 있는데 AI 는 한 번도 못 봤습니다. */
      asUser.from('plan_ratings')
        .select('stars,plans(title,category)')
        .not('stars', 'is', null).order('stars', { ascending: false }).limit(20),
      /* 한줄평은 **본인이 직접 쓴 말**이라 별점보다 진합니다
         ("노잼 도시지만 좋았다" 같은 것은 점수로는 안 나옵니다). */
    ]);

    // 아래 안전장치에서도 씁니다 — 좌표가 구간 중심에서 먼지 봐야 하므로.
    // deno-lint-ignore no-explicit-any
    let legs: any[] = [];
    // 초안을 짤 때 며칠짜리인지 알아야 해서 바깥으로 뺍니다.
    // deno-lint-ignore no-explicit-any
    let tripRow: any = null;
    /* 담아둔 곳. **답을 만든 뒤 카드에서 걸러내야 해서** 바깥에 둡니다
       (아래 dropDup 참고 — 프롬프트가 안 지키는 것을 코드가 지킵니다). */
    // deno-lint-ignore no-explicit-any
    let candList: any[] = [];
    /* 읽다가 오류가 난 표 이름(아래 「못 읽은 것을 «없음»으로 쓰지 않습니다」). */
    const 못읽은: string[] = [];
    const 못읽음말 = '- (서버 사정으로 지금 못 읽었다. «없다»고 말하지 말고, 필요하면 «지금 확인이 안 된다»고 한다)';
    if (trip_id) {
      // 넷을 차례로 물었습니다. 넷 다 trip_id 하나만 있으면 되는데도
      // 앞의 답을 기다렸습니다 — 오갈 때마다 붙는 시간이 그대로 쌓입니다.
      // 한꺼번에 보냅니다. 제일 느린 하나만큼만 걸립니다.
      // ⚠ **넷을 더 받아옵니다 (2026-08-10).** 재보니 AI 가 여행·구간·일정·지출
      // 넷만 보고 있었습니다. 사람이 당연히 안다고 여기는 것들을 통째로 몰랐습니다:
      //   · 일행이 몇 명인지 → "몇 명이서 가면 좋을까"를 못 셉니다
      //   · 언제 도착하는지 → 첫날 오후부터인지 저녁부터인지 모릅니다
      //   · 뭘 챙겼는지 → "뭘 챙겨야 해?"에 매번 원론적인 목록만 냅니다
      //   · 어떤 곳에 별을 높게 줬는지 → **취향의 유일한 근거인데 안 봤습니다**
      // 같은 Promise.all 에 넣습니다 — 줄을 더 세우면 제일 느린 하나만큼만 늘어납니다.
      const [tripRes, legRes, planRes, expRes,
             memRes, bookRes, candRes, packRes] = await Promise.all([
        /* ⚠ select 글은 **한 덩어리**로 둡니다. '…' + '…' 로 이으면 supabase-js 가 열 이름을
           못 읽어 타입이 오류 꼴이 되고 `deno check` 가 12건을 냈습니다(2026-10-16 고침). */
        asUser.from('trips')
          .select('title,destination,country,start_date,end_date,timezone,currency,home_currency,walk_max_km,transit_factor,transit_base_min')
          .eq('id', trip_id).maybeSingle(),
        // 여러 도시·나라를 도는 여행이면 구간마다 통화·시간대·이동방식이 다릅니다.
        // 이걸 안 주면 AI 가 여행 전체를 한 도시로 보고 답합니다.
        asUser.from('trip_legs')
          .select('destination,country,start_date,end_date,timezone,currency,center_lat,center_lng,walk_max_km,transit_factor,transit_base_min')
          .eq('trip_id', trip_id).order('start_date'),
        asUser.from('plans')
          .select('date,start_time,end_time,category,title,memo')
          .eq('trip_id', trip_id).is('deleted_at', null)
          .order('date').order('start_time'),
        asUser.from('expenses')
          .select('date,title,amount,currency,category')
          .eq('trip_id', trip_id).is('deleted_at', null)
          .order('date', { ascending: false }).limit(30),
        // 나간 사람은 뺍니다 — 지금 같이 가는 사람 수가 궁금한 것입니다.
        asUser.from('trip_members').select('role,nickname')
          .eq('trip_id', trip_id).is('left_at', null),
        // 예약은 첫날·마지막날 질문의 근거입니다. "첫날 뭐 할까"의 답은
        // 몇 시에 내리는지에 통째로 달려 있습니다.
        // **예약번호·전화·주소는 안 보냅니다** — 답하는 데 필요 없고,
        // 남의 서버로 나가는 것은 적을수록 좋습니다.
        asUser.from('bookings')
          .select('kind,title,start_date,start_time,end_date,end_time')
          .eq('trip_id', trip_id).is('deleted_at', null)
          .order('start_date').limit(20),
        /* ⚠ **담아둔 곳을 몰라서 이미 담은 데를 또 권했습니다.** '갈 만한 곳'에
           담아둔 후보는 "가고 싶다고 이미 정한 것"이라 제일 강한 신호인데
           AI 는 못 보고 있었습니다. 재보니 이 여행에만 여섯 곳이 있습니다. */
        asUser.from('candidates').select('title,category')
          .eq('trip_id', trip_id).is('deleted_at', null).limit(30),
        asUser.from('packing').select('title,done')
          .eq('trip_id', trip_id).is('deleted_at', null).limit(60),
      ]);

      /* ── 못 읽은 것을 «없음»으로 쓰지 않습니다(2026-10-16) ──
         예전엔 오류가 나도 data 가 null 이라 그대로 «(없음)»이 되었고, AI 는
         «일정이 하나도 없네요»처럼 **틀린 말을 자신 있게** 했습니다.
         - 여행·구간·일정: 이것 없이는 답이 틀립니다 → 요청을 멈추고 다시 해 달라고 합니다.
         - 나머지(지출·일행·예약·담은 곳·준비물): 그 칸에 «못 읽음»을 적어 AI 가 없다고
           단정하지 않게 합니다. 까닭은 로그에만 남깁니다. */
      for (const [이름, r] of [['trips', tripRes], ['trip_legs', legRes], ['plans', planRes]] as const)
        if (r.error) return 내부오류(`db ${이름}`, r.error,
          '여행 자료를 지금 못 읽었어요. 조금 뒤 다시 해주세요.', 503);
      /* 없는 여행(지웠거나, 나왔거나, 남의 것 — RLS)을 «여행 없음»으로 답하지 않습니다. */
      if (!tripRes.data)
        return json({ error: '이 여행을 찾을 수 없어요. 여행 목록을 새로 고친 뒤 다시 해주세요.' }, 404);
      for (const [이름, r] of [['expenses', expRes], ['trip_members', memRes], ['bookings', bookRes],
                               ['candidates', candRes], ['packing', packRes]] as const)
        if (r.error) {
          console.error(`[${요청번호}] db ${이름}`, r.error.code ?? '', String(r.error.message ?? '').slice(0, 200));
          못읽은.push(이름);
        }
      const 칸 = (이름: string, 있을때: string, 없을때: string) =>
        못읽은.includes(이름) ? 못읽음말 : 있을때 || 없을때;

      const trip = tripRes.data;
      tripRow = trip;
      if (trip) {
        legs = legRes.data ?? [];
        const plans = planRes.data;
        const exp = expRes.data;

        // 여행지 시간대로 오늘을 셉니다. 사람이 묻는 '오늘'은 지금 서 있는 곳의 오늘입니다.
        const todayThere = todayIn(trip.timezone);
        // 며칠째인지도 같이 셉니다. AI 가 날짜 뺄셈을 하게 두면 틀립니다.
        const D1 = 86400000;
        const gap = Math.round(
          (Date.parse(trip.start_date + 'T00:00:00Z') - Date.parse(todayThere + 'T00:00:00Z')) / D1);
        const len = Math.round(
          (Date.parse(trip.end_date + 'T00:00:00Z') - Date.parse(trip.start_date + 'T00:00:00Z')) / D1);
        const dayNote = gap > 0 ? ` (여행 시작 ${gap}일 전)`
                      : gap === 0 ? ' (여행 첫날)'
                      : -gap <= len ? ` (여행 ${-gap + 1}일째, 총 ${len + 1}일 중)`
                      : ` (여행이 ${-gap - len}일 전에 끝남)`;

        ctx = [
          `[여행] ${trip.title}`,
          `기간 ${trip.start_date} ~ ${trip.end_date} · 정산 통화 ${trip.home_currency}`,
          '',
          '[구간] 언제 어디에 있는지. 날짜로 일정·지출이 여기 붙는다.',
          (legs ?? []).map((l) =>
            `- ${l.start_date}~${l.end_date} ${l.destination}(${l.country}) · ` +
            `${l.currency} · ${l.timezone} · 이동 어림 ${l.walk_max_km}km 미만 도보, ` +
            `그 위는 거리×${l.transit_factor}+${l.transit_base_min}분`).join('\n') ||
            `- ${trip.start_date}~${trip.end_date} ${trip.destination}(${trip.country})`,
          '',
          '[일정]',
          (plans ?? []).map((p) =>
            `- ${p.date} ${p.start_time?.slice(0, 5) ?? '시각미정'}` +
            `${p.end_time ? '~' + p.end_time.slice(0, 5) : ''} ` +
            `${p.title}${p.category ? ' (' + p.category + ')' : ''}` +
            `${p.memo ? ' — ' + p.memo : ''}`).join('\n') || '- (없음)',
          '',
          '[최근 지출]',
          칸('expenses', (exp ?? []).map((e) =>
            `- ${e.date} ${e.title} ${e.amount}${e.currency}` +
            `${e.category ? ' (' + e.category + ')' : ''}`).join('\n'), '- (없음)'),
          '',
          // ── 여기서부터가 2026-08-10 에 더한 것입니다 ──
          // **오늘이 며칠인지를 안 알려주고 있었습니다.** 모델이 아는 '오늘'은
          // 학습이 끝난 날이라 "오늘 뭐 해?" "내일은?" 이 통째로 어긋납니다.
          // 여행지 시간대로 셉니다 — 사람이 묻는 '오늘'은 지금 서 있는 곳의 오늘입니다.
          // `toISOString()` 을 쓰지 않습니다. 그건 UTC 로 잘라서 한국에서 하루가
          // 밀립니다(b248 에서 세 군데가 걸렸습니다). `en-CA` 가 YYYY-MM-DD 를 줍니다.
          `[오늘] ${todayThere}${dayNote}`,
          '',
          못읽은.includes('trip_members') ? '[일행]\n' + 못읽음말 :
          `[일행] ${(memRes.data ?? []).length}명` +
            ((memRes.data ?? []).some((m) => m.nickname)
              ? ' — ' + (memRes.data ?? []).map((m) =>
                  `${m.nickname ?? '이름없음'}${m.role === 'owner' ? '(만든 사람)' : ''}`)
                  .join(', ')
              : ''),
          '',
          '[예약] 도착·출발 시각이 첫날과 마지막 날에 무엇을 넣을 수 있는지를 정한다.',
          칸('bookings', (bookRes.data ?? []).map((b) =>
            `- ${b.kind ?? ''} ${b.title} ${b.start_date ?? ''} ${b.start_time?.slice(0, 5) ?? ''}` +
            `${b.end_date ? ` ~ ${b.end_date} ${b.end_time?.slice(0, 5) ?? ''}` : ''}`)
            .join('\n'), '- (없음)'),
          '',
          // ⚠ **처음에 '안 챙긴 것'만 보냈다가 물렸습니다** (2026-08-11, 실제로 물어봄).
          // AI 가 "목록에 없는 기본 필수품인 여권도 챙기세요"라고 답했는데
          // 여권은 목록에 있고 이미 챙긴 것이었습니다. **안 보내면 없는 것이 됩니다.**
          // 챙긴 것도 이름만 같이 보냅니다 — 그래야 이미 한 일을 또 시키지 않습니다.
          (() => {
            if (못읽은.includes('packing')) return '[준비물]\n' + 못읽음말;
            const pk = packRes.data ?? [];
            if (!pk.length) return '[준비물] (아직 없음)';
            const left = pk.filter((p) => !p.done).map((p) => p.title);
            const done = pk.filter((p) => p.done).map((p) => p.title);
            return `[준비물] ${pk.length}개 중 ${left.length}개 남음\n` +
              `- 아직 안 챙김: ${left.slice(0, 25).join(', ') || '(없음)'}\n` +
              `- 이미 챙김(다시 권하지 마라): ${done.slice(0, 25).join(', ') || '(없음)'}`;
          })(),
          '',
          /* 담아뒀다는 것은 **가고 싶다고 이미 정했다**는 뜻입니다.
             제일 강한 신호인데 AI 는 못 보고 있었습니다. */
          (() => {
            // deno-lint-ignore no-explicit-any
            const cd = (candRes.data ?? []) as any[];
            candList = cd;
            /* 못 읽었으면 «빼야 할 곳이 없다»가 아니라 «모른다»입니다. 이때 카드 거르기
               (dropDup)는 빈 목록이라 아무것도 안 거릅니다 — 이미 담은 곳이 카드로 다시
               나올 수 있습니다(예전과 같음). */
            if (못읽은.includes('candidates'))
              return '[추천에서 빼야 할 곳]\n- (이미 담아둔 곳을 지금 못 읽었다. 담아둔 곳이 없다고 말하지 않는다)';
            /* ⚠ 처음엔 '[담아둔 곳] … 다시 권하지 마라' 로 적었는데 **모델이
               목록을 보고 "여기서 고르라"로 읽어 그중 셋을 그대로 추천**했습니다.
               제목부터 "빼라"로 바꾸고, 목록 **앞뒤로** 못박습니다. */
            return cd.length
              ? '[추천에서 빼야 할 곳] 아래는 **이미 담아둔 곳**이다.\n' +
                '이미 가기로 정한 곳이라 **답에 절대 넣지 마라. 여기서 고르는 것이 아니다.**\n' +
                cd.map((c) => `- ${c.title}${c.category ? ` (${c.category})` : ''}`).join('\n') +
                '\n(위 목록은 제외 대상이다. 추천 후보가 아니다.)'
              : '';
          })(),
        ].filter((s) => s !== '').join('\n');
      }
    }

    // ── 사람에게 딸린 자료 ── 여행을 골랐든 안 골랐든 늘 붙입니다.
    // 여행 블록 밖에 있는 것이 핵심입니다 — 위 주석 참고.
    const [prefRes, rateRes, placeRes] = await meP;
    /* 취향·별점을 못 읽었으면 «등록된 취향이 없다»고 답하지 않게 적어 둡니다(2026-10-16). */
    const 내자료못읽음 = ([['user_prefs', prefRes], ['city_ratings', rateRes], ['plan_ratings', placeRes]] as const)
      .filter(([이름, r]) => {
        if (!r.error) return false;
        console.error(`[${요청번호}] db ${이름}`, r.error.code ?? '', String(r.error.message ?? '').slice(0, 200));
        return true;
      }).length > 0;
    {
      const p = prefRes.data ?? {};
      const bits = [
        p.pace === 'slow' ? '느긋한 속도' : p.pace === 'packed' ? '빡빡한 속도' : null,
        p.morning === 'late' ? '아침에 늦게 움직임' : null,
        p.focus ? `좋아하는 것: ${String(p.focus).slice(0, 80)}` : null,
      ].filter(Boolean);
      // deno-lint-ignore no-explicit-any
      const rs = (rateRes.data ?? []).filter((r: any) => r.cities?.name);
      const mine = [
        /* **여행을 안 골라도 오늘은 알아야 합니다.** 위 여행 블록에도
           `[오늘]` 이 있지만 그건 여행지 시간대로 센 것이라 더 정확합니다.
           여행이 있으면 그쪽이 먼저 나오므로 여기 것은 안 씁니다. */
        tripRow ? '' : `[오늘] ${todayIn()}`,
        bits.length ? `[취향] ${bits.join(' · ')}` : '',
        rs.length
          // **이 앱이 남들과 다른 자리입니다** — 다녀온 뒤의 기록.
          // 그 사람이 실제로 좋아한 곳이 일반적인 추천보다 낫습니다.
          ? '[높게 준 도시] 어디를 좋아하는지.\n' +
            // deno-lint-ignore no-explicit-any
            rs.map((r: any) => `- ${r.cities.name} ${r.stars}점` +
              (r.comment ? ` — 본인 한줄평: "${String(r.comment).slice(0, 60)}"` : ''))
              .join('\n')
          : '',
        /* **여기가 도시 별점보다 값집니다.** '도쿄 4.5' 는 도쿄를 좋아한다는
           말이고, '신주쿠 이자카야 4 · 메이지 신궁 4' 는 **무엇을 하는 것을
           좋아하는지**를 말합니다. 그 도시에서 뭘 할지 정할 때 쓰는 것이 이쪽입니다. */
        (() => {
          // deno-lint-ignore no-explicit-any
          const ps = (placeRes.data ?? []).filter((r: any) => r.plans?.title);
          return ps.length
            ? '[높게 준 장소] 무엇을 하는 것을 좋아하는지. 어디로 갈지보다 ' +
              '그 도시에서 뭘 할지 정할 때 여기서 읽는다.\n' +
              // deno-lint-ignore no-explicit-any
              ps.map((r: any) =>
                `- ${r.plans.title}${r.plans.category ? ` (${r.plans.category})` : ''} ${r.stars}점`)
                .join('\n')
            : '';
        })(),
        내자료못읽음
          ? '[취향·별점] 일부를 서버 사정으로 지금 못 읽었다. 취향이나 별점이 «없다»고 말하지 않는다.'
          : '',
      ].filter(Boolean).join('\n');
      if (mine) ctx = ctx ? ctx + '\n\n' + mine : mine;
    }

    // ── 초안 짜기 ──
    // 일정을 통째로 만들어 주는 자리입니다. 묻고 답하는 것과는 규칙이 다릅니다.
    // 하루를 꽉 채우지 않는 것, 한 동네로 묶는 것, 이동 시간을 세는 것이 핵심입니다.
    const days: string[] = [];
    if ((draft || imp) && tripRow) {
      const d = new Date(tripRow.start_date + 'T00:00:00Z');
      const end = new Date(tripRow.end_date + 'T00:00:00Z');
      while (d <= end && days.length < 30) {
        days.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
      }
    }
    const P = prefs ?? {};
    const paceTxt = P.pace === 'slow' ? '느긋하게. 하루 3개면 충분하다.'
                  : P.pace === 'packed' ? '알차게. 하루 5개까지 넣어도 된다.'
                  : '보통. 하루 4개 안팎.';
    const draftSystem = [
      '너는 여행 일정 초안을 짜는 조수다. 한국어로 쓴다.',
      '말투는 "~해요", "~예요" 로 쓴다. "~합니다", "~입니다" 는 쓰지 않는다 — 앱 전체가 그 말투다.',
      '',
      '지켜야 할 것:',
      `- 여행 첫날부터 마지막 날까지 하루도 빠짐없이 채운다. 날짜는 아래 목록만 쓴다.`,
      `- 속도: ${paceTxt}`,
      '- 하루를 꽉 채우지 않는다. 오후나 저녁에 빈 시간을 남긴다.',
      '  일정이 빽빽하면 지키지 못하고 여행이 피곤해진다.',
      '- 하루는 한 동네로 묶는다. 오전에 시내 반대편, 오후에 또 반대편으로 보내지 않는다.',
      '- 이동 시간을 센다. 그날이 속한 구간의 이동 어림값을 쓴다.',
      '- 도시가 여러 곳이면 그날 어느 구간인지 보고 그 도시 안에서만 짠다.',
      '  로마에 있는 날에 피렌체 식당을 넣지 않는다.',
      '- 첫날은 도착 시간을 모르니 오후부터, 마지막 날은 오전까지만 넣는다.',
      '- 점심과 저녁은 하루에 한 번씩 넣는다.',
      '- 잘 알려진 곳만 넣는다. 확실하지 않은 가게 이름은 지어내지 않는다.',
      '  "OO 거리에서 저녁"처럼 넓게 적는 편이 지어낸 상호보다 낫다.',
      '- 좌표는 확실히 아는 곳만 넣고 모르면 null 로 둔다.',
      '- 영업시간 · 휴무일 · 가격은 적지 않는다. 우리가 확인할 수 없다.',
      P.focus?.length ? `- 이런 것을 좋아한다: ${String(P.focus).slice(0, 80)}` : '',
      P.morning === 'late' ? '- 아침에 늦게 움직인다. 첫 일정을 10시 이후로 잡는다.'
                           : '- 아침 일찍 움직여도 괜찮다.',
      '',
      '반드시 아래 JSON 하나만 낸다. 설명이나 코드블록을 덧붙이지 않는다.',
      '{',
      '  "reply": "이 초안을 어떻게 짰는지 두세 줄.",',
      '  "actions": [',
      '    { "type":"add_plan", "date":"YYYY-MM-DD", "start_time":"HH:MM",',
      '      "title":"제목", "category":"식사|카페|관광|쇼핑|이동|숙소|기타",',
      '      "memo":"한 줄" 또는 null, "lat":숫자 또는 null, "lng":숫자 또는 null }',
      '  ]',
      '}',
      '',
      `[채울 날짜] ${days.join(', ')}`,
      ctx ? '\n아래는 이 여행의 자료다. 이미 들어 있는 일정과 겹치게 넣지 않는다.\n' + ctx : '',
    ].filter(Boolean).join('\n');

    // ── 링크를 던졌으면 그 글을 읽어옵니다 ──
    // 남이 짜둔 일정·맛집 목록은 대부분 블로그에 있습니다. 옮겨 적는 대신 읽어 옵니다.
    // 링크는 하나만 읽었는데, 사람들은 블로그 두세 개를 한꺼번에 붙여넣습니다.
    // 최대 셋까지 **동시에** 읽습니다. 하나씩 읽으면 셋에 24초가 걸립니다.
    mark('ctx');
    const { block: blogBlock, report: blogReport, maps: mapHits } = await linksP;
    mark('links');

    // ── 웹 검색 ──
    // 영업시간·가격·평점처럼 바뀌는 것은 우리 자료에 없습니다.
    // 사진을 물었을 때는 안 합니다 — 물음이 사진에 대한 것이라 검색어가 엉뚱해집니다.
    // 초안(draft)도 안 합니다. 하루치가 아니라 여행 전체라 검색 한 번으로 안 됩니다.
    // 링크가 있으면 검색도 안 합니다 — 검색어가 주소가 되어 엉뚱한 결과만 옵니다.
    let hits: { title: string; snippet: string; link: string }[] | null = null;
    const tavily = Deno.env.get('TAVILY_KEY');
    // 링크를 줬으면 웹 검색은 건너뜁니다 — 읽을 글을 이미 받았습니다.
    // 예전 변수(blog)를 여러 링크(blogBlock)로 바꾸면서 이 줄을 안 고쳐
    // "blog is not defined" 로 답이 통째로 막혔습니다.
    // searchOn 은 관리자가 화면에서 끌 수 있는 스위치입니다(db/047).
    // 끄면 Tavily 크레딧이 아예 안 나갑니다 — 답은 검색 없이 그대로 합니다.
    if (searchOn && tavily && !draft && !shot && !blogBlock && needsSearch(String(message))) {
      const dest = tripRow?.destination ?? '';
      hits = await webSearch(tavily, admin,
        searchQuery(String(message), dest), 5,
        searchDomains(String(message), tripRow?.country ?? ''), 마감);
    }
    mark('search');   /* 검색만 따로 잽니다(2026-10-16) — 전엔 「history」 숫자에 검색이 섞여 있었습니다 */
    const searchBlock = hits?.length
      ? '\n[방금 검색한 결과] — 아래 내용을 근거로 답한다\n' +
        hits.map((h, i) => `${i + 1}. ${h.title}\n   ${h.snippet}\n   ${h.link}`).join('\n') +
        '\n'
      : '';

    const system = [
      '너는 여행 계획을 돕는 조수다. 한국어로, 짧고 구체적으로 답한다.',
      '말투는 "~해요", "~예요" 로 쓴다. "~합니다", "~입니다" 는 쓰지 않는다 — 앱 전체가 그 말투다.',
      '',
      '규칙:',
      '- 자료에 없는 것을 지어내지 않는다. 모르면 모른다고 한다.',
      blogBlock
        ? '- [사용자가 준 글]에 있는 장소만 옮긴다. 그 글에 없는 곳을 지어내지 않는다.\n' +
          '  일정이나 맛집 목록이면 actions 로 내서 바로 담을 수 있게 한다.'
        : '',
      searchBlock
        ? '- [방금 검색한 결과]에 있는 내용만 근거로 삼는다. 거기 없는 숫자는 지어내지 않는다.\n' +
          '  검색 결과에도 없으면 "찾지 못했습니다"라고 적는다.'
        : '- 특히 영업시간 · 휴무일 · 가격 · 평점은 확인한 것만 말하고,\n' +
          '  아니면 "직접 확인이 필요합니다"라고 적는다.',
      '- 일정을 직접 고치지 않는다. 제안만 하고 사용자가 앱에서 넣게 한다.',
      '  그래서 "넣었어요", "추가했어요", "담았어요"처럼 **이미 한 것처럼 말하지 않는다.**',
      '  "아래 카드를 누르면 넣을 수 있어요"처럼 말한다.',
      '- 하루에 4~5개를 넘겨 채우지 않는다. 빈 시간을 남기는 편이 낫다.',
      '- 이동 시간을 무시하지 않는다. 그날이 속한 구간의 이동 어림값을 쓴다.',
      '- 도시가 여러 곳이면 그날 어느 구간인지 보고 답한다.',
      '  로마 일정에 피렌체 식당을 넣지 않는다.',
      '- 예약번호 · 주소 · 전화번호를 새로 지어내지 않는다.',
      // 자료를 넘겨줘도 쓰라고 말해주지 않으면 안 씁니다. 넷 다 한 줄씩 적습니다.
      '- 날짜를 셀 때는 [오늘]을 기준으로 삼는다. 네가 아는 오늘이 아니다.',
      '  "오늘" "내일" "이번 주"는 전부 [오늘]에서 센다.',
      '- 몇 명인지는 [일행]에서 본다. 인원수에 따라 답이 달라지면 그렇게 적는다.',
      '- 첫날과 마지막 날은 [예약]의 도착 · 출발 시각 안에서만 짠다.',
      '  도착이 저녁이면 그날 오전 일정을 넣지 않는다.',
      '- 뭘 챙길지 물으면 [준비물]에 이미 있는 것은 빼고 답한다.',
      '  없는 목록을 처음부터 늘어놓으면 이미 챙긴 것을 또 챙기게 한다.',
      '- 어디가 좋을지 물으면 [높게 준 도시]와 [취향]을 근거로 삼는다.',
      '  그 사람이 실제로 좋아한 곳이 일반적인 추천보다 낫다.',
      '- **무엇을 할지**를 정할 때는 [높게 준 장소]를 본다. 어디를 좋아하는지와',
      '  무엇을 하기를 좋아하는지는 다르다 — 도시 별점으로는 후자를 알 수 없다.',
      '  한줄평이 붙어 있으면 그 말을 점수보다 무겁게 본다. 본인이 직접 쓴 것이다.',
      '- **[추천에서 빼야 할 곳] 은 제외 목록이다. 거기 있는 곳은 답에 넣지 마라.**',
      '  이미 가기로 정한 곳이라, 또 권하면 아무것도 모르고 말하는 것으로 보인다.',
      '  그 목록에서 고르는 것이 아니다. 대신 그 곳들과 어울리는 **다른** 곳이나 동선을 말한다.',
      '',
      shots.length
        ? `- 사진이 ${shots.length}장 함께 왔다. 사진에 보이는 것만 말하고, 안 보이는 것은 지어내지 않는다.\n` +
          '  글자가 흐려서 못 읽으면 못 읽는다고 한다.' +
          (shots.length > 1 ? '\n  여러 장이면 몇 번째 사진 이야기인지 밝힌다.' : '')
        : '',
      '',
      '반드시 아래 JSON 하나만 낸다. 설명이나 코드블록을 덧붙이지 않는다.',
      '{',
      '  "reply": "사람에게 할 말. 마크다운 써도 된다.",',
      `  "sources": [${SRC_ALL.map((s) => `"${s}"`).join(',')} 중 실제로 근거로 삼은 것만],`,
      '  "places": [',
      '    { "name":"한국어 이름", "name_local":"현지 표기", "category":"식사|카페|관광|쇼핑|이동|숙소|기타",',
      '      "lat":숫자, "lng":숫자, "why":"한 줄 이유" }',
      '  ],',
      '  "actions": [',
      '    { "type":"add_plan", "date":"YYYY-MM-DD", "start_time":"HH:MM" 또는 null,',
      '      "title":"제목", "category":"위와 같음", "memo":"한 줄" 또는 null,',
      '      "lat":숫자 또는 null, "lng":숫자 또는 null }',
      '  ],',
      '  "fill_coords": false',
      '}',
      '',
      'places · actions 규칙:',
      '- 단순히 묻는 말이면 places 와 actions 를 빈 배열로 둔다. 억지로 채우지 않는다.',
      '- 좌표는 아는 곳만 넣는다. 모르면 null 로 둔다. 지어낸 좌표는 넣지 않는다.',
      '- 날짜는 위 구간을 보고 그 도시에 맞는 날로 넣는다.',
      '- 한 번에 5개를 넘기지 않는다.',
      '- 같은 곳을 places 와 actions 에 **둘 다 넣지 않는다.** 일정에 넣을 것이면',
      '  actions 에만 넣는다 — 화면에서 그 카드로 둘 다 할 수 있다.',
      '- **reply 안에 무엇을 냈는지 이름으로 적는다.** 둘 이상이면 번호를 붙인다.',
      '  ("1. 쌍용각  2. 죽서루" 처럼). 사용자는 다음 말에서 "1번", "그거" 로',
      '  가리킨다. reply 에 이름이 없으면 네가 방금 낸 것을 너도 못 찾는다 —',
      '  카드는 대화에 안 남고 이 글만 남는다.',
      '',
      // b835 — 사용자: 「AI 성능이 너무 떨어져」. 「오이타 공항은 왜 좌표를 못 넣었어?」·「검색해서 넣으면 되잖아」에
      // 「시스템에 없어서 못 넣어요」라고만 했습니다. 좌표를 채우는 동작이 아예 없었기 때문입니다.
      // 이제 이 신호를 내면 화면(aiui.js)이 cands.js 의 `일정좌표채우기`를 돌립니다 — AI 는 현지 이름만 짓고
      // 좌표는 지도 자료(국토지리원·OSM)에서 옵니다. 좌표를 지어내지 않는 규칙은 그대로입니다.
      'fill_coords 규칙 — 좌표(지도 위치) 채우기:',
      '- 사용자가 일정의 좌표·지도 위치를 채워 달라거나, 좌표가 왜 비었냐고 묻거나, 검색해서 넣으라고 하면',
      '  fill_coords 를 true 로 둔다. 그러면 앱이 좌표가 빠진 일정을 지도 자료(일본은 국토지리원, 그 밖은',
      '  OpenStreetMap)에서 찾아 넣고 결과를 따로 알려 준다.',
      '- 그때 reply 는 「좌표가 빠진 일정의 위치를 지도에서 찾아 넣을게요」처럼 한 줄로 쓴다.',
      '  「못 한다」·「검색 기능이 없다」·「시스템에 없다」고 하지 않는다 — 앱이 할 수 있다.',
      '- 좌표 숫자를 네가 지어내지 않는다. 좌표 이야기가 아니면 fill_coords 는 false 로 둔다.',
      '',
      'sources 규칙 — 이건 사용자에게 그대로 보여준다. 정확해야 한다:',
      // 짝을 **한 곳에서만** 만듭니다. 아래 흰 목록도 같은 SRC_MAP 을 씁니다.
      '- 아래 자료를 보고 답했으면 그 이름을 넣는다. 빈 배열로 두지 않는다:',
      '  ' + SRC_MAP.map(([k, label]) => `${label}→"${k}"`).join('  '),
      '- 자료에 없고 네가 원래 알던 것으로 답한 부분이 있으면 "general" 을 반드시 넣는다.',
      '  사용자는 이걸 보고 직접 확인할지 정한다. 숨기면 안 된다.',
      searchBlock,
      blogBlock,
      // 여행을 안 골라도 취향·별점은 옵니다. 그때 "이 여행의 자료다"라고 하면
      // 있지도 않은 여행 이야기로 읽습니다 — 무엇이 온 것인지 정확히 적습니다.
      ctx
        ? `\n아래는 우리가 가진 자료다${
            tripRow ? '' : ' — 여행은 안 골랐고, 이 사람의 취향과 별점만 있다'}.\n` + ctx
        : '\n(가진 자료가 없다.)',
    ].join('\n');

    // ── 불러오기 지시문 ──
    // 여기서 제일 중요한 것은 **"Day 1" 을 실제 날짜로 바꾸는 것**입니다.
    // 사람들이 짜둔 일정은 거의 다 Day 번호로 적혀 있는데, 우리는 실제 날짜로 저장합니다.
    // 그 변환을 사람이 손으로 하면 옮겨 적는 것과 다를 바가 없습니다.
    const importSystem = [
      '너는 이미 짜여 있는 여행 일정을 읽어 옮겨 적는 조수다. 한국어로 쓴다.',
      '말투는 "~해요", "~예요" 로 쓴다. "~합니다", "~입니다" 는 쓰지 않는다 — 앱 전체가 그 말투다.',
      '',
      '지켜야 할 것:',
      '- **주어진 자료에 있는 것만 옮긴다.** 없는 일정을 지어내지 않는다.',
      '  자료가 비었거나 일정이 아니면 actions 를 빈 배열로 둔다.',
      '- "Day 1" · "1일차" · "첫째 날" 은 아래 [여행 날짜] 의 첫 번째 날이다.',
      '  Day 2 는 두 번째 날, 이런 식으로 센다.',
      '- 실제 날짜(9/12, 2026-09-12, 9월 12일)가 적혀 있으면 그것을 그대로 쓴다.',
      '- 날짜를 알 수 없는 줄은 버리지 말고 첫날에 넣는다. 사용자가 옮기면 된다.',
      '- 시각이 있으면 HH:MM 으로. 오전/오후·AM/PM 을 24시간으로 바꾼다.',
      '  "점심"·"저녁"처럼 시각이 아닌 말은 시각으로 만들지 말고 null 로 둔다.',
      '- 표에서는 장소 이름이 들어 있는 칸을 제목으로 쓴다.',
      '  가격·메모·비고 칸은 memo 에 짧게 옮긴다.',
      '- 숙소·항공편·기차도 일정이다. 분류를 숙소·이동으로 준다.',
      '- 좌표는 적지 않는다. 우리가 나중에 채운다. lat·lng 칸을 아예 내지 않는다.',
      '- 같은 일정이 두 번 적혀 있으면 한 번만 낸다.',
      '',
      '반드시 아래 JSON 하나만 낸다. 설명이나 코드블록을 덧붙이지 않는다.',
      '{',
      '  "reply": "몇 개를 읽었는지, 애매했던 것이 있으면 무엇인지 두세 줄.",',
      '  "actions": [',
      '    { "type":"add_plan", "date":"YYYY-MM-DD", "start_time":"HH:MM" 또는 null,',
      '      "title":"제목", "category":"식사|카페|관광|쇼핑|이동|숙소|기타",',
      '      "memo":"한 줄" 또는 null }',
      '  ]',
      '}',
      '',
      `[여행 날짜] ${days.join(', ')}`,
      ctx ? '\n아래는 이 여행에 이미 들어 있는 자료다. 겹치는 것은 다시 내지 않는다.\n' + ctx
          : '',
    ].filter(Boolean).join('\n');

    /* ── 여태 나눈 이야기를 읽어 옵니다 ────────────────────────────────
     * **화면이 보내주지 않고 여기서 직접 읽습니다.** 화면이 보내면 그 말이
     * 진짜 오간 말인지 확인할 방법이 없습니다. asUser 로 읽으므로 RLS 가
     * 그대로 걸려 남의 대화는 애초에 안 나옵니다.
     *
     * **여행마다 따로입니다** — 화면도 여행별로 보여줍니다(loadChats).
     * 여행을 안 고르고 물어보는 대화(trip_id 없음)도 그들끼리 이어집니다.
     *
     * 열두 개까지, 그리고 글자로도 자릅니다. 대화가 길어질수록 요청이 커지고
     * 그만큼 느려지고 비싸집니다 — 무한정 들고 갈 수는 없습니다.
     * 오래된 것부터 버립니다(가까운 말이 가리키는 대상일 확률이 높습니다).
     * 초안·불러오기는 대화가 아니라 한 번 하는 일이라 안 붙입니다. */
    // deno-lint-ignore no-explicit-any
    let history: any[] = [];
    if (기록P) {
      /* 위에서 미리 출발시킨 것을 여기서 받습니다(여행마다 · 최신 12개 — 예전과 같은 질의). */
      const { data: past, error: pastErr } = await 기록P;
      /* 못 읽었으면 «처음 하는 대화»로 꾸미지 않습니다(2026-10-16) — 「1번 넣어줘」를
         엉뚱하게 알아듣는 대신 되묻게 합니다. 까닭은 로그에만. */
      if (pastErr) {
        console.error(`[${요청번호}] db chats`, pastErr.code ?? '', String(pastErr.message ?? '').slice(0, 200));
        history = [
          { role: 'user', parts: [{ text: '[알림] 앞서 나눈 대화를 서버 사정으로 지금 못 읽었다. ' +
              '이번 말이 앞 대화를 가리키면(「1번」, 「그거」) 무엇인지 되묻는다.' }] },
          { role: 'model', parts: [{ text: '알겠습니다. 앞 대화를 가리키면 되묻겠습니다.' }] },
        ];
      }
      let left = 4000;                       /* 글자 예산 */
      if (!pastErr) history = (past ?? [])   /* 최신순으로 왔습니다 */
        .filter((m) => m?.content)
        .filter((m) => {                     /* 예산 안에 드는 것까지만 */
          const n = String(m.content).length;
          if (n > left) return false;
          left -= n; return true;
        })
        .reverse()                           /* 모델에게는 오래된 것부터 */
        .map((m) => ({
          /* chats 는 'user' 와 'model' 로 저장합니다 — Gemini 가 쓰는 이름과
             같습니다. 혹시 다른 값이 들어와도 user 로 떨어뜨립니다. */
          role: m.role === 'model' ? 'model' : 'user',
          parts: [{ text: String(m.content).slice(0, 1200) }],
        }));
    }
    mark('history');

    const contents = imp
      ? [
          { role: 'user', parts: [{ text: importSystem }] },
          { role: 'model', parts: [{ text: '알겠습니다. 자료에 있는 것만 옮기겠습니다.' }] },
          { role: 'user', parts: [
              ...shots.map((s) => ({ inlineData: s })),
              { text: '아래가 옮길 일정이다.\n\n' + blogBlock + String(message ?? '') },
            ] },
        ]
      : draft
      ? [
          { role: 'user', parts: [{ text: draftSystem }] },
          { role: 'model', parts: [{ text: '알겠습니다. 날짜를 빠짐없이 채우겠습니다.' }] },
          { role: 'user', parts: [{ text:
              `${days.length}일 일정 초안을 짜줘.` +
              (message ? ' ' + String(message).slice(0, 300) : '') }] },
        ]
      : [
          { role: 'user', parts: [{ text: system }] },
          { role: 'model', parts: [{ text: '알겠습니다. 자료를 보고 답하겠습니다.' }] },
          // ── 여태 나눈 이야기 ──
          // **이게 통째로 빠져 있었습니다.** 보내는 것이 [규칙]→[알겠습니다]→[지금 친 말]
          // 셋뿐이라 매 요청이 서로 남남이었습니다. 화면에는 대화가 쭉 보이고
          // chats 표에도 다 있는데 **모델에게만 안 갔습니다.**
          // 그래서 "1번", "그거", "좀 더 싼 데로" 같은 말을 하나도 못 알아들었고,
          // 사용자가 "1번 둘째날에 넣어줘" 했을 때 "1번이 어떤 장소인지 알기
          // 어려워요"라고 답했습니다 — 자기가 방금 낸 것인데도요.
          ...history,
          // 사진은 물음과 같은 차례에 넣습니다. 사진이 먼저 오면 모델이 잘 봅니다.
          { role: 'user', parts: [
              ...shots.map((s) => ({ inlineData: s })),
              { text: String(message ?? '이 사진에 대해 알려줘.') },
            ] },
        ];

    // ── 불러오기가 길면 나눠서 동시에 ──
    // 걸리는 시간의 대부분은 모델이 답을 써 내려가는 시간입니다. 자료가 길면
    // 뽑을 일정도 많아져 그만큼 늘어납니다. 셋으로 갈라 한꺼번에 보내면
    // 제일 긴 조각만큼만 걸립니다. 사용 횟수는 위에서 이미 1회만 셌습니다.
    const impBody = blogBlock + String(message ?? '');
    const chunks = (imp && !shots.length && impBody.length > IMP_CHUNK)
      ? splitText(impBody, IMP_CHUNK, IMP_PARTS) : null;

    let raw = '';
    /* 대화(chat) 답이 어디서 시간을 먹는지 재려고 남깁니다(2026-10-16 — 17.9초 중 13.8초가 Gemini 였음).
       Gemini 가 답과 같이 주는 글자(토큰) 수: 읽은 것 · 쓴 것 · 속으로 생각한 것. 동작은 안 바꿉니다. */
    let 재기 = '';

    if (chunks && chunks.length > 1) {
      const got = await Promise.all(chunks.map((c, i) => askGemini(key, [
        { role: 'user',  parts: [{ text: importSystem }] },
        { role: 'model', parts: [{ text: '알겠습니다. 자료에 있는 것만 옮기겠습니다.' }] },
        { role: 'user',  parts: [{ text:
            `아래가 옮길 일정이다. 전체를 ${chunks.length}조각으로 나눈 것 중 ` +
            `${i + 1}번째다. **이 조각에 적힌 것만** 옮기고, 여기 없는 날은 만들지 않는다.` +
            '\n\n' + c }] },
      ], true, 모델, 마감)));

      // 조각끼리 같은 일정을 겹쳐 낼 수 있습니다(앞뒤가 잘린 자리).
      // 날짜·시각·제목이 같으면 같은 것으로 봅니다.
      // deno-lint-ignore no-explicit-any
      const acts: any[] = [];
      const seen = new Set<string>();
      let reply = '';
      for (const t of got) {
        if (!t) continue;
        // deno-lint-ignore no-explicit-any
        let o: any = {};
        try { o = JSON.parse(t); } catch { continue; }
        if (!reply && o?.reply) reply = String(o.reply);
        for (const a of (o?.actions ?? [])) {
          const k = `${a?.date}|${a?.start_time ?? ''}|${String(a?.title ?? '').trim()}`;
          if (seen.has(k)) continue;
          seen.add(k); acts.push(a);
        }
      }
      // 조각이 하나도 답을 못 냈으면 통째로 실패한 것입니다.
      if (!got.some(Boolean))
        return json({ error: 'AI가 답을 안 줬어요. 잠시 뒤 다시 물어봐주세요.' }, 502);
      raw = JSON.stringify({
        reply: reply || `${acts.length}개를 찾았습니다.`, actions: acts });
    } else if (imp) {
      /* 조각을 안 나눈 짧은 자료도 똑같이 가벼운 모델로 갑니다.
         여기만 큰 모델로 두면 "짧은 게 더 느린" 이상한 일이 생깁니다. */
      const t = await askGemini(key, contents, true, 모델, 마감);
      if (!t) return json({ error: 'AI가 답을 안 줬어요. 잠시 뒤 다시 물어봐주세요.' }, 502);
      raw = t;
    } else {
      let 쓴모델 = 모델, 번 = 1;
      /* 생각 정도 설정(있을 때만). 모델이 거절하면(400) 설정 없이 같은 모델로 바로 한 번 더 —
         설정 하나 때문에 답이 안 나오거나 가벼운 모델로 떨어지면 안 됩니다. */
      let 생각덧 = 생각?.cfg ?? {};
      let 생각말 = 생각 ? 생각.이름 + (생각모두 ? '' : '(관리자)') : '없음';
      let r = await callGemini(모델, key, contents, 0.7, 생각덧, 0, 마감);
      if (r.code === 400 && 생각){
        console.error(`[${요청번호}] 생각 설정 거절`, 오류요약(r.body));
        생각덧 = {}; 생각말 = 생각.이름 + ' 거절됨→없음'; 번++;
        r = await callGemini(모델, key, contents, 0.7, {}, 0, 마감);
      }
      /* **429 만 다시 물어보고 있었습니다.** 그런데 무료 등급에서 훨씬 흔한 것은
         503 "The model is overloaded" 입니다 — 그건 재시도 없이 곧장
         "AI가 답을 안 줬어요"로 나갔습니다. 사용자가 실제로 그 화면을 만났고,
         **같은 질문이 잠시 뒤에는 그냥 됐습니다**(9.7초). 즉 물어보기를
         그만둔 것이 유일한 이유였습니다.
         불러오기 쪽(askGemini)은 이미 코드를 안 가리고 한 번 더 물어봅니다.
         여기만 안 하고 있었습니다. */
      if (r.code !== 200){
        console.error('gemini', r.code, 오류요약(r.body));
        /* 5xx 는 그 모델이 잠깐 붐비는 것입니다. 조금 쉬었다 **같은 모델**로
           한 번 더 — 여기서 바로 가벼운 모델로 넘기면 붐빔을 피하려다
           답의 품질을 잃습니다. */
        if (r.code >= 500){
          await new Promise((s) => setTimeout(s, 1200));
          r = await callGemini(모델, key, contents, 0.7, 생각덧, 0, 마감); 번++;
        }
        /* 그래도 안 되면(또는 한도 429 라면) 가벼운 모델로 넘깁니다. */
        if (r.code !== 200){
          console.error('gemini 재시도(→가벼운 모델)', r.code, 오류요약(r.body));
          r = await callGemini(MODEL_FALLBACK, key, contents, 0.7, {}, 0, 마감); 번++;
          쓴모델 = MODEL_FALLBACK;
        }
      }
      if (r.code !== 200){
        // HTTP 코드를 사용자에게 보여줄 이유가 없습니다. 로그에는 남습니다.
        console.error('gemini 최종실패', r.code, 오류요약(r.body));
        /* 마감에 걸린 실패면 «시간이 너무 걸렸다»로(화면이 다시 시도를 권할 수 있게 timeout 표시). */
        if (Date.now() >= 마감 - 최소남은ms)
          return json({ error: 늦음말, ref: 요청번호, timeout: true }, 504);
        return json({ error: 'AI가 답을 안 줬어요. 잠시 뒤 다시 물어봐주세요.', ref: 요청번호 }, 502);
      }

      const parsed = JSON.parse(r.body);
      const parts = parsed?.candidates?.[0]?.content?.parts ?? [];
      raw = parts.map((p: { text?: string }) => p.text ?? '').join('').trim();
      {
        const u = parsed?.usageMetadata ?? {};
        재기 = ` | 모델 ${쓴모델}${번 > 1 ? ` (${번}번째)` : ''}` + ` · 생각설정 ${쓴모델 === MODEL_FALLBACK ? '없음' : 생각말}` +
               ` | 토큰 읽음 ${u.promptTokenCount ?? '?'} · 씀 ${u.candidatesTokenCount ?? '?'}` +
               ` · 생각 ${u.thoughtsTokenCount ?? 0}` +
               ` | 답 ${raw.length}자 · 끝난까닭 ${parsed?.candidates?.[0]?.finishReason ?? '?'}`;
      }
      if (!raw) {
        const why = parsed?.promptFeedback?.blockReason ??
                    parsed?.candidates?.[0]?.finishReason ?? '알 수 없음';
        /* blockReason(SAFETY 등)은 영어 코드라 사용자에게는 뜻이 없습니다.
           로그에만 남기고, 화면에는 무엇을 해보면 되는지 적습니다. */
        console.error('gemini empty', why);
        return json({ error: '답을 못 받았어요. 물어보는 말을 조금 바꿔서 다시 해보세요.' }, 502);
      }
    }

    mark('gemini');
    console.log('TIMING ' + (imp ? 'import' : draft ? 'draft' : 'chat') +
      ' | ' + lap.join(' | ') + ' | 총 ' + (Date.now() - T0) + 'ms' +
      ' | 글자 ' + (blogBlock.length + String(message ?? '').length) +
      ' | 조각 ' + (chunks?.length ?? 1) + 재기);

    // JSON 을 못 받아도 말은 전합니다. 형식이 깨졌다고 답까지 버릴 이유는 없습니다.
    let out: { reply?: string; places?: unknown[]; actions?: unknown[];
               sources?: unknown[]; fill_coords?: unknown } = {};
    try { out = JSON.parse(raw); } catch { out = { reply: raw }; }

    // ── 안전장치 (문서 7장) ──
    // AI 는 직접 쓰지 않습니다. 여기서 걸러 카드로만 내보내고, 저장은 사용자가 합니다.
    const CATS = ['식사', '카페', '관광', '쇼핑', '이동', '숙소', '기타'];
    // 초안은 여행 기간 밖 날짜를 만들어 오면 안 됩니다. 목록에 있는 날만 받습니다.
    const dayset = new Set(days);
    const inTrip = (d: string) => {
      if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
      return (draft || imp) ? dayset.has(d) : true;
    };

    // 좌표가 구간 중심에서 너무 멀면 버립니다.
    // 도쿄를 물었는데 이탈리아 좌표가 오는 일이 실제로 있었습니다.
    const centers: number[][] = legs
      .filter((l) => l.center_lat != null && l.center_lng != null)
      .map((l) => [Number(l.center_lat), Number(l.center_lng)]);
    const nearOk = (lat: unknown, lng: unknown) => {
      if (typeof lat !== 'number' || typeof lng !== 'number') return false;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
      if (!centers.length) return true;              // 중심을 모르면 판단하지 않습니다
      return centers.some(([a, b]) => distKm(a, b, lat, lng) <= 120);
    };
    const coords = (o: Record<string, unknown>) =>
      nearOk(o.lat, o.lng) ? { lat: o.lat as number, lng: o.lng as number }
                           : { lat: null, lng: null };

    const places = (Array.isArray(out.places) ? out.places : [])
      .slice(0, 5)
      .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
      .map((p) => ({
        name: String(p.name ?? '').slice(0, 60),
        name_local: p.name_local ? String(p.name_local).slice(0, 60) : null,
        category: CATS.includes(String(p.category)) ? String(p.category) : null,
        why: p.why ? String(p.why).slice(0, 120) : null,
        ...coords(p),
      }))
      .filter((p) => p.name);

    // 묻고 답할 때는 5개까지. 초안은 여행 전체를 채우므로 하루 6개까지 봐줍니다.
    const actions = (Array.isArray(out.actions) ? out.actions : [])
      .slice(0, (draft || imp) ? Math.max(6, days.length * 8) : 5)
      .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
      .filter((a) => a.type === 'add_plan' && inTrip(String(a.date)))
      .map((a) => ({
        type: 'add_plan',
        date: String(a.date),
        start_time: /^\d{2}:\d{2}$/.test(String(a.start_time)) ? String(a.start_time) : null,
        title: String(a.title ?? '').slice(0, 60),
        category: CATS.includes(String(a.category)) ? String(a.category) : null,
        memo: a.memo ? String(a.memo).slice(0, 200) : null,
        ...coords(a),
      }))
      .filter((a) => a.title);

    // 근거는 정해둔 것만 통과시킵니다. 모델이 아무 말이나 적어 오면
    // 사용자는 그게 확인된 것인 줄 압니다.
    // ⚠ **여기가 진짜 원인이었습니다** (2026-08-11). 프롬프트에 새 이름 다섯을
    // 더하고 화면의 `SRC_KO` 에도 더했는데 **이 흰 목록만 옛 다섯 개 그대로**여서,
    // 모델이 "packing" 을 내도 여기서 조용히 버려졌습니다. 근거 칩이 늘 비었고
    // 나는 "모델이 말을 안 듣는다"고 세 번 잘못 짚었습니다.
    // **같은 목록이 세 곳에 있었던 것**이 뿌리입니다 — 프롬프트 두 곳과 이 목록.
    // 이제 `SRC_MAP` 하나에서 프롬프트와 흰 목록이 같이 나옵니다.
    // (화면의 `app.js` `SRC_KO` 는 한글 이름이라 따로 있습니다. 거기는
    //  모르는 이름을 **버리는** 쪽이라, 빠뜨려도 칩이 안 뜰 뿐 틀리지는 않습니다.)
    const sources = [...new Set((Array.isArray(out.sources) ? out.sources : [])
      .map((s) => String(s)).filter((s) => SRC_ALL.includes(s)))];

    /* ── 지도 링크로 고른 곳은 우리가 직접 카드로 만듭니다 ──
       모델에게 맡겼더니 아무것도 안 냈습니다(위 readLinks 주석의 실측).
       이름도 좌표도 주소에서 그대로 뽑은 것이라 모델보다 정확합니다.
       날짜를 알 수 없으니 일정이 아니라 **후보**로 냅니다 — 언제 갈지는
       사용자가 정할 일입니다. */
    const mapPlaces = (mapHits ?? []).map((m) => {
      const la = Number(m.lat), ln = Number(m.lng);
      const ok = Number.isFinite(la) && Number.isFinite(ln) &&
                 Math.abs(la) <= 90 && Math.abs(ln) <= 180;
      return {
        name: (m.name || '지도에서 고른 곳').slice(0, 60),
        name_local: null,
        category: null,
        why: '구글 지도 링크에서 가져왔어요',
        lat: ok ? la : null,
        lng: ok ? ln : null,
      };
    }).filter((p) => p.name);
    // 같은 곳을 모델도 냈으면 우리 것만 남깁니다. 좌표가 붙어 있는 쪽입니다.
    const mapNames = new Set(mapPlaces.map((p) => p.name));
    const allPlaces = [...mapPlaces, ...places.filter((p) => !mapNames.has(p.name))];
    /* **일정 쪽에서도 걸러야 합니다.** places 만 걸렀더니 같은 장소가
       카드 두 개로 나왔습니다 — '일정으로 넣기 Colosseo(좌표 없음)' 와
       '후보로 담기 Colosseo(좌표 있음)'. 모델이 붙인 날짜는 여행 첫날일
       뿐 근거가 없고, 좌표도 없습니다. 우리 것만 남깁니다. */
    const actionsOut = actions.filter((a) => !mapNames.has(a.title));

    /* ⚠ **"다시 권하지 마라"를 프롬프트로 시켰더니 정반대로 했습니다.**
       실제로 물어봤습니다 — "로마에서 뭐 하면 좋을까?" 에 sources 로
       `candidates` 를 인용해놓고, **담아둔 네 곳 중 셋을 그대로 추천**했습니다.
       목록을 보여줬더니 "여기서 고르라"로 읽은 것입니다.

       **지켜야 하는 규칙은 프롬프트가 아니라 코드에 둡니다.** 프롬프트는
       부탁이고 코드는 보장입니다. 카드(담기·일정 넣기)는 여기서 걸러냅니다 —
       이미 담아둔 곳이 카드로 또 나오면 누르는 순간 중복이 생깁니다.
       (글로 쓴 답까지는 못 막습니다. 그건 프롬프트로 한 번 더 못박습니다.) */
    const already = new Set(
      // deno-lint-ignore no-explicit-any
      ((candList ?? []) as any[]).map((c) => String(c.title || '').trim()).filter(Boolean));
    const same = (a: string, b: string) =>
      a === b || a.includes(b) || b.includes(a);   /* '판테온' 과 '아르만도 알 판테온' */
    const dropDup = (name: string) =>
      ![...already].some((c) => same(String(name || '').trim(), c));
    const placesOut = allPlaces.filter((p) => dropDup(p.name));
    const actsOut = actionsOut.filter((a) => dropDup(a.title));

    return json({
      reply: 완료말고치기(String(out.reply ?? raw), placesOut.length + actsOut.length > 0).slice(0, 4000),
      places: placesOut, actions: actsOut, sources,
      // 어디서 읽어온 것인지 링크째 돌려줍니다. 눌러서 직접 확인할 수 있어야
      // "검색해서 답했다"는 말이 확인 가능한 말이 됩니다.
      web: (hits ?? []).map((h) => ({ title: h.title, link: h.link })),
      // 링크를 읽었는지 못 읽었는지. 조용히 실패하면 사용자는 "왜 링크를 무시하지?"만
      // 알고 이유를 모릅니다. 화면에서 "이 링크는 못 읽었어요"라고 말해줍니다.
      blogs: blogReport.length ? blogReport : undefined,
      used: take.used, limit: take.limit,
      // b835 — 「좌표 채우기」 신호. 묻고 답할 때만(초안·불러오기는 아님). 화면이 받아서 지도 자료로 찾습니다.
      fill_coords: (!draft && !imp && out.fill_coords === true) ? true : undefined,
      // 어느 날이 비었는지는 화면에서 알려줍니다. 다시 짜달라고 할지 사용자가 정합니다.
      days: (draft || imp) ? days : undefined,
    });
  } catch (e) {
    /* 예상 못 한 오류. 예전엔 오류 글을 그대로 돌려줬습니다(내부 이름·경로가 실림).
       이제 로그에만 남기고 사용자에겐 쉬운 말과 번호만(2026-10-16). */
    console.error(`[${요청번호}] 예상 못 한 오류 | ` + lap.join(' | '));
    return 내부오류('catch', e);
  } finally {
    clearTimeout(끊김타이머);   /* 다 끝났으면 마감 타이머를 치웁니다(함수 인스턴스는 다음 요청에도 씀) */
  }
}

Deno.serve(처리);
