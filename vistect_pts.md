# Vistect

## Product and Technical Specification

**Version:** 1.0  
**Initial product:** WebMCP-native visual document understanding and creation studio  
**Primary users:** Blind and low-vision professionals, students, researchers, educators, nonprofit leaders, freelancers, and business owners  
**Initial document output:** Multipage PDF with an accessible HTML companion  
**Initial supported project type:** Professional multipage reports  

---

## 1. Executive Summary

Vistect is a privacy-conscious, accessible, WebMCP-native workspace where blind and low-vision users can independently:

1. Open and understand visually complex multipage documents.
2. Inspect images, charts, diagrams, tables, page layouts, and visual hierarchy.
3. Create new multipage visual documents from text, data, images, and structured instructions.
4. Upload, compare, select, crop, place, and describe images.
5. Generate and edit diagrams through structured graph operations.
6. Import data and create accessible, defensible charts.
7. Select and maintain a consistent icon vocabulary.
8. Detect layout, accessibility, chart, and diagram defects.
9. Review every consequential visual decision made by an agent.
10. Approve and export the exact document version they inspected.

The product does not replace the user's screen reader and does not make unrestricted visual decisions on the user's behalf. It gives the user a semantic representation of the visual artifact and exposes precise document operations to their chosen browser agent through WebMCP.

> **Core promise:** Existing tools help blind people understand visual content created by others. Vistect enables blind people to understand, author, inspect, verify, and publish visual communication of their own.

---

## 2. Problem Definition

Blind people can independently write the textual content of reports, proposals, assignments, articles, research papers, and business documents. However, visual production commonly creates a dependency on another person.

Typical assistance requests include:

- Which photograph is appropriate for this report?
- Does this image communicate independence or charity?
- Is the image cropped correctly?
- Is the page visually balanced?
- Are these icons visually consistent?
- Does this diagram contain missing or confusing paths?
- Does the chart honestly communicate the data?
- Is any text hidden, truncated, or overlapping?
- Does the document look professional?
- Can I safely send the exported PDF?

This creates recurring disability taxes in:

- Time
- Privacy
- Dependence
- Coordination
- Creative control
- Employment participation
- Educational participation
- Verification effort
- Revision cycles

### 2.1 Capability transformation

#### Before

A blind author writes a report but requires a sighted collaborator to select imagery, construct diagrams, arrange content, inspect visual quality, and approve the final artifact.

#### After

The author independently understands existing visual documents and creates new visual documents by controlling semantic document objects. The agent proposes and executes structured operations; deterministic systems validate measurable properties; the user reviews subjective decisions and gives final approval.

---

## 3. Product Positioning

### 3.1 Product category

**Agent-native accessible visual document workspace**

### 3.2 What Vistect is

- A visual document reader and understanding system
- A multipage visual document creator
- A semantic visual canvas
- A structured image-selection and placement system
- A diagram authoring and validation system
- An accessible chart authoring system
- A visual decision and provenance ledger
- A layout and accessibility auditor
- A WebMCP tool provider
- A version-bound export system

### 3.3 What Vistect is not

- A generic PDF chatbot
- A screen reader replacement
- A generic voice assistant
- A Canva clone
- A full Microsoft Word clone
- A Photoshop replacement
- An unrestricted autonomous design agent
- A promise of perfect aesthetic judgment
- A universal arbitrary-PDF editor
- A guarantee of PDF/UA conformance in the initial release

### 3.4 Initial constrained use case

The first production-quality workflow will support **professional multipage impact reports** of approximately 3 to 20 pages.

Typical examples include:

- Nonprofit impact reports
- Program reports
- Project proposals
- Research summaries
- Educational reports
- Consulting deliverables
- Small-business reports
- Policy briefs

---

## 4. Product Principles

### 4.1 The user remains the visual author

The agent may recommend and operate tools, but the user controls the message, representation, and final approval.

### 4.2 Semantic control before coordinate control

Users should say:

- Place the image after the introduction.
- Make the chart the primary visual.
- Align the three icons.
- Keep the caption with the image.
- Put the diagram on a separate page.

Users should not need to provide raw `x` and `y` coordinates.

### 4.3 Facts, model judgments, and human decisions must be separated

The application must label:

- Deterministic facts
- AI-assisted interpretations
- Uncertain observations
- Human decisions

### 4.4 Every consequential agent action must be inspectable

The user must be able to determine:

- What changed
- Why it changed
- Which tool changed it
- What source supported it
- Whether it remains unapproved
- How to undo it

### 4.5 Accessibility is part of the core data model

Reading order, alternative text, long descriptions, chart tables, semantic roles, focus behavior, and approval state are not optional metadata added at export time.

### 4.6 Privacy must be observable

The system should show what is processed locally, what leaves the device, why remote processing is needed, and what is retained.

### 4.7 Deterministic validation must not be replaced by AI opinion

Geometry, graph topology, contrast, overflow, chart values, and version matching must use deterministic checks whenever possible.

---

## 5. Core Product Modes

## 5.1 Understand Mode

Understand Mode provides nonvisual access to an existing visual document.

### Inputs

- PDF
- Scanned PDF
- PNG
- JPEG
- WebP
- Structured SVG
- CSV for associated chart analysis

### Capabilities

- Detect document title, language, page count, sections, and headings
- Reconstruct logical reading order
- Describe page structure and spatial hierarchy
- Identify images, charts, diagrams, tables, captions, icons, sidebars, headers, and footers
- Extract labels and values from charts when reliable
- Reconstruct diagram nodes and relationships when reliable
- Provide semantic and spatial views
- Surface uncertainty
- Compare pages or visual elements
- Identify accessibility defects
- Convert supported documents into editable Vistect projects

### Example questions

- Give me an overview of this report.
- What visual elements are on page six?
- Describe the visual hierarchy of the cover.
- Explain the diagram and trace every path.
- What claim does the chart appear to support?
- Does the chart match the source table?
- Which images are informative and which appear decorative?
- Which visual interpretations are uncertain?
- Compare the charts on pages four and seven.
- Describe how a sighted reader is likely to experience the document.

