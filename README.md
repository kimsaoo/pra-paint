# 프라 도료 관리 앱

프라모델 도료 재고 관리 + 킷별 필요 도료 매칭 웹앱입니다.
React + Firebase(Firestore) + GitHub Pages 조합으로, 휴대폰에서 PWA(홈 화면 추가)로
설치해서 쓸 수 있고, 여러 기기에서 데이터가 자동으로 동기화됩니다.

이 문서는 개발 경험이 없어도 그대로 따라 하면 배포까지 끝낼 수 있도록 순서대로 적었습니다.
전체 과정은 크게 3단계입니다.

1. Firebase 프로젝트 만들기 (데이터 저장소)
2. 로컬에서 접속 테스트 (선택, 그래도 추천)
3. GitHub에 올려서 인터넷에 배포하기

---

## 1단계. Firebase 프로젝트 만들기

Firebase는 구글이 만든 서비스이고, 여기서는 "데이터를 저장하는 데이터베이스" 용도로만 씁니다.
무료 요금제(Spark Plan)로 충분합니다. 신용카드 등록도 필요 없습니다.

### 1-1. 프로젝트 생성

1. https://console.firebase.google.com 접속 → 구글 계정으로 로그인
2. **"프로젝트 추가"** 클릭
3. 프로젝트 이름 입력 (예: `pra-paint`) → 계속
4. Google Analytics 사용 여부를 물으면 **"사용 안 함"**으로 끄고 계속 (필요 없음)
5. 프로젝트 만들기 완료까지 기다림 (10~20초)

### 1-2. Firestore(데이터베이스) 켜기

> Firebase 콘솔 화면은 가끔 개편됩니다. 아래는 2026년 8월 기준이며, 메뉴 이름이 조금
> 다르게 보이면 "Firestore"라는 글자가 있는 메뉴를 찾으면 됩니다 (왼쪽 사이드바 검색창에
> "Firestore"를 입력해도 바로 찾아집니다).

1. 왼쪽 메뉴에서 **Databases & Storage → Firestore** 클릭
2. **"Create database"(데이터베이스 만들기)** 클릭
3. 위치(Location)는 `asia-northeast3 (Seoul)` 선택 추천 (한국에서 가장 빠름)
4. 보안 규칙 시작 모드는 **"Test mode"(테스트 모드)** 선택 → Create
   - 테스트 모드는 30일 후 자동으로 잠기니, 아래 1-4에서 바로 정식 규칙으로 바꿔줍니다.

### 1-3. 익명 인증 켜기

앱이 로그인 화면 없이도 "누가 접속했는지"를 최소한으로 구분하기 위해 익명 인증을 씁니다.

1. 왼쪽 메뉴에서 **Security → Authentication** 클릭 (안 보이면 검색창에 "Authentication" 입력)
2. 처음이면 **"Get started"** 클릭
3. **Sign-in method** 탭 → 제공업체 목록에서 **익명(Anonymous)** 선택 → 사용 설정(Enable) 토글 켜기 → 저장

### 1-4. Firestore 보안 규칙 적용

1. **Databases & Storage → Firestore** 페이지에서 상단의 **Rules** 탭 클릭
2. 기존 내용을 지우고, 압축 파일에 포함된 `firestore.rules` 파일 내용을 그대로 붙여넣기
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
3. **게시(Publish)** 클릭

### 1-5. 웹 앱 등록 + 설정값 복사

이 아이콘은 "프로젝트 개요(Overview)" 페이지에만 있어서, Firestore나 Authentication
설정 화면에 있으면 안 보입니다. 아래 두 방법 중 편한 쪽으로 찾아가세요.

**방법 A. 프로젝트 개요 페이지에서 찾기**
1. 왼쪽 위 Firebase 로고나 "프로젝트 개요(Overview)" 메뉴를 클릭해서 첫 화면으로 이동
2. 화면 가운데쯔음에 아이콘 3~4개(Android, iOS, 웹 `</>`, Unity 등)가 나란히 있음 →
   **`</>` (웹) 아이콘** 클릭
   - 이미 앱을 하나 등록한 적이 있다면 아이콘 대신 **"앱 추가(Add app)"** 버튼이 보일 수
     있습니다. 그 버튼을 누르면 같은 플랫폼 선택 화면이 나옵니다.

