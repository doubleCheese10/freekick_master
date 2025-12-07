
export type Point = {
  x: number;
  y: number;
};

export enum GamePhase {
  PLACEMENT = 'PLACEMENT',
  AIMING = 'AIMING',
  POWER = 'POWER',
  SHOOTING = 'SHOOTING',
  RESULT = 'RESULT',
}

export type GameResult = 'GOAL' | 'SAVED' | 'MISS' | null;

export interface GameState {
  phase: GamePhase;
  ballPos: Point;
  aimAngle: number; // Degrees, 0 is straight up
  curve: number; // -10 to 10
  power: number; // 0 to 100
  goaliePos: number; // X coordinate
  score: number;
  attempts: number;
  result: GameResult;
}

export interface NetSegment {
  A: Point;
  B: Point;
  normal: Point; // Unit vector pointing INTO the field (collision normal)
  offset: number; // Displacement magnitude along the normal (negative means outward bulge)
  velocity: number; // Velocity of the displacement
}
