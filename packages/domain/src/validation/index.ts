// ============================================================================
// Validation Framework
// ============================================================================

import type {
  DocumentProject,
  ValidationFinding,
  FindingCategory,
  FindingSeverity,
  EvidenceType,
  FindingStatus,
  SuggestedAction,
  FindingId,
  ObjectId,
  PageId,
  DocumentObject,
  Page,
  Chart,
  Diagram,
  ImageAsset,
  Dataset,
  Bounds,
  AccessibilityMetadata,
} from '../schema';

import { FindingCategorySchema, FindingSeveritySchema, EvidenceTypeSchema, FindingStatusSchema } from '../schema';

// ============================================================================
// Finding Registry
// ============================================================================

export interface FindingRegistry {
  registerFinding(finding: Omit<ValidationFinding, 'id' | 'createdAt' | 'updatedAt'>): ValidationFinding;
  resolveFinding(findingId: FindingId): void;
  acceptFinding(findingId: FindingId, reason: string): void;
  dismissFinding(findingId: FindingId): void;
  recomputeFindings(project: DocumentProject, scope?: 'object' | 'page' | 'document', targetId?: string): ValidationFinding[];
}

export function createFindingRegistry(): FindingRegistry {
  const findings = new Map<string, ValidationFinding>();

  return {
    registerFinding,
    resolveFinding,
    acceptFinding,
    dismissFinding,
    recomputeFindings,
  };

  function registerFinding(finding: Omit<ValidationFinding, 'id' | 'createdAt' | 'updatedAt'>): ValidationFinding {
    const now = new Date().toISOString();
    const fullFinding: ValidationFinding = {
      ...finding,
      id: `fnd_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}` as FindingId,
      createdAt: now,
      updatedAt: now,
    };
    findings.set(fullFinding.id, fullFinding);
    return fullFinding;
  }

  function resolveFinding(findingId: FindingId): void {
    const finding = findings.get(findingId);
    if (finding) {
      finding.status = 'resolved';
      finding.updatedAt = new Date().toISOString();
    }
  }

  function acceptFinding(findingId: FindingId, reason: string): void {
    const finding = findings.get(findingId);
    if (finding) {
      finding.status = 'accepted';
      finding.acceptedReason = reason;
      finding.updatedAt = new Date().toISOString();
    }
  }

  function dismissFinding(findingId: FindingId): void {
    const finding = findings.get(findingId);
    if (finding) {
      finding.status = 'dismissed';
      finding.updatedAt = new Date().toISOString();
    }
  }

  function recomputeFindings(
    project: DocumentProject,
    scope?: 'object' | 'page' | 'document',
    targetId?: string
  ): ValidationFinding[] {
    // Clear existing findings for scope
    const toRemove: FindingId[] = [];
    for (const [id, finding] of findings) {
      if (scope === 'document' || (scope === 'page' && finding.targetId === targetId) || (scope === 'object' && finding.targetId === targetId)) {
        toRemove.push(id);
      }
    }
    for (const id of toRemove) findings.delete(id);

    // Run validators
    const newFindings: ValidationFinding[] = [];

    // Layout validators
    newFindings.push(...validateLayout(project, scope, targetId));
    // Text validators
    newFindings.push(...validateText(project, scope, targetId));
    // Color validators
    newFindings.push(...validateColor(project, scope, targetId));
    // Image validators
    newFindings.push(...validateImages(project, scope, targetId));
    // Chart validators
    newFindings.push(...validateCharts(project, scope, targetId));
    // Diagram validators
    newFindings.push(...validateDiagrams(project, scope, targetId));
    // Accessibility validators
    newFindings.push(...validateAccessibility(project, scope, targetId));

    // Register new findings
    for (const finding of newFindings) {
      findings.set(finding.id, finding);
    }

    return newFindings;
  }
}

// ============================================================================
// Layout Validators (FR-111)
// ============================================================================

