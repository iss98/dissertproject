import {
  addDoc,
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebaseConfig.js";

document.addEventListener("DOMContentLoaded", async () => {
  const studentId = localStorage.getItem("studentId");

  const studentIdText = document.getElementById("studentIdText");
  const loadingBox = document.getElementById("loadingBox");
  const examArea = document.getElementById("examArea");
  const questionNav = document.getElementById("questionNav");
  const currentQuestionNumber = document.getElementById("currentQuestionNumber");
  const questionStatusBadge = document.getElementById("questionStatusBadge");
  const questionStem = document.getElementById("questionStem");
  const solutionInput = document.getElementById("solutionInput");
  const answerInput = document.getElementById("answerInput");
  const examDescription = document.getElementById("examDescription");
  const messageBox = document.getElementById("messageBox");
  const backBtn = document.getElementById("backBtn");
  const askBtn = document.getElementById("askBtn");
  const mathToolbar = document.getElementById("mathToolbar");
  const solutionPreview = document.getElementById("solutionPreview");;


  function insertAtCursor(textarea, text, cursorPosition = null) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const original = textarea.value;

    textarea.value =
      original.substring(0, start) +
      text +
      original.substring(end);

    const newPos = cursorPosition ?? start + text.length;
    textarea.focus();
    textarea.setSelectionRange(newPos, newPos);

    updateSolutionPreview();
  }

  async function updateSolutionPreview() {
    const value = solutionInput.value.trim();

    if (!value) {
      solutionPreview.textContent = "입력한 수식이 여기에 보입니다.";
      return;
    }

    solutionPreview.innerHTML = `\\(${value}\\)`;

    if (window.MathJax && window.MathJax.typesetPromise) {
      try {
        await window.MathJax.typesetPromise([solutionPreview]);
      } catch (error) {
        solutionPreview.textContent = value;
      }
    }
  }

  function handleMathInsert(insertValue) {
    const start = solutionInput.selectionStart;

    if (insertValue === "\\frac{}{}") {
      insertAtCursor(solutionInput, "\\frac{}{}", start + 6);
      return;
    }

    if (insertValue === "()") {
      insertAtCursor(solutionInput, "()", start + 1);
      return;
    }

    insertAtCursor(solutionInput, insertValue);
  }

  if (mathToolbar) {
    mathToolbar.querySelectorAll(".math-tool-btn").forEach((button) => {
      button.addEventListener("click", () => {
        handleMathInsert(button.dataset.insert);
      });
    });
  }

  solutionInput.addEventListener("input", updateSolutionPreview);

  if (!studentId) {
    window.location.href = "/index.html";
    return;
  }

  studentIdText.textContent = studentId;

  let items = [];
  let currentIndex = 0;
  let experimentValue = "";

  const latestLogsByItemId = {};

  function showMessage(text, type = "info") {
    messageBox.textContent = text;
    messageBox.className = `message-box ${type} show`;
  }

  function clearMessage() {
    messageBox.textContent = "";
    messageBox.className = "message-box";
  }

  function parseMathAnswer(raw) {
    if (!raw) return NaN;

    const text = String(raw).trim().replace(/[()]/g, "");

    if (text.includes("/")) {
      const parts = text.split("/");
      if (parts.length === 2) {
        const num = Number(parts[0]);
        const den = Number(parts[1]);
        if (!isNaN(num) && !isNaN(den) && den !== 0) {
          return num / den;
        }
      }
    }

    const value = Number(text);
    if (!isNaN(value)) return value;

    return NaN;
  }

  function computeCorrect(studentAnswerRaw, correctAnswerRaw) {
    const studentValue = parseMathAnswer(studentAnswerRaw);
    const correctValue = parseMathAnswer(correctAnswerRaw);

    if (!isNaN(studentValue) && !isNaN(correctValue)) {
      return studentValue === correctValue ? 1 : 0;
    }

    return String(studentAnswerRaw || "").trim() === String(correctAnswerRaw || "").trim() ? 1 : 0;
  }

  function getTimestampSeconds(data) {
    return data?.createdAt?.seconds || 0;
  }

  function getCurrentItem() {
    return items[currentIndex];
  }

  function loadLatestResponseIntoInputs() {
    const item = getCurrentItem();
    if (!item) return;

    const latestLog = latestLogsByItemId[item.id];

    solutionInput.value = latestLog?.solution || "";
    answerInput.value = latestLog?.answer || "";
  }

  function updateStatusBadge() {
    const item = getCurrentItem();
    if (!item) return;

    const latestLog = latestLogsByItemId[item.id];

    if (!latestLog) {
      questionStatusBadge.textContent = "";
      questionStatusBadge.className = "question-status-badge hidden";
      return;
    }

    if (Number(latestLog.correct) === 1) {
      questionStatusBadge.textContent = "맞춘 문제";
      questionStatusBadge.className = "question-status-badge correct-badge";
    } else {
      questionStatusBadge.textContent = "틀린 문제";
      questionStatusBadge.className = "question-status-badge wrong-badge";
    }
  }

  function buildQuestionNav() {
    questionNav.innerHTML = items
      .map((item, index) => {
        const isActive = index === currentIndex ? "active" : "";
        const latestLog = latestLogsByItemId[item.id];

        let statusClass = "";
        if (latestLog) {
          statusClass = Number(latestLog.correct) === 1 ? "correct-nav" : "wrong-nav";
        }

        return `
          <button type="button" class="question-nav-btn ${isActive} ${statusClass}" data-index="${index}">
            ${index + 1}
          </button>
        `;
      })
      .join("");

    questionNav.querySelectorAll(".question-nav-btn").forEach((button) => {
      button.addEventListener("click", () => {
        currentIndex = Number(button.dataset.index);
        renderQuestion();
      });
    });
  }

  function buildBottomNav() {
    const arrowRow = document.getElementById("arrowRow");

    const isFirst = currentIndex === 0;
    const isLast = currentIndex === items.length - 1;

    let html = "";

    if (!isFirst) {
      html += `
        <button type="button" class="nav-btn secondary-btn" id="prevBtn">
          ← 이전
        </button>
      `;
    }

    if (!isLast) {
      html += `
        <button type="button" class="nav-btn primary-btn" id="nextBtn">
          다음 →
        </button>
      `;
    }

    arrowRow.innerHTML = html;

    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const submitBtn = document.getElementById("submitBtn");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        currentIndex -= 1;
        renderQuestion();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        currentIndex += 1;
        renderQuestion();
      });
    }

    if (submitBtn) {
      submitBtn.onclick = submitCurrentQuestion;
    }
  }

  async function renderMath() {
    if (window.MathJax && window.MathJax.typesetPromise) {
      await window.MathJax.typesetPromise([questionStem]);
    }
  }

  async function renderQuestion() {
    clearMessage();

    const item = getCurrentItem();
    if (!item) return;

    currentQuestionNumber.textContent = `문항 ${currentIndex + 1}`;
    questionStem.innerHTML = item.stem || "문항 내용이 없습니다.";

    loadLatestResponseIntoInputs();
    updateStatusBadge();
    buildQuestionNav();
    buildBottomNav();
    await renderMath();
  }

  async function submitCurrentQuestion() {
    const item = getCurrentItem();
    if (!item) return;

    const solution = solutionInput.value || "";
    const answer = answerInput.value || "";
    const correct = computeCorrect(answer, item.answer || "");

    try {
      clearMessage();

      const submitBtn = document.getElementById("submitBtn");
      if (submitBtn) submitBtn.disabled = true;

      await addDoc(collection(db, "itemsolvelogs"), {
        answer,
        createdAt: serverTimestamp(),
        itemId: item.id,
        solution,
        studentId,
        correct,
      });

      latestLogsByItemId[item.id] = {
        answer,
        solution,
        studentId,
        itemId: item.id,
        correct,
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
      };

      if (correct === 1) {
        showMessage("정답입니다!", "success");
      } else {
        showMessage("아쉽게 틀렸어요ㅠㅠ", "error");
      }

      updateStatusBadge();
      buildQuestionNav();
    } catch (error) {
      console.error(error);
      showMessage("문제 제출 중 오류가 발생했습니다.", "error");
    } finally {
      const submitBtn = document.getElementById("submitBtn");
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function goToQuestionPage() {
    const item = getCurrentItem();
    if (!item) return;

    try {
      if (!experimentValue) {
        const studentRef = doc(db, "students", studentId);
        const studentSnap = await getDoc(studentRef);

        if (!studentSnap.exists()) {
          showMessage("학생 정보를 찾을 수 없습니다.", "error");
          return;
        }

        experimentValue = studentSnap.data().experiment || "";
      }

      const returnTo = encodeURIComponent("/mulitem.html");
      const itemId = encodeURIComponent(item.id);

      if (experimentValue === "help") {
        window.location.href = `/help.html?itemId=${itemId}&returnTo=${returnTo}`;
      } else if (experimentValue === "nohelp") {
        window.location.href = `/nhelp.html?itemId=${itemId}&returnTo=${returnTo}`;
      } else {
        showMessage("실험 그룹 정보가 올바르지 않습니다.", "error");
      }
    } catch (error) {
      console.error(error);
      showMessage("질문 페이지로 이동하는 중 오류가 발생했습니다.", "error");
    }
  }

  backBtn?.addEventListener("click", () => {
    window.location.href = "/mul.html";
  });

  askBtn?.addEventListener("click", goToQuestionPage);

  try {
    const studentRef = doc(db, "students", studentId);
    const studentSnap = await getDoc(studentRef);
    if (studentSnap.exists()) {
      experimentValue = studentSnap.data().experiment || "";
    }

    const itemsRef = collection(db, "items");
    const itemsQuery = query(
      itemsRef,
      where("category", "==", "main"),
      where("lecture", "==", 3)
    );
    const itemsSnapshot = await getDocs(itemsQuery);

    items = itemsSnapshot.docs.map((itemDoc) => ({
      id: itemDoc.id,
      ...itemDoc.data(),
    }));

    items.sort((a, b) => {
      const aOrder = a.order ?? 9999;
      const bOrder = b.order ?? 9999;
      return aOrder - bOrder;
    });

    const logsQuery = query(
      collection(db, "itemsolvelogs"),
      where("studentId", "==", studentId)
    );
    const logsSnapshot = await getDocs(logsQuery);

    const allLogs = logsSnapshot.docs.map((logDoc) => ({
      id: logDoc.id,
      ...logDoc.data(),
    }));

    const itemIdSet = new Set(items.map((item) => item.id));
    const relatedLogs = allLogs.filter((log) => itemIdSet.has(log.itemId));

    relatedLogs.forEach((log) => {
      const prev = latestLogsByItemId[log.itemId];
      if (!prev || getTimestampSeconds(log) > getTimestampSeconds(prev)) {
        latestLogsByItemId[log.itemId] = log;
      }
    });

    loadingBox.classList.add("hidden");

    if (items.length === 0) {
      examDescription.textContent = "문항이 없습니다.";
      showMessage("items 컬렉션에 category가 main이고 lecture가 3인 문항이 없습니다.", "error");
      return;
    }

    examDescription.textContent = `총 ${items.length}개의 문항입니다.`;
    examArea.classList.remove("hidden");
    await renderQuestion();
  } catch (error) {
    console.error(error);
    loadingBox.classList.add("hidden");
    showMessage("문항을 불러오는 중 오류가 발생했습니다.", "error");
  }
});