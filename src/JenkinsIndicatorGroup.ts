import * as vscode from "vscode";
import { l10n } from "vscode";
import { Setting } from "./Setting";
import { JenkinsIndicator } from "./JenkinsIndicator";
import { SettingsProvider } from "./SettingsProvider";
import { CommandRegistry } from "./CommandRegistry";


export class JenkinsIndicatorGroup {
    private indicators: { [name: string]: JenkinsIndicator } = {};
    private commandRegistry = new CommandRegistry;
    private _settingsProvider: SettingsProvider;


    public dispose() {
        for (const [, item] of Object.entries(this.indicators)) {
            item.dispose();
        }
        this._settingsProvider.dispose();
        this.commandRegistry.dispose();
    }


    constructor(settingsProvider: SettingsProvider) {
        this.registerCommands();
        this.settingsProvider = settingsProvider;
    }

    set settingsProvider(provider: SettingsProvider) {
        this._settingsProvider = provider;
        this._settingsProvider.onSettingsChange(async (settings) => {
            await this.updateJenkinsStatus(settings);
        });
    }

    private registerCommands() {
        this.commandRegistry.add("jenkins.updateStatus", async () => {
            if (!await this._settingsProvider.isJenkinsEnabled()) {
                vscode.window.showWarningMessage(l10n.t("The project is not enabled for Jenkins. Missing .jenkins file."));
                return;
            }
            this._settingsProvider.update();
        });
        this.commandRegistry.add("jenkins.openInJenkins", async () => {
            const name = await this.selectJob(this._settingsProvider.currentSettings);
            vscode.commands.executeCommand("Jenkins." + name + ".openInJenkins");
        });
        this.commandRegistry.add("jenkins.openInJenkinsConsoleOutput", async () => {
            const name = await this.selectJob(this._settingsProvider.currentSettings);
            vscode.commands.executeCommand("Jenkins." + name + ".openInJenkinsConsoleOutput");
        });
    }


    private async selectJob(settings: Setting[]) {
        if (!await this._settingsProvider.isJenkinsEnabled()) {
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


    private async updateJenkinsStatus(settings: Setting[]): Promise<Setting[]> {        
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
            await indicator.update(setting);
        }
    }
}