function validateLayout(project: DocumentProject, scope?: string, targetId?: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  for (const page of Object.values(project.pages)) {
    if (scope === 'page' && targetId && page.id !== targetId) continue;
    if (scope === 'object' && targetId) {
      const obj = project.objects[targetId];
      if (!obj || !page.objects.includes(targetId)) continue;
    }

    const pageObjects = page.objects.map(id => project.objects[id]).filter(Boolean) as DocumentObject[];

    // Overlap detection
    for (let i = 0; i < pageObjects.length; i++) {
      for (let j = i + 1; j < pageObjects.length; j++) {
        const a = pageObjects[i];
        const b = pageObjects[j];
        if (boundsOverlap(a.bounds, b.bounds)) {
          findings.push(createFinding({
            scope: 'object',
            targetId: a.id,
            category: 'layout.overlap',
            severity: 'error',
            evidenceType: 'deterministic',
            summary: `Object ${a.id} overlaps with ${b.id}`,
            evidence: [`Bounds A: ${JSON.stringify(a.bounds)}`, `Bounds B: ${JSON.stringify(b.bounds)}`],
            suggestedActions: [
              { type: 'fix', description: 'Adjust constraints to resolve overlap', toolName: 'set_object_constraints' },
            ],
          }));
        }
      }
    }

    // Out of bounds
    const pageBounds = getPageBounds(page.template);
    for (const obj of pageObjects) {
      if (!boundsWithin(obj.bounds, pageBounds)) {
        findings.push(createFinding({
          scope: 'object',
          targetId: obj.id,
          category: 'layout.out_of_bounds',
          severity: 'error',
          evidenceType: 'deterministic',
          summary: `Object ${obj.id} extends beyond page bounds`,
          evidence: [`Object bounds: ${JSON.stringify(obj.bounds)}`, `Page bounds: ${JSON.stringify(pageBounds)}`],
          suggestedActions: [
            { type: 'fix', description: 'Adjust constraints to fit within page', toolName: 'set_object_constraints' },
          ],
        }));
      }
    }

    // Alignment consistency
    // Check vertical alignment of objects in same column
    const columns = groupByColumn(pageObjects);
    for (const column of columns) {
      const xPositions = column.map(o => o.bounds.x);
      const variance = calculateVariance(xPositions);
      if (variance > 10) { // 10px threshold
        findings.push(createFinding({
          scope: 'page',
          targetId: page.id,
          category: 'layout.alignment',
          severity: 'warning',
          evidenceType: 'deterministic',
          summary: `Inconsistent horizontal alignment in column (variance: ${variance.toFixed(1)}px)`,
          evidence: column.map(o => `${o.id} at x=${o.bounds.x}`),
          suggestedActions: [
            { type: 'fix', description: 'Align objects to common grid', toolName: 'align_objects' },
          ],
        }));
      }
    }

    // Spacing consistency
    // Check vertical spacing between consecutive objects in reading order
    for (let i = 0; i < page.readingOrder.length - 1; i++) {
      const a = project.objects[page.readingOrder[i]];
      const b = project.objects[page.readingOrder[i + 1]];
      if (a && b) {
        const spacing = b.bounds.y - (a.bounds.y + a.bounds.h);
        if (spacing < 8 || spacing > 64) {
          findings.push(createFinding({
            scope: 'object',
            targetId: a.id,
            category: 'layout.spacing',
            severity: 'warning',
            evidenceType: 'deterministic',
            summary: `Unusual spacing (${spacing.toFixed(1)}px) between ${a.id} and ${b.id}`,
            evidence: [`Object ${a.id} bottom: ${a.bounds.y + a.bounds.h}`, `Object ${b.id} top: ${b.bounds.y}`],
            suggestedActions: [
              { type: 'fix', description: 'Adjust spacing constraints', toolName: 'set_object_constraints' },
            ],
          }));
        }
      }
    }

    // Margins
    for (const obj of pageObjects) {
      const margin = checkMargins(obj.bounds, pageBounds);
      if (margin.violated) {
        findings.push(createFinding({
          scope: 'object',
          targetId: obj.id,
          category: 'layout.margins',
          severity: 'warning',
          evidenceType: 'deterministic',
          summary: `Object ${obj.id} violates ${margin.side} margin`,
          evidence: [`${margin.side} margin: ${margin.value.toFixed(1)}px (min: ${margin.min}px)`],
          suggestedActions: [
            { type: 'fix', description: 'Adjust object position to respect margins', toolName: 'set_object_constraints' },
          ],
        }));
      }
    }

    // Empty placeholders
    for (const obj of pageObjects) {
      if (obj.kind === 'image' && !obj.assetId) {
        findings.push(createFinding({
          scope: 'object',
          targetId: obj.id,
          category: 'layout.empty_placeholder',
          severity: 'warning',
          evidenceType: 'deterministic',
          summary: `Image placeholder ${obj.id} has no asset assigned`,
          evidence: [],
          suggestedActions: [
            { type: 'fix', description: 'Assign image asset or remove placeholder', toolName: 'assign_image_asset' },
          ],
        }));
      }
    }
  }

  return findings;
}

// ============================================================================
// Text Validators (FR-112)
// ============================================================================

