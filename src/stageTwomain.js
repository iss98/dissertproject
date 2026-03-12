import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { db } from "../firebaseConfig.js";

document.addEventListener("DOMContentLoaded", () => {
  const studentId = localStorage.getItem("studentId");
  const studentIdText = document.getElementById("studentIdText");
  const affectiveForm = document.getElementById("affectiveForm");
  const messageBox = document.getElementById("messageBox");

  if (!studentId) {
    alert("로그인 정보가 없습니다. 다시 로그인해주세요.");
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

  affectiveForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();

    const formData = new FormData(affectiveForm);

    const questions = [
      {
        question: "당신은 수학을 좋아하십니까?",
        response: formData.get("question1"),
      },
      {
        question: "당신은 AI를 좋아하십니까?",
        response: formData.get("question2"),
      },
    ];

    if (!questions[0].response || !questions[1].response) {
      showMessage("모든 문항에 응답해 주세요.", "error");
      return;
    }

    try {
      const submitButton = affectiveForm.querySelector("button[type='submit']");
      submitButton.disabled = true;

      const batch = writeBatch(db);

      questions.forEach((item) => {
        const scoreRef = doc(collection(db, "affectivescores"));

        batch.set(scoreRef, {
          studentId,
          question: item.question,
          response: Number(item.response),
          createdAt: serverTimestamp(),
          category: "prior",
        });
      });

      await batch.commit();

      const studentRef = doc(db, "students", studentId);
        await updateDoc(studentRef, {
            stage: 3,
        });

      alert("성공적으로 제출되었습니다. 다음 단계로 이동합니다.");
      window.location.href = "/stageThree.html";
    } catch (error) {
      console.error(error);
      showMessage("응답 제출 중 오류가 발생했습니다.", "error");
      const submitButton = affectiveForm.querySelector("button[type='submit']");
      submitButton.disabled = false;
    }
  });
});