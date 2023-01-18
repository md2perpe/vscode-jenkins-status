/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import * as Jenkins from "./Jenkins";
import { Setting } from "./setting";
import { codicons } from "vscode-ext-codicons";
import { l10n } from "vscode";

export class JenkinsIndicator {

    private statusBarItems: {[settingName: string]: vscode.StatusBarItem} = {};
    private settingNameToUrl: {[settingName: string]: string} = {};
    private commands: {[commandName: string]: vscode.Disposable} = {};

    public dispose() {
        this.hideReadOnly(this.statusBarItems);
        Object.entries(this.commands).forEach(([, command]) => {
            command.dispose();
        });
    }

    public updateJenkinsStatus(settings: Setting[]): Setting[] {        
        if (!settings) {
            return;
        }
        
        let noNameCount = -1;
        this.settingNameToUrl = {};

        for (let index = 0; index < settings.length; index++) {
            const setting = settings[index];
            if (!(setting.name)) {
                noNameCount++;
                setting.name = "Jenkins " + (noNameCount ? noNameCount : "");
            }

            this.settingNameToUrl[setting.name] = setting.url;

            // Create as needed
            if (!this.statusBarItems[setting.name]) {
                const itemId = settings.length === 1 ? "Jenkins Status" : setting.name;
                this.statusBarItems[setting.name] = vscode.window.createStatusBarItem(`alefragnani.jenkins-status.${itemId}`, vscode.StatusBarAlignment.Left);
                this.statusBarItems[setting.name].name = itemId;
                this.statusBarItems[setting.name].command = "Jenkins." + setting.name + ".openInJenkins";

                this.registerCommand("Jenkins." + setting.name + ".openInJenkins", () => {
                    vscode.env.openExternal(vscode.Uri.parse(this.settingNameToUrl[setting.name]));
                });
                this.registerCommand("Jenkins." + setting.name + ".openInJenkinsConsoleOutput", () => {
                    jjj.getStatus(url, user, pw)
                    .then((status) => {
                        if (status.connectionStatus === Jenkins.ConnectionStatus.Connected) {
                            vscode.env.openExternal(vscode.Uri.parse(this.settingNameToUrl[setting.name] + status.buildNr.toString() + "/console"));
                        } else {
                            vscode.window.showWarningMessage(l10n.t("The Jenkins job has some connection issues. Please check the status bar for more information."));     
                        }   
                    });
                });
            }

            const jjj: Jenkins.Jenkins = new Jenkins.Jenkins();

            const url = setting.url;
            const user = setting.username ? setting.username : "";
            const pw = setting.password ? setting.password : "";

            if (setting.strictTls !== undefined) {
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = setting.strictTls ? "1" : "0";
            }

            this.statusBarItems[setting.name].text = setting.name;
            this.statusBarItems[setting.name].show();

            // invalid URL
            if (!url) {
                this.statusBarItems[setting.name].tooltip = l10n.t("No URL Defined");
                this.statusBarItems[setting.name].text = "Jenkins " + codicons.x;
                continue;
            }     
            
            jjj.getStatus(url, user, pw)
                .then((status) => {

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
                    
                    let icon: string;
                    switch (status.status) {
                        case Jenkins.BuildStatus.InProgress:
                            icon = codicons.pulse;
                            break;

                        case Jenkins.BuildStatus.Success:
                            icon = codicons.check;
                            break;

                        case Jenkins.BuildStatus.Failed:
                            icon = codicons.alert;
                            break;
                    
                        default:
                            icon = codicons.stop;
                    }
                        
                    this.statusBarItems[setting.name].text = icon + " " + setting.name;
                    this.statusBarItems[setting.name].tooltip = tooltip;
                    this.statusBarItems[setting.name].show();
                });
        }

        const tmpStatusBarItems = this.statusBarItems;
        this.statusBarItems = {};
        for (const key in this.settingNameToUrl) {
            // eslint-disable-next-line no-prototype-builtins
            if (this.settingNameToUrl.hasOwnProperty(key)) {
                this.statusBarItems[key] = tmpStatusBarItems[key];
                delete tmpStatusBarItems[key];
            }
        }
        
        this.hideReadOnly(tmpStatusBarItems);
        for (const key in tmpStatusBarItems) {
            // eslint-disable-next-line no-prototype-builtins
            if (tmpStatusBarItems.hasOwnProperty(key)) {
                this.deRegisterCommand("Jenkins." + key + ".openInJenkins");
                this.deRegisterCommand("Jenkins." + key + ".openInJenkinsConsoleOutput");                
            }
        }

        return settings;
    }

    private registerCommand(cmd: string, callback: () => void ): void {
        this.commands[cmd] = vscode.commands.registerCommand(cmd, callback);
    }
    
    private deRegisterCommand(cmd: string): void {
        const command = this.commands[cmd];
        if (command) {
            command.dispose();
            delete this.commands[cmd];
        }
    }

    public hideReadOnly(items) {
        for (const key in items) {
            // eslint-disable-next-line no-prototype-builtins
            if (items.hasOwnProperty(key)) {
                const statusBarItem = items[key];
                statusBarItem.dispose();                
            }
        }
    }
}