**방법 B. 프로젝트 설정에서 찾기 (더 확실함)**
1. 왼쪽 위 **⚙️ (톱니바퀴) 아이콘 → 프로젝트 설정(Project settings)** 클릭
2. **일반(General)** 탭에서 아래로 스크롤 → **"내 앱(Your apps)"** 섹션
3. 아직 등록된 앱이 없으면 **"앱 추가(Add app)"** 버튼 클릭 → 플랫폼 선택 화면에서
   **`</>` (웹)** 아이콘 클릭

이후 공통:

4. 앱 닉네임 입력 (예: `pra-paint-web`) → Firebase Hosting 체크박스는 **체크 안 해도 됨** →
   **앱 등록(Register app)**
5. **"Firebase SDK 추가(Add Firebase SDK)"** 화면이 나오면 **npm** 탭(또는 "Use npm" 버튼)을
   선택하세요. (다른 선택지인 `<script>` 태그 방식은 이 프로젝트와 안 맞습니다)
   - 화면에 나오는 `npm install firebase`, `import { initializeApp }...` 같은 코드는
     이미 이 프로젝트의 `package.json`과 `src/firebase.js`에 들어있으니 따로 복사하지
     않아도 됩니다. **"콘솔로 이동(Continue to console)"** 버튼만 눌러 넘어가세요.
6. 넘어간 화면(또는 방금 등록 과정 중간)에 나오는 `firebaseConfig` 객체를 확인합니다.
   아래처럼 생겼습니다:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "pra-paint-xxxxx.firebaseapp.com",
     projectId: "pra-paint-xxxxx",
     storageBucket: "pra-paint-xxxxx.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef123456"
   };
   ```
7. 이 6개 값을 압축 파일의 `.env.example`을 복사한 `.env` 파일에 채워 넣습니다.
   (`.env.example`을 `.env`로 이름만 바꿔서 값을 채우면 됩니다)
   ```
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=pra-paint-xxxxx.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=pra-paint-xxxxx
   VITE_FIREBASE_STORAGE_BUCKET=pra-paint-xxxxx.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
   VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
   ```

> 💡 참고: 이 설정값들은 "비밀번호"가 아니라 "이 앱이 어떤 Firebase 프로젝트를 쓰는지" 알려주는
> 식별자입니다. 실제 보안은 1-4에서 설정한 Firestore 규칙(로그인한 사용자만 접근 가능)이 담당합니다.
> 그래도 굳이 공개 저장소에 그대로 커밋하고 싶지 않다면, 3단계의 GitHub Actions Secrets 방식을 쓰세요.

---

## 2단계. 로컬에서 테스트 (선택이지만 추천)

배포 전에 내 컴퓨터에서 먼저 잘 되는지 확인하는 단계입니다. 생략하고 3단계로 가도 됩니다.

1. 컴퓨터에 Node.js 설치 (https://nodejs.org 에서 LTS 버전 다운로드 후 설치)
2. 압축 파일을 원하는 폴더에 풀기
3. 터미널(윈도우는 명령 프롬프트/PowerShell, 맥은 터미널)을 열고 그 폴더로 이동
   ```
   cd 압축을푼폴더경로
   npm install
   ```
4. 위 1-5에서 만든 `.env` 파일이 폴더 최상단에 있는지 확인
5. 아래 명령 실행 후 터미널에 나오는 주소(예: http://localhost:5173)를 브라우저로 열기
   ```
   npm run dev
   ```
6. "빈 데이터베이스입니다" 화면이 보이면 정상 연결된 것입니다. **"초기 데이터 불러오기"** 버튼을
   눌러서 엑셀에서 추출한 도료 64종 + 보유목록 + 킷 5종을 한 번만 채워 넣습니다.

---

## 3단계. GitHub에 올려서 인터넷에 배포하기

### 3-1. GitHub 계정 & 리포지토리 생성

1. https://github.com 계정이 없다면 가입
2. 오른쪽 상단 **+** → **New repository**
3. Repository name: `pra-paint` (다른 이름을 쓰면 아래 3-3에서 경로를 맞춰야 함)
4. Public/Private 아무거나 선택 (Private도 GitHub Pages 무료로 됩니다)
5. **Create repository**

### 3-2. 코드 업로드

터미널에서 압축을 푼 폴더 안으로 이동한 뒤:

```bash
git init
git add .
git commit -m "초기 커밋"
git branch -M main
git remote add origin https://github.com/내계정이름/pra-paint.git
git push -u origin main
```

> `.env` 파일은 `.gitignore`에 이미 포함되어 있어서 실수로 올라가지 않습니다. 대신 아래
> 3-4에서 GitHub Secrets에 같은 값을 등록해줍니다.

깃(git)이 설치되어 있지 않다면 https://git-scm.com/downloads 에서 설치하거나, GitHub
웹사이트에서 "Upload files" 버튼으로 폴더를 통째로 드래그해서 올려도 됩니다(이 경우 3-2는
생략, 대신 웹에서 직접 업로드).

### 3-3. 리포지토리 이름이 `pra-paint`가 아니라면

`vite.config.js` 파일과 `index.html`의 base 경로를 리포지토리 이름과 맞춰야 합니다.

`vite.config.js` 파일 안:
```js
base: '/실제리포지토리이름/',
```
로 수정한 뒤 다시 커밋 & 푸시하세요. (리포지토리 이름을 `pra-paint`로 그대로 쓰면 수정 불필요)

### 3-4. GitHub Secrets에 Firebase 설정값 등록

1. 리포지토리 페이지 → **Settings** 탭 → 왼쪽 메뉴 **Secrets and variables → Actions**
2. **New repository secret** 클릭, 아래 6개를 각각 등록 (이름은 정확히 일치해야 합니다)
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
3. 값은 1-5에서 확인한 `.env` 값과 동일하게 입력

### 3-5. GitHub Pages 활성화

1. 리포지토리 **Settings → Pages**
2. **Source**를 **"GitHub Actions"**로 선택 (Deploy from a branch가 아닙니다)
3. 저장

### 3-6. 배포 실행 확인

3-2에서 `git push`를 하면 `.github/workflows/deploy.yml`이 자동으로 실행됩니다.

1. 리포지토리 상단 **Actions** 탭에서 진행 상황 확인 (노란 원 → 초록 체크가 되면 완료, 1~2분 소요)
2. 완료되면 **Settings → Pages** 상단에 표시되는 주소로 접속
   (보통 `https://내계정이름.github.io/pra-paint/` 형태)
