export type PoseName =
  | 'idle' | 'hello' | 'analyze' | 'verified' | 'fake' | 'doubt'
  | 'warning' | 'explain' | 'idea' | 'concern' | 'relief' | 'think'

export interface WordInfo {
  word: string
  pose: PoseName
  fired: boolean
  held: boolean
  matched: PoseName | null
}

export interface BulbOptions {
  uid?: string
  expressions?: 'rare' | 'some' | 'often'
  reducedMotion?: boolean
  onPose?: (name: PoseName) => void
}

export interface BulbController {
  svg: SVGSVGElement
  setPose(name: PoseName): void
  getPose(): PoseName
  pin(name: PoseName): void
  release(): void
  speak(
    text: string | string[],
    o?: { pace?: number; talk?: boolean; onWord?: (info: WordInfo, index: number) => void; onDone?: () => void },
  ): void
  feed(word: string, talk?: boolean): WordInfo
  stop(): void
  setExpressions(mode: 'rare' | 'some' | 'often'): void
  toSVG(): string
  destroy(): void
}

export function createBulb(host: HTMLElement, options?: BulbOptions): BulbController
export function renderPose(host: HTMLElement, name: PoseName, uid?: string): SVGSVGElement
export const POSE_NAMES: Record<PoseName, string>
export default createBulb
