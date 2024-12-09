const axios = require("axios");

const checkLower1_7_8 = async (
  CT_BASE_URL,
  projectName,
  authToken,
  CT_ORGANIZATION
) => {
  let checkProject;
  try {
    checkProject = await axios.get(
      `${CT_BASE_URL}/api/project?key=${projectName}`,
      {
        headers: {
          Authorization: authToken,
          "x-ct-organization": CT_ORGANIZATION,
        },
      }
    );
  } catch (error) {
    if (
      (error.response &&
        error.response.data &&
        error.response.data.code === 404) ||
      error.response.data.code === 400
    ) {
      return {
        type: null,
      };
    } else if (error.response && error.response.data) {
      throw new Error(JSON.stringify(error.response.data));
    } else throw new Error(JSON.stringify(error));
  }

  if (checkProject.data.type !== "gitlab") {
    throw new Error(
      "There is a project with this name, but its type is not gitlab."
    );
  }

  return checkProject.data;
};

const checkUpper1_7_8 = async (ctServer, repoName, authToken, orgname) => {
  let checkProject;
  try {
    checkProject = await axios.get(`${ctServer}/api/project?key=${repoName}`, {
      headers: {
        Authorization: authToken,
        "x-ct-organization": orgname,
      },
    });
  } catch (error) {
    if (error.response && error.response.data) {
      throw new Error(JSON.stringify(error.response.data));
    } else throw new Error(JSON.stringify(error));
  }
  if (checkProject.data && checkProject.data.length <= 0) {
    return { type: null };
  } else {
    if (checkProject.data.type !== "gitlab") {
      throw new Error(
        "There is a project with this name, but its type is not gitlab."
      );
    }
    return checkProject.data;
  }
};

const compareVersions = (version1, version2) => {
  if (!version2) return 1;
  const parseVersion = (version) => version.split(".").map(Number);

  const [major1, minor1, patch1] = parseVersion(version1);
  const [major2, minor2, patch2] = parseVersion(version2);

  if (major1 > major2) return 1;
  if (major1 < major2) return -1;

  if (minor1 > minor2) return 1;
  if (minor1 < minor2) return -1;

  if (patch1 > patch2) return 1;
  if (patch1 < patch2) return -1;

  return 1; //eq
};

module.exports = {
  checkLower1_7_8,
  checkUpper1_7_8,
  compareVersions,
};
