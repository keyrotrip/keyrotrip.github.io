/* ── 일기장 ── 한 장씩 넘겨 보는 자리(b538) ────────────────────────────
 * 사용자 결정: 「일기장 넘기는 UI 로」. 목록이 아니라 **한 화면에 한 장**,
 * 옆으로 밀어 넘깁니다. 도시 화면의 일기 칸이 「나중에 일기장에서 모아
 * 봐요」라고 약속한 그 자리입니다.
 *
 * ⚠ **넘기기는 브라우저에게 맡깁니다**(scroll-snap). 홈의 대륙 카드가 쓰는
 *   것과 같은 수법입니다(home.js 의 `.swipe`) — 자바스크립트로 흉내내다
 *   겪은 것들(관성이 남은 채 자리 옮기기, 반쯤 걸친 채 멈추기)이 아예
 *   생길 수가 없습니다.
 * ⚠ **여기는 덮는 판이라 탭 덱과 안 다툽니다.** `coverDeck(true)` 로 덱을
 *   숨기고 열기 때문에, 좌우로 밀어도 탭이 안 넘어갑니다. 홈 미니맵에서
 *   `touch-action` 을 손봐야 했던 것과 다른 점입니다.
 * ⚠⚠ **일기가 길면 장이 «아래로» 자랍니다(b570).** ⚠⚠ b538 에는 장에 키를
 *   못 박고 그 안에서 굴렸습니다. 그랬더니 글이 문장 한가운데서 잘리고
 *   장 안에 스크롤막대가 또 생겼습니다 — **스크롤이 두 겹**이라 손가락이
 *   어디를 굴리는지 알 수가 없습니다(사용자 지적).
 *   이제 장은 제 키대로 자라고, **줄기 키를 「보고 있는 장」에 맞춥니다**
 *   (아래 `키맞추기`). 세로 스크롤은 화면 하나만 합니다.
 *
 * ⚠ **순서는 「쓴 때」입니다(updated_at).** 다녀온 때가 아닙니다 —
 *   `visited_on` 칸은 b536 에 만들었다가 화면을 걷어서 지금 비어 있습니다.
 *   나중에 다녀온 날짜를 다시 받게 되면 그때 이 순서를 바꾸십시오.
 */
import { $, esc, toTop, coverDeck, backLabel, emptyDo } from './dom.js?v=b837';
import { sb } from './db.js?v=b837';
import { cities, countryName, cityCountry, search } from './cities.js?v=b837';
import { starsRo } from './stars.js?v=b837';
import { openPhotos } from './photoview.js?v=b837';

let ctx = { me: () => null, loadCities: async () => {}, openCity: () => {} };
export function setDiaryCtx(o){ ctx = { ...ctx, ...o }; }

/* 나온 자리로 돌려보내기 — 지도·성향과 같은 수법입니다(map.js 의 mapBackTo). */
let 왔던탭 = null;
export function diaryBackTo(tab){
  왔던탭 = tab;
  const L = backLabel(tab);
  const b = $('diaryback');
  if (b && L) b.textContent = L;
}

