/* ── 여행 후기 · 후기 사진 ────────────────────────────────────────────
 * 다녀온 뒤에 별점과 한 줄을 남기고 사진을 붙이는 자리입니다. 여행이 끝나야
 * 열립니다 — 가기 전에 물으면 답할 것이 없습니다.
 *
 * ── app.js 에서 떼어낸 열네 번째 조각입니다(b340) ────────────────────
 * app.js 만 아는 것은 **로그인한 사람 하나**입니다. 내가 쓴 후기(`myReview`)는
 * app.js 의 상태 뭉치 안에 있었는데 **쓰는 곳이 이 블록뿐**이라 같이
 * 데려왔습니다 — ctx 로 받을 것이 아니었습니다(JOIN_URL 때와 같습니다).
 *
 * `fitImage` 는 사진을 줄이되 **가로세로 비를 지킵니다.** 프로필의
 * `shrink`(profile.js)는 가운데를 정사각으로 잘라냅니다. 닮았지만 합치면
 * 안 됩니다 — 얼굴은 잘라도 되고 풍경은 자르면 찍은 것이 잘려 나갑니다.
 *
 * 층: dom.js · db.js · net.js · calc.js · stars.js · trip.js · ui.js 만 씁니다. */
import { $, esc, toast } from './dom.js?v=b830';
import { sb } from './db.js?v=b830';
import { fail } from './net.js?v=b830';
import { todayYmd } from './calc.js?v=b830';
import { starHtml, starValue, starsRo } from './stars.js?v=b830';
import { trip, legs, nameOf } from './trip.js?v=b830';
import { arm, disarm } from './ui.js?v=b830';
import { openPhotos } from './photoview.js?v=b830';

let ctx = { me: () => null };
export function setReviewCtx(o){ ctx = { ...ctx, ...o }; }

/* 내가 이 여행에 남긴 후기. **app.js 의 상태 뭉치에 있던 것을 여기로
   옮겼습니다(b340)** — 쓰는 곳이 이 파일뿐이었습니다. */
let myReview = {};

/* ── 여행 후기 ──────────────────────────────────────────────────────
 * 끝난 여행에만 나옵니다. 일정을 쓰던 사람이 그대로 평가로 넘어가는 자리라,
 * 기록 탭을 따로 찾아가게 하지 않습니다.
 * 같은 여행도 사람마다 느낌이 다르므로 후기는 한 사람에 한 줄입니다. */
export async function loadReview(){
  const ended = trip.end_date < todayYmd();
  $('reviewbox').classList.toggle('hide', !ended);
  if (!ended) return;

  const ids = legs.map(l => l.city_id).filter(Boolean);
  const [mine, rates, all] = await Promise.all([
    sb.from('trip_reviews').select('stars,comment')
      .eq('trip_id', trip.id).eq('user_id', ctx.me().id).maybeSingle(),
    ids.length ? sb.from('city_ratings').select('city_id,stars')
                   .eq('user_id', ctx.me().id).in('city_id', ids)
               : Promise.resolve({ data: [] }),
    sb.from('trip_reviews').select('user_id,stars,comment').eq('trip_id', trip.id),
  ]);

  myReview = mine.data || {};
  $('rv_when').textContent = `${trip.end_date} 종료`;
  $('rv_stars').innerHTML = starHtml(myReview.stars);
  $('rv_note').value = myReview.comment || '';
  growNote();
  loadPhotos();          /* 사진은 안 기다립니다 — 글과 별점이 먼저 떠야 합니다 */

  const got = Object.fromEntries((rates.data || []).map(r => [r.city_id, r.stars]));
  $('rv_cities').innerHTML = ids.length
    ? `<div class="daysep">방문한 도시</div>` + legs.filter(l => l.city_id).map(l =>
        `<div class="rrow" style="padding:9px 0">
           <div class="t"><b>${esc(l.destination)}</b>
             <span class="stars" data-rvcity="${esc(l.city_id)}">${
               starHtml(got[l.city_id])}</span></div>
         </div>`).join('')
    : '';

  /* 일행이 남긴 후기. 같이 간 사람끼리는 서로 봅니다. */
  const others = (all.data || []).filter(r => r.user_id !== ctx.me().id && (r.stars || r.comment));
  $('rv_others').innerHTML = others.length
    ? `<div class="daysep">일행의 후기</div>` + others.map(r =>
        `<div class="rrow" style="padding:9px 0">
           <div class="t"><b>${esc(nameOf(r.user_id))}</b>
             ${r.comment ? `<span class="memo">${esc(r.comment)}</span>` : ''}
             ${starsRo(r.stars)}</div>
         </div>`).join('')
    : '';
}

