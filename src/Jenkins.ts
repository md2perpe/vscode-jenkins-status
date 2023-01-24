/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import * as http from "node:http";

export enum BuildStatus {
  Success, Failed, Disabled, InProgress
}

export enum ConnectionStatus {
  Connected, InvalidAddress, AuthenticationRequired, Error
}

export interface JenkinsStatus {
  jobName: string;
  url: string;
  buildNr: number;
  status: BuildStatus;
  statusName: string;
  connectionStatus: ConnectionStatus;
  connectionStatusName: string;
  code: number;
}

function statusFromColor(color: string): [BuildStatus, string] 
{
  const [colorName, anime] = color.split("_");
  const inProgress = !!anime;

  const maybeInProgress = (status: BuildStatus): BuildStatus => inProgress ? BuildStatus.InProgress : status;
  const addProgress = (description: string): string => inProgress ? `${description} (in progress)` : description;

  switch (colorName) {
    case "blue":      return [ maybeInProgress(BuildStatus.Success), "Success" ];
    case "red":       return [ maybeInProgress(BuildStatus.Failed),  "Failed" ];
    case "yellow":    return [ BuildStatus.Disabled, addProgress("Unstable") ];  
    case "grey":      return [ BuildStatus.Disabled, addProgress("Pending") ];  
    case "aborted":   return [ BuildStatus.Disabled, addProgress("Aborted") ];  
    case "notbuilt":  return [ BuildStatus.Disabled, addProgress("Not built") ];  
    default:          return [ BuildStatus.Disabled, addProgress("Disabled") ];  
  }
}
  
export function getConnectionStatusDescription(status: ConnectionStatus): string {
    switch (status) {
      case ConnectionStatus.Connected:      return "Connected";        
      case ConnectionStatus.InvalidAddress: return "Invalid Address";    
      case ConnectionStatus.Error:          return "Error";    
      default:                              return "Authentication Required";    
    }
}

async function request(url: string, options: http.RequestOptions): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    http.get(url, options, resolve).on("error", reject);
  });
}

function getData(res: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    res.on("data", (chunk) => { data += chunk; });
    res.on("end", () => { resolve(data); });
    res.on("error", reject);
  });
}

export class Jenkins { 
  public getStatus(url: string, username: string, password: string) {
    return new Promise<JenkinsStatus>(async (resolve) => {
      try {
        const options = username ? { "auth": `${username}:${password}` } : {};
        const res = await request(url + "/api/json", options);
        switch (res.statusCode) {
          case 200:
            const data = JSON.parse(await getData(res));
            let [status, statusName] = statusFromColor(data.color);
            return resolve({
              jobName: data.displayName,
              url: data.url,
              status: status,
              statusName: statusName,
              buildNr: data.lastBuild ? data.lastBuild.number : 0,
              connectionStatus: ConnectionStatus.Connected,
              connectionStatusName: getConnectionStatusDescription(ConnectionStatus.Connected),
              code: 0
            });
            
          case 401:
          case 403:
            return resolve({
              jobName: "AUTHENTICATION NEEDED",
              url,
              status: BuildStatus.Disabled,
              statusName: "Disabled",
              buildNr: 0,
              code: res.statusCode,
              connectionStatus: ConnectionStatus.AuthenticationRequired,
              connectionStatusName: getConnectionStatusDescription(ConnectionStatus.AuthenticationRequired)
            });
        
          default:
            return resolve({
              jobName: "Invalid URL",
              url,
              status: BuildStatus.Disabled,
              statusName: "Disabled",
              buildNr: 0,
              code: res.statusCode || 0,
              connectionStatus: ConnectionStatus.InvalidAddress,
              connectionStatusName: getConnectionStatusDescription(ConnectionStatus.InvalidAddress)
            });
        }
      }
      catch (e) {
        return resolve({
          jobName: `${e}`,
          url,
          status: BuildStatus.Disabled,
          statusName: "Disabled",
          buildNr: 0,
          code: 0,
          connectionStatus: ConnectionStatus.InvalidAddress,
          connectionStatusName: getConnectionStatusDescription(ConnectionStatus.InvalidAddress)
        });
      }
    });
  }

}