### Semantic page output

```text
Page 4: Employment Outcomes

1. Heading: Employment outcomes
2. Introductory paragraph
3. Horizontal bar chart with four categories
4. Chart caption
5. Source note
```

### Spatial page output

```text
The heading appears at the upper left.
The introductory paragraph occupies the upper third.
The chart is the dominant visual and fills most of the center and lower page.
The source note appears directly below the chart in smaller text.
```

---

## 5.2 Create Mode

Create Mode lets the user construct a new multipage document or redesign an imported document.

### Capabilities

- Create a document from scratch
- Generate pages from a user-approved outline
- Add and edit headings, paragraphs, quotations, statistic cards, captions, and callouts
- Upload images and logos
- Compare image candidates
- Crop and place images semantically
- Search and apply curated icons
- Build charts from imported data
- Generate and edit structured diagrams
- Apply accessible page templates
- Reorder pages and content
- Set visual priority
- Set reading order
- Add alternative text and long descriptions
- Audit the document
- Approve decisions and lock versions
- Export PDF, accessible HTML, and structured visual assets

---

## 5.3 Inspect and Verify Mode

Creation and understanding must form a continuous loop:

```text
Agent proposes
      ↓
Application renders
      ↓
User understands
      ↓
Deterministic systems validate
      ↓
User corrects or approves
      ↓
Approved version is locked
```

The user can inspect objects created by the agent with the same reader used to understand imported documents.

---

## 6. Primary User Workflows

## 6.1 Understand an existing document

1. Upload a PDF.
2. Parse text, pages, objects, and visual relationships.
3. Present a semantic document overview.
4. Expose uncertainty and parsing limitations.
5. Allow page, heading, image, chart, diagram, table, and warning navigation.
6. Answer structured questions using document state.
7. Optionally convert supported content into an editable project.

## 6.2 Create a document from scratch

1. Define the Intent Contract.
2. Import or write content.
3. Approve a document outline.
4. Apply page templates.
5. Upload images and data.
6. Create charts and diagrams.
7. Add icons and captions.
8. Run page-level checks.
9. Run document-level checks.
10. Review all unresolved decisions.
11. Lock the document version.
12. Export PDF and accessible HTML.

## 6.3 Import, understand, and redesign

1. Upload an existing PDF.
2. Understand its semantic and visual organization.
3. Detect accessibility and design issues.
4. Convert supported elements into an editable project.
5. Update content, images, charts, diagrams, and branding.
6. Validate the reconstructed document.
7. Export a new accessible artifact.

---

## 7. Intent Contract

Each project begins with a structured document brief.

### Fields

- Document type
- Purpose
- Audience
- Primary message
- Secondary messages
- Desired tone
- Concepts or stereotypes to avoid
- Brand colors
- Brand fonts
- Visual style
- Required visual elements
- Accessibility requirements
- Image sourcing preference
- Privacy sensitivity
- Export requirements

### Example

```yaml
document_type: Annual impact report
audience:
  - Funders
  - Corporate partners
primary_message: The program creates measurable independence and employment.
tone:
  - Professional
  - Credible
  - Human
  - Optimistic
avoid:
  - Charity framing
  - Pity
  - Medical imagery
  - Infantilization
  - Technology clichés
brand_colors:
  primary: "#102A43"
  accent: "#008C95"
  background: "#FFFFFF"
required_visuals:
  cover_images: 1
  charts: 3
  process_diagrams: 2
  statistic_icons: 3
accessibility_requirements:
  contextual_alt_text: true
  chart_data_tables: true
  diagram_long_descriptions: true
  no_color_only_meaning: true
```

The system evaluates visual recommendations against this contract but must not treat aesthetic alignment as an objective fact.

---

## 8. Semantic Document Model

The document is stored as structured data rather than an unstructured bitmap canvas.

### 8.1 High-level hierarchy

```text
Document
├── Metadata
├── Intent Contract
├── Theme
├── Pages
│   ├── Regions
│   └── Objects
├── Assets
├── Data sources
├── Visual decisions
├── Validation findings
├── Accessibility metadata
├── Versions
└── Export manifests
```

### 8.2 TypeScript-style model

```typescript
type DocumentProject = {
  id: string;
  title: string;
  language: string;
  documentType: "impact-report";
  intentContract: IntentContract;
  theme: Theme;
  pages: Page[];
  assets: Asset[];
  datasets: Dataset[];
  decisions: VisualDecision[];
  findings: ValidationFinding[];
  versions: DocumentVersion[];
  activeVersion: number;
  approvalStatus: "draft" | "review" | "locked" | "exported";
};

type Page = {
  id: string;
  pageNumber: number;
  templateId: string;
  title?: string;
  objects: DocumentObject[];
  readingOrder: string[];
  status: "draft" | "review" | "approved" | "locked";
};

type DocumentObject =
  | TextObject
  | ImageObject
  | IconObject
  | ChartObject
  | DiagramObject
  | TableObject
  | ShapeObject;

type BaseObject = {
  id: string;
  pageId: string;
  role: string;
  purpose?: string;
  bounds: Bounds;
  relativeConstraints: RelativeConstraint[];
  layer: number;
  readingOrderIndex?: number;
  accessibility: AccessibilityMetadata;
  source: Provenance;
  approval: ApprovalState;
  createdBy: "user" | "agent" | "import";
  versionCreated: number;
  versionModified: number;
};
```

### 8.3 Accessibility metadata

```typescript
type AccessibilityMetadata = {
  isDecorative: boolean;
  altText?: string;
  longDescription?: string;
  accessibleName?: string;
  accessibleRole?: string;
  includedInReadingOrder: boolean;
  language?: string;
  warnings: string[];
};
```

### 8.4 Approval state

