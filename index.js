const axios = require("axios");
const fs = require('fs').promises;

const projectName = process.env.CI_PROJECT_NAME;
const projectID = process.env.CI_PROJECT_ID;
const SOURCE_BRANCH_NAME = process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME;
const MERGE_REQUEST_IID = process.env.CI_MERGE_REQUEST_IID;
const CI_COMMIT_BRANCH = process.env.CI_COMMIT_BRANCH;
const visibility = process.env.CI_PROJECT_VISIBILITY;

const CT_TOKEN = process.env.CT_TOKEN;
let CT_BASE_URL = process.env.CT_BASE_URL;
const CT_USERNAME = process.env.CT_USERNAME;
const CT_PASSWORD = process.env.CT_PASSWORD;
const CT_ORGANIZATION = process.env.CT_ORGANIZATION;

const gitlabPersonalAccessToken = process.env.GITLAB_ACCESS_TOKEN;
const gitlabUserName = process.env.GITLAB_USER_LOGIN;
const CI_COMMIT_SHA = process.env.CI_COMMIT_SHA;
const CI_COMMIT_MESSAGE = process.env.CI_COMMIT_MESSAGE;
const CI_COMMIT_AUTHOR = process.env.CI_COMMIT_AUTHOR;
let gitlabBaseUrl = process.env.GITLAB_BASE_URL;

let branch = CI_COMMIT_BRANCH;

if(MERGE_REQUEST_IID){
  branch = SOURCE_BRANCH_NAME;
}

const {
  findWeaknessTitles,
  login,
  check,
  create,
  start,
  status,
  result,
  saveSarif
} = require("./utils");

const failedArgs = JSON.parse(process.env.FAILED_ARGS) || {};
if (failedArgs.automerge === undefined) failedArgs.automerge = false;
if (failedArgs.condition === undefined) failedArgs.condition = "AND";
if (failedArgs.weakness_is === undefined) failedArgs.weakness_is = "";
if (failedArgs.sync_scan === undefined) failedArgs.sync_scan = true;
if (failedArgs.policy_name === undefined) failedArgs.policy_name = 'Advanced Security';
if (!gitlabBaseUrl) gitlabBaseUrl = "https://gitlab.com";

console.log("------------------------------")
console.log("CodeThreat Server: " + CT_BASE_URL);
console.log("User: " + gitlabUserName);
console.log("Project: " + projectName);
console.log("Organization: " + CT_ORGANIZATION)
console.log("------------------------------")

if(!gitlabPersonalAccessToken){
  console.log("Please enter GITLAB_ACCESS_TOKEN");
  throw new Error("Please enter GITLAB_ACCESS_TOKEN")
}

console.log("------------------------------")
console.log('Commit Author ---> ', CI_COMMIT_AUTHOR);
console.log('Commit Message ---> ', CI_COMMIT_MESSAGE);
console.log('Commit ID ---> ', CI_COMMIT_SHA);
console.log("------------------------------")

let authToken, checked, scanProcess, cancellation;

const loginIn = async () => {
  if (CT_TOKEN && (!CT_USERNAME || !CT_PASSWORD)) {
    authToken = CT_TOKEN;
  } else if (CT_USERNAME && CT_PASSWORD) {
    authToken = await login(CT_BASE_URL, CT_USERNAME, CT_PASSWORD);
  } else {
    console.log("Please enter username and password or token.");
    throw new Error("Please enter username and password or token.")
  }
};

const checkProject = async () => {
  return await check(CT_BASE_URL, projectName, authToken, CT_ORGANIZATION);
};

const createProject = async () => {
  const repoNameAndID = `${projectName}:${projectID}`;
  return await create(
    CT_BASE_URL,
    projectName,
    branch,
    gitlabUserName,
    visibility,
    gitlabPersonalAccessToken,
    authToken,
    CT_ORGANIZATION,
    repoNameAndID,
    failedArgs.policy_name
  );
};

