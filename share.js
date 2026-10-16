/* ── 일정 공유 판 (b880) ──────────────────────────────────────────────
 * 사용자: 「2단계&3단계로 가자」 — 그림 한 장(b879)에 **보기 전용 링크**와
 * 「나도 이대로 가기」를 더합니다. 보내는 길이 셋이 되었으므로 고르는 판이
 * 하나 필요합니다(사용자가 시안 셋 중 「작은 판에서 고르기」를 고름).
 *
 *   🖼 그림으로 보내기 — 카톡·인스타에 바로 (b879 의 카드)
 *   🔗 링크로 보내기   — 앱 없이 열리고 지도도 (여기서 새로)
 *   📋 글로 복사       — 주소 붙여넣기용 (b879 의 글)
 *
 * ⚠⚠ **이 파일은 planview.js 를 안 부릅니다.** 그림과 글을 만드는 것은
 *   planview.js 의 일이고, 이 판은 **받아서 부르기만** 합니다
 *   (`openShareSheet({ 그림, 글 })`). 서로 부르면 고리가 생깁니다 —
 *   planview → share 한 방향입니다.
 * ⚠ 링크는 여기서 만듭니다. 그것은 「이 여행」의 일이지 그리기의 일이 아니라
 *   trip.js 만 있으면 됩니다.
 *
 * 층: dom.js · net.js · db.js · trip.js · card.js(그림은 부르는 쪽이 넘겨줌) */
import { $, esc, toast, copyText } from './dom.js?v=b888';
import { fail, netTimeout } from './net.js?v=b888';
import { sb } from './db.js?v=b888';
import { trip } from './trip.js?v=b888';
import { appUrl } from './card.js?v=b888';

/* 지금 열린 판이 들고 있는 것. 닫으면 비웁니다. */
let 짐 = null;

/* 링크 주소. ⚠ **`?plan=` 입니다.** 이미 쓰이는 칸이 많아 겹치면 안 됩니다 —
   `t`(알림에서 여행 열기) · `d`(그 날) · `p`(사람 링크) · `join`(초대) ·
   `mate`(궁합) · `v`·`m`·`s`(판 꼬리표, sw.js). */
export const planLink = token => `${appUrl()}?plan=${encodeURIComponent(token)}`;

const 아이콘 = {
  그림: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="10" r="1.8"/><path d="m4 17 4.5-4.5 3.5 3.5 3-2.5L20 17"/>',
  링크: '<path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5"/><path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5"/>',
  글: '<rect x="8" y="3.5" width="12" height="15" rx="2"/><path d="M16 18.5v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h1"/>',
};
const svg = k => `<svg viewBox="0 0 24 24" width="21" height="21" fill="none"
  stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
  stroke-linejoin="round" aria-hidden="true">${아이콘[k]}</svg>`;

const 줄 = (키, 이름, 풀이, 아이) => `<button type="button" class="shrow" data-shdo="${키}">
  <span class="shic">${svg(아이)}</span>
  <span class="shtx"><b>${esc(이름)}</b><i>${esc(풀이)}</i></span>
  <span class="shgo" aria-hidden="true">›</span></button>`;

export function isShareSheetOpen(){ return !!짐; }

export function closeShareSheet(fromPop){
  /* ⚠ 앱의 다른 판과 **같은 수법**입니다(card.js 의 시트닫기 주석 참고):
     손으로 닫을 때는 뒤로만 가고, 실제로 닫는 일은 그 `popstate` 에서만
     일어납니다. 먼저 닫아 버리면 뒤로가기 사슬이 그냥 지나쳐 여행까지 닫습니다. */
  if (!fromPop && history.state?.t2 === 'sh'){ history.back(); return; }
  짐 = null;
  $('sharesheet')?.classList.add('hide');
}

/* `그림`·`글` 은 **부르는 쪽이 넘겨주는 함수**입니다(planview.js). */
export function openShareSheet(o){
  const 판 = $('sharesheet');
  if (!판) return o?.그림?.();          /* 판이 없는 화면에서는 하던 일(그림)만 */
  짐 = o || {};
  그리기();
  판.classList.remove('hide');
  if (history.state?.t2 !== 'sh') history.pushState({ t2:'sh' }, '');
}

