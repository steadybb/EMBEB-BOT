// utils/openai.js
const axios = require('axios');
const logger = require('./logger');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const BOT_URL = process.env.BOT_URL || 'https://your-bot-url.com';
const BOT_NAME = process.env.BOT_NAME || 'BYD BladeBot Auto Poster';

// Configuration
const CONFIG = {
  maxRetries: 3,
  retryDelay: 2000, // Base delay in ms
  maxTokens: 500,
  temperature: 0.8,
  defaultModel: 'openai/gpt-3.5-turbo',
  fallbackModels: [
    'google/gemini-flash-1.5',
    'anthropic/claude-instant-1.2',
    'meta-llama/llama-3.2-3b-instruct',
  ],
  timeout: 30000, // 30 seconds
  maxResponseLength: 4000, // Discord embed limit buffer
};

// System prompt for consistent BYD content
const SYSTEM_PROMPT = `You are a helpful assistant that writes engaging, informative content about BYD electric vehicles. 
Guidelines:
- Keep responses concise (max 300 words)
- Suitable for a Discord community
- Use emojis and line breaks for readability
- Use simple formatting that Discord supports (no markdown tables, use bullet points with • or -)
- Be accurate about BYD specifications and features
- Maintain a positive, enthusiastic tone
- Include 2-3 relevant emojis per paragraph
- End with a brief, engaging call-to-action (question or fun fact)`;

// Track API usage
const apiStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  retriedRequests: 0,
  averageResponseTime: 0,
  lastError: null,
  lastErrorTime: null,
  modelUsage: {},
};

/**
 * Validate and sanitize the generated content
 * @param {string} content - The generated text
 * @returns {string} - Sanitized content
 */
