import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebaseConfig.js";
import { fetchHelpResponse } from "./services/openaiService.js";

document.addEventListener("DOMContentLoaded", async () => {
  const studentId = localStorage.getItem("studentId");
  const params = new URLSearchParams(window.location.search);
  const itemId = params.get("itemId");
  const returnTo = params.get("returnTo") || "/plusitem.html";

  const loadingBox = document.getElementById("loadingBox");
  const contentArea = document.getElementById("contentArea");
  const questionStem = document.getElementById("questionStem");
  const chatMessages = document.getElementById("chatMessages");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const backBtn = document.getElementById("backBtn");
  const messageBox = document.getElementById("messageBox");

  let currentChatId = null;
  let currentSystemPrompt = "";
  let currentItemData = null;
  let localMessages = [];

  if (!studentId) {
    window.location.href = "/index.html";
    return;
  }

  function showMessage(text, type = "info") {
    messageBox.textContent = text;
    messageBox.className = `message-box ${type} show`;
  }

  function clearMessage() {
    messageBox.textContent = "";
    messageBox.className = "message-box";
  }

  function escapeHtml(text = "") {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderMessages() {
    chatMessages.innerHTML = localMessages
      .map((msg) => {
        const isUser = msg.role === "user";
        return `
          <div class="chat-bubble-row ${isUser ? "user-row" : "assistant-row"}">
            <div class="chat-bubble ${isUser ? "user-bubble" : "assistant-bubble"}">
              <div class="chat-role">${isUser ? "나" : "AI"}</div>
              <div class="chat-content">${escapeHtml(msg.content).replace(/\n/g, "<br>")}</div>
            </div>
          </div>
        `;
      })
      .join("");

    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function renderMath() {
    if (window.MathJax && window.MathJax.typesetPromise) {
      await window.MathJax.typesetPromise([questionStem]);
    }
  }

  async function getOrCreateChat() {
    const chatQuery = query(
      collection(db, "chat"),
      where("studentId", "==", studentId),
      where("category", "==", "shelp"),
      where("itemId", "==", itemId)
    );

    const chatSnapshot = await getDocs(chatQuery);

    if (!chatSnapshot.empty) {
      const chats = chatSnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      chats.sort((a, b) => {
        const aSec = a.createdAt?.seconds || 0;
        const bSec = b.createdAt?.seconds || 0;
        return bSec - aSec;
      });

      return chats[0].id;
    }

    const newChatRef = await addDoc(collection(db, "chat"), {
      studentId,
      itemId,
      category : "shelp",
      createdAt: serverTimestamp(),
    });

    return newChatRef.id;
  }

  async function loadMessages(chatId) {
    const messagesRef = collection(db, "chat", chatId, "messages");
    const snapshot = await getDocs(messagesRef);

    const messages = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }));

    messages.sort((a, b) => {
      const aSec = a.createdAt?.seconds || 0;
      const bSec = b.createdAt?.seconds || 0;
      return aSec - bSec;
    });

    return messages;
  }

  async function saveMessage(chatId, role, content) {
    await addDoc(collection(db, "chat", chatId, "messages"), {
      role,
      content,
      createdAt: serverTimestamp(),
    });
  }

  function convertToOpenAIInput(systemPrompt, messages) {
    const input = [
      {
        role: "system",
        content: systemPrompt,
      },
    ];

    messages.forEach((msg) => {
      input.push({
        role: msg.role,
        content: msg.content,
      });
    });

    return input;
  }

  async function loadLatestSolveLog() {
    const logsQuery = query(
      collection(db, "itemsolvelogs"),
      where("studentId", "==", studentId),
      where("itemId", "==", itemId)
    );

    const logsSnapshot = await getDocs(logsQuery);

    if (logsSnapshot.empty) {
      return null;
    }

    const logs = logsSnapshot.docs.map((logDoc) => ({
      id: logDoc.id,
      ...logDoc.data(),
    }));

    logs.sort((a, b) => {
      const aSec = a.createdAt?.seconds || 0;
      const bSec = b.createdAt?.seconds || 0;
      return bSec - aSec;
    });

    return logs[0];
  }

  async function buildPromptForCurrentStudent(itemData) {
    const itemstem = itemData.stem || "";
    const itemsolution = itemData.solution || "";
    const itemanswer = itemData.answer || "";
    const itemcognitiveAttribute = itemData.cognitiveAttribute || "";

    const prompt = `
    당신은 지침을 엄격하게 준수해야 합니다. 당신의 역할은 튜터로써 학생의 질문하기(Help-seeking) 과정을 지원하는 것입니다. 당신은 세 단계를 바탕으로 질문하기 과정을 지원하면 됩니다. 질문하기, 답변 평가하기, 학습에 답변 반영하기. 세 가지 단계에 해야할 일은 아래에 적혀있습니다. 각 단계가 완료되었다고 생각된다면 다음 단계로 넘어가면 됩니다. 답변은 무조건 한 문장 이내로 짧게 해야합니다.

    1. 질문하기 
    학생이 질문을 하면 질문에 대한 답을 주면 됩니다. 질문에 대한 답은 메타인지 질문의 형태가 아닌 정보 전달의 형태로 전하면 됩니다.
    이때 [문제 정보]를 바탕으로 학생이 질문한 내용에 대한 답변을 하되, 답변에 문제에 대한 직접적인 정답을 포함하면 안됩니다. 

    2. 답변 평가하기
    답변 평가하기 단계의 목표는 학생이 질문하기 단계에서 받은 답변의 이해도를 평가하는 것입니다. 
    질문하기 단계가 끝난 이후 "나의 답변이 잘 이해됬니?"와 같이 메타인지 질문을 통해 학생이 답변에 대한 이해도를 평가하도록 유도합니다.
    학생이 질문하기 단계에서 받은 답변에 대한 이해도가 낮다고 판단되면 학생이 질문하기 단계로 돌아가서 추가적인 질문을 하도록 유도하면 됩니다. 

    3. 학습에 답변 반영하기
    학습에 답변 반영하기 단계의 목표는 학생이 질문하기 단계에서 받은 답변에 대한 이해도를 바탕으로 학습을 이어나가는 것입니다. 
    답변 평가하기 단계가 끝난 이후 "이해가 됐다니 다행이야. 그러면 새로 알게된 내용을 바탕으로 어떻게 공부를 하면 좋을까?"와 같이 메타인지 질문을 통해 학생이 질문하기 단계에서 받은 답변에 대한 이해도를 바탕으로 다음 학습을 계획하도록 유도합니다.
    학생이 이후 학습 과정을 설계했다면 "좋은 계획이야! 이렇게 공부를 계속하다보면 너의 학습 목표 달성이 금방 될 것 같아:) 언제든지 궁금한게 있으면 물어봐"와 같이 학생에게 긍정적인 피드백을 주면서 질문하기 과정을 끝내면 됩니다.

    질문하기 과정에서 학생이 수학 자기 효능감과 흥미를 높일 수 있도록 "잘하고 있어", "좋은 질문이야"와 같은 정서적 지원을 해주면 됩니다.
    또한 예시 메타인지 질문의 경우 학생의 답변과 상황에 맞추어 적절히 변형하여 사용하면 됩니다.
    
    [문제 정보]
    <stem>
    ${itemstem}
    <solution>
    ${itemsolution}
    <answer>
    ${itemanswer}
    <필요한 인지 요소> 
    ${itemcognitiveAttribute}
    `
    return prompt;
  }

  async function requestAssistantResponse() {
    const input = convertToOpenAIInput(currentSystemPrompt, localMessages);

    console.log("=== OpenAI Input ===");
    console.log(JSON.stringify(input, null, 2));
    const response = await fetchHelpResponse({ input });

    const outputText =
      response.output_text ||
      response.output
        ?.map((item) => {
          if (!item.content) return "";
          return item.content
            .map((contentItem) => contentItem.text || "")
            .join("");
        })
        .join("\n") ||
      "응답을 불러오지 못했습니다.";

    return outputText;
  }

  backBtn?.addEventListener("click", () => {
    window.location.href = returnTo;
  });

  try {
    if (!itemId) {
      throw new Error("문항 정보가 없습니다.");
    }

    // 처음에는 챗봇 생성 안내만 보이게
    loadingBox.textContent = "챗봇을 만드는 중입니다. 잠시만 기다려주세요.";

    const itemRef = doc(db, "items", itemId);
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      throw new Error("문항을 찾을 수 없습니다.");
    }

    currentItemData = itemSnap.data();
    questionStem.innerHTML = currentItemData.stem || "문항 내용이 없습니다.";

    // 프롬프트 생성
    currentSystemPrompt = await buildPromptForCurrentStudent(currentItemData);

    // 채팅 세션 준비
    currentChatId = await getOrCreateChat();

    const loadedMessages = await loadMessages(currentChatId);
    localMessages = loadedMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // // 처음 입장한 세션이면 AI 첫 발화 저장
    // if (localMessages.length === 0) {
    //   const initialAssistantMessage =
    //     "질문하기를 잘 눌렀어! 모르는 문제를 질문을 통해 풀 수 있게 되면 원하는 학습 목표를 달성할 수 있을거야:) 그러면 일단 질문하는 문제에서 구하고자 하는 것과 문제를 풀기 위한 방법을 한 번 분석해볼까?";

    //   await saveMessage(currentChatId, "assistant", initialAssistantMessage);
    //   localMessages.push({
    //     role: "assistant",
    //     content: initialAssistantMessage,
    //   });
    // }

    loadingBox.classList.add("hidden");
    contentArea.classList.remove("hidden");
    renderMessages();
    await renderMath();
  } catch (error) {
    console.error(error);
    loadingBox.classList.add("hidden");
    showMessage(error.message || "챗봇을 준비하는 중 오류가 발생했습니다.", "error");
  }

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();

    const userText = chatInput.value.trim();
    if (!userText || !currentChatId) return;

    try {
      sendBtn.disabled = true;
      chatInput.disabled = true;

      await saveMessage(currentChatId, "user", userText);
      localMessages.push({
        role: "user",
        content: userText,
      });
      renderMessages();
      chatInput.value = "";

      const assistantText = await requestAssistantResponse();

      await saveMessage(currentChatId, "assistant", assistantText);
      localMessages.push({
        role: "assistant",
        content: assistantText,
      });
      renderMessages();
    } catch (error) {
      console.error(error);
      showMessage("AI 응답을 불러오는 중 오류가 발생했습니다.", "error");
    } finally {
      sendBtn.disabled = false;
      chatInput.disabled = false;
      chatInput.focus();
    }
  });
});