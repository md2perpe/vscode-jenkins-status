import * as vscode from "vscode";
import { l10n, Uri } from "vscode";
import { Setting } from "./Setting";

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


    constructor(eventSet: { [name: string]: vscode.Event<unknown> }) {
        for (const [, onEvent] of Object.entries(eventSet)) {
            onEvent(this.reload, this.subscriptions);
        }
    }

    public currentSettings: Setting[] = [];

    public async reload() {
        this.currentSettings = await loadSettings();
        this.settingsChangeEmitter.fire(this.currentSettings);
    }
    

    public async isJenkinsEnabled(): Promise<boolean> {

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


async function loadSettings(): Promise<Setting[]> {
    if (!vscode.workspace.workspaceFolders) {
        return [];
    }

    let settings: Setting[] = [];
    try {
        for (const folder of vscode.workspace.workspaceFolders) {
            const jenkinsSettingsPath = await getConfigPath(folder.uri);            
            if (!jenkinsSettingsPath) {
                continue;
            }
            const jenkinsSettings = await readSettings(jenkinsSettingsPath);
            if (!jenkinsSettings) {
                return undefined;
            }
            const jenkinsSettings2 = Array.isArray(jenkinsSettings) ? jenkinsSettings : [jenkinsSettings];
            settings = settings.concat(...jenkinsSettings2);
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

        const isRemoteUri = jenkinsSettingsPath.scheme === "vscode-remote" || jenkinsSettingsPath.scheme === "vscode-vfs";
        if (isRemoteUri) {
            vscode.window.showInformationMessage(l10n.t("This workspace contains a `.jenkinsrc.js` file, which requires the Jenkins Status extension to be installed on the remote."));
            return undefined;
        }

        const r = typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require;
        delete r.cache[r.resolve(jenkinsSettingsPath.fsPath)];
        return await r(jenkinsSettingsPath.fsPath);
    } else {
        const bytes = await vscode.workspace.fs.readFile(jenkinsSettingsPath);
        return JSON.parse(Buffer.from(bytes).toString('utf8'));
    }
}

async function getConfigPath(uri: Uri): Promise<Uri|undefined> {
    for (const fileName of [".jenkinsrc.js", ".jenkins"]) {
        const path = Uri.joinPath(uri, fileName);
        if (uriExists(path)) {
            return path;
        }
    }
    return undefined;
}

async function uriExists(uri: vscode.Uri) {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}
