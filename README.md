# CodeThreat GitLab Integration

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

CodeThreat security scanning integration for GitLab CI/CD pipelines. This integration enables automated security testing and vulnerability reporting directly in your GitLab workflow.

## Features

- 🔒 SAST (Static Application Security Testing)
- 📦 SCA (Software Composition Analysis)
- 🎯 Custom policy enforcement
- 📊 Automated security reporting
- 🔄 GitLab CI/CD pipeline integration
- 💬 Automated MR/Commit comments with findings
- 📋 SARIF report generation

## Prerequisites

- CodeThreat account and credentials
- GitLab repository with CI/CD enabled
- GitLab Personal Access Token with appropriate permissions (api, read_user, read_repository)

## Quick Start

You have two options to integrate this setup:

1. **Import from GitHub**: Import directly into your `.gitlab-ci.yml` using GitLab's `include`:

```yaml
include:
  - 'https://raw.githubusercontent.com/CodeThreat/codethreat-gitlab-plugin/main/templates/codethreat.gitlab-ci.yaml'
```

2. **Manual Integration**: Copy the provided YAML sections and paste them into your existing `.gitlab-ci.yml` file.

## Configuration Options

### Environment Variables

#### GitLab Default Variables
| Variable | Description | Required |
|----------|-------------|----------|
| `GITLAB_ACCESS_TOKEN` | Personal Access Token for GitLab | Yes |
| `GITLAB_BASE_URL` | Base URL of your GitLab platform | Yes |
| `GITLAB_USER_LOGIN` | GitLab user login name | Yes |

#### CodeThreat Variables
| Variable | Description | Required |
|----------|-------------|----------|
| `CT_TOKEN` | CodeThreat API token | Yes |
| `CT_BASE_URL` | CodeThreat server URL | Yes |
| `CT_ORGANIZATION` | Organization name | Yes |
| `CT_USERNAME` | CodeThreat username (if not using token) | No |
| `CT_PASSWORD` | CodeThreat password (if not using token) | No |

### FAILED_ARGS Options

```json
{
  "max_number_of_critical": 5,
  "max_number_of_high": 4,
  "sca_max_number_of_critical": 5,
  "sca_max_number_of_high": 4,
  "weakness_is": ".*injection,buffer.over.read,mass.assigment",
  "condition": "OR",
  "sync_scan": true,
  "policy_name": "Advanced Security"
}
```

| Option | Description | Type | Required | Default |
|--------|-------------|------|----------|---------|
| `max_number_of_critical` | Maximum allowed critical findings | Number | No | N/A |
| `max_number_of_high` | Maximum allowed high severity findings | Number | No | N/A |
| `sca_max_number_of_critical` | Maximum allowed critical SCA findings | Number | No | N/A |
| `sca_max_number_of_high` | Maximum allowed high severity SCA findings | Number | No | N/A |
| `weakness_is` | Comma-separated list of weakness types to check | String | No | N/A |
| `condition` | Condition type for checks ("AND"/"OR") | String | No | "AND" |
| `sync_scan` | Whether to wait for scan completion | Boolean | No | true |
| `automerge` | Auto-merge PR if scan succeeds | Boolean | No | false |
| `policy_name` | Name of the security policy to use | String | No | "Advanced Security" |

Note: If you don't want to use FAILED_ARGS options, you can set `FAILED_ARGS: '{}'` in your yaml file.

## Scan Types

1. **Automated Scans (`codethreat-sast-scan`)**:
   - Merge Requests: Triggered when a merge request is created/updated
   - Branch Pushes: Activates for pushes made to any branch
   - Tag Creation: Triggered when a new tag is pushed
   - Scheduled Pipelines: For pipelines initiated on a predefined schedule

2. **Manual Scan (`codethreat-sast-scan-manual`)**:
   - Can be initiated manually through the GitLab UI
   - Provides flexibility for occasional security checks outside regular pipeline activities

## Usage Examples

### Basic Usage

```yaml
variables:
  FAILED_ARGS: '{"max_number_of_critical": 0, "max_number_of_high": 2}'

codethreat-security-scan:
  stage: security
  script:
    - node index.js
```

### Advanced Usage with Custom Policy

```yaml
variables:
  FAILED_ARGS: '{
    "max_number_of_critical": 0,
    "max_number_of_high": 2,
    "weakness_is": "sql-injection,xss",
    "condition": "AND",
    "policy_name": "Custom Policy",
    "sync_scan": true,
    "automerge": false
  }'

codethreat-security-scan:
  stage: security
  script:
    - node index.js
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please contact:
- Documentation: [CodeThreat Docs](https://docs.codethreat.com)
- Issues: Please report issues via GitLab issue tracker 