export async function openDiary(){
  $('profpane')?.classList.add('hide');
  $('diarypane')?.classList.remove('hide');
  coverDeck(true);
  toTop($('diarypane'));
  if (history.state?.t2 !== 'diary') history.pushState({ t2:'diary' }, '');

  $('diarybody').innerHTML =
    '<div class="card"><div class="empty"><span class="load">일기를 펴는 중…</span></div></div>';
  /* ‹ n / N › 는 여기서 먼저 걷습니다(b805 점검) — 안 걷으면 불러오는 동안·못 불러왔을 때 지난번 「2 / 3」과
     화살표가 남는데, 화살표는 이미 떨어져 나간 옛 줄기를 가리켜 눌러도 아무 일이 없습니다. 다 불러오면 아래에서 다시 켭니다. */
  $('dgnav')?.classList.add('hide');
  $('diarycount').textContent = '';

  await ctx.loadCities();
  const me = ctx.me();
  if (!me) return;
  const r = await sb.from('city_ratings')
    .select('city_id,stars,comment,journal,journal_photo,updated_at')
    .eq('user_id', me.id).not('journal', 'is', null)
    .order('updated_at', { ascending: false });

  if (r.error){
    $('diarybody').innerHTML =
      '<div class="card"><div class="empty">일기를 불러오지 못했어요.</div></div>';
    return;
  }

  /* 빈 글자만 남은 줄은 일기가 아닙니다 — 지운 흔적입니다. */
  const 장들 = (r.data || []).filter(x => String(x.journal || '').trim());

  /* 그 도시들의 사진을 한 번에 받습니다(b573, db/073).
     ⚠ **장마다 따로 부르지 않습니다** — 일기가 스물이면 왕복도 스물입니다.
     ⚠ 표가 아직 없으면(073 을 안 돌린 상태) 조용히 빈 채로 둡니다 —
       글은 멀쩡히 보여야 합니다. */
  const 사진들 = {};
  if (장들.length){
    const ph = await sb.from('journal_photos').select('city_id,url,sort,created_at')
      .eq('user_id', me.id).in('city_id', 장들.map(x => x.city_id))
      .order('sort').order('created_at');
    for (const p of (ph.data || [])) (사진들[p.city_id] ||= []).push(p.url);
  }

  if (!장들.length){
    /* ⚠ **빈 화면에는 «하러 가는 단추»를 답니다**(빈 화면 규칙).
       b759 전에는 「도시를 열고 …에 남기면 여기 모여요」라고 «설명»만
       했습니다. 이제 여기서 바로 고를 수 있으므로 그 길을 답니다 —
       `data-go` 가 위 `#dgadd` 를 대신 눌러 줍니다(dom.js). */
    $('diarybody').innerHTML = '<div class="card">' +
      emptyDo('아직 쓴 일기가 없어요.', '일기 쓸 곳 고르기', 'dgadd',
              '방문한 도시를 고르면 그 자리에서 쓸 수 있어요.') + '</div>';
    $('diarycount').textContent = '';
    $('dgnav')?.classList.add('hide');
    return;
  }

  const 이름 = id => (cities || []).find(c => c.id === id);
  $('diarybody').innerHTML = `
    <div class="dgbook">
      <div class="dgrow">${장들.map(x => {
        const c = 이름(x.city_id);
        return `<article class="dgpage" data-dgcity="${esc(x.city_id)}">
          <!-- 스프링 — 그림이 아니라 배경으로 그립니다(app.css 의 .dgcoil).
               장이 스물이면 고리도 스무 벌이라, 요소로 만들면 그만큼 늘어납니다. -->
          <div class="dgcoil" aria-hidden="true"></div>
          <div class="dgsheet">
            <header class="dghead">
              <b>${esc(c?.name || x.city_id)}</b>
              <span class="dgland">${esc(cityCountry(c))}</span>
              ${starsRo(x.stars)}
            </header>
            <div class="dgdate">${적은날칸(x.updated_at)}</div>
            ${(() => {
              /* ── 사진 여러 장은 «격자»입니다(b579) ─────────────────────
               * 사용자 물음: 「4장이면 한 장씩 세로로 쭉 있던데 이게 맞아?」
               * 아닙니다. 일기 앱들은 대개 **한 장은 크게, 여러 장은 격자**로
               * 둡니다. 세로로 쭉 쌓으면 사진 넉 장에 글이 저 아래로 밀려서
               * 「사진첩에 글이 딸린 것」처럼 보입니다 — 일기는 반대라야 합니다.
               * ⚠ **가로 캐러셀은 안 씁니다.** 이 화면은 이미 좌우로 장을
               *   넘깁니다. 그 안에 또 가로 제스처를 넣으면 서로 잡아먹습니다.
               * ⚠ **홀수면 첫 장을 한 줄 통째로** 씁니다. 안 그러면 마지막
               *   한 장이 반쪽으로 남아 실수처럼 보입니다.
               *     1장 → 큰 한 장 · 3장 → 큰 것 + 2 · 5장 → 큰 것 + 4 … */
              const 목록 = 사진들[x.city_id] || (x.journal_photo ? [x.journal_photo] : []);
              if (!목록.length) return '';
              const 꼴 = 목록.length === 1 ? 'one' : (목록.length % 2 ? 'odd' : '');
              return `<div class="dgshots ${꼴}">${목록.map(u =>
                `<div class="dgimg"><img src="${esc(u)}" alt="" loading="lazy"
                   onerror="this.closest('.dgimg').remove()"></div>`).join('')}</div>`;
            })()}
            ${x.comment ? `<p class="dgone">${esc(x.comment)}</p>` : ''}
            <p class="dgtext">${esc(x.journal)}</p>
            <footer class="dgfoot">
              <button class="small" data-dgedit="${esc(x.city_id)}">고치기</button>
            </footer>
          </div>
        </article>`;
      }).join('')}</div>
    </div>`;

  /* ── 몇째 장인가 ── 점이 아니라 숫자입니다.
     장이 스물이 넘으면 점은 세어지지도 않고 줄만 어지럽습니다. */
  const 줄기 = $('diarybody').querySelector('.dgrow');
  /* ⚠⚠ **한 칸은 `clientWidth` 가 아닙니다(b539).** 줄기에 좌우 여백과
     장 사이 틈이 있어서, 실측하면 줄기 480 · 한 장 446 · 한 칸 458 입니다.
     `clientWidth` 로 세면 오차가 장마다 쌓여 **열두째 장쯤에서 한 장씩
     어긋납니다**(458/480 = 0.954). 장과 틈을 직접 재서 씁니다. */
  const 칸폭 = () => {
    const p = 줄기.querySelector('.dgpage');
    if (!p) return 줄기.clientWidth || 1;
    const cs = getComputedStyle(줄기);
    const 틈 = parseFloat(cs.columnGap || cs.gap) || 0;
    return (p.offsetWidth + 틈) || 1;
  };
  const 몇째 = () => Math.min(장들.length,
                    Math.max(1, Math.round(줄기.scrollLeft / 칸폭()) + 1));

  /* ── 줄기 키를 «보고 있는 장»에 맞춥니다(b570) ─────────────────────────
   * 장마다 키가 다릅니다(사진이 있는 것/없는 것, 긴 글/짧은 글). 줄기를
   * 그냥 두면 **제일 긴 장이 나머지를 다 늘려서** 짧은 일기 밑에 빈 판이
   * 남습니다. 보고 있는 장의 키를 그대로 씁니다.
   * ⚠ **`scrollHeight` 가 아니라 `offsetHeight`** 입니다 — 장은 이제
   *   스크롤러가 아니라 그냥 자란 상자입니다.
   * ⚠ **사진이 늦게 옵니다.** `loading="lazy"` 라 그 장에 닿아야 받기
   *   시작하고, 받고 나면 키가 늘어납니다. 그래서 `load` 때 다시 잽니다.
   *   안 그러면 줄기가 사진 없는 키에 멎어 글 아래가 잘립니다.
   * ⚠ 글꼴이 늦게 와도 줄 수가 바뀝니다. 한 번 더 늦게 잽니다. */
  const 키맞추기 = () => {
    const p = 줄기.children[몇째() - 1];
    if (p) 줄기.style.height = p.offsetHeight + 'px';
  };
  /* ── 넘기는 «느낌»(b571) ─────────────────────────────────────────────
   * ⚠⚠ **스크롤은 여전히 브라우저 것입니다.** 손가락을 우리가 받아 자리를
   *   옮기는 방식은 b469 에 만들었다가 b470 에 **되돌렸습니다**(관성이 남은
   *   채 자리를 옮기거나 반쯤 걸친 채 멈춤). 여기서 하는 일은 «이미 굴러간
   *   자리»를 읽어 **기울기만 칠하는 것**입니다 — 제스처를 안 뺏습니다.
   * ⚠ 값만 넘기고 꾸미기는 CSS 가 합니다(`--t` 부호, `--a` 절대값).
   *   `abs()` 는 아직 못 믿을 브라우저가 있어 여기서 미리 냅니다.
   * ⚠ **양옆 두 장만** 손댑니다. 스무 장짜리에서 매 프레임 전부 만지면
   *   넘기는 동안 손가락이 걸립니다. 나머지는 값을 지워 평평하게 둡니다.
   * ⚠ `transform-origin` 은 **넘어가는 쪽 모서리**입니다 — 오른쪽 장은
   *   왼쪽 모서리를 축으로 열리고, 지나간 장은 오른쪽 모서리로 닫힙니다.
   *   축을 하나로 두면 한쪽이 «뒤집히는» 것처럼 보입니다. */
  const 기울이기 = () => {
    const 폭 = 칸폭(), 현재 = 줄기.scrollLeft / 폭;
    const 장 = 줄기.children;
    for (let i = 0; i < 장.length; i++){
      const p = 장[i], d = i - 현재;
      /* 보이지도 않는 장은 손대지 않고, 손댔던 흔적은 지웁니다. */
      if (Math.abs(d) > 1.05){
        if (p.style.transform){ p.style.transform = ''; p.style.willChange = ''; }
        continue;
      }
      const t = Math.max(-1, Math.min(1, d));
      /* ⚠ **미리 「이건 움직일 것」이라고 알려 둡니다.** 이게 없으면 브라우저가
         매 프레임 장을 통째로 다시 그립니다 — 장이 1500px 이 넘습니다. */
      p.style.willChange = 'transform';
      p.style.transformOrigin = (t >= 0 ? 'left' : 'right') + ' center';
      p.style.transform =
        `rotateY(${(-t * 18).toFixed(2)}deg) scale(${(1 - Math.abs(t) * 0.05).toFixed(4)})`;
    }
  };

  /* ⚠⚠ **키는 «장이 바뀔 때만» 고칩니다(b573).** ⚠⚠
   *   처음에는 스크롤이 올 때마다 줄기 키를 다시 넣었습니다. 키를 건드리면
   *   **판이 다시 짜이고**(reflow), 게다가 그 값에 0.22초 이음(transition)이
   *   걸려 있어서 넘기는 내내 이음이 새로 시작됩니다 — 그래서 **팍팍
   *   튀었습니다**(사용자 지적: 「좌우 스크롤도 부드러워야 하는데 팍팍 튄다」).
   *   기울기(transform)는 판을 다시 안 짜므로 매 프레임 발라도 됩니다.
   * ⚠ **한 프레임에 한 번만** 합니다(rAF). 스크롤은 프레임보다 자주 옵니다.
   * ⚠ `몇째()` 는 반올림이라 넘기는 도중 **한가운데를 지날 때 한 번** 바뀝니다.
   *   그 한 번이 키를 바꾸기 딱 좋은 때입니다. */
  /* ⚠⚠ **넘기는 «동안»에는 판을 다시 짜는 일을 하나도 안 합니다(b574).** ⚠⚠
   *   b573 에서 「장이 바뀔 때만」으로 줄였는데도 여전히 튀었습니다
   *   (사용자: 「반짝거리면서 튀는 현상 그대로… 다시 좌측으로 스와이프하면
   *   제대로 안 넘어가 중간에 걸쳐지네」).
   *   높이를 바꾸는 **그 한 번**이 원인입니다 — 스크롤 칸의 높이가 바뀌면
   *   브라우저가 **스냅 자리를 다시 계산**해서, 손을 뗀 뒤의 관성이 어긋나
   *   한가운데 걸쳐 멈춥니다. 장 높이가 914 대 1542 로 크게 달라 더 심했습니다.
   * · 이제 **멎은 뒤에**(스크롤이 160ms 동안 안 오면) 한 번만 잽니다.
   * · 넘기는 동안 하는 일은 **기울기(transform)뿐**입니다.
   * ⚠ 숫자(1/2)는 바로 바꿉니다 — 폭이 안 변하는 글자라 판이 안 흔들립니다. */
  let 마지막장 = 0, 대기 = 0, 멎음 = 0;
  const 세기 = () => {
    clearTimeout(멎음);
    멎음 = setTimeout(키맞추기, 160);      /* 멎은 뒤에만 판을 건드립니다 */
    if (대기) return;
    대기 = requestAnimationFrame(() => {
      대기 = 0;
      기울이기();
      const i = 몇째();
      if (i === 마지막장) return;
      마지막장 = i;
      $('diarycount').textContent = `${i} / ${장들.length}`;
      끝단추(i);
    });
  };
  /* ‹ › (b805) — 처음·끝 장에서는 그쪽 단추를 끕니다. 한 장뿐이면 둘 다 숨깁니다(index.html 주석).
     ⚠ 옮기는 것은 `scrollTo` 한 번뿐입니다 — 손으로 넘긴 것과 똑같이 스크롤이 일어나므로 숫자·기울기·
       키 맞추기는 위 `세기` 가 그대로 합니다. 따로 고쳐 칠하지 않습니다(두 벌이 되면 갈라집니다). */
  const 끝단추 = i => {
    if ($('dgprev')) $('dgprev').disabled = i <= 1;
    if ($('dgnext')) $('dgnext').disabled = i >= 장들.length;
  };
  $('dgnav')?.classList.toggle('hide', 장들.length < 2);
  const 넘기기 = d => 줄기.scrollTo({
    left: Math.max(0, Math.min(장들.length - 1, 몇째() - 1 + d)) * 칸폭(), behavior: 'smooth' });
  if ($('dgprev')) $('dgprev').onclick = () => 넘기기(-1);
  if ($('dgnext')) $('dgnext').onclick = () => 넘기기(1);
  마지막장 = 몇째();
  $('diarycount').textContent = `${마지막장} / ${장들.length}`;
  끝단추(마지막장);
  키맞추기();
  기울이기();
  줄기.addEventListener('scroll', 세기, { passive:true });

  /* ⚠ 사진을 누르면 크게 봅니다(b581).
     ⚠ **위임으로 받습니다** — 장마다 붙이면 다시 그릴 때마다 쌓입니다.
     ⚠ 그 «장»의 사진들만 넘겨줍니다. 일기장 전체를 넘기면 도쿄를 보다
       옆으로 밀었는데 로바니에미 사진이 나옵니다. */
  줄기.addEventListener('click', e => {
    const img = e.target.closest('.dgimg img'); if (!img) return;
    const 장 = img.closest('.dgshots');
    const 다 = [...(장 || 줄기).querySelectorAll('.dgimg img')];
    openPhotos(다.map(i => i.src), 다.indexOf(img));
  });
  /* ⚠ 사진이 늦게 오면 그 장이 길어집니다. `load` 때 다시 재야
     줄기가 사진 없는 키에 멎어 글 아래를 자르지 않습니다. */
  줄기.querySelectorAll('img').forEach(img => {
    if (img.complete) return;
    img.addEventListener('load', 키맞추기, { once:true });
    img.addEventListener('error', 키맞추기, { once:true });
  });
  addEventListener('resize', 키맞추기, { passive:true });
  setTimeout(키맞추기, 400);
}

