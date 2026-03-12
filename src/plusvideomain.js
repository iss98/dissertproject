import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebaseConfig.js";

document.addEventListener("DOMContentLoaded", async () => {
  const studentId = localStorage.getItem("studentId");
  const studentIdText = document.getElementById("studentIdText");
  const summaryForm = document.getElementById("summaryForm");
  const summaryInput = document.getElementById("summaryInput");
  const backBtn = document.getElementById("backBtn");
  const messageBox = document.getElementById("messageBox");

  const LECTURE_NUMBER = 1;

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

  backBtn.addEventListener("click", () => {
    window.location.href = "/plus.html";
  });

  try {
    const summaryQuery = query(
      collection(db, "lecturesummaries"),
      where("studentId", "==", studentId),
      where("lecture", "==", LECTURE_NUMBER),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const summarySnapshot = await getDocs(summaryQuery);

    if (!summarySnapshot.empty) {
      const latestSummary = summarySnapshot.docs[0].data();
      summaryInput.value = latestSummary.content || "";
    }
  } catch (error) {
    console.error(error);
    showMessage("이전 요약을 불러오는 중 오류가 발생했습니다.", "error");
  }

  summaryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();

    const content = summaryInput.value.trim();

    if (!content) {
      showMessage("강의 요약을 입력해 주세요.", "error");
      return;
    }

    try {
      const submitBtn = summaryForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;

      await addDoc(collection(db, "lecturesummaries"), {
        studentId,
        lecture: LECTURE_NUMBER,
        content,
        createdAt: serverTimestamp(),
      });

      window.location.href = "/plus.html";
    } catch (error) {
      console.error(error);
      showMessage("요약 제출 중 오류가 발생했습니다.", "error");
      const submitBtn = summaryForm.querySelector("button[type='submit']");
      submitBtn.disabled = false;
    }
  });
});