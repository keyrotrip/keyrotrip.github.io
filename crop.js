/* ── 프로필 사진 자르기(b852) ─────────────────────────────────────────
 * 사용자: 「프로필 사진 수정할 때 내가 원하는 부분만 고르는 기능도 있어야겠어」(10-12).
 * 전에는 고른 사진의 «가운데»를 정사각으로 잘랐습니다(profile.js 의 shrink) — 얼굴이
 * 가장자리에 있으면 잘려 나갔습니다.
 * 이제 사진을 고르면 이 판이 뜨고, 한 손가락으로 옮기고 두 손가락으로 키워서 동그라미 안에
 * 보일 부분을 맞춥니다. 「선택」을 누르면 동그라미를 감싼 정사각을 잘라 넘깁니다.
 * **처음 모습은 예전과 같습니다**(가운데, 꽉 차게) — 그냥 「선택」만 누르면 전과 같은 사진입니다.
 *
 * ⚠ 뒤로가기로 닫힙니다(= 취소). tripview.js 의 popstate 사슬 **맨 위**입니다 — 프로필 변경
 *   판(#editpane) 위에 뜨므로, 사슬이 이것을 먼저 안 물으면 뒤로가기 한 번에 프로필 변경 판이
 *   닫히고 이 판만 덩그러니 남습니다. 단추로 닫을 때는 뒤로가기를 대신 누릅니다(photoview.js 와 같은 규칙).
 * ⚠ 큰 사진(폰 사진은 긴 변 4천~8천 px)을 그대로 띄워 두지 않습니다. 긴 변 1600px 로 한 번 줄인
 *   그림(canvas)을 띄우고 거기서 자릅니다 — 결과가 256px 라 여섯 배 넘게 남습니다.
 * ⚠ 손가락은 Pointer Events 로 받습니다. 판에 touch-action:none — 안 그러면 브라우저가
 *   두 손가락을 «화면 확대»로 가져갑니다.
 *
 * 층: 아무 모듈도 안 씁니다(DOM 만). */

let 판 = null;
/* 지금 열린 것 — { 그림, 끝, 결과, w, h, s, x, y, 최소, 최대, 테 } · 테 = 동그라미를 감싼 정사각(판 좌표) */
let 열린 = null;
const 손 = new Map();                     /* 누르고 있는 손가락들(pointerId → {x, y}) */

const 크게 = 1600;                         /* 띄울 그림의 긴 변 */
const 짧은최소 = 512;                      /* …그래도 짧은 변은 이만큼은 남깁니다(아주 긴 화면 갈무리 — 아래 읽기) */
const 화소한도 = 8e6;                      /* 그림판 하나의 화소 상한 — 아이폰은 큰 그림판을 못 만들고 null 을 줍니다 */