```typescript
type ApprovalState = {
  status: "unreviewed" | "proposed" | "approved" | "rejected" | "stale";
  approvedBy?: string;
  approvedAt?: string;
  approvedVersion?: number;
  decisionId?: string;
};
```

---

## 9. Reader and Understanding Features

### 9.1 Document overview

Return:

- Page count
- Section count
- Heading hierarchy
- Object counts by type
- Visual density
- Detected language
- Reading-order status
- Accessibility warnings
- Low-confidence interpretations

### 9.2 Semantic navigation

Navigate by:

- Page
- Heading
- Paragraph
- Image
- Chart
- Diagram
- Table
- Icon
- Caption
- Footnote
- Warning
- Unapproved decision
- Agent-created object

### 9.3 Spatial narration

Describe:

- Relative object positions
- Dominant visual
- Visual hierarchy
- Alignment
- Grouping
- whitespace distribution
- page density
- repeated layout patterns
- cross-page consistency

### 9.4 Image understanding

Separate outputs into:

- High-confidence observations
- Model interpretations
- Uncertain observations
- Detected text
- Composition
- likely purpose
- sensitive content warning
- source and license status

### 9.5 Chart understanding

Provide:

- Chart type
- Title
- Axes
- Series
- Categories
- Values
- Highest and lowest values
- Trends
- Outliers
- Source data linkage
- Accessibility defects
- Potentially misleading visual choices

### 9.6 Diagram understanding

Provide:

- Diagram type
- Node list
- Edge list
- Groups
- Decisions
- Entry and exit points
- Primary path
- Alternative paths
- unreachable nodes
- cycles
- spatial organization
- visual defects

### 9.7 Uncertainty handling

The reader must never silently convert uncertain visual interpretation into fact.

Example:

```text
Agreed observation:
Three adults are seated around a table.

Uncertain observation:
One analysis detected a mobility aid near the left edge.
A second analysis classified the object as office furniture.

Recommended handling:
Do not mention the object in final alt text without additional verification.
```

---

## 10. Multipage Document Creation Features

### 10.1 Page templates

Initial templates:

1. Cover
2. Text-led page
3. Text with side image
4. Full-width image and caption
5. Statistics page
6. Chart page
7. Diagram page
8. Participant story
9. Recommendations page
10. Conclusion and contact page

### 10.2 Text features

- Headings levels 1 to 4
- Paragraphs
- Bulleted and numbered lists
- Quotations
- Callout boxes
- Statistic cards
- Captions
- Footnotes and source notes
- Page breaks
- Section breaks
- Hyperlinks

### 10.3 Layout features

- Apply template
- Place before or after another object
- Align left, right, center, top, or bottom
- Distribute evenly
- Group objects
- Keep objects together
- Set primary or secondary visual priority
- Move object to another page
- Change reading order independently of visual order
- Set document-wide margins and spacing

### 10.4 Cross-page consistency

Check:

- Heading placement
- Page margins
- Footer placement
- Image style
- Caption style
- Icon family
- Chart theme
- Diagram theme
- color palette
- typography
- visual pacing
- excessive repeated layouts

---

## 11. Image Studio

### 11.1 Supported sources

- User upload
- Organization asset library
- Curated icon or image provider
- AI-generated image
- Imported image from existing document

### 11.2 Supported formats

- JPEG
- PNG
- WebP
- SVG where safe and parseable

### 11.3 Asset record

```typescript
type ImageAsset = {
  id: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  sourceType: "upload" | "generated" | "library" | "import";
  sourceReference?: string;
  license?: string;
  localOnly: boolean;
  detectedText?: string[];
  observations: Observation[];
  interpretations: Interpretation[];
  uncertainties: Uncertainty[];
  qualityFindings: ValidationFinding[];
};
```

### 11.4 Image comparison criteria

- Intent alignment
- Subject relevance
- Composition
- Emotional tone
- Professional quality
- Representation
- Potential stereotype or charity framing
- Crop flexibility
- title-safe area
- distracting details
- visual complexity
- source and license
- resolution
- model confidence and disagreement

### 11.5 Semantic cropping

Supported instructions:

- Keep the main subject visible.
- Keep all detected faces visible.
- Preserve the subject's hands.
- Remove the sign on the right.
- Leave title space on the left.
- Create a square crop.
- Use a full-width header crop.
- Center the primary subject.

### 11.6 Crop validation

Check:

- Face truncation
- Subject truncation
- resolution after crop
- aspect ratio
- title-safe region
- focal point
- important detected text
- object loss

### 11.7 Contextual alt text

Alt text must consider:

- The visual's purpose in the document
- Nearby text
- Information already presented elsewhere
- The intended audience
- Whether the object is decorative
- Uncertain visual claims

The user reviews and approves final alt text.

---

## 12. Diagram Studio

### 12.1 Initial diagram types

- Process flow
- Decision tree
- Journey map
- System architecture
- Organizational structure

### 12.2 Graph model

```typescript
type Diagram = {
  id: string;
  title: string;
  diagramType: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups: DiagramGroup[];
  layout: DiagramLayout;
  entryNodeIds: string[];
  terminalNodeIds: string[];
  accessibility: AccessibilityMetadata;
};
```

### 12.3 Diagram operations

- Create diagram
- Add node
- Update node
- Remove node
- Connect nodes
- Remove connection
- Add decision outcomes
- Create groups
- Apply layout
- Move node semantically
- Trace path
- List incoming and outgoing connections
- Generate short description
- Generate long description
- Export SVG and PNG

### 12.4 Structural validation

- Disconnected nodes
- Unreachable nodes
- Missing decision outcomes
- Invalid or unexpected cycles
- Missing entry or terminal nodes
- Duplicate edges
- Ambiguous edge labels

### 12.5 Visual validation

- Edge crossings
- Connector-label collisions
- Node overlaps
- Label overflow
- crowded regions
- inconsistent node dimensions
- excessive connector bends
- reading-order mismatch
- insufficient contrast
- color-only meaning

### 12.6 Accessible diagram output

Every diagram should provide:

