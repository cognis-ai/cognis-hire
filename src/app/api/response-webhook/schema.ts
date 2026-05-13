import { z } from "zod";

// Zod schema for Retell webhook bodies.
//
// Retell evolves the payload over time and adds new fields without notice, so
// we use `.passthrough()` to keep unknown keys around and only fail on the
// fields we actually depend on. `event` and `call.call_id` are the only
// load-bearing fields for our handler today; everything else is opportunistic.
//
// Events we care about: `call_started`, `call_ended`, `call_analyzed`. We
// accept any string to stay forward-compatible — the route's switch falls
// through to a default log for unknown events.
export const RetellWebhookSchema = z
  .object({
    event: z.string(),
    call: z
      .object({
        call_id: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

export type RetellWebhook = z.infer<typeof RetellWebhookSchema>;