3. 처음 접속 시 "빈 데이터베이스입니다" 화면에서 **초기 데이터 불러오기**를 한 번 눌러주세요.
   (2단계에서 로컬로 이미 눌렀다면 데이터가 이미 있으니 다시 누르지 않아도 됩니다 —
   Firestore는 로컬/배포본이 같은 데이터베이스를 보고 있으므로 한 번만 하면 됩니다)

### 3-7. 휴대폰 홈 화면에 추가 (PWA)

- **iPhone(Safari)**: 배포된 주소 접속 → 공유 버튼 → **홈 화면에 추가**
- **Android(Chrome)**: 배포된 주소 접속 → 오른쪽 상단 메뉴(⋮) → **홈 화면에 추가** 또는
  하단에 뜨는 "앱 설치" 배너 사용

---

## 데이터 구조 변경 (2026-08, v2)

기존에는 "타미야 코드가 기준"이 되는 구조였는데, 아래처럼 **하나의 통합 도료 마스터(`paints`)** 로
전면 재구성했습니다.

- `paints`: 모든 도료(보유 여부와 무관하게 전부)가 여기 하나에 등록됩니다.
  `manufacturer`(제조사) / `paintType`(도료타입) / `code` / `name` / `note` / `owned`(보유여부) /
  `similarLinks`(유사도료 연결, `[{paintId, verified}]`) 필드를 가집니다.
- `kits`: 킷 자체 정보(`name`/`manufacturer`/`productType`). 도료 제조사 목록과는 별도로 관리됩니다.
- `kitPaintLinks`: 킷↔도료 다대다 연결 (`kitId`, `paintId`, `source`).

**핵심 변화**: 유사도료 연결이 양쪽 도료 문서에 모두 기록되기 때문에, "보유목록"에서 고치든
"킷 관리"에서 고치든 **같은 문서를 고치는 것**이라 항상 양쪽에 동일하게 반영됩니다.

### 마이그레이션 시 임의로 정한 부분 (필요시 알려주시면 조정합니다)

