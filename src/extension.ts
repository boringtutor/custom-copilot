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
    const scriptUri = this._view?.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "src", "chat-script.js")
    );
    const stylesUri = this._view?.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "src", "styles.css")
    );

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Chat View</title>
        <link rel="stylesheet" href="${stylesUri}">
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
          
          <script src="${scriptUri}"></script>
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
