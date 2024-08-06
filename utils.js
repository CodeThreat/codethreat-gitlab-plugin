const axios = require("axios");

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
      },
    ) => {
      return {
        ...acc,
        max_number_of_critical: max_number_of_critical ||
          acc.max_number_of_critical,
        max_number_of_high: max_number_of_high || acc.max_number_of_high,
        weakness_is: weakness_is || acc.weakness_is,
        automerge: automerge || acc.automerge,
        condition: condition || acc.condition,
      };
    },
    {},
  );
  return output;
}

const login = async (CT_BASE_URL, CT_USERNAME, CT_PASSWORD) => {
  let responseToken;
  try {
    responseToken = await axios.post(`${CT_BASE_URL}/api/signin`, {
      client_id: CT_USERNAME,
      client_secret: CT_PASSWORD,
    });
  } catch (error) {
    if(error?.response?.data?.message) throw new Error(error.response.data.message);
    else throw new Error(JSON.stringify(error))
  }
  console.log("[CodeThreat]: Login successful")
  return responseToken.data.access_token;
};

const check = async (CT_BASE_URL, projectName, authToken, CT_ORGANIZATION) => {
  let checkProject;
  try {
    checkProject = await axios.get(`${CT_BASE_URL}/api/project?key=${projectName}`, {
      headers: {
        Authorization: authToken,
        "x-ct-organization": CT_ORGANIZATION,
      },
    });
  } catch (error) {
    if (error.response.data.code === 400 || error.response.data.code === 404) {
      return {
        type: null,
      };
    }
    else throw new Error(JSON.stringify(error))
  }
  if (checkProject.data.type !== "gitlab") {
    throw new Error(
      "There is a project with this name, but its type is not gitlab."
    );
  }
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
    if(error?.response?.data?.message) throw new Error(error.response.data.message);
    else throw new Error(JSON.stringify(error))
  }
  console.log("[CodeThreat]: Project Created.")
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
  } catch (error) {
    if(error?.response?.data?.message) throw new Error(error.response.data.message);
    else throw new Error(JSON.stringify(error))
  }
  return scanStart;
};

const status = async (CT_BASE_URL, sid, authToken, CT_ORGANIZATION) => {
  let scanProcess;
  try {
    scanProcess = await axios.get(`${CT_BASE_URL}/api/scan/status/${sid}`, {
      headers: {
        Authorization: authToken,
        "x-ct-organization": CT_ORGANIZATION,
        "plugin": true,
      },
    });
  } catch (error) {
    if(error?.response?.data?.message) throw new Error(error.response.data.message);
    else throw new Error(JSON.stringify(error))
  }
  severityLevels.forEach((level) => {
    severities[level] = scanProcess.data.severities?.[level] || 0;
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

const result = async (CT_BASE_URL, sid, authToken, CT_ORGANIZATION, branch, project_name) => {
  let resultScan;
  try {
    resultScan = await axios.get(`${CT_BASE_URL}/api/plugins/helper?sid=${sid}&branch=${branch}&project_name=${project_name}`, {
      headers: {
        Authorization: authToken,
        "x-ct-organization": CT_ORGANIZATION,
        "x-ct-from": 'gitlab'
      },
    });
  } catch (error) {
    if(error.response.status === 404) return { type: null }
    if(error?.response?.data?.message) throw new Error(error.response.data.message);
    else throw new Error(JSON.stringify(error))
  }
  return {report: resultScan.data.report, scaSeverityCounts: resultScan.data.scaSeverityCounts};
}

const saveSarif = async (ctServer, sid, authToken, orgname) => {
  try {
    const response = await axios.get(`${ctServer}/api/report/scan/create?sid=${sid}&reportType=sarif`, {
      headers: {
        Authorization: authToken,
        "x-ct-organization": orgname,
        "x-ct-from": 'gitlab'
      },
    });

    const sarifData = JSON.stringify(response.data.parsedResult);

    const artifactPath = 'codethreat.sarif';
    await fs.writeFile(artifactPath, sarifData);

    console.log(`[CodeThreat]: Sarif report saved to ${artifactPath}`);
  } catch (error) {
    throw new Error(`Failed to save SARIF report: ${error.response?.data?.message || error.message}`);
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
  saveSarif
};