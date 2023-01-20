/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { JenkinsIndicatorGroup } from "./JenkinsIndicator";
import { SettingsProvider } from "./SettingsProvider";
import { registerWhatsNew } from "./whats-new/commands";

export async function activate(context: vscode.ExtensionContext) {
    const settingsProvider = new SettingsProvider();
    context.subscriptions.push(settingsProvider);

    const indicatorGroup = new JenkinsIndicatorGroup(settingsProvider);
    context.subscriptions.push(indicatorGroup);

    if (await settingsProvider.hasJenkinsInAnyRoot()) {
        settingsProvider.doReloadSettings();
    }

    await registerWhatsNew(context);
}
