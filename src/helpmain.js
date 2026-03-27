import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  orderBy,
  limit
} from "firebase/firestore";
import { db } from "../firebaseConfig.js";
import {
  buildHelpPrompt,
  getStudentState,
  getStudentMisconception,
} from "./promptbuilders/helpPromptBuilder.js";
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
  let studentState = "";
  let studentMisconception = "";
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

  // async function getOrCreateChat(studentState, studentMisconception) {
  //   const chatQuery = query(
  //     collection(db, "chat"),
  //     where("studentId", "==", studentId),
  //     where("itemId", "==", itemId)
  //   );

  //   const chatSnapshot = await getDocs(chatQuery);

  //   if (!chatSnapshot.empty) {
  //     const chats = chatSnapshot.docs.map((docItem) => ({
  //       id: docItem.id,
  //       ...docItem.data(),
  //     }));

  //     chats.sort((a, b) => {
  //       const aSec = a.createdAt?.seconds || 0;
  //       const bSec = b.createdAt?.seconds || 0;
  //       return bSec - aSec;
  //     });

  //     return chats[0].id;
  //   }

  //   const newChatRef = await addDoc(collection(db, "chat"), {
  //     studentId,
  //     itemId,
  //     studentState,
  //     studentMisconception,
  //     createdAt: serverTimestamp(),
  //   });

  //   return newChatRef.id;
  // }

  async function findLatestChat() {
    const chatQuery = query(
      collection(db, "chat"),
      where("studentId", "==", studentId),
      where("itemId", "==", itemId),
      where("category", "==", "help")
    );

    const chatSnapshot = await getDocs(chatQuery);

    if (chatSnapshot.empty) return null;

    const chats = chatSnapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }));

    chats.sort((a, b) => {
      const aSec = a.createdAt?.seconds || 0;
      const bSec = b.createdAt?.seconds || 0;
      return bSec - aSec;
    });

    return chats[0];
  }

  async function createNewChatSession() {
    const attemptlog = await loadLatestSolveLogs();

    const [prompt, state, misconception] =
      await buildPromptForCurrentStudent(itemId, studentId, currentItemData, attemptlog);

    currentSystemPrompt = prompt;
    studentState = state;
    studentMisconception = misconception;

    const newChatRef = await addDoc(collection(db, "chat"), {
      studentId,
      itemId,
      studentState,
      studentMisconception,
      category : "help",
      createdAt: serverTimestamp(),
    });

    currentChatId = newChatRef.id;

    const initialAssistantMessage =
      "질문하기를 잘 눌렀어! 모르는 문제를 질문을 통해 풀 수 있게 되면 원하는 학습 목표를 달성할 수 있을거야:) 이 문제를 풀기 위해서는 가장 먼저 무엇을 해야할까?";

    await saveMessage(currentChatId, "assistant", initialAssistantMessage);

    localMessages = [
      {
        role: "assistant",
        content: initialAssistantMessage,
      },
    ];

    renderMessages();
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

  async function loadLatestSolveLogs() {
    const logsQuery = query(
      collection(db, "itemsolvelogs"),
      where("studentId", "==", studentId),
      orderBy("createdAt", "desc"),
      limit(30)
    );

    const logsSnapshot = await getDocs(logsQuery);

    if (logsSnapshot.empty) {
      return [];
    }

    const logs = logsSnapshot.docs.map((logDoc) => ({
      id: logDoc.id,
      ...logDoc.data(),
    }));

    return logs;
  }

  async function buildPromptForCurrentStudent(itemId, studentId, itemData, attemptLog) {
    const studentState = await getStudentState(itemData, attemptLog);
    const studentMisconception = await getStudentMisconception(attemptLog);

    const itemtype = itemData.type || "";
    const itemstem = itemData.stem || "";
    const itemsolution = itemData.solution || "";
    const itemanswer = itemData.answer || "";
    const itemcognitiveAttribute = itemData.cognitiveAttribute || "";
    const itemitemAnalysis = itemData.itemAnalysis || "";

    const prompt = await buildHelpPrompt({
      studentState,
      studentMisconception,
      itemstem,
      itemsolution,
      itemanswer,
      itemcognitiveAttribute,
      itemitemAnalysis,
      itemId,
      itemtype,
      studentId
    });

    return [prompt, studentState, studentMisconception];
  }

  async function requestAssistantResponse() {
    const input = convertToOpenAIInput(currentSystemPrompt, localMessages);

    // console.log("=== OpenAI Input ===");
    // console.log(JSON.stringify(input, null, 2));
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

  // try {
  //   if (!itemId) {
  //     throw new Error("문항 정보가 없습니다.");
  //   }

  //   // 처음에는 챗봇 생성 안내만 보이게
  //   loadingBox.textContent = "챗봇을 만드는 중입니다. 잠시만 기다려주세요.";

  //   const itemRef = doc(db, "items", itemId);
  //   const itemSnap = await getDoc(itemRef);

  //   if (!itemSnap.exists()) {
  //     throw new Error("문항을 찾을 수 없습니다.");
  //   }

  //   //
  //   const attemptlog = await loadLatestSolveLogs();

  //   currentItemData = itemSnap.data();
  //   questionStem.innerHTML = currentItemData.stem || "문항 내용이 없습니다.";

  //   // 프롬프트 생성
  //   [currentSystemPrompt, studentState, studentMisconception] = await buildPromptForCurrentStudent(currentItemData, attemptlog);

  //   // 채팅 세션 준비
  //   currentChatId = await getOrCreateChat(studentState, studentMisconception);

  //   const loadedMessages = await loadMessages(currentChatId);
  //   localMessages = loadedMessages.map((msg) => ({
  //     role: msg.role,
  //     content: msg.content,
  //   }));

  //   // 처음 입장한 세션이면 AI 첫 발화 저장
  //   if (localMessages.length === 0) {
  //     const initialAssistantMessage =
  //       "질문하기를 잘 눌렀어! 모르는 문제를 질문을 통해 풀 수 있게 되면 원하는 학습 목표를 달성할 수 있을거야:) 그러면 일단 질문하는 문제에서 구하고자 하는 것과 문제를 풀기 위한 방법을 한 번 분석해볼까?";

  //     await saveMessage(currentChatId, "assistant", initialAssistantMessage);
  //     localMessages.push({
  //       role: "assistant",
  //       content: initialAssistantMessage,
  //     });
  //   }

  //   loadingBox.classList.add("hidden");
  //   contentArea.classList.remove("hidden");
  //   renderMessages();
  //   await renderMath();
  // } catch (error) {
  //   console.error(error);
  //   loadingBox.classList.add("hidden");
  //   showMessage(error.message || "챗봇을 준비하는 중 오류가 발생했습니다.", "error");
  // }

  try {
    if (!itemId) {
      throw new Error("문항 정보가 없습니다.");
    }

    loadingBox.textContent = "챗봇을 준비하는 중입니다. 잠시만 기다려주세요.";

    const itemRef = doc(db, "items", itemId);
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      throw new Error("문항을 찾을 수 없습니다.");
    }

    currentItemData = itemSnap.data();
    questionStem.innerHTML = currentItemData.stem || "문항 내용이 없습니다.";

    const existingChat = await findLatestChat();

    if (existingChat) {
      currentChatId = existingChat.id;
      currentSystemPrompt = existingChat.systemPrompt || "";

      const loadedMessages = await loadMessages(currentChatId);
      localMessages = loadedMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      document.getElementById("sessionNotice").classList.remove("hidden");
      chatInput.disabled = true;
      sendBtn.disabled = true;
    } else {
      await createNewChatSession();

      document.getElementById("sessionNotice").classList.add("hidden");
      chatInput.disabled = false;
      sendBtn.disabled = false;
    }

    loadingBox.classList.add("hidden");
    contentArea.classList.remove("hidden");
    renderMessages();
    await renderMath();
  } catch (error) {
    console.error(error);
    loadingBox.classList.add("hidden");
    showMessage(error.message || "챗봇을 준비하는 중 오류가 발생했습니다.", "error");
  }

  document
  .getElementById("recreateSessionBtn")
  .addEventListener("click", async () => {
    loadingBox.classList.remove("hidden");
    loadingBox.textContent = "새로운 질문 세션을 만드는 중입니다.";

    await createNewChatSession();

    chatInput.disabled = false;
    sendBtn.disabled = false;

    document.getElementById("sessionNotice").classList.add("hidden");

    loadingBox.classList.add("hidden");
  });

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