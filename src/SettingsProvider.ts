import * as vscode from "vscode";
import { l10n, Uri } from "vscode";
import { Setting } from "./setting";
import { isRemoteUri } from "./remote";
import { appendPath, readFileUri, uriExists } from "./fs";

declare const __webpack_require__: typeof require;
declare const __non_webpack_require__: typeof require;


export class SettingsProvider {

    private settingsChangeEmitter = new vscode.EventEmitter<Setting[]>();
    public onSettingsChange = this.settingsChangeEmitter.event;


    private subscriptions: vscode.Disposable[] = [];

    public dispose() {
        for (const disposable of this.subscriptions) {
            disposable.dispose();
        }
    }


    constructor() {
        this.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(this.doReloadSettings));
        this.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(this.doReloadSettings));

        if (vscode.workspace.workspaceFolders) {
            vscode.workspace.workspaceFolders.forEach(folder => {
                const fileSystemWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, "*.{jenkins,jenkins.js}"));
                fileSystemWatcher.onDidChange(this.doReloadSettings, this.subscriptions);
                fileSystemWatcher.onDidCreate(this.doReloadSettings, this.subscriptions);
                fileSystemWatcher.onDidDelete(this.doReloadSettings, this.subscriptions);
                this.subscriptions.push(fileSystemWatcher);
            });
        }
    
        const MINUTE = 60_000;  // milliseconds
        const polling: number = vscode.workspace.getConfiguration("jenkins").get("polling", 0);
        if (polling > 0) {
            setInterval(this.doReloadSettings, polling * MINUTE);
        }
    }

    public currentSettings: Setting[] = [];

    public async doReloadSettings() {
        this.currentSettings = await reloadSettings();
        this.settingsChangeEmitter.fire(this.currentSettings);
    }
    

    public async hasJenkinsInAnyRoot(): Promise<boolean> {

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

async function getConfigPath(uri: Uri): Promise<Uri> {
    if (await uriExists(appendPath(uri, ".jenkinsrc.js"))) {
        return appendPath(uri, ".jenkinsrc.js");
    } else if (uriExists(appendPath(uri, ".jenkins"))) {
        return appendPath(uri, ".jenkins");
    }
    return uri;
}
