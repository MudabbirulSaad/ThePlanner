export type RefinedBriefSectionId =
  | "product_summary"
  | "users"
  | "goals"
  | "mvp_scope"
  | "non_goals"
  | "constraints"
  | "success_criteria"
  | "open_questions";

export interface RefinedBriefSection {
  readonly id: RefinedBriefSectionId;
  readonly title: string;
  readonly prompt: string;
}

export interface RefinedBriefScaffoldInput {
  readonly sourcePath: string;
  readonly sourceContent: string;
}

export const refinedBriefSections: readonly RefinedBriefSection[] = [
  {
    id: "product_summary",
    title: "Product Summary",
    prompt: "TODO: Summarize the product, problem, and intended outcome in a few paragraphs."
  },
  {
    id: "users",
    title: "Users",
    prompt: "TODO: Identify primary users, secondary users, and users explicitly out of scope."
  },
  {
    id: "goals",
    title: "Goals",
    prompt: "TODO: List the concrete user and business outcomes this version should achieve."
  },
  {
    id: "mvp_scope",
    title: "MVP Scope",
    prompt: "TODO: Define the smallest coherent product scope for the first planning graph."
  },
  {
    id: "non_goals",
    title: "Non-Goals",
    prompt: "TODO: List capabilities, audiences, integrations, or quality bars intentionally deferred."
  },
  {
    id: "constraints",
    title: "Constraints",
    prompt: "TODO: Capture technical, legal, operational, design, timeline, and team constraints."
  },
  {
    id: "success_criteria",
    title: "Success Criteria",
    prompt: "TODO: Describe measurable signals that indicate the MVP solved the right problem."
  },
  {
    id: "open_questions",
    title: "Open Questions",
    prompt: "TODO: Track unresolved decisions and information needed before graph planning."
  }
] as const;

export function renderRefinedBriefScaffold(input: RefinedBriefScaffoldInput): string {
  return [
    "# Refined Brief",
    "",
    `Source idea: ${input.sourcePath}`,
    "",
    "This Markdown file is user-owned. Fill in the TODOs before running graph planning.",
    "",
    "## Raw Idea",
    "",
    fenceMarkdown(input.sourceContent.trim() || "TODO: Add the raw product idea."),
    "",
    ...refinedBriefSections.flatMap((section) => [`## ${section.title}`, "", section.prompt, ""])
  ].join("\n");
}

function fenceMarkdown(content: string): string {
  const fence = content.includes("```") ? "````" : "```";
  return [fence, content, fence].join("\n");
}
