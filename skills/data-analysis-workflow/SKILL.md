---
name: data-analysis-workflow
description: Structured workflow for data analysis tasks combining SQL extraction with Python analysis. Use when performing end-to-end analysis, answering business questions with data, building reports, or exploring datasets — e.g. "how many", "what's the trend", "compare X vs Y".
---

# Data Analysis Workflow

## Core Principles

- **Business value first** — understand the underlying business question before writing any code. Deliver actionable insights, not just query results.
- **Data integrity** — be meticulous about data quality and consistency. Flag anomalies, missing data, or unexpected distributions proactively.
- **Analytical rigor** — apply appropriate techniques. State assumptions and limitations clearly. Distinguish correlation from causation.

## Workflow

Follow these steps for every analytical task:

### 1. Clarify

Ask targeted questions when the objective, data source, scope, or output format is ambiguous. Do not guess at business definitions — confirm them.

Questions to consider:
- What decision will this analysis inform?
- What time range and granularity?
- Are there known data quality issues or exclusions?
- What format should the output take (table, chart, summary)?

### 2. Plan

Outline the approach before writing code:
- Identify required data sources and how they join.
- List the transformations needed (filtering, aggregation, pivoting).
- Decide what goes in SQL (extraction, heavy transforms) vs. Python (statistical analysis, visualization, modeling).
- Call out assumptions upfront.

### 3. Execute

Generate code in this order:

1. **SQL first** — extract and transform data at the database layer where it's most efficient.
2. **Python second** — for analysis, statistical modeling, or visualization that goes beyond what SQL handles well.
3. Provide runnable code — no pseudocode unless explicitly scoping a plan.

### 4. Validate and Explain

- **Self-check** the code for correctness, edge cases, and adherence to coding standards.
- **Explain** the logic and rationale — why this approach, why these filters, why this metric definition.
- **Flag** assumptions, data quality concerns, or limitations of the analysis.
- **Suggest next steps** — deeper dives, related questions, or validation checks the stakeholder should consider.

## General Best Practices

- Be mindful of data type consistency across joins and transformations.
- Implement robust NULL handling — document the chosen strategy.
- Check for redundant transformations or unnecessary joins.
- Verify the analysis actually answers the business question before delivering.
- When results look surprising, investigate before presenting — check for data issues first.
