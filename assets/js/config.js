/* =====================================================================
 * JuIntake V1 — runtime configuration
 * ---------------------------------------------------------------------
 * 정적 GitHub Pages 사이트이므로 빌드 과정이 없습니다.
 * 이 파일이 곧 배포 설정이며, index.html 과 admin.html 이 함께 읽습니다.
 *
 * 주의:
 *   - 아래 anon(publishable) 키는 브라우저에서 사용해도 안전한 공개 키입니다.
 *     관리자 전용(privileged) 키는 이 저장소에 존재하지 않습니다.
 *   - 관리자 토큰은 이 파일에 없습니다. admin.html 이 실행 시점에 물어보고
 *     sessionStorage 에만 보관합니다.
 *   - Supabase JS v2(브라우저 UMD) 로만 접속하며, 호출은 아래 rpc() 정의
 *     3개로 한정됩니다. 테이블을 직접 읽거나 쓰지 않습니다.
 * ===================================================================== */
(function (global) {
  'use strict';

  var SUPABASE_URL = 'https://maftfuenkiadrjwujvdu.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8DgbY_JWwyUkKGvkNBweFw_d0SZrvrW';

  /* ------------------------------------------------------------------
   * 공통 문항 (2단계)
   * ------------------------------------------------------------------ */
  var COMMON_FIELDS = [
    {
      key: 'name',
      label: '이름',
      type: 'text',
      required: true,
      placeholder: '예: 홍길동',
      help: '실명이어도 괜찮습니다. 등록하신 이름 그대로 연락드립니다.'
    },
    {
      key: 'contact',
      label: '연락처',
      type: 'text',
      required: true,
      placeholder: '예: hong@example.com 또는 카카오톡 ID',
      help: '이메일, 카카오톡 아이디, 전화번호 중 편하신 수단을 적어주세요.'
    },
    {
      key: 'title',
      label: '한 줄로 보면 무엇을 원하시나요',
      type: 'text',
      required: true,
      placeholder: '예: 회사 사내 도구에 AI를 연결하고 싶습니다',
      help: '제목 대신 한 문장으로 적어주셔도 됩니다.'
    },
    {
      key: 'usage_context',
      label: '어떤 상황에서 쓰이게 될까요',
      type: 'textarea',
      required: true,
      placeholder: '예: 혼자 개발 중인데, 배포할 때마다 막혀 반복해서 검색합니다.',
      help: '언제, 어디서, 왜 쓰는지 적어주시면 추천이 정확해집니다.'
    },
    {
      key: 'final_goal',
      label: '이 접수를 마쳤을 때 어떤 상태가 되면 좋을까요',
      type: 'textarea',
      required: true,
      placeholder: '예: 노트북만 가져가면 회사에 바로 배포할 수 있다.'
    },
    {
      key: 'ai_tools',
      label: '지금 쓰고 있는 AI 도구',
      type: 'checks',
      required: true,
      min: 1,
      options: [
        'ChatGPT',
        'Claude',
        'Gemini',
        'Cursor',
        'GitHub Copilot',
        'Claude Code',
        'Windsurf',
        '챗GPT/클로드 웹만 사용',
        '아직 없음'
      ]
    },
    {
      key: 'other_tools',
      label: '그 외에 같이 쓰는 도구',
      type: 'text',
      required: false,
      placeholder: '예: Notion, Slack, 엑셀, VS Code (여러 개는 쉼표로)',
      help: '자동화/연동 상담에 필요한 정보입니다. 없으면 비워두셔도 됩니다.'
    }
  ];

  /* ------------------------------------------------------------------
   * 유형별 문항 (3단계)
   * ------------------------------------------------------------------ */
  var REQUEST_TYPES = [
    {
      code: 'dev_ai_setup',
      label: '개발환경 구축 · AI 연동',
      icon: '🧰',
      desc: 'PC에 개발환경을 깔고 AI 도구를 붙이는 것까지',
      questions: [
        {
          key: 'os',
          label: '사용 중인 운영체제(OS)',
          type: 'select',
          required: true,
          options: ['Windows 11', 'Windows 10', 'macOS (Apple Silicon)', 'macOS (Intel)', 'Linux', '기타']
        },
        {
          key: 'coding_exp',
          label: '현재 코딩 수준',
          type: 'select',
          required: true,
          options: [
            '아직 코딩을 해본 적 없습니다',
            'HTML/CSS 로 간단한 페이지는 만들어봤습니다',
            'JavaScript 또는 Python 기초는 익숙합니다',
            '개발 경력 1~3년입니다',
            '경력 3년 이상 또는 현업 개발자입니다'
          ]
        },
        {
          key: 'pc_specs',
          label: 'PC 사양',
          type: 'text',
          required: false,
          placeholder: '예: 맥북 에어 M2 / 16GB, SSD 여유 200GB',
          help: '설치 가능한 도구가 달라지므로 CPU·메모리·여유 용량만 알려주세요.'
        },
        {
          key: 'env_wants',
          label: '이 환경에서 하고 싶은 것',
          type: 'checks',
          required: true,
          min: 1,
          options: [
            '코딩 도구(에디터/IDE) 설치와 설정',
            'Git · GitHub 연동',
            '터미널·명령어 사용에 익숙해지기',
            'Cursor · Claude Code 같은 AI 코딩 도구 연결',
            '로컬 서버와 배포 환경 만들기',
            '기존 프로젝트에 AI 붙이기',
            '그 외'
          ]
        },
        {
          key: 'ai_wants',
          label: '특히 연결하고 싶은 AI 도구',
          type: 'checks',
          required: false,
          options: [
            'ChatGPT',
            'Claude',
            'Gemini',
            'Cursor',
            'GitHub Copilot',
            'Claude Code',
            'Windsurf',
            '아직 어떤 도구가 좋은지 모릅니다'
          ]
        },
        {
          key: 'github_account',
          label: 'GitHub 사용 현황',
          type: 'select',
          required: true,
          options: [
            '계정이 없습니다',
            '계정은 있지만 거의 안 써봤습니다',
            'clone, commit 정도는 해봤습니다',
            'branch, pull request까지 익숙합니다',
            '직업으로 매일 사용 중입니다'
          ]
        },
        {
          key: 'setup_mode',
          label: '희망하는 진행 방식',
          type: 'select',
          required: true,
          options: [
            '제가 직접 따라 하며, 막히면 질문만 할게요',
            '화상으로 함께 보면서 진행하길 원해요',
            '결과물 중심이에요. 기존 설정은 바꿔도 괜찮습니다',
            '구축 뒤 유지보수까지 맡기고 싶습니다'
          ]
        },
        {
          key: 'remote_pref',
          label: '원격 지원 가능 여부',
          type: 'select',
          required: true,
          options: [
            '가능합니다 (원격 요청 드릴 수 있어요)',
            '화상·화면 공유는 가능하지만 원격은 어려워요',
            '지금은 불가능하고, 앞으로 가능해질 수 있어요'
          ]
        },
        {
          key: 'pain_point',
          label: '지금 가장 막히는 지점',
          type: 'textarea',
          required: true,
          placeholder: '예: 설치하다가 권한 오류가 나면 해결 방법을 못 찾겠습니다.'
        },
        {
          key: 'after_goal',
          label: '셋업이 끝나면 바로 무엇을 하고 싶으신가요',
          type: 'textarea',
          required: true,
          placeholder: '예: 사내 대시보드를 만들어 팀에 공유하고 싶습니다.'
        }
      ]
    },
    {
      code: 'vibe_coding',
      label: '바이브코딩 · AI로 직접 만들기',
      icon: '🛠️',
      desc: '초보도 좋습니다. AI와 함께 직접 만들어봅니다',
      questions: [
        {
          key: 'level',
          label: '지금 어느 정도까지 해봤으신가요',
          type: 'select',
          required: true,
          options: [
            '한 번도 해본 적 없습니다',
            '강의나 유튜브를 따라 해봤습니다',
            'HTML 로 간단한 페이지를 만들어봤습니다',
            'ChatGPT 로 코드 조각을 받아 붙여본 적 있습니다',
            '작은 개인 프로젝트를 끝까지 만들어봤습니다'
          ]
        },
        {
          key: 'learn_mode',
          label: '어떻게 배우고 싶으신가요',
          type: 'select',
          required: true,
          options: [
            '코드 대신 완성된 결과물 위주로 배우고 싶습니다',
            '직접 코드를 쓰면서 이해하고 싶습니다',
            'AI에게 맡기되 어디가 바뀌었는지 알고 싶습니다',
            '회사 업무에 바로 붙여 쓸 수 있게 배우고 싶습니다'
          ]
        },
        {
          key: 'first_project',
          label: '가장 먼저 만들어보고 싶은 것',
          type: 'textarea',
          required: true,
          placeholder: '예: 우리 동네 카페 메뉴·재고 관리 페이지'
        },
        {
          key: 'topics',
          label: '배우고 싶은 기술',
          type: 'checks',
          required: true,
          min: 1,
          options: [
            'HTML / CSS',
            'JavaScript',
            'React / Next.js',
            'Python',
            '데이터베이스(SQL)',
            '배포 · 호스팅',
            'Git / GitHub',
            'AI 도구 실전 활용',
            '그 외'
          ]
        },
        {
          key: 'tried_before',
          label: '이미 써본 도구',
          type: 'checks',
          required: true,
          min: 1,
          options: [
            'ChatGPT',
            'Claude',
            'Gemini',
            'Cursor',
            'GitHub Copilot',
            'Claude Code',
            '코드 없이 도구(Lovable, Bolt, v0 등)',
            '아직 직접 써본 것이 없습니다'
          ]
        },
        {
          key: 'pain_point',
          label: '지금 가장 어려운 점',
          type: 'textarea',
          required: true,
          placeholder: '예: 오류가 나면 무엇을 고쳐야 하는지 모르겠습니다.'
        },
        {
          key: 'pc_env',
          label: '사용할 PC 환경',
          type: 'select',
          required: true,
          options: [
            'Windows 노트북',
            'Windows 데스크톱',
            'MacBook (Air / Pro)',
            'iMac / 맥 스튜디오',
            '고정된 서버가 따로 있습니다',
            '이동해서 쓰는 반노트북이 있습니다'
          ]
        },
        {
          key: 'after_goal',
          label: '배운 뒤 목표는 무엇인가요',
          type: 'textarea',
          required: true,
          placeholder: '예: 개인 사이트 하나를 직접 배포하고 유지할 수 있게.'
        }
      ]
    },
    {
      code: 'outsourcing',
      label: '제작 · 외주 의뢰',
      icon: '📦',
      desc: '웹사이트, 사내 도구, 앱 만들어 드립니다',
      questions: [
        {
          key: 'product_type',
          label: '만들고 싶은 결과물',
          type: 'select',
          required: true,
          options: [
            '웹사이트 · 랜딩 페이지',
            '웹앱 · 대시보드',
            '사내 도구 · 업무 자동화',
            '모바일 앱',
            '기존 서비스 기능 개선',
            '그 외'
          ]
        },
        {
          key: 'stage',
          label: '현재 준비된 단계',
          type: 'select',
          required: true,
          options: [
            '아이디어만 있습니다',
            '기획서 · 요구사항이 있습니다',
            '디자인(목업)이 있습니다',
            '직접 만든 코드가 있습니다',
            '다른 업체와 작업 중입니다'
          ]
        },
        {
          key: 'target_users',
          label: '사용자 규모',
          type: 'select',
          required: true,
          options: [
            '나만 씁니다',
            '5명 미만',
            '5~30명',
            '30~100명',
            '100명 이상',
            '아직 모릅니다'
          ]
        },
        {
          key: 'must_have',
          label: '반드시 필요한 기능',
          type: 'checks',
          required: true,
          min: 1,
          options: [
            '로그인 · 회원가입',
            '관리자 화면',
            '결제 · 구독',
            '파일 업로드 · 저장',
            '알림 · 이메일 발송',
            '외부 API 연동',
            '데이터 통계 · 차트',
            '그 외'
          ]
        },
        {
          key: 'nice_to_have',
          label: '있으면 좋은 기능 · 아직 고민되는 것',
          type: 'textarea',
          required: false
        },
        {
          key: 'references',
          label: '참고 사이트 · 레퍼런스',
          type: 'textarea',
          required: false,
          placeholder: 'URL이나 서비스 이름으로 알려주세요. 예: notion.so, 팀원들이 쓰는 경쟁사 서비스'
        },
        {
          key: 'design_assets',
          label: '디자인 · 자료 보유 현황',
          type: 'select',
          required: true,
          options: [
            '없습니다 (전부 맡기고 싶습니다)',
            '목업만 있습니다',
            '브랜드 가이드(로고, 색상 등)가 있습니다',
            '기존에 만든 사이트·앱이 있습니다',
            '기존 저장소(코드)가 있습니다'
          ]
        },
        {
          key: 'budget',
          label: '예산 규모',
          type: 'select',
          required: true,
          options: [
            '100만 원 미만',
            '100만 ~ 300만 원',
            '300만 ~ 600만 원',
            '600만 ~ 1,000만 원',
            '1,000만 원 이상',
            '아직 정하지 못했습니다'
          ]
        },
        {
          key: 'schedule',
          label: '희망 시점',
          type: 'select',
          required: true,
          options: [
            '가능하면 빨리 (2주 이내)',
            '한 달 안에는 쓸 수 있게',
            '2~3개월 후면 괜찮습니다',
            '일정은 상관없고 결과물이 중요합니다'
          ]
        },
        {
          key: 'existing_assets',
          label: '기존에 준비된 자료',
          type: 'checks',
          required: true,
          min: 1,
          options: [
            '없습니다',
            '이메일 · 메모로 조건이 있습니다',
            '문서 · 기획서가 있습니다',
            '디자인 파일이 있습니다',
            '기존 코드 저장소가 있습니다'
          ]
        },
        {
          key: 'maintenance',
          label: '완료 후 유지보수 · 인계',
          type: 'select',
          required: true,
          options: [
            '인계만 받고 직접 관리하겠습니다',
            '일정 기간까지 유지보수를 부탁하고 싶습니다',
            '기능을 계속 추가하며 함께 관리하고 싶습니다',
            '아직 잘 모르겠습니다'
          ]
        }
      ]
    },
    {
      code: 'automation_agent',
      label: '업무 자동화 · AI Agent',
      icon: '🤖',
      desc: '매일 반복하는 일을 대신하게 만들어 봅니다',
      questions: [
        {
          key: 'repetitive_task',
          label: '매일 또는 매주 반복해서 하는 일',
          type: 'textarea',
          required: true,
          placeholder: '예: SNS 올라온 내용을 확인해서 엑셀에 옮기고 요약 메일을 씁니다.'
        },
        {
          key: 'current_flow',
          label: '지금 하는 방식',
          type: 'textarea',
          required: true,
          placeholder: '예: 엑셀을 열어 수작업으로 옮기고, 정해진 양식에 맞춰 작성합니다.'
        },
        {
          key: 'integrations',
          label: '연결해야 할 도구',
          type: 'checks',
          required: true,
          min: 1,
          options: [
            'Slack',
            'Notion',
            'Google Workspace (Gmail, Drive, Sheets)',
            '엑셀',
            '메신저 (카카오톡, Discord)',
            'SNS (인스타그램, 유튜브 등)',
            'CRM / 예약 시스템',
            '사내 시스템 · API',
            '기타'
          ]
        },
        {
          key: 'ai_actions',
          label: 'AI가 대신했으면 하는 작업',
          type: 'checks',
          required: true,
          min: 1,
          options: [
            '내용 요약 · 정리',
            '초안 작성',
            '분류 · 태그 붙이기',
            '정해진 곳에서 정보 수집',
            '알림 · 리마인드',
            '보고서 · 대시보드 만들기',
            '판단 도움 (우선순위, 추천)',
            '기타'
          ]
        },
        {
          key: 'frequency',
          label: '실행 빈도',
          type: 'select',
          required: true,
          options: [
            '하루에도 여러 번',
            '매일',
            '주 1~2회',
            '월 1~2회',
            '부정확 / 수시'
          ]
        },
        {
          key: 'run_location',
          label: '자동화가 실행될 곳',
          type: 'select',
          required: true,
          options: [
            '제 PC 에서만 실행해도 됩니다',
            '작업용 PC 가 따로 있습니다',
            '서버 · VPS 가 있습니다',
            '클라우드에서 항상 실행되어야 합니다',
            '아직 잘 모릅니다'
          ]
        },
        {
          key: 'approval_boundary',
          label: '사람의 승인 위치',
          type: 'select',
          required: true,
          options: [
            '모두 자동 실행해도 됩니다',
            '실행 전에 미리보기만 보여주면 됩니다',
            '초안까지만 자동, 전송은 제가 하고 싶습니다',
            '결정 자체는 제가 해야 합니다'
          ]
        },
        {
          key: 'data_sensitivity',
          label: '다룰 데이터의 민감도',
          type: 'checks',
          required: true,
          min: 1,
          options: [
            '개인정보 (이름, 연락처 등)',
            '결제 · 계좌 정보',
            '사내 기밀 자료',
            '공개된 정보만 다룹니다',
            '해당 사항 없음'
          ]
        }
      ]
    },
    {
      code: 'troubleshooting',
      label: '문제 해결 · 안 되는 것 진단',
      icon: '🩺',
      desc: '이미 있는 프로젝트나 환경이 안 될 때',
      questions: [
        {
          key: 'project_env',
          label: '어떤 프로젝트 · 환경인가요',
          type: 'textarea',
          required: true,
          placeholder: '예: Node.js 로 만든 사내 API 서버가 예전에 배포한 서버에서만 동작하지 않습니다.'
        },
        {
          key: 'issue',
          label: '어떤 문제가 있나요',
          type: 'textarea',
          required: true,
          placeholder: '예: 배포하면 502 가 계속 나옵니다.'
        },
        {
          key: 'expected',
          label: '원하는 결과',
          type: 'textarea',
          required: true,
          placeholder: '예: 서버를 켜면 정상적으로 응답해야 합니다.'
        },
        {
          key: 'errors',
          label: '에러 메시지 · 로그',
          type: 'textarea',
          required: false,
          placeholder: '에러를 그대로 붙여넣어 주시면 가장 빠릅니다.'
        },
        {
          key: 'recent_changes',
          label: '최근에 바꾼 것',
          type: 'textarea',
          required: false,
          placeholder: '예: 3일 전부터 nginx 설정만 바꿨습니다.'
        },
        {
          key: 'stack',
          label: '사용 중인 기술',
          type: 'checks',
          required: true,
          min: 1,
          options: [
            'HTML / CSS',
            'JavaScript',
            'React / Next.js',
            'Node.js',
            'Python',
            'Java / Spring',
            'PHP',
            '데이터베이스 (MySQL, Postgres 등)',
            'Nginx / Docker / 서버',
            'Git / GitHub',
            '그 외'
          ]
        },
        {
          key: 'links',
          label: '관련 링크',
          type: 'textarea',
          required: false,
          placeholder: '저장소, 문서, 참고 사이트 주소'
        },
        {
          key: 'remote_check',
          label: '원격으로 확인 가능한가요',
          type: 'select',
          required: true,
          options: [
            '가능합니다 (원격 요청 드릴 수 있어요)',
            '화상 · 화면 공유는 가능하지만 원격은 어려워요',
            '지금은 어렵고, 설명만으로 시도해보고 싶습니다'
          ]
        }
      ]
    },
    {
      code: 'consultation',
      label: '방향 상담 · 잘 모르겠어요',
      icon: '💬',
      desc: '뭘 해야 할지부터 같이 정리해 드립니다',
      questions: [
        {
          key: 'problem',
          label: '지금 가장 큰 고민이나 불편함',
          type: 'textarea',
          required: true,
          placeholder: '예: 바쁘다고 AI를 못 쓰고 있는데 어디서부터 시작해야 할지 모르겠습니다.'
        },
        {
          key: 'desired_change',
          label: '어떤 상태가 되면 좋을까요',
          type: 'textarea',
          required: true,
          placeholder: '예: 반복하던 보고서 작업이 30분 안에 끝나면 좋겠습니다.'
        },
        {
          key: 'directions',
          label: '지금 생각해둔 방향',
          type: 'checks',
          required: true,
          min: 1,
          options: [
            '직접 만들어 보고 싶다',
            '대신 만들어 달라고 하고 싶다',
            '개발환경부터 세팅하고 싶다',
            'AI 사용법부터 배우고 싶다',
            '반복되는 업무를 자동화하고 싶다',
            '아직 어떤 방향인지 모르겠다'
          ]
        },
        {
          key: 'pc_tools',
          label: '지금 쓰는 도구와 환경',
          type: 'text',
          required: false,
          placeholder: '예: 회사 PC(Windows), 엑셀, 노션, 카톡'
        },
        {
          key: 'examples',
          label: '참고 중인 서비스 · 자료',
          type: 'text',
          required: false,
          placeholder: '예: 클로드, 유튜브 개발 강의, 사내 공지'
        },
        {
          key: 'proposal_style',
          label: '어떤 방식의 제안을 원하시나요',
          type: 'select',
          required: true,
          options: [
            '금액과 기간이 확실한 제안을 원합니다',
            '가능한 방향만 같이 고민해보고 싶습니다',
            '작은 것부터 하나씩 시도해보고 싶습니다',
            '반년 · 1년 단위 로드맵을 원합니다',
            '우선 무료 상담부터 해보고 싶습니다'
          ]
        }
      ]
    }
  ];

  var STATUSES = [
    { code: 'NEW', label: '신규' },
    { code: 'REVIEWING', label: '검토 중' },
    { code: 'NEED_MORE_INFO', label: '추가 정보 요청' },
    { code: 'ROADMAP_READY', label: '방안 준비' },
    { code: 'ACCEPTED', label: '수락' },
    { code: 'IN_PROGRESS', label: '진행 중' },
    { code: 'DONE', label: '완료' }
  ];

  global.JUINTAKE_CONFIG = {
    appName: 'JuIntake',
    rpc: {
      submit: 'juintake_submit_request',
      adminList: 'juintake_admin_list_requests',
      adminUpdate: 'juintake_admin_update_request'
    },
    supabase: {
      url: SUPABASE_URL,
      publishableKey: SUPABASE_PUBLISHABLE_KEY
    },
    commonFields: COMMON_FIELDS,
    requestTypes: REQUEST_TYPES,
    statuses: STATUSES,
    exampleName: '홍길동',
    storageKey: 'juintake.admin.token'
  };
})(window);
