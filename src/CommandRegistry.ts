import * as vscode from "vscode";


export class CommandRegistry {
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
