document.addEventListener("DOMContentLoaded", () => {
  const vscode = acquireVsCodeApi();
  const chatArea = document.getElementById("chatArea");
  const messageInput = document.getElementById("messageInput");
  const sendButton = document.getElementById("sendButton");
  const addButton = document.getElementById("addButton");

  function addMessage(message) {
    const messageElement = document.createElement("div");
    let type = message.type;
    messageElement.classList.add("message", type + "-message");

    let content =
      typeof message.content === "object"
        ? message.content.content
        : message.content;

    // Always add a header
    const header = document.createElement("div");
    header.classList.add("message-header");
    header.textContent =
      message.type === "code"
        ? "Generated Code"
        : message.type === "test"
        ? "Generated Test"
        : message.type === "user"
        ? "User"
        : "Assistant";
    messageElement.appendChild(header);

    if (message.type === "code" || message.type === "test") {
      const codeContainer = document.createElement("div");
      codeContainer.classList.add("code-container");

      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = content;
      pre.appendChild(code);
      codeContainer.appendChild(pre);
      messageElement.appendChild(codeContainer);

      if (message.type === "test") {
        // Add feedback buttons for test messages
        const feedbackDiv = document.createElement("div");
        feedbackDiv.classList.add("feedback");
        feedbackDiv.innerHTML =
          '<span class="feedback-button" title="This test looks good">👍</span><span class="feedback-button" title="This test needs improvement">👎</span>';
        messageElement.appendChild(feedbackDiv);
      }
    } else {
      const contentDiv = document.createElement("div");
      contentDiv.textContent = content;
      messageElement.appendChild(contentDiv);
    }

    chatArea.appendChild(messageElement);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  sendButton.addEventListener("click", () => {
    const message = messageInput.value.trim();
    if (message) {
      console.log("Sending message:", message);
      let newMessage = {
        type: "user",
        content: message,
        timestamp: new Date(),
      };
      addMessage(newMessage);
      messageInput.value = "";
    }
  });

  addButton.addEventListener("click", () => {
    vscode.postMessage({ type: "addItem" });
  });

  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendButton.click();
    }
  });

  // NOTE: This is where we handle the message type that will be sent to add message
  window.addEventListener("message", (event) => {
    const message = event.data;
    console.log("Received message in WebView:", message);
    switch (message.type) {
      case "addMessage":
        let mymessage = {
          type: message.type,
          content: message.content,
          timestamp: new Date(),
        };
        addMessage(mymessage);
        break;
      case "test":
        addMessage({
          type: "test",
          content: message.content,
          timestamp: new Date(),
        });
        break;
      case "code":
        addMessage({
          type: "code",
          content: message.content,
          timestamp: new Date(),
        });
        break;

      case "updateMessage":
        updateLastMessage(message.content);
        break;
    }
  });

  function updateLastMessage(content) {
    const lastMessage = chatArea.lastElementChild;
    if (lastMessage) {
      lastMessage.textContent = content;
    }
  }
});
