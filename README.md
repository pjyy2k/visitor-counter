# Visitor Counter

여러 정적 사이트에서 함께 사용하는 Cloudflare Worker + D1 방문자 카운터입니다.
사이트마다 스크립트 한 줄을 삽입하면 됩니다. 별도 프런트엔드 서버는 필요하지 않습니다.

## 집계 기준

- `todayViews`: 오늘 스크립트가 실행된 페이지 조회수. 새로고침도 포함합니다.
- `todayVisitors`: 오늘 해당 사이트에 방문한 브라우저 수. localStorage UUID로 중복을 제거합니다.
- `totalViews`: 전체 페이지 조회수.
- `totalVisitorDays`: 일별 방문자 수의 누계. 같은 브라우저가 다음 날 방문하면 다시 1명으로 계산합니다. 전체 기간의 고유 인원수가 아닙니다.
- 날짜는 기본 `Asia/Seoul` 기준입니다. 사이트별 데이터는 독립적입니다.
- IP, User-Agent, 방문 URL은 저장하지 않습니다. 방문자 UUID는 매일 정리하며 집계 결과는 유지합니다.
- 저장소 삭제, 시크릿 모드, 다른 기기는 별도 방문자로 계산됩니다. localStorage가 차단되면 새로고침도 새 방문자로 계산될 수 있습니다.

## 배포

Node.js 22 이상과 Cloudflare 계정이 필요합니다. 테스트는 `node:sqlite`를 제공하는 Node.js 22.13 이상을 사용합니다.

```sh
npx wrangler login
npx wrangler d1 create visitor-counter
```

출력된 `database_id`로 `wrangler.jsonc`의 `REPLACE_WITH_D1_DATABASE_ID`를 교체합니다.
`SITES`에는 실제 사이트 식별자와 허용 Origin을 등록합니다. 아래 도메인은 예시이므로 실제 주소로 수정하세요.

```json
{
  "6nimmt": ["https://6nimmt.hellojyp.com"],
  "map-for-ppt": ["https://map.example.com", "https://www.map.example.com"]
}
```

Origin에는 경로와 끝의 `/`를 넣지 않습니다. 한 사이트에 여러 도메인을 등록하면 집계는 공유되지만 localStorage는 도메인별로 분리됩니다.

```sh
npm run db:remote
npm run deploy
```

Cloudflare Git 연동 시 빌드 명령은 필요하지 않습니다. 배포 명령은 `npx wrangler deploy`입니다.
원격 마이그레이션은 최초 배포 전에 적용하세요. D1 바인딩 이름은 반드시 `DB`로 설정합니다.
Workers 대시보드에서 커스텀 도메인을 연결할 수도 있습니다.

## 정적 사이트에 삽입

Worker의 실제 주소로 `src`를 바꾸고 각 사이트에 고유한 `data-site`를 지정합니다.
표시 영역을 먼저 선언하고 아래 스크립트를 한 번만 삽입하세요.

```html
<small data-visitor-counter aria-live="polite">—</small>
<script defer src="https://visitor-counter.YOUR-SUBDOMAIN.workers.dev/counter.js"
        data-site="6nimmt"></script>
```

기본 표시는 `Today 12 · Total 345`입니다. 다른 표시 영역은 `data-target="#counter"`로 지정합니다.
숫자를 직접 표시하려면 아래 이벤트를 스크립트보다 먼저 등록하세요.

```html
<script>
document.addEventListener('visitor-counter:loaded', ({ detail }) => {
  console.log(detail.todayVisitors, detail.totalViews);
});
</script>
```

CSP를 사용하는 사이트는 `script-src`, `connect-src`에 Worker Origin을 허용해야 합니다.
SPA는 최초 로드만 집계합니다. 클라이언트 라우팅마다 자동으로 조회수를 추가하지 않습니다.

## API

모든 집계 API에는 등록된 `Origin` 헤더가 필요합니다.

| 요청 | 동작 |
|---|---|
| `GET /counter.js` | 삽입용 스크립트 |
| `GET /health` | 프로세스 응답 확인. DB 연결 검사는 아님 |
| `POST /v1/count?site=6nimmt` | 조회수 증가 및 일별 방문자 중복 제거 후 집계 반환 |
| `GET /v1/count?site=6nimmt` | 집계 조회만 수행 |

POST 본문: `{"visitor":"00000000-0000-4000-8000-000000000001"}` (UUID v4).
`Content-Type: application/json`을 사용하며 본문은 최대 1 KiB입니다.

## 로컬 확인

```sh
npm test
npm run db:local
npm run dev
```

로컬 사이트를 시험하려면 해당 Origin(예: `http://localhost:8080`)을 `SITES`에 추가합니다.
테스트는 실제 SQLite 스키마/트리거 및 Worker 요청 처리를 확인합니다. Cloudflare 런타임 통합 테스트를 대체하지는 않습니다.

## 운영 특성

- D1의 원자적 batch와 UNIQUE 기본키로 동시 요청의 중복 집계를 방지합니다. 응답 집계는 다른 동시 방문까지 포함할 수 있습니다.
- POST 한 번에 집계 upsert 두 개, 방문자 삽입 한 개, 집계 SELECT 한 개를 실행합니다. 새 방문자는 트리거로 집계 두 행을 추가 갱신합니다. HTTP preflight, 스크립트 요청, 정리 작업도 Worker 사용량에 포함됩니다.
- D1 rows read/write는 요청 횟수와 같지 않으며 실제 실행 계획과 인덱스 갱신에 따라 달라집니다.
- Origin 허용 목록은 브라우저의 무단 삽입을 제한하지만 인증 수단은 아닙니다. 외부 프로그램은 Origin과 UUID를 위조할 수 있어 통계 조작을 완전히 막지 못합니다. 필요한 경우 Cloudflare WAF/rate limiting 규칙을 적용하세요.
- 방문자 ID는 보안 토큰이 아니며, 공개 정적 페이지에 비밀 API 키를 넣지 않습니다.
- 봇 필터링, 전체 기간 고유 방문자, 관리자 UI는 포함하지 않습니다.
- 일별 방문자 ID 정리는 매일 UTC 18:17(KST 다음 날 03:17)에 수행합니다. 일별/전체 집계는 삭제하지 않습니다.

배포 후 허용/비허용 Origin, 같은 브라우저 새로고침, 다른 브라우저 방문, 사이트 간 분리 동작을 실제 도메인에서 확인하세요.
