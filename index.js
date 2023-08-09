const axios = require("axios");

const projectName = process.env.CI_PROJECT_NAME;
const projectID = process.env.CI_PROJECT_ID;
const SOURCE_BRANCH_NAME = process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME;
const TARGET_BRANCH_NAME = process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME;
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
let gitlabBaseUrl = process.env.GITLAB_BASE_URL;

const {
  countAndGroupByTitle,
  convertToHHMMSS,
  getScore,
  countBySeverity,
  htmlCode,
  findWeaknessTitles,
  newIssue,
  allIssue,
} = require("./utils");

const failedArgs = JSON.parse(process.env.FAILED_ARGS);
if (failedArgs.automerge === undefined) failedArgs.automerge = false;
if (failedArgs.condition === undefined) failedArgs.condition = "AND";
if (!gitlabBaseUrl) gitlabBaseUrl = "https://gitlab.com";

console.log("GitLab URL : ", gitlabBaseUrl);
console.log("CodeThreat Organization : ", CT_ORGANIZATION);
console.log("CodeThreat URL : ", CT_BASE_URL);

console.log('MERGE REQUEST ID : ', MERGE_REQUEST_IID)
console.log('CI COMMIT BRANCH : ', CI_COMMIT_BRANCH)
console.log('CI_MERGE_REQUEST_SOURCE_BRANCH_NAME : ', SOURCE_BRANCH_NAME)
console.log('PROJECT ID', projectID)

let authorizationToken, scanProcess, cancellation;

const startScan = async () => {
  if (!CT_TOKEN && !CT_USERNAME && !CT_PASSWORD) {
    console.log("Required CT_TOKEN or CT_USERNAME and CT_PASSWORD");
  } else if (!CT_TOKEN && CT_USERNAME && CT_PASSWORD) {
    try {
      authorizationToken = await axios.post(`${CT_BASE_URL}/api/signin`, {
        client_id: CT_USERNAME,
        client_secret: CT_PASSWORD,
      });
      if (authorizationToken.status === 200)
        authorizationToken = `Bearer ${authorizationToken.data.access_token}`;
    } catch (error) {
      console.log(error?.response?.data?.message)
      throw new Error(error?.message);
    }
  } else if (CT_TOKEN) {
    authorizationToken = `Bearer ${CT_TOKEN}`;
  }

  const body1 = {
    type: visibility,
    branch: CI_COMMIT_BRANCH ? CI_COMMIT_BRANCH : SOURCE_BRANCH_NAME,
    account: gitlabUserName,
    repoNameAndID: `${projectName}:${projectID}`,
    gitlabToken: gitlabPersonalAccessToken,
    action: true,
    gitlabBaseURL: gitlabBaseUrl,
  }

  console.log('before gitlab/set body', JSON.stringify(body1));

  try {
    const checkAndCreateProject = await axios.post(
      `${CT_BASE_URL}/api/integration/gitlab/set`,
      {
        type: visibility,
        branch: CI_COMMIT_BRANCH ? CI_COMMIT_BRANCH : SOURCE_BRANCH_NAME,
        account: gitlabUserName,
        repoNameAndID: `${projectName}:${projectID}`,
        gitlabToken: gitlabPersonalAccessToken,
        action: true,
        gitlabBaseURL: gitlabBaseUrl,
      },
      {
        headers: {
          Authorization: authorizationToken, //authorizationToken
          "x-ct-organization": CT_ORGANIZATION,
        },
      }
    );

    if (checkAndCreateProject.status === 201) {
      console.log("Project created succesfully.");
    } else if (checkAndCreateProject.status === 200) {
      console.log("Preparing to scan...");
    }
  } catch (error) {
    console.log(error?.response?.data?.message)
    throw new Error(error?.message);
  }

  const body2 = {
    project_name: projectName,
    branch: CI_COMMIT_BRANCH ? CI_COMMIT_BRANCH : SOURCE_BRANCH_NAME,
    account: gitlabUserName,
    type: visibility,
    gitlabToken: gitlabPersonalAccessToken,
    action: true,
    project_id: projectID,
    gitlabBaseURL : gitlabBaseUrl,
  }

  console.log('before plugins/gitlab body', JSON.stringify(body2))

  let scanStarting;
  try {
    scanStarting = await axios.post(
      `${CT_BASE_URL}/api/plugins/gitlab`,
      {
        project_name: projectName,
        branch: CI_COMMIT_BRANCH ? CI_COMMIT_BRANCH : SOURCE_BRANCH_NAME,
        account: gitlabUserName,
        type: visibility,
        gitlabToken: gitlabPersonalAccessToken,
        action: true,
        project_id: projectID,
        gitlabBaseURL : gitlabBaseUrl,
      },
      {
        headers: {
          Authorization: authorizationToken,
          "x-ct-organization": CT_ORGANIZATION,
        },
      }
    );
  } catch (error) {
    console.log(error?.response?.data?.message)
    throw new Error(error?.message);
  }
  return scanStarting;
};

