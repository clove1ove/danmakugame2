export type Difficulty = 'EASY' | 'NORMAL' | 'HARD' | 'LUNATIC';

export type GameState = 'TITLE' | 'HOW_TO_PLAY' | 'PLAYING' | 'GAMEOVER' | 'CLEAR';

export interface Player {
  x: number;
  y: number;
  radius: number;          // 見た目の判定 or 描画サイズ
  hitRadius: number;       // 弾幕特有の小さい当たり判定 (喰らい判定)
  speed: number;
  slowSpeed: number;       // 低速移動時のスピード (Shiftキー)
  hp: number;
  maxHp: number;
  bombs: number;
  score: number;
  highScore: number;
  invincibleTimer: number; // 被弾後の無敵フレーム数
  lastHitTime: number;     // アニメーション用
  isShooting: boolean;
  shootCooldown: number;
}

export interface Boss {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  radius: number;
  hp: number;
  maxHp: number;
  phase: number;           // 攻撃の段階 (1, 2, 3...)
  phaseMaxHp: number[];    // 各フェーズの切り替わりHPライン
  actionTimer: number;     // 攻撃のパターン切り替えや、弾幕の間引き用コアループタイマー
  moveTimer: number;       // 移動用のタイマー
  angerFactor: number;     // HPが減ると攻撃が苛烈になる倍率
  chargeAmount: number;    // 特殊攻撃のチャージ演出用 (0 ~ 1)
}

export type BulletType = 'NORMAL' | 'BIG' | 'AIM' | 'SPIKE' | 'LIGHTNING' | 'CURVED' | 'LASER' | 'ONIBI';

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  type: BulletType;
  damage: number;
  angle?: number;          // 角度（回転や軌道の計算用）
  speed?: number;          // 基本スピード
  accel?: number;          // 加速度
  rotationSpeed?: number;  // 弾自体が回転・カーブする場合の速度
  homingTimer?: number;    // 誘導弾が誘導を終えるまでの時間
  pulse?: number;          // 大きさの脈動
}

export interface PlayerBullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  maxLife: number;
  life: number;
  type?: 'circle' | 'spark' | 'ring' | 'cherry' | 'skull';
}

export interface Spark {
  x: number;
  y: number;
  length: number;
  angle: number;
  color: string;
  alpha: number;
  decay: number;
}

export interface KeyState {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
  ArrowUp: boolean;
  ArrowDown: boolean;
  ArrowLeft: boolean;
  ArrowRight: boolean;
  Shift: boolean; // 低速移動
  z: boolean;     // ショット
  x: boolean;     // ボム
  Space: boolean; // ボム (代用)
}