- Structured SVG
- PNG preview
- Keyboard-navigable HTML graph
- Node and connection list
- Primary and alternative route descriptions
- Short alt text
- Long description
- Optional tactile-oriented SVG profile

---

## 13. Chart Studio

### 13.1 Initial chart types

- Horizontal bar chart
- Vertical bar chart
- Line chart

Optional after the initial release:

- Stacked bar chart
- Area chart
- Scatter plot

### 13.2 Inputs

- CSV upload
- Manual table entry
- Copy and paste table
- Extracted table from an imported document, with user verification

### 13.3 Chart recommendation criteria

- Categorical versus temporal data
- Number of series
- Number of categories
- Label lengths
- Comparison goal
- trend goal
- composition goal
- intended message
- accessibility
- potential for misinterpretation

### 13.4 Chart integrity checks

- Visual values match source values
- Axis labels present
- Units present
- category labels fit
- legend entries match series
- baseline review
- time axis ordering
- percentages and totals are coherent
- color-only distinction avoided
- source note present
- data table present
- narrative does not contradict values

### 13.5 Synchronized outputs

Each chart includes:

1. Visual SVG or canvas rendering
2. Accessible data table
3. Short narrative interpretation
4. Optional sonification
5. Source data reference
6. Chart accessibility metadata

---

## 14. Icon and Visual Vocabulary Studio

### 14.1 Document-wide icon system

Store:

- Icon family
- Stroke weight
- corner style
- fill style
- primary color
- accent color
- size classes
- semantic assignments

### 14.2 Icon checks

- Style consistency
- stroke consistency
- filled versus outline mismatch
- inconsistent size
- alignment
- ambiguous metaphor
- repeated meaning
- cultural ambiguity
- color-only meaning
- accidental medical or charity framing

### 14.3 User control

The user can compare metaphors and select one based on the intended meaning rather than accepting the first icon suggested by an agent.

---

## 15. Visual Decision Ledger

Every consequential visual decision is recorded.

### Decision types

- Page structure
- Image selection
- Image crop
- image placement
- icon metaphor
- icon family
- chart type
- chart styling
- diagram structure
- diagram layout
- page template
- visual priority
- reading order
- alt text
- long description
- export format

### Example

```yaml
decision: Select cover image
options_reviewed: 3
selected: image_candidate_3
selection_reason: Best represents independent professional work.
rejected:
  - candidate: image_candidate_1
    reason: Handshake may imply external rescue.
  - candidate: image_candidate_2
    reason: Instructor visually dominates participants.
suggested_by: browser_agent
approved_by: user
status: locked
version: 12
```

### Required operations

- List unreviewed decisions
- Inspect alternatives
- Approve decision
- Reject decision
- Request new alternatives
- Undo decision
- Mark decision stale after upstream changes

---

## 16. Validation Framework

Validation findings must identify whether they are deterministic or subjective.

### 16.1 Finding model

```typescript
type ValidationFinding = {
  id: string;
  scope: "object" | "page" | "document";
  targetId: string;
  category: string;
  severity: "info" | "warning" | "error" | "blocking";
  evidenceType: "deterministic" | "model_assessment" | "human_review";
  summary: string;
  evidence: string[];
  confidence?: number;
  suggestedActions: SuggestedAction[];
  status: "open" | "accepted" | "resolved" | "dismissed";
};
```

### 16.2 Deterministic checks

#### Layout

- Overlap
- out-of-bounds elements
- alignment
- spacing consistency
- margins
- empty placeholders
- crowded regions
- excessive whitespace

#### Text

- Overflow
- truncation
- minimum size thresholds
- inconsistent heading hierarchy
- missing headings
- orphan headings

#### Color

- Contrast ratios
- color-only distinctions
- palette violations

#### Images

- Missing alternative text
- resolution
- aspect-ratio distortion
- source metadata
- crop boundaries

#### Charts

- Data mismatch
- missing labels
- truncated labels
- baseline anomalies
- missing table
- missing source

#### Diagrams

- Disconnected and unreachable nodes
- missing decision paths
- cycles
- edge crossings
- overlaps
- label collisions

#### Accessibility

- Reading-order defects
- missing language
- missing title
- decorative object exposure
- meaningful object exclusion
- inaccessible object names

### 16.3 Subjective AI assessments

- Weak visual hierarchy
- tone mismatch
- potential stereotype
- crowded appearance
- ambiguous icon metaphor
- visual repetition
- image-message inconsistency

Subjective findings must include evidence, confidence, alternatives, and the option to keep the existing design.

---

## 17. Whole-Document Verbal Preview

The user can request a structured description of the complete visual experience.

### Output categories

- Overall visual impression
- cover composition
- page-by-page dominant elements
- visual pacing
- cross-page consistency
- typography
- color use
- image style
- icon system
- chart and diagram placement
- density
- repeated patterns
- unresolved risks

This preview is an interpretation and must not be presented as objective proof of aesthetic quality.

---

## 18. WebMCP Design

Vistect must expose precise document operations rather than a generic autonomous tool.

## 18.1 Tool design principles

- Use explicit verb-based names.
- Keep read and write operations separate.
- Use strict JSON Schema inputs.
- Return structured data.
- Validate all writes server-side or in the authoritative client state.
- Require explicit approval for consequential operations.
- Reject stale-version updates.
- Limit tool outputs to minimum necessary data.
- Never treat document content as tool instructions.
- Make every tool execution visible in the activity stream.

## 18.2 Project tools

```text
create_document
get_document_overview
get_intent_contract
update_intent_contract
get_document_structure
list_pages
inspect_page
create_page
move_page
apply_page_template
list_unresolved_decisions
```

## 18.3 Reader tools

```text
read_section
describe_page_layout
inspect_visual_object
inspect_image
inspect_chart
inspect_diagram
inspect_table
trace_diagram_path
compare_visual_elements
list_uncertain_interpretations
```

## 18.4 Text tools

