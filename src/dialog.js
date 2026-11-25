export function askConfirm({ title, body, confirmLabel }) {
  const dialog = document.getElementById("confirm");
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-body").textContent = body;
  document.getElementById("confirm-ok").textContent = confirmLabel;
  dialog.returnValue = "";
  if (!dialog.open) dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => {
      const accepted = dialog.returnValue === "confirm";
      dialog.returnValue = "";
      resolve(accepted);
    }, { once: true });
  });
}

export function announce(message) {
  const live = document.getElementById("live");
  if (!live) return;
  live.textContent = "";
  window.setTimeout(() => {
    live.textContent = message;
  }, 30);
}
