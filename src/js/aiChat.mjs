// aiChat.mjs
/**
 * Initialize the AI chat widget that already exists in your HTML:
 * - #userInput
 * - #btnSendPrompt
 * - #chat-messages
 *
 * This function wires the UI (no DOM creation) and provides a safe stub reply.
 * When you integrate GPT4All or any backend, replace `generateStubReply` with real calls.
 */
export function initAIChat() {
  const input = document.getElementById("userInput");
  const btn = document.getElementById("btnSendPrompt");
  const messages = document.getElementById("chat-messages");

  if (!input || !btn || !messages) {
    console.warn("AI chat elements not found in DOM — skipping AI init.");
    return;
  }

  // Render helper (keeps chat content simple and consistent)
  function append(sender, text) {
    const div = document.createElement("div");
    div.className = "chat-line";
    div.innerHTML = `<strong>${escapeHtml(sender)}:</strong> ${escapeHtml(text)}`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  // Basic HTML escape to avoid accidental injection from user input
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Stub reply generator (replace with real GPT4All integration later)
  function generateStubReply(userText) {
    // small, friendly heuristics
    if (!userText) return "Hi — what can I help you with today?";
    const lowered = userText.toLowerCase();
    if (lowered.includes("task") || lowered.includes("errand")) {
      return "You can post a task using the 'Post a New Task / Errand' form. I can help calculate distance and cost once you post.";
    }
    if (lowered.includes("wallet") || lowered.includes("balance")) {
      return "Open the Wallet panel to deposit funds. Escrow and releases are handled automatically when tasks are accepted/completed.";
    }
    return `🤖 Got it: "${userText}". (This is a local assistant stub — GPT4All integration coming soon.)`;
  }

  // Click handler
  btn.addEventListener("click", () => {
    const text = input.value?.trim();
    if (!text) return;
    append("You", text);
    input.value = "";
    // simulate thinking
    setTimeout(() => {
      const reply = generateStubReply(text);
      append("MyPadiMan Assistant", reply);
    }, 350);
  });

  // Allow Enter to send
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      btn.click();
    }
  });

  console.log("🤖 AI Chat module initialized.");
}
