#!/usr/bin/perl
# ── 옛 이름표·옛 id 찾기(b857) ──────────────────────────────────────────────────────────────
# JS 가 querySelector·closest·matches 로 찾는 «클래스», $('…')·getElementById('…') 로 찾는 «id» 중
# 마크업(index.html · JS 템플릿 · className/classList/.id =)이 «만들지 않는» 것을 적습니다.
# 왜: b774 에 지구본 도시 카드를 「물음 → 별 → 안내」(.gsask)로 다시 짜면서 .gsmine 을 걷었는데, 별 저장 처리기는
#   옛 `.gsmine .stars` 를 그대로 찾아 **아무 별에도 안 붙었습니다** — 2주 동안 지구본 카드에서 별점이 저장되지 않았습니다
#   (10-13 사용자 신고 「치명적 오류」). 문법도 import 도 멀쩡해서 다른 검사는 못 잡습니다.
# 쓰는 법: perl tools/stale.pl  → 「검사 끝」만 나오면 깨끗. 줄이 나오면 그 자리를 열어 볼 것.
#   ⚠ ${…} 로 만드는 이름(`class="dbr${x ? ' top' : ''}"`)은 못 봅니다 — 그런 것만 걸리면 눈으로 확인하고 넘깁니다.
use strict; use warnings; use utf8;
binmode STDOUT, ':utf8';
opendir(my $dh, '.') or die; my @js = sort grep { /\.js$/ && !/^supabase/ } readdir($dh); closedir $dh;
my (%cls, %ids, %ucls, %uid);
sub slurp { my $f = shift; open(my $h, '<:utf8', $f) or return ''; local $/; my $s = <$h>; close $h; $s }
# 주석은 비웁니다(줄 수는 지킴) — 주석 속 옛 이름이 걸리지 않게.
sub nocomment { my $s = shift; $s =~ s{/\*.*?\*/}{ my $m = $&; my $k = () = $m =~ /\n/g; "\n" x $k }gse; $s =~ s{<!--.*?-->}{ my $m = $&; my $k = () = $m =~ /\n/g; "\n" x $k }gse; $s }
for my $f ('index.html', @js){
  my $s = nocomment(slurp($f));
  while ($s =~ /class(?:Name)?\s*=\s*(["'`])(.*?)\1/gs){
    my $v = $2;
    # ${…} 안의 따옴표 글자(조건부 이름 — class="dbr${위 ? ' top' : ''}")도 만드는 이름으로 칩니다.
    while ($v =~ /\$\{([^}]*)\}/g){ my $e = $1; while ($e =~ /['"]([\w -]+)['"]/g){ $cls{$_}++ for split /\s+/, $1; } }
    $v =~ s/\$\{[^}]*\}/ /g;
    $cls{$_}++ for grep { /^[\w-]+$/ } split /\s+/, $v;
  }
  while ($s =~ /classList\.(?:add|toggle|replace)\(\s*(["'`])([\w -]+)\1/g){ $cls{$_}++ for split /\s+/, $2; }
  while ($s =~ /className\s*\+?=\s*(["'`])([\w -]+)\1/g){ $cls{$_}++ for split /\s+/, $2; }
  while ($s =~ /\bid\s*=\s*["'`]([\w-]+)["'`]/g){ $ids{$1}++; }
  while ($s =~ /\.id\s*=\s*["'`]([\w-]+)["'`]/g){ $ids{$1}++; }
}
for my $f (@js){
  my @lines = split /\n/, nocomment(slurp($f));
  for my $i (0..$#lines){
    my $line = $lines[$i]; next if $line =~ m{^\s*//};
    while ($line =~ /(?:querySelector(?:All)?|closest|matches)\(\s*(["'`])(.*?)\1/g){
      my $sel = $2; $sel =~ s/\$\{[^}]*\}//g;
      push @{$ucls{$1}}, "$f:" . ($i + 1) while $sel =~ /\.([A-Za-z][\w-]*)/g;
    }
    while ($line =~ /(?:\$|getElementById)\(\s*["']([\w-]+)["']\s*\)(\?)?/g){ push @{$uid{$1}}, "$f:" . ($i + 1) . ($2 ? '?' : ''); }
  }
}
my $bad = 0;
for my $c (sort keys %ucls){ next if $cls{$c}; $bad++; my @w = @{$ucls{$c}}; printf "  클래스 .%-18s %s\n", $c, join(' ', @w[0..($#w > 3 ? 3 : $#w)]); }
for my $c (sort keys %uid){ next if $ids{$c}; $bad++; my @w = @{$uid{$c}}; printf "  id #%-20s %s\n", $c, join(' ', @w[0..($#w > 3 ? 3 : $#w)]); }
print $bad ? "  ↑ 마크업이 안 만드는 이름 ${bad}개 — 옛 이름표인지 확인\n" : "  검사 끝\n";
