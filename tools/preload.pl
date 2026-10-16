#!/usr/bin/perl
# ── modulepreload 빠진 모듈 검사 (b716, b698 점검 둘째) ────────────────
#
# ⚠ 왜 재는가 — 모듈 하나가 이 목록에서 빠지면 그 파일만 «나중에» 받습니다.
#   새 빌드를 올린 직후, 앞의 것들은 새 ?v= 로 받았는데 뒤늦게 받는 그
#   하나가 서비스워커 캐시의 옛 것과 만나는 창이 생깁니다.
#   b715 까지 열두 개가 빠져 있었습니다(anal·app·diary·globe·mate·
#   photoview·pshift·rateui·spree·try·un·world).
# ⚠ supabase.js 는 바깥 것이라 목록에 있어도 여기서는 안 셉니다.
# ⚠ sw.js 는 모듈이 아니라 서비스워커라 뺍니다.
use strict; use warnings; use utf8;
binmode(STDOUT, ':utf8');
open my $h, '<:raw', 'index.html' or die "index.html: $!";
local $/; my $s = <$h>; close $h; utf8::decode($s);
my %pre;
$pre{$1} = 1 while $s =~ /modulepreload"\s+href="\.?\/?([a-z0-9]+\.js)/g;
opendir my $d, '.' or die;
my @miss = grep { !$pre{$_} }
           grep { !/^(sw|supabase)\.js$/ }
           grep { /\.js$/ } sort readdir $d;
closedir $d;
print $_ eq '' ? '' : "  빠짐: $_\n" for @miss;
print @miss ? "⚠ ".scalar(@miss)."개가 modulepreload 에 없습니다\n"
            : "  modulepreload 다 있음\n";
# 2026-10-16: 빠진 것이 있으면 1 로 끝냅니다 — tools/check-all.sh 와 CI 가 이 값으로 멈춥니다.
exit(@miss ? 1 : 0);