const startScan = async () => {
  return await start(
    CT_BASE_URL,
    projectName,
    branch,
    gitlabUserName,
    visibility,
    gitlabPersonalAccessToken,
    projectID,
    CI_COMMIT_SHA,
    CI_COMMIT_AUTHOR,
    CI_COMMIT_MESSAGE,
    authToken,
    failedArgs.policy_name,
    CT_ORGANIZATION
  );
};

const scanStatus = async (sid) => {
  try {
    scanProcess = await status(CT_BASE_URL, sid, authToken, CT_ORGANIZATION);
    if (scanProcess.state === "failure") {
      console.log("Scan Failed.");
      throw new Error("Scan Failed.");
    }
    if(!failedArgs.sync_scan){
      console.log("Scan started successfuly.")
      return;
    }
    if (scanProcess.state !== "end") {
      console.log(
        "Scanning... " +
          "%" +
          scanProcess.progress +
          " - Critical : " +
          scanProcess.severities.critical +
          " High : " +
          scanProcess.severities.high +
          " Medium : " +
          scanProcess.severities.medium +
          " Low : " +
          scanProcess.severities.low);

      const weaknessArray = [...new Set(scanProcess.weaknessesArr)];   

      let weaknessIsCount;
      if(failedArgs.weakness_is !== ""){
        const keywords = failedArgs.weakness_is.split(",");
        weaknessIsCount = findWeaknessTitles(weaknessArray, keywords);
      } else {
        weaknessIsCount = [];
      }

      if (failedArgs.condition === "OR") {
        if (
          failedArgs.max_number_of_critical &&
          failedArgs.max_number_of_critical < scanProcess.severities.critical
        ) {
          console.log("!! FAILED_ARGS : Critical limit exceeded.");
          throw new Error(
            "Pipeline interrupted because the FAILED_ARGS arguments you entered were found..."
          );
        } else if (
          failedArgs.max_number_of_critical &&
          failedArgs.max_number_of_high < scanProcess.severities.high
        ) {
          console.log("!! FAILED_ARGS : High limit exceeded. ");
          throw new Error(
            "Pipeline interrupted because the FAILED_ARGS arguments you entered were found..."
          );
        } else if (weaknessIsCount.length > 0) {
          console.log(
            "!! FAILED_ARGS : Weaknesses entered in the weakness_is key were found during the scan."
          );
          throw new Error(
            "Pipeline interrupted because the FAILED_ARGS arguments you entered were found..."
          );
        }
      } else if (failedArgs.condition === "AND") {
        if (
          (failedArgs.max_number_of_critical &&
            failedArgs.max_number_of_critical < scanProcess.severities.critical) ||
          (failedArgs.max_number_of_critical &&
            failedArgs.max_number_of_high < scanProcess.severities.high) ||
          weaknessIsCount.length > 0
        ) {
          console.log(
            "!! FAILED ARGS : Not all conditions are met according to the given arguments."
          );
          throw new Error(
            "Pipeline interrupted because the FAILED_ARGS arguments you entered were found..."
          );
        }
      }
    }
    if (scanProcess.state === "end") {
      await resultScan(
        scanProcess.progress,
        scanProcess.severities,
        sid,
        scanProcess.weaknessesArr,
      );
    } else {
      setTimeout(function () {
        scanStatus(sid);
      }, 5000);
    }
  } catch (error) {
    console.log(error.message);
  }
};