function validateText(project: DocumentProject, scope?: string, targetId?: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  for (const obj of Object.values(project.objects)) {
    if (scope === 'object' && targetId && obj.id !== targetId) continue;
    if (obj.kind !== 'text') continue;

    // Overflow detection (estimated)
    const estimatedLines = estimateTextLines(obj.content, obj.bounds.w);
    const maxLines = Math.floor(obj.bounds.h / 24); // ~24px line height
    if (estimatedLines > maxLines) {
      findings.push(createFinding({
        scope: 'object',
        targetId: obj.id,
        category: 'text.overflow',
        severity: 'error',
        evidenceType: 'deterministic',
        summary: `Text object ${obj.id} likely overflows (${estimatedLines} lines > ${maxLines} max)`,
        evidence: [`Content length: ${obj.content.length}`, `Bounds: ${JSON.stringify(obj.bounds)}`],
        suggestedActions: [
          { type: 'fix', description: 'Increase bounds or reduce text', toolName: 'update_object' },
        ],
      }));
    }

    // Truncation
    if (obj.content.endsWith('…') || obj.content.endsWith('...')) {
      findings.push(createFinding({
        scope: 'object',
        targetId: obj.id,
        category: 'text.truncation',
        severity: 'warning',
        evidenceType: 'deterministic',
        summary: `Text object ${obj.id} appears truncated`,
        evidence: [`Content ends with ellipsis`],
        suggestedActions: [
          { type: 'fix', description: 'Expand bounds or edit text', toolName: 'update_object' },
        ],
      }));
    }

    // Minimum font size
    if (obj.bounds.h < 16) {
      findings.push(createFinding({
        scope: 'object',
        targetId: obj.id,
        category: 'text.minimum_size',
        severity: 'warning',
        evidenceType: 'deterministic',
        summary: `Text object ${obj.id} bounds too small for readable text`,
        evidence: [`Height: ${obj.bounds.h}px`],
        suggestedActions: [
          { type: 'fix', description: 'Increase bounds height to at least 16px', toolName: 'update_object' },
        ],
      }));
    }
  }

  // Heading hierarchy
  const headings = Object.values(project.objects)
    .filter(o => o.kind === 'text' && o.role === 'heading')
    .sort((a, b) => (a.headingLevel || 1) - (b.headingLevel || 1));

  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1];
    const curr = headings[i];
    if ((curr.headingLevel || 1) > (prev.headingLevel || 1) + 1) {
      findings.push(createFinding({
        scope: 'object',
        targetId: curr.id,
        category: 'text.heading_hierarchy',
        severity: 'error',
        evidenceType: 'deterministic',
        summary: `Heading level jumps from H${prev.headingLevel} to H${curr.headingLevel}`,
        evidence: [`Previous: ${prev.content.slice(0, 50)}`, `Current: ${curr.content.slice(0, 50)}`],
        suggestedActions: [
          { type: 'fix', description: 'Adjust heading levels to maintain hierarchy', toolName: 'update_object' },
        ],
      }));
    }
  }

  // Missing/orphan headings
  for (const page of Object.values(project.pages)) {
    const pageHeadings = page.readingOrder
      .map(id => project.objects[id])
      .filter((o): o is DocumentObject => o !== undefined && o.kind === 'text' && o.role === 'heading');
    if (pageHeadings.length === 0 && page.objects.length > 0) {
      findings.push(createFinding({
        scope: 'page',
        targetId: page.id,
        category: 'text.missing_heading',
        severity: 'warning',
        evidenceType: 'deterministic',
        summary: `Page ${page.id} has no headings`,
        evidence: [],
        suggestedActions: [
          { type: 'fix', description: 'Add a heading to this page', toolName: 'create_object' },
        ],
      }));
    }
  }

  return findings;
}

// ============================================================================
// Color Validators (FR-113)
// ============================================================================

function validateColor(project: DocumentProject, scope?: string, targetId?: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  // Contrast ratio checks would require rendered colors
  // This is a placeholder for the deterministic checks

  // Color-only distinction check
  for (const obj of Object.values(project.objects)) {
    if (scope === 'object' && targetId && obj.id !== targetId) continue;

    // Check if object uses color as only distinguishing feature
    // This requires access to rendered output - simplified here
  }

  return findings;
}

// ============================================================================
// Image Validators (FR-114)
// ============================================================================