function 만들기(){
  if (판) return 판;
  판 = document.createElement('div');
  판.id = 'cropview';
  판.className = 'hide';
  판.setAttribute('role', 'dialog');
  판.setAttribute('aria-label', '사진 자르기');
  판.innerHTML =
    '<div class="crtop">' +
      '<button type="button" class="crno">취소</button>' +
      '<b>사진 자르기</b>' +
      '<button type="button" class="crok">선택</button>' +
    '</div>' +
    '<div class="crstage"><div class="crring" aria-hidden="true"></div></div>' +
    '<div class="crfoot">' +
      '<p class="crhint"><span class="crt">끌어서 옮기고, 두 손가락으로 키워요</span>' +
        '<span class="crm">끌어서 옮기고, 휠이나 막대로 키워요</span></p>' +
      '<input type="range" class="crzoom" min="0" max="1000" value="0" aria-label="사진 크기">' +
    '</div>';
  document.body.appendChild(판);

  /* 아이폰 사파리는 touch-action:none 이어도 두 손가락을 «화면 확대 몸짓»(gesturestart)으로 먼저 가져갈 때가
     있습니다 — 그러면 사진 대신 화면이 커집니다. 이 판 안에서는 그 몸짓을 막습니다(다른 브라우저엔 없는 사건이라 무해). */
  판.addEventListener('gesturestart', e => e.preventDefault());
  판.querySelector('.crno').addEventListener('click', () => 끝내기(null));
  판.querySelector('.crok').addEventListener('click', 고르기);
  const 무대 = 판.querySelector('.crstage');
  무대.addEventListener('pointerdown', 누름);
  무대.addEventListener('pointermove', 움직임);
  무대.addEventListener('pointerup', 뗌);
  무대.addEventListener('pointercancel', 뗌);
  무대.addEventListener('lostpointercapture', 뗌);   /* 붙잡기를 놓쳤으면 그 손가락은 뗀 것으로 */
  /* 휠 · 트랙패드 오므리기(ctrl+휠)는 커서 자리를 붙잡고 키웁니다.
     파이어폭스 마우스 휠은 «줄» 단위(deltaMode 1, 한 칸 3)라 픽셀로 바꿔 셉니다 — 안 그러면 거의 안 커집니다. */
  무대.addEventListener('wheel', e => {
    if (!열린) return;
    e.preventDefault();
    const r = 무대.getBoundingClientRect();
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    키우기(열린.s * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)),
           e.clientX - r.left, e.clientY - r.top);
  }, { passive:false });
  /* 막대는 동그라미 가운데를 붙잡고 키웁니다. 눈금은 로그 — 작을 때 더 곱게 움직입니다. */
  판.querySelector('.crzoom').addEventListener('input', e => {
    if (!열린) return;
    const t = (+e.target.value) / 1000;
    const 테 = 열린.테;
    키우기(열린.최소 * Math.pow(열린.최대 / 열린.최소, t), 테.x + 테.d / 2, 테.y + 테.d / 2, true);
  });
  addEventListener('resize', () => { if (열린) 자리잡기(false); });
  return 판;
}

/* 사진을 읽어 긴 변 1600px 그림으로 줄입니다.
   ⚠ 아주 긴 사진(화면 갈무리 1170×10000)은 긴 변만 맞추면 짧은 변이 187px 가 되어, 동그라미를 채우려고
     늘리면 흐려집니다 — 짧은 변을 512 까지는 남기고, 대신 전체 화소는 한도 안으로 묶습니다(b852 리뷰).
   ⚠ 아이폰은 메모리가 모자라면 그림판(getContext)이 null 입니다. onload 안에서 던지면 약속이 영영 안 끝나
     자르기 판이 말없이 멈춥니다 — 잡아서 「못 읽었다」로 돌려줍니다(예전 shrink 에도 있던 구멍). */
function 읽기(file){
  return new Promise((ok, no) => {
    const 주소 = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        let k = Math.min(1, 크게 / Math.max(w, h));
        if (Math.min(w, h) * k < 짧은최소) k = Math.min(1, 짧은최소 / Math.min(w, h));
        if (w * h * k * k > 화소한도) k = Math.sqrt(화소한도 / (w * h));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(w * k));
        cv.height = Math.max(1, Math.round(h * k));
        const g = cv.getContext('2d');
        /* ⚠ 우리가 쓴 한국어는 «글자»로 넘깁니다 — net.js 의 fail 은 글자만 그대로 보이고, Error 는
             「잘 안 됐어요…」로 뭉뚱그립니다(재 봄). */
        if (!g) return no('사진이 너무 커서 열지 못했어요. 다른 사진을 골라 주세요.');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, cv.width, cv.height);
        ok(cv);
      } catch (e){ no(e); }
      finally { URL.revokeObjectURL(주소); }
    };
    img.onerror = () => { URL.revokeObjectURL(주소); no('사진을 읽지 못했어요.'); };
    img.src = 주소;
  });
}

