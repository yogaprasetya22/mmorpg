/**
 * Prompts index — barrel + list registration.
 *
 * Location: packages/mcp/src/prompts/index.ts
 */

import type { OperationsState } from "../operations/world-operations";
import type { PromptEntry } from "./types";
import { fromBriefPrompt } from "./from-brief";
import { iterateOnFeedbackPrompt } from "./iterate-on-feedback";
import { regionStyleTransferPrompt } from "./region-style-transfer";

export function getPrompts(ops: OperationsState): PromptEntry[] {
    return [
        {
            name: "from_brief",
            description: "Teks deskripsi → world operations plan",
            handler: (a) => fromBriefPrompt(ops, a),
        },
        {
            name: "iterate_on_feedback",
            description: "Revisi layout berdasarkan feedback",
            handler: (a) => iterateOnFeedbackPrompt(ops, a),
        },
        {
            name: "region_style_transfer",
            description: "Ubah style area (hutan → pedesaan)",
            handler: (a) => regionStyleTransferPrompt(ops, a),
        },
    ];
}

export { type PromptEntry, type PromptHandler } from "./types";