function 그리기(){
  const 켜짐 = !!trip?.share_token;
  $('sh_rows').innerHTML =
    줄('img', '그림으로 보내기', '카톡·인스타에 바로', '그림') +
    줄('link', '링크로 보내기', 켜짐 ? '앱 없이 열려요 · 켜져 있어요' : '앱 없이 열리고 지도도 보여요', '링크') +
    줄('text', '글로 복사', '주소 붙여넣기용', '글');
  /* 공유를 켠 적이 있으면 끄는 길도 같이 보입니다 — 켜 두고 잊어버리면
     그 링크는 영영 열립니다. 켠 사람만 볼 수 있으면 됩니다. */
  $('sh_off').classList.toggle('hide', !켜짐);
}

/* ── 링크 만들기 ──────────────────────────────────────────────────────
 * 토큰이 없으면 그 자리에서 발급합니다(`rotate_share_token`). **누를 때까지는
 * 아무것도 공개되지 않습니다** — 토큰이 null 인 동안 `get_shared_trip` 은
 * 아무것도 못 찾습니다(db/001).
 * ⚠ 이미 있으면 **다시 발급하지 않습니다.** 재발급은 옛 링크를 즉시 죽이므로,
 *   「한 번 더 보내기」가 지난번에 보낸 링크를 깨뜨리면 안 됩니다. */
async function 링크받기(){
  if (trip?.share_token) return trip.share_token;
  const r = await netTimeout(sb.rpc('rotate_share_token', { p_trip: trip.id }));
  if (r.error){ fail(r.error, '공유 링크를 못 만들었어요'); return null; }
  trip.share_token = r.data;            /* 다음에 또 안 부르게 — 같은 그릇입니다 */
  return r.data;
}

async function 링크보내기(){
  const token = await 링크받기();
  if (!token) return;
  const url = planLink(token);
  /* ⚠ **여기서는 `url` 을 넘깁니다.** 글로 보낼 때(일정글)와 반대입니다 —
     그때는 카톡이 주소가 있으면 우리 글을 버려서 뺐지만, 지금은 보내려는
     것이 **주소 그 자체**입니다. 미리보기 카드가 뜨는 편이 낫습니다. */
  const 글 = `${trip.title} 일정이에요`;
  if (navigator.share){
    try { await navigator.share({ title: trip.title, text: 글, url }); closeShareSheet(); return; }
    catch (e){ if (e?.name === 'AbortError') return; }
  }
  closeShareSheet();
  toast(await copyText(url) ? '링크를 복사했어요. 붙여넣어 보내세요.' : '복사하지 못했어요.');
}

async function 공유끄기(){
  /* 되돌릴 수 없는 일입니다 — 이미 보낸 링크가 전부 죽습니다. 그래서 묻습니다. */
  if (!confirm('지금까지 보낸 링크가 모두 열리지 않게 됩니다. 끌까요?')) return;
  const r = await netTimeout(sb.rpc('disable_share', { p_trip: trip.id }));
  if (r.error) return fail(r.error, '공유를 못 껐어요');
  trip.share_token = null;
  closeShareSheet();
  toast('공유를 껐어요. 보낸 링크는 이제 안 열려요.');
}

if (typeof document !== 'undefined' && $('sharesheet')){
  $('sh_x').addEventListener('click', () => closeShareSheet());
  $('sharesheet').addEventListener('click', e => {
    if (e.target === $('sharesheet')) closeShareSheet();
  });
  $('sh_off').addEventListener('click', 공유끄기);
  $('sh_rows').addEventListener('click', e => {
    const b = e.target.closest('[data-shdo]'); if (!b) return;
    const 무엇 = b.dataset.shdo, 그 = 짐;
    if (무엇 === 'img'){ closeShareSheet(); return 그?.그림?.(); }
    if (무엇 === 'text'){
      const t = 그?.글?.(); closeShareSheet();
      if (t) copyText(t).then(ok => toast(ok ? '일정을 복사했어요. 붙여넣어 보내세요.' : '복사하지 못했어요.'));
      return;
    }
    if (무엇 === 'link') return 링크보내기();
  });
}