/* 동그라미 자리와 크기 한계를 다시 잽니다. 처음이면 가운데·꽉 차게(예전 모습)로 둡니다. */
function 자리잡기(처음){
  const 무대 = 판.querySelector('.crstage');
  const W = 무대.clientWidth, H = 무대.clientHeight;
  const d = Math.max(120, Math.min(W - 40, H - 40, 440));
  const 옛테 = 열린.테;
  열린.테 = { x:(W - d) / 2, y:(H - d) / 2, d };
  const ring = 판.querySelector('.crring');
  ring.style.cssText = `left:${열린.테.x}px; top:${열린.테.y}px; width:${d}px; height:${d}px`;
  const { w, h } = 열린;
  열린.최소 = d / Math.min(w, h);
  /* 끝까지 키워도 사진의 64px 보다는 넓게 자릅니다(그 이하는 256px 로 늘리면 뭉갭니다). */
  열린.최대 = Math.max(열린.최소, Math.min(열린.최소 * 5, d / 64));
  if (처음 || !옛테){
    열린.s = 열린.최소;
    열린.x = 열린.테.x + (d - w * 열린.s) / 2;
    열린.y = 열린.테.y + (d - h * 열린.s) / 2;
  } else {
    /* 창 크기가 바뀌면 보던 부분을 그대로 새 동그라미에 옮깁니다. */
    const k = d / 옛테.d;
    열린.s = 열린.s * k;
    열린.x = 열린.테.x + (열린.x - 옛테.x) * k;
    열린.y = 열린.테.y + (열린.y - 옛테.y) * k;
  }
  그리기();
}

/* 사진이 동그라미(를 감싼 정사각)를 늘 덮게 붙잡습니다. */
function 붙잡기(){
  const o = 열린, 테 = o.테;
  o.s = Math.min(o.최대, Math.max(o.최소, o.s));
  o.x = Math.min(테.x, Math.max(테.x + 테.d - o.w * o.s, o.x));
  o.y = Math.min(테.y, Math.max(테.y + 테.d - o.h * o.s, o.y));
}

function 그리기(막대에서){
  붙잡기();
  const o = 열린;
  o.그림.style.transform = `translate(${o.x}px, ${o.y}px) scale(${o.s})`;
  if (!막대에서){
    const t = o.최대 > o.최소 ? Math.log(o.s / o.최소) / Math.log(o.최대 / o.최소) : 0;
    판.querySelector('.crzoom').value = String(Math.round(t * 1000));
  }
}

/* (점x, 점y) 자리 밑의 사진 점을 붙잡은 채 크기를 s2 로 바꿉니다.
   ⚠ 매개변수를 px·py 라 했더니 CI(check-refs)가 map.js 가 내보내는 px·py 를 import 없이 쓴다고 잡았습니다(b852) —
     매개변수는 못 가리는 검사라 이름을 피합니다. */
function 키우기(s2, 점x, 점y, 막대에서){
  const o = 열린;
  const s = Math.min(o.최대, Math.max(o.최소, s2));
  o.x = 점x - (점x - o.x) * (s / o.s);
  o.y = 점y - (점y - o.y) * (s / o.s);
  o.s = s;
  그리기(막대에서);
}

function 무대점(e){
  const r = 판.querySelector('.crstage').getBoundingClientRect();
  return { x:e.clientX - r.left, y:e.clientY - r.top };
}
function 누름(e){
  if (!열린) return;
  e.preventDefault();
  /* 손가락이 무대 밖으로 나가도 계속 받게 붙잡습니다. 이미 뗀 손가락이면 던지므로 감쌉니다. */
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  손.set(e.pointerId, 무대점(e));
}
function 움직임(e){
  if (!열린 || !손.has(e.pointerId)) return;
  const 전 = [...손.values()].slice(0, 2).map(p => ({ ...p }));
  손.set(e.pointerId, 무대점(e));
  const 후 = [...손.values()].slice(0, 2);
  if (후.length === 1){
    열린.x += 후[0].x - 전[0].x;
    열린.y += 후[0].y - 전[0].y;
    그리기();
    return;
  }
  /* 두 손가락: 가운데 점이 움직인 만큼 옮기고, 벌어진 만큼 키웁니다. */
  const 가운데 = ps => ({ x:(ps[0].x + ps[1].x) / 2, y:(ps[0].y + ps[1].y) / 2 });
  const 거리 = ps => Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) || 1;
  const m0 = 가운데(전), m1 = 가운데(후);
  열린.x += m1.x - m0.x;
  열린.y += m1.y - m0.y;
  키우기(열린.s * 거리(후) / 거리(전), m1.x, m1.y);
}
function 뗌(e){ 손.delete(e.pointerId); }

