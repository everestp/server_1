import axios, { AxiosError } from "axios";
import logger from "../config/logger.config";

/**
 * Supported LLM providers
 */
type SupportedProvider = "openai" | "groq" | "gemini";

/**
 * Chat message format
 */
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Provider config
 */
interface ProviderConfig {
  baseUrl: string;
  endpoint: string;
}

/**
 * LLM Service (multi-provider)
 */
export class LLMService {
  private readonly provider: SupportedProvider;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  private static readonly SYSTEM_PROMPT =
    "You are an environmental IoT assistant for the Breezo air quality network. " +
    "Interpret sensor data and give concise insights under 200 words.";

  constructor() {
    this.provider = this.requireEnv("AI_PROVIDER") as SupportedProvider;
    this.apiKey = this.requireEnv("AI_API_KEY");
    this.model = this.requireEnv("AI_MODEL");
    this.baseUrl = this.requireEnv("AI_BASE_URL");
  }

  /**
   * Ask LLM
   */
  async ask(prompt: string): Promise<string> {
    const messages: ChatMessage[] = [
      { role: "system", content: LLMService.SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ];

    const url = this.getEndpoint();

    try {
      const response = await axios.post(
        url,
        this.buildPayload(messages),
        {
          headers: this.getHeaders(),
          timeout: Number(process.env.AI_TIMEOUT ?? 15000),
        }
      );

      const content =
        response.data?.choices?.[0]?.message?.content ||
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text; // gemini fallback

      if (!content) {
        logger.warn("LLM empty response", {
          provider: this.provider,
          model: this.model,
        });
        return "No response from AI.";
      }

      return content.trim();
    } catch (err) {
      const axiosErr = err as AxiosError;

      logger.error("LLM request failed", {
        provider: this.provider,
        status: axiosErr.response?.status,
        data: axiosErr.response?.data,
      });

      throw new Error(
        `LLM request failed (${this.provider}): ${axiosErr.message}`
      );
    }
  }

  /**
   * Build request payload per provider
   */
  private buildPayload(messages: ChatMessage[]) {
    switch (this.provider) {
      case "gemini":
        return {
          contents: messages.map((m) => ({
            role: m.role,
            parts: [{ text: m.content }],
          })),
        };

      default:
        return {
          model: this.model,
          messages,
          temperature: Number(process.env.AI_TEMPERATURE ?? 0.7),
          max_tokens: Number(process.env.AI_MAX_TOKENS ?? 300),
        };
    }
  }

  /**
   * Headers per provider
   */
  private getHeaders() {
    switch (this.provider) {
      case "gemini":
        return {
          "Content-Type": "application/json",
        };

      default:
        return {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        };
    }
  }

  /**
   * Get endpoint
   */
  private getEndpoint(): string {
    const config = this.getProviderConfig();
    return `${config.baseUrl}${config.endpoint}`;
  }

  /**
   * Provider config
   */
  private getProviderConfig(): ProviderConfig {
    switch (this.provider) {
      case "openai":
      case "groq":
        return {
          baseUrl: this.baseUrl,
          endpoint: "/chat/completions",
        };

      case "gemini":
        return {
          baseUrl: this.baseUrl,
          endpoint: `/models/${this.model}:generateContent`,
        };

      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }

  /**
   * Env validator
   */
  private requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) throw new Error(`Missing env: ${key}`);
    return value;
  }
}
