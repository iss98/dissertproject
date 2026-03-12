import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebaseConfig.js";

document.addEventListener("DOMContentLoaded", async () => {
  const studentId = localStorage.getItem("studentId");
  const studentIdText = document.getElementById("studentIdText");
  const messageBox = document.getElementById("messageBox");
  const menuButtons = document.querySelectorAll(".menu-btn");
  const goalSettingBtn = document.getElementById("goalSettingBtn");
  const goalDisplayCard = document.getElementById("goalDisplayCard");
  const goalDisplayText = document.getElementById("goalDisplayText");

  if (!studentId) {
    window.location.href = "/index.html";
    return;
  }

  studentIdText.textContent = studentId;

  function showMessage(text, type = "info") {
    messageBox.textContent = text;
    messageBox.className = `message-box ${type} show`;
  }

  try {
    const writingsQuery = query(
      collection(db, "srlwritings"),
      where("studentId", "==", studentId),
      where("category", "==", "first")
    );

    const writingsSnapshot = await getDocs(writingsQuery);
    const writings = writingsSnapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }));

    if (writings.length > 0) {
      const latestWriting = writings[0];
      goalDisplayText.textContent = latestWriting.content || "";
      goalDisplayCard.classList.remove("hidden");

      if (goalSettingBtn) {
        goalSettingBtn.disabled = true;
        goalSettingBtn.classList.add("disabled-btn");
      }
    }
  } catch (error) {
    console.error(error);
    showMessage("목표 정보를 불러오는 중 오류가 발생했습니다.", "error");
  }

  menuButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;

      const target = button.dataset.target;

      if (!target) {
        showMessage("연결된 페이지가 없습니다.", "error");
        return;
      }

      window.location.href = target;
    });
  });
});