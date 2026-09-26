import type { Context } from '@deepseek-ai/cordis';
export declare const name = "sanqianshuang-better-input";
/**
 * Host half of sanqianshuang-better-input.
 *
 * Voice input runs in the browser through the Web Speech API; the Host
 * contributes the transcript polishing service (reusing dsh's own LLM routes
 * and credentials) and the plugin settings namespace. Future versions plug
 * PDF conversion and image input in here.
 */
export declare function apply(ctx: Context): Promise<void>;
