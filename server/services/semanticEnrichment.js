const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');
const logger = require('../utils/logger');

class SemanticEnrichment {
  constructor() {
    this.processedPath = path.join(process.cwd(), 'processed');
    this.templatesPath = path.join(process.cwd(), 'templates');
    
    // Initialize OpenAI client if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      logger.info('OpenAI client initialized for semantic enrichment');
    } else {
      logger.warn('OpenAI API key not found, using fallback enrichment');
    }
    
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.access(this.processedPath);
    } catch {
      await fs.mkdir(this.processedPath, { recursive: true });
    }
  }

  async enrichTextContent(inputPath, options = {}) {
    try {
      logger.info(`Starting semantic enrichment: ${inputPath}`);
      
      const content = await fs.readFile(inputPath, 'utf8');
      const enrichedContent = await this.processText(content, options);
      
      const inputFilename = path.basename(inputPath, path.extname(inputPath));
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const outputFilename = `enriched_${inputFilename}_${timestamp}.txt`;
      const outputPath = path.join(this.processedPath, outputFilename);
      
      await fs.writeFile(outputPath, enrichedContent);
      
      logger.info(`Semantic enrichment completed: ${outputPath}`);
      return {
        success: true,
        inputPath,
        outputPath,
        filename: outputFilename,
        originalLength: content.length,
        enrichedLength: enrichedContent.length,
        enrichmentRatio: enrichedContent.length / content.length
      };
    } catch (error) {
      logger.error(`Semantic enrichment error: ${error.message}`);
      throw error;
    }
  }

  async enrichAsset(asset) {
    try {
      logger.info(`Enriching asset semantically: ${asset.filename}`);
      
      if (!asset.originalPath) {
        throw new Error('Asset has no original path');
      }

      // Default enrichment options for automated processing
      const options = {
        addEmotionalTones: true,
        expandDescriptions: true,
        addSensoryDetails: true,
        enhanceImagery: true,
        addTransitions: true
      };

      const result = await this.enrichTextContent(asset.originalPath, options);
      
      return result;
    } catch (error) {
      logger.error(`Failed to enrich asset ${asset.filename}:`, error);
      throw error;
    }
  }

  async enrichBatch(files = [], options = {}) {
    try {
      logger.info(`Starting batch enrichment of ${files.length} files`);
      const results = [];
      
      for (const file of files) {
        try {
          const result = await this.enrichTextContent(file.path, { ...options, ...file.options });
          results.push({
            file: file,
            result: result,
            success: true
          });
        } catch (error) {
          logger.error(`Batch enrichment error for file ${file.path}: ${error.message}`);
          results.push({
            file: file,
            error: error.message,
            success: false
          });
        }
      }
      
      const successful = results.filter(r => r.success).length;
      logger.info(`Batch enrichment completed: ${successful}/${files.length} successful`);
      
      return {
        success: true,
        total: files.length,
        successful: successful,
        failed: files.length - successful,
        results: results
      };
    } catch (error) {
      logger.error(`Batch enrichment error: ${error.message}`);
      throw error;
    }
  }

  async getEnrichmentHistory() {
    try {
      const files = await fs.readdir(this.processedPath);
      const history = [];

      for (const file of files) {
        if (file.startsWith('enriched_')) {
          const filePath = path.join(this.processedPath, file);
          const stats = await fs.stat(filePath);
          
          history.push({
            filename: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          });
        }
      }

      return history.sort((a, b) => b.created - a.created);
    } catch (error) {
      logger.error(`Error getting enrichment history: ${error.message}`);
      return [];
    }
  }

  async processText(content, options = {}) {
    try {
      if (this.openai && options.useAI !== false) {
        return await this.processWithOpenAI(content, options);
      } else {
        return await this.processWithFallback(content, options);
      }
    } catch (error) {
      logger.error('Text processing error:', error);
      // Fallback to non-AI processing
      return await this.processWithFallback(content, options);
    }
  }

  async processWithOpenAI(content, options = {}) {
    try {
      const {
        addEmotionalTones = false,
        expandDescriptions = false,
        addSensoryDetails = false,
        enhanceImagery = false,
        addTransitions = false,
        maxTokens = 2000
      } = options;

      let prompt = `Please enhance the following text content:\n\n${content}\n\n`;
      
      if (addEmotionalTones) prompt += "- Add emotional depth and tone\n";
      if (expandDescriptions) prompt += "- Expand descriptions and details\n";
      if (addSensoryDetails) prompt += "- Add sensory details (sight, sound, touch, etc.)\n";
      if (enhanceImagery) prompt += "- Enhance visual and metaphorical imagery\n";
      if (addTransitions) prompt += "- Add smooth transitions between ideas\n";
      
      prompt += "\nMaintain the original meaning and structure while making it more engaging and descriptive.";

      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a professional content editor specializing in enriching text with vivid descriptions, emotional depth, and engaging language while preserving the original meaning.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.7
      });

      return completion.choices[0].message.content;
    } catch (error) {
      logger.error('OpenAI processing error:', error);
      throw error;
    }
  }

  async processWithFallback(content, options = {}) {
    try {
      // Basic text enhancement without AI
      let enrichedContent = content;
      
      if (options.addEmotionalTones) {
        enrichedContent = this.addBasicEmotionalWords(enrichedContent);
      }
      
      if (options.expandDescriptions) {
        enrichedContent = this.expandBasicDescriptions(enrichedContent);
      }
      
      if (options.addSensoryDetails) {
        enrichedContent = this.addBasicSensoryWords(enrichedContent);
      }
      
      return enrichedContent;
    } catch (error) {
      logger.error('Fallback processing error:', error);
      return content; // Return original if all else fails
    }
  }

  addBasicEmotionalWords(text) {
    const emotionalWords = {
      'good': 'wonderful',
      'bad': 'terrible',
      'big': 'enormous',
      'small': 'tiny',
      'fast': 'lightning-fast',
      'slow': 'leisurely'
    };
    
    let result = text;
    Object.entries(emotionalWords).forEach(([basic, enhanced]) => {
      const regex = new RegExp(`\\b${basic}\\b`, 'gi');
      result = result.replace(regex, enhanced);
    });
    
    return result;
  }

  expandBasicDescriptions(text) {
    // Add basic descriptive enhancements
    return text
      .replace(/\bsound\b/gi, 'rich, resonant sound')
      .replace(/\bmusic\b/gi, 'captivating music')
      .replace(/\bvoice\b/gi, 'melodious voice');
  }

  addBasicSensoryWords(text) {
    // Add basic sensory descriptions
    return text
      .replace(/\bhear\b/gi, 'clearly hear')
      .replace(/\bsee\b/gi, 'vividly see')
      .replace(/\bfeel\b/gi, 'deeply feel');
  }

  async generateMetadata(content, options = {}) {
    try {
      const words = content.split(/\s+/).filter(word => word.length > 0);
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      // Extract keywords (simple frequency-based approach)
      const wordFreq = {};
      words.forEach(word => {
        const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
        if (cleanWord.length > 3) {
          wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
        }
      });

      const keywords = Object.entries(wordFreq)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([word]) => word);

      // Determine emotional tone (basic sentiment analysis)
      const positiveWords = ['beautiful', 'peaceful', 'joy', 'happy', 'bright', 'wonderful', 'amazing', 'perfect'];
      const negativeWords = ['dark', 'sad', 'fear', 'anger', 'terrible', 'awful', 'horrible', 'pain'];
      
      const positiveCount = positiveWords.reduce((count, word) => 
        count + (content.toLowerCase().match(new RegExp(word, 'g')) || []).length, 0);
      const negativeCount = negativeWords.reduce((count, word) => 
        count + (content.toLowerCase().match(new RegExp(word, 'g')) || []).length, 0);

      let tone = 'neutral';
      if (positiveCount > negativeCount) tone = 'positive';
      else if (negativeCount > positiveCount) tone = 'negative';

      return {
        wordCount: words.length,
        sentenceCount: sentences.length,
        averageWordsPerSentence: Math.round(words.length / sentences.length),
        keywords: keywords,
        tone: tone,
        readingTime: Math.ceil(words.length / 200), // Assuming 200 WPM
        complexity: this.calculateComplexity(content)
      };
    } catch (error) {
      logger.error(`Metadata generation error: ${error.message}`);
      throw error;
    }
  }

  calculateComplexity(text) {
    const words = text.split(/\s+/);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = words.reduce((total, word) => {
      return total + this.countSyllables(word);
    }, 0) / words.length;

    // Simplified Flesch Reading Ease approximation
    const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    
    if (score >= 90) return 'very easy';
    if (score >= 80) return 'easy';
    if (score >= 70) return 'fairly easy';
    if (score >= 60) return 'standard';
    if (score >= 50) return 'fairly difficult';
    if (score >= 30) return 'difficult';
    return 'very difficult';
  }

  countSyllables(word) {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }

  async createSummary(content, maxLength = 200) {
    try {
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      if (sentences.length <= 3) {
        return content.substring(0, maxLength);
      }

      // Simple extractive summarization - take first, middle, and last sentences
      const summary = [
        sentences[0],
        sentences[Math.floor(sentences.length / 2)],
        sentences[sentences.length - 1]
      ].join('. ') + '.';

      return summary.length > maxLength ? 
        summary.substring(0, maxLength - 3) + '...' : 
        summary;
    } catch (error) {
      logger.error(`Summary creation error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = SemanticEnrichment;