/* 「선택」 — 동그라미를 감싼 정사각을 size px 로 잘라 JPEG 로 넘깁니다. */
function 고르기(){
  const o = 열린; if (!o || o.고르는중 || o.닫는중) return;
  o.고르는중 = true;
  판.querySelector('.crok').disabled = true;
  const 다시 = () => { o.고르는중 = false; 판.querySelector('.crok').disabled = false; };
  const cv = document.createElement('canvas');
  cv.width = cv.height = o.크기;
  const g = cv.getContext('2d');
  if (!g) return 다시();                 /* 그림판을 못 만들면(메모리) 단추를 되살려 다시 누를 수 있게 */
  g.fillStyle = '#fff';                  /* 투명한 PNG 가 JPEG 에서 검게 나오지 않게 */
  g.fillRect(0, 0, o.크기, o.크기);
  g.imageSmoothingQuality = 'high';
  const 변 = o.테.d / o.s;
  g.drawImage(o.그림, (o.테.x - o.x) / o.s, (o.테.y - o.y) / o.s, 변, 변, 0, 0, o.크기, o.크기);
  /* ⚠ toBlob 은 늦게 올 수 있습니다(화면이 가려져 있으면 수 초). 그사이 이 판이 닫히고 새로
       열렸으면 옛 사진을 새 판의 답으로 넣으면 안 됩니다 — `열린 !== o` 면 버립니다. */
  cv.toBlob(b => {
    if (열린 !== o) return;
    if (!b) return 다시();
    끝내기(b);
  }, 'image/jpeg', 0.85);
}

/* 단추로 끝낼 때. 결과를 적어 두고 뒤로가기를 대신 누릅니다 — 사슬이 closeCrop(true) 로 닫습니다.
   ⚠ **한 번만.** 뒤로가기가 오기 전에 또 불리면(취소 두 번 · Esc 와 손가락 · 취소 직후 선택의 toBlob)
     history.back() 이 두 번 돌아 아래 «프로필 변경» 판까지 닫히고, 결과도 덮어씁니다(b852 리뷰). */
function 끝내기(결과){
  if (!열린 || 열린.닫는중) return;
  열린.닫는중 = true;
  열린.결과 = 결과;
  if (history.state?.t2 === 'crop') history.back();
  else closeCrop(true);
}

export const cropOpen = () => !!열린;

/* 닫기. 뒤로가기(사슬)에서 부르면 바로 닫고, 단추에서 부르면 뒤로가기를 거칩니다. */
export function closeCrop(fromPop){
  if (!열린) return;
  if (!fromPop) return 끝내기(null);
  const o = 열린;
  열린 = null;
  손.clear();
  판.classList.add('hide');
  document.body.classList.remove('cron');
  o.그림.remove();
  o.그림.width = o.그림.height = 0;       /* 아이폰은 그림판 메모리를 늦게 놓습니다 — 크기를 0 으로 바로 돌려줍니다 */
  판.querySelector('.crok').disabled = false;
  o.끝(o.결과 || null);
}

/* 사진 파일을 받아 자르기 판을 엽니다. 「선택」이면 Blob, 취소·뒤로가기면 null 로 끝납니다.
   읽지 못하면 던집니다(부르는 쪽이 알립니다). */
export async function openCrop(file, 크기 = 256){
  const 그림 = await 읽기(file);
  const p = 만들기();
  if (열린) closeCrop(true);
  그림.className = 'crimg';
  p.querySelector('.crstage').prepend(그림);
  p.classList.remove('hide');
  document.body.classList.add('cron');
  if (history.state?.t2 !== 'crop') history.pushState({ t2:'crop' }, '');
  return new Promise(끝 => {
    열린 = { 그림, 끝, 결과:null, 크기, w:그림.width, h:그림.height, s:1, x:0, y:0, 최소:1, 최대:1, 테:null };
    자리잡기(true);
    /* 초점을 「선택」으로 옮깁니다 — 아래에 숨은 「사진 바꾸기」 단추에 초점이 남으면 컴퓨터에서 엔터·스페이스가
       자르기 판 밑에서 파일 고르기를 또 엽니다(b852 리뷰). */
    p.querySelector('.crok').focus({ preventScroll:true });
  });
}

/* Esc 는 데스크톱에서만 쓸모가 있지만, 있으면 시험할 때 편합니다. */
addEventListener('keydown', e => {
  if (e.key === 'Escape' && 열린) 끝내기(null);
});