- 제조사 목록에 원래 요청하신 목록(tamiya/Vallejo/mig/AK/GCI/testor/Italeri/기타)에
  **Academy를 추가**했습니다 — 기존 보유목록에 아카데미 에나멜 24종이 있어서 갈 곳이 필요했습니다.
- 도료 타입은 요청하신 락커스프레이/아크릴스프레이/에나멜/아크릴/기타에 **락커(병)** 을 추가했고,
  타미야 LP 코드는 락커(병), TS 코드는 락커스프레이, X/XF 코드는 에나멜로 자동 분류했습니다.
- 군제(GCI) 도료 중 이름에 "스프레이"가 있으면 락커스프레이, 없으면 아크릴로 분류했습니다.
- Testor/Italeri 품목은 이름 앞의 "Testors"/"Italeri" 문구로 제조사를 구분했습니다.
- 기존 5개 킷은 전부 제조사=Tamiya로, 오토바이 3종은 BIKE, 자동차 2종은 AUTO로 임시 배정했습니다.
  실제와 다르면 "킷" 탭에서 바로 수정 가능합니다.
- LP-41(Mica blue)의 MIG 유사색으로 잘못 적혀있던 코드는 마이그레이션에서도 제외해뒀습니다
  (그 코드는 실제로는 Yellow 도료라 파란색과 무관함 — 필요하면 "전체도료"에서 LP-41을 열어
  유사도료를 직접 추가해주세요).

### 기존 데이터베이스를 이미 만들었다면

Firestore 콘솔에서 예전 컬렉션(`tamiyaMaster`, `ownedOtherBrand`, `ownedAcrylic`)은 이제 앱이
쓰지 않습니다. 그냥 둬도 무해하지만, 깔끔하게 정리하고 싶으면 Firestore 콘솔에서 그 3개
컬렉션만 삭제하면 됩니다. 앱은 새 컬렉션(`paints`/`kits`/`kitPaintLinks`)이 비어있으면 다시
"초기 데이터 불러오기" 화면을 보여줍니다.

### 아직 없는 기능

- 킷 관리에서 "📷 이미지로 등록" 버튼은 자리만 만들어두고 비활성화해뒀습니다. 설명서 도료표
  이미지를 인식해서 자동 등록하려면 AI 비전 API 연동이 추가로 필요해서, 수동입력 폼이
  안정적으로 자리잡은 뒤에 별도로 진행하는 걸 추천합니다.

---

## 4단계. Gemini API 키 발급 (킷 화면의 "이미지로 등록" 기능용)

설명서 도료표 사진을 인식하는 기능은 Google Gemini를 씁니다. 완전 무료(신용카드 등록 불필요)
지만, 발급/설정을 안 하면 이 기능만 오류가 나고 나머지 기능은 정상 동작합니다.

### 4-1. API 키 발급

1. https://aistudio.google.com/apikey 접속 → 구글 계정으로 로그인
2. **"Create API key"** 클릭 → 새 프로젝트를 만들라고 하면 그냥 기본값으로 진행
3. 생성된 키(`AIzaSy...` 형태) 복사

### 4-2. (권장) 키 사용처를 내 도메인으로 제한

이 키는 브라우저 코드에 그대로 들어가기 때문에, 배포된 사이트의 코드를 볼 줄 아는 사람이면
누구나 볼 수 있습니다. 무료 티어라 돈이 나가는 건 아니지만, 남이 내 무료 사용량을 축내는 걸
막으려면 아래처럼 도메인을 제한해두는 게 좋습니다.

1. https://console.cloud.google.com/apis/credentials 접속 (같은 구글 계정)
2. 방금 만든 API 키를 찾아서 클릭
3. **"Application restrictions"** → **"Websites"** 선택
4. `https://kimsaoo.github.io/*` 추가
5. 저장

### 4-3. 로컬 `.env`와 GitHub Secrets에 등록

- 로컬: `.env` 파일에 한 줄 추가
  ```
  VITE_GEMINI_API_KEY=발급받은키
  ```
- 배포: GitHub Secrets에도 동일하게 하나 추가
  1. Settings → Secrets and variables → Actions → New repository secret
  2. Name: `VITE_GEMINI_API_KEY`, Secret: 발급받은 키
  3. Actions 탭에서 Re-run 하거나, 새 커밋 push

---

## 5단계. 데이터 수정이 필요할 때

