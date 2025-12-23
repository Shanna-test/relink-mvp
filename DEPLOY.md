# 배포 가이드

## 🚀 Vercel 배포 (추천 - 가장 간단)

### 1단계: GitHub에 코드 푸시
```bash
# Git 초기화 (아직 안 했다면)
git init
git add .
git commit -m "Initial commit"

# GitHub 저장소 생성 후
git remote add origin https://github.com/your-username/relink-mvp.git
git push -u origin main
```

### 2단계: Vercel 배포
1. [Vercel](https://vercel.com) 접속
2. "Sign Up" → GitHub 계정으로 로그인
3. "Add New Project" 클릭
4. GitHub 저장소 선택
5. 프로젝트 설정:
   - **Framework Preset**: Next.js (자동 감지)
   - **Root Directory**: `./` (기본값)
   - **Build Command**: `npm run build` (자동)
   - **Output Directory**: `.next` (자동)
6. **Environment Variables** 추가:
   - `OPENAI_API_KEY` = `sk-...` (실제 API 키 입력)
7. "Deploy" 클릭

### 3단계: 배포 완료
- 약 2-3분 후 배포 완료
- 자동으로 `https://your-project.vercel.app` URL 생성
- 코드 푸시 시 자동 재배포 (GitHub 연동)

---

## 🔧 다른 배포 옵션

### Netlify 배포
1. [Netlify](https://www.netlify.com) 접속
2. GitHub 저장소 연결
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
4. Environment variables에 `OPENAI_API_KEY` 추가

### 자체 서버 배포 (VPS)
```bash
# 서버에서
git clone https://github.com/your-username/relink-mvp.git
cd relink-mvp
npm install
npm run build

# 환경 변수 설정
echo "OPENAI_API_KEY=sk-..." > .env.local

# PM2로 실행 (선택사항)
npm install -g pm2
pm2 start npm --name "relink-mvp" -- start
```

---

## ⚠️ 중요 체크리스트

배포 전 확인:
- [ ] `.env.local` 파일이 `.gitignore`에 포함되어 있는지 확인
- [ ] `OPENAI_API_KEY`가 환경 변수로 설정되어 있는지 확인
- [ ] `npm run build`가 로컬에서 성공하는지 확인
- [ ] 모든 기능이 정상 작동하는지 테스트

---

## 🔐 환경 변수 설정 (Vercel)

Vercel 대시보드에서:
1. 프로젝트 선택
2. Settings → Environment Variables
3. 다음 변수 추가:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: 실제 OpenAI API 키
   - **Environment**: Production, Preview, Development 모두 선택
4. Save 후 재배포

---

## 📝 배포 후 확인

1. 배포된 URL 접속
2. 홈 화면이 정상 표시되는지 확인
3. 마음 번역기 기능 테스트
4. API 호출이 정상 작동하는지 확인

---

## 🐛 문제 해결

### 빌드 실패
- `npm run build` 로컬에서 실행하여 오류 확인
- TypeScript 오류 수정
- 의존성 설치 확인

### API 키 오류
- Vercel 환경 변수에 올바른 키가 설정되었는지 확인
- 재배포 필요할 수 있음

### 404 오류
- Next.js App Router 경로 확인
- `next.config.ts` 설정 확인

