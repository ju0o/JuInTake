# JuIntake

AI·개발·자동화 의뢰를 한 곳에서 받는 공개 접수 사이트입니다.
정적 GitHub Pages로만 동작하며 빌드 과정, 서버, AI 호출이 없습니다.

- 저장소: https://github.com/ju0o/JuIntake
- 공개 페이지: https://ju0o.github.io/JuIntake/
- 운영 화면: https://ju0o.github.io/JuIntake/admin.html

## 접수 유형 여섯 가지

| 코드 | 화면 표기 | 다루는 내용 |
| --- | --- | --- |
| `dev_ai_setup` | 개발환경 구축 · AI 연동 | PC 환경 구성, Git/GitHub, AI 코딩 도구 연결 |
| `vibe_coding` | 바이브코딩 · AI로 직접 만들기 | 비개발자의 직접 프로젝트 제작, 학습 방향 |
| `outsourcing` | 제작 · 외주 의뢰 | 웹/앱 제작, 예산·일정·인계 |
| `automation_agent` | 업무 자동화 · AI Agent | 반복 업무 자동화와 사람 승인 지점 |
| `troubleshooting` | 문제 해결 · 안 되는 것 진단 | 기존 프로젝트·환경 오류 진단 |
| `consultation` | 방향 상담 · 잘 모르겠어요 | 무엇을 해야 할지부터 정리 |

접수 폼은 4단계(유형 선택 → 기본 정보 → 상세 내용 → 확인 및 제출)로 동작합니다.
필수 항목 검증, 동의 체크, 검토 화면, 성공/오류 안내가 포함됩니다.

## 구조

```
index.html              공개 접수 폼 (4단계)
admin.html              운영 관리 화면 (토큰 입력 → 목록 → 상세 → 상태/메모 저장)
.nojekyll               GitHub Pages 가 Jekyll 처리하지 않도록 하는 빈 파일
assets/css/app.css     다크 테마 공통 스타일 (415px 모바일 대응 포함)
assets/js/config.js     Supabase 연결 정보 + 접수 유형/문항 정의 (화면 렌더의 단일 출처)
assets/js/form.js       공개 폼 로직 (검증, 검토, RPC 제출)
assets/js/admin.js      운영 화면 로직 (토큰, 상태 필터, RPC 목록/수정)
supabase/schema.sql     운영 DB 문서용 스키마/함수/권한 기준
```

`assets/js/config.js` 의 `supabase` 항목이 곧 배포 설정입니다.
anon(publishable) 키만 담고 있으며, 브라우저에서 쓰는 공개 키입니다.

브라우저는 Supabase JS v2 를 CDN(jsDelivr)에서 불러와 사용합니다.
빌드 도구와 패키지 매니페스트는 없고, 이 CDN 스크립트 하나만 외부 의존입니다.
관리자 전용(privileged) 키는 이 사이트 어디에도 없습니다.

```
index.html ─┬─ CDN: @supabase/supabase-js@2
            └─ assets/js/config.js + form.js ──▶ juintake_submit_request
admin.html ─┬─ CDN: @supabase/supabase-js@2
            └─ assets/js/config.js + admin.js ──▶ juintake_admin_list_requests
                                                └▶ juintake_admin_update_request
```

## 백엔드

접수는 Supabase RPC 한 경로로만 들어갑니다. 테이블을 직접 읽거나 쓰지 않습니다.

- 공개 폼: `juintake_submit_request(p_request_type, p_name, p_contact, p_title, p_answers)`
- 운영 목록: `juintake_admin_list_requests(p_token, p_status)`
- 운영 수정: `juintake_admin_update_request(p_token, p_id, p_status, p_admin_note)`

테이블은 `public.juintake_requests` 와 `public.juintake_admin_config` 두 개뿐이며,
`anon`/`authenticated` 에 대한 테이블 권한은 모두 회수되어 있습니다.
세 함수는 모두 `security definer` 이며, 관리자 토큰은
`extensions.digest(..., 'sha256')` 해시와 DB 내부에서 비교합니다(fail closed).

JuIntake 는 무료 활성 프로젝트 한도 때문에 **기존 `AI-Study-Group` Supabase 프로젝트를 공유**합니다.
그래서 모든 오브젝트에 `juintake_` 접두사를 쓰고,
같은 프로젝트에 있는 다른 서비스의 `public.applications` 테이블은 절대 읽거나 쓰지 않습니다.
운영 스키마는 `supabase/schema.sql` 을 참고하세요.

## 운영자 토큰

- 토큰 값은 저장소 어디에도 없습니다. `admin.html` 을 열 때 직접 입력합니다.
- 입력한 토큰은 `sessionStorage` 에만 남고 탭을 닫으면 사라집니다.
- 토큰 등록/갱신은 Supabase SQL 편집기에서 `supabase/schema.sql` 8절의 절차를 따라 직접 합니다.

## 배포

- 브랜치: `main`
- 경로: `/` (저장소 루트)
- 빌드 도구: 없음 (정적 파일 그대로, `.nojekyll` 사용)

`main` 에 푸시하면 GitHub Pages 가 그대로 배포합니다.

## 로컬 확인

```bash
python3 -m http.server 8080
# http://localhost:8080/ , http://localhost:8080/admin.html
```

`node --check assets/js/config.js` 로 문법을 확인할 수 있습니다.

## 규칙

- 관리자 토큰, `.env`, 개인 키 파일은 절대 커밋하지 않습니다.
- 운영 파일은 `main` 브랜치 루트에 둡니다.
- 새 접수 유형을 추가할 때는 `assets/js/config.js` 한 곳만 고치면 폼과 검토 화면이 함께 바뀝니다.
