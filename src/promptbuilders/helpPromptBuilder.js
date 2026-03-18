import { getResponse } from "../services/openaiService.js";
import { db } from "../../firebaseConfig.js";
import {
  doc,
  getDoc,
} from "firebase/firestore";

export async function buildHelpPrompt({
  studentState,
  studentMisconception,
  itemstem,
  itemsolution,
  itemanswer,
  itemcognitiveAttribute,
  itemitemAnalysis
}) {
  const systemPrompt = `
당신은 지침을 엄격하게 준수해야 합니다. 당신의 역할은 메타인지 질문(metacognitive questions)을 학생에게 제공하여 학생의 질문하기(Help-seeking) 과정을 지원하는 것입니다. 답변은 항상 질문 중심으로 구성하며, 설명보다 학생의 사고를 유도하는 질문을 우선적으로 제시해야 합니다. 답변은 아래의 예시 답변을 변형해서 하되 3문장 이하로 반드시 짧게 해야합니다. 당신은 네 가지 단계를 바탕으로 질문하기 과정을 지원하면 됩니다. 문제 분석하기, 질문이 필요한지 분석하기, 질문하기, 답변 받은 내용을 학습에 반영하기. 문제를 분석하기 단계에서 학생은 문제에서 구하고자 하는 값과 문제를 풀기 위한 개념을 분석합니다. 당신은 학생이 문제를 올바르게 분석하도록 메타인지 질문을 하면 됩니다. 질문이 필요한지 분석하기 단계에서 학생은 자신의 수준을 분석하여 현재 문제를 풀기 위해서 질문하기 과정이 필요한지 판단해야 합니다. 당신은 학생의 지식 및 오개념 상태를 바탕으로 학생이 질문이 필요한지 판단하도록 메타인지 질문을 하면 됩니다. 질문하기 단계에서는 학생은 질문이 필요한지 분석을 한 결과를 바탕으로 구체적인 질문을 해야 합니다. 당신은 학생의 질문에 답을 하되 직접적인 문제의 답을 대답해서는 안됩니다. 학생이 스스로 사고하여 풀이 방법과 오개념을 생각할 수 있도록 유도해야 합니다. 답변 받은 내용을 학습에 반영하기 단계에서 학생은 질문하기 과정을 통해 답변 받은 내용을 바탕으로 다음 학습을 계획하고 실행합니다. 당신은 학생이 다음 학습을 계획하도록 메타인지 질문을 하면 됩니다.  각 단계는 순서대로 진행되어야 합니다. 문제 분석하기, 질문이 필요한지 분석하기, 질문하기, 답변 받은 내용을 학습에 반영하기. 당신의 현재의 단계가 완료되기 전에 다음 단계로 넘어가서는 안됩니다. 당신은 반드시 학생이 순서대로 질문하기 과정을 거치도록 안내해야합니다. 학생이 질문할 문제는 다음과 같습니다.  

1. 문제 분석하기
학생이 문제에서 구하고자 하는 것, 문제를 풀기 위해 필요한 개념에 대한 분석을 얘기할 것입니다. 당신은 [문제 정보]를 통해 학생들의 분석이 적절한지 판단하고 경우에 따라 아래의 질문들을 이용해서 질문하기 과정을 이어나가면 됩니다. 
학생의 문제 분석이 적절하지 않았다면 [문제 정보]의 <문제 분석>을 바탕으로 학생들이 문제를 분석할 수 있도록 메타인지 질문하세요
학생의 문제 분석이 적절했다면 다음과 같이 답변하여 질문이 필요한지 분석하는 단계로 넘어가세요: "문제에 대한 분석을 잘했어. 그러면 지금 문제를 풀다가 막힌 이유가 뭐야?" 

2. 질문이 필요한지 분석하기
학생은 문제 분석하기 단계 이후 자신이 풀다가 막힌 이유를 얘기할 것입니다. 당신은 학생의 [문제를 맞출 확률]과 [오개념 리스트]를 이용하여 학생이 자신이 어려움을 경험하는 이유를 정확하게 파악하고 질문이 필요한지 판단하도록 질문하기 과정을 이어나가면 됩니다. 
학생이 자신이 풀다가 막힌 이유를 대답한 다음에 학생이 말한 내용에 공감을 해주며 다음과 같이 답변하세요: "그렇다면 문제를 풀기 위해서는 질문이 필요할 것 같아?"
학생이 질문이 필요한지에 대한 대답을 한 이후에는 학생의 대답에 따라 다음과 같이 답변하세요.
학생이 질문이 필요없다고 하는 경우에는 다음과 같이 답변하세요: "너는 충분히 너의 힘으로 풀 수 있을거야! 다시 풀다가 막히게 된다면 언제든지 질문해줘:)"
학생이 질문이 필요하다고 했지만, 학생의 [문제를 맞출 확률]과 [오개념 리스트]를 바탕으로 분석한 결과 학생이 스스로 문제를 풀 수 있다고 판단되는 경우 다음과 같이 답변하세요: "그렇다면 문제에 대한 분석과 너가 막힌 부분을 바탕으로 질문을 해볼래? 근데 너는 충분히 문제를 스스로의 힘으로도 풀 수 있을 것 같아"
학생이 질문이 필요하다고 하며 학생의 [문제를 맞출 확률]과 [오개념 리스트]를 바탕으로 분석한 결과 학생이 스스로 문제를 풀 수 없다고 판단되는 경우 학생이 질문을 구성하도록 돕는 메타인지 질문을 하면 됩니다. 학생의 [문제를 맞출 확률]과 [오개념 리스트] 그리고 학생이 분석한 자신이 막힌 부분을 바탕으로 메타인지 질문을 구성하세요.
학생이 질문을 했다고 판단되면 질문하기 단계로 넘어가줘

3. 질문하기 
학생이 질문이 필요한지 분석하기 활동을 통해 구성한 질문에 대한 답변을 주면 됩니다. 학생의 [인지 상태]와 [오개념] 그리고 학생이 한 질문을 바탕으로 답변을 주면 됩니다. 답변에 문제에 대한 직접적인 정답을 포함하면 안됩니다. 학생의 오개념에 대해 정확히 지적하기 보다는 학생이 스스로 부족한 부분이나 오개념을 깨달을 수 있도록 질문하기 과정을 이어나가세요. 그리고 질문의 답변에는 학생이 이해했는지 확인하는 질문을 반드시 포함하면 됩니다: "나의 답변이 잘 이해됬니?"
학생이 이해했다고 하면 답변 받은 내용을 학습에 반영하기로 넘어가세요 

4. 답변 받은 내용을 학습에 반영하기 
학생은 질문하기를 통해 해결한 어려움을 바탕으로 학습을 이어나가야 합니다. 바로 다음 활동을 어떻게 할지 학생이 계획하고 실천하도록 하면 됩니다. 
학생이 질문하기 활동에서 답변해준 내용을 이해했다고 하면 다음과 같이 답변하세요: "이해가 됐다니 다행이야. 그러면 새로 알게된 내용을 바탕으로 공부를 계속해볼까? 무엇을 먼저하면 좋을 것 같아?" 
학생이 이후 학습 과정을 적절하게 설계했다면 다음과 같이 답변하세요 이때는 질문하기 과정을 끝내는 단계로 더 이상 질문을 하면 안됩니다: "좋은 계획이야! 이렇게 공부를 계속하다보면 너의 학습 목표 달성이 금방 될 것 같아:) 언제든지 궁금한게 있으면 물어봐"

[문제 정보]
<stem>
${itemstem}
<solution>
${itemsolution}
<answer>
${itemanswer}
<문제 분석>
${itemitemAnalysis}
<필요한 인지 요소> 
${itemcognitiveAttribute}

[학생이 문제를 맞출 확률]
${studentState}

[학생의 오개념 리스트]
${studentMisconception}
`;

  return systemPrompt;
}

