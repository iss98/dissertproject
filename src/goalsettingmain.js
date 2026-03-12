import {
  collection,
  getDocs,
  query,
  where,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebaseConfig.js";

document.addEventListener("DOMContentLoaded", async () => {
  const studentId = localStorage.getItem("studentId");

  const studentIdText = document.getElementById("studentIdText");
  const loadingBox = document.getElementById("loadingBox");
  const contentArea = document.getElementById("contentArea");
  const scoreSummary = document.getElementById("scoreSummary");
  const wrongList = document.getElementById("wrongList");
  const goalForm = document.getElementById("goalForm");
  const goalInput = document.getElementById("goalInput");
  const messageBox = document.getElementById("messageBox");

  if (!studentId) {
    window.location.href = "/index.html";
    return;
  }

  studentIdText.textContent = studentId;

  let priorItems = [];
  let studentLogs = [];

  function showMessage(text, type = "info") {
    messageBox.textContent = text;
    messageBox.className = `message-box ${type} show`;
  }

  function clearMessage() {
    messageBox.textContent = "";
    messageBox.className = "message-box";
  }

  async function renderMath() {
    if (window.MathJax && window.MathJax.typesetPromise) {
      await window.MathJax.typesetPromise([wrongList]);
    }
  }

  try {
    clearMessage();

    const itemsQuery = query(collection(db, "items"), where("category", "==", "prior"));
    const itemsSnapshot = await getDocs(itemsQuery);

    priorItems = itemsSnapshot.docs.map((itemDoc) => ({
      id: itemDoc.id,
      ...itemDoc.data(),
    }));

    priorItems.sort((a, b) => {
      const aOrder = a.order ?? 9999;
      const bOrder = b.order ?? 9999;
      return aOrder - bOrder;
    });

    const logsQuery = query(
      collection(db, "itemsolvelogs"),
      where("studentId", "==", studentId)
    );
    const logsSnapshot = await getDocs(logsQuery);

    studentLogs = logsSnapshot.docs.map((logDoc) => ({
      id: logDoc.id,
      ...logDoc.data(),
    }));

    const priorItemMap = new Map(priorItems.map((item) => [item.id, item]));
    const relatedLogs = studentLogs.filter((log) => priorItemMap.has(log.itemId));

    const totalCount = priorItems.length;
    const correctCount = relatedLogs.filter((log) => Number(log.correct) === 1).length;

    scoreSummary.textContent = `${totalCount}문제 중 ${correctCount}문제를 맞추었습니다.`;

    const wrongLogs = relatedLogs.filter((log) => Number(log.correct) !== 1);
    const wrongItems = wrongLogs
      .map((log) => priorItemMap.get(log.itemId))
      .filter(Boolean);

    if (wrongItems.length === 0) {
      wrongList.innerHTML = `<div class="wrong-empty">틀린 문제가 없습니다. 아주 잘했습니다.</div>`;
    } else {
      wrongList.innerHTML = wrongItems
        .map(
          (item, index) => `
            <div class="wrong-item">
              <div class="wrong-number">문항 ${index + 1}</div>
              <div class="wrong-stem">${item.stem || "문항 내용이 없습니다."}</div>
            </div>
          `
        )
        .join("");
    }

    loadingBox.classList.add("hidden");
    contentArea.classList.remove("hidden");
    await renderMath();
  } catch (error) {
    console.error(error);
    loadingBox.classList.add("hidden");
    showMessage("사전검사 기록을 불러오는 중 오류가 발생했습니다.", "error");
  }

  goalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();

    const content = goalInput.value.trim();

    if (!content) {
      showMessage("학습 목표를 입력해 주세요.", "error");
      return;
    }

    try {
      const submitBtn = goalForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;

      const batch = writeBatch(db);
      const writingRef = doc(collection(db, "srlwritings"));

      batch.set(writingRef, {
        studentId,
        content,
        createdAt: serverTimestamp(),
        category: "first",
      });

      await batch.commit();

      window.location.href = "/stageThree.html";
    } catch (error) {
      console.error(error);
      showMessage("목표 저장 중 오류가 발생했습니다.", "error");
      const submitBtn = goalForm.querySelector("button[type='submit']");
      submitBtn.disabled = false;
    }
  });
});