import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebaseConfig.js";

document.addEventListener("DOMContentLoaded", async () => {
  const studentId = localStorage.getItem("studentId");
  const studentIdText = document.getElementById("studentIdText");
  const reflectionForm = document.getElementById("reflectionForm");
  const reflectionInput = document.getElementById("reflectionInput");
  const backBtn = document.getElementById("backBtn");
  const messageBox = document.getElementById("messageBox");

  const CATEGORY_VALUE = 4;

  if (!studentId) {
    window.location.href = "/index.html";
    return;
  }

  studentIdText.textContent = studentId;

  function showMessage(text, type = "info") {
    messageBox.textContent = text;
    messageBox.className = `message-box ${type} show`;
  }

  function clearMessage() {
    messageBox.textContent = "";
    messageBox.className = "message-box";
  }

  function getTimestampSeconds(data) {
    return data?.createdAt?.seconds || 0;
  }

  backBtn.addEventListener("click", () => {
    window.location.href = "/div.html";
  });

  try {
    const reflectionQuery = query(
      collection(db, "srlwritings"),
      where("studentId", "==", studentId),
      where("category", "==", CATEGORY_VALUE)
    );

    const reflectionSnapshot = await getDocs(reflectionQuery);

    if (!reflectionSnapshot.empty) {
      const writings = reflectionSnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      writings.sort((a, b) => getTimestampSeconds(b) - getTimestampSeconds(a));

      const latestWriting = writings[0];
      reflectionInput.value = latestWriting.content || "";
    }
  } catch (error) {
    console.error(error);
    showMessage("이전 작성 내용을 불러오는 중 오류가 발생했습니다.", "error");
  }

  reflectionForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();

    const content = reflectionInput.value.trim();

    if (!content) {
      showMessage("학습한 내용을 입력해 주세요.", "error");
      return;
    }

    try {
      const submitBtn = reflectionForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;

      await addDoc(collection(db, "srlwritings"), {
        studentId,
        content,
        createdAt: serverTimestamp(),
        category: CATEGORY_VALUE,
      });

      window.location.href = "/div.html";
    } catch (error) {
      console.error(error);
      showMessage("정리 내용을 저장하는 중 오류가 발생했습니다.", "error");
      const submitBtn = reflectionForm.querySelector("button[type='submit']");
      submitBtn.disabled = false;
    }
  });
});