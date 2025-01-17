const axios = require("axios");
const fs = require("fs").promises;

const {
  checkLower1_7_8,
  checkUpper1_7_8,
  compareVersions,
} = require("./adapter");

let apiVersion;

const severityLevels = ["critical", "high", "medium", "low"];

let severities = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
};

const findWeaknessTitles = (weaknessArray, keywords) => {
  const sanitizedKeywords = [];

  keywords.forEach((keyword) => {
    const sanitizedKeyword = keyword.replace(/[^a-zA-Z0-9.,]/g, "");
    if (sanitizedKeyword) {
      sanitizedKeywords.push(sanitizedKeyword);
    }
  });

  const safeRegexPattern = new RegExp(sanitizedKeywords.join("|"), "i");
  const found = weaknessArray.filter((weakness) =>
    safeRegexPattern.test(weakness.weakness_id)
  );

  return found;
};

const failedArgs = (failedArgsParsed) => {
  const output = failedArgsParsed.reduce(
    (
      acc,
      {
        max_number_of_critical,
        max_number_of_high,
        weakness_is,
        automerge,
        condition,
      }
    ) => {
      return {
        ...acc,
        max_number_of_critical:
          max_number_of_critical || acc.max_number_of_critical,
        max_number_of_high: max_number_of_high || acc.max_number_of_high,
        weakness_is: weakness_is || acc.weakness_is,
        automerge: automerge || acc.automerge,
        condition: condition || acc.condition,
      };
    },
    {}
  );
  return output;
};

const login = async (CT_BASE_URL, CT_USERNAME, CT_PASSWORD) => {
  let responseToken;
  try {
    responseToken = await axios.post(`${CT_BASE_URL}/api/signin`, {
      client_id: CT_USERNAME,
      client_secret: CT_PASSWORD,
    });
  } catch (error) {
    if (error?.response?.data?.message)
      throw new Error(error.response.data.message);
    else throw new Error(JSON.stringify(error));
  }
  console.log("[CodeThreat]: Login successful");
  if (responseToken.headers["x-api-version"]) {
    apiVersion = responseToken.headers["x-api-version"];
    console.log(`[CodeThreat]: Api Version: ${apiVersion}`);
  }
  return responseToken.data.access_token;
};

const getOrg = async (CT_BASE_URL, authToken, CT_ORGANIZATION) => {
  let response;
  try {
    response = await axios.get(
      `${CT_BASE_URL}/api/organization?key=${CT_ORGANIZATION}`,
      {
        headers: {
          Authorization: authToken,
          "x-ct-organization": CT_ORGANIZATION,
        },
      }
    );
  } catch (error) {
    if (error?.response?.data?.message)
      throw new Error(error.response.data.message);
    else throw new Error(JSON.stringify(error));
  }
  if (response.headers["x-api-version"]) {
    apiVersion = response.headers["x-api-version"];
    console.log(`[CodeThreat]: Api Version: ${apiVersion}`);
  }
};

const check = async (CT_BASE_URL, projectName, authToken, CT_ORGANIZATION) => {
  let checkProject;
  const compareVersion = compareVersions("1.7.8", apiVersion);
  if (compareVersion === 1)
    checkProject = await checkLower1_7_8(
      CT_BASE_URL,
      projectName,
      authToken,
      CT_ORGANIZATION
    );
  else if (compareVersion === -1)
    checkProject = await checkUpper1_7_8(
      CT_BASE_URL,
      projectName,
      authToken,
      CT_ORGANIZATION
    );

  return checkProject;
};

const create = async (
  CT_BASE_URL,
  projectName,
  branch,
  gitlabUserName,
  type,
  gitlabPersonalAccessToken,
  authToken,
  CT_ORGANIZATION,
  repoNameAndID,
  policyName
) => {
  let createProject;
  try {
    createProject = await axios.post(
      `${CT_BASE_URL}/api/integration/gitlab/set`,
      {
        repoNameAndID,
        project: projectName,
        branch,
        account: gitlabUserName,
        action: true,
        type,
        gitlabToken: gitlabPersonalAccessToken,
      },
      {
        headers: {
          Authorization: authToken,
          "x-ct-organization": CT_ORGANIZATION,
        },
      }
    );
  } catch (error) {
    if (error?.response?.data?.message)
      throw new Error(error.response.data.message);
    else throw new Error(JSON.stringify(error));
  }
  console.log("[CodeThreat]: Project Created.");
  return createProject;
};

