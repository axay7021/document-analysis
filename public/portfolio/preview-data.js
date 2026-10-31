// Review-only sample data. Loaded exclusively on localhost with ?preview=1.
export const previewDocument = {
  name: 'Product launch brief.md',
  agentId: 'local-layout-sample',
  text: `PRODUCT LAUNCH BRIEF — SAMPLE DOCUMENT

Overview
The team is preparing a document research workspace for an initial pilot. The objective is to help readers turn long documents into clear answers, with traceable references. The pilot focuses on a small group of researchers and project managers.

Key takeaways
The primary experience is a conversation with one selected document. The reading area should use the full available height. Sources should be available on demand rather than permanently taking space from the conversation. Users must be able to switch documents without mixing their conversations.

Next steps
Design: validate the desktop workspace and mobile drawers with five pilot users.
Engineering: verify upload, sign-in, streaming responses and source references.
Product: collect feedback on answer readability and how easily users find supporting evidence.

Acceptance criteria
Long answers remain readable at 375px and 1440px. The question composer stays visible while chat history scrolls. Sources can be opened and closed with a keyboard. Enter sends a question; Shift + Enter adds a new line. A document switch preserves the previous conversation for the current browser tab.

Pilot boundaries
This is a fictional brief for reviewing the interface. It is not an uploaded user document. Local preview responses quote this sample only and do not use an AI provider.`,
}
export function sampleAnswer(question) {
  if (/next|action|step|decision/i.test(question)) return {
    answer: `## Next steps in the sample brief\n\nThe brief assigns three follow-up actions:\n\n- **Design:** validate the desktop workspace and mobile drawers with five pilot users.\n- **Engineering:** verify upload, sign-in, streaming responses and source references.\n- **Product:** collect feedback on answer readability and how easily users find supporting evidence.\n\nThe brief does not specify a deadline for these actions.`,
    evidence: previewDocument.text.split('Next steps\n')[1].split('\n\nAcceptance criteria')[0],
  }
  if (/accept|criteria|detail/i.test(question)) return {
    answer: `## Acceptance criteria\n\nThe sample brief defines five requirements:\n\n- Long answers remain readable at **375px and 1440px**.\n- The question composer stays visible while chat history scrolls.\n- Sources can be opened and closed with a keyboard.\n- **Enter** sends a question; **Shift + Enter** adds a new line.\n- Switching documents preserves the previous conversation for the current browser tab.\n\nThese are the requirements in this fictional sample, rather than results from a live product evaluation.`,
    evidence: previewDocument.text.split('Acceptance criteria\n')[1].split('\n\nPilot boundaries')[0],
  }
  if (/takeaway|summar|picture|overview/i.test(question)) return {
    answer: `## A workspace built around the conversation\n\nThe sample brief describes a document research workspace for a small pilot of researchers and project managers. Its goal is to turn long documents into clear answers with traceable references.\n\n### The key takeaways\n\n- **Put the conversation first.** The primary experience is a chat with one selected document, with a reading area that uses the full available height.\n- **Keep sources close, without crowding the answer.** Supporting evidence should open on demand, so the conversation keeps its space.\n- **Keep each document's context separate.** Switching documents should preserve the previous conversation in the current browser tab.\n\n### What happens next\n\nDesign will validate the desktop workspace and mobile drawers with five pilot users. Engineering will verify upload, sign-in, streamed answers and source references. Product will collect feedback on readability and source discovery.\n\n### What a successful pilot needs\n\nThe brief calls for readable answers on phone and desktop screens, a composer that remains visible while reading, keyboard access to sources, and predictable document switching.\n\nThis is a sample response for reviewing the layout. Open **View source** below to see the exact supporting passage from the fictional brief.`,
    evidence: previewDocument.text.split('Key takeaways\n')[1].split('\n\nNext steps')[0],
  }
  return { answer: 'This local preview has three sample responses: key takeaways, next steps, and acceptance criteria. Try one of those questions to review the chat layout. Live answers will continue to use the connected backend after sign-in.', evidence: previewDocument.text }
}
