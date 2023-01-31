import * as vscode from "vscode";
import { Setting } from "./Setting";
import { JenkinsIndicator } from "./JenkinsIndicator";
import { SettingsProvider, NullSettingsProvider } from "./SettingsProvider";
import { CommandRegistry } from "./CommandRegistry";
import { NullUpdatePolicy, UpdatePolicy } from "./UpdatePolicy";


export class JenkinsIndicatorHandler implements vscode.Disposable {
    private _indicators: { [name: string]: JenkinsIndicator } = {};
    private _commandRegistry = new CommandRegistry;

    private _settingsProvider: SettingsProvider = new NullSettingsProvider();
    private _updatePolicy: UpdatePolicy = new NullUpdatePolicy();


    public dispose() {
        for (const [, item] of Object.entries(this._indicators)) {
            item.dispose();
        }
        this._settingsProvider.dispose();
        this._commandRegistry.dispose();
    }


    constructor(settingsProvider: SettingsProvider, updatePolicy: UpdatePolicy) {
        this.settingsProvider = settingsProvider;
        this.updatePolicy = updatePolicy;
        this.registerCommands();
    }

    set settingsProvider(provider: SettingsProvider) {
        this._settingsProvider = provider;
        this._settingsProvider.onSettingsChange(async (settings) => {
            await this.updateAllStatusbarItems(settings);
        });
    }

    set updatePolicy(policy: UpdatePolicy) {
        this._updatePolicy = policy;
        this._updatePolicy.onShouldUpdate((async () => {
            Object.entries(this._indicators).forEach(([, indicator]) => indicator.update());
        }));
    }

    private registerCommands() {
        this._commandRegistry.add("jenkins.updateStatus", async () => {
            if (!await this._settingsProvider.isJenkinsEnabled()) {
                vscode.window.showWarningMessage("The project is not enabled for Jenkins. Missing .jenkins file.");
                return;
            }
            this._settingsProvider.update();
        });
        this._commandRegistry.add("jenkins.openInJenkins", async () => {
            const name = await this.selectJob(this._settingsProvider.currentSettings);
            vscode.commands.executeCommand("Jenkins." + name + ".openInJenkins");
        });
        this._commandRegistry.add("jenkins.openInJenkinsConsoleOutput", async () => {
            const name = await this.selectJob(this._settingsProvider.currentSettings);
            vscode.commands.executeCommand("Jenkins." + name + ".openInJenkinsConsoleOutput");
        });
    }


    private async selectJob(settings: Setting[]) {
        if (!await this._settingsProvider.isJenkinsEnabled()) {
            vscode.window.showWarningMessage("The project is not enabled for Jenkins. Missing .jenkins file.");
            return;
        } 
    
        if (!settings.length) {
            vscode.window.showWarningMessage("The current project is not enabled for Jenkins. Please review .jenkins file.");
            return;
        }
    
        let settingName: string|undefined = settings[0].name;
        if (settings.length > 1) {
            settingName = await vscode.window.showQuickPick(settings.map(setting => setting.name || setting.url), {
                placeHolder : "Select the Jenkins job to open in browser"
            });
        }
    
        return settingName;
    }


    private async updateAllStatusbarItems(settings: Setting[]): Promise<Setting[]> {      
        if (!settings) {
            return [];
        }
        
        // Make a name when there is none
        let noNameCount = 0;
        for (const setting of settings) {
            if (!setting.name) {
                setting.name = "Jenkins " + (noNameCount || "");
                noNameCount++;
            }
        }
        
        const oldNames = Object.entries(this._indicators).map(([name]) => name);
        const newNames = settings.map(setting => setting.name);
        
        const addedNames   = newNames.filter(name => !oldNames.includes(name));
        const removedNames = oldNames.filter(name => !newNames.includes(name));

        const settingsMap = Object.fromEntries(settings.map(setting => [setting.name, setting]));

        for (const name of addedNames) {
            const setting = settingsMap[name];
            // const itemId = settings.length === 1 ? "Jenkins Status" : name;
            this.addStatusbarItem(name, setting);
        }

        for (const name of removedNames) {
            this.removeStatusbarItem(name);
        }

        for (const name of newNames) {
            this.updateStatusbarItem(name, settingsMap[name]);
        }

        return settings;
    }


    public addStatusbarItem(name: string, setting: Setting) {
        this._indicators[name] = new JenkinsIndicator(name, setting);
    }

    public removeStatusbarItem(name: string) {
        const indicator = this._indicators[name];
        if (indicator) {
            indicator.dispose();
            delete this._indicators[name];
        }
    }

    public updateStatusbarItem(name: string, setting: Setting) {
        const indicator = this._indicators[name];
        if (indicator) {
            indicator.setting = setting;
        }
    }
}
