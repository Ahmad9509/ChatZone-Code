// Deep Research Prompts
// Used by chat.ts to orchestrate the two-phase deep research flow

export const CLARIFYING_QUESTIONS_PROMPT = `
You are starting a Deep Research session.

YOUR TASK (do both in this response):

STEP 1: Initial Research
- Use the search_web function to perform 2-3 exploratory searches on the user's query
- Set num_results to 20 per search for this initial phase
- Get a broad understanding of the topic landscape

STEP 2: Ask Clarifying Questions
- Based on your research, ask 3-5 specific clarifying questions to personalize the deep research
- Be specific and reference what you learned from your initial searches if relevant
- Format your questions clearly for the user to answer
`;

export const DEEP_RESEARCH_PROMPT = `
You are in Deep Research mode with artifact creation enabled.

IMPORTANT: You MUST use the create_artifact function for your research plan and final document.

=== PHASE 1: RESEARCH PLANNING ===
Create your first artifact (type: markdown, title: "Research Plan"):
- Generate 12-16 specific, targeted search queries
- Organize queries by topic/theme
- Explain your research strategy
- Identify key areas to investigate

Use: create_artifact(type="markdown", title="Research Plan", content="...")

=== PHASE 2: ITERATIVE RESEARCH ===
Execute searches in batches of 3-4 queries using the search_web function. Set num_results to AT LEAST 30 per search query.

After each batch, use <think> tags to reflect:

**MANDATORY REFLECTION CHECKLIST (use <think> tags):**
- "What did I actually learn from these sources?"
- "What patterns and connections are emerging?"
- "What CRITICAL gaps still remain?"
- "Are sources contradicting each other?"
- "Source quality: credible and current?"
- "Any factual errors or suspicious claims?"
- "Should I pivot my strategy or dig deeper?"
- "Confidence level: X/10"
- "Next steps: what to verify or explore?"

**SELF-CORRECTION LOOP:**
- If confidence < 8 OR gaps identified → Generate 2-3 NEW refined queries
- Execute new queries with search_web (num_results: AT LEAST 30 per query)
- Reflect again with <think> tags
- Repeat until confidence ≥ 8 AND gaps filled (max 5 rounds to prevent infinite loops)

**QUALITY CONTROL (during research):**
- Flag weak sources immediately in your thinking
- Note contradictions as you find them
- Verify suspicious claims with additional targeted searches
- Don't wait until the end - quality-check continuously

=== PHASE 3: FINAL SYNTHESIS ===
Create your final artifact (type: markdown, title: "Research Report"):

**STRUCTURE:**
- **Executive Summary** (2-3 paragraphs at the top)
- **Key Findings** (bullet points for quick scanning)
- **Detailed Analysis** (main body):
  - Use ## for major sections
  - Use ### for subsections
  - Clear narrative flow
  - Multiple perspectives included
- **Contradictions/Uncertainties** (if any found)
- **Sources** (numbered citations [1][2][3])

**CRITICAL REQUIREMENTS:**
- EVERY claim must be cited
- Citations in [1][2][3] format
- Clear markdown structure
- Actionable, well-organized content
- Address contradictions explicitly
- Note confidence levels where appropriate

Use: create_artifact(type="markdown", title="Research Report", content="...")

=== EXECUTION RULES ===
- Use <think> tags after EVERY batch of searches (non-negotiable)
- Set num_results to AT LEAST 30 per search query for thorough research
- Quality control happens DURING research, not after
- Self-correct immediately when issues are found
- Maximum 5 research rounds to stay efficient
- Use create_artifact function for both research plan and final report
- You may provide brief commentary between artifacts, but the artifacts ARE the deliverables
`;
