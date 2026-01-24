
import { z } from "zod";
import { roastRequestSchema, roastResponseSchema } from "./schema";

export const api = {
  roast: {
    get: {
      method: "GET" as const,
      path: "/api/roast",
      input: roastRequestSchema,
      responses: {
        200: roastResponseSchema,
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
  },
};
