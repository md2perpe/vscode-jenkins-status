/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { commands } from "vscode";
import { WhatsNewManager } from "../../vscode-whats-new/src/Manager";
import { JenkinsStatusContentProvider, JenkinsStatusSocialMediaProvider } from "./contentProvider";

export async function registerWhatsNew(context: vscode.ExtensionContext) {
    const provider = new JenkinsStatusContentProvider();
    const viewer = new WhatsNewManager(context)
        .registerContentProvider("alefragnani", "jenkins-status", provider)
        .registerSocialMediaProvider(new JenkinsStatusSocialMediaProvider())
    await viewer.showPageInActivation();
    context.subscriptions.push(commands.registerCommand("jenkins.whatsNew", () => viewer.showPage()));
    context.subscriptions.push(commands.registerCommand("jenkins._whatsNewContextMenu", () => viewer.showPage()));
}