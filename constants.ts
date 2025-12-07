
export const FIELD_WIDTH = 600; // The "Playable" width (Penalty box area focus)
export const FIELD_HEIGHT = 550; // The "Playable" height for the game logic
export const GOAL_WIDTH = 200;
export const GOAL_DEPTH = 40;
export const BALL_RADIUS = 8;
export const GOALIE_RADIUS = 15;
export const PENALTY_BOX_WIDTH = 400;
export const PENALTY_BOX_HEIGHT = 200; // From top
export const GOAL_AREA_WIDTH = 200;
export const GOAL_AREA_HEIGHT = 80;

// Visual Full Pitch Constants (For extended rendering)
export const FULL_PITCH_WIDTH = 1400; // Much wider than playable area
export const FULL_PITCH_LENGTH = 1500; // Distance to midfield
export const MIDFIELD_Y = 800;
export const CORNER_RADIUS = 20;

// Physics
// Max speed in pixels per frame. Increased to make shots feel powerful.
export const MAX_POWER_SPEED = 20; 

// FRICTION COEFFICIENTS
export const FRICTION_AIR = 0.994; // Very low drag in air
export const FRICTION_GROUND = 0.88; // High drag on grass (stops "icy" feeling)
export const FRICTION_POST_IMPACT = 0.6; // Massive energy loss hitting post

// How much the spin affects the curve (Magnus effect strength)
export const MAGNUS_STRENGTH = 0.08; 

// Gravity for Z-axis simulation
export const GRAVITY = 0.8;
export const BOUNCE_FACTOR_GROUND = 0.4;
export const BOUNCE_FACTOR_POST = 0.35;

// Speed below which ball stops completely
export const STOP_THRESHOLD = 0.15;

// Time Scale for animation (0.5 = 50% speed)
export const TIME_SCALE = 0.5;

// Colors
export const COLOR_GRASS_DARK = '#15803d';
export const COLOR_GRASS_LIGHT = '#22c55e';
export const COLOR_LINE = 'rgba(255, 255, 255, 0.8)';
export const COLOR_BALL = '#ffffff';
export const COLOR_GOALIE = '#ef4444';
