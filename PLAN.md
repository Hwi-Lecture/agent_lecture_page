# 지식기반 에이전트 구축 강의 페이지 — 계획
> 2026-11-08 주제 변경: 온톨로지 입문 → **지식기반 에이전트 구축** (온톨로지는 제외). 아래 본문의 "온톨로지" 예시는 구 주제 기준.
> 교안 문구 톤: 슬로건·동기부여·느낌표·약속형 어미 없이 사실·기능 서술, 항목형 나열.
> 교안 구성: `교안구상_v2.md` (원본 `교안구상.md` 보존). 온톨로지·지식그래프 단원 보류, 실제 공개 데이터 사용.
>   역할 — Claude: v2 구성안 작성 / GPT: 3-2 후보 데이터의 접근 방법·이용 조건 실제 확인 및 검토
> 2026-11-08 샘플 콘텐츠 작업: GPT가 정책브리핑의 짧은 기간·단일 부처 자료를 선정하고 u01 샘플 글·슬라이드·실습 및 강의 메타데이터를 채움. Claude는 콘텐츠·출처·페이지 표현만 검토하고 수정 제안.
> 표지 DOM 훅 추가: `#hero-unit-count`(공개 단원 수 등 구성 텍스트, home.js가 채움)

## 1. 목표
- 강의 자료를 웹페이지로 제공: 메인(단원 목록) → 단원 페이지(웹 슬라이드) → 실습(슬라이드 옆 분할 화면)
- 수강생에게는 **기능만 보이고 코드는 숨김** (실습 위젯은 UI만 노출)
- 지금은 내용 X, **틀(레이아웃·네비게이션·슬라이드 엔진·실습 분할)** 만 만든다
- **사용자·AI 모두 글/슬라이드를 쓰고 고칠 수 있어야 한다** (AI 초안 → 사용자 수정 포함) → 9절

## 2. 기술 방침 (v1: 작성 편의 요구 반영해 변경)
- 빌드 없는 정적 사이트: HTML + CSS + 바닐라 JS
- **콘텐츠는 Markdown 파일**로 분리 (`content/uXX/post.md`, `slides.md`). HTML을 몰라도 메모장/VS Code로 수정 가능, AI도 같은 파일을 편집
- Markdown을 fetch로 읽으므로 **로컬 서버로 실행** (`start.bat` → `serve.py`). `file://` 더블클릭 실행은 포기
- 단원 페이지는 **템플릿 1개(`unit.html?u=u01`)** 가 단원 콘텐츠를 불러와 렌더 (단원마다 HTML 복사 X)
- 실습은 `labs/*.html` 독립 페이지를 iframe으로 띄움
- 시각화 라이브러리는 단원에서 필요할 때만 추가 (그래프: vis-network/Cytoscape 후보)

## 3. 폴더 구조 (v1)
```
index.html                 메인(단원 목록)            [Claude: 마크업]
unit.html                  단원 템플릿(글/슬라이드 탭) [Claude: 마크업]
start.bat, serve.py        로컬 실행 + 편집 저장 API   [GPT]
assets/css/base.css        디자인 토큰·공통 컴포넌트    [Claude]
assets/css/home.css        메인 페이지                 [Claude]
assets/css/unit.css        단원 페이지·글(article)     [Claude]
assets/css/deck.css        슬라이드·분할 화면 외형      [Claude]
assets/css/editor.css      편집 모드 외형              [Claude]
assets/js/course.js        단원 메타데이터             [GPT]
assets/js/home.js          메인 카드 렌더·진도          [GPT]
assets/js/markdown.js      Markdown → HTML 변환        [GPT]
assets/js/unit.js          단원 로딩·글/슬라이드 탭     [GPT]
assets/js/deck.js          슬라이드 엔진·실습 분할      [GPT]
assets/js/editor.js        브라우저 편집 모드           [GPT]
content/u01/post.md        단원 1 본문 글              [누구나]
content/u01/slides.md      단원 1 슬라이드             [누구나]
labs/sample-lab.html       실습 샘플                   [GPT]
```

