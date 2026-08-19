# 제네시스 해방 계산기

메이플스토리 제네시스 무기 해방 예상일을 현재 퀘스트 단계, 보유 흔적, 제네시스 패스, 보스 난이도와 파티 인원에 따라 계산하는 정적 웹 앱입니다.

## 주요 기능

- 매주 같은 계획을 반복하는 간단 모드
- 주차마다 보스 구성을 바꾸는 상세 모드
- 주간 목요일 및 월간 초기화, 패스 만료, 파티 분배 내림 계산
- PC 우선 반응형 UI와 브라우저 로컬 저장
- GitHub Pages 자동 배포

## 로컬 실행

```bash
npm ci
npm run dev
```

검증은 `npm run typecheck`, `npm test`, `npm run build`, `npm run test:sites`로 수행합니다.

## 라이선스와 고지

소스 코드는 [MIT License](LICENSE)로 배포됩니다. 번들된 메이플스토리 서체와 생성 이미지, 오픈소스 의존성에 관한 조건 및 출처는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 확인하세요.

이 프로젝트는 넥슨이 제공하거나 보증하는 공식 서비스가 아닌 팬 제작 계산기입니다.
