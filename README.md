
# Codethreat GitLab CI/CD Integration

Integrate Codethreat security scans into your GitLab CI/CD pipeline to ensure your codebase remains secure throughout your development lifecycle.

## Getting Started

You have two options to integrate this setup:

1.  **Import from GitHub**:  you can import it directly into your `.gitlab-ci.yml` using GitLab's `include`

    ```
    include:
      - 'https://raw.githubusercontent.com/CodeThreat/codethreat-gitlab-plugin/main/templates/codethreat.gitlab-ci.yaml'
    ```
2.  **Manual Integration**: You can copy the provided YAML sections and paste them into your existing `.gitlab-ci.yml` file.
    

## Environment Variables

### GitLab Default Variables

-   `GITLAB_ACCESS_TOKEN`: Personal Access Token for GitLab.
-   `GITLAB_BASE_URL`: Base url of your GitLab platform
-   `GITLAB_USER_LOGIN`: GitLab user login name.

### Codethreat Specific Variables

-   `CT_BASE_URL`: SAST Center base URL. Ensure this points to your Codethreat instance.
-   `CT_TOKEN`: Codethreat USER API token.
-   `CT_ORGANIZATION`: Codethreat organization name.
-   `FAILED_ARGS`: Arguments to decide when the pipeline should fail due to security issues. Adjust based on your requirements.


```yaml
FAILED_ARGS: '{
"max_number_of_critical":5,
"max_number_of_high":4,
"weakness_is":"*.injection.*",
"condition":"OR"
"sync_scan":true,
"policy_name":"Advanced Security"
"sca_max_number_of_critical":5,
"sca_max_number_of_high":4,
}'
``` 

- The values ​​in FAILED_ARGS are not required. If you do not want to enter these values, set `FAILED_ARGS: '{}'` under variables in your yaml file.
- For policy_name, enter a valid policy name. For example, Advanced Security, SAST Scan, SCA Scan, etc. By default Advanced Security. 

## Scan Types

1.  **Automated Scans (`codethreat-sast-scan`)**:
    
    -   **Merge Requests**: Triggered when a merge request is created/updated.
    -   **Branch Pushes**: Activates for pushes made to any branch, including and excluding the default branch.
    -   **Tag Creation**: Triggered when a new tag is pushed.
    -   **Scheduled Pipelines**: For pipelines initiated on a predefined schedule.
2.  **Manual Scan (`codethreat-sast-scan-manual`)**: Can be initiated manually through the GitLab UI. This provides flexibility for teams wanting occasional security checks outside regular pipeline activities.
    

## Usage

Once integrated, Codethreat scans will automatically run based on the provided rules. Post-scan, you can view results within the GitLab pipeline logs or directly within the Codethreat interface.

For manual scans:

-   Navigate to the CI/CD section in GitLab.
-   Locate the `codethreat-sast-scan-manual` job within the appropriate pipeline.
-   Click the `Play` button to initiate.

## Support

For any queries or challenges regarding the Codethreat GitLab integration, contact our support team. 