```text
add_text_section
update_text_content
set_heading_level
move_section
create_caption
```

## 18.5 Image tools

```text
register_uploaded_image
inspect_image_asset
compare_image_candidates
select_image
propose_image_crop
apply_approved_crop
place_image_relative_to
generate_contextual_alt_text
```

## 18.6 Diagram tools

```text
create_diagram
add_diagram_node
update_diagram_node
remove_diagram_node
connect_diagram_nodes
remove_diagram_connection
apply_diagram_layout
trace_diagram_path
validate_diagram_structure
generate_diagram_description
```

## 18.7 Chart tools

```text
import_chart_data
recommend_chart_types
create_chart
change_chart_type
inspect_chart
compare_chart_categories
validate_chart_integrity
generate_chart_narrative
```

## 18.8 Icon tools

```text
search_icons_by_meaning
compare_icon_candidates
set_icon_family
assign_icon
replace_icon
check_icon_consistency
```

## 18.9 Layout tools

```text
place_object_relative_to
group_objects
set_visual_priority
change_reading_order
move_object_to_page
```

## 18.10 Verification tools

```text
run_layout_checks
run_accessibility_checks
run_chart_checks
run_diagram_checks
find_unapproved_visual_decisions
find_subjective_visual_risks
compare_document_versions
verify_intent_alignment
```

## 18.11 Approval and export tools

```text
approve_visual_decision
reject_visual_decision
lock_page
unlock_page
preview_export_manifest
lock_document_version
finalize_locked_export
```

## 18.12 Tools that must not exist

Avoid broad, unsafe operations such as:

```text
make_everything_look_good
approve_all
publish_everything
get_all_private_user_data
generate_and_export_without_review
```

---

## 19. Example WebMCP Tool Schema

```javascript
document.modelContext.registerTool({
  name: "place_image_relative_to",
  description:
    "Places an existing image relative to another document object. " +
    "This stages a visual change and does not approve the decision.",
  inputSchema: {
    type: "object",
    properties: {
      imageObjectId: { type: "string" },
      anchorObjectId: { type: "string" },
      relationship: {
        type: "string",
        enum: [
          "before",
          "after",
          "above",
          "below",
          "left_of",
          "right_of",
          "inside_same_region"
        ]
      },
      expectedDocumentVersion: { type: "integer" }
    },
    required: [
      "imageObjectId",
      "anchorObjectId",
      "relationship",
      "expectedDocumentVersion"
    ],
    additionalProperties: false
  },
  execute: async (input) => {
    return visualSovereign.placeImageRelativeTo(input);
  }
});
```

---

## 20. Why WebMCP Is Essential

### The application knows

- Document pages and objects
- Geometry and visual layout
- Reading order
- Chart data
- Diagram topology
- image provenance
- icon vocabulary
- validation results
- versions and approvals
- export state

### The user's browser agent knows

- Current user intent
- Conversation context
- Preferred explanation style
- Audience and tone
- previously stated constraints
- which unresolved decisions require attention

### The human knows

- The intended message
- Whether a representation is appropriate
- Which tradeoffs are acceptable
- Whether an uncertain interpretation is trustworthy
- When to approve and export

WebMCP connects these roles using stable, typed actions. The agent can operate the semantic document without trying to drag, resize, and inspect a visual canvas through screenshots.

---

## 21. Accessibility Requirements

## 21.1 Supported assistive technology

Initial testing should cover:

- NVDA with Chrome
- JAWS with Chrome if available
- VoiceOver with Safari for non-WebMCP interface testing
- Keyboard-only navigation
- High zoom and browser text scaling
- High-contrast display modes

## 21.2 Interface requirements

- Semantic HTML first
- ARIA only when native semantics are insufficient
- Complete keyboard operation
- Visible focus indicators
- Predictable focus movement
- Focus restoration after dialogs and agent actions
- Live-region summaries for asynchronous changes
- Skip links
- heading-based navigation
- landmark navigation
- clear status and error messages
- no color-only status
- no drag-only operation
- no hover-only information
- reduced-motion support
- scalable text
- accessible names for all controls

## 21.3 Agent action announcements

After an agent action, announce:

```text
Agent action completed.
Image moved below the Executive Summary heading.
Page 2 now has one unapproved visual decision.
Press Alt plus U to review unapproved decisions.
```

Do not automatically move focus unless the action requires immediate review.

## 21.4 Semantic object explorer

Each object should expose:

- Type
- accessible name
- page
- purpose
- relative position
- reading-order position
- dimensions in understandable terms
- source
- approval state
- warnings
- available actions

---

## 22. Privacy Architecture

## 22.1 Local-first operations

Where practical, perform these in-browser:

- Project storage
- PDF rendering
- digital PDF text extraction
- document-object state
- diagram graph generation
- chart generation
- geometry checks
- reading-order checks
- redaction
- image metadata analysis
- version comparison
- export preparation

## 22.2 Optional remote processing

Remote analysis may be necessary for:

- OCR of difficult scans
- image understanding
- visual-tone assessment
- diagram reconstruction from raster images
- complex layout understanding

Before remote processing:

1. Identify the exact asset or region.
2. State why remote processing is needed.
3. Detect and disclose text, faces, or sensitive content.
4. Allow redaction or cancellation.
5. Request explicit user permission.
6. Transmit only the required region.
7. Record the event in the privacy receipt.

## 22.3 Privacy receipt

```text
Processed locally:
- Document text
- Chart data
- Diagram structure
- PDF generation
- Layout validation

Remotely analyzed:
- Cover image candidate 2
- Purpose: composition and context analysis

Not remotely transmitted:
- Participant names
- Financial table
- Contact details
- Remaining images

Local retention:
- Project retained until user deletes it

Remote retention:
- Disabled for supported provider configuration
```

## 22.4 Data minimization

- No tool may request the full user profile.
- Asset analysis receives only necessary content.
- Tool outputs are scoped to the task.
- Logs exclude document content by default.
- Analytics must not collect document text or images.

