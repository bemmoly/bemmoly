/**
 * The purpose-drawn glyphs: issue type, priority and status, each an SVG built from the
 * design review's drawings (ADR 0015), never a font character.
 */
export {
  PRIORITIES,
  PriorityGlyph,
  type Priority,
  type PriorityGlyphProps,
} from './priority-glyph.tsx';
export {
  StatusGlyph,
  statusStage,
  type StatusCategoryKey,
  type StatusGlyphProps,
  type StatusStage,
} from './status-glyph.tsx';
export { TypeGlyph, type TypeGlyphProps, type TypeGlyphSize } from './type-glyph.tsx';
export {
  ISSUE_TYPES,
  isBuiltInType,
  nearestTypeColor,
  TYPE_COLOR_CHOICES,
  TYPE_ICON_CHOICES,
  typeLook,
  type IssueType,
  type IssueTypeLike,
  type IssueTypeRef,
  type TypeLook,
  type TypeMark,
} from './type-look.ts';