function validateImages(project: DocumentProject, scope?: string, targetId?: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  for (const obj of Object.values(project.objects)) {
    if (scope === 'object' && targetId && obj.id !== targetId) continue;
    if (obj.kind !== 'image') continue;

    // Missing alt text
    if (!obj.accessibility.isDecorative && (!obj.altTextApproved || obj.altTextApproved.trim() === '')) {
      findings.push(createFinding({
        scope: 'object',
        targetId: obj.id,
        category: 'image.missing_alt',
        severity: 'error',
        evidenceType: 'deterministic',
        summary: `Image ${obj.id} missing approved alt text`,
        evidence: [],
        suggestedActions: [
          { type: 'fix', description: 'Add and approve alt text', toolName: 'approve_alt_text' },
        ],
      }));
    }

    const asset = project.assets[obj.assetId];
    if (asset) {
      // Resolution check
      const dpi = Math.min(asset.dimensions.width / (obj.bounds.w / 72), asset.dimensions.height / (obj.bounds.h / 72));
      if (dpi < 150) {
        findings.push(createFinding({
          scope: 'object',
          targetId: obj.id,
          category: 'image.resolution',
          severity: 'warning',
          evidenceType: 'deterministic',
          summary: `Image ${obj.id} may be low resolution for print (${dpi.toFixed(0)} DPI)`,
          evidence: [`Asset: ${asset.dimensions.width}x${asset.dimensions.height}`, `Display: ${obj.bounds.w}x${obj.bounds.h}`],
          suggestedActions: [
            { type: 'fix', description: 'Use higher resolution image or reduce display size', toolName: 'replace_image_asset' },
          ],
        }));
      }

      // Aspect distortion
      const assetRatio = asset.dimensions.width / asset.dimensions.height;
      const displayRatio = obj.bounds.w / obj.bounds.h;
      if (Math.abs(assetRatio - displayRatio) > 0.1) {
        findings.push(createFinding({
          scope: 'object',
          targetId: obj.id,
          category: 'image.aspect_distortion',
          severity: 'warning',
          evidenceType: 'deterministic',
          summary: `Image ${obj.id} aspect ratio distorted (asset: ${assetRatio.toFixed(2)}, display: ${displayRatio.toFixed(2)})`,
          evidence: [],
          suggestedActions: [
            { type: 'fix', description: 'Adjust crop or bounds to match aspect ratio', toolName: 'update_object' },
          ],
        }));
      }

      // Source metadata
      if (!asset.sourceReference) {
        findings.push(createFinding({
          scope: 'object',
          targetId: obj.id,
          category: 'image.source_metadata',
          severity: 'info',
          evidenceType: 'deterministic',
          summary: `Image ${obj.id} missing source reference`,
          evidence: [],
          suggestedActions: [
            { type: 'review', description: 'Add source reference for provenance', toolName: 'update_asset' },
          ],
        }));
      }

      // Crop boundaries
      if (obj.crop) {
        if (obj.crop.rect.x < 0 || obj.crop.rect.y < 0 ||
            obj.crop.rect.x + obj.crop.rect.w > asset.dimensions.width ||
            obj.crop.rect.y + obj.crop.rect.h > asset.dimensions.height) {
          findings.push(createFinding({
            scope: 'object',
            targetId: obj.id,
            category: 'image.crop_boundaries',
            severity: 'error',
            evidenceType: 'deterministic',
            summary: `Image ${obj.id} crop extends beyond asset boundaries`,
            evidence: [`Crop: ${JSON.stringify(obj.crop.rect)}`, `Asset: ${asset.dimensions.width}x${asset.dimensions.height}`],
            suggestedActions: [
              { type: 'fix', description: 'Adjust crop to fit within asset', toolName: 'update_crop' },
            ],
          }));
        }
      }
    }
  }

  return findings;
}

// ============================================================================
// Chart Validators (FR-115)
// ============================================================================

function validateCharts(project: DocumentProject, scope?: string, targetId?: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  for (const obj of Object.values(project.objects)) {
    if (scope === 'object' && targetId && obj.id !== targetId) continue;
    if (obj.kind !== 'chart') continue;

    const chart = project.charts[obj.chartId];
    if (!chart) continue;

    // Data mismatch (geometry vs spec)
    if (chart.geometry) {
      const dataset = project.datasets[chart.spec.datasetId];
      if (dataset) {
        // Verify bar values match dataset
        for (const bar of chart.geometry.bars) {
          const col = dataset.columns[chart.spec.series[bar.seriesIndex].dataColumnId];
          if (col && col.values[bar.categoryIndex] !== bar.value) {
            findings.push(createFinding({
              scope: 'object',
              targetId: obj.id,
              category: 'chart.data_mismatch',
              severity: 'blocking',
              evidenceType: 'deterministic',
              summary: `Chart ${obj.id} bar value mismatch at series ${bar.seriesIndex}, category ${bar.categoryIndex}`,
              evidence: [`Geometry: ${bar.value}`, `Dataset: ${col.values[bar.categoryIndex]}`],
              suggestedActions: [
                { type: 'fix', description: 'Regenerate chart geometry from dataset', toolName: 'render_chart' },
              ],
            }));
          }
        }
      }
    }

    // Missing/truncated labels
    for (const series of chart.spec.series) {
      const col = project.datasets[chart.spec.datasetId]?.columns[series.dataColumnId];
      if (col && series.name.length > 30) {
        findings.push(createFinding({
          scope: 'object',
          targetId: obj.id,
          category: 'chart.missing_labels',
          severity: 'warning',
          evidenceType: 'deterministic',
          summary: `Chart ${obj.id} series name may be truncated: "${series.name}"`,
          evidence: [`Length: ${series.name.length} characters`],
          suggestedActions: [
            { type: 'fix', description: 'Shorten series name or use horizontal bar chart', toolName: 'update_chart' },
          ],
        }));
      }
    }

    // Baseline anomalies
    if (chart.spec.yAxis.baselineZero === false) {
      findings.push(createFinding({
        scope: 'object',
        targetId: obj.id,
        category: 'chart.baseline_anomaly',
        severity: 'warning',
        evidenceType: 'deterministic',
        summary: `Chart ${obj.id} uses non-zero baseline`,
        evidence: [`Baseline: ${chart.spec.yAxis.min}`],
        suggestedActions: [
          { type: 'review', description: 'Confirm non-zero baseline is intentional', toolName: 'approve_chart_baseline' },
        ],
      }));
    }

    // Missing table
    if (!obj.accessibility.longDescription) {
      findings.push(createFinding({
        scope: 'object',
        targetId: obj.id,
        category: 'chart.missing_table',
        severity: 'error',
        evidenceType: 'deterministic',
        summary: `Chart ${obj.id} missing accessible data table`,
        evidence: [],
        suggestedActions: [
          { type: 'fix', description: 'Generate accessible data table', toolName: 'generate_chart_table' },
        ],
      }));
    }

    // Missing source
    if (!chart.spec.sourceNote) {
      findings.push(createFinding({
        scope: 'object',
        targetId: obj.id,
        category: 'chart.missing_source',
        severity: 'warning',
        evidenceType: 'deterministic',
        summary: `Chart ${obj.id} missing source note`,
        evidence: [],
        suggestedActions: [
          { type: 'fix', description: 'Add source note to chart spec', toolName: 'update_chart' },
        ],
      }));
    }
  }

  return findings;
}

