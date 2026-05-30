export const graphSchemaTemplate = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.local/ai-engineering-planner/graph.schema.json",
  "title": "ThePlanner Graph",
  "type": "object",
  "required": ["schema_version", "graph_version", "nodes", "edges"],
  "properties": {
    "schema_version": { "type": "string", "enum": ["0.1.0"] },
    "graph_version": { "type": "integer", "minimum": 1 },
    "generated_at": { "type": "string" },
    "source": { "type": "string" },
    "nodes": {
      "type": "object",
      "required": ["requirements", "decisions", "work_items"],
      "properties": {
        "requirements": { "type": "array", "items": { "$ref": "#/$defs/node" } },
        "decisions": { "type": "array", "items": { "$ref": "#/$defs/node" } },
        "assumptions": { "type": "array", "items": { "$ref": "#/$defs/node" } },
        "risks": { "type": "array", "items": { "$ref": "#/$defs/node" } },
        "open_questions": { "type": "array", "items": { "$ref": "#/$defs/node" } },
        "hitl_gates": { "type": "array", "items": { "$ref": "#/$defs/node" } },
        "components": { "type": "array", "items": { "$ref": "#/$defs/node" } },
        "work_items": { "type": "array", "items": { "$ref": "#/$defs/workItem" } },
        "document_projections": { "type": "array", "items": { "$ref": "#/$defs/node" } },
        "execution_slices": { "type": "array", "items": { "$ref": "#/$defs/node" } }
      },
      "additionalProperties": false
    },
    "edges": {
      "type": "array",
      "items": { "$ref": "#/$defs/edge" }
    }
  },
  "additionalProperties": false,
  "$defs": {
    "node": {
      "type": "object",
      "required": ["id", "title"],
      "properties": {
        "id": { "type": "string", "pattern": "^[a-z]+-[0-9]{3}$" },
        "title": { "type": "string", "minLength": 1 },
        "status": { "type": "string" },
        "provenance": { "type": "object" }
      },
      "additionalProperties": true
    },
    "workItem": {
      "type": "object",
      "required": ["id", "title", "execution_state", "readiness_snapshot", "acceptance_criteria", "validation_methods"],
      "properties": {
        "id": { "type": "string", "pattern": "^wi-[0-9]{3}$" },
        "title": { "type": "string", "minLength": 1 },
        "execution_state": {
          "type": "string",
          "enum": ["backlog", "ready", "in_progress", "review", "done", "cancelled", "deferred"]
        },
        "readiness_snapshot": {
          "type": "object",
          "required": ["graph_version", "labels", "reasons"],
          "properties": {
            "graph_version": { "type": "integer", "minimum": 1 },
            "labels": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": ["human_only", "agent_eligible", "afk_ready", "hitl_gated", "blocked"]
              }
            },
            "reasons": { "type": "array", "items": { "type": "string" } }
          },
          "additionalProperties": false
        },
        "acceptance_criteria": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "validation_methods": { "type": "array", "items": { "type": "object" }, "minItems": 1 }
      },
      "additionalProperties": true
    },
    "edge": {
      "type": "object",
      "required": ["source", "target", "type", "rationale"],
      "properties": {
        "source": { "type": "string" },
        "target": { "type": "string" },
        "type": {
          "type": "string",
          "enum": ["depends_on", "blocks", "satisfies", "mitigates", "raises", "references", "supersedes"]
        },
        "rationale": { "type": "string" }
      },
      "additionalProperties": false
    }
  }
}
`;
