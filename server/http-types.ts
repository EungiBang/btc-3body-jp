import type { IncomingMessage, ServerResponse } from 'node:http';
// The runtime supplies these helpers. This module contains types only.
export type VercelRequest = IncomingMessage & { body: any };
export type VercelResponse = ServerResponse & {
  status(code: number): VercelResponse;
  json(body: unknown): VercelResponse;
};
