const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const axios = require('axios');
const fs = require('fs').promises;

global.console.log = jest.fn();

jest.mock('../utils', () => ({
  getOrg: jest.fn(),
  login: jest.fn(),
  check: jest.fn(),
  create: jest.fn(),
  start: jest.fn(),
  status: jest.fn(),
  result: jest.fn(),
  saveSarif: jest.fn()
}));

jest.mock('axios');
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockEnv = {
  CT_TOKEN: 'mock-token',
  CT_BASE_URL: 'https://example.com',
  CT_ORGANIZATION: 'test-org',
  CT_USERNAME: 'test-user',
  CT_PASSWORD: 'test-pass',
  GITLAB_ACCESS_TOKEN: 'mock-gitlab-token',
  GITLAB_USER_LOGIN: 'gitlab-user',
  CI_PROJECT_NAME: 'test-project',
  CI_PROJECT_ID: '12345',
  CI_COMMIT_SHA: 'abc123',
  CI_COMMIT_AUTHOR: 'Test User',
  CI_COMMIT_MESSAGE: 'Test commit',
  CI_PROJECT_VISIBILITY: 'public',
  FAILED_ARGS: JSON.stringify({
    max_number_of_critical: 0,
    max_number_of_high: 2,
    weakness_is: '',
    condition: 'AND',
    sync_scan: true,
    policy_name: 'Test Policy'
  })
};

describe('CodeThreat GitLab Integration', () => {
  let utils;
  let index;
  
  beforeEach(() => {
    jest.resetModules();
    
    Object.keys(mockEnv).forEach(key => {
      process.env[key] = mockEnv[key];
    });
    
    jest.clearAllMocks();
    
    utils = require('../utils');
    index = require('../index');
    
    utils.getOrg.mockResolvedValue({ success: true });
    utils.login.mockResolvedValue('mock-token');
    utils.check.mockResolvedValue({ type: 'project' });
    utils.create.mockResolvedValue({ success: true });
    utils.start.mockResolvedValue({ data: { scan_id: 'test-scan-id' } });
    utils.status.mockResolvedValue({
      state: 'end',
      progress: 100,
      severities: { critical: 0, high: 0 },
      weaknessesArr: []
    });
    utils.result.mockResolvedValue({
      type: 'success',
      report: 'Test Report'
    });
    utils.saveSarif.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    Object.keys(mockEnv).forEach(key => {
      delete process.env[key];
    });
  });

  describe('Authentication', () => {
    test('should authenticate successfully with token', async () => {
      await index.loginIn();
      expect(utils.getOrg).toHaveBeenCalledWith(
        mockEnv.CT_BASE_URL,
        mockEnv.CT_TOKEN,
        mockEnv.CT_ORGANIZATION
      );
    });

    test('should authenticate successfully with username/password', async () => {
      delete process.env.CT_TOKEN;
      jest.resetModules();
      utils = require('../utils');
      index = require('../index');
      utils.login.mockResolvedValueOnce('mock-token');
      
      await index.loginIn();
      expect(utils.login).toHaveBeenCalledWith(
        mockEnv.CT_BASE_URL,
        mockEnv.CT_USERNAME,
        mockEnv.CT_PASSWORD
      );
    });

    test('should throw error when no credentials provided', async () => {
      delete process.env.CT_TOKEN;
      delete process.env.CT_USERNAME;
      delete process.env.CT_PASSWORD;
      jest.resetModules();
      index = require('../index');
      await expect(index.loginIn()).rejects.toThrow('Please enter username and password or token.');
    });
  });

  describe('Project Operations', () => {
    test('should check and create project if needed', async () => {
      utils.check.mockResolvedValueOnce({ type: null });
      await index.loginIn();
      await index.checkProject();
      
      expect(utils.check).toHaveBeenCalled();
      await index.createProject();
      expect(utils.create).toHaveBeenCalled();
    });

    test('should not create project if it exists', async () => {
      utils.check.mockResolvedValueOnce({ type: 'project' });
      await index.loginIn();
      await index.checkProject();
      
      expect(utils.check).toHaveBeenCalled();
      expect(utils.create).not.toHaveBeenCalled();
    });
  });

  describe('Scan Operations', () => {
    test('should start scan and monitor status', async () => {
      await index.loginIn();
      await index.startScan();

      expect(utils.start).toHaveBeenCalled();
      expect(utils.status).toHaveBeenCalledWith(
        mockEnv.CT_BASE_URL,
        'test-scan-id',
        expect.any(String),
        mockEnv.CT_ORGANIZATION
      );
    });

    test('should handle scan completion', async () => {
      utils.status.mockResolvedValueOnce({
        state: 'end',
        progress: 100,
        severities: { critical: 0, high: 0 },
        weaknessesArr: []
      });

      await index.loginIn();
      await index.startScan();

      expect(utils.result).toHaveBeenCalled();
      expect(utils.saveSarif).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle scan failure', async () => {
      utils.status.mockResolvedValueOnce({
        state: 'failure'
      });

      await index.loginIn();
      await expect(index.startScan()).rejects.toThrow('Scan Failed.');
    });

    test('should handle network errors gracefully', async () => {
      utils.getOrg.mockRejectedValueOnce(new Error('Network Error'));
      await expect(index.loginIn()).rejects.toThrow('Network Error');
    });
  });
}); 