/* 다이어리 맨 위의 날짜 칸 — 「2026 · 8 · 31」(b571).
   ⚠ 전에는 장 «맨 아래»에 「…일에 씀」으로 있었습니다. 종이 일기장은
     날짜가 첫 줄입니다 — 그게 그 장을 여는 말이라서요.
   ⚠ 날짜가 없으면 **칸 자체를 안 냅니다.** 빈 칸을 두면 밑줄만 뜬
     자리가 남습니다. */
function 적은날칸(t){
  const d = t ? new Date(t) : null;
  if (!d || isNaN(d)) return '';
  return `<b>${d.getFullYear()}</b><i>·</i><b>${d.getMonth() + 1}</b>` +
         `<i>·</i><b>${d.getDate()}</b>`;
}

export function closeDiary(fromPop){
  if (!fromPop && history.state?.t2 === 'diary'){ history.back(); return; }
  const 열려있었나 = !$('diarypane').classList.contains('hide');
  $('diarypane').classList.add('hide');
  if (!열려있었나) return;
  coverDeck(false);
  /* 분석·홈에서 왔으면 그리로. 한 번 쓰고 비웁니다 — 남기면 프로필에서
     연 사람도 튕깁니다(map.js 의 「나온 자리로」와 같은 규칙). */
  /* ⚠ 고르개는 접고 목록은 버립니다(b759) — 다음에 열 때 그 사이에 매긴
     별점이 반영돼야 합니다. 열어 둔 채로 나가면 다시 들어왔을 때 옛
     목록이 펼쳐진 채 보입니다. */
  $('dgpick')?.classList.add('hide');
  $('dgadd')?.classList.remove('on');
  고를거리 = null;

  const t = 왔던탭; 왔던탭 = null;
  if (t && ctx.showApp) return ctx.showApp(t);
  $('profpane').classList.remove('hide');
}