## 4. UI 구성
### 4-1. 메인 페이지 (index.html)
```
┌───────────────────────────────────────────────┐
│ [로고] 온톨로지 입문            [진도 40%]       │  헤더
├───────────────────────────────────────────────┤
│ 강의 소개 한 줄 + "이어서 보기" 버튼              │  히어로
├───────────────────────────────────────────────┤
│ ┌─01──────┐ ┌─02──────┐ ┌─03──────┐           │
│ │단원 제목 │ │단원 제목 │ │단원 제목 │           │  단원 카드 그리드
│ │요약 1줄  │ │요약 1줄  │ │준비 중   │           │  (번호·제목·요약·
│ │슬라이드12│ │실습 有   │ │ (잠금)   │           │   슬라이드 수·실습 배지·
│ │■■■□ 완료 │ │□□□□     │ │          │           │   진행 상태)
│ └─────────┘ └─────────┘ └─────────┘           │
└───────────────────────────────────────────────┘
```
- 카드 클릭 → `unit.html?u=uXX` (이어서 보기: `unit.html?u=uXX&view=slides#last`)
- 상태: 공개 / 준비 중(클릭 불가) — course.js의 `status`로 제어
- 진도: 마지막으로 본 슬라이드 번호를 localStorage에 저장 → 카드/헤더에 표시

### 4-1b. 단원 페이지 — 글 탭 (`view=post`, 기본)
```
┌───────────────────────────────────────────────┐
│ ← 목록 | 01. 온톨로지란?  [글|슬라이드]  [✎ 편집]│
├──────────┬────────────────────────────────────┤
│ 글 목차   │  본문 (post.md 렌더, 최대폭 720px)   │
│ (h2/h3)  │  그림·표·코드블록·콜아웃             │
└──────────┴────────────────────────────────────┘
```

### 4-2. 단원 페이지 — 슬라이드 탭 (`view=slides`)
```
┌───────────────────────────────────────────────┐
│ ← 목록 | 01. 온톨로지란? [글|슬라이드] [목차][⛶][✎]│
├───────────────────────────────────────────────┤
│                                               │
│               16:9 슬라이드 영역                │
│                                               │
├───────────────────────────────────────────────┤
│  ◀  3 / 12  ▶      ━━━━━━○──────  [🧪 실습 열기]│  하단 바
└───────────────────────────────────────────────┘
```
- 이동: ←/→ 키, 버튼, 스와이프 / URL `#3` 으로 특정 슬라이드 직접 링크
- [목차]: 슬라이드 제목 목록 사이드 패널
- [실습 열기] 버튼은 `data-lab="..."` 가 있는 슬라이드에서만 표시

### 4-3. 단원 페이지 — 실습 분할 모드
```
┌───────────────────────────────────────────────┐
│ ← 목록 | 01. 온톨로지란?              [실습 닫기]│
├──────────────────────┬┬───────────────────────┤
│   슬라이드 (축소)     ││   실습 패널 (iframe)    │
│   ◀ 3/12 ▶ 이동 가능  ││   labs/xxx.html        │
│                      ││                        │
└──────────────────────┴┴───────────────────────┘
                     드래그로 비율 조절
```
- 실습 중에도 왼쪽 슬라이드 넘기기 가능 (실습 패널은 유지)
- 좁은 화면(<900px)에서는 위/아래 분할 또는 탭 전환

## 5. 콘텐츠 작성 규칙 (사용자·AI 공통) — 상세 문법 확정은 GPT
- 글: `content/uXX/post.md` 일반 Markdown. 콜아웃은 `> [!NOTE]` / `> [!TIP]` / `> [!WARN]`
- 슬라이드: `content/uXX/slides.md`, 슬라이드 구분은 줄 단독 `---`, 각 장 첫 줄에 선택적 설정 주석
```markdown
<!-- layout: title -->
# 온톨로지 입문
강사 이름

---
<!-- layout: two-col; lab: sample-lab -->
## 실습: 클래스 만들기
- 왼쪽 단
|||
오른쪽 단(구분자 |||)
```
- 레이아웃: `title`, `default`, `two-col`, `figure`, `section`(단원 내 소제목 장) → CSS 클래스 `slide--{layout}`
- `lab: 이름` → `labs/이름.html` 을 실습 패널로 연결
- 복잡한 시각화가 필요한 장은 Markdown 안에 HTML 직접 삽입 허용