const start = async (
  CT_BASE_URL,
  projectName,
  branch,
  gitlabUserName,
  type,
  gitlabPersonalAccessToken,
  projectID,
  commitId,
  committer,
  commitMessage,
  authToken,
  policyName,
  CT_ORGANIZATION
) => {
  let scanStart;
  try {
    scanStart = await axios.post(
      `${CT_BASE_URL}/api/plugins/gitlab`,
      {
        project_name: projectName,
        branch: branch,
        account: gitlabUserName,
        action: true,
        projectId: projectID,
        commitId,
        committer,
        commitMessage,
        type,
        gitlabToken: gitlabPersonalAccessToken,
        policy_id: policyName,
      },
      {
        headers: {
          Authorization: authToken,
          "x-ct-organization": CT_ORGANIZATION,
        },
      }
    );
    if (scanStart.status === 200 && scanStart.data.scan_id) return scanStart;
    else {
      console.log(
        `Failed to start scan. Status: ${JSON.stringify(
          scanStart.status
        )} Error: ${JSON.stringify(
          scanStart.data || { error: "Unexpected Error: Scan Start" }
        )}`
      );
      throw new Error(
        JSON.stringify(
          scanStart.data || { error: "Unexpected Error: Scan Start" }
        )
      );
    }
  } catch (error) {
    if (error.response && error.response.data)
      throw new Error(JSON.stringify(error.response.data));
    else throw new Error(error);
  }
};

const status = async (CT_BASE_URL, sid, authToken, CT_ORGANIZATION) => {
  let scanProcess;
  try {
    scanProcess = await axios.get(`${CT_BASE_URL}/api/scan/status/${sid}`, {
      headers: {
        Authorization: authToken,
        "x-ct-organization": CT_ORGANIZATION,
        plugin: true,
      },
    });
  } catch (error) {
    if (error?.response?.data?.message)
      throw new Error(error.response.data.message);
    else throw new Error(JSON.stringify(error));
  }
  severityLevels.forEach((level) => {
    severities[level] = scanProcess.data.sast_severities?.[level] || 0;
  });
  return {
    progress: scanProcess.data.progress_data.progress,
    weaknessesArr: scanProcess.data.weaknessesArr,
    state: scanProcess.data.state,
    riskscore: scanProcess.data.riskscore,
    started_at: scanProcess.data.started_at,
    ended_at: scanProcess.data.ended_at,
    severities,
  };
};

const result = async (
  CT_BASE_URL,
  sid,
  authToken,
  CT_ORGANIZATION,
  branch,
  project_name
) => {
  let resultScan;
  try {
    resultScan = await axios.get(
      `${CT_BASE_URL}/api/plugins/helper?sid=${sid}&branch=${branch}&project_name=${project_name}`,
      {
        headers: {
          Authorization: authToken,
          "x-ct-organization": CT_ORGANIZATION,
          "x-ct-from": "gitlab",
        },
      }
    );
  } catch (error) {
    if (error.response.status === 404) return { type: null };
    if (error?.response?.data?.message)
      throw new Error(error.response.data.message);
    else throw new Error(JSON.stringify(error));
  }
  return {
    report: resultScan.data.report,
    scaSeverityCounts: resultScan.data.scaSeverityCounts,
  };
};

const saveSarif = async (
  ctServer,
  sid,
  authToken,
  orgname,
  projectName,
  branch
) => {
  try {
    const response = await axios.get(
      `${ctServer}/api/report/scan/create?sid=${sid}&projectName=${projectName}&branch=${branch}&reportType=sarif`,
      {
        headers: {
          Authorization: authToken,
          "x-ct-organization": orgname,
          "x-ct-from": "gitlab",
        },
      }
    );

    const sarifData = JSON.stringify(response.data.parsedResult);

    const artifactPath = "codethreat.sarif";
    await fs.writeFile(artifactPath, sarifData);

    console.log(`[CodeThreat]: Sarif report saved to ${artifactPath}`);
  } catch (error) {
    throw new Error(
      `Failed to save SARIF report: ${
        error.response?.data?.message || error.message
      }`
    );
  }
};

module.exports = {
  findWeaknessTitles,
  failedArgs,
  login,
  check,
  create,
  start,
  status,
  result,
  saveSarif,
  getOrg
};