// ============================================================================
// Diagram Validators (FR-116)
// ============================================================================

function validateDiagrams(project: DocumentProject, scope?: string, targetId?: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  for (const obj of Object.values(project.objects)) {
    if (scope === 'object' && targetId && obj.id !== targetId) continue;
    if (obj.kind !== 'diagram') continue;

    const diagram = project.diagrams[obj.diagramId];
    if (!diagram) continue;

    // Structural validation (FR-074)
    const { nodes, edges } = diagram;

    // Disconnected nodes
    const connectedNodes = new Set<string>();
    for (const edge of edges) {
      connectedNodes.add(edge.from);
      connectedNodes.add(edge.to);
    }
    for (const node of nodes) {
      if (!connectedNodes.has(node.id) && nodes.length > 1) {
        findings.push(createFinding({
          scope: 'object',
          targetId: obj.id,
          category: 'diagram.disconnected_nodes',
          severity: 'error',
          evidenceType: 'deterministic',
          summary: `Diagram ${obj.id} has disconnected node: ${node.id}`,
          evidence: [`Node: ${node.id} (${node.label})`],
          suggestedActions: [
            { type: 'fix', description: 'Connect node or remove it', toolName: 'add_diagram_edge' },
          ],
        }));
      }
    }

    // Unreachable nodes from entry
    if (diagram.entryNodeId) {
      const reachable = findReachableNodes(diagram, diagram.entryNodeId);
      for (const node of nodes) {
        if (!reachable.has(node.id)) {
          findings.push(createFinding({
            scope: 'object',
            targetId: obj.id,
            category: 'diagram.unreachable_nodes',
            severity: 'error',
            evidenceType: 'deterministic',
            summary: `Diagram ${obj.id} has unreachable node from entry: ${node.id}`,
            evidence: [`Node: ${node.id} (${node.label})`],
            suggestedActions: [
              { type: 'fix', description: 'Add path from entry or change entry node', toolName: 'add_diagram_edge' },
            ],
          }));
        }
      }
    } else if (diagram.type === 'process_flow' || diagram.type === 'decision_tree') {
      findings.push(createFinding({
        scope: 'object',
        targetId: obj.id,
        category: 'diagram.missing_entry_terminal',
        severity: 'error',
        evidenceType: 'deterministic',
        summary: `Diagram ${obj.id} (${diagram.type}) missing entry node`,
        evidence: [],
        suggestedActions: [
          { type: 'fix', description: 'Designate entry node', toolName: 'update_diagram' },
        ],
      }));
    }

    // Missing decision outcomes
    for (const node of nodes) {
      if (node.type === 'decision') {
        const outgoingEdges = edges.filter(e => e.from === node.id);
        const hasYes = outgoingEdges.some(e => e.outcomeLabel === 'yes' || e.outcomeLabel === 'true');
        const hasNo = outgoingEdges.some(e => e.outcomeLabel === 'no' || e.outcomeLabel === 'false');
        if (!hasYes || !hasNo) {
          findings.push(createFinding({
            scope: 'object',
            targetId: obj.id,
            category: 'diagram.missing_decision_outcome',
            severity: 'error',
            evidenceType: 'deterministic',
            summary: `Decision node ${node.id} missing ${!hasYes ? 'yes/true' : 'no/false'} outcome`,
            evidence: [`Outgoing edges: ${outgoingEdges.map(e => e.outcomeLabel).join(', ')}`],
            suggestedActions: [
              { type: 'fix', description: 'Add missing decision outcome edge', toolName: 'add_diagram_edge' },
            ],
          }));
        }
      }
    }

    // Invalid cycles (for process/decision types)
    if (diagram.type === 'process_flow' || diagram.type === 'decision_tree') {
      if (hasCycle(diagram)) {
        findings.push(createFinding({
          scope: 'object',
          targetId: obj.id,
          category: 'diagram.invalid_cycle',
          severity: 'error',
          evidenceType: 'deterministic',
          summary: `Diagram ${obj.id} contains a cycle (invalid for ${diagram.type})`,
          evidence: [],
          suggestedActions: [
            { type: 'fix', description: 'Remove cycle to make diagram acyclic', toolName: 'remove_diagram_edge' },
          ],
        }));
      }
    }

    // Missing entry/terminal
    if (!diagram.entryNodeId || diagram.terminalNodeIds.length === 0) {
      findings.push(createFinding({
        scope: 'object',
        targetId: obj.id,
        category: 'diagram.missing_entry_terminal',
        severity: 'error',
        evidenceType: 'deterministic',
        summary: `Diagram ${obj.id} missing entry or terminal nodes`,
        evidence: [],
        suggestedActions: [
          { type: 'fix', description: 'Designate entry and terminal nodes', toolName: 'update_diagram' },
        ],
      }));
    }

    // Duplicate edges
    const edgeKeys = new Set<string>();
    for (const edge of edges) {
      const key = `${edge.from}-${edge.to}-${edge.label || ''}`;
      if (edgeKeys.has(key)) {
        findings.push(createFinding({
          scope: 'object',
          targetId: obj.id,
          category: 'diagram.duplicate_edges',
          severity: 'warning',
          evidenceType: 'deterministic',
          summary: `Diagram ${obj.id} has duplicate edge`,
          evidence: [`From: ${edge.from}, To: ${edge.to}`],
          suggestedActions: [
            { type: 'fix', description: 'Remove duplicate edge', toolName: 'remove_diagram_edge' },
          ],
        }));
      }
      edgeKeys.add(key);
    }

    // Ambiguous edge labels
    for (const edge of edges) {
      if (!edge.label && edges.filter(e => e.from === edge.from).length > 1) {
        findings.push(createFinding({
          scope: 'object',
          targetId: obj.id,
          category: 'diagram.ambiguous_edge_labels',
          severity: 'warning',
          evidenceType: 'deterministic',
          summary: `Edge from ${edge.from} has no label but multiple outgoing edges exist`,
          evidence: [],
          suggestedActions: [
            { type: 'fix', description: 'Add labels to outgoing edges', toolName: 'update_diagram_edge' },
          ],
        }));
      }
    }

    // Visual validation (FR-075)
    // Edge crossings
    const crossings = countEdgeCrossings(diagram);
    if (crossings > 0) {
      findings.push(createFinding({
        scope: 'object',
        targetId: obj.id,
        category: 'diagram.edge_crossings',
        severity: 'warning',
        evidenceType: 'deterministic',
        summary: `Diagram ${obj.id} has ${crossings} edge crossings`,
        evidence: [],
        suggestedActions: [
          { type: 'fix', description: 'Reapply layout to minimize crossings', toolName: 'apply_diagram_layout' },
        ],
      }));
    }

    // Node overlaps
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (boundsOverlap(nodes[i].bounds, nodes[j].bounds)) {
          findings.push(createFinding({
            scope: 'object',
            targetId: obj.id,
            category: 'diagram.node_overlaps',
            severity: 'error',
            evidenceType: 'deterministic',
            summary: `Diagram ${obj.id} nodes overlap: ${nodes[i].id} and ${nodes[j].id}`,
            evidence: [],
            suggestedActions: [
              { type: 'fix', description: 'Reapply layout', toolName: 'apply_diagram_layout' },
            ],
          }));
        }
      }
    }

    // Label overflow
    for (const node of nodes) {
      const estimatedWidth = node.label.length * 8; // rough estimate
      if (estimatedWidth > node.bounds.w) {
        findings.push(createFinding({
          scope: 'object',
          targetId: obj.id,
          category: 'diagram.label_overflow',
          severity: 'warning',
          evidenceType: 'deterministic',
          summary: `Node ${node.id} label may overflow bounds`,
          evidence: [`Label: "${node.label}", Width: ${node.bounds.w}px`],
          suggestedActions: [
            { type: 'fix', description: 'Shorten label or increase node size', toolName: 'update_diagram_node' },
          ],
        }));
      }
    }

    // Crowded regions
    // Simplified: check density
    const totalArea = nodes.reduce((sum, n) => sum + n.bounds.w * n.bounds.h, 0);
    const diagramArea = getDiagramBounds(diagram);
    const density = totalArea / (diagramArea.w * diagramArea.h);
    if (density > 0.5) {
      findings.push(createFinding({
        scope: 'object',
        targetId: obj.id,
        category: 'diagram.crowded_regions',
        severity: 'warning',
        evidenceType: 'deterministic',
        summary: `Diagram ${obj.id} is crowded (density: ${(density * 100).toFixed(0)}%)`,
        evidence: [],
        suggestedActions: [
          { type: 'fix', description: 'Increase diagram size or reduce nodes', toolName: 'update_diagram' },
        ],
      }));
    }

    // Inconsistent node dimensions
    const widths = nodes.map(n => n.bounds.w);
    const heights = nodes.map(n => n.bounds.h);
    if (calculateVariance(widths) > 100 || calculateVariance(heights) > 100) {
      findings.push(createFinding({
        scope: 'object',
        targetId: obj.id,
        category: 'diagram.inconsistent_node_dimensions',
        severity: 'info',
        evidenceType: 'deterministic',
        summary: `Diagram ${obj.id} has inconsistent node sizes`,
        evidence: [],
        suggestedActions: [
          { type: 'fix', description: 'Standardize node dimensions', toolName: 'apply_diagram_layout' },
        ],
      }));
    }

    // Excessive bends
    for (const edge of edges) {
      // Simplified - would need actual bend count from geometry
    }

    // Reading order mismatch
    // Check if visual order matches logical order
    if (diagram.entryNodeId) {
      const logicalOrder = getLogicalOrder(diagram);
      const visualOrder = getVisualOrder(diagram);
      if (JSON.stringify(logicalOrder) !== JSON.stringify(visualOrder)) {
        findings.push(createFinding({
          scope: 'object',
          targetId: obj.id,
          category: 'diagram.reading_order_mismatch',
          severity: 'warning',
          evidenceType: 'deterministic',
          summary: `Diagram ${obj.id} visual order differs from logical order`,
          evidence: [],
          suggestedActions: [
            { type: 'fix', description: 'Adjust layout to match logical flow', toolName: 'apply_diagram_layout' },
          ],
        }));
      }
    }

    // Insufficient contrast
    // Would need actual rendered colors

    // Color-only meaning
    // Would need actual rendered colors
  }

  return findings;
}

