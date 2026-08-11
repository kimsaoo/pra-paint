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
5. 화면에 나오는 `firebaseConfig` 객체를 확인합니다. 아래처럼 생겼습니다:
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
6. 이 6개 값을 압축 파일의 `.env.example`을 복사한 `.env` 파일에 채워 넣습니다.
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

## 데이터 수정이 필요할 때

- 도료/보유목록/킷은 모두 앱 안에서 추가·수정·삭제됩니다 (엑셀을 다시 열 필요 없음)
- "미검증" 탭에서 MIG/AK 색상 코드가 아직 실제 색과 맞는지 확인되지 않은 항목들을 모아볼 수
  있습니다. Gemini 등으로 색상 확인 후 코드를 수정하고 "검증완료"를 눌러주세요.

## 알고 있는 한계 (인수인계 문서와 동일)

- 색상 매칭은 텍스트/코드 기반이며 실제 RGB/Lab 색상 비교가 아닙니다. "유사색"은 참고용입니다.
- 브랜드별 유사색 보유 판정은 원본 엑셀의 "문자열 전체 일치" 대신 **코드만 비교**하도록
  바꿨습니다(이름 표기가 브랜드마다 달라 문자열 완전일치가 오히려 부정확했음). 대신 코드는
  같은데 이름(색상)이 명백히 다른 경우는 걸러내지 못할 수 있어, 그런 사례는 발견 즉시
  `src/lib/seedData.js`의 `MANUAL_OVERRIDES`에 개별 보정을 추가하는 방식으로 관리합니다.
  (실제로 LP-41의 MIG-0048 오추천을 이 방식으로 수정한 사례가 있습니다.)

## 문제가 생겼을 때

- 화면이 "불러오는 중..."에서 멈춘다 → `.env`(로컬) 또는 GitHub Secrets(배포) 값이 잘못됐을
  가능성이 높습니다. 브라우저 개발자 도구(F12) → Console 탭에서 오류 메시지를 확인해보세요.
- Firestore 규칙 화면에서 "테스트 모드 만료" 경고가 보이면 1-4의 규칙을 다시 게시해주세요.
