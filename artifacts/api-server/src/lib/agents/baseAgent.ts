import { getOpenAIClient, MODEL_NAME } from "../openaiClient";

export abstract class BaseAgent {
  protected readonly systemPrompt: string;
  protected readonly agentName: string;

  constructor(systemPrompt: string, agentName: string) {
    this.systemPrompt = systemPrompt;
    this.agentName = agentName;
  }

  protected async call(userMessage: string): Promise<string> {
    try {
      return await this.invoke(userMessage);
    } catch (err) {
      const firstMessage = err instanceof Error ? err.message : String(err);
      console.warn(
        `[${this.agentName}] first attempt failed (${firstMessage}); retrying once`,
      );
      return await this.invoke(userMessage);
    }
  }

  protected async callWithCorrection(
    userMessage: string,
    correctionMessage: string,
  ): Promise<string> {
    return await this.invoke(userMessage, correctionMessage);
  }

  private async invoke(
    userMessage: string,
    correctionMessage?: string,
  ): Promise<string> {
    const client = getOpenAIClient();
    const messages: {
      role: "system" | "user";
      content: string;
    }[] = [
      { role: "system", content: this.systemPrompt },
      { role: "user", content: userMessage },
    ];
    if (correctionMessage) {
      messages.push({ role: "user", content: correctionMessage });
    }

    const response = await client.chat.completions.create({
      model: MODEL_NAME,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages,
    });

    const choice = response.choices[0];
    const content = choice?.message?.content;
    if (!content) {
      throw new Error(`[${this.agentName}] empty response from model`);
    }

    if (process.env.NODE_ENV !== "production" && response.usage) {
      console.log(
        `[${this.agentName}] tokens: prompt=${response.usage.prompt_tokens} completion=${response.usage.completion_tokens} total=${response.usage.total_tokens}`,
      );
    }

    return content;
  }

  protected parseJson<T>(content: string): T {
    return JSON.parse(content) as T;
  }
}