## 22.5 Encryption and storage

- IndexedDB or equivalent local persistence
- Web Crypto API for encrypted local project packages
- Short-lived signed URLs for optional remote assets
- explicit deletion controls
- no retention by default for temporary remote files

---

## 23. Security and Trust Model

## 23.1 Threats

- Prompt injection inside uploaded documents or images
- Malicious SVG content
- Tool-description poisoning
- Excessive data requests
- Unauthorized export
- stale-version finalization
- agent action misrepresentation
- malicious external assets
- cross-project information leakage

## 23.2 Mitigations

- Treat all imported content as untrusted data.
- Never interpolate imported text into tool descriptions.
- Sanitize SVG uploads.
- Disable scripts and external references in SVG.
- Restrict accepted MIME types and file sizes.
- Use strict JSON Schemas.
- Validate object and project authorization.
- Require expected version numbers for writes.
- Require user approval for export finalization.
- Record append-only action history.
- Separate tool result data from application instructions.
- Use content-security policy and origin isolation.
- Limit input length and object count.
- Provide undo for reversible actions.
- Require approval tokens for consequential operations.

## 23.3 Version-bound finalization

Final export succeeds only when:

- All blocking validations pass.
- Required visual decisions are approved.
- The document is locked.
- The approval manifest references the active version.
- No object changed after locking.
- The export renderer uses the locked version.

---

## 24. System Architecture

```text
WebMCP-capable browser agent
               |
               | Typed WebMCP tools
               v
+------------------------------------------------------+
| Vistect Web Application                     |
|                                                      |
| Accessible Interface                                 |
| - Document navigator                                 |
| - Focused object editor                              |
| - Semantic object explorer                           |
| - Decision cards                                     |
| - Warning queue                                      |
| - Agent activity stream                              |
|                                                      |
| Semantic Document Engine                             |
| - Pages and sections                                 |
| - Visual object tree                                 |
| - Reading order                                      |
| - Relative layout constraints                        |
| - Versions and approvals                             |
|                                                      |
| WebMCP Tool Registry                                 |
| - Reader tools                                       |
| - Asset tools                                        |
| - Diagram tools                                      |
| - Chart tools                                        |
| - Layout tools                                       |
| - Verification tools                                 |
| - Approval and export tools                          |
+---------------------------+--------------------------+
                            |
          +-----------------+-----------------+
          |                 |                 |
          v                 v                 v
+----------------+  +----------------+  +----------------+
| Asset Engine   |  | Diagram Engine |  | Chart Engine   |
| - Images       |  | - Graph model  |  | - Data tables  |
| - Icons        |  | - Layout       |  | - SVG charts   |
| - Cropping     |  | - Validation   |  | - Validation   |
| - Provenance   |  | - SVG export   |  | - Sonification |
+----------------+  +----------------+  +----------------+
          |                 |                 |
          +-----------------+-----------------+
                            |
                            v
+------------------------------------------------------+
| Layout, Validation, and Export Engine                 |
| - Multipage HTML rendering                            |
| - Geometry validation                                 |
| - Accessibility validation                            |
| - PDF generation                                      |
| - Accessible HTML export                              |
| - SVG and PNG assets                                  |
| - Export manifest                                     |
+------------------------------------------------------+
                            |
                            v
+------------------------------------------------------+
| Local Project Store and Optional Remote Services      |
| - IndexedDB                                           |
| - Encrypted project package                           |
| - Optional OCR                                        |
| - Optional image understanding                        |
+------------------------------------------------------+
```

---

## 25. Suggested Technology Stack

### Frontend

- React or Next.js
- TypeScript
- Semantic HTML
- Accessible component primitives
- CSS Grid and Flexbox
- SVG visual layer

### State and persistence

- JSON semantic document model
- IndexedDB
- State machine for document and approval lifecycle
- Immutable version snapshots or event-sourced changes

### Document import

- PDF.js
- OCR engine for scans
- layout analysis pipeline
- safe SVG parser and sanitizer

### Diagrams

- Cytoscape.js, React Flow, or equivalent graph engine
- Dagre, ELK, or equivalent automatic layout
- deterministic graph validation

### Charts

- Vega-Lite or another declarative chart grammar
- accessible HTML data tables
- optional Web Audio API sonification

### Export

- Controlled HTML/CSS print layout
- headless browser PDF rendering or a client-side PDF pipeline
- accessible HTML bundle
- SVG and PNG asset export

### Security and privacy

- Web Crypto API
- Content Security Policy
- origin isolation
- file-type validation
- short-lived temporary storage

### Testing

- Playwright
- axe-core
- unit tests for graph, chart, and geometry validation
- visual regression tests
- screen-reader manual testing
- WebMCP tool schema tests

---

## 26. Internal APIs and Services

## 26.1 Document service

Responsibilities:

- Create project
- manage pages and objects
- apply templates
- maintain reading order
- version changes
- lock and unlock pages

## 26.2 Asset service

Responsibilities:

- Register uploads
- validate formats
- extract metadata
- sanitize SVG
- manage crops
- store provenance
- provide thumbnails

## 26.3 Visual analysis service

Responsibilities:

- Image observations
- composition analysis
- uncertainty aggregation
- contextual summary
- potential-risk assessment

## 26.4 Diagram service

Responsibilities:

- Graph CRUD
- automatic layout
- structural validation
- visual validation
- semantic and spatial descriptions
- SVG export

## 26.5 Chart service

Responsibilities:

- Dataset import
- schema inference
- chart recommendations
- chart construction
- data-to-visual integrity checks
- accessible table and narrative generation

## 26.6 Validation service

Responsibilities:

- Recompute findings after changes
- separate deterministic and model findings
- resolve and invalidate findings
- block finalization when required

## 26.7 Export service

Responsibilities:

- Render locked version
- generate PDF
- generate accessible HTML
- package diagrams and chart tables
- create manifest
- calculate artifact hashes

---

## 27. Document Lifecycle

