import * as vscode from "vscode";
import * as child_process from 'child_process';

import { Setting } from "./Setting";


export class SettingsProvider implements vscode.Disposable {
	private _settingsChangeEmitter = new vscode.EventEmitter<Setting[]>();
	public onSettingsChange = this._settingsChangeEmitter.event;

	private _currentSettings?: Setting[];
	public get currentSettings() {
		return this._currentSettings || [];
	}
    public set currentSettings(settings: Setting[]) {
        this._currentSettings = settings;
        this._settingsChangeEmitter.fire(settings);
    }
    
    public async isJenkinsEnabled(): Promise<boolean> {
        return this.currentSettings?.length > 0; 
    }

    public async dispose() { this._settingsChangeEmitter.dispose(); }
    public async update(): Promise<void> {}
}


export class NullSettingsProvider extends SettingsProvider {
    async isJenkinsEnabled() { return false; };
    async update() {}
    async dispose() {}
}


export class DefaultSettingsProvider extends SettingsProvider {

    private _subscriptions: vscode.Disposable[] = [];

    public async dispose() {
        for (const disposable of this._subscriptions) {
            disposable.dispose();
        }
        super.dispose();
    }


    constructor() {
        super();
        this.setupEventListeners();
        /* await */ this.update();
    }

    private setupEventListeners() {
        vscode.workspace.onDidGrantWorkspaceTrust(this.update.bind(this), this._subscriptions);
        vscode.workspace.onDidChangeWorkspaceFolders(this.update.bind(this), this._subscriptions);

        for (const fileName of [".jenkins", ".jenkins.js"]) {
            for (const folder of vscode.workspace.workspaceFolders || []) {
                const fileSystemWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, fileName));
                fileSystemWatcher.onDidChange(this.update.bind(this), this._subscriptions);
                fileSystemWatcher.onDidCreate(this.update.bind(this), this._subscriptions);
                fileSystemWatcher.onDidDelete(this.update.bind(this), this._subscriptions);
                this._subscriptions.push(fileSystemWatcher);    
            }
        }

        // const polling: number = vscode.workspace.getConfiguration("jenkins").get("polling", 0);
        // if (polling > 0) {
        //     setInterval(this.update, polling * 60000);    
        // }
    }


    public async update() {
        this.currentSettings = await loadSettings();
    }
    

    public async isJenkinsEnabled(): Promise<boolean> {
        for (const folder of vscode.workspace.workspaceFolders || []) {
            if (await getConfigPath(folder.uri)) {
                return true;
            }
        }
        return false;
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
                return [];
            }
            const jenkinsSettings2 = Array.isArray(jenkinsSettings) ? jenkinsSettings : [jenkinsSettings];
            settings = settings.concat(...jenkinsSettings2);
        }       
    } catch (error) {
        vscode.window.showErrorMessage("Error while retrieving Jenkins settings");
    }
    return settings;
}


async function readSettings(jenkinsSettingsPath: vscode.Uri): Promise<string|undefined> {
    if (jenkinsSettingsPath.fsPath.endsWith(".jenkinsrc.js")) {
        if (!vscode.workspace.isTrusted) {
            vscode.window.showInformationMessage("The current workspace must be Trusted in order to load settings from .jenkinsrc.js files.");
            return undefined;
        }

        const isRemoteUri = jenkinsSettingsPath.scheme === "vscode-remote" || jenkinsSettingsPath.scheme === "vscode-vfs";
        if (isRemoteUri) {
            vscode.window.showInformationMessage("This workspace contains a `.jenkinsrc.js` file, which requires the Jenkins Status extension to be installed on the remote.");
            return undefined;
        }
    } else {
        const bytes = await vscode.workspace.fs.readFile(jenkinsSettingsPath);
        return JSON.parse(Buffer.from(bytes).toString('utf8'));
    }
}

async function getConfigPath(uri: vscode.Uri): Promise<vscode.Uri|undefined> {
    for (const fileName of [".jenkinsrc.js", ".jenkins"]) {
        const path = vscode.Uri.joinPath(uri, fileName);
        if (await uriExists(path)) {
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


export class CheckedOutBranchSettingsProvider extends SettingsProvider {
    private _subscriptions: vscode.Disposable[] = [];

    public async dispose(): Promise<void> {
        this._subscriptions.forEach((disposable) => disposable.dispose());
    }

	constructor() {
        super();
        vscode.workspace.onDidChangeWorkspaceFolders(this.update.bind(this), this._subscriptions);
		this.update();
	}

	async update(): Promise<void> {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			return;
		}

		const dir = workspaceFolders[0].uri.fsPath;
		const cmd = `git -C ${dir} rev-parse --abbrev-ref HEAD`;
		const branch: string = await new Promise((resolve) => child_process.exec(cmd, (error, stdout, stderr) => resolve(stdout.trim())));

		this.currentSettings = [{
			name: branch,
			url: `http://so-srv-jenkins:8080/job/DCP/job/${branch}/`,
		}];
	}
}
