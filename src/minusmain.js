document.addEventListener("DOMContentLoaded", () => {
  const studentId = localStorage.getItem("studentId");
  const studentIdText = document.getElementById("studentIdText");
  const messageBox = document.getElementById("messageBox");
  const menuButtons = document.querySelectorAll(".menu-btn");

  if (!studentId) {
    window.location.href = "/index.html";
    return;
  }

  studentIdText.textContent = studentId;

  function showMessage(text, type = "info") {
    messageBox.textContent = text;
    messageBox.className = `message-box ${type} show`;
  }

  menuButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.target;

      if (!target) {
        showMessage("연결된 페이지가 없습니다.", "error");
        return;
      }

      window.location.href = target;
    });
  });
});