const resultScan = async (progress, severities, sid, weaknessArr) => {
  const report = await result(CT_BASE_URL, sid, authToken, CT_ORGANIZATION);
  const weaknessArray = [...new Set(weaknessArr)];

    let weaknessIsCount;
    if(failedArgs.weakness_is !== ""){
      const keywords = failedArgs.weakness_is.split(",");
      weaknessIsCount = findWeaknessTitles(weaknessArray, keywords);
    } else {
      weaknessIsCount = [];
    }
  if (failedArgs.condition === "OR") {
    if (
      failedArgs.max_number_of_critical &&
      failedArgs.max_number_of_critical < scanProcess.severities.critical
    ) {
      console.log("!! FAILED_ARGS : Critical limit exceeded.");
      throw new Error(
        "Pipeline interrupted because the FAILED_ARGS arguments you entered were found..."
      );
    } else if (
      failedArgs.max_number_of_high &&
      failedArgs.max_number_of_high < scanProcess.severities.high
    ) {
      console.log("!! FAILED_ARGS : High limit exceeded. ");
      throw new Error(
        "Pipeline interrupted because the FAILED_ARGS arguments you entered were found..."
      );
    } else if (weaknessIsCount.length > 0) {
      console.log(
        "!! FAILED_ARGS : Weaknesses entered in the weakness_is key were found during the scan."
      );
      throw new Error(
        "Pipeline interrupted because the FAILED_ARGS arguments you entered were found..."
      );
    } else if (
      failedArgs.sca_max_number_of_critical &&
      failedArgs.sca_max_number_of_critical < report.scaSeverityCounts.Critical
    ) {
      console.log("!! FAILED_ARGS : Sca Critical limit exceeded.");
      throw new Error(
        "Pipeline interrupted because the FAILED_ARGS arguments you entered were found..."
      );
    } else if (
      failedArgs.sca_max_number_of_high &&
      failedArgs.sca_max_number_of_high < report.scaSeverityCounts.High
    ) {
      console.log("!! FAILED_ARGS : Sca High limit exceeded. ");
      throw new Error(
        "Pipeline interrupted because the FAILED_ARGS arguments you entered were found..."
      );
    }
  } else if (failedArgs.condition === "AND") {
    if (
      (failedArgs.max_number_of_critical &&
        failedArgs.max_number_of_critical < scanProcess.severities.critical) ||
      (failedArgs.max_number_of_high &&
        failedArgs.max_number_of_high < scanProcess.severities.high) ||
      (failedArgs.sca_max_number_of_high &&
        failedArgs.sca_max_number_of_high < report.scaSeverityCounts.High) ||
      (failedArgs.sca_max_number_of_critical &&
        failedArgs.sca_max_number_of_critical < report.scaSeverityCounts.Critical) ||
      weaknessIsCount.length > 0
    ) {
      console.log(
        "!! FAILED ARGS : Not all conditions are met according to the given arguments."
      );
      throw new Error(
        "Pipeline interrupted because the FAILED_ARGS arguments you entered were found..."
      );
    }
  }
  const reason = `Scan Completed... %${progress}`;
  console.log(
    "Result : " +
      reason +
      "- Critical : " +
      severities.critical +
      " High : " +
      severities.high +
      " Medium : " +
      severities.medium +
      " Low : " +
      severities.low
  );
  console.log("Report Created")   
  try {
    await saveSarif(CT_BASE_URL, sid, authToken, CT_ORGANIZATION);
  } catch (error) {
    console.log("sarif report generation failed: " + error.message)
  }
    
  if(!MERGE_REQUEST_IID) {
    const apiUrl = `${gitlabBaseUrl}/api/v4/projects/${projectID}/repository/commits/${CI_COMMIT_SHA}/comments`;
    const headers = {
      "Content-Type": "application/json",
      "PRIVATE-TOKEN": gitlabPersonalAccessToken,
    };

    try {
      await axios.post(apiUrl, { note: report.report }, { headers });
      console.log("The scan results have been added as a comment to the commits");
    } catch (error) {
      console.log("The scan was completed, but the report could not be sent as a comment.")
      console.log(error.message);
    }
  } else if (MERGE_REQUEST_IID) {
    const apiUrl = `${gitlabBaseUrl}/api/v4/projects/${projectID}/merge_requests/${MERGE_REQUEST_IID}/notes`;
    const headers = {
      "Content-Type": "application/json",
      "PRIVATE-TOKEN": gitlabPersonalAccessToken,
    };

    try {
      await axios.post(apiUrl, { body: report.report }, { headers });
      console.log("The scan results have been added as a comment to the merge request.");
    } catch (error) {
      console.log("The scan was completed, but the report could not be sent as a comment.")
      console.log(error.message);
    }
  }
}

(async () => {
  let start;
  try {
    await loginIn();
    checked = await checkProject();
    if (checked.type === null) await createProject();
    start = await startScan();
    await scanStatus(start.data.scan_id);
  } catch (error) {
    throw new Error(error);
  }
})();