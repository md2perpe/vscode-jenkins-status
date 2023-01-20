/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { JenkinsIndicatorGroup } from "./JenkinsIndicator";
import { Setting } from "./setting";
import { registerWhatsNew } from "./whats-new/commands";
import { l10n, Uri } from "vscode";
import { appendPath, readFileUri, uriExists } from "./fs";
import { isRemoteUri } from "./remote";

declare const __webpack_require__: typeof require;
declare const __non_webpack_require__: typeof require;

export async function activate(context: vscode.ExtensionContext) {
    const indicatorGroup = new JenkinsIndicatorGroup;
    context.subscriptions.push(indicatorGroup);

    let currentSettings: Setting[];
    
    if (await hasJenkinsInAnyRoot()) {
        updateStatus();
    }

    await registerWhatsNew(context);
    
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand("jenkins.updateStatus", async () => {
        if (!await hasJenkinsInAnyRoot()) {
            vscode.window.showWarningMessage(l10n.t("The project is not enabled for Jenkins. Missing .jenkins file."));
            return;
        }
        updateStatus();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("jenkins.openInJenkins", async () => {
        vscode.commands.executeCommand("Jenkins." + await selectJob(currentSettings) + ".openInJenkins");
    }));
    context.subscriptions.push(vscode.commands.registerCommand("jenkins.openInJenkinsConsoleOutput", async () => {
        vscode.commands.executeCommand("Jenkins." + await selectJob(currentSettings) + ".openInJenkinsConsoleOutput");
    }));

    // Register event listeners
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(updateStatus));
    context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(updateStatus));

    
    async function updateStatus() {
        currentSettings = await reloadSettings();
        await indicatorGroup.updateJenkinsStatus(currentSettings);
    }
    
    const MINUTE = 60_000;  // milliseconds
    const polling: number = vscode.workspace.getConfiguration("jenkins").get("polling", 0);
    if (polling > 0) {
        setInterval(updateStatus, polling * MINUTE);
    }

    if (vscode.workspace.workspaceFolders) {
        vscode.workspace.workspaceFolders.forEach(folder => {
            const fileSystemWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, "*.{jenkins,jenkins.js}"));
            fileSystemWatcher.onDidChange(updateStatus, context.subscriptions);
            fileSystemWatcher.onDidCreate(updateStatus, context.subscriptions);
            fileSystemWatcher.onDidDelete(updateStatus, context.subscriptions);
            context.subscriptions.push(fileSystemWatcher);
        });
    }
}


async function selectJob(settings: Setting[]) {
    if (!await hasJenkinsInAnyRoot()) {
        vscode.window.showWarningMessage(l10n.t("The project is not enabled for Jenkins. Missing .jenkins file."));
        return;
    } 

    if (!settings.length) {
        vscode.window.showWarningMessage(l10n.t("The current project is not enabled for Jenkins. Please review .jenkins file."));
        return;
    }

    let settingName: string = settings[0].name;
    if (settings.length > 1) {
        settingName = await vscode.window.showQuickPick(settings.map(setting => setting.name || setting.url), {
            placeHolder : l10n.t("Select the Jenkins job to open in browser")
        });
    }

    return settingName;
}


async function hasJenkinsInAnyRoot(): Promise<boolean> {

    if (!vscode.workspace.workspaceFolders) {
        return false;
    }

    let hasAny = false;

    for (const folder of vscode.workspace.workspaceFolders) {
        hasAny = !!await getConfigPath(folder.uri);
        if (hasAny) {
            return hasAny;
        }
    }

    return hasAny;
}


async function getConfigPath(uri: Uri): Promise<Uri> {
    if (await uriExists(appendPath(uri, ".jenkinsrc.js"))) {
        return appendPath(uri, ".jenkinsrc.js");
    } else if (uriExists(appendPath(uri, ".jenkins"))) {
        return appendPath(uri, ".jenkins");
    }
    return uri;
}



async function reloadSettings(): Promise<Setting[]> {
    if (!vscode.workspace.workspaceFolders) {
        return [];
    }

    let settings: Setting[] = [];
    try {
        for (const folder of vscode.workspace.workspaceFolders) {
            const jenkinsSettingsPath = await getConfigPath(folder.uri);            
            if (jenkinsSettingsPath.fsPath !== folder.uri.fsPath) {
                const jenkinsSettings = await readSettings(jenkinsSettingsPath);
                if (!jenkinsSettings) {
                    return undefined;
                }
                const jenkinsSettings2 = Array.isArray(jenkinsSettings) ? jenkinsSettings : [jenkinsSettings];
                settings = settings.concat(...jenkinsSettings2);
            }
        }       
    } catch (error) {
        vscode.window.showErrorMessage(l10n.t("Error while retrieving Jenkins settings"));
    }
    return settings;
}


async function readSettings(jenkinsSettingsPath: Uri): Promise<string> {
    if (jenkinsSettingsPath.fsPath.endsWith(".jenkinsrc.js")) {
        if (!vscode.workspace.isTrusted) {
            vscode.window.showInformationMessage(l10n.t("The current workspace must be Trusted in order to load settings from .jenkinsrc.js files."));
            return undefined;
        }

        if (isRemoteUri(jenkinsSettingsPath)) {
            vscode.window.showInformationMessage(l10n.t("This workspace contains a `.jenkinsrc.js` file, which requires the Jenkins Status extension to be installed on the remote."));
            return undefined;
        }

        const r = typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require;
        delete r.cache[r.resolve(jenkinsSettingsPath.fsPath)];
        return await r(jenkinsSettingsPath.fsPath);
    } else {
        const content = await readFileUri(jenkinsSettingsPath);
        return content;
    }
}