$('diaryback')?.addEventListener('click', () => closeDiary());
/* 「고치기」는 그 도시로 보냅니다 — 일기는 도시 화면에서 씁니다.
   여기서 또 쓰게 만들면 같은 것을 두 곳에서 고치게 됩니다. */
$('diarypane')?.addEventListener('click', e => {
  const b = e.target.closest('[data-dgedit]');
  if (!b) return;
  closeDiary();
  ctx.openCity(b.dataset.dgedit);
});

/* ══ 「＋ 새 일기」 ── 도시를 고르는 칸(b759) ════════════════════════════
 * 사용자 요청: 「일기 탭에서 직접 일기를 추가하는 기능도 있어야할 것 같아」.
 *
 * ⚠⚠ **여기서 «글»을 받지 않습니다.** 왜인지는 index.html 의 `#dgpick`
 *   주석에 적어 뒀습니다 — 한 줄로 줄이면: 쓰는 칸이 도시 화면에 이미
 *   있고, 사진·한줄평·쓰던 글 붙잡기가 다 거기 붙어 있습니다.
 * ⚠ 안 치고 있을 때 보여주는 것은 **다녀왔는데 아직 일기가 없는 곳**입니다.
 *   쓸 사람은 대개 그중에서 고릅니다. 찾기 칸은 **모든 도시**를 봅니다 —
 *   아직 안 다녀온 곳에도 쓰고 싶을 수 있습니다.
 * ⚠ 목록은 **한 번만 받아 들고 있다가 일기장을 닫을 때 버립니다.** 그 사이에
 *   별점을 매기고 돌아오면 새로 받는 것이 맞습니다.
 */
