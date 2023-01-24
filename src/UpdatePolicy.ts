import * as vscode from "vscode";

export interface UpdatePolicy extends vscode.Disposable {
    onShouldUpdate: vscode.Event<void>
}

export class NullUpdatePolicy implements UpdatePolicy {
    public onShouldUpdate() { return vscode.Disposable.from(); }
    public dispose() {}
}

export class DefaultUpdatePolicy implements UpdatePolicy {
    private _shouldUpdateEmitter = new vscode.EventEmitter<void>();
    public onShouldUpdate = this._shouldUpdateEmitter.event;

    private _timer: NodeJS.Timer;

    constructor() {
        this._timer = setInterval(() => this._shouldUpdateEmitter.fire(), 60*1000);  // Once per minute
    }

    public dispose() {
        clearInterval(this._timer);
        this._shouldUpdateEmitter.dispose();
    }
}