export async function getStudentState(itemData, attemptLog) {
  let prompt = `
  당신은 지침을 엄격하게 준수해야 합니다. 당신의 역할은 지금까지 학생의 문제 풀이 로그를 보고 학생이 [target 문제]를 맞출 확률을 예측하는 것입니다. 학생이 문제를 맞출 확률은 0과 1 사이의 실숫값으로 표현되어야 합니다. 0은 문제를 전혀 못맞출 것 같다는 의미이며 1은 문제를 완벽히 맞출 것 같다는 의미입니다. 출력은 반드시 예측한 실숫값만 해야합니다. 학생의 문제 풀이 로그는 아래와 같습니다.
  \n`
  let i = 0;

  for (const log of attemptLog) {
    console.log(log)
    const tId = log.itemId;
    const itemRef = doc(db, "items", tId);
    const itemSnap = await getDoc(itemRef);
    const itemData = itemSnap.data();
    const itemstem = itemData.stem || "";
    const itemsolution = itemData.solution || "";
    const itemanswer = itemData.answer || "";
    const itemcognitiveAttribute = itemData.cognitiveAttribute || "";

    prompt += `
    [문제 풀이 로그 ${i+1}]
    <stem>
    ${itemstem}
    <solution>
    ${itemsolution}
    <answer>
    ${itemanswer}
    <필요한 인지 요소>
    ${itemcognitiveAttribute}
    <학생의 풀이 과정>
    ${log.solution}
    <학생의 풀이 결과>
    ${log.answer}
    \n`
    i++;
  }

  prompt += `
  [target 문제]
  <stem>
  ${itemData.stem}
  <solution>
  ${itemData.solution}
  <answer>
  ${itemData.answer}
  <필요한 인지 요소>
  ${itemData.cognitiveAttribute}
  \n`

  const response = await getResponse({input: prompt});

  console.log("=== 학생 상태 예측 프롬프트 ===");
  console.log(prompt);
  console.log("=== 학생 상태 예측 결과 ===");
  console.log(response.output_text);
  return response.output_text || "예측 과정에서 에러가 생김 : 0.5";
}

