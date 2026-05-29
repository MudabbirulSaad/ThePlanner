export type IntakeQuestionGroupId =
  | "target_user"
  | "problem"
  | "mvp_scope"
  | "non_goals"
  | "constraints"
  | "success_criteria"
  | "risks_open_questions";

export interface IntakeQuestion {
  readonly id: string;
  readonly question: string;
}

export interface IntakeQuestionGroup {
  readonly id: IntakeQuestionGroupId;
  readonly title: string;
  readonly questions: readonly IntakeQuestion[];
}

export interface IntakeQuestionSet {
  readonly ideaPreview: string;
  readonly groups: readonly IntakeQuestionGroup[];
}

const maxPreviewLength = 240;

export function generateIntakeQuestions(ideaContent: string): IntakeQuestionSet {
  const ideaPreview = normalizePreview(ideaContent);

  return {
    ideaPreview,
    groups: [
      {
        id: "target_user",
        title: "Target User",
        questions: [
          {
            id: "target_user.primary_user",
            question: "Who is the primary target user, and what role or context are they in when they need this?"
          },
          {
            id: "target_user.current_workaround",
            question: "How does that user solve or work around the problem today?"
          },
          {
            id: "target_user.excluded_users",
            question: "Which users or audiences are explicitly not being optimized for in the first version?"
          }
        ]
      },
      {
        id: "problem",
        title: "Problem",
        questions: [
          {
            id: "problem.pain",
            question: "What concrete pain, cost, delay, or failure does the idea address?"
          },
          {
            id: "problem.frequency",
            question: "How often does the problem happen, and what makes it urgent enough to solve now?"
          },
          {
            id: "problem.evidence",
            question: "What evidence shows this is a real problem rather than an interesting possibility?"
          }
        ]
      },
      {
        id: "mvp_scope",
        title: "MVP Scope",
        questions: [
          {
            id: "mvp_scope.first_workflow",
            question: "What is the single most important end-to-end workflow the MVP must support?"
          },
          {
            id: "mvp_scope.inputs_outputs",
            question: "What inputs must the user provide, and what output should the MVP produce?"
          },
          {
            id: "mvp_scope.manual_steps",
            question: "Which steps can remain manual, mocked, or operationally handled outside the product at first?"
          }
        ]
      },
      {
        id: "non_goals",
        title: "Non-Goals",
        questions: [
          {
            id: "non_goals.v1_exclusions",
            question: "What capabilities should be explicitly excluded from V1 even if they sound useful?"
          },
          {
            id: "non_goals.quality_bar",
            question: "Which production concerns can be deferred, and which cannot be compromised?"
          },
          {
            id: "non_goals.integrations",
            question: "Which platforms, integrations, data sources, or environments are out of scope initially?"
          }
        ]
      },
      {
        id: "constraints",
        title: "Constraints",
        questions: [
          {
            id: "constraints.technical",
            question: "What technical stack, hosting, data, privacy, security, or compliance constraints are fixed?"
          },
          {
            id: "constraints.resources",
            question: "What time, budget, team, skill, or maintenance constraints shape the first build?"
          },
          {
            id: "constraints.dependencies",
            question: "What external services, APIs, accounts, credentials, or approvals could block implementation?"
          }
        ]
      },
      {
        id: "success_criteria",
        title: "Success Criteria",
        questions: [
          {
            id: "success_criteria.user_outcome",
            question: "What user outcome must happen for the MVP to be considered useful?"
          },
          {
            id: "success_criteria.measurement",
            question: "What measurable signals, acceptance tests, or demo scenarios prove the workflow works?"
          },
          {
            id: "success_criteria.failure",
            question: "What result would make you decide the MVP failed or needs a major rethink?"
          }
        ]
      },
      {
        id: "risks_open_questions",
        title: "Risks/Open Questions",
        questions: [
          {
            id: "risks_open_questions.riskiest_assumption",
            question: "What is the riskiest assumption that must be true for this idea to work?"
          },
          {
            id: "risks_open_questions.unknowns",
            question: "What questions need answers before a reliable Planning Graph can be generated?"
          },
          {
            id: "risks_open_questions.validation",
            question: "What quick experiment, prototype, or research step would reduce the biggest uncertainty?"
          }
        ]
      }
    ]
  };
}

function normalizePreview(content: string): string {
  const normalized = content.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxPreviewLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxPreviewLength - 3).trimEnd()}...`;
}
