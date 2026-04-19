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
      { question: "수학 시간에는 어려운 내용이라도 좋으니까, 도전할 수 있는 문제를 배우고 싶다.", response: formData.get("question1") },
      { question: "수학 시간에는 조금 어렵더라도 호기심을 자극하는 내용을 배우고 싶다.", response: formData.get("question2") },
      { question: "수학을 배우면 논리적으로 생각하는 능력이 좋아진다.", response: formData.get("question3") },
      { question: "수학 점수를 더 잘 받기 위해서 열심히 공부할 것이다.", response: formData.get("question4") },
      { question: "나는 수학에서 좋은 성적을 받을 수 있다고 믿는다.", response: formData.get("question5") },
      { question: "나는 어려운 수학 내용도 스스로 이해할 수 있다고 믿는다.", response: formData.get("question6") },
      { question: "나는 수학에서 배우는 모든 내용을 잘 익힐 수 있다고 믿는다.", response: formData.get("question7") },
      { question: "나는 수학을 잘해서 친구들에게 설명해 줄 수 있다.", response: formData.get("question8") },
      { question: "수학 내용이 헷갈리면, 어디서부터 이해가 안 되는지 다시 살펴본다.", response: formData.get("question9") },
      { question: "수학 공부를 할 때, 스스로 목표를 세우고 계획을 따라 공부한다.", response: formData.get("question10") },
      { question: "수업이 끝난 후 헷갈렸던 부분을 다시 정리하고 이해하려고 한다.", response: formData.get("question11") },
      { question: "문제를 풀 때 먼저 관련된 공식들을 떠올린다.", response: formData.get("question12") },
      { question: "문제를 틀렸을 때, 개념을 몰라서 틀렸는지 계산 실수인지 구분한다.", response: formData.get("question13") }
    ];

    const isAllAnswered = questions.every(q => q.response);
    if (!isAllAnswered) {
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