async function saveReview(patch){
  const r = await sb.from('trip_reviews')
    .upsert({ trip_id: trip.id, user_id: ctx.me().id, ...myReview, ...patch },
            { onConflict: 'trip_id,user_id' })
    .select('stars,comment').maybeSingle();
  if (r.error) return fail(r.error, 'rv');
  myReview = r.data || myReview;
  $('rv_stars').innerHTML = starHtml(myReview.stars);
}

$('reviewbox').addEventListener('click', async e => {
  /* 사진 지우기 — 한 번 더 묻습니다. 통에서도 같이 지웁니다. */
  const del = e.target.closest('[data-rvdel]');
  if (del){
    if (del.dataset.armed !== '1'){ arm(del, '정말 지울까요?'); return; }
    const p = rvPhotos.find(x => x.id === del.dataset.rvdel);
    if (!p) return;
    del.disabled = true;
    const r = await sb.from('trip_photos').delete().eq('id', p.id).select('id');
    del.disabled = false; disarm(del); del.textContent = '×';
    if (r.error) return fail(r.error, 'rv');
    /* 표에서 지운 뒤 통에서도 지웁니다. 순서가 반대면 파일만 사라지고
       줄이 남아 깨진 사진이 뜹니다. 통 쪽이 실패해도 화면은 맞습니다. */
    await sb.storage.from('trip-photos').remove([p.path]);
    await loadPhotos();
    return;
  }

  const st = e.target.closest('.st'); if (!st) return;
  const wrap = st.closest('.stars');
  const v = starValue(st, e.clientX);   /* 반칸 규칙은 stars.js 한 곳(b491) */

  if (wrap.dataset.rvcity){
    /* 여기서 매긴 것이 곧 기록 탭의 도시 별점입니다. 두 벌로 두지 않습니다. */
    const cur = [...wrap.querySelectorAll('.st i')]
      .reduce((s, i) => s + parseFloat(i.style.width) / 100, 0);
    /* 0(끌어서 맨 왼쪽)도 지우기입니다 — b494, stars.js 의 끌린값 참고. */
    const next = (v === 0 || Math.abs(cur - v) < 0.01) ? null : v;
    const up = await sb.from('city_ratings')
      .upsert({ user_id: ctx.me().id, city_id: wrap.dataset.rvcity, stars: next },
              { onConflict: 'user_id,city_id' }).select('stars').maybeSingle();
    if (up.error) return fail(up.error, 'rv');
    wrap.innerHTML = starHtml(next);
    return;
  }
  if (wrap.id === 'rv_stars'){
    /* 0(끌어서 맨 왼쪽)도 지우기입니다 — b494. */
    const next = (v === 0 || Number(myReview.stars) === v) ? null : v;
    await saveReview({ stars: next });
  }
});

/* 후기 글은 칸을 벗어날 때 저장합니다. 글자마다 보내면 요청이 쏟아집니다. */
$('rv_note').addEventListener('change', () =>
  saveReview({ comment: $('rv_note').value.trim() || null }));
/* 쓴 만큼 칸이 자랍니다. 두 줄에 고정해두면 긴 글을 좁은 구멍으로 씁니다. */
function growNote(){
  const t = $('rv_note');
  t.style.height = 'auto';
  t.style.height = Math.min(t.scrollHeight, 320) + 'px';
}
$('rv_note').addEventListener('input', growNote);

/* ── 후기 사진 ───────────────────────────────────────────────────────
 * 통은 **비공개**입니다. 주소를 알아도 그냥은 안 열립니다(db/052).
 * 그래서 볼 때마다 잠깐 열리는 주소를 받아 씁니다(createSignedUrl).
 *
 * 폰 사진은 5MB 가 넘기도 합니다. 그대로 올리면 통도 낭비하고 여행지에서
 * 데이터도 씁니다. 긴 변 1280 으로 줄여 올립니다 — 화면에서 보는 크기의
 * 두 배쯤이라 확대해도 뭉개지지 않습니다. */
const RV_MAX = 30;           /* 여행 하나에 이만큼. 통이 무한하지 않습니다 */
let rvPhotos = [];

