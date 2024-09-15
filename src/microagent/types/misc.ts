import * as vscode from "vscode";

export type AgentInputType = {
  prompt: string | null; // in future change it to just string
  fileContent: string;
  fileUri?: vscode.Uri;
  // run?: () => void;
};

export type MessageType = "code" | "user" | "admin" | "test";

export interface Message {
  type: MessageType;
  content: string;
  timestamp?: Date;
}
