#!/usr/bin/perl
# ── 없는 이름을 부르는 곳 (b719 에 데고 만듦) ─────────────────────────
#
# ⚠ 왜 만들었나 — b718 에 SORT_NAME 을 걷으면서 **그것을 아직 쓰는 줄
#   하나**를 못 봤습니다. 문법은 멀쩡해서 어떤 검사에도 안 걸렸고,
#   보관함이 통째로 안 열렸습니다(ReferenceError). 사용자가 신고했습니다.
#   전에 겪은 것은 «빠뜨린 import»(memory: missing-import-trap)였고,
#   이번 것은 «같은 파일 안»입니다.
#
# ⚠ **대문자 상수(SCREAMING_SNAKE)만 봅니다.** 그것이 이 저장소에서
#   모듈 맨 위에 두고 여기저기서 부르는 이름이라 지울 때 흘리기 쉽고,
#   따옴표 안 글자와 헷갈릴 일도 거의 없습니다. 일반 이름까지 보려면
#   진짜 파서가 필요합니다 — 그건 이 검사가 할 일이 아닙니다.
# ⚠ 주석과 문자열은 먼저 지웁니다. 안 그러면 주석에 적어둔 이름이
#   「쓰는 곳」으로 잡힙니다(이 파일 머리말이 바로 그런 경우입니다).
use strict; use warnings; use utf8;
binmode(STDOUT, ':utf8');

my %GLOBAL = map { $_ => 1 } qw(
  URL URLSearchParams JSON Math Date Set Map WeakMap WeakSet RegExp Promise
  Object Array Number String Boolean Error TypeError Symbol BigInt Proxy Reflect
  Blob File FileReader FormData Image Audio Video Notification Intl
  AbortController TextEncoder TextDecoder ArrayBuffer Uint8Array Int32Array
  Float32Array Float64Array DataView Response Request Headers Event CustomEvent
  MutationObserver IntersectionObserver ResizeObserver
  DOMParser XMLHttpRequest WebSocket Worker SharedWorker
  CSS NaN Infinity
);

opendir my $d, '.' or die;
my @js = grep { /[.]js$/ && !/^(sw|supabase)[.]js$/ } sort readdir $d;
closedir $d;

my $bad = 0;
for my $f (@js){
  open my $h, '<:raw', $f or next;
  local $/; my $s = <$h>; close $h; utf8::decode($s);

  $s =~ s{`[^`]*`}{ }gs;
  $s =~ s{'[^']*'}{ }gs;
  $s =~ s{"[^"]*"}{ }gs;
  $s =~ s{/[*].*?[*]/}{ }gs;
  $s =~ s{//[^\n]*}{ }g;

  my %have;
  $have{$1} = 1 while $s =~ /(?:const|let|var|function|class)\s+([A-Z][A-Z0-9_]{2,})/g;
  while ($s =~ /(?:import|const|let|var)\s*\{([^}]*)\}/g){
    my $in = $1;
    $have{$1} = 1 while $in =~ /([A-Z][A-Z0-9_]{2,})/g;
  }
  $have{$1} = 1 while $s =~ /import\s+([A-Z][A-Z0-9_]{2,})\s+from/g;
  # 한 줄에 둘 이상 — const A = 1, B = 2; 의 뒤엣것도 선언입니다.
  # 이걸 빠뜨렸더니 DAY_END/AV_BG/MAP_BOT/MOVE_TOL 넷이 헛걸렸습니다.
  $have{$1} = 1 while $s =~ /,\s*([A-Z][A-Z0-9_]{2,})\s*=/g;

  # 점 뒤(obj.CONST)와 속성 이름(CONST:)은 «쓰는 곳»이 아닙니다.
  my %used;
  while ($s =~ /(?<![A-Za-z0-9_.])([A-Z][A-Z0-9_]{2,})(.?)/g){
    next if $2 eq chr(58);   # CONST: 는 «속성 이름»이지 쓰는 곳이 아닙니다
    $used{$1}++;  }

  for my $n (sort keys %used){
    next if $have{$n} || $GLOBAL{$n};
    # ⚠ **밑줄이 있는 이름만 봅니다.** 밑줄 없는 대문자 덩어리는
    #   KTX·PDF·EUR·F25E26 처럼 «글자»인 경우가 대부분이라 헛걸림이
    #   19건 나왔습니다(실측). 이 저장소의 모듈 상수는 전부 밑줄이
    #   들어갑니다(SORT_NAME·PERSONA_RANK·SHELF_CAT…) — 그것만 봅니다.
    next if index($n, chr(95)) < 0;
    print "  $f: $n — 선언도 import 도 없습니다\n";
    $bad++;
  }
}
print $bad ? "⚠ $bad 곳\n" : "  없는 이름 없음\n";
# 2026-10-16: 찾으면 1 로 끝냅니다 — tools/check-all.sh 와 CI 가 이 값으로 멈춥니다.
exit($bad ? 1 : 0);
