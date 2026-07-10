import { describe, it, expect, beforeAll } from "vitest";
import axios from "axios";

describe("Brevo Email Service", () => {
  it("validates Brevo API key by making a test request", async () => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.warn("BREVO_API_KEY not set, skipping email test");
      expect(true).toBe(true);
      return;
    }

    try {
      // Test the API key by fetching account info (lightweight endpoint)
      const response = await axios.get("https://api.brevo.com/v3/account", {
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
      });

      // If we get here, the API key is valid
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("email");
      console.log("[Email Test] Brevo API key validated successfully");
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error("Brevo API key is invalid. Please check BREVO_API_KEY environment variable.");
      }
      throw error;
    }
  });
});
