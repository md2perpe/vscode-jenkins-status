import * as vscode from 'vscode';

import { JenkinsIndicatorHandler } from "./JenkinsIndicatorHandler";
// import { Setting } from './Setting';
import { CheckedOutBranchSettingsProvider, DefaultSettingsProvider, SettingsProvider } from './SettingsProvider';
import { DefaultUpdatePolicy } from './UpdatePolicy';


export async function activate(context: vscode.ExtensionContext) {
	// const configuration = vscode.workspace.getConfiguration();
	// const settingsProvider = new DefaultSettingsProvider();
	const settingsProvider = new CheckedOutBranchSettingsProvider();
	const updatePolicy = new DefaultUpdatePolicy();
    const indicatorHandler = new JenkinsIndicatorHandler(settingsProvider, updatePolicy);

    context.subscriptions.push(settingsProvider, updatePolicy, indicatorHandler);

    return {
        set settingsProvider(provider: SettingsProvider) {
            indicatorHandler.settingsProvider = provider;
        }
    };
}
