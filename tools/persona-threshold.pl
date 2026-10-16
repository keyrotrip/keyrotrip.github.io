#!/usr/bin/perl
# 성향 확정 문턱이 화면과 서버(SQL)에서 같은가 (2026-10-16)
#
# 쓰기:  perl tools/persona-threshold.pl      (travel-v2 에서) — 같으면 0, 다르거나 못 찾으면 1
#
# 왜: 문턱(해외 N곳째 별에서 성향 확정)이 두 곳에 있습니다.
#   - 화면: personacalc.js 의 `export const 성향문턱 = N;` (persona · pshift · people · rating 이 다 이것을 씀)
#   - 서버: 관리자 「사용」 칸의 「성향 확정」 수 — db/*.sql 의 admin_usage_core 안 `where k = N`
#   SQL 은 JS 값을 못 읽으므로 한 곳으로 합칠 수 없습니다. 대신 둘이 같은지 여기서 봅니다.
#   실제로 어긋난 적이 있습니다: 115 에서 10 으로 올렸는데 116·117 이 114(5) 를 바탕으로 함수를 다시 만들어
#   5 로 되돌아갔고, 118 에서야 고쳤습니다(메모 admin-console).
#
# 무엇을 보나: admin_usage_core 를 정의하는 db 파일 중 «번호가 가장 큰» 것(= 운영에 마지막으로 돌린 것)의 값.
#   db 파일을 번호 순서대로 다 돌렸다는 전제입니다(실행 여부는 이 검사가 모릅니다).
use strict; use warnings; use utf8;
binmode STDOUT, ':encoding(UTF-8)';

sub slurp { my ($p) = @_; open my $h, '<:encoding(UTF-8)', $p or die "$p: $!"; local $/; my $s = <$h>; close $h; return $s; }

my $js = slurp('personacalc.js');
my ($화면) = $js =~ /^export const 성향문턱 = (\d+);/m;
unless (defined $화면) { print "  ✗ personacalc.js 에서 `export const 성향문턱 = N;` 을 못 찾았습니다\n"; exit 1; }

opendir my $d, 'db' or die "db: $!";
my @파일 = sort { ($a =~ /^(\d+)/)[0] <=> ($b =~ /^(\d+)/)[0] }
           grep { /^\d+_.*\.sql$/ } readdir $d;
closedir $d;

my @기록;
for my $f (@파일) {
  my $s = slurp("db/$f");
  next unless $s =~ /function\s+public\.admin_usage_core\b/;
  my $뒤 = substr($s, $-[0]);
  my ($k) = $뒤 =~ /\bwhere\s+k\s*=\s*(\d+)/;
  push @기록, [$f, $k // '?'];
}
unless (@기록) { print "  ✗ db/ 에서 admin_usage_core 정의를 못 찾았습니다\n"; exit 1; }

my ($마지막, $서버) = @{$기록[-1]};
print "  지나온 값: ", join(' → ', map { ($_->[0] =~ /^(\d+)/)[0] . ":" . $_->[1] } @기록), "\n";
if ($서버 eq '?') { print "  ✗ $마지막 의 admin_usage_core 에서 `where k = N` 을 못 찾았습니다\n"; exit 1; }
if ($서버 != $화면) {
  print "  ✗ 성향 확정 문턱이 다릅니다 — 화면 personacalc.js 성향문턱 = $화면 · 서버 $마지막 where k = $서버\n";
  print "    한쪽만 바꾸면 앱의 「확정」과 관리자 숫자가 서로 다른 날을 셉니다. 둘 다 맞추고, SQL 은 새 파일로 «마지막 판» 을 바탕으로.\n";
  exit 1;
}
print "  성향 확정 문턱: 화면·서버 같음 ($화면 · $마지막)\n";
exit 0;