// ============================================================================
// Accessibility Validators (FR-117)
// ============================================================================

function validateAccessibility(project: DocumentProject, scope?: string, targetId?: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  // Reading order defects
  for (const page of Object.values(project.pages)) {
    if (scope === 'page' && targetId && page.id !== targetId) continue;

    // Check for gaps in reading order
    const includedObjects = page.objects.filter(id => {
      const obj = project.objects[id];
      return obj && obj.accessibility.includedInReadingOrder;
    });
    const readingOrderSet = new Set(page.readingOrder);

    for (const objId of includedObjects) {
      if (!readingOrderSet.has(objId)) {
        findings.push(createFinding({
          scope: 'object',
          targetId: objId,
          category: 'a11y.reading_order',
          severity: 'error',
          evidenceType: 'deterministic',
          summary: `Object ${objId} included in reading order but not in page reading order`,
          evidence: [],
          suggestedActions: [
            { type: 'fix', description: 'Add to page reading order', toolName: 'reorder_reading_order' },
          ],
        }));
      }
    }

    for (const objId of page.readingOrder) {
      const obj = project.objects[objId];
      if (obj && !obj.accessibility.includedInReadingOrder) {
        findings.push(createFinding({
          scope: 'object',
          targetId: objId,
          category: 'a11y.reading_order',
          severity: 'error',
          evidenceType: 'deterministic',
          summary: `Object ${objId} in reading order but marked excluded`,
          evidence: [],
          suggestedActions: [
            { type: 'fix', description: 'Set includedInReadingOrder=true or remove from reading order', toolName: 'update_object' },
          ],
        }));
      }
    }
  }

  // Missing language
  if (!project.language) {
    findings.push(createFinding({
      scope: 'document',
      targetId: project.id,
      category: 'a11y.missing_language',
      severity: 'error',
      evidenceType: 'deterministic',
      summary: `Document missing language attribute`,
      evidence: [],
      suggestedActions: [
        { type: 'fix', description: 'Set document language', toolName: 'update_project' },
      ],
    }));
  }

  // Missing title
  if (!project.title) {
    findings.push(createFinding({
      scope: 'document',
      targetId: project.id,
      category: 'a11y.missing_title',
      severity: 'error',
      evidenceType: 'deterministic',
      summary: `Document missing title`,
      evidence: [],
      suggestedActions: [
        { type: 'fix', description: 'Set document title', toolName: 'update_project' },
      ],
    }));
  }

  // Decorative exposure
  for (const obj of Object.values(project.objects)) {
    if (scope === 'object' && targetId && obj.id !== targetId) continue;
    if (obj.accessibility.isDecorative && obj.accessibility.includedInReadingOrder) {
      findings.push(createFinding({
        scope: 'object',
        targetId: obj.id,
        category: 'a11y.decorative_exposure',
        severity: 'warning',
        evidenceType: 'deterministic',
        summary: `Decorative object ${obj.id} included in reading order`,
        evidence: [],
        suggestedActions: [
          { type: 'fix', description: 'Remove from reading order', toolName: 'reorder_reading_order' },
        ],
      }));
    }
  }

  // Meaningful exclusion
  for (const obj of Object.values(project.objects)) {
    if (scope === 'object' && targetId && obj.id !== targetId) continue;
    if (!obj.accessibility.isDecorative && !obj.accessibility.includedInReadingOrder) {
      findings.push(createFinding({
        scope: 'object',
        targetId: obj.id,
        category: 'a11y.meaningful_exclusion',
        severity: 'warning',
        evidenceType: 'deterministic',
        summary: `Non-decorative object ${obj.id} excluded from reading order`,
        evidence: [],
        suggestedActions: [
          { type: 'fix', description: 'Add to reading order or mark as decorative', toolName: 'update_object' },
        ],
      }));
    }
  }

  // Inaccessible names
  for (const obj of Object.values(project.objects)) {
    if (scope === 'object' && targetId && obj.id !== targetId) continue;
    if (obj.kind === 'image' && !obj.accessibility.isDecorative && !obj.altTextApproved) {
      findings.push(createFinding({
        scope: 'object',
        targetId: obj.id,
        category: 'a11y.inaccessible_names',
        severity: 'error',
        evidenceType: 'deterministic',
        summary: `Image ${obj.id} has no accessible name (alt text)`,
        evidence: [],
        suggestedActions: [
          { type: 'fix', description: 'Add and approve alt text', toolName: 'approve_alt_text' },
        ],
      }));
    }
  }

  return findings;
}

