const { spawn } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');

class PythonService {
  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.scriptsPath = path.join(__dirname, '../../scripts');
  }

  async executeScript(scriptName, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(this.scriptsPath, scriptName);
      
      logger.info(`Executing Python script: ${scriptName} with args: ${args.join(' ')}`);
      
      const pythonProcess = spawn(this.pythonPath, [scriptPath, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        ...options
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          logger.info(`Python script ${scriptName} completed successfully`);
          resolve({
            success: true,
            output: stdout,
            code: code
          });
        } else {
          logger.error(`Python script ${scriptName} failed with code ${code}: ${stderr}`);
          reject({
            success: false,
            error: stderr,
            code: code
          });
        }
      });

      pythonProcess.on('error', (error) => {
        logger.error(`Python script ${scriptName} execution error:`, error);
        reject({
          success: false,
          error: error.message,
          code: -1
        });
      });
    });
  }

  async checkPythonAvailability() {
    try {
      const result = await this.executeScript('--version', [], { timeout: 5000 });
      return result.success;
    } catch (error) {
      logger.warn('Python not available or not configured properly');
      return false;
    }
  }

  // Text-to-Speech conversion (if needed)
  async textToSpeech(text, outputPath, options = {}) {
    try {
      const args = [
        '--text', text,
        '--output', outputPath,
        '--voice', options.voice || 'en',
        '--speed', options.speed || '1.0'
      ];
      
      return await this.executeScript('text_to_speech.py', args);
    } catch (error) {
      logger.error('Text-to-speech conversion failed:', error);
      throw error;
    }
  }

  // Audio analysis (if needed)
  async analyzeAudio(inputPath, options = {}) {
    try {
      const args = [
        '--input', inputPath,
        '--analysis-type', options.type || 'full'
      ];
      
      const result = await this.executeScript('audio_analysis.py', args);
      
      if (result.success) {
        try {
          return {
            success: true,
            data: JSON.parse(result.output)
          };
        } catch (parseError) {
          return {
            success: true,
            data: { raw: result.output }
          };
        }
      }
      
      return result;
    } catch (error) {
      logger.error('Audio analysis failed:', error);
      throw error;
    }
  }
}

module.exports = PythonService;
