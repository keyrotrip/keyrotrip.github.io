/**
 * 도시 사진 찾기 · 넣기. **한 번 쓰고 버리는 함수입니다.**
 *
 * 두 가지 일을 합니다.
 *   mode:'search'  사진이 없는 도시를 골라 Pexels 후보를 3장씩 찾아 **주소만** 돌려줍니다.
 *                  올리지 않습니다 — 사람이 눈으로 보고 고르는 것이 이 작업의 요점입니다.
 *   mode:'apply'   { id: 주소 } 로 고른 것만 받아 Storage 에 올리고 cities 를 갱신합니다.
 *
 * 왜 나눴나: 검색 결과가 그 도시가 맞는지 기계는 모릅니다. "Bishkek" 으로
 * 찾은 사진이 엉뚱한 곳이면 그것도 허위정보입니다. 그래서 고르는 일만은
 * 사람이 합니다.
 *
 * 키는 서버에만 둡니다(PEXELS_KEY). 화면에 두면 누구나 긁어갑니다.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const BUCKET = 'city-images';
const MARK = `/storage/v1/object/public/${BUCKET}/`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth) return json({ error: '로그인이 필요해요.' }, 401);

    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } });
    const { data: isAdmin } = await asUser.rpc('is_admin');
    if (isAdmin !== true) return json({ error: '관리자만 쓸 수 있어요.' }, 403);

    // 이름을 몇 가지로 넣어뒀을 수 있어 차례로 봅니다.
    const key = Deno.env.get('PEXELS_KEY') ?? Deno.env.get('PEXELS_API_KEY') ??
                Deno.env.get('PEXELS') ?? '';
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode ?? 'search');

    // ── 고른 것 넣기 ──
    /* ⚠⚠ **두 가지 모양을 받습니다(2026-09-30 사진 개편, db/109).** ⚠⚠
       · 글자 하나(옛 모양): { id: 주소 } — 예전처럼 `${id}.jpg` 한 장을 같은 이름에 덮어씁니다.
       · 묶음(새 모양): { id: { small, large, page, by, license } }
           small → `${id}-${표}.jpg`   목록 같은 작은 칸(image_url)
           large → `${id}-${표}-l.webp` 넘기며 매기기·도시 화면 맨 위 같은 큰 칸(image_lg)
         «표»는 큰 사진 주소로 만든 짧은 지문이라 **사진이 바뀌면 파일 이름도 바뀝니다** — 같은 이름에
         덮어쓰면 1년 보관(cacheControl) 때문에 이미 본 폰에는 옛 사진이 남았습니다(도쿄가 그랬음).
         출처 페이지·찍은 사람·라이선스는 앱의 「사진 출처」 화면이 읽습니다(위키미디어는 표시 의무).
       ⚠ 올리기가 다 된 뒤에 주소를 바꿉니다 — 반쯤 올라간 채 주소만 바뀌면 사진이 깨집니다.
       ⚠ 옛 파일은 지우지 않습니다(되돌릴 길). */
    if (mode === 'apply') {
      const picks: Record<string, unknown> = body?.picks ?? {};
      const done: string[] = [];
      const failed: { id: string; why: string }[] = [];
      /* 위키미디어는 이름표(User-Agent) 없는 요청을 403 으로 막고, 정해진 폭(500·960·1280·1920…)이 아니면
         400 을 줍니다(2026-09-30 재 봄). 그래서 이름표를 붙이고, 폭은 고르는 쪽에서 정해진 값으로 보냅니다. */
      const grab = async (src: string) => {
        const res = await fetch(src, { signal: AbortSignal.timeout(25000),
          headers: { 'User-Agent': 'KiroCityPhotos/1.0 (https://keyrotrip.github.io/)' } });
        if (!res.ok) throw new Error(`받기 ${res.status}`);
        const type = (res.headers.get('content-type') || 'image/jpeg').split(';')[0];
        const buf = new Uint8Array(await res.arrayBuffer());
        if (!buf.length) throw new Error('빈 파일');
        return { type, buf };
      };
      const put = async (path: string, f: { type: string; buf: Uint8Array }) => {
        const { error } = await admin.storage.from(BUCKET)
          .upload(path, f.buf, { contentType: f.type, upsert: true, cacheControl: '31536000' });
        if (error) throw new Error('올리기 ' + error.message);
        return `${url}${MARK}${path}`;
      };
      const 지문 = async (s: string) => {
        const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
        return [...new Uint8Array(h)].slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join('');
      };
      for (const [id, pick] of Object.entries(picks)) {
        if (!/^[a-z0-9_-]+$/.test(id)) { failed.push({ id, why: '이름이 이상함' }); continue; }
        if (pick && typeof pick === 'object') {
          const p = pick as { small?: string; large?: string; page?: string; by?: string; license?: string };
          try {
            if (!p.small || !p.large) throw new Error('small·large 가 둘 다 있어야 해요');
            /* 받는 곳을 못박습니다 — 관리자만 부르긴 해도, 아무 주소나 서버가 대신 받아 오게 두면 안 됩니다. */
            const 허용 = (s: string) => { try { const h = new URL(s).hostname;
              return h === 'images.pexels.com' || h === 'upload.wikimedia.org' || h === 'thumb.wikimedia.org'; } catch { return false; } };
            if (!허용(p.small) || !허용(p.large)) throw new Error('Pexels·위키미디어 사진만 받아요');
            const 표 = await 지문(p.large);
            const [s, l] = await Promise.all([grab(p.small), grab(p.large)]);
            const smallUrl = await put(`${id}-${표}.${s.type === 'image/png' ? 'png' : s.type === 'image/webp' ? 'webp' : 'jpg'}`, s);
            const largeUrl = await put(`${id}-${표}-l.${l.type === 'image/jpeg' ? 'jpg' : l.type === 'image/png' ? 'png' : 'webp'}`, l);
            const { error: updErr } = await admin.from('cities').update({
              image_url: smallUrl, image_lg: largeUrl, image_url_src: p.small,
              image_page: p.page ?? null, image_credit: p.by ?? null, image_license: p.license ?? null,
            }).eq('id', id).select('id');
            if (updErr) throw new Error('주소 갱신 ' + updErr.message);
            done.push(id);
          } catch (e) {
            failed.push({ id, why: String((e as Error)?.message ?? e).slice(0, 80) });
          }
          continue;
        }
        const src = String(pick ?? '');
        try {
          const res = await fetch(src, { signal: AbortSignal.timeout(20000) });
          if (!res.ok) { failed.push({ id, why: `받기 ${res.status}` }); continue; }
          const type = (res.headers.get('content-type') || 'image/jpeg').split(';')[0];
          const buf = new Uint8Array(await res.arrayBuffer());
          if (!buf.length) { failed.push({ id, why: '빈 파일' }); continue; }
          const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
          const path = `${id}.${ext}`;
          const { error: upErr } = await admin.storage.from(BUCKET)
            .upload(path, buf, { contentType: type, upsert: true, cacheControl: '31536000' });
          if (upErr) { failed.push({ id, why: '올리기 ' + upErr.message }); continue; }
          // 주소를 바꾸는 것이 마지막입니다. 올리기가 실패했는데 주소만 바꾸면
          // 그 도시 사진이 영영 깨집니다.
          const { error: updErr } = await admin.from('cities')
            .update({ image_url: `${url}${MARK}${path}`, image_credit: body?.credits?.[id] ?? null })
            .eq('id', id).select('id');
          if (updErr) { failed.push({ id, why: '주소 갱신 ' + updErr.message }); continue; }
          done.push(id);
        } catch (e) {
          failed.push({ id, why: String((e as Error)?.message ?? e).slice(0, 80) });
        }
      }
      return json({ done: done.length, doneIds: done, failed });
    }

    // ── 사진 번호로 정보 받기 ──
    /* { pids:[…] } → { photos: { pid: { by, page, alt, w, h } } }. 넣을 때 «찍은 사람»을 정확히 적으려고 둡니다
       (2026-09-30 사진 개편) — 검색을 다시 돌려 이름을 줍는 것보다 한 장에 한 번이라 정확하고 쌉니다. 올리지 않습니다. */
    if (mode === 'info') {
      if (!key) return json({ error: '사진 검색이 아직 준비되지 않았어요.' }, 500);
      const pids: number[] = (Array.isArray(body?.pids) ? body.pids : [])
        .slice(0, 60).map((x: unknown) => Number(x)).filter((x: number) => Number.isInteger(x) && x > 0);
      const photos: Record<string, unknown> = {};
      for (const pid of pids) {
        try {
          const r = await fetch(`https://api.pexels.com/v1/photos/${pid}`,
            { headers: { Authorization: key }, signal: AbortSignal.timeout(15000) });
          if (!r.ok) { photos[String(pid)] = { error: r.status }; continue; }
          const p = await r.json();
          photos[String(pid)] = { by: p.photographer ?? null, page: p.url ?? null, alt: p.alt ?? '',
                                  w: p.width ?? null, h: p.height ?? null };
        } catch (e) {
          photos[String(pid)] = { error: String((e as Error)?.message ?? e).slice(0, 60) };
        }
      }
      return json({ photos });
    }

    // ── 후보 찾기 ──
    if (!key) return json({ error: '사진 검색이 아직 준비되지 않았어요.' }, 500);
    const limit = Math.min(Math.max(Number(body?.limit) || 12, 1), 30);
    const offset = Math.max(Number(body?.offset) || 0, 0);
    /* ids 를 주면 **사진이 이미 있어도** 그 도시들을 찾습니다.
       마음에 안 드는 사진을 바꿀 때 씁니다 — 예전에는 그럴 길이 없어서
       바꾸려면 DB 에서 주소를 지워야 했습니다. */
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.slice(0, 30) : [];

    let q0 = admin.from('cities').select('id,name,name_en,country').order('id');
    q0 = ids.length ? q0.in('id', ids)
                    : q0.is('image_url', null).range(offset, offset + limit - 1);
    const { data: rows, error: selErr } = await q0;
    if (selErr) return json({ error: selErr.message }, 500);

    /* **나라를 코드로 넣으면 안 됩니다.** 'Akita JP' 로 찾았더니 아키타견
       사진만 왔고, 'Angeles PH' 는 천사상이 왔습니다. 두 글자 코드는 검색어로
       아무 뜻이 없어서 도시명의 다른 뜻을 못 눌러줍니다.
       나라 이름을 붙이면 'Akita Japan' 이 되어 도시 쪽으로 기울어집니다. */
    const { data: ccRows } = await admin.from('countries').select('code,name_en');
    const ccName: Record<string, string> =
      Object.fromEntries((ccRows ?? []).map((x: any) => [x.code, x.name_en]));

    /* **두 가지로 찾아 합칩니다.**
       그냥 이름만 넣으면 무난하지만 밋밋한 사진이 옵니다 — 골목, 흐린 하늘,
       평범한 건물. 목록에 깔릴 사진이라 눈에 걸리는 편이 낫습니다.
       그래서 'cityscape' 를 붙인 것도 같이 찾습니다. 다만 그쪽은 엉뚱한
       도시가 섞일 수 있으므로 **먼저 이름만으로 찾은 것을 앞에 둡니다.**
       고르는 사람이 앞에서부터 보고, 아니면 뒤를 봅니다.

       per_page 6 씩 둘이면 최대 12장입니다. 3장일 때는 셋 다 별로여도
       고를 것이 없어서 그냥 넘겼는데, 그렇게 넘긴 곳이 여덟이었습니다. */
    const PER = Math.min(Math.max(Number(body?.per) || 6, 1), 12);
    const hunt = async (query: string) => {
      const r = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
        `&per_page=${PER}&orientation=landscape`,
        { headers: { Authorization: key }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`pexels ${r.status}`);
      const j = await r.json();
      return (j.photos ?? []).map((p: any) => ({
        // large 는 가로 940 정도 — 고르는 화면의 미리보기로 씁니다.
        // 넣을 때는 original 에 크기를 붙여 두 판(작은 것·세로 1080)을 따로 받습니다(apply 의 묶음 모양).
        src: p.src?.large ?? p.src?.medium, orig: p.src?.original ?? null,
        pid: p.id ?? null, w: p.width ?? null, h: p.height ?? null, alt: p.alt ?? '',
        by: p.photographer, page: p.url,
      }));
    };

    /* **검색어를 직접 줄 수 있게 합니다.**
       한·일 지방도시는 이름만으로 찾으면 어느 도시인지 알 수 없는 일반 도시
       사진이 옵니다 — 창원·천안·진주·청주에 똑같은 한옥이 왔고 보령엔
       부산 해변이 왔습니다. 그런데 **명소 이름으로 찾으면 정확했습니다**
       (담양 메타세쿼이아길, 보성 녹차밭, 부여 궁남지).
       그래서 그 도시의 대표 명소를 사람이 정해 넘길 길을 둡니다. */
    const qs: Record<string, string> = body?.queries ?? {};

    const out: unknown[] = [];
    for (const c of rows ?? []) {
      const base = qs[c.id] ?? `${c.name_en ?? c.id} ${ccName[c.country] ?? c.country}`;
      try {
        /* 명소 이름을 줬으면(queries) 그 이름 하나로만 찾습니다 — 'Eiffel Tower cityscape' 는 탑이 작게
           나오는 도시 풍경을 섞어 옵니다(2026-09-30 사진 개편: 「관광지 어디다라는게 직관적으로」). */
        const [a, b] = await Promise.all([
          hunt(base),
          qs[c.id] ? Promise.resolve([]) : hunt(`${base} cityscape`).catch(() => []),
        ]);
        /* 같은 사진이 양쪽에 나오는 일이 흔합니다. 주소로 걸러냅니다. */
        const seen = new Set<string>();
        const photos = [...a, ...b].filter((p: any) =>
          p.src && !seen.has(p.src) && seen.add(p.src));
        out.push({ id: c.id, ko: c.name, q: base, photos });
      } catch (e) {
        out.push({ id: c.id, ko: c.name, q: base,
                   error: String((e as Error)?.message ?? e).slice(0, 60) });
      }
    }
    const { count } = await admin.from('cities')
      .select('id', { count: 'exact', head: true }).is('image_url', null);
    return json({ cities: out, left: count ?? 0 });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
