/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { JenkinsIndicatorGroup } from "./JenkinsIndicatorGroup";
import { SettingsProvider } from "./SettingsProvider";
import { registerWhatsNew } from "./whats-new/commands";

export async function activate(context: vscode.ExtensionContext) {
    const settingsProvider = new SettingsProvider(buildEventSet(context.subscriptions));
    context.subscriptions.push(settingsProvider);

    const indicatorGroup = new JenkinsIndicatorGroup(settingsProvider);
    context.subscriptions.push(indicatorGroup);

    if (await settingsProvider.isJenkinsEnabled()) {
        settingsProvider.reload();
    }

    await registerWhatsNew(context);
}


function buildEventSet(subscriptions: vscode.Disposable[]): { [name: string]: vscode.Event<unknown> } {
    const eventSet: { [name: string]: vscode.Event<unknown> } = {};

    // Workspace changes
    eventSet["onDidChangeWorkspaceFolders"] = vscode.workspace.onDidChangeWorkspaceFolders;
    eventSet["onDidGrantWorkspaceTrust"]    = vscode.workspace.onDidGrantWorkspaceTrust;

    // When Jenkins setting files change
    if (vscode.workspace.workspaceFolders) {
        vscode.workspace.workspaceFolders.forEach(folder => {
            const fileSystemWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, "*.{jenkins,jenkins.js}"));
            subscriptions.push(fileSystemWatcher);
            eventSet["onDidChange"] = fileSystemWatcher.onDidChange;
            eventSet["onDidCreate"] = fileSystemWatcher.onDidCreate;
            eventSet["onDidDelete"] = fileSystemWatcher.onDidDelete;
        });
    }

    // Periodic update
    const periodicEventEmitter = new vscode.EventEmitter();
    const MINUTE = 60_000;  // milliseconds
    const polling: number = vscode.workspace.getConfiguration("jenkins").get("polling", 0);
    if (polling > 0) {
        setInterval(periodicEventEmitter.fire, polling * MINUTE);
    }
    eventSet["onInterval"] = periodicEventEmitter.event;

    return eventSet;
}