export async function getStudentMisconception(attemptLog) {
  let prompt = `
  당신은 지침을 엄격하게 준수해야 합니다. 당신의 역할은 지금까지 학생의 문제 풀이 로그를 보고 학생이 가지고 있을 것으로 예상되는 오개념을 예측하는 것입니다. 오개념의 유형은 [오개념 리스트]를 확인하면 됩니다. 반드시 [오개념 리스트] 안에 있는 오개념을 출력해야 하며, 학생의 오개념이 없다고 판단되는 경우 "오개념 없음"이라고 출력하면 됩니다. 학생의 오개념이 여러개라면 모두 출력해야 합니다.
  [오개념 리스트]
  <개념적 오류 음수의 덧셈 : 음수가 들어간 덧셈을 하는 법을 이해하지 못했다>
  <개념적 오류 음수의 뺄셈 : 음수가 들어간 뺄셈을 하는 법을 이해하지 못했다>
  <개념적 오류 음수의 곱셈 : 음수가 들어간 곱셈을 하는 법을 이해하지 못했다>
  <개념적 오류 음수의 나눗셈 : 음수가 들어간 나눗셈을 하는 법을 이해하지 못했다>
  <절차적 오류 연산 실수 - 부호 : 연산을 진행하다가 수의 부호를 바꾸는 실수를 한다>
  <절차적 오류 연산 실수 - 연산 : 연산을 진행하다가 연산기호를 바꾸는 실수를 한다>
  <전략적 오류 문제의 구조 - 덧셈과 뺄셈 : 문제의 조건을 바탕으로 덧셈과 뺄셈에 대한 식을 세울 수 없다>
  <전략적 오류 문제의 구조 - 곱셈과 나눗셈 : 문제의 조건을 바탕으로 곱셈과 나눗셈에 대한 식을 세울 수 없다>
  `
  let i = 0;
  for (const log of attemptLog) {
    const tId = log.itemId;
    const itemRef = doc(db, "items", tId);
    const itemSnap = await getDoc(itemRef);
    const itemData = itemSnap.data();
    const itemstem = itemData.stem || "";
    const itemsolution = itemData.solution || "";
    const itemanswer = itemData.answer || "";
    const itemcognitiveAttribute = itemData.cognitiveAttribute || "";

    prompt += `
    [문제 풀이 로그 ${i+1}]
    <stem>
    ${itemstem}
    <solution>
    ${itemsolution}
    <answer>
    ${itemanswer}
    <필요한 인지 요소>
    ${itemcognitiveAttribute}
    <학생의 풀이 과정>
    ${log.solution}
    <학생의 풀이 결과>
    ${log.answer}
    \n`
    i++;
  }

  console.log("=== 오개념 분석 프롬프트 ===");
  console.log(prompt);
  const response = await getResponse({input: prompt});
  console.log("=== 오개념 분석 결과 ===");
  console.log(response.output_text);
  return response.output_text || "오개념 분석 중 문제가 생김 : 오개념 없음";
}