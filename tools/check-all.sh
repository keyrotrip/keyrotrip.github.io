#!/usr/bin/env bash
# 검사 전부 — 로컬과 CI 가 **같은 목록**을 돕니다(2026-10-16).
#
#   쓰기:  bash tools/check-all.sh            (travel-v2 에서)
#          NODE=… DENO=… bash tools/check-all.sh   (PATH 에 없으면 경로를 줍니다)
#
# 왜: 예전엔 CI 가 넷(문법·바꾸면 안 되는 값·못 찾는 이름·브라우저)만 돌고, 나머지 perl 검사와
#     서버(Deno) 검사는 손으로만 돌았습니다. 그래서 「못 찾는 이름」이 b874 부터 오탐으로
#     빨갛던 것도, 서버 함수에 타입 오류 12개가 있던 것도 아무도 몰랐습니다.
#
# 규칙
#   - 하나라도 실패하면 끝에 1 로 끝냅니다. 실패를 숨기려고 목록에서 빼지 마십시오.
#   - 도구가 없어 못 돈 검사는 «건너뜀»으로 따로 셉니다. **건너뜀은 통과가 아닙니다.**
#     CI(환경변수 CI=true)에서는 건너뜀도 실패로 봅니다.
#   - «알림»은 알려진 오탐·옛 경고가 있어 멈추지는 않고 출력만 보여 주는 것입니다.
#
# 목록에 없는 tools/ 의 것들과 까닭
#   imports.pl  — check-refs.mjs 가 대신합니다(오탐 6: 구조분해·매개변수 이름을 못 가림).
#   scope.pl    — 알려진 오탐이 15줄이라 멈추는 데 못 씁니다. 손으로 보고 판단합니다.
#   dupsel.pl   — CSS 선택자 겹침 목록(50개)은 정상 상태입니다. 새 이름 지을 때 손으로.
#   syntax.pl   — 검사기가 아니라 _syn.html 을 쓰는 «생성기»입니다. 돌리지 마십시오.
#   그 밖의 *.pl — 지도·도시 자료를 «만드는» 도구입니다(파일을 씁니다).
set -u
cd "$(dirname "$0")/.." || exit 2

NODE="${NODE:-node}"
DENO="${DENO:-deno}"
PERL="${PERL:-perl}"
IN_CI="${CI:-}"

PASS=(); FAIL=(); SKIP=(); NOTE=()
has() { command -v "$1" >/dev/null 2>&1 || [ -x "$1" ]; }

run_gate() {   # run_gate "이름" 명령…   — 실패하면 실패 목록에
  local name="$1"; shift
  echo; echo "── $name"
  if "$@"; then PASS+=("$name"); else FAIL+=("$name"); fi
}
run_note() { # run_note "이름" 명령…   — 출력만 보여 주고 멈추지 않음
  local name="$1"; shift
  echo; echo "── $name (알림 — 멈추지 않음)"
  "$@" || true
  NOTE+=("$name")
}
skip() { # skip "이름" "까닭"
  echo; echo "── $1: 건너뜀 — $2"
  SKIP+=("$1 ($2)")
}

# ── 1. 화면 코드 ─────────────────────────────────────────────────────
if has "$NODE"; then
  run_gate "문법"                     "$NODE" tools/check-syntax.mjs
  run_gate "못 찾는 이름 — 회귀 검사" "$NODE" tools/check-refs.test.mjs
  run_gate "못 찾는 이름"             "$NODE" tools/check-refs.mjs
else
  skip "문법·못 찾는 이름" "node 없음"
fi

if has "$PERL"; then
  run_gate "바꾸면 안 되는 값"        "$PERL" tools/frozen.pl
  run_gate "선언 없는 상수(undef)"    "$PERL" tools/undef.pl
  run_gate "역따옴표(tick)"           "$PERL" tools/tick.pl
  run_gate "ctx 주입(ctx)"            "$PERL" tools/ctx.pl
  run_gate "겹친 import(dupimp)"      "$PERL" tools/dupimp.pl
  run_gate "부정 덫(optneg)"          "$PERL" tools/optneg.pl
  run_gate "modulepreload(preload)"   "$PERL" tools/preload.pl
  run_note "옛 이름표(stale)"       "$PERL" tools/stale.pl
else
  skip "perl 검사" "perl 없음"
fi

# ── 2. 서버 함수(Supabase Edge, Deno) ────────────────────────────────
# --frozen: deno.lock 과 다른 판을 받으려 하면 멈춥니다(재현 가능한 설치).
# --node-modules-dir=none: package.json(playwright)이 있어도 node_modules 를 요구하지 않게.
# 시험은 모의 네트워크만 씁니다 — 운영 API 로 아무것도 안 보냅니다(각 시험 파일 머리말).
if has "$DENO"; then
  run_gate "서버 타입 검사" "$DENO" check --frozen --node-modules-dir=none \
        supabase/functions/*/index.ts supabase/tests/*.ts
  run_gate "서버 시험"      "$DENO" test --frozen --node-modules-dir=none --allow-env --allow-read \
        supabase/tests/
else
  skip "서버 타입 검사·시험" "deno 없음"
fi

# ── 3. 브라우저로 앱 띄우기 ──────────────────────────────────────────
# playwright 와 브라우저가 있어야 합니다(CI 는 `npm ci` + `npx playwright install` 뒤에 부릅니다).
if has "$NODE" && [ -d node_modules/playwright ]; then
  run_gate "앱이 뜨는가" "$NODE" tools/check-app.mjs
else
  skip "앱이 뜨는가" "node_modules/playwright 없음 — npm ci && npx playwright install chromium"
fi

# ── 요약 ─────────────────────────────────────────────────────────────
echo
echo "════ 요약"
echo "  통과 ${#PASS[@]}"
for x in "${FAIL[@]}";   do echo "  ✗ 실패   $x"; done
for x in "${SKIP[@]}"; do echo "  − 건너뜀 $x"; done
for x in "${NOTE[@]}";   do echo "  · 알림   $x (출력을 읽을 것)"; done

if [ ${#FAIL[@]} -gt 0 ]; then echo "  → 실패 ${#FAIL[@]}개"; exit 1; fi
if [ ${#SKIP[@]} -gt 0 ]; then
  if [ "$IN_CI" = "true" ]; then echo "  → CI 에서 건너뛴 검사가 있습니다 — 실패로 봅니다"; exit 1; fi
  echo "  ⚠ 건너뛴 검사 ${#SKIP[@]}개 — 이 결과를 «다 통과»로 보고하지 마십시오"
fi
exit 0