## 6. 역할 분담 (v1 — 사용자 지정)
| 담당 | 범위 |
|---|---|
| Claude | **전체 디자인**: 모든 CSS, 페이지 마크업(`index.html`, `unit.html`)의 레이아웃·DOM 구조 |
| GPT | **주요 기능**: 모든 JS(카드 렌더, Markdown 변환, 슬라이드 엔진, 실습 분할, 편집 모드, 진도), `serve.py`, 샘플 콘텐츠·실습 |

- 경계 약속은 10절(DOM 훅·클래스). JS는 10절의 id/class/data 속성만 사용하고, 외형은 CSS 클래스 토글로만 바꾼다 (JS에서 style 직접 지정 최소화, 분할 비율 같은 값은 CSS 변수로)
- 디자인 토큰(색·폰트·간격)은 base.css의 CSS 변수
- course.js의 단원 id(`u01`)와 `content/` 폴더명 일치

## 7. 진행 순서
1. [x] 계획·UI 확정
2. [x] Claude: base.css + home.css + index.html (정적 샘플 카드로 디자인 확인 가능)
3. [x] GPT: course.js + home.js + serve.py/start.bat (샘플 카드를 데이터 렌더로 교체)
4. [~] Claude: unit.html + unit.css + deck.css + editor.css (완료) / GPT: markdown.js + unit.js + deck.js
5. [ ] 실습 분할 모드
6. [ ] 편집 모드 (editor.js + editor.css)
7. [ ] 상호 검토 → 사용자 확인


## 8. 슬라이드·실습 구현 보완 (GPT 검토)
- 정적 HTML과 iframe 구조로 구현 가능하다. 브라우저에 전달되는 HTML·JS는 개발자 도구로 볼 수 있으므로 코드 은닉이나 보안 수단은 아니다. 비밀값과 보호가 필요한 로직은 넣지 않는다.
- `#번호`는 1부터 시작한다. 잘못된 해시는 첫 장으로 처리하고, 해시 변경과 브라우저 뒤로/앞으로도 화면에 반영한다. 첫 장과 마지막 장에서는 해당 이동 버튼을 비활성화한다.
- 진도 키는 `ontology:progress:u01`처럼 단원 ID를 붙인다. 값은 JSON 문자열 `{ "last": 3, "max": 7, "total": 12, "updated": 1731050000000 }` 형식이다. last는 마지막으로 본 번호, max는 지금까지 본 가장 뒤 번호, total은 엔진이 실제로 센 슬라이드 수, updated는 저장 시각의 밀리초 타임스탬프다.
- 엔진은 슬라이드를 바꿀 때마다 저장하며 max가 이전 값보다 작아지지 않게 한다. 메인은 max/total로 단원 진도를 계산하고, updated가 가장 최근인 단원의 `unit.html?u=uXX&view=slides#last`로 이어준다(v1 구조 변경 반영). 저장소 접근이 막히면 try/catch로 조용히 무시하고 탐색은 계속 동작한다.
- 실습을 열면 해당 iframe을 유지하고 슬라이드를 이동해도 다시 불러오지 않는다. 다른 실습이 있는 슬라이드에서는 사용자가 명시적으로 열 때만 교체하고, 닫기 버튼은 슬라이드와 관계없이 계속 표시한다. 닫으면 실습 상태가 초기화될 수 있음을 UI에 알린다.
- iframe에 제목을 부여하고 로컬 상대 경로를 사용한다. 전체화면은 지원하는 브라우저에서만 제공하며 실패 시 일반 화면을 유지한다. `file://`의 저장소와 iframe 동작은 브라우저별 차이가 있어 주요 브라우저에서 직접 확인한다.
- 슬라이드 단축키는 입력창 등 편집 중에는 가로채지 않는다. iframe에 포커스가 있으면 부모가 키 입력을 받지 못할 수 있으므로 화면의 이동 버튼을 항상 사용할 수 있게 한다. 스와이프는 슬라이드 영역에서만 처리한다.
- 목차와 분할 조절은 키보드로도 조작할 수 있게 하고, 버튼 이름·현재 슬라이드·포커스 상태를 접근 가능하게 표시한다. 숨긴 슬라이드는 포커스와 스크린리더 탐색에서도 제외한다.
- 좁은 화면은 위아래 분할을 기본으로 하며, 분할선에는 최소 크기와 키보드 조절을 제공한다. 콘텐츠가 넘칠 때 읽을 수 있도록 스크롤을 허용한다.