// ============================================================================
// Subjective AI Assessments (FR-118)
// ============================================================================

export function validateSubjective(project: DocumentProject, scope?: string, targetId?: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  // Weak hierarchy
  // Tone mismatch
  // Stereotype
  // Crowding
  // Ambiguous metaphor
  // Repetition
  // Image-message inconsistency

  // These require agent analysis - placeholder for integration
  return findings;
}

// ============================================================================
// Helper Functions
// ============================================================================

function createFinding(params: {
  scope: 'object' | 'page' | 'document';
  targetId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  evidenceType: EvidenceType;
  summary: string;
  evidence: string[];
  suggestedActions: SuggestedAction[];
}): ValidationFinding {
  const now = new Date().toISOString();
  return {
    id: `fnd_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}` as FindingId,
    scope: params.scope,
    targetId: params.targetId as ObjectId | PageId | string,
    category: params.category,
    severity: params.severity,
    evidenceType: params.evidenceType,
    summary: params.summary,
    evidence: params.evidence,
    suggestedActions: params.suggestedActions,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
}

function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

function boundsWithin(inner: Bounds, outer: Bounds): boolean {
  return inner.x >= outer.x &&
         inner.y >= outer.y &&
         inner.x + inner.w <= outer.x + outer.w &&
         inner.y + inner.h <= outer.y + outer.h;
}

function getPageBounds(template: string): Bounds {
  // A4 at 72 DPI: 595 x 842 points
  return { x: 0, y: 0, w: 595, h: 842 };
}

function checkMargins(bounds: Bounds, pageBounds: Bounds): { violated: boolean; side: string; value: number; min: number } {
  const minMargin = 36; // 0.5 inch at 72 DPI
  if (bounds.x < minMargin) return { violated: true, side: 'left', value: bounds.x, min: minMargin };
  if (bounds.y < minMargin) return { violated: true, side: 'top', value: bounds.y, min: minMargin };
  if (bounds.x + bounds.w > pageBounds.w - minMargin) return { violated: true, side: 'right', value: pageBounds.w - (bounds.x + bounds.w), min: minMargin };
  if (bounds.y + bounds.h > pageBounds.h - minMargin) return { violated: true, side: 'bottom', value: pageBounds.h - (bounds.y + bounds.h), min: minMargin };
  return { violated: false, side: '', value: 0, min: 0 };
}

function groupByColumn(objects: DocumentObject[]): DocumentObject[][] {
  const columns: Record<number, DocumentObject[]> = {};
  for (const obj of objects) {
    const col = Math.round(obj.bounds.x / 50) * 50; // 50px grid
    if (!columns[col]) columns[col] = [];
    columns[col].push(obj);
  }
  return Object.values(columns).filter(c => c.length > 1);
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
}

function estimateTextLines(text: string, width: number): number {
  const charsPerLine = Math.max(1, Math.floor(width / 8)); // ~8px per char
  return Math.ceil(text.length / charsPerLine);
}

function findReachableNodes(diagram: Diagram, entryId: string): Set<string> {
  const reachable = new Set<string>();
  const queue = [entryId];
  const adjacency = new Map<string, string[]>();

  for (const edge of diagram.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge.to);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      if (!reachable.has(neighbor)) queue.push(neighbor);
    }
  }

  return reachable;
}

function hasCycle(diagram: Diagram): boolean {
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const adjacency = new Map<string, string[]>();

  for (const edge of diagram.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge.to);
  }

  function dfs(node: string): boolean {
    visited.add(node);
    recStack.add(node);

    for (const neighbor of adjacency.get(node) || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }

    recStack.delete(node);
    return false;
  }

  for (const node of diagram.nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true;
    }

    return false;
  }
}

function getDiagramBounds(diagram: Diagram): Bounds {
  if (diagram.nodes.length === 0) return { x: 0, y: 0, w: 500, h: 500 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of diagram.nodes) {
    minX = Math.min(minX, node.bounds.x);
    minY = Math.min(minY, node.bounds.y);
    maxX = Math.max(maxX, node.bounds.x + node.bounds.w);
    maxY = Math.max(maxY, node.bounds.y + node.bounds.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function getLogicalOrder(diagram: Diagram): string[] {
  // BFS from entry
  const reachable = findReachableNodes(diagram, diagram.entryNodeId!);
  return Array.from(reachable);
}

function getVisualOrder(diagram: Diagram): string[] {
  // Top-to-bottom, left-to-right
  return diagram.nodes
    .sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x)
    .map(n => n.id);
}