function fitImage(file, max = 1280, q = 0.82){
  return new Promise((ok, no) => {
    const img = new Image();
    img.onload = () => {
      /* 가로세로 비를 지킵니다. 정사각으로 자르는 avatar 쪽(shrink)과 다릅니다 —
         여행 사진은 잘라내면 정작 찍은 것이 잘려 나갑니다. */
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width  = Math.round(img.width  * s);
      cv.height = Math.round(img.height * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      cv.toBlob(b => b ? ok(b) : no(new Error('사진을 못 읽었어요')), 'image/jpeg', q);
    };
    img.onerror = () => no(new Error('사진을 못 읽었어요'));
    img.src = URL.createObjectURL(file);
  });
}

async function loadPhotos(){
  const { data, error } = await sb.from('trip_photos')
    .select('id,path,user_id,created_at').eq('trip_id', trip.id).order('created_at');
  if (error){ $('rv_shots').innerHTML = ''; return fail(error, 'rv'); }
  rvPhotos = data || [];
  await drawPhotos();
}

async function drawPhotos(){
  const box = $('rv_shots');
  if (!rvPhotos.length){ box.innerHTML = ''; $('rv_shotnote').textContent = ''; return; }
  /* 주소를 하나씩 받으면 사진 수만큼 왕복합니다. 한 번에 받습니다. */
  const { data: urls } = await sb.storage.from('trip-photos')
    .createSignedUrls(rvPhotos.map(p => p.path), 3600);
  const by = Object.fromEntries((urls || []).map(u => [u.path, u.signedUrl]));
  box.innerHTML = rvPhotos.map(p =>
    `<div class="rvshot">
       <img src="${esc(by[p.path] || '')}" alt="" loading="lazy">
       ${p.user_id === ctx.me().id
         ? `<button class="x" data-rvdel="${esc(p.id)}" aria-label="지우기">×</button>` : ''}
     </div>`).join('');
  $('rv_shotnote').textContent = `${rvPhotos.length}장`;
}

/* ⚠ 사진을 누르면 크게 봅니다(b581) — 일기장과 **같은 뷰어**입니다.
   이 파일의 CSS 주석(app.css `.rvshots`)에 「원본 비는 눌러서 크게 볼 때
   지킵니다」라고 **적어만 두고 안 만들어** 뒀던 것입니다.
   ⚠ 지우기(×)를 누른 것은 넘깁니다 — 지우려다 크게 열리면 안 됩니다.
   ⚠ 한 번만 붙입니다. `drawPhotos` 는 여러 번 도는데, 그때마다 붙이면
     한 번 눌러도 여러 번 열립니다. */
$('rv_shots')?.addEventListener('click', e => {
  if (e.target.closest('button')) return;
  const img = e.target.closest('.rvshot img'); if (!img) return;
  const 다 = [...$('rv_shots').querySelectorAll('.rvshot img')];
  openPhotos(다.map(i => i.src), 다.indexOf(img));
});

$('rv_file').addEventListener('change', async e => {
  const files = [...(e.target.files || [])];
  e.target.value = '';                    /* 같은 사진을 다시 골라도 걸리게 */
  if (!files.length) return;
  const room = RV_MAX - rvPhotos.length;
  if (room <= 0) return fail(`사진은 여행 하나에 ${RV_MAX}장까지예요.`, 'rv');
  const take = files.slice(0, room);
  if (files.length > room)
    toast(`${RV_MAX}장까지라서 ${take.length}장만 넣었어요.`);

  const lab = $('rv_add').querySelector('span');
  const orig = lab.textContent;
  let done = 0;
  for (const f of take){
    lab.textContent = `올리는 중… ${++done}/${take.length}`;
    try {
      const blob = await fitImage(f);
      /* 경로 맨 앞이 여행 id 여야 통 정책이 참여자인지 가릅니다(db/052). */
      const name = (crypto.randomUUID ? crypto.randomUUID()
                                      : String(Date.now()) + Math.random()).slice(0, 36);
      const path = `${trip.id}/${ctx.me().id}/${name}.jpg`;
      const up = await sb.storage.from('trip-photos')
        .upload(path, blob, { contentType:'image/jpeg' });
      if (up.error) throw up.error;
      const r = await sb.from('trip_photos')
        .insert({ trip_id: trip.id, user_id: ctx.me().id, path });
      if (r.error){
        /* 표에 못 넣었으면 통에 남은 파일도 치웁니다 — 안 그러면 아무도
           모르는 사진이 통에만 쌓입니다. */
        await sb.storage.from('trip-photos').remove([path]);
        throw r.error;
      }
    } catch (err){
      lab.textContent = orig;
      return fail(err, 'rv');
    }
  }
  lab.textContent = orig;
  await loadPhotos();
});

