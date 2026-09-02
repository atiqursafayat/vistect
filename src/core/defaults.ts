/**
 * Starting values for a new project — spec §7 (intent contract) and §9 (theme).
 *
 * A new document is never blank: §21.1 says the first thing the user hears is a
 * document that already has a shape. Every value here is overwritable by
 * `update_intent_contract` / `set_theme`.
 */
import type { IntentContract, Theme } from './model/project.js';

/**
 * Neutral, non-charity defaults. §7's `avoid` list is pre-seeded with the framings
 * the product's own brief rules out, because an empty `avoid` list reads to the agent
 * as "nothing is off limits".
 */
export function defaultIntentContract(documentType = 'impact-report'): IntentContract {
  return {
    documentType,
    purpose: '',
    audience: [],
    primaryMessage: '',
    secondaryMessages: [],
    tone: ['clear', 'factual'],
    avoid: ['pity framing', 'charity framing', 'medical imagery'],
    brandColors: {
      primary: '#102A43',
      accent: '#0B6E6E',
      background: '#FFFFFF',
      text: '#102A43',
    },
    brandFonts: { heading: 'Inter', body: 'Source Serif 4' },
    requiredVisuals: {},
    accessibilityRequirements: {
      contextualAltText: true,
      chartDataTables: true,
      diagramLongDescriptions: true,
      noColorOnlyMeaning: true,
      minimumContrastRatio: 4.5,
    },
    privacySensitivity: 'standard',
    exportRequirements: ['accessible-html', 'pdf'],
  };
}

/**
 * `muted` is the only colour not drawn from the brand palette: it is derived once here
 * so that §16.2's contrast check has a single value to test rather than a per-object
 * choice. #486581 on #FFFFFF measures 6.4:1, clearing AA for body text.
 */
export function defaultTheme(contract: IntentContract = defaultIntentContract()): Theme {
  return {
    colors: {
      primary: contract.brandColors.primary,
      accent: contract.brandColors.accent,
      background: contract.brandColors.background,
      text: contract.brandColors.text,
      muted: '#486581',
    },
    fonts: { heading: contract.brandFonts.heading, body: contract.brandFonts.body },
    headingScalePx: [34, 25, 19, 16],
    bodySizePx: 15,
    baselinePx: 23,
  };
}
