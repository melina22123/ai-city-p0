/**
 * Shared types for AI City P0 Systems
 * Core type definitions used across all systems
 */

// ============================================================================
// Entity & Component Types (ECS Foundation)
// ============================================================================

export type EntityId = number & { readonly __brand: unique symbol };
export type ComponentId = number & { readonly __brand: unique symbol };
export type ArchetypeId = number & { readonly __brand: unique symbol };

export function createEntityId(id: number): EntityId {
  return id as EntityId;
}

export function createComponentId(id: number): ComponentId {
  return id as ComponentId;
}

export function createArchetypeId(id: number): ArchetypeId {
  return id as ArchetypeId;
}

export interface Component<T = unknown> {
  readonly entityId: EntityId;
  readonly componentId: ComponentId;
  data: T;
}

export interface Archetype {
  readonly id: ArchetypeId;
  readonly componentIds: readonly ComponentId[];
  readonly entities: readonly EntityId[];
}

// ============================================================================
// Spatial Types
// ============================================================================

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Bounds {
  min: Vec2;
  max: Vec2;
}

export interface SpatialGridCell {
  readonly entities: readonly EntityId[];
  readonly bounds: Bounds;
}

export interface SpatialHashGrid {
  readonly cellSize: number;
  readonly width: number;
  readonly height: number;
  readonly cells: Map<string, SpatialGridCell>;
}

// ============================================================================
// Time & Tick Types
// ============================================================================

export type Tick = number & { readonly __brand: unique symbol };
export type FrameIndex = number & { readonly __brand: unique symbol };

export function createTick(tick: number): Tick {
  return tick as Tick;
}

export function createFrameIndex(frame: number): FrameIndex {
  return frame as FrameIndex;
}

export interface TickStaggerConfig {
  readonly agentsPerFrame: number;
  readonly totalAgents: number;
  readonly frameCycleLength: number; // frames per full cycle
}

export interface LODLevel {
  readonly name: string;
  readonly distanceThreshold: number;
  readonly updateInterval: number; // ticks between updates
  readonly behaviorComplexity: 'full' | 'simplified' | 'minimal';
}

// ============================================================================
// RNG Types
// ============================================================================

export interface RNGStreamState {
  readonly streamId: string;
  readonly state: Uint32Array; // seedrandom state
}

export interface RNGRegistry {
  readonly streams: Map<string, RNGStreamState>;
  readonly globalSeed: number;
}

// ============================================================================
// Serialization Types
// ============================================================================

export interface SaveHeader {
  readonly version: number;
  readonly seed: number;
  readonly tick: Tick;
  readonly checksum: Uint32Array;
  readonly timestamp: number;
}

export interface SaveMetadata {
  readonly header: SaveHeader;
  readonly archetypeCount: number;
  readonly entityCount: number;
  readonly componentCount: number;
  readonly spatialGridCells: number;
  readonly rngStreamCount: number;
  readonly narrativeEventCount: number;
}

export type SaveChunkType =
  | 'header'
  | 'archetypes'
  | 'components'
  | 'spatial_grid'
  | 'rng_streams'
  | 'narrative'
  | 'checkpoint';

export interface SaveChunk {
  readonly type: SaveChunkType;
  readonly offset: number;
  readonly length: number;
  readonly checksum: number;
}

// ============================================================================
// Narrative Types
// ============================================================================

export interface Rumor {
  readonly id: string;
  readonly content: string;
  readonly originEntity: EntityId;
  readonly spreadEntities: readonly EntityId[];
  readonly credibility: number;
  readonly timestamp: Tick;
}

export interface NarrativeArc {
  readonly id: string;
  readonly name: string;
  readonly stage: number;
  readonly participants: readonly EntityId[];
  readonly state: Record<string, unknown>;
  readonly startTick: Tick;
  readonly lastUpdateTick: Tick;
}

export interface NarrativeEvent {
  readonly id: string;
  readonly type: string;
  readonly participants: readonly EntityId[];
  readonly data: Record<string, unknown>;
  readonly tick: Tick;
}

export interface NarrativeState {
  readonly rumors: readonly Rumor[];
  readonly arcs: readonly NarrativeArc[];
  readonly events: readonly NarrativeEvent[];
  readonly nextRumorId: number;
  readonly nextArcId: number;
  readonly nextEventId: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface WeightedOption<T> {
  readonly item: T;
  readonly weight: number;
}

export interface UtilityScore {
  readonly actionId: string;
  readonly score: number;
  readonly needId: string;
}

export type Priority = 'survival' | 'social' | 'work' | 'idle' | 'cognitive';

export const PRIORITY_ORDER: readonly Priority[] = [
  'survival',
  'social',
  'work',
  'cognitive',
  'idle',
];

export function comparePriority(a: Priority, b: Priority): number {
  return PRIORITY_ORDER.indexOf(a) - PRIORITY_ORDER.indexOf(b);
}