function sanitizeContent(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  let sanitized = content.trim();
  
  // Remove Discord-unsupported markdown
  sanitized = sanitized
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks (not ideal for embeds)
    .replace(/\*\*\*(.+?)\*\*\*/g, '**$1**') // Convert bold-italic to just bold
    .replace(/__(.+?)__/g, '**$1**') // Convert __bold__ to **bold**
    .replace(/_(.+?)_/g, '*$1*') // Convert _italic_ to *italic*
    .replace(/^(#{1,6})\s/gm, '**') // Convert headers to bold
    .replace(/\|.*\|/g, '') // Remove table rows
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links, keep text
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/\n{3,}/g, '\n\n'); // Remove excessive newlines

  // Add proper bullet point formatting
  sanitized = sanitized.replace(/^(-|\*)\s/gm, '• ');
  
  // Ensure proper emoji spacing
  sanitized = sanitized.replace(/(\S)([🎉🚗🔋⚡🌟💡🎯])/g, '$1 $2');
  
  return sanitized;
}

/**
 * Check if content is appropriate for posting
 * @param {string} content - The generated text
 * @returns {boolean} - Whether content is valid
 */
function validateContent(content) {
  if (!content || content.length < 10) {
    logger.warn('Generated content too short');
    return false;
  }

  // Check for potentially problematic content
  const blockedTerms = [
    'as an AI',
    'I cannot',
    'I apologize',
    'I am not able',
    'I am unable',
    'I do not have',
    'I don\'t have access',
    'my knowledge cutoff',
  ];

  const lowerContent = content.toLowerCase();
  for (const term of blockedTerms) {
    if (lowerContent.includes(term.toLowerCase())) {
      logger.warn(`Blocked term found in content: "${term}"`);
      return false;
    }
  }

  return true;
}

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Current attempt number (1-based)
 * @param {number} baseDelay - Base delay in ms
 * @returns {number} - Delay in ms
 */
function getBackoffDelay(attempt, baseDelay = CONFIG.retryDelay) {
  return baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
}

/**
 * Track API statistics
 * @param {string} model - Model used
 * @param {number} responseTime - Response time in ms
 * @param {boolean} success - Whether request was successful
 */
function trackApiUsage(model, responseTime, success) {
  apiStats.totalRequests++;
  
  if (success) {
    apiStats.successfulRequests++;
  } else {
    apiStats.failedRequests++;
  }
  
  // Track model usage
  if (!apiStats.modelUsage[model]) {
    apiStats.modelUsage[model] = {
      requests: 0,
      successes: 0,
      failures: 0,
      totalTime: 0,
    };
  }
  apiStats.modelUsage[model].requests++;
  apiStats.modelUsage[model][success ? 'successes' : 'failures']++;
  apiStats.modelUsage[model].totalTime += responseTime;
  
  // Update average response time
  const totalTime = apiStats.averageResponseTime * (apiStats.totalRequests - 1) + responseTime;
  apiStats.averageResponseTime = totalTime / apiStats.totalRequests;
}

/**
 * Get API statistics
 * @returns {Object} - API usage statistics
 */
function getApiStats() {
  return {
    ...apiStats,
    successRate: apiStats.totalRequests > 0
      ? `${((apiStats.successfulRequests / apiStats.totalRequests) * 100).toFixed(1)}%`
      : 'N/A',
    models: Object.entries(apiStats.modelUsage).map(([model, stats]) => ({
      model,
      ...stats,
      averageTime: `${(stats.totalTime / stats.requests).toFixed(0)}ms`,
    })),
  };
}

/**
 * Generate text using OpenRouter with retry logic and fallback models
 * @param {string} prompt - The prompt to send
 * @param {string} preferredModel - Preferred model name
 * @returns {Promise<string|null>} - Generated response or null if all attempts fail
 */
async function generateContent(prompt, preferredModel = CONFIG.defaultModel) {
  if (!OPENROUTER_API_KEY) {
    logger.error('OPENROUTER_API_KEY is not set. Cannot generate content.');
    return null;
  }

  if (!prompt || typeof prompt !== 'string') {
    logger.error('Invalid prompt provided to generateContent');
    return null;
  }

  // Prepare the list of models to try
  const modelsToTry = [preferredModel, ...CONFIG.fallbackModels.filter(m => m !== preferredModel)];
  
  for (const model of modelsToTry) {
    logger.debug(`Attempting generation with model: ${model}`);
    
    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
      const startTime = Date.now();
      
      try {
        const response = await axios.post(
          OPENROUTER_URL,
          {
            model: model,
            messages: [
              {
                role: 'system',
                content: SYSTEM_PROMPT,
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: CONFIG.maxTokens,
            temperature: CONFIG.temperature,
            top_p: 0.9,
            frequency_penalty: 0.3,
            presence_penalty: 0.3,
          },
          {
            headers: {
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': BOT_URL,
              'X-Title': BOT_NAME,
            },
            timeout: CONFIG.timeout,
          }
        );

        const responseTime = Date.now() - startTime;
        trackApiUsage(model, responseTime, true);

        if (!response.data?.choices?.[0]?.message?.content) {
          logger.error(`Empty response from OpenRouter API (${model})`);
          trackApiUsage(model, responseTime, false);
          
          if (attempt < CONFIG.maxRetries) {
            const delay = getBackoffDelay(attempt);
            logger.warn(`Retrying with ${model} in ${delay}ms (attempt ${attempt}/${CONFIG.maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          break; // Try next model
        }

        let content = response.data.choices[0].message.content.trim();
        
        // Log token usage if available
        if (response.data.usage) {
          logger.debug(`Token usage - Prompt: ${response.data.usage.prompt_tokens}, Completion: ${response.data.usage.completion_tokens}, Model: ${model}`);
        }

        // Sanitize and validate content
        content = sanitizeContent(content);
        
        if (!validateContent(content)) {
          logger.warn(`Content validation failed for ${model}, attempt ${attempt}`);
          
          if (attempt < CONFIG.maxRetries) {
            const delay = getBackoffDelay(attempt);
            logger.warn(`Retrying with adjusted prompt in ${delay}ms`);
            // Slightly modify prompt to get different response
            const adjustedPrompt = prompt + ' (provide different specific details this time)';
            prompt = adjustedPrompt;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          break; // Try next model
        }

        // Check content length
        if (content.length > CONFIG.maxResponseLength) {
          logger.warn(`Generated content too long (${content.length} chars), truncating`);
          content = content.substring(0, CONFIG.maxResponseLength - 3) + '...';
        }

        logger.success(`Content generated successfully with ${model} (${responseTime}ms, ${content.length} chars)`);
        logger.debug(`Generated content preview: ${content.substring(0, 100)}...`);
        
        return content;

      } catch (error) {
        const responseTime = Date.now() - startTime;
        trackApiUsage(model, responseTime, false);
        
        apiStats.lastError = error.message;
        apiStats.lastErrorTime = new Date().toISOString();
        
        // Handle different error types
        if (error.code === 'ECONNABORTED') {
          logger.error(`Timeout error with ${model} (attempt ${attempt}/${CONFIG.maxRetries})`);
        } else if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 5;
          logger.warn(`Rate limited with ${model}. Retry after ${retryAfter}s`);
          if (attempt < CONFIG.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }
        } else if (error.response?.status === 401 || error.response?.status === 403) {
          logger.error(`Authentication error with ${model}. Check your API key.`);
          return null; // No point retrying with authentication errors
        } else if (error.response?.status >= 500) {
          logger.error(`Server error with ${model} (${error.response.status})`);
          if (attempt < CONFIG.maxRetries) {
            const delay = getBackoffDelay(attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        } else {
          logger.error(`OpenRouter API error with ${model}:`, 
            error.response?.data || error.message);
        }
        
        if (attempt === CONFIG.maxRetries) {
          logger.warn(`All retries exhausted for ${model}, ${modelsToTry.indexOf(model) < modelsToTry.length - 1 ? 'trying next model' : 'all models failed'}`);
        }
      }
    }
  }

  // All models and retries exhausted
  logger.error('All generation attempts failed. Unable to generate content.');
  return null;
}

/**
 * Simple content generation for quick tests
 * @param {string} prompt - The prompt
 * @returns {Promise<string|null>}
 */
async function quickGenerate(prompt) {
  return generateContent(prompt, CONFIG.defaultModel);
}

/**
 * Generate content with specific style/tone
 * @param {string} prompt - Base prompt
 * @param {string} style - Content style ('excited', 'professional', 'casual', 'educational')
 * @returns {Promise<string|null>}
 */
async function generateStyledContent(prompt, style = 'excited') {
  const stylePrompts = {
    excited: 'Write this in an energetic, enthusiastic tone with lots of emojis and exclamation points.',
    professional: 'Write this in a professional, authoritative tone suitable for industry news.',
    casual: 'Write this in a friendly, conversational tone as if talking to a friend.',
    educational: 'Write this in a clear, educational tone with interesting facts and explanations.',
  };

  const styledPrompt = `${prompt}\n\nStyle instruction: ${stylePrompts[style] || stylePrompts.excited}`;
  return generateContent(styledPrompt);
}

module.exports = {
  generateContent,
  quickGenerate,
  generateStyledContent,
  getApiStats,
  SYSTEM_PROMPT,
};