## 9. 작성·편집 흐름 (v1 추가 — 사용자 요구)
- 세 가지 경우 모두 **같은 Markdown 파일**을 다룬다: ① AI가 작성 ② 사용자가 작성 ③ AI 초안 → 사용자 수정
- 편집 방법 2가지
  1. 파일 직접 편집: `content/uXX/*.md` 를 VS Code/메모장으로 수정 → 브라우저 새로고침
  2. 브라우저 편집 모드: 단원 페이지 [✎ 편집] → 좌측 Markdown 편집기 / 우측 실시간 미리보기(글 또는 현재 슬라이드) → [저장] 시 `serve.py`가 파일에 기록
- 편집 모드는 로컬 서버(`serve.py`)에서만 켜짐. 정적 호스팅 등 저장할 수 없는 환경에서는 [✎] 버튼을 누르면 로컬 실행 방법을 안내한다.
- AI 초안 표시는 각 Markdown 파일 맨 위 front matter `status: draft | reviewed`를 유일한 기준으로 삼는다. 단원 화면은 현재 탭 기준이며 메인 카드는 글이나 슬라이드 중 하나라도 초안이면 표시한다. 사용자가 검토 후 `reviewed`로 바꾼다.
- AI는 사용자가 고친 내용을 덮어쓰지 않는다: 수정 전 파일을 다시 읽고 필요한 부분만 고친다

## 10. 디자인 ↔ 기능 경계 (DOM 훅) — Claude 정의, GPT 사용
- 공통: `body[data-page="home|unit"]`, 상태 클래스 `is-active`, `is-hidden`, `is-disabled`, `is-locked`, `is-draft`
- 진도 표시는 요소에 CSS 변수 `--progress`(0~1)를 지정하면 막대가 그려짐
- 메인(index.html)
  - `#unit-grid` 카드 컨테이너. 안의 `[data-placeholder]` 샘플 카드는 home.js가 렌더 시 제거
  - `<template id="tpl-unit-card">` 카드 원형, 루트 `a.unit-card` (+ `is-locked`, `is-draft`)
  - 카드 내부 훅: `[data-slot="no|title|summary|slides|lab|progress-text|status"]`, 막대는 `.progress`(카드 루트의 `--progress` 사용)
  - `#continue-btn`(이어서 보기, 기록 없으면 `is-hidden`), `#total-progress`(헤더 진도 텍스트), `#total-progress-bar`(`--progress`)
  - `#course-title`, `#course-desc` (course.js 값으로 채움)