let progressData = [];
let progressSeverity = [];

const awaitScan = async (sid) => {
  try {
    scanProcess = await axios.get(`${CT_BASE_URL}/api/scan/status/${sid}`, {
      headers: {
        Authorization: authorizationToken,
        "x-ct-organization": CT_ORGANIZATION,
      },
    });
    progressData.push(scanProcess.data.progress_data.progress);
    progressSeverity.push(scanProcess.data.severities);
    if (scanProcess.data.state !== "end") {
      console.log(`Scanning... `);
      progressSeverity[progressSeverity.length - 1].critical
        ? progressSeverity[progressSeverity.length - 1].critical
        : (progressSeverity[progressSeverity.length - 1].critical = 0);
      progressSeverity[progressSeverity.length - 1].high
        ? progressSeverity[progressSeverity.length - 1].high
        : (progressSeverity[progressSeverity.length - 1].high = 0);
      progressSeverity[progressSeverity.length - 1].medium
        ? progressSeverity[progressSeverity.length - 1].medium
        : (progressSeverity[progressSeverity.length - 1].medium = 0);
      progressSeverity[progressSeverity.length - 1].low
        ? progressSeverity[progressSeverity.length - 1].low
        : (progressSeverity[progressSeverity.length - 1].low = 0);
      console.log(
        "\n" +
          "Critical : " +
          progressSeverity[progressSeverity.length - 1].critical +
          "\n" +
          "High : " +
          progressSeverity[progressSeverity.length - 1].high +
          "\n" +
          "Medium : " +
          progressSeverity[progressSeverity.length - 1].medium +
          "\n" +
          "Low : " +
          progressSeverity[progressSeverity.length - 1].low +
          "\n"
      );

      const newIssues = await newIssue(
        projectName,
        authorizationToken,
        CT_BASE_URL,
        CT_ORGANIZATION
      );
      const weaknessIsKeywords = failedArgs.weakness_is.split(",");
      const weaknessIsCount = findWeaknessTitles(newIssues, weaknessIsKeywords);

      if (failedArgs.condition === "OR") {
        if (
          failedArgs.max_number_of_critical &&
          failedArgs.max_number_of_critical <
            progressSeverity[progressSeverity.length - 1].critical
        ) {
          console.log("!! FAILED_ARGS : Critical limit exceeded -- ");
          scanProcess.data.state === "end";
          cancellation = true;
          process.exit(1);
        } else if (
          failedArgs.max_number_of_critical &&
          failedArgs.max_number_of_high <
            progressSeverity[progressSeverity.length - 1].high
        ) {
          console.log("!! FAILED_ARGS : High limit exceeded -- ");
          scanProcess.data.state === "end";
          cancellation = true;
          process.exit(1);
        } else if (weaknessIsCount.length > 0) {
          console.log(
            "!! FAILED_ARGS : Weaknesses entered in the weakness_is key were found during the scan."
          );
          scanProcess.data.state === "end";
          process.exit(1);
        }
      } else if (failedArgs.condition === "AND") {
        if (
          (failedArgs.max_number_of_critical &&
            failedArgs.max_number_of_critical <
              progressSeverity[progressSeverity.length - 1].critical) ||
          (failedArgs.max_number_of_critical &&
            failedArgs.max_number_of_high <
              progressSeverity[progressSeverity.length - 1].high) ||
          weaknessIsCount.length > 0
        ) {
          console.log(
            "!! FAILED ARGS : Not all conditions are met according to the given arguments"
          );
          scanProcess.data.state === "end";
          cancellation = true;
          process.exit(1);
        }
      }
    }
    if (scanProcess.data.state === "end" || cancellation) {
      await resultScan(
        scanProcess.data.riskscore,
        scanProcess.data.started_at,
        scanProcess.data.ended_at,
        scanProcess.data.severities,
        sid
      );
    } else {
      setTimeout(function () {
        awaitScan(sid);
      }, 10000);
    }
  } catch (error) {
    console.log(error?.response?.data?.message)
    throw new Error(error?.message);
  }
};
const resultScan = async (riskS, started_at, ended_at, totalSeverities, sid) => {
  try {
    let reason;
    if (!cancellation) {
      reason = `Scan Completed... %${progressData[progressData.length - 1]}`;
    } else {
      reason =
        "Pipeline interrupted because the FAILED_ARGS arguments you entered were found... ";
    }

    let totalSev = {
      critical: totalSeverities.critical ? totalSeverities.critical : 0,
      high: totalSeverities.high ? totalSeverities.high : 0,
      medium: totalSeverities.medium ? totalSeverities.medium : 0,
      low: totalSeverities.low ? totalSeverities.low : 0,
    };

    console.log(
      "\n" +
        "Result : " +
        reason +
        "\n" +
        "Critical : " +
        totalSev.critical +
        "\n" +
        "High : " +
        totalSev.high +
        "\n" +
        "Medium : " +
        totalSev.medium +
        "\n" +
        "Low : " +
        totalSev.low +
        "\n"
    );

    if (MERGE_REQUEST_IID) {
      console.log("Report Creating ...");

      let newIssues, allIssues, html;
      try {
        newIssues = await newIssue(
          projectName,
          authorizationToken,
          CT_BASE_URL,
          CT_ORGANIZATION
        );
      } catch (error) {
        console.log(error);
      }

      try {
        allIssues = await allIssue(
          projectName,
          authorizationToken,
          CT_BASE_URL,
          CT_ORGANIZATION
        );
      } catch (error) {
        console.log(error);
      }

      let durationTime = convertToHHMMSS(ended_at, started_at);
      const riskscore = getScore(riskS);

      const newIssuesData = countAndGroupByTitle(newIssues);
      const newIssuesSeverity = countBySeverity(newIssuesData);
      const allIssuesData = countAndGroupByTitle(allIssues);
      const allIssuesSeverity = countBySeverity(allIssuesData);

      let totalCountNewIssues = 0;
      for (const obj of newIssuesData) {
        totalCountNewIssues += obj.count;
      }

      try {
        html = htmlCode(
          totalCountNewIssues,
          newIssuesSeverity,
          allIssuesData,
          durationTime,
          riskS,
          riskscore,
          totalSeverities,
          projectName,
          CT_BASE_URL,
          sid
        );
      } catch (error) {
        console.log(error);
      }

      console.log('HTML Created')

      const apiUrl = `${gitlabBaseUrl}/api/v4/projects/${projectID}/merge_requests/${MERGE_REQUEST_IID}/notes`;

      const headers = {
        "Content-Type": "application/json",
        "PRIVATE-TOKEN": gitlabPersonalAccessToken,
      };

      try {
        const response = await axios.post(apiUrl, { body: html }, { headers });
      } catch (error) {
        console.log(error.message);
        throw new Error(error?.message);
      }

      console.log(
        "The scan results have been added as a comment to the merge request."
      );
    }
  } catch (error) {
    console.log(error?.response?.data?.message)
    throw new Error(error?.message);
  }
};

(async () => {
  const start = await startScan();
  await awaitScan(start.data.scan_id);
})();