let 고를거리 = null;

async function 고를거리받기(){
  if (고를거리) return 고를거리;
  const me = ctx.me();
  if (!me) return (고를거리 = []);
  const r = await sb.from('city_ratings')
    .select('city_id,journal,updated_at')
    .eq('user_id', me.id).order('updated_at', { ascending: false });
  고를거리 = (r.data || [])
    .filter(x => !String(x.journal || '').trim())
    .map(x => (cities || []).find(c => c.id === x.city_id))
    .filter(Boolean);
  return 고를거리;
}

const 빈말 = '방문한 도시가 아직 없어요. 위에서 찾아보세요.';

function 줄그리기(것들, 비었을때){
  const 통 = $('dghits');
  if (!통) return;
  if (!것들.length){
    통.innerHTML = `<div class="memo dgnone">${esc(비었을때)}</div>`;
    return;
  }
  /* ⚠ **마흔에서 끊습니다** — 찾기(search)도 같은 수에서 끊습니다(cities.js).
     이 칸은 일기장 «위에» 얹혀 있어서 길어지면 일기가 저 아래로 밀립니다. */
  통.innerHTML = 것들.slice(0, 40).map(c =>
    `<button type="button" class="dghit" data-dgpick="${esc(c.id)}">
       <b>${esc(c.name)}</b><span>${esc(cityCountry(c))}</span>
     </button>`).join('');
}