```text
DRAFT
  ↓
REVIEW
  ↓
PAGE_APPROVED
  ↓
DOCUMENT_READY
  ↓
LOCKED
  ↓
EXPORTED
```

### State rules

- Any content change increments the document version.
- A change to an approved object marks its approval stale.
- A change to a page unlocks that page.
- A changed dataset marks dependent charts stale.
- A changed diagram node marks diagram descriptions and checks stale.
- A changed image crop marks alt text and placement approval for review if relevant.
- Export is blocked unless the entire document is locked.

---

## 28. Export Manifest

Before export, the user receives a screen-reader-friendly report.

```yaml
document: 2026 Impact Report
version: 24
pages: 12
objects:
  headings: 18
  paragraphs: 42
  images: 7
  icons: 9
  charts: 3
  diagrams: 2
accessibility:
  images_with_alt_text: 7
  diagrams_with_long_descriptions: 2
  charts_with_data_tables: 3
  pages_with_verified_reading_order: 12
  color_only_findings: 0
deterministic_checks:
  text_overflow: 0
  object_overlap: 0
  out_of_bounds_objects: 0
  diagram_label_collisions: 0
  disconnected_diagram_nodes: 0
  chart_data_mismatches: 0
accepted_findings:
  low_resolution_images: 1
subjective_findings:
  acknowledged: 2
  unresolved: 0
approval:
  all_pages_locked: true
  unapproved_visual_decisions: 0
exports:
  - PDF
  - Accessible HTML
  - SVG diagrams
  - Chart data tables
  - Accessibility manifest
```

The final exported artifact is linked to the locked document version and manifest through hashes or equivalent stable identifiers.

---

## 29. Initial Production Scope

## 29.1 Supported

- Multipage reports from 3 to 20 pages
- Seven to ten fixed accessible page templates
- PDF import for understanding
- limited conversion of supported PDF content into editable projects
- JPEG, PNG, WebP, and safe SVG uploads
- cover images and inline images
- one curated icon library
- horizontal and vertical bar charts
- line charts
- CSV and manual data input
- process and decision diagrams
- semantic and spatial document descriptions
- deterministic layout checks
- accessible PDF-oriented export
- accessible HTML export
- WebMCP tools
- keyboard and NVDA operation

## 29.2 Explicitly unsupported initially

- Arbitrary pixel-perfect PDF editing
- Full Word round-trip editing
- Full PowerPoint editing
- video and animation
- Photoshop-style edits
- complex scientific visualization
- arbitrary magazines and brochures
- dynamic spreadsheets
- handwritten diagram reconstruction
- universal OCR accuracy
- universal aesthetic correctness
- guaranteed PDF/UA certification
- tactile hardware integration
- automatic publishing without review

---

## 30. Implementation Plan

## Phase 1: Document foundation

Deliver:

- Semantic project model
- multipage editor
- accessible document navigator
- page templates
- text blocks
- page reordering
- object explorer
- local autosave
- PDF and HTML rendering prototype

## Phase 2: Image workflow

Deliver:

- Image upload
- metadata extraction
- structured image analysis
- candidate comparison
- semantic crop proposals
- alt text workflow
- image decision ledger

## Phase 3: Diagram workflow

Deliver:

- Graph creation
- natural-language-to-graph staging
- node and edge editing
- automatic layout
- structural checks
- label and crossing checks
- semantic and spatial descriptions
- SVG export

## Phase 4: Chart workflow

Deliver:

- CSV import
- data preview
- chart recommendation
- bar and line charts
- accessible data tables
- chart integrity checks
- chart narrative

## Phase 5: Validation and approval

Deliver:

- Page validation
- document validation
- unapproved-decision queue
- version comparison
- page locking
- document locking
- export manifest
- stale-version protection

## Phase 6: WebMCP integration

Deliver:

- Tool registry
- strict schemas
- read and write separation
- agent activity stream
- consequential-action gates
- expected-version validation
- agent compatibility tests

## Phase 7: Accessibility and user validation

Deliver:

- NVDA testing
- keyboard testing
- zoom testing
- high-contrast testing
- focus and live-region refinements
- testing with blind users
- public accessibility statement
- known-limitations documentation

---

## 31. Hackathon Build Priority

### Must-have features

1. Multipage semantic document model
2. Real screen-reader-operable document navigator
3. Intent Contract
4. Image upload and three-candidate comparison
5. Semantic image crop and placement
6. AI-directed structured diagram creation
7. Diagram structural validation
8. One accessible chart workflow
9. Deterministic layout and accessibility checks
10. Visual Decision Ledger
11. Unapproved-decision review
12. Version-bound PDF and HTML export
13. Meaningful WebMCP tools
14. Visible agent action history

### High-value stretch features

1. Multi-model image-analysis disagreement
2. Short chart sonification
3. PDF import and reconstruction
4. structured SVG import
5. icon consistency checks
6. whole-document visual preview
7. privacy receipt
8. tactile-oriented SVG export

### Do not prioritize during the hackathon

- Full DOCX editing
- Full presentation editing
- video
- real-time multiuser collaboration
- hundreds of templates
- stock-image marketplace integrations
- arbitrary document conversion
- advanced image editing

---

## 32. Testing Strategy

## 32.1 Unit tests

- Graph reachability
- cycle detection
- edge-crossing calculations
- label overflow
- text overflow
- contrast calculation
- chart-data equality
- version invalidation
- approval invalidation
- export manifest generation

## 32.2 Integration tests

- Agent creates page and object
- agent modifies diagram
- changed diagram invalidates approval
- changed data invalidates chart
- stale agent write is rejected
- locked document cannot be modified
- export uses correct version
- imported content cannot modify tool metadata

## 32.3 Accessibility tests

- Complete core workflow with keyboard only
- complete document navigation with NVDA
- inspect agent activity without losing focus
- resolve a validation error with NVDA
- compare image candidates with a screen reader
- create and inspect a diagram nonvisually
- review and approve export manifest
- operate at 200 and 400 percent zoom

