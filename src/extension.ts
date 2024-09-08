import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const provider = new ChatViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      provider
    )
  );

  const disposable = vscode.commands.registerCommand(
    "copilot.MicroAgent",
    () => {
      vscode.commands.executeCommand(
        "workbench.view.extension.micro-agent-chat"
      );
    }
  );

  context.subscriptions.push(disposable);
}

class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "micro-agent-chat";

  private _view?: vscode.WebviewView;

  // we gono use this to send it to chat gpt to get the answer
  private _gpt_context_window = "";
  constructor(private readonly _extensionUri: vscode.Uri) {
    this._gpt_context_window = "";
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case "sendMessage":
          vscode.window.showInformationMessage(
            `Received message: ${data.value}`
          );
          break;
        case "addItem":
          this.handleAddItem();
          break;
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Savy Chat</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            padding: 0;
            margin: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
          }
          .chat-container {
            display: flex;
            flex-direction: column;
            height: 100vh;
            max-width: 800px;
            margin: 0 auto;
          }
          #chatArea {
            flex-grow: 1;
            overflow-y: auto;
            padding: 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
          }
          .message {
            margin-bottom: 15px;
            padding: 10px;
            border-radius: 8px;
            max-width: 80%;
          }
          .user-message {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            align-self: flex-end;
          }
          .assistant-message {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            color: var(--vscode-editor-foreground);
            align-self: flex-start;
          }
          .input-area {
            display: flex;
            padding: 10px;
            background-color: var(--vscode-editor-background);
          }
          #messageInput {
            flex-grow: 1;
            padding: 10px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
          }
          #sendButton, #addButton {
            padding: 10px;
            margin-left: 10px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          #sendButton:hover, #addButton:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
				.chat-header {
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					padding: 20px 0;
					background-color: var(--vscode-editor-background);
					color: var(--vscode-editor-foreground);
					text-align: center;
					border-bottom: 1px solid var(--vscode-panel-border);
				}
				.chat-header h1 {
					margin: 0 0 10px;
					font-size: 1.5em;
					font-weight: 600;
				}
				.chat-header p {
					margin: 5px 0;
					font-size: 0.9em;
					opacity: 0.8;
				}
          #addButton svg {
            width: 16px;
            height: 16px;
            fill: currentColor;
          }
        </style>
      </head>
      <body>
        <div class="chat-container">
		<header class="chat-header">
			<h1> Welcome to MicroAgent Chat</h1>
			<p>Ask anything about your code</p>
			<p>You can add files to the context by clicking the + button</p>
		</header>

          <div id="chatArea"></div>
          <div class="input-area">
            <input type="text" id="messageInput" placeholder="Type your message...">
            <button id="addButton" title="Add item">
              <svg viewBox="0 0 24 24">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </button>
            <button id="sendButton">Send</button>
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          const chatArea = document.getElementById('chatArea');
          const messageInput = document.getElementById('messageInput');
          const sendButton = document.getElementById('sendButton');
          const addButton = document.getElementById('addButton');

          function addMessage(content, isUser) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');
            messageElement.classList.add(isUser ? 'user-message' : 'assistant-message');
            messageElement.textContent = content;
            chatArea.appendChild(messageElement);
            chatArea.scrollTop = chatArea.scrollHeight;
          }

          sendButton.addEventListener('click', () => {
            const message = messageInput.value.trim();
            if (message) {
              vscode.postMessage({ type: 'sendMessage', value: message });
              addMessage(message, true);
              messageInput.value = '';
            }
          });

          addButton.addEventListener('click', () => {
            vscode.postMessage({ type: 'addItem' });
          });

          messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              sendButton.click();
            }
          });

          window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
              case 'addMessage':
                addMessage(message.content, message.isUser);
                break;
            }
          });
        </script>
      </body>
      </html>
    `;
  }

  private async handleAddItem() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage(
        "No workspace folder open. Please open a folder and try again."
      );
      return;
    }

    const quickPick = vscode.window.createQuickPick();
    quickPick.placeholder = "Type to search for files";
    quickPick.items = [];

    quickPick.onDidChangeValue(async (value) => {
      if (value) {
        const files = await vscode.workspace.findFiles(
          `**/${value}*`,
          "**/{node_modules,dist}/**",
          100
        );
        quickPick.items = files.map((file) => ({
          label: vscode.workspace.asRelativePath(file),
          description: file.fsPath,
        }));
      } else {
        quickPick.items = [];
      }
    });

    quickPick.onDidAccept(async () => {
      const selectedItem = quickPick.selectedItems[0];
      if (selectedItem) {
        quickPick.hide();
        const fileContent = await vscode.workspace.fs.readFile(
          vscode.Uri.file(selectedItem.description!)
        );
        //TODO: we are going to use this content when we send the code to the llm with the question
        // we gono create the context window
        const content = Buffer.from(fileContent).toString("utf8");

        this._gpt_context_window += `\n\n${content}`;

        this._view?.webview.postMessage({
          type: "addMessage",
          content: `Added the file -> ${selectedItem.label}`,
          isUser: false,
        });
      }
    });

    quickPick.show();
  }
}
