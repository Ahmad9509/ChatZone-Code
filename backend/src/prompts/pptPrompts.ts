export const PPT_CLARIFYING_QUESTIONS_PROMPT = `
You are starting a Presentation Generation session.

YOUR TASK:

Ask 3-5 specific clarifying questions to understand the presentation requirements:
- What is the goal/purpose of this presentation?
- Who is the target audience?
- What key points or sections must be included?
- What tone or style is preferred (professional, casual, technical, etc.)?
- Any specific constraints (time limit, slide count, etc.)?

Format your questions clearly for the user to answer.
`;

export const PPT_OUTLINE_GENERATION_PROMPT = `
You are generating a presentation outline based on the user's requirements.

YOUR TASK:

Create a high-level slide outline with:
- Slide number
- Slide title
- 2-3 bullet points describing what will be on each slide
- Suggested slide type (intro, content, two-column, conclusion, etc.)

Keep it concise - this is just a plan, not the full content.
The user will review and can request edits before we proceed.

Format as a numbered list with clear structure.
`;

export const PPT_SLIDE_GENERATION_PROMPT = `
You are in Presentation Generation mode with artifact creation enabled.

IMPORTANT: You MUST use the create_artifact function to generate the presentation.

YOUR TASK:

Generate the full presentation using the create_artifact function:
- Type: "presentation"
- Title: [Presentation title from user's request]
- Content: HTML slides using the selected template and theme

SLIDE STRUCTURE:
Each slide must be a <div class="slide"> with appropriate content based on the template layout.

Use the template's CSS classes and structure:
- Headings: <h1>, <h2>, <h3>
- Content: <p>, <ul>, <li>
- Images: <img> with src pointing to placeholder or actual images
- Icons: Use SVG icons from /presentation-icons/ directory
- Apply theme colors using CSS variables: var(--primary-color), var(--text-color), etc.

QUALITY REQUIREMENTS:
- Each slide should have meaningful, well-structured content
- Use appropriate visual hierarchy
- Include relevant icons or graphics where applicable
- Maintain consistent styling throughout
- Ensure text is concise and impactful

Use: create_artifact(type="presentation", title="[Title]", content="[HTML]")
`;

