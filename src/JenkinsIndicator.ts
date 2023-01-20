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


const jenkins = new Jenkins.Jenkins();


class JenkinsIndicator {
    private statusbarItem: vscode.StatusBarItem;
    private commandRegistry = new CommandRegistry;

    constructor(name: string, itemId: string, setting: Setting) {
        this.statusbarItem = vscode.window.createStatusBarItem(`alefragnani.jenkins-status.${itemId}`, vscode.StatusBarAlignment.Left);
        this.statusbarItem.name = itemId;
        this.statusbarItem.command = "Jenkins." + name + ".openInJenkins";

        this.commandRegistry.add("Jenkins." + name + ".openInJenkins", () => {
            vscode.env.openExternal(vscode.Uri.parse(setting.url));
        });
        this.commandRegistry.add("Jenkins." + name + ".openInJenkinsConsoleOutput", async () => {
            const url = setting.url;
            const user = setting.username || "";
            const pw = setting.password || "";
            const status = await jenkins.getStatus(url, user, pw);
            if (status.connectionStatus === Jenkins.ConnectionStatus.Connected) {
                vscode.env.openExternal(vscode.Uri.parse(setting.url + status.buildNr.toString() + "/console"));
            } else {
                vscode.window.showWarningMessage(l10n.t("The Jenkins job has some connection issues. Please check the status bar for more information."));
            }
        });
    }

    public async update(setting: Setting) {
        const url = setting.url;

        if (setting.strictTls !== undefined) {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = setting.strictTls ? "1" : "0";
        }
        
        this.statusbarItem.text = setting.name;
        this.statusbarItem.show();
        
        // invalid URL
        if (!url) {
            this.statusbarItem.tooltip = l10n.t("No URL Defined");
            this.statusbarItem.text = "Jenkins " + codicons.x;
            return;
        }     
        
        const user = setting.username || "";
        const pw = setting.password || "";
        const status = await jenkins.getStatus(url, user, pw);
        this.statusbarItem.text = buildIcon(status) + " " + setting.name;
        this.statusbarItem.tooltip = buildTooltip(status);
        this.statusbarItem.show();
    }

    public dispose() {
        this.statusbarItem.dispose();
        this.commandRegistry.dispose();
    }
}

export class JenkinsIndicatorGroup {
    private indicators: { [name: string]: JenkinsIndicator } = {};

    public dispose() {
        for (const [, item] of Object.entries(this.indicators)) {
            item.dispose();
        }
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
        
        const oldNames = Object.entries(this.indicators).map(([name]) => name);
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

    public addStatusbarItem(name: string, itemId: string, setting: Setting) {
        this.indicators[name] = new JenkinsIndicator(name, itemId, setting);
    }

    public removeStatusbarItem(name: string) {
        const indicator = this.indicators[name];
        if (indicator) {
            indicator.dispose();
            delete this.indicators[name];
        }
    }

    public async updateStatusbarItem(setting: Setting) {
        const indicator = this.indicators[setting.name];
        if (indicator) {
            indicator.update(setting);
        }
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
