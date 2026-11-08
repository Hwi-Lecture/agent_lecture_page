// 콘텐츠 목록. 준비가 된 단원만 status를 "open"으로 바꾼다.
window.COURSE = {
  title: "지식기반 에이전트 구축",
  description: "지식 소스를 연결해 질의응답과 업무를 수행하는 에이전트의 구성 요소와 구축 절차를 다룹니다.",
  units: [
    { id: "u01", title: "바이브 코딩으로 AI 서비스 맛보기", summary: "원하는 화면을 말로 설명하고 결과를 확인합니다.", status: "open", slides: 3, lab: true },
    { id: "u02", title: "LLM은 어떻게 답변할까?", summary: "자료 없이 질문한 답변을 기준선으로 기록합니다.", status: "open", slides: 3, lab: true },
    { id: "u03", title: "에이전트는 무엇이 다를까?", summary: "모델의 응답과 도구를 활용하는 과정을 비교합니다.", status: "open", slides: 3, lab: false },
    { id: "u04", title: "간단한 챗봇 만들기", summary: "사용자 입력부터 모델 응답 표시까지 흐름을 살펴봅니다.", status: "open", slides: 3, lab: false },
    { id: "u05", title: "시스템 프롬프트로 행동 안내하기", summary: "답변 원칙을 정하고 지시 전후를 비교합니다.", status: "open", slides: 3, lab: true },
    { id: "u06", title: "프롬프트에 실제 자료 제공하기", summary: "보도자료를 질문과 함께 제공하고 근거를 확인합니다.", status: "open", slides: 3, lab: true }
  ]
};
