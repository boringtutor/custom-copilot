import * as vscode from "vscode";
import MyAgent from "./microagent/agent";
import { safeAwait } from "./microagent/helpers/helpers";
import { Message, MessageType } from "./microagent/types/misc";
import OpenAI from "openai";

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
  private _gpt_context_window = "";
  private _openai: OpenAI;

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._gpt_context_window = "";
    this._openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY, // Make sure to set this environment variable
    });
    // console.log("this._openai", this._openai);
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

    webviewView.webview.html = this._getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage((data) => {
      console.log("Received message in extension:", data);
      switch (data.type) {
        case "sendMessage":
          this._gpt_context_window += data.value;
          console.log("Updated context window:", this._gpt_context_window);
          // Add a response to the chat
          this._view?.webview.postMessage({
            type: "addMessage",
            content: {
              type: "admin",
              content: "Message received: " + data.value,
            },
          });
          break;
        case "addItem":
          this.handleAddItem();
          break;
      }
    });
  }

  private _getHtmlForWebview() {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Savy Chat</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
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
            display: flex;
            flex-direction: column;
          }
          .message {
            margin-bottom: 15px;
            border-radius: 8px;
            max-width: 80%;
            max-height: 300px; /* Set a maximum height */
            overflow-y: auto; 
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
          }
          .message > *:not(.message-header) {
            padding: 10px;
          }
          .user-message { align-self: flex-start; }
          .admin-message, .code-message, .test-message { align-self: flex-end; }
          .message-header {
            font-weight: bold;
            margin-bottom: 5px;
            color: var(--vscode-editor-foreground);
            background-color:var(--vscode-input-background) ;
            padding: 2px 5px;
            border-radius: 4px 4px 0 0;
            display: block;
          }
          .code-message pre, .test-message pre {
            padding: 10px;
            border-radius: 4px;
            
            overflow-y: auto; 
          }
          .feedback {
            display: flex;
            justify-content: flex-end;
            margin-top: 10px;
          }
          .feedback-button {
            cursor: pointer;
            margin-left: 10px;
            font-size: 1.2em;
            transition: transform 0.1s ease-in-out;
          }
          .feedback-button:hover { transform: scale(1.2); }
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
            padding: 8px;
            margin-left: 10px;
            background-color: #4a4a4a;
            color: #ffffff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s ease;
          }
          #addButton { margin-right: 8px; margin-left: 3px; }
          #sendButton:hover, #addButton:hover { background-color: #5a5a5a; }
          #sendButton svg, #addButton svg {
            width: 16px;
            height: 16px;
            fill: currentColor;
          }
          .chat-header {
            text-align: center;
            padding: 20px 0;
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
        </style>
      </head>
      <body>
        <div class="chat-container">
          <header class="chat-header">
            <h1> Welcome to MicroAgent Chat</h1>
            <p>what kind of funciton you want me to create ? </p>
            <p>You can add files to the context by clicking the + button</p>
            <p>You can Type the your function in the input field and click send</p>
          </header>

          <div id="chatArea"></div>
          <div class="input-area">
            <button id="addButton" title="Add item">
              <svg viewBox="0 0 24 24">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </button>
            <input type="text" id="messageInput" placeholder="A function which...">
            <button id="sendButton" title="Send message">
              <svg viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          const chatArea = document.getElementById('chatArea');
          const messageInput = document.getElementById('messageInput');
          const sendButton = document.getElementById('sendButton');
          const addButton = document.getElementById('addButton');

          function addMessage(message) {
            const messageElement = document.createElement('div');
            let type = message.type;
            messageElement.classList.add('message', type+'-message');

            
            let content = typeof message.content === 'object' ? message.content.content : message.content;
            
            // Always add a header
            const header = document.createElement('div');
            header.classList.add('message-header');
            header.textContent = message.type === 'code' ? 'Generated Code' : 
                                 message.type === 'test' ? 'Generated Test' : 
                                 message.type === 'user' ? 'User' : 'Assistant';
            messageElement.appendChild(header);

            if (message.type === 'code' || message.type === 'test') {
              const pre = document.createElement('pre');
              const code = document.createElement('code');
              code.textContent = content;
              pre.appendChild(code);
              messageElement.appendChild(pre);
              
              if (message.type === 'test') {
                // Add feedback buttons for test messages
                const feedbackDiv = document.createElement('div');
                feedbackDiv.classList.add('feedback');
                feedbackDiv.innerHTML = '<span class="feedback-button" title="This test looks good">👍</span><span class="feedback-button" title="This test needs improvement">👎</span>';
                messageElement.appendChild(feedbackDiv);
              }
            } else {
              const contentDiv = document.createElement('div');
              contentDiv.textContent = content;
              messageElement.appendChild(contentDiv);
            }
            
            chatArea.appendChild(messageElement);
            chatArea.scrollTop = chatArea.scrollHeight;
          }

          sendButton.addEventListener('click', () => {
            const message = messageInput.value.trim();
            if (message) {
              console.log("Sending message:", message);
              let newMessage = {
                type: 'user',
                content: message,
                timestamp: new Date(),
              };
              addMessage(newMessage);
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


          // NOTE: This is where we handle the message type that will be sent to add message
          window.addEventListener('message', event => {
            const message = event.data;
            console.log("Received message in WebView:", message);
            switch (message.type) {
              case 'addMessage':
                let mymessage = {
                  type: message.type,
                  content: message.content,
                  timestamp: new Date(),
                };
                addMessage(mymessage);
                break;
              case 'test':
                addMessage({
                  type: 'test',
                  content: message.content,
                  timestamp: new Date(),
                });
                break;
              case 'code':
                addMessage({
                  type: 'code',
                  content: message.content,
                  timestamp: new Date(),
                });
                break;
              
              case 'updateMessage':
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
        const content: string = Buffer.from(fileContent).toString("utf8");

        const fileUri = vscode.Uri.file(selectedItem.description!);
        console.log("about to call the agent");

        const loadingInterval = this.sendLoadingMessage();
        const [result, error] = await safeAwait(
          MyAgent({
            prompt:
              this._gpt_context_window === ""
                ? "A funciton that generate console log and says call the function with the request to generate test and function"
                : this._gpt_context_window,
            fileContent: content,
            fileUri: fileUri,
          })
        );
        clearInterval(loadingInterval);
        console.log("result is -> ", result);
        console.warn("error is -> ", error);
        if (error) {
          vscode.window.showErrorMessage(
            `Error Generating the test -> ${selectedItem.label}: ${error}`
          );
        } else {
          this._view?.webview.postMessage({
            type: "test",
            content: `${result}`,
          });
        }
      }
    });

    quickPick.show();
  }

  private sendLoadingMessage() {
    let dots = "";
    const interval = setInterval(() => {
      dots = dots.length < 3 ? dots + "." : "";
      this._view?.webview.postMessage({
        type: "updateMessage",
        content: `Generating the test for the function${dots} please wait`,
      });
    }, 500);
    return interval;
  }
}