- 도료/보유목록/킷은 모두 앱 안에서 추가·수정·삭제됩니다 (엑셀을 다시 열 필요 없음)
- "미검증" 탭에서 아직 실제 색이 맞는지 확인 안 된 유사도료 연결을 모아볼 수 있습니다.
  Gemini 등으로 색상 확인 후 "검증완료"를 눌러주세요.

## 알고 있는 한계

- 색상 매칭(검색화면의 "추가 후보")은 텍스트 기반이며 실제 RGB/Lab 색상 비교가 아닙니다.
  참고용이지 확정이 아닙니다.
- 유사도료는 이제 직접 연결/해제하는 방식이라(v1의 코드 자동대조 방식 폐기) 정확도는
  전적으로 사람이 연결한 내용에 달려있습니다. 잘못 연결된 게 보이면 "전체도료"나
  "미검증" 탭에서 바로 끊고 다시 연결하면 됩니다.
- 이미지 인식으로 도료표를 자동 등록하는 기능은 아직 없습니다 (위 "아직 없는 기능" 참고).

## 문제가 생겼을 때

- 화면이 "불러오는 중..."에서 멈춘다 → `.env`(로컬) 또는 GitHub Secrets(배포) 값이 잘못됐을
  가능성이 높습니다. 브라우저 개발자 도구(F12) → Console 탭에서 오류 메시지를 확인해보세요.
- Firestore 규칙 화면에서 "테스트 모드 만료" 경고가 보이면 1-4의 규칙을 다시 게시해주세요.

### 실제로 겪었던 환경설정 이슈 (2026-08 기준)

**1. `npm run dev` 실행 시 `'vite'은(는) 내부 또는 외부 명령... 아닙니다`**
- 원인: `npm install`을 먼저 실행하지 않아서 `node_modules` 폴더가 없는 상태
- 해결: `paint-app` 폴더에서 `npm install` 먼저 실행 → 완료 후 `npm run dev`
- 확인 방법: `dir`(윈도우)/`ls`(맥)로 `node_modules` 폴더가 생겼는지 확인

**2. `http://localhost:5173` 접속 시 `ERR_CONNECTION_REFUSED`**
- 원인: 위 1번과 동일 (vite가 아예 안 떠서 서버가 없는 상태)
- 해결: 위 1번 해결 후, 터미널에 `Local: http://localhost:5173/` 문구가 뜬 걸 확인하고
  그 다음에 브라우저 접속

**3. `git push` 시 `error: src refspec main does not match any`**
- 원인 A: `paint-app` 폴더 "안"이 아니라 그 바깥(부모 폴더)에서 `git init`을 실행함
  → `cd paint-app`으로 들어간 후 다시 `git init`
- 원인 B: 커밋이 실제로 만들어지지 않은 상태 (아래 5번 오류 때문에 `git commit`이 조용히
  실패한 경우) → `git log --oneline`으로 커밋이 있는지 먼저 확인

**4. `git remote add origin ...` 시 `error: remote origin already exists`**
- 원인: 이전 시도에서 이미 origin이 등록되어 있음
- 해결: `git remote set-url origin <주소>` (덮어쓰기) 또는
  `git remote remove origin` 후 다시 `git remote add origin <주소>`

**5. `git commit` 시 `Please tell me who you are` / `Author identity unknown`**
- 원인: 이 컴퓨터에 Git 사용자 이름/이메일이 전역으로 설정된 적이 없음 (Windows에서 특히
  자주 발생, PC 사용자명이 `kimsa@jkkim-pc.(none)` 같은 임시값으로 잡혀서 커밋이 거부됨)
- 해결:
  ```
  git config --global user.email "본인이메일@example.com"
  git config --global user.name "본인이름"
  ```
  이후 `git commit -m "초기 커밋"` 다시 실행

**정리하면, 처음 세팅할 때 막히지 않으려면 이 순서를 지키는 게 중요합니다:**
```
cd paint-app                (반드시 이 폴더 안으로 먼저 이동)
npm install                 (vite 등 의존성 설치, node_modules 생성 확인)
git init
git config --global user.email "..."   (처음 컴퓨터에서 Git 쓰는 경우만)
git config --global user.name "..."    (처음 컴퓨터에서 Git 쓰는 경우만)
git add .
git commit -m "초기 커밋"
git branch -M main
git remote add origin https://github.com/계정명/pra-paint.git
git push -u origin main
```