## 32.4 Usability tests with blind users

Tasks:

1. Understand a six-page report.
2. Identify the dominant visual on a selected page.
3. Choose an image from three candidates.
4. crop and place the image.
5. create and repair a process diagram.
6. import data and approve a chart.
7. find and resolve a page warning.
8. export without sighted verification.

Measures:

- Task completion
- assistance requested
- error rate
- time
- confidence
- trust calibration
- understanding of agent actions
- willingness to send final output independently

---

## 33. Impact Metrics

### Primary metric

**Percentage of visual document projects completed without sighted assistance for visual selection, arrangement, or final verification.**

### Supporting metrics

- Number of independently approved visual decisions
- percentage of visual objects with provenance
- percentage of visual objects with approval status
- agent errors independently detected by the user
- diagram structural errors corrected
- chart integrity errors prevented
- layout defects corrected
- unapproved changes blocked
- documents successfully exported
- user confidence in sending the final artifact

### Defining user question

> Could you send this document without asking a sighted person to check it?

---

## 34. Three-Minute Demo Plan

### 0:00 to 0:20: Barrier

A blind professional explains:

> I can write the whole report, but when it needs images, charts, diagrams, and visual layout, I need someone else to finish or check it.

A real screen reader is active.

### 0:20 to 0:40: Intent Contract

User asks the browser agent:

> Create an eight-page impact report for funders. The message is measurable independence. Use navy and teal. Avoid charity and medical imagery.

The agent calls `create_document` and `update_intent_contract`.

### 0:40 to 1:10: Image authorship

The user asks:

> Which image best communicates capability without implying rescue?

The agent calls `compare_image_candidates`. The application compares three images, including tradeoffs and uncertainty. The user selects one.

### 1:10 to 1:40: Diagram creation and repair

The user describes a participant journey. The agent builds it through graph tools. Validation identifies a missing return path from an unsuccessful internship. The user directs the correction.

### 1:40 to 2:05: Honest chart

The agent recommends a horizontal bar chart for outcome categories. The user asks whether a line chart would incorrectly imply a timeline. The structured recommendation confirms that it would.

### 2:05 to 2:30: Visual audit

The user asks:

> Find everything that could make the report look broken or inaccessible.

The application detects a truncated chart label, a low-contrast caption, and one reading-order mismatch. The agent proposes fixes; the user approves them.

### 2:30 to 2:50: Final authority

The user asks:

> Show every visual decision I have not approved.

None remain. The agent calls `preview_export_manifest`.

### 2:50 to 3:00: Export and close

The user locks and exports the PDF and accessible HTML.

> Vistect does not merely describe visual content to blind people. It gives blind creators independent command over visual communication.

---

## 35. Risks and Mitigations

### Risk: The product looks like a voice-controlled design editor

**Mitigation:** Lead with structured understanding, visual provenance, deterministic validation, semantic control, and user approval.

### Risk: Too much scope

**Mitigation:** Support one document class, fixed templates, one image workflow, one chart workflow, and structured diagrams.

### Risk: AI image analysis is incorrect

**Mitigation:** Separate observations, interpretations, and uncertainty; compare multiple outputs where possible; require human approval.

### Risk: The agent becomes the author

**Mitigation:** Use decision cards, alternative comparisons, explicit approvals, and an unapproved-decision queue.

### Risk: WebMCP seems optional

**Mitigation:** Do not embed a proprietary chat assistant. Demonstrate a user-chosen agent operating rich semantic document tools.

### Risk: Imported PDFs cannot be reconstructed reliably

**Mitigation:** Treat understanding and creation as separate guarantees. Convert only supported structures and disclose reconstruction confidence.

### Risk: Accessibility claims are not credible

**Mitigation:** Use a real screen reader, test with blind users, publish known limitations, and provide an accessibility conformance statement.

### Risk: Subjective design feedback is presented as truth

**Mitigation:** Label subjective findings, show evidence and confidence, and preserve the user's decision.

### Risk: Privacy claim is vague

**Mitigation:** Provide local-first processing, explicit remote-analysis consent, data minimization, and a clear privacy receipt.

---

## 36. Product Roadmap After Initial Release

### Release 1

- Multipage professional reports
- PDF and accessible HTML export
- Images, icons, charts, and diagrams
- Understand and Create modes
- WebMCP tools

### Release 2

- Better PDF import and project conversion
- additional chart types
- collaborative comments
- brand kits
- reusable project templates
- secure organization asset libraries

### Release 3

- DOCX export
- presentation export
- shared review links
- tactile-ready diagram and chart profiles
- richer sonification
- document comparison and revision workflows

### Release 4

- Plugin or extension integration with existing productivity systems
- enterprise policy controls
- team libraries
- custom validation rules
- domain-specific templates for education, nonprofits, research, and business

---

## 37. Final Product Definition

### Name

**Vistect**

### Tagline

**Independent visual authorship for blind creators.**

### Initial product

A WebMCP-native workspace for understanding existing visual PDFs and creating professional multipage reports containing text, uploaded images, curated icons, accessible charts, and structured diagrams.

### Unique capability

A blind person can independently understand, construct, inspect, revise, and approve visual communication without requiring a sighted person to perform the final visual verification.

### Core modules

1. Visual Document Reader
2. Semantic Multipage Editor
3. Intent Contract
4. Image Analysis and Comparison Studio
5. Semantic Crop and Placement System
6. Structured Diagram Studio
7. Accessible Chart Studio
8. Icon Vocabulary Studio
9. Visual Decision Ledger
10. Layout and Accessibility Auditor
11. Whole-Document Verbal Preview
12. Version-Bound Export Manifest
13. PDF and Accessible HTML Export
14. WebMCP Tool Registry
15. Privacy and Agent Activity Center

### Final winning statement

> **Existing tools help blind people consume visual content. Vistect gives blind people independent authorship, informed visual decision-making, verifiable agent collaboration, and final authority over the visual documents they publish.**
