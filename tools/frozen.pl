use strict; use warnings; use utf8;
binmode(STDOUT, ':encoding(UTF-8)');
# ── 「한 번 정하면 바꾸면 안 되는 값」 검사 (2026-10-01) ─────────────────────────────
# 사용자: 「앞으로 이런일 다시는 안생기게해 유저들이 많아지면 어떻게할거야」.
# 아래 값이 바뀌면 **모든 사용자**가 아이콘을 다시 담거나, 다시 로그인하거나, 이미 보낸 링크가 끊깁니다.
# 그날(b815→b821) 실제로 겪은 것:
#   · 앱 주소를 honeychelsea123.github.io/Travel-app → keyrotrip.github.io 로 → 다들 아이콘 다시 담기 + 다시 로그인
#   · 홈 화면 상태바 방식은 «아이콘을 담는 순간» 굳는 값 — b763 의 black-translucent 가 새로 담은 아이콘에서만
#     바닥 59 를 못 그려 탭바가 뜸(b820 눈금자 실측) → b821 에 default 로 되돌리고 사용자가 아이콘을 다시 담음
#   · 초대 링크 주소(Deno 조직·앱 이름)를 바꾸자 예전 초대 링크가 그 자리에서 끊김(404)
# 꼭 바꿔야 한다면, 이 파일의 값을 고치기 **전에**:
#   (1) 새로 담은 아이콘에서 눈금자로 재고(admin.js 의 startRuler)  (2) 앱 공지로 미리 알리고
#   (3) 예전 길을 한동안 살려 두고(넘겨 주는 페이지 · 「예전 방식으로 로그인」)
#   (4) 이 파일의 값과 까닭을 같이 고친 뒤 배포합니다.
# bump.sh 가 판을 올리기 전에 부릅니다 — 하나라도 다르면 판을 안 올립니다. CI(check.yml)도 부릅니다.
#
# 쓰기: perl tools/frozen.pl   (저장소 뿌리에서)

my @rules = (
  # [파일, 있어야 하는 글자, 왜]
  ['index.html', '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
   '아이콘을 담는 순간 굳는 값. black-translucent 는 새로 담은 아이폰(iOS 18.7)에서 바닥 59 를 못 그림(b820 실측). 바꾸면 모두 아이콘을 다시 담아야 함'],
  ['index.html', '<meta name="apple-mobile-web-app-capable" content="yes">',
   '빼면 홈 화면 아이콘이 앱이 아니라 사파리로 열림'],
  ['index.html', '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
   'viewport-fit=cover 를 빼면 안전영역 계산(--sat·--sab·시작 화면)이 통째로 바뀜'],
  ['index.html', 'content="https://keyrotrip.github.io/icons/keyro-512.png"',
   '앱 주소(origin)가 바뀌었다는 뜻 — 주소가 바뀌면 모두 아이콘 다시 담기 + 다시 로그인(2026-10-01 에 한 번 겪음)'],
  ['manifest.json', '"id": "/"',
   'manifest id 를 바꾸면 이미 깔린 앱이 «다른 앱»이 됨(홈 화면 아이콘이 둘)'],
  ['manifest.json', '"start_url": "."',  '시작 주소가 바뀌면 깔린 앱이 엉뚱한 곳에서 열림'],
  ['manifest.json', '"scope": "."',      '범위가 바뀌면 앱 안 주소가 사파리로 튀어나감'],
  ['manifest.json', '"display": "standalone"', '바꾸면 홈 화면 앱 모양이 통째로 바뀜'],
  ['db.js', q{storageKey:'t2-auth'},
   '로그인 저장 이름 — 바꾸면 모든 사용자가 로그아웃됨'],
  ['db.js', q{const SUPABASE_URL = 'https://qahqqhjleqfrsjiixnas.supabase.co';},
   'Supabase 프로젝트 — 바꾸면 모두 로그아웃되고 자료가 빈 곳을 가리킴. 구글 콘솔의 supabase 콜백 주소도 이것'],
  ['notify.js', q{const VAPID_PUB = 'BKHqArbSZ6R78C-rwKrRs42lvSgYadpp5LLGfJUh2Xg4jzbcJiUv_5NanYsyYoRaeJtGuD9w7cs51vP1xveNBqM';},
   '알림 열쇠(공개 쪽) — 바꾸면 이미 알림을 켠 사람 모두의 알림이 오류 없이 조용히 끊김. GitHub secret 의 비밀 쪽과 짝'],
  ['member.js', q{const JOIN_URL = 'https://join.keyro.deno.net/';},
   '초대 링크 주소 — 바꾸면 이미 보낸 초대 링크가 끊김. Deno 쪽 조직 slug(keyro)·앱 이름(join)과 같이 움직임'],
  ['glogin.js', q{export const GOOGLE_CLIENT_ID = '96116457629-vlk2pfe1vr359plthoth9dlcp6ljd1tv.apps.googleusercontent.com';},
   '구글 OAuth 클라이언트 — 바꾸면 구글 콘솔·Supabase 의 허용 목록과 어긋나 아무도 로그인 못 함'],
  ['glogin.js', q{new URL('login.html', location.href)},
   '구글이 돌려보내는 주소 — 구글 콘솔 「승인된 리디렉션 URI」(…/login.html)와 글자까지 같아야 함'],
  ['swreg.js', q{navigator.serviceWorker.register('./sw.js')},
   '서비스워커 자리 — 바꾸면 깔린 앱이 새 판을 영영 못 받을 수 있음'],
);
# 있으면 안 되는 파일
my @absent = (
  ['CNAME', 'CNAME 이 생기면 GitHub Pages 가 주소를 그 도메인으로 옮김 — 앱 주소(origin)가 바뀜. 도메인을 정할 때만, 위 절차대로'],
);
my @must = (
  ['login.html',   '구글이 돌려보내는 페이지 — 없으면 아무도 로그인 못 함'],
  ['privacy.html', '개인정보처리방침 — 앱 안 링크·가입 동의(·나중에 스토어 등록)가 이 주소를 가리킴'],
);

my $bad = 0;
for my $r (@rules){
  my ($f, $want, $why) = @$r;
  my $s = do { local $/; open my $h, '<:encoding(UTF-8)', $f or do { print "  ✗ $f 없음\n"; $bad++; next }; <$h> };
  next if index($s, $want) >= 0;
  print "  ✗ $f — 이 글자가 없어졌거나 바뀌었습니다:\n      $want\n    왜 위험한가: $why\n";
  $bad++;
}
for my $a (@absent){ my ($f, $why) = @$a; if (-e $f){ print "  ✗ $f 가 생겼습니다 — $why\n"; $bad++; } }
for my $m (@must){ my ($f, $why) = @$m; unless (-e $f){ print "  ✗ $f 가 없습니다 — $why\n"; $bad++; } }

if ($bad){
  print "\n  ⚠ 바꾸면 안 되는 값 $bad 군데가 달라졌습니다. 일부러 바꾼 것이면 tools/frozen.pl 머리말의 절차대로 하고\n" .
        "    이 파일의 값과 까닭을 같이 고치십시오. 아니면 되돌리십시오.\n";
  exit 1;
}
print "  바꾸면 안 되는 값: 다 그대로 (" . scalar(@rules) . "곳 · 파일 " . (scalar(@absent) + scalar(@must)) . ")\n";
