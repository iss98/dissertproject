import {
  doc,
  getDoc,
  setDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebaseConfig"; // 경로/export 방식에 맞게 수정

const MANAGER_PASSWORD = import.meta.env.VITE_MANAGER_PASSWORD;

/**
 * DOM
 */
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");

const loginSection = document.getElementById("loginSection");
const registerSection = document.getElementById("registerSection");

const loginForm = document.getElementById("loginForm");
const createAccountsForm = document.getElementById("createAccountsForm");
const messageBox = document.getElementById("messageBox");
const previewBox = document.getElementById("previewBox");

/**
 * 탭 전환
 */
loginTab.addEventListener("click", () => switchTab("login"));
registerTab.addEventListener("click", () => switchTab("register"));

function switchTab(tabName) {
  if (tabName === "login") {
    loginTab.classList.add("active");
    registerTab.classList.remove("active");
    loginSection.classList.add("active");
    registerSection.classList.remove("active");
  } else {
    registerTab.classList.add("active");
    loginTab.classList.remove("active");
    registerSection.classList.add("active");
    loginSection.classList.remove("active");
  }
  clearMessage();
}

function showMessage(text, type = "info") {
  messageBox.textContent = text;
  messageBox.className = `message-box ${type} show`;
}

function clearMessage() {
  messageBox.textContent = "";
  messageBox.className = "message-box";
}

/**
 * 아이디 생성 규칙
 * 예:
 * 학교이니셜 KS / 1반 / 1번 -> KS0101
 * 학교이니셜 KS / 1반 / 10번 -> KS0110
 */
function pad2(num) {
  return String(num).padStart(2, "0");
}

function generateStudentId(schoolInitial, classNumber, studentNumber) {
  return `${schoolInitial.toUpperCase()}${pad2(classNumber)}${pad2(studentNumber)}`;
}

/**
 * 번호 범위 미리보기
 */
["schoolInitial", "classNumber", "startNumber", "endNumber"].forEach((id) => {
  const el = document.getElementById(id);
  el.addEventListener("input", updatePreview);
});

function updatePreview() {
  const schoolInitial = document.getElementById("schoolInitial").value.trim();
  const classNumber = Number(document.getElementById("classNumber").value);
  const startNumber = Number(document.getElementById("startNumber").value);
  const endNumber = Number(document.getElementById("endNumber").value);

  if (
    !schoolInitial ||
    !classNumber ||
    !startNumber ||
    !endNumber ||
    startNumber > endNumber
  ) {
    previewBox.innerHTML = "";
    return;
  }

  const ids = [];
  for (let i = startNumber; i <= endNumber; i++) {
    ids.push(generateStudentId(schoolInitial, classNumber, i));
  }

  const previewText = ids.slice(0, 10).join(", ");
  const extra = ids.length > 10 ? ` 외 ${ids.length - 10}명` : "";

  previewBox.innerHTML = `
    <strong>생성 예정 계정</strong><br />
    ${previewText}${extra}<br /><br />
    <strong>초기 비밀번호</strong><br />
    각 학생의 비밀번호는 자신의 아이디와 동일하게 생성됩니다.
  `;
}

/**
 * 학생 로그인
 * students 컬렉션에서 문서 ID = studentId
 * password 필드와 비교
 */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  const studentId = document.getElementById("loginId").value.trim().toUpperCase();
  const password = document.getElementById("loginPassword").value.trim();

  if (!studentId || !password) {
    showMessage("아이디와 비밀번호를 모두 입력해주세요.", "error");
    return;
  }

  try {
    const studentRef = doc(db, "students", studentId);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      showMessage("존재하지 않는 학생 계정입니다.", "error");
      return;
    }

    const studentData = studentSnap.data();

    if (studentData.password !== password) {
      showMessage("비밀번호가 올바르지 않습니다.", "error");
      return;
    }

    showMessage(`${studentId} 로그인 성공`, "success");

    // 필요하면 여기서 localStorage/sessionStorage 저장 가능
    localStorage.setItem("studentId", studentId);

    // 필요 시 페이지 이동
    const stage = Number(studentData.stage);

    if (stage === 1) {
      window.location.href = "/stageOne.html";
    } else if (stage === 2) {
      window.location.href = "/stageTwo.html";
    } else if (stage === 3) {
      window.location.href = "/stageThree.html";
    } else if (stage === 4) {
      window.location.href = "/stageFour.html";
    } else if (stage === 5) {
      window.location.href = "/stageFive.html";
    } else {
      showMessage("유효하지 않은 stage 값입니다.", "error");
    }
  } catch (error) {
    console.error(error);
    showMessage("로그인 중 오류가 발생했습니다.", "error");
  }
});

/**
 * 학생 계정 생성
 */
createAccountsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  const schoolInitial = document.getElementById("schoolInitial").value.trim().toUpperCase();
  const classNumber = Number(document.getElementById("classNumber").value);
  const startNumber = Number(document.getElementById("startNumber").value);
  const endNumber = Number(document.getElementById("endNumber").value);
  const experiment = document.querySelector('input[name="experiment"]:checked')?.value;
  const managerPassword = document.getElementById("managerPassword").value.trim();

  if (!schoolInitial || !classNumber || !startNumber || !endNumber || !managerPassword || !experiment)  {
    showMessage("모든 항목을 입력해주세요.", "error");
    return;
  }

  if (managerPassword !== MANAGER_PASSWORD) {
    showMessage("매니저 비밀번호가 올바르지 않습니다.", "error");
    return;
  }

  if (startNumber > endNumber) {
    showMessage("번호 범위가 올바르지 않습니다.", "error");
    return;
  }

  if (endNumber - startNumber > 100) {
    showMessage("한 번에 너무 많은 계정을 생성할 수 없습니다.", "error");
    return;
  }

  try {
    const batch = writeBatch(db);
    const createdIds = [];
    const skippedIds = [];

    for (let number = startNumber; number <= endNumber; number++) {
      const studentId = generateStudentId(schoolInitial, classNumber, number);
      const studentRef = doc(db, "students", studentId);
      const studentSnap = await getDoc(studentRef);

      if (studentSnap.exists()) {
        skippedIds.push(studentId);
        continue;
      }

      batch.set(studentRef, {
        id : studentId,
        password: studentId,
        school : schoolInitial,
        class: classNumber,
        studentNumber: number,
        role: "student",
        experiment: experiment,
        stage : 1,
        createdAt: serverTimestamp(),
      });

      createdIds.push(studentId);
    }

    if (createdIds.length === 0) {
      showMessage("생성할 새 계정이 없습니다. 이미 존재하는 계정일 수 있습니다.", "error");
      return;
    }

    await batch.commit();

    let message = `${createdIds.length}개의 학생 계정이 생성되었습니다.`;
    if (skippedIds.length > 0) {
      message += ` 이미 존재해서 건너뛴 계정 ${skippedIds.length}개가 있습니다.`;
    }

    showMessage(message, "success");

    createAccountsForm.reset();
    previewBox.innerHTML = "";
  } catch (error) {
    console.error(error);
    showMessage("학생 계정 생성 중 오류가 발생했습니다.", "error");
  }
});