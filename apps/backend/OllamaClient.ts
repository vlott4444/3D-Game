//Запрос к локальной модели, тайм-ауты и обработка ошибок
export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class OllamaClient {
  constructor(
    private readonly model =
      process.env.OLLAMA_MODEL || "qwen2.5:3b",
  ) {}

  async chat(messages: ChatMessage[]): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch(
        "http://127.0.0.1:11434/api/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.model,
            messages,
            stream: false,
            keep_alive: "5m",
            options: {
              num_ctx: 4096,
              num_predict: 240,
              temperature: 0.5,
            },
          }),
        },
      );

      if (!response.ok) {
        const details = await response.text();

        throw new Error(
          `Ollama HTTP ${response.status}: ${details.slice(0, 500)}`,
        );
      }

      const data = (await response.json()) as {
        message?: {
          content?: unknown;
        };
      };

      const text = data.message?.content;

      if (typeof text !== "string" || !text.trim()) {
        throw new Error("Ollama вернула пустой ответ.");
      }

      return text.trim();
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(
          "Модель не ответила за 120 секунд. " +
          "Проверь Ollama и доступную память.",
        );
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
