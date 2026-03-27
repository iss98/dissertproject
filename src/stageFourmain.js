import {
  collection,
  getDocs,
  query,
  where,
  doc,
  writeBatch,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig.js";

document.addEventListener("DOMContentLoaded", async () => {
  const studentId = localStorage.getItem("studentId");

  const studentIdText = document.getElementById("studentIdText");
  const loadingBox = document.getElementById("loadingBox");
  const examArea = document.getElementById("examArea");
  const questionNav = document.getElementById("questionNav");
  const currentQuestionNumber = document.getElementById("currentQuestionNumber");
  const questionStem = document.getElementById("questionStem");
  const solutionInput = document.getElementById("solutionInput");
  const answerInput = document.getElementById("answerInput");
  const navButtonRow = document.getElementById("navButtonRow");
  const examDescription = document.getElementById("examDescription");
  const messageBox = document.getElementById("messageBox");

  if (!studentId) {
    alert("로그인 정보가 없습니다. 다시 로그인해주세요.");
    window.location.href = "/index.html";
    return;
  }

  studentIdText.textContent = studentId;

  let items = [];
  let currentIndex = 0;
  const responses = {};

  function showMessage(text, type = "info") {
    messageBox.textContent = text;
    messageBox.className = `message-box ${type} show`;
  }

  function clearMessage() {
    messageBox.textContent = "";
    messageBox.className = "message-box";
  }

  function saveCurrentResponse() {
    if (!items[currentIndex]) return;

    const itemId = items[currentIndex].id;
    responses[itemId] = {
      solution: solutionInput.value,
      answer: answerInput.value,
    };
  }

  function loadCurrentResponse() {
    const itemId = items[currentIndex].id;
    const saved = responses[itemId] || { solution: "", answer: "" };
    solutionInput.value = saved.solution;
    answerInput.value = saved.answer;
  }

  function buildQuestionNav() {
    questionNav.innerHTML = items
      .map((item, index) => {
        const isActive = index === currentIndex ? "active" : "";
        return `
          <button type="button" class="question-nav-btn ${isActive}" data-index="${index}">
            ${index + 1}
          </button>
        `;
      })
      .join("");

    questionNav.querySelectorAll(".question-nav-btn").forEach((button) => {
      button.addEventListener("click", () => {
        saveCurrentResponse();
        currentIndex = Number(button.dataset.index);
        renderQuestion();
      });
    });
  }

  function buildBottomNav() {
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

    navButtonRow.innerHTML = html;

    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const finalSubmitBtn = document.getElementById("finalSubmitBtn");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        saveCurrentResponse();
        currentIndex -= 1;
        renderQuestion();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        saveCurrentResponse();
        currentIndex += 1;
        renderQuestion();
      });
    }

    if (finalSubmitBtn) {
      finalSubmitBtn.addEventListener("click", submitAllResponses);
    }
  }

  async function renderMath() {
    if (window.MathJax && window.MathJax.typesetPromise) {
      await window.MathJax.typesetPromise([questionStem]);
    }
  }

  async function renderQuestion() {
    clearMessage();

    const item = items[currentIndex];
    if (!item) return;

    currentQuestionNumber.textContent = `문항 ${currentIndex + 1}`;
    questionStem.innerHTML = item.stem || "문항 내용이 없습니다.";

    loadCurrentResponse();
    buildQuestionNav();
    buildBottomNav();
    await renderMath();
  }

  async function submitAllResponses() {
    try {
        clearMessage();
        saveCurrentResponse();

        const finalSubmitBtn = document.getElementById("finalSubmitBtn");
        if (finalSubmitBtn) finalSubmitBtn.disabled = true;

        const batch = writeBatch(db);

        items.forEach((item) => {
            const saved = responses[item.id] || { solution: "", answer: "" };
            const logRef = doc(collection(db, "itemsolvelogs"));

            const studentAnswer = (saved.answer || "").trim();
            const correctAnswer = (item.answer || "").trim();

            const isCorrect = studentAnswer === correctAnswer ? 1 : 0;

            batch.set(logRef, {
                studentId,
                itemId: item.id,
                solution: saved.solution || "",
                answer: studentAnswer,
                correct: isCorrect, 
                createdAt: serverTimestamp(),
            });
        });

        await batch.commit();

        const studentRef = doc(db, "students", studentId);
        await updateDoc(studentRef, {
            stage: 5,
        });

        alert("성공적으로 제출되었습니다. 다음 단계로 이동합니다.");
        window.location.href = "/stageFive.html";
    } catch (error) {
        console.error(error);
        showMessage("최종 제출 중 오류가 발생했습니다.", "error");
    }
    }

  try {
    const itemsRef = collection(db, "items");
    const q = query(itemsRef, where("category", "==", "post"));
    const snapshot = await getDocs(q);

    items = snapshot.docs.map((itemDoc) => ({
      id: itemDoc.id,
      ...itemDoc.data(),
    }));

    items.sort((a, b) => {
      const aOrder = a.order ?? 9999;
      const bOrder = b.order ?? 9999;
      return aOrder - bOrder;
    });

    loadingBox.classList.add("hidden");

    if (items.length === 0) {
      examDescription.textContent = "사후 검사 문항이 없습니다.";
      showMessage("items 컬렉션에 category가 post인 문항이 없습니다.", "error");
      return;
    }

    examDescription.textContent = `총 ${items.length}개의 사후 검사 문항입니다.`;
    examArea.classList.remove("hidden");
    await renderQuestion();
  } catch (error) {
    console.error(error);
    loadingBox.classList.add("hidden");
    showMessage("문항을 불러오는 중 오류가 발생했습니다.", "error");
  }
});