- 단원(unit.html) — 마크업 안 주석에도 형식 표기
  - **body 상태**: `data-view="post|slides"`, 클래스 `is-lab-open`, `is-editing`, `is-toc-open`. `.only-post`/`.only-slides`는 CSS가 자동 숨김
  - 헤더: `#unit-no`, `#unit-title`, `#draft-badge`(is-hidden 토글), 탭 `button[data-view-tab="post|slides"]`(is-active + aria-selected), `#toc-btn`(aria-expanded), `#fullscreen-btn`(대상: `#deck-view`), `#edit-btn`(편집 가능 시 is-hidden 해제, aria-pressed)
  - 로딩/오류: `#unit-state`(is-hidden, `data-state="loading|error"`), 문구 `#unit-state-text`
  - 글: `#post-body`(class `prose`에 렌더), 목차 `#post-toc` 안 `<li class="post-toc__h2|h3"><a href="#id">`, 현재 위치 `a.is-active`
  - 콜아웃 출력: `<div class="callout callout--note|tip|warn"><p class="callout__title">메모</p>...</div>`
  - 슬라이드: `#deck` 안 `<section class="slide slide--{layout}" data-title data-lab aria-hidden><div class="slide__body">…</div></section>`, 현재 장 `is-active`. two-col은 `.slide__body` 안 제목 등 + `.slide__col` 2개. 크기·16:9 비율은 CSS가 처리(JS 스케일 불필요)
  - 하단 바: `#prev-btn`/`#next-btn`(disabled 속성), `#slide-current`, `#slide-total`, `#slide-progress`(`--progress`), `#lab-btn`(lab 있는 장에서 is-hidden 해제)
  - 실습: `#lab-pane`, `#lab-title`, `#lab-close-btn`, `iframe#lab-frame`. 분할 비율은 `#deck-view`에 `--split`(0.25~0.75, 슬라이드 쪽). `#split-handle`(role=separator, aria-valuenow 갱신, 드래그 중 is-active → iframe 포인터 차단). 900px 이하에선 자동 위아래 분할
  - 슬라이드 목차: `#slide-toc-list` 안 `<li><button data-slide="n"><span class="slide-toc__no">n</span>제목<span class="slide-toc__lab">🧪</span></button></li>`, 현재 장 is-active. 닫기 `#toc-close-btn`, 배경 `.scrim[data-close="toc"]`
  - 편집기: `#editor-file`(경로 표시), `#editor-status`(`data-state="saved|dirty|saving|error"` + 문구), `#editor-input`(textarea), `#editor-save`, `#editor-cancel`. 편집 중 오른쪽 기존 화면이 그대로 미리보기

## 11. 로컬 저장 API
- 서버는 `127.0.0.1`에서만 실행한다. `GET /api/status`는 `{ "editable": true }`를 반환한다.
- `POST /api/save`는 같은 서버의 Origin과 JSON 본문 `{ "path": "content/u01/post.md", "content": "...", "original": "..." }`을 요구한다. 기존 `content/uXX/post.md` 또는 `slides.md`만 저장하며, 원본이 바뀌었으면 409로 거부하고 성공 시 `{ "ok": true }`를 반환한다.
- 메인 전체 진도는 공개 단원의 진도 비율을 평균한다.

## 12. 슬라이드 시각 편집 (1·2단계, 사용자 승인 2026-11-08)
### 12-1. 저장 형식 — 자유 배치 층 `:::canvas` (slides.md 안, 사람·AI가 읽고 쓸 수 있는 텍스트)
````markdown
<!-- layout: default -->
## 개념과 관계
- 본문은 지금처럼 Markdown

:::canvas
rect    x=8  y=55 w=20 h=14 color=primary style=soft text="클래스"
ellipse x=40 y=55 w=18 h=14 color=node   style=fill text="인스턴스"
arrow   x1=28 y1=62 x2=40 y2=62 color=ink head=end
text    x=60 y=18 w=32 size=2.4 text="자유 글상자"
image   x=64 y=40 w=28 src=img/graph.png
:::
````
- 한 줄 = 객체 1개, **줄 순서 = 겹침 순서**(아래 줄이 위에 그려짐). 슬라이드당 `:::canvas` 블록 최대 1개, 위치는 장 안 어디든 가능
- 좌표: `x`,`w` = 슬라이드 **폭** 대비 %, `y`,`h` = 슬라이드 **높이** 대비 % (0~100, 소수 1자리)
- 종류: `rect`, `ellipse`, `text`(테두리 없는 글상자), `image`, `arrow`(`x1 y1 x2 y2`, `head=end|both|none`, `dash`)
- `color`: `primary|node|edge|ink|muted|danger` (기본 primary) · `style`: `fill|soft|outline` (기본 soft) · `size`: 글자 크기 cqi (기본 2)
- `text="..."`: 큰따옴표, 줄바꿈은 `\n`, 따옴표는 `\"`. `image`의 `h` 생략 시 원본 비율
- 모르는 키는 보존(무시하되 저장 시 지우지 않음). 잘못된 줄은 렌더에서 건너뛰고 편집기에 경고

### 12-2. 렌더 결과 (GPT 출력 → Claude CSS)
```html
<section class="slide ..."><div class="slide__body">…</div>
  <div class="slide__canvas">
    <div class="cv cv--rect cv--primary cv--soft" data-index="0" style="--x:8;--y:55;--w:20;--h:14;--size:2"><span class="cv__text">클래스</span></div>
    <div class="cv cv--arrow cv--ink cv--head-end" data-index="2" style="--x:28;--y:62;--len:12;--angle:0"></div>
    <img class="cv cv--image" data-index="4" src="content/u01/img/graph.png" style="--x:64;--y:40;--w:28" alt="">
  </div>
</section>
```
- 숫자는 단위 없이 CSS 변수로 (CSS가 %·cqi로 환산). `h` 없으면 `--h` 생략
- 화살표: 16:9 고정이므로 JS가 `--len`(슬라이드 폭 % 단위), `--angle`(deg) 계산. 시작점이 `--x/--y`
  - dx = x2−x1, dy = (y2−y1)×0.5625 → len = √(dx²+dy²), angle = atan2(dy, dx)
- `dash` → `cv--dash`

### 12-3. 편집 UI DOM 훅 (Claude 마크업, GPT 동작)
- 편집 중 슬라이드 보기: `body.is-editing[data-view="slides"]` → 객체에 커서·호버 표시(CSS 자동)
- 삽입 도구 모음 `#editor-tools` (편집기 상단, 슬라이드 편집 시만 표시 `.only-slides`)
  - `select#tool-layout`(현재 장 레이아웃 변경), `button[data-insert="rect|ellipse|arrow|text|image"]`(자유 배치 층에 추가),
    `button[data-snippet="slide|two-col|table|callout|lab"]`(커서 위치에 Markdown 조각 삽입), `input#image-input[type=file]`(숨김)
  - 글 편집 시에도 `button[data-insert="image"]`, `[data-snippet="table|callout"]`는 표시(`.tool--both`)
- 선택 상자 `#cv-selection`(현재 장 `.slide__canvas` 안으로 JS가 옮김), 상태 `is-hidden`, `data-kind="box|arrow"`, 위치 변수 = 선택 객체와 동일(`--x --y --w --h` / 화살표는 `--x1 --y1 --x2 --y2`)
  - 손잡이 `.cv-handle[data-handle="nw|n|ne|e|se|s|sw|w|start|end"]`, 이동은 상자 본체 드래그
- 속성 막대 `#cv-props`(덱 위 떠 있음, 선택 시 `is-hidden` 해제)
  - `button[data-prop="color"][data-value="..."]`, `button[data-prop="style"][data-value="fill|soft|outline"]`,
    `button[data-action="size-down|size-up|forward|backward|duplicate|delete"]`, 현재 값 버튼 `is-active`
- 도형 글자 직접 수정: 더블클릭 → `.cv.is-text-editing` + `.cv__text[contenteditable]`
- 이미지 끌어놓기: 대상 영역에 `is-dragover` (`.editor`, `.deck`) → 업로드 후 자유 배치 층에 `image` 추가
- 편집 중 슬라이드 위 동작 → **즉시 textarea의 `:::canvas` 줄을 갱신**(원문이 유일한 진실). 미리보기 재렌더 후 선택 유지는 `data-index` 기준

### 12-4. 이미지 업로드 API (GPT, serve.py)
- `POST /api/upload` JSON `{ "unit": "u01", "name": "graph.png", "data": "<base64>" }` → `content/u01/img/` 저장, 응답 `{ "ok": true, "src": "img/graph.png" }`
- 확장자 png/jpg/jpeg/gif/webp/svg만, 최대 10MB, 파일명 안전화(영문·숫자·-_ 만, 중복 시 `-2` 접미사). Origin 검사는 save와 동일
- Markdown·canvas의 이미지 경로는 **단원 폴더 기준 상대경로**(`img/x.png`), 렌더 시 `content/uXX/` 접두

### 12-5. 역할
| Claude | `unit.html` 도구 모음·선택 상자·속성 막대 마크업, `assets/css/canvas.css`(객체·선택·속성 막대·드롭 표시), `editor.css` 도구 모음 |
|---|---|
| GPT | `markdown.js` canvas 파싱/렌더, `assets/js/canvas.js`(선택·드래그·리사이즈·속성·글자 수정·원문 동기화), `editor.js` 도구 모음·스니펫·업로드, `serve.py` 업로드 API, 샘플 slides.md에 canvas 예시 |

## 13. 정책브리핑 샘플 강의 콘텐츠 (2026-11-08)
- **작업 역할:** GPT가 자료 선정·사실 확인 및 `교안구상_v2.md`, `assets/js/course.js`, `content/u01/post.md`, `content/u01/slides.md`, `labs/sample-lab.html`의 샘플 콘텐츠를 작성. Claude는 바꾼 파일을 열어 콘텐츠·출처·레이아웃을 검토하고 수정 제안만 전달.
- **자료 범위:** 중소벤처기업부 보도자료, 2026-10-12~2026-10-29. 정책브리핑의 부처·날짜 필터 결과 27건(2026-11-08 확인, 2페이지). 샘플은 10/12 AI 솔루션 선정, 10/28 신안보 기업 풀, 10/29 중소제조 피지컬 AI 전략의 3건을 사용.
- **이용 방식:** 기사 본문을 요약하고 개별 원문 링크를 표시한다. 텍스트는 각 페이지의 공공누리 표시를 확인하고 출처를 밝히며, 이미지·영상·첨부파일은 사용하지 않는다. 강의 자료의 실제 배포 전에 조건을 다시 확인한다.
- **범위:** 짧은 본문 1개, 슬라이드 4장, 근거 확인용 iframe 실습 1개. 온톨로지·지식 그래프는 다루지 않는다. 페이지 콘텐츠는 초안 상태로 두어 사용자가 수정할 수 있게 한다.

## 14. 교안 1~6단계 샘플 재구성 (2026-11-08)
- **작업 역할:** GPT가 1~6단원 순서대로 본문·슬라이드 6장·실습 샘플을 다시 구성하고 `course.js` 메타데이터를 맞춘다. Claude는 바뀐 파일을 읽고 교안 순서·사실·화면 흐름만 검토한다(수정은 하지 않음).
- **슬라이드 흐름:** 1 바이브 코딩으로 화면 만들기 → 2 LLM의 입력과 답변 → 3 에이전트와 도구 → 4 간단한 챗봇 → 5 시스템 프롬프트 → 6 실제 정책자료를 프롬프트 맥락으로 제공.
- **실습:** 외부 모델 API 없이 선택한 질문과 실제 보도자료를 넣어 복사 가능한 프롬프트를 조립한다. 결과 답변은 수강생이 실제 LLM에 붙여 넣어 비교한다. 실습 iframe은 화면 시안이며, AI 호출이 구현됐다고 표현하지 않는다.
- **데이터 사용:** 중기부 보도자료(2026-10-12~29) 중 창업 AI 솔루션, 신안보 기업 풀, 중소제조 피지컬 AI 전략 등 최대 3건. 원문 링크·날짜·기관을 함께 제공하고 사진/첨부 파일은 제외한다.

## 15. 1~6단원 분리 (2026-11-08)
- **GPT:** `course.js`, `home.js`, `content/u01`~`u06`의 글과 단원별 슬라이드 3장, `labs/`의 1·2·5·6단원 실습을 작성한다. 실제 정책자료와 링크, 초안 상태, 기존 편집 및 진도 방식을 유지한다. 메인 장 수는 수정된 슬라이드 파일에서 확인해 이전 진도 기록의 옛 장 수와 일치시키고, 기록 자체는 지우지 않는다.
- **Claude:** 이번 변경은 기존 검토 의견을 반영한다. 메인 표지의 다루는 내용 문구는 Claude 담당으로 남긴다.
- **실습:** 1단원 화면 시연, 2단원 질문만 보내는 기준선 기록, 5단원 시스템 지시 전후 비교, 6단원 실제 자료를 넣은 프롬프트 작성. 모두 외부 모델 응답은 사용자가 직접 입력하며, 실습 화면은 이를 명시한다.

## 16. Git 저장소
- 저장소 루트는 프로젝트 폴더다. 강의 원고·화면·실습 파일을 함께 버전 관리하고, Python 캐시와 브라우저 미리보기 산출물은 .gitignore에서 제외한다.
