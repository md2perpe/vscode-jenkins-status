/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { l10n } from "vscode";
import { JenkinsIndicatorGroup } from "./JenkinsIndicator";
import { Setting } from "./setting";
import { SettingsProvider } from "./SettingsProvider";
import { registerWhatsNew } from "./whats-new/commands";

export async function activate(context: vscode.ExtensionContext) {
    const indicatorGroup = new JenkinsIndicatorGroup;
    context.subscriptions.push(indicatorGroup);

    const settingsProvider = new SettingsProvider;
    

    if (await settingsProvider.hasJenkinsInAnyRoot()) {
        settingsProvider.doReloadSettings();
    }

    await registerWhatsNew(context);
    
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand("jenkins.updateStatus", async () => {
        if (!await settingsProvider.hasJenkinsInAnyRoot()) {
            vscode.window.showWarningMessage(l10n.t("The project is not enabled for Jenkins. Missing .jenkins file."));
            return;
        }
        settingsProvider.doReloadSettings();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("jenkins.openInJenkins", async () => {
        vscode.commands.executeCommand("Jenkins." + await selectJob(settingsProvider.currentSettings) + ".openInJenkins");
    }));
    context.subscriptions.push(vscode.commands.registerCommand("jenkins.openInJenkinsConsoleOutput", async () => {
        vscode.commands.executeCommand("Jenkins." + await selectJob(settingsProvider.currentSettings) + ".openInJenkinsConsoleOutput");
    }));

    // Register event listeners
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(settingsProvider.doReloadSettings));
    context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(settingsProvider.doReloadSettings));


    settingsProvider.onSettingsChange(async (settings) => {
        await indicatorGroup.updateJenkinsStatus(settings);
    });
    
    const MINUTE = 60_000;  // milliseconds
    const polling: number = vscode.workspace.getConfiguration("jenkins").get("polling", 0);
    if (polling > 0) {
        setInterval(settingsProvider.doReloadSettings, polling * MINUTE);
    }

    if (vscode.workspace.workspaceFolders) {
        vscode.workspace.workspaceFolders.forEach(folder => {
            const fileSystemWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, "*.{jenkins,jenkins.js}"));
            fileSystemWatcher.onDidChange(settingsProvider.doReloadSettings, context.subscriptions);
            fileSystemWatcher.onDidCreate(settingsProvider.doReloadSettings, context.subscriptions);
            fileSystemWatcher.onDidDelete(settingsProvider.doReloadSettings, context.subscriptions);
            context.subscriptions.push(fileSystemWatcher);
        });
    }


    async function selectJob(settings: Setting[]) {
        if (!await settingsProvider.hasJenkinsInAnyRoot()) {
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
}
