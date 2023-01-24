import * as vscode from 'vscode';

import { JenkinsIndicatorGroup } from "./JenkinsIndicatorGroup";
// import { Setting } from './Setting';
import { CheckedOutBranchSettingsProvider, DefaultSettingsProvider, SettingsProvider } from './SettingsProvider';
import { DefaultUpdatePolicy } from './UpdatePolicy';


export async function activate(context: vscode.ExtensionContext) {
	// const configuration = vscode.workspace.getConfiguration();
	// const settingsProvider = new DefaultSettingsProvider();
	const settingsProvider = new CheckedOutBranchSettingsProvider();
	const updatePolicy = new DefaultUpdatePolicy();
    const indicatorGroup = new JenkinsIndicatorGroup(settingsProvider, updatePolicy);
    context.subscriptions.push(settingsProvider, indicatorGroup);

    return {
        set settingsProvider(provider: SettingsProvider) {
            indicatorGroup.settingsProvider = provider;
        }
    };
}
