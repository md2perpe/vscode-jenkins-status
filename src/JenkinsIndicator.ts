/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import * as Jenkins from "./Jenkins";
import { Setting } from "./Setting";
import { CommandRegistry } from "./CommandRegistry";


const jenkins = new Jenkins.Jenkins();


export class JenkinsIndicator implements vscode.Disposable {
    private _name: string;
    private _setting: Setting;
    private _statusbarItem: vscode.StatusBarItem;
    private _commandRegistry = new CommandRegistry;

    public dispose() {
        this._statusbarItem.dispose();
        this._commandRegistry.dispose();
    }

    
    constructor(name: string, setting: Setting) {
        this._name = name;
        this._setting = setting;

        this._statusbarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this._statusbarItem.command = "Jenkins." + name + ".openInJenkins";
        this.update();

        this.registerCommands();
    }


    private registerCommands() {
        this._commandRegistry.add(`Jenkins.${this._name}.openInJenkins`, () => {
            vscode.env.openExternal(vscode.Uri.parse(this._setting.url));
        });
        this._commandRegistry.add(`Jenkins.${this._name}.openInJenkinsConsoleOutput`, async () => {
            const url = this._setting.url;
            const user = this._setting.username || "";
            const pw   = this._setting.password || "";
            const status = await jenkins.getStatus(url, user, pw);
            if (status.connectionStatus === Jenkins.ConnectionStatus.Connected) {
                const consolePath = `${this._setting.url}/${status.buildNr}/console`;
                vscode.env.openExternal(vscode.Uri.parse(consolePath));
            } else {
                vscode.window.showWarningMessage("The Jenkins job has some connection issues. Please check the status bar for more information.");
            }
        });
    }

    public set setting(setting: Setting) {
        this._setting = setting;
        this.update();
    }


    public update() {
        const url  = this._setting.url;
        if (!url) {
            this._statusbarItem.tooltip = "No URL defined";
            this._statusbarItem.text = "Jenkins $(x)";
            return;
        }     

        const user = this._setting.username || "";
        const pw   = this._setting.password || "";

        jenkins.getStatus(url, user, pw).then((status) => {
            this._statusbarItem.text = buildIcon(status) + " " + this._setting.name;
            this._statusbarItem.tooltip = buildTooltip(status);
            this._statusbarItem.show();
        });
    }
}


function buildTooltip(status: Jenkins.JenkinsStatus): string {
    const tooltipParts = [
        `Job Name: ${status.jobName}`,
        `Status: ${status.statusName}`,
        `URL: ${status.url}`,
        `Connection Status: ${status.connectionStatusName}`,
    ];
    if (status.buildNr) {
        tooltipParts.push(`Build #${status.buildNr}`);
    }
    if (status.code) {
        tooltipParts.push(`Code #${status.code}`);
    }
    return tooltipParts.join("\n");
}


function buildIcon(status: Jenkins.JenkinsStatus): string {
    switch (status.status) {
        case Jenkins.BuildStatus.InProgress: return '$(pulse)';
        case Jenkins.BuildStatus.Success:    return '$(check)';
        case Jenkins.BuildStatus.Failed:     return '$(alert)';
        default:                             return '$(stop)';
    }
}
