/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import * as Jenkins from "./Jenkins";
import { Setting } from "./setting";
import { codicons } from "vscode-ext-codicons";
import { l10n } from "vscode";

class CommandRegistry {
    private commands: {[commandName: string]: vscode.Disposable} = {};

    add(cmd: string, callback: () => void): void {
        this.commands[cmd] = vscode.commands.registerCommand(cmd, callback);
    }

    remove(cmd: string): void {
        const command = this.commands[cmd];
        if (command) {
            command.dispose();
            delete this.commands[cmd];
        }
    }

    dispose(): void {
        Object.entries(this.commands).forEach(([, command]) => {
            command.dispose();
        });
    }
}


export class JenkinsIndicatorGroup {
    private jenkins: Jenkins.Jenkins;

    private commandRegistry: CommandRegistry = new CommandRegistry();

    private statusBarItems: {[settingName: string]: vscode.StatusBarItem} = {};

    constructor() {
        this.jenkins = new Jenkins.Jenkins();
    }

    public dispose() {
        for (const [, item] of Object.entries(this.statusBarItems)) {
            item.dispose();
        }
        this.commandRegistry.dispose();
    }

    public async updateJenkinsStatus(settings: Setting[]): Promise<Setting[]> {        
        if (!settings) {
            return;
        }
        
        // Make a name when there is none
        let noNameCount = 0;
        for (const setting of settings) {
            if (!setting.name) {
                setting.name = "Jenkins " + (noNameCount || "");
                noNameCount++;
            }
        }
        
        const oldNames = Object.entries(this.statusBarItems).map(([name]) => name);
        const newNames = settings.map(setting => setting.name);
        
        const addedNames   = newNames.filter(name => !oldNames.includes(name));
        const removedNames = oldNames.filter(name => !newNames.includes(name));

        const settingsMap = Object.fromEntries(settings.map(setting => [setting.name, setting]));

        for (const name of addedNames) {
            const setting = settingsMap[name];
            const itemId = settings.length === 1 ? "Jenkins Status" : name;
            this.addStatusbarItem(name, itemId, setting);
        }

        for (const name of removedNames) {
            this.removeStatusbarItem(name);
        }

        for (const name of newNames) {
            const setting = settingsMap[name];
            await this.updateStatusbarItem(setting);
        }

        return settings;
    }

    private addStatusbarItem(name: string, itemId: string, setting: Setting) {
        this.statusBarItems[name] = vscode.window.createStatusBarItem(`alefragnani.jenkins-status.${itemId}`, vscode.StatusBarAlignment.Left);
        this.statusBarItems[name].name = itemId;
        this.statusBarItems[name].command = "Jenkins." + name + ".openInJenkins";

        this.commandRegistry.add("Jenkins." + name + ".openInJenkins", () => {
            vscode.env.openExternal(vscode.Uri.parse(setting.url));
        });
        this.commandRegistry.add("Jenkins." + name + ".openInJenkinsConsoleOutput", async () => {
            const url = setting.url;
            const user = setting.username || "";
            const pw = setting.password || "";
            const status = await this.jenkins.getStatus(url, user, pw);
            if (status.connectionStatus === Jenkins.ConnectionStatus.Connected) {
                vscode.env.openExternal(vscode.Uri.parse(setting.url + status.buildNr.toString() + "/console"));
            } else {
                vscode.window.showWarningMessage(l10n.t("The Jenkins job has some connection issues. Please check the status bar for more information."));
            }
        });
    }

    private removeStatusbarItem(name: string) {
        this.commandRegistry.remove("Jenkins." + name + ".openInJenkins");
        this.commandRegistry.remove("Jenkins." + name + ".openInJenkinsConsoleOutput");
        this.statusBarItems[name].dispose();
        delete this.statusBarItems[name];
    }

    private async updateStatusbarItem(setting: Setting) {
        const url = setting.url;

        if (setting.strictTls !== undefined) {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = setting.strictTls ? "1" : "0";
        }
        
        this.statusBarItems[setting.name].text = setting.name;
        this.statusBarItems[setting.name].show();
        
        // invalid URL
        if (!url) {
            this.statusBarItems[setting.name].tooltip = l10n.t("No URL Defined");
            this.statusBarItems[setting.name].text = "Jenkins " + codicons.x;
            return;
        }     
        
        const user = setting.username || "";
        const pw = setting.password || "";
        const status = await this.jenkins.getStatus(url, user, pw);
        this.statusBarItems[setting.name].text = buildIcon(status) + " " + setting.name;
        this.statusBarItems[setting.name].tooltip = buildTooltip(status);
        this.statusBarItems[setting.name].show();

    }
}


function buildTooltip(status: Jenkins.JenkinsStatus): string {
    const tooltipJobName = l10n.t("Job Name: {0}", status.jobName);
    const tooltipStatus = l10n.t("Status: {0}", status.statusName);
    const tooltipUrl = l10n.t("URL: {0}", status.url);
    const tooltipConnectionStatus = l10n.t("Connection Status: {0}", status.connectionStatusName);
    const tooltipBuild = status.buildNr !== undefined 
        ? l10n.t("Build #: {0}", status.buildNr)
        : undefined;
    const tooltipCode = status.code !== undefined
        ? l10n.t("Code #: {0}", status.code)
        : undefined;

    let tooltip = tooltipJobName + "\n" +
        tooltipStatus + "\n" +
        tooltipUrl + "\n" +
        tooltipConnectionStatus;
    if (tooltipBuild !== undefined) 
        tooltip = tooltip + "\n" + tooltipBuild;
    if (tooltipCode !== undefined)
        tooltip = tooltip + "\n" + tooltipCode;

    return tooltip;
}


function buildIcon(status: Jenkins.JenkinsStatus): string {
    switch (status.status) {
        case Jenkins.BuildStatus.InProgress:
            return codicons.pulse;

        case Jenkins.BuildStatus.Success:
            return codicons.check;

        case Jenkins.BuildStatus.Failed:
            return codicons.alert;
    
        default:
            return codicons.stop;
    }
}
