// utils/openai.js
const axios = require('axios');
const logger = require('./logger');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Generate text using OpenRouter (or OpenAI-compatible endpoint).
 * @param {string} prompt - The prompt to send.
 * @param {string} model - Model name (default: 'openai/gpt-3.5-turbo').
 * @returns {Promise<string>} - Generated response.
 */
async function generateContent(prompt, model = 'openai/gpt-3.5-turbo') {
  if (!OPENROUTER_API_KEY) {
    logger.error('OPENROUTER_API_KEY is not set. Cannot generate content.');
    return null;
  }

  try {
    const response = await axios.post(
      OPENROUTER_URL,
      {
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that writes engaging, informative content about BYD electric vehicles. Keep responses concise (max 300 words) and suitable for a Discord community. Use emojis, line breaks, and avoid markdown that Discord doesn’t support (use simple formatting).'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.8,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://your-bot-url.com', // optional but recommended
          'X-Title': 'BYD BladeBot Auto Poster',
        },
      }
    );
    const content = response.data.choices[0].message.content.trim();
    logger.debug(`Generated content: ${content.substring(0, 100)}...`);
    return content;
  } catch (error) {
    logger.error('OpenRouter API error:', error.response?.data || error.message);
    return null;
  }
}

module.exports = { generateContent };