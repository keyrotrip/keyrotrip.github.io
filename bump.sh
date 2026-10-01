#!/bin/sh
# 판 번호 올리기.  사용법:  sh bump.sh b297
#
# ⚠ **파일 전체에서 옛 번호를 바꾸면 안 됩니다.**
#   전에는 `perl -pi -e 's/b295/b296/g' *.js *.html` 로 올렸습니다. 그러면
#   `?v=b295` 만이 아니라 **주석에 적어둔 과거 기록까지 같이 덮어씁니다.**
#   재보니 여섯 곳이 그렇게 뭉개져 있었습니다 — Dongle 을 셸에 넣은 것은
#   b282 인데 주석은 b296 이라고 말하고 있었고, 죽은 코드를 걷은 것도
#   b278 인데 b296 이라 적혀 있었습니다. 판마다 한 번씩 밀려 올라간 것입니다.
#   주석은 "언제 왜 이렇게 했나"를 남기려고 적는 것인데, 그 번호가 매번
#   지금 판으로 바뀌면 **적어둔 이유가 통째로 거짓말이 됩니다.**
#   그래서 `?v=` 뒤에 붙은 것만 바꿉니다.
#
#   index.html 의 <code id="build">b296</code> 는 지금 판을 보여주는 자리라
#   같이 올려야 맞습니다. 그건 따로 처리합니다.

set -e
NEW="$1"
[ -z "$NEW" ] && { echo "사용법: sh bump.sh b297"; exit 1; }

# 바꾸면 안 되는 값(아이콘을 담는 순간 굳는 상태바 방식·앱 주소·manifest id·로그인 저장 이름·초대 링크…)이
# 그대로인지 먼저 봅니다. 하나라도 다르면 판을 안 올립니다 — 2026-10-01 에 이걸 몰라 모두 아이콘을 다시 담았습니다.
# 일부러 바꿀 때의 절차는 tools/frozen.pl 머리말.
perl tools/frozen.pl || { echo "판을 안 올렸습니다 — 위 ✗ 부터 보십시오"; exit 1; }

OLD=$(grep -o 'app\.css?v=b[0-9]*' index.html | head -1 | sed 's/.*?v=//')
[ -z "$OLD" ] && { echo "index.html 에서 지금 판을 못 찾았습니다"; exit 1; }
[ "$OLD" = "$NEW" ] && { echo "이미 $NEW 입니다"; exit 1; }

# ⚠ **새 파일을 만들면 여기 더해야 했습니다.** 안 더하면 그 파일 안의 ?v= 만
# 옛 판으로 남고, 브라우저는 옛 모듈을 그대로 씁니다 — 새 화면에 옛 코드가
# 붙는 것이라 조용히 깨집니다. b324 에서 실제로 그랬습니다(map·shelf·persona).
# 그래서 이름을 적지 않고 **있는 대로** 씁니다. `_` 로 시작하는 것은 실험용
# 껍데기라 뺍니다(_mock.html 등).
FILES=$(ls *.js *.css *.html 2>/dev/null | grep -v '^_')

for f in $FILES; do
  [ -f "$f" ] || continue
  perl -i -pe "s/\\?v=$OLD\\b/?v=$NEW/g" "$f"
done

# 화면 아래에 찍히는 판 표시. 여기는 지금 판이라 같이 올립니다.
perl -i -pe "s|(<code id=\"build\">)$OLD(</code>)|\${1}$NEW\${2}|" index.html

echo "$OLD → $NEW"
echo "?v= 바뀐 곳: $(grep -roh "?v=$NEW" $FILES 2>/dev/null | wc -l)"
echo "주석 안에 남은 $OLD (그대로 두는 게 맞습니다): $(grep -roh "\bb[0-9]*\b" $FILES 2>/dev/null | grep -c "^$OLD$" || true)"