async function 고르개(켜기){
  const 칸 = $('dgpick'), 단추 = $('dgadd');
  if (!칸) return;
  const 켬 = (켜기 === undefined) ? 칸.classList.contains('hide') : !!켜기;
  칸.classList.toggle('hide', !켬);
  단추?.classList.toggle('on', 켬);
  if (!켬) return;
  const q = $('dgq');
  if (q) q.value = '';
  줄그리기([], '불러오는 중…');
  줄그리기(await 고를거리받기(), 빈말);
  q?.focus();
}

$('dgadd')?.addEventListener('click', () => 고르개());

$('dgq')?.addEventListener('input', e => {
  const q = String(e.target.value || '').trim();
  if (!q) return 줄그리기(고를거리 || [], 빈말);
  줄그리기(search(q), '그런 도시가 없어요.');
});

$('dghits')?.addEventListener('click', async e => {
  const b = e.target.closest('[data-dgpick]');
  if (!b) return;
  const id = b.dataset.dgpick;
  고르개(false);
  closeDiary();
  await ctx.openCity(id);
  /* ⚠⚠ **일기 칸에 바로 손이 가게 합니다.** 안 그러면 도시 화면 «맨 위»에
     떨어져서 「일기 쓰러 왔는데 또 찾아야」가 됩니다 — 이 기능이 없애려던
     번거로움이 그대로 남습니다.
   ⚠ 한 박자 미룹니다. `openCity` 가 그리기를 끝낸 «뒤»라야 칸이 있습니다.
   ⚠ `preventScroll` 로 초점만 줍니다 — 자리 옮기기는 바로 위
     `scrollIntoView` 가 부드럽게 하고, 둘이 같이 움직이면 튑니다. */
  setTimeout(() => {
    const 칸 = $('cv_journal');
    if (!칸) return;
    칸.scrollIntoView({ block:'center', behavior:'smooth' });
    칸.focus({ preventScroll:true });
  }, 60);
});
