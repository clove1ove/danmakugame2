import React, { useEffect, useRef, useState } from 'react';
import { 
  Difficulty, 
  GameState, 
  Player, 
  Boss, 
  Bullet, 
  PlayerBullet, 
  Particle, 
  Spark,
  KeyState 
} from '../types';
import { SoundManager } from './SoundManager';

interface GameCanvasProps {
  difficulty: Difficulty;
  gameState: GameState;
  onGameEnd: (status: 'CLEAR' | 'GAMEOVER', finalScore: number) => void;
  onScoreUpdate: (score: number) => void;
  soundEnabled: boolean;
  onBackToTitle: () => void;
}

const WIDTH = 600;
const HEIGHT = 680;

// 難易度ごとのパラメータ調整
const DIFFICULTY_CONFIG = {
  EASY: {
    playerMaxHp: 4,
    playerBombs: 3,
    bossHpMultiplier: 0.7,
    bulletSpeedMultiplier: 0.65,
    bulletFrequencyMultiplier: 1.4, // 数値が高いほど弾の発射間隔が長い（ぬるい）
  },
  NORMAL: {
    playerMaxHp: 4,
    playerBombs: 3,
    bossHpMultiplier: 1.0,
    bulletSpeedMultiplier: 1.0,
    bulletFrequencyMultiplier: 1.0,
  },
  HARD: {
    playerMaxHp: 4,
    playerBombs: 2,
    bossHpMultiplier: 1.4,
    bulletSpeedMultiplier: 1.3,
    bulletFrequencyMultiplier: 0.8,
  },
  LUNATIC: {
    playerMaxHp: 4,
    playerBombs: 1,
    bossHpMultiplier: 2.0,
    bulletSpeedMultiplier: 1.7,
    bulletFrequencyMultiplier: 0.55,
  }
};

// -----------------------------------------------------------------
// お手製配色カラー
// -----------------------------------------------------------------
const colors = {
  bloodRed: ['#b91c1c', '#dc2626', '#ef4444', '#f87171'],
  sparkYellow: ['#fbbf24', '#f59e0b', '#d97706', '#ffffff']
};

export const GameCanvas: React.FC<GameCanvasProps> = ({
  difficulty,
  gameState,
  onGameEnd,
  onScoreUpdate,
  soundEnabled,
  onBackToTitle,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ゲームステート（アニメーションループで参照・変更するため、すべて ref で管理して再レンダリングによるラグを防ぐ）
  const playerRef = useRef<Player>({
    x: WIDTH / 2,
    y: HEIGHT - 100,
    radius: 12,
    hitRadius: 3.5, // 弾幕おなじみの小さな当たり判定
    speed: 4.8,
    slowSpeed: 2.0,
    hp: 4,
    maxHp: 4,
    bombs: 3,
    score: 0,
    highScore: parseInt(localStorage.getItem('oni_bullet_highscore') || '0', 10),
    invincibleTimer: 0,
    lastHitTime: 0,
    isShooting: false,
    shootCooldown: 0,
  });

  const bossRef = useRef<Boss>({
    x: WIDTH / 2,
    y: -150, // 登場演出のため最初画面に入っていない
    targetX: WIDTH / 2,
    targetY: 130,
    radius: 45,
    hp: 1, // 初期、下記で動的設定される
    maxHp: 1,
    phase: 1,
    phaseMaxHp: [0, 1000, 1000, 1500], // 各フェーズの切り替わり閾値
    actionTimer: 0,
    moveTimer: 0,
    angerFactor: 1.0,
    chargeAmount: 0,
  });

  const bulletsRef = useRef<Bullet[]>([]);
  const playerBulletsRef = useRef<PlayerBullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const keysRef = useRef<KeyState>({
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    Shift: false, z: false, x: false, Space: false
  });

  // UI表示用ステート。1秒に数回更新してユーザーに提示する
  const [uiHp, setUiHp] = useState(4);
  const [uiMaxHp, setUiMaxHp] = useState(4);
  const [uiBombs, setUiBombs] = useState(3);
  const [uiScore, setUiScore] = useState(0);
  const [uiHighScore, setUiHighScore] = useState(0);
  const [uiBossHp, setUiBossHp] = useState(0);
  const [uiBossMaxHp, setUiBossMaxHp] = useState(0);
  const [uiBossPhase, setUiBossPhase] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [bossApproaching, setBossApproachingState] = useState(true);
  const bossApproachingRef = useRef(true);
  const setBossApproaching = (val: boolean) => {
    bossApproachingRef.current = val;
    setBossApproachingState(val);
  };

  // ボムエフェクト用のリングアニメーション
  const [bombActive, setBombActive] = useState(false);
  const bombRadiusRef = useRef(0);

  // プレイヤーの走る・呼吸する歩行フレーム(アニメーション用)
  const animFrameRef = useRef(0);

  // スマホ・モバイル向けの精密移動（低速）のトグル有効状態
  const [mobileSlowMode, setMobileSlowMode] = useState(false);

  // ステートに対する最新リファレンスを保持してキーイベントでの状態追跡を安定化させる
  const gameStateRef = useRef(gameState);
  const isPausedRef = useRef(isPaused);
  const bombActiveRef = useRef(bombActive);

  useEffect(() => {
    gameStateRef.current = gameState;
    if (gameState === 'PLAYING') {
      const keys = keysRef.current;
      if (keys) {
        keys.w = false;
        keys.a = false;
        keys.s = false;
        keys.d = false;
        keys.ArrowUp = false;
        keys.ArrowDown = false;
        keys.ArrowLeft = false;
        keys.ArrowRight = false;
        keys.Shift = false;
        keys.z = false;
        keys.x = false;
        keys.Space = false;
      }
      setMobileSlowMode(false);
      
      // ゲーム開始時に確実にCanvasにフォーカスを合わせる
      canvasRef.current?.focus();
      const timer = setTimeout(() => {
        canvasRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    bombActiveRef.current = bombActive;
  }, [bombActive]);

  // ドラッグ操作による移動（スマホ＆マウスドラッグ対応）
  const isDraggingRef = useRef(false);
  const lastDragPosRef = useRef({ x: 0, y: 0 });

  const handleDragStart = (clientX: number, clientY: number) => {
    if (gameStateRef.current !== 'PLAYING' || isPausedRef.current) return;
    isDraggingRef.current = true;
    lastDragPosRef.current = { x: clientX, y: clientY };
    
    // Canvasに入力を当てるためフォーカスを移動する
    canvasRef.current?.focus();
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!canvasRef.current || !isDraggingRef.current || gameStateRef.current !== 'PLAYING' || isPausedRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    
    const dx = (clientX - lastDragPosRef.current.x) * scaleX;
    const dy = (clientY - lastDragPosRef.current.y) * scaleY;
    
    const player = playerRef.current;
    
    // スライド操作での追従感度（快適にするため1.25倍にチューニング）
    const sensitivity = 1.25;
    player.x += dx * sensitivity;
    player.y += dy * sensitivity;
    
    // 画面外はみ出し限界
    player.x = Math.max(player.radius, Math.min(WIDTH - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(HEIGHT - player.radius, player.y));
    
    lastDragPosRef.current = { x: clientX, y: clientY };
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
  };

  const toggleMobileSlowMode = () => {
    setMobileSlowMode(prev => {
      const next = !prev;
      keysRef.current.Shift = next;
      return next;
    });
  };

  // BGM管理
  useEffect(() => {
    SoundManager.enabled = soundEnabled;
  }, [soundEnabled]);

  // ハイスコア情報をロード
  useEffect(() => {
    const s = parseInt(localStorage.getItem('oni_bullet_highscore') || '0', 10);
    setUiHighScore(s);
  }, [gameState]);

  // キー入力を監視 (依存配列から変動値を除外、バインド変更によるキー押し漏れや不感症を完璧に治す)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key;
      const keys = keysRef.current;

      if (k === 'w' || k === 'W') keys.w = true;
      if (k === 'a' || k === 'A') keys.a = true;
      if (k === 's' || k === 'S') keys.s = true;
      if (k === 'd' || k === 'D') keys.d = true;
      if (k === 'ArrowUp') keys.ArrowUp = true;
      if (k === 'ArrowDown') keys.ArrowDown = true;
      if (k === 'ArrowLeft') keys.ArrowLeft = true;
      if (k === 'ArrowRight') keys.ArrowRight = true;
      if (k === 'Shift') keys.Shift = true;
      if (k === 'z' || k === 'Z') keys.z = true;
      if (k === 'x' || k === 'X') keys.x = true;
      if (e.code === 'Space') keys.Space = true;

      // ゲーム中にボム発動
      if ((k === 'x' || k === 'X' || e.code === 'Space') && gameStateRef.current === 'PLAYING' && !isPausedRef.current && !bombActiveRef.current) {
        triggerBomb();
      }

      // Pで一時停止
      if (k === 'p' || k === 'P') {
        if (gameStateRef.current === 'PLAYING') {
          setIsPaused(prev => !prev);
        }
      }

      // 矢印キーやスペースキーなどのブラウザ標準スクロールを防ぐ (プレイ本編中のみ)
      if (gameStateRef.current === 'PLAYING') {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) {
          e.preventDefault();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key;
      const keys = keysRef.current;

      if (k === 'w' || k === 'W') keys.w = false;
      if (k === 'a' || k === 'A') keys.a = false;
      if (k === 's' || k === 'S') keys.s = false;
      if (k === 'd' || k === 'D') keys.d = false;
      if (k === 'ArrowUp') keys.ArrowUp = false;
      if (k === 'ArrowDown') keys.ArrowDown = false;
      if (k === 'ArrowLeft') keys.ArrowLeft = false;
      if (k === 'ArrowRight') keys.ArrowRight = false;
      // モバイル用の精密トグルの場合は、Shiftの解除をキーKeyUp時のみに行い、モバイルトグルと衝突させない
      if (k === 'Shift') {
        setMobileSlowMode(false);
        keys.Shift = false;
      }
      if (k === 'z' || k === 'Z') keys.z = false;
      if (k === 'x' || k === 'X') keys.x = false;
      if (e.code === 'Space') keys.Space = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // ボムを発動
  const triggerBomb = () => {
    const player = playerRef.current;
    if (player.bombs > 0 && !bombActive) {
      player.bombs--;
      setUiBombs(player.bombs);
      setBombActive(true);
      bombRadiusRef.current = 20;
      SoundManager.playBomb();

      // ボスの行動タイマーを遅延させる、または少しノックバック
      // 画面上の全弾薬を消滅させる（ポイントに変換）
      const bulletsCount = bulletsRef.current.length;
      bulletsRef.current.forEach(b => {
        // 弾が消滅したときのパーティクル
        createBulletDisappearParticles(b.x, b.y, b.color);
        player.score += 50; // ボムで消すとボーナス点
      });
      bulletsRef.current = [];
      playerRef.current.score += bulletsCount * 50;
      setUiScore(player.score);
      onScoreUpdate(player.score);

      // 画面全体のフラッシュ（一瞬）
      createBombFlashParticles();

      // しばらく無敵にする
      player.invincibleTimer = 180; // 3秒間無敵
    }
  };

  // 弾の消滅パーティクル
  const createBulletDisappearParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 3,
        color,
        alpha: 1.0,
        decay: 0.04 + Math.random() * 0.04,
        maxLife: 20,
        life: 20,
        type: 'circle'
      });
    }
  };

  // ボム時のスクリーン全体のフラッシュエフェクト用
  const createBombFlashParticles = () => {
    for (let i = 0; i < 40; i++) {
      particlesRef.current.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        radius: 4 + Math.random() * 8,
        color: 'hsla(' + (Math.random() * 60 + 180) + ', 100%, 75%, 0.8)', // 青白
        alpha: 1.0,
        decay: 0.015,
        maxLife: 60,
        life: 60,
        type: 'spark'
      });
    }
  };

  // ゲームの初期化
  const initGame = () => {
    const config = DIFFICULTY_CONFIG[difficulty];
    
    // プレイヤー初期化
    playerRef.current = {
      x: WIDTH / 2,
      y: HEIGHT - 120,
      radius: 12,
      hitRadius: 3.5,
      speed: 4.8,
      slowSpeed: 1.8,
      hp: config.playerMaxHp,
      maxHp: config.playerMaxHp,
      bombs: config.playerBombs,
      score: 0,
      highScore: parseInt(localStorage.getItem('oni_bullet_highscore') || '0', 10),
      invincibleTimer: 120, // 最初は安全のため長めの無敵
      lastHitTime: 0,
      isShooting: false,
      shootCooldown: 0,
    };

    // ボス（鬼）初期化
    // ボス（鬼）初期化 (HPを劇的に引き上げ、弾幕展開を長く堪能できるように調整)
    const totalHp = Math.round(6200 * config.bossHpMultiplier);
    const p1Hp = Math.round(2200 * config.bossHpMultiplier);
    const p2Hp = Math.round(1800 * config.bossHpMultiplier);
    const p3Hp = Math.round(2200 * config.bossHpMultiplier);
    
    bossRef.current = {
      x: WIDTH / 2,
      y: -150, // 画面の上から降りてくる演出用
      targetX: WIDTH / 2,
      targetY: 130,
      radius: 48,
      hp: totalHp,
      maxHp: totalHp,
      phase: 1,
      phaseMaxHp: [0, p2Hp + p3Hp, p3Hp, 0], // フェーズ切り替えの残HP閾値 [0, フェーズ2移行, フェーズ3移行, 0]
      actionTimer: 0,
      moveTimer: 0,
      angerFactor: 1.0,
      chargeAmount: 0,
    };

    bulletsRef.current = [];
    playerBulletsRef.current = [];
    particlesRef.current = [];
    sparksRef.current = [];
    setBombActive(false);

    setUiHp(playerRef.current.hp);
    setUiMaxHp(playerRef.current.maxHp);
    setUiBombs(playerRef.current.bombs);
    setUiScore(0);
    setUiBossHp(totalHp);
    setUiBossMaxHp(totalHp);
    setUiBossPhase(1);
    setBossApproaching(true);

    if (soundEnabled) {
      SoundManager.playWarning();
      setTimeout(() => {
        SoundManager.startBGM();
      }, 300);
    }
  };

  // 被弾時
  const handlePlayerHit = (damage: number) => {
    const player = playerRef.current;
    if (player.invincibleTimer > 0) return;

    player.hp -= damage;
    player.invincibleTimer = 90; // 1.5秒間無敵
    player.lastHitTime = Date.now();
    setUiHp(player.hp);
    SoundManager.playHit();

    // 激しい赤い飛び散りエフェクト（痛々しい！）
    createPlayerHitParticles(player.x, player.y);

    if (player.hp <= 0) {
      // ゲームオーバー
      saveHighScore();
      SoundManager.stopBGM();
      SoundManager.playGameOver();
      onGameEnd('GAMEOVER', player.score);
    }
  };

  // プレイヤーがダメージを受けた時のパーティクル
  const createPlayerHitParticles = (px: number, py: number) => {
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      particlesRef.current.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 4,
        color: colors.bloodRed[Math.floor(Math.random() * colors.bloodRed.length)],
        alpha: 1.0,
        decay: 0.02 + Math.random() * 0.02,
        maxLife: 40,
        life: 40,
      });
    }
  };

  // ボス傷害時
  const handleBossHit = (damage: number) => {
    const boss = bossRef.current;
    const player = playerRef.current;
    if (bossApproachingRef.current) return; // 登場中は無敵

    boss.hp -= damage;
    player.score += 10; // 当てると微増
    setUiBossHp(Math.max(0, boss.hp));

    // ボスの火花エフェクト
    if (Math.random() < 0.25) {
      sparksRef.current.push({
        x: boss.x + (Math.random() - 0.5) * boss.radius,
        y: boss.y + (Math.random() - 0.4) * boss.radius,
        length: 4 + Math.random() * 8,
        angle: Math.PI * 1.5 + (Math.random() - 0.5), // 上方向に散る
        color: '#febb07',
        alpha: 1.0,
        decay: 0.05,
      });
    }

    // フェーズ切り替え
    const currentPhase = boss.phase;
    let nextPhase = currentPhase;

    if (currentPhase === 1 && boss.hp <= boss.phaseMaxHp[1]) {
      nextPhase = 2;
    } else if (currentPhase === 2 && boss.hp <= boss.phaseMaxHp[2]) {
      nextPhase = 3;
    } else if (currentPhase === 3 && boss.hp <= 0) {
      // 鬼を撃破！クリア
      saveHighScore();
      SoundManager.stopBGM();
      SoundManager.playPhaseClear();
      onGameEnd('CLEAR', player.score + player.hp * 10000 + player.bombs * 5000); // 残HPとボムはボーナスポイント
      return;
    }

    if (nextPhase !== currentPhase) {
      boss.phase = nextPhase;
      setUiBossPhase(nextPhase);
      SoundManager.playPhaseClear();
      bulletsRef.current = []; // 弾幕クリア
      
      // フェーズ切替フラッシュ演出
      createPhaseTransitionEffect(boss.x, boss.y);
    }
  };

  // フェーズ切替時のボス爆発演出
  const createPhaseTransitionEffect = (bx: number, by: number) => {
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      particlesRef.current.push({
        x: bx,
        y: by,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + Math.random() * 6,
        color: 'hsla(' + (Math.random() * 40 + 20) + ', 100%, 50%, 0.9)', // 赤・オレンジ
        alpha: 1.0,
        decay: 0.02,
        maxLife: 50,
        life: 50,
      });
    }
  };

  // ハイスコア保存
  const saveHighScore = () => {
    const player = playerRef.current;
    if (player.score > player.highScore) {
      localStorage.setItem('oni_bullet_highscore', player.score.toString());
      player.highScore = player.score;
      setUiHighScore(player.score);
    }
  };

  // -----------------------------------------------------------------
  // 弾幕パターン定義
  // -----------------------------------------------------------------
  const fireBossBullets = () => {
    const boss = bossRef.current;
    const player = playerRef.current;
    const config = DIFFICULTY_CONFIG[difficulty];
    
    boss.actionTimer++;
    const timer = boss.actionTimer;
    const slowFactor = config.bulletFrequencyMultiplier;
    const speedFactor = config.bulletSpeedMultiplier;

    // HP減少による焦り（攻撃頻度が最大1.5倍に、弾速が1.2倍まで上がる）
    const phaseHpCurrent = getPhaseHpCurrent(boss);
    const phaseHpMax = getPhaseHpMax(boss);
    const hpRatio = phaseHpCurrent / phaseHpMax;
    boss.angerFactor = 1.0 + (1.0 - hpRatio) * 0.25;

    // --- PHASE 1: 鬼火の渦 & 螺旋弾幕 ---
    if (boss.phase === 1) {
      // 1. 常時、緩やかな渦巻き弾
      const baseFreq = Math.floor(14 * slowFactor);
      if (timer % Math.max(8, Math.floor(baseFreq / boss.angerFactor)) === 0) {
        SoundManager.playEnemyShoot(false);
        const streams = difficulty === 'LUNATIC' ? 10 : difficulty === 'HARD' ? 4 : 3;
        const angleOffset = (timer * 0.04) % (Math.PI * 2);

        for (let s = 0; s < streams; s++) {
          const angle = angleOffset + (s * (Math.PI * 2) / streams);
          bulletsRef.current.push({
            id: Math.random().toString(),
            x: boss.x,
            y: boss.y + 15,
            vx: Math.cos(angle) * 2.5 * speedFactor,
            vy: Math.sin(angle) * 2.5 * speedFactor,
            radius: 8.5, // 5 -> 8.5 (視認性向上のため大幅にサイズアップ)
            color: '#f43f5e', // 明るいピンクローズ
            type: 'NORMAL',
            damage: 1,
          });
        }
      }

      // 2. 鬼火（低速の追従青弾火。少し蛇行する）
      const onibiFreq = Math.floor(180 * slowFactor);
      if (timer % onibiFreq === 0) {
        SoundManager.playEnemyShoot(true);
        // プレイヤーの方へ
        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const angle = Math.atan2(dy, dx);
        
        // 鬼殺しでは4発を極めて狭い隙間で発射
        const spreadAngles = difficulty === 'LUNATIC' ? [-0.09, -0.03, 0.03, 0.09] : [-0.15, 0.15];
        spreadAngles.forEach(offsetAngle => {
          bulletsRef.current.push({
            id: Math.random().toString(),
            x: boss.x + Math.sin(offsetAngle) * 30,
            y: boss.y + 20,
            vx: Math.cos(angle + offsetAngle) * 1.5 * speedFactor,
            vy: Math.sin(angle + offsetAngle) * 1.5 * speedFactor,
            radius: 17, // 12 -> 17 (でかい鬼火)
            color: '#06b6d4', // シアン (怪しい呪いの青火)
            type: 'ONIBI',
            damage: 1,
            pulse: 0,
            angle: angle + offsetAngle,
            speed: 1.5 * speedFactor
          });
        });
      }
    }

    // --- PHASE 2: 雷鳴の叫び & 高速雷撃雷雨 ---
    else if (boss.phase === 2) {
      // 1. 天から雷雨 (雷の火花がランダムに下に向かって降る)
      // 警告サインが出たあとにストレートに落ちる「稲妻弾」
      const lightningFreq = Math.floor(25 * slowFactor);
      if (timer % Math.max(8, Math.floor(lightningFreq / boss.angerFactor)) === 0) {
        const lx = Math.random() * (WIDTH - 40) + 20;
        // 落ちる雷弾
        bulletsRef.current.push({
          id: Math.random().toString(),
          x: lx,
          y: 0,
          vx: (Math.random() - 0.5) * 0.5, // ほぼ直下に落ちる
          vy: (3.0 + Math.random() * 2.5) * speedFactor,
          radius: 7, // 4 -> 7 (雷弾の存在感をアップ)
          color: '#eab308', // 黄色（稲妻）
          type: 'LIGHTNING',
          damage: 1,
        });

        // 落ち口にスパークエフェクトを追加
        createLightningSpark(lx, 5);
      }

      // 2. 鬼の雷鼓ショット：3way, 5way の自機狙い高速クナイ弾
      const aimFreq = Math.floor(100 * slowFactor);
      if (timer % Math.max(45, Math.floor(aimFreq / boss.angerFactor)) === 0) {
        SoundManager.playEnemyShoot(true);
        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const baseAngle = Math.atan2(dy, dx);

        // 難易度によってWay数が変わる
        const count = difficulty === 'LUNATIC' ? 13 : (difficulty === 'EASY' ? 3 : (difficulty === 'NORMAL' ? 5 : 7));
        const spread = difficulty === 'LUNATIC' ? 0.06 : 0.12; // 弾同士の間隔（ラジアン）（鬼殺しでは極端に狭める）

        for (let i = 0; i < count; i++) {
          const angle = baseAngle + (i - (count - 1) / 2) * spread;
          bulletsRef.current.push({
            id: Math.random().toString(),
            x: boss.x,
            y: boss.y + 10,
            vx: Math.cos(angle) * 4.2 * speedFactor,
            vy: Math.sin(angle) * 4.2 * speedFactor,
            radius: 8.5, // 5 -> 8.5 (自機狙いクナイ弾の視界強度アップ)
            color: '#f97316', // オレンジ
            type: 'AIM',
            damage: 1,
          });
        }
      }
    }

    // --- PHASE 3: 最終奥義「百鬼夜行・怨嗟の嵐」 ---
    else if (boss.phase === 3) {
      // 1. 全方位に交差する「和傘の花」弾幕 (全方位サークル)
      // 時間差で回転方向を逆にする
      const waveFreq = Math.floor(45 * slowFactor);
      if (timer % Math.max(25, Math.floor(waveFreq / boss.angerFactor)) === 0) {
        SoundManager.playEnemyShoot(false);
        const count = difficulty === 'LUNATIC' ? 64 : (difficulty === 'EASY' ? 16 : (difficulty === 'NORMAL' ? 24 : (difficulty === 'HARD' ? 32 : 44)));
        // 時計回りと反時計回りが交互になる
        const direction = Math.floor(timer / waveFreq) % 2 === 0 ? 1 : -1;
        const spinSpeed = (timer * 0.05 * direction);

        for (let i = 0; i < count; i++) {
          const angle = spinSpeed + (i * Math.PI * 2 / count);
          bulletsRef.current.push({
            id: Math.random().toString(),
            x: boss.x,
            y: boss.y,
            vx: Math.cos(angle) * 2.2 * speedFactor,
            vy: Math.sin(angle) * 2.2 * speedFactor,
            radius: 9, // 5.5 -> 9 (渦を美しく見えやすく)
            color: direction > 0 ? '#a855f7' : '#ec4899', // 紫とピンクの交差
            type: 'CURVED',
            damage: 1,
            rotationSpeed: 0.005 * direction, // わずかにカーブする
            angle: angle,
            speed: 2.2 * speedFactor
          });
        }
      }

      // 2. 巨大鬼怨念弾 (超危険)
      // プレイヤーを強力に追いかけていき、5秒後に破裂、またはプレイヤー近くで破裂、
      // 破裂時に16方向のレーザー風弾を四方に放つ。
      const finalDemonFreq = Math.floor(300 * slowFactor);
      if (timer % finalDemonFreq === 0) {
        SoundManager.playEnemyShoot(true);
        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const angle = Math.atan2(dy, dx);

        bulletsRef.current.push({
          id: Math.random().toString(),
          x: boss.x,
          y: boss.y,
          vx: Math.cos(angle) * 1.2 * speedFactor,
          vy: Math.sin(angle) * 1.2 * speedFactor,
          radius: 26, // 18 -> 26 (超巨大化させてボス奥義の威厳を表現)
          color: '#3b82f6', // 紺碧
          type: 'SPIKE', // 特殊。破裂処理は updateLoop 内で
          damage: 1,
          angle: angle,
          speed: 1.2 * speedFactor,
          homingTimer: 180, // 3秒間自機を追いかける
        });
      }
    }
  };

  // 雷のスパークアニメーション生成
  const createLightningSpark = (x: number, y: number) => {
    for (let i = 0; i < 5; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        radius: 1.5 + Math.random() * 2,
        color: '#fef08a', // うすい黄
        alpha: 1.0,
        decay: 0.05,
        maxLife: 15,
        life: 15,
      });
    }
  };

  // -----------------------------------------------------------------
  // ゲーム初期化・ループ管理
  // -----------------------------------------------------------------
  // 1. 初期化を一度だけ確実に行う
  useEffect(() => {
    if (gameState === 'PLAYING') {
      initGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, difficulty]);

  // 2. 一時停止でのBGM Off/Onを制御
  useEffect(() => {
    if (gameState === 'PLAYING') {
      if (isPaused) {
        SoundManager.stopBGM();
      } else {
        SoundManager.startBGM();
      }
    }
  }, [isPaused, gameState]);

  // 3. ゲームループ（進行&描画のみ。一時停止でinitGameが走ってリセットされないようにする）
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    let rId: number;

    const gameLoop = () => {
      if (!isPaused) {
        updateGameState();
      }
      
      renderGame();
      
      rId = requestAnimationFrame(gameLoop);
    };

    rId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(rId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, isPaused]);

  // 各フェーズの現在HP/最大HPを算出（UIゲージ分割用）
  const getPhaseHpCurrent = (boss: Boss) => {
    const p = boss.phase;
    const threshVal = boss.phaseMaxHp[p]; // この量まで減ると、このフェーズが終わる
    const prevThreshVal = p === 1 ? boss.maxHp : boss.phaseMaxHp[p - 1];
    
    // このフェーズにおける現在HP
    return Math.max(0, boss.hp - threshVal);
  };

  const getPhaseHpMax = (boss: Boss) => {
    const p = boss.phase;
    if (p === 1) return boss.maxHp - boss.phaseMaxHp[1];
    if (p === 2) return boss.phaseMaxHp[1] - boss.phaseMaxHp[2];
    return boss.phaseMaxHp[2];
  };

  // -----------------------------------------------------------------
  // ゲームロジックアップデート
  // -----------------------------------------------------------------
  const updateGameState = () => {
    const player = playerRef.current;
    const boss = bossRef.current;
    animFrameRef.current++;

    // 1. ボス（鬼）の立ち振る舞い (登場演出 ＆ 自律浮遊)
    if (bossApproachingRef.current) {
      const dy = boss.targetY - boss.y;
      if (Math.abs(dy) > 1.0) {
        boss.y += dy * 0.03; // 最初ゆっくり上から登場
      } else {
        boss.y = boss.targetY;
        setBossApproaching(false);
      }
    } else {
      // 普段は左右にふわふわ滑らかに浮遊移動
      let moveSpeed = 0.015;
      let ampX = 125;
      let ampY = 15;

      if (difficulty === 'EASY') {
        moveSpeed = 0.005;
        ampX = 65;
        ampY = 6;
      } else if (difficulty === 'NORMAL') {
        moveSpeed = 0.008;
        ampX = 90;
        ampY = 10;
      } else if (difficulty === 'HARD') {
        moveSpeed = 0.012;
        ampX = 115;
        ampY = 13;
      } else if (difficulty === 'LUNATIC') {
        moveSpeed = 0.015;
        ampX = 160;
        ampY = 0;
      }

      boss.moveTimer += moveSpeed;
      // 不規則な左右の動きを合成（全難易度共通、急発進・急停止を伴う）
      const irregularX = Math.sin(boss.moveTimer * 1.8) * 0.5 + Math.cos(boss.moveTimer * 4.2) * 0.35 + Math.sin(boss.moveTimer * 0.7) * 0.15;
      
      if (difficulty === 'LUNATIC') {
        // 鬼殺しでは左右移動に限定（上下yは固定）
        boss.x = WIDTH / 2 + irregularX * ampX;
        boss.y = boss.targetY;
      } else {
        // 通常・他の難易度でも不規則な左右移動＋上下の不規則な微細浮遊
        const irregularY = Math.cos(boss.moveTimer * 2.2) * 0.6 + Math.sin(boss.moveTimer * 1.1) * 0.4;
        boss.x = WIDTH / 2 + irregularX * ampX;
        boss.y = boss.targetY + irregularY * ampY;
      }

      // 弾幕照射
      fireBossBullets();
    }

    // 2. プレイヤー（棒人間）の移動
    const keys = keysRef.current;
    let dx = 0;
    let dy = 0;

    if (keys.w || keys.ArrowUp) dy -= 1;
    if (keys.s || keys.ArrowDown) dy += 1;
    if (keys.a || keys.ArrowLeft) dx -= 1;
    if (keys.d || keys.ArrowRight) dx += 1;

    // 低速移動（Shift）かどうかでの速度
    const currentSpeed = keys.Shift ? player.slowSpeed : player.speed;

    // 斜め移動時の正規化
    if (dx !== 0 && dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      dx /= length;
      dy /= length;
    }

    player.x += dx * currentSpeed;
    player.y += dy * currentSpeed;

    // 画面外はみ出し防止
    player.x = Math.max(player.radius, Math.min(WIDTH - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(HEIGHT - player.radius, player.y));

    // 3. プレイヤーの自動ショット (Zキー押し、またはプレイ中はつねに発射でも弾幕ライクで楽しい)
    // 弾幕ゲームを快適にするため、プレイ中は常に自動射撃し、Zキーでも追加＆ショット速度Upにする。
    // 「Zキー押下 または 常時オートショット」仕様
    if (player.shootCooldown > 0) {
      player.shootCooldown--;
    }

    const isZPressed = keys.z;
    const isCtrlPressed = false; // Zキー or 常時自動攻撃
    const shootInterval = isZPressed ? 5 : 8; // Zキーで高速連射

    if (player.shootCooldown <= 0 && !bossApproachingRef.current) {
      SoundManager.playShoot();
      player.shootCooldown = shootInterval;
      
      // 正面、並びに2way/3way に広がっていく
      if (keys.Shift) {
        // 低速移動時は正面に弾を集約（ボスの弱点に集中ヒット）
        playerBulletsRef.current.push({
          id: Math.random().toString(),
          x: player.x - 4,
          y: player.y - 10,
          vx: 0,
          vy: -11,
          radius: 3.2,
          damage: 8, // 12 -> 8 に優しく調整
        });
        playerBulletsRef.current.push({
          id: Math.random().toString(),
          x: player.x + 4,
          y: player.y - 10,
          vx: 0,
          vy: -11,
          radius: 3.2,
          damage: 8, // 12 -> 8 に優しく調整
        });
      } else {
        // 通常移動時は少し広範囲攻撃
        playerBulletsRef.current.push({
          id: Math.random().toString(),
          x: player.x,
          y: player.y - 10,
          vx: 0,
          vy: -10,
          radius: 3.5,
          damage: 10, // 15 -> 10 に優しく調整
        });
        playerBulletsRef.current.push({
          id: Math.random().toString(),
          x: player.x - 8,
          y: player.y - 5,
          vx: -1.2,
          vy: -9.5,
          radius: 3,
          damage: 6, // 10 -> 6 に優しく調整
        });
        playerBulletsRef.current.push({
          id: Math.random().toString(),
          x: player.x + 8,
          y: player.y - 5,
          vx: 1.2,
          vy: -9.5,
          radius: 3,
          damage: 6, // 10 -> 6 に優しく調整
        });
      }
    }

    // 無敵タイマー減衰
    if (player.invincibleTimer > 0) {
      player.invincibleTimer--;
    }

    // 4. プレイヤー弾（自機ショット）の更新
    playerBulletsRef.current = playerBulletsRef.current.filter(pb => {
      pb.x += pb.vx;
      pb.y += pb.vy;

      // 画面上部アウト
      if (pb.y < -10) return false;

      // ボスとの当たり判定
      if (!bossApproachingRef.current) {
        const dx = pb.x - boss.x;
        const dy = pb.y - boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // 当たり判定 (ボスのおおよそのサイズ)
        if (dist < boss.radius) {
          handleBossHit(pb.damage);
          // 当たったら消滅
          return false;
        }
      }
      return true;
    });

    // 5. 敵弾（鬼の弾幕）の更新 ＆ プレイヤーへの衝突判定
    const nextBullets: Bullet[] = [];
    bulletsRef.current.forEach(b => {
      // 誘導弾や特殊弾の挙動計算
      if (b.type === 'ONIBI') {
        // 少し揺らめきながら前進
        b.angle = b.angle! + Math.sin(animFrameRef.current * 0.15) * 0.03;
        b.vx = Math.cos(b.angle) * b.speed!;
        b.vy = Math.sin(b.angle) * b.speed!;
        // 脈動
        b.pulse = (b.pulse || 0) + 0.1;
        b.radius = 12 + Math.sin(b.pulse) * 3;
      } else if (b.type === 'CURVED') {
        // 軌道を少しずつ回転させる(カーブ弾)
        b.angle = b.angle! + b.rotationSpeed!;
        b.vx = Math.cos(b.angle) * b.speed!;
        b.vy = Math.sin(b.angle) * b.speed!;
      } else if (b.type === 'SPIKE') {
        // 巨大な鬼火（誘導弾、一定時間後に分裂）
        if (b.homingTimer! > 0) {
          b.homingTimer!--;
          // 自機をゆっくりロックオン
          const dx = player.x - b.x;
          const dy = player.y - b.y;
          const targetAngle = Math.atan2(dy, dx);
          
          // 旋回性能
          let angleDiff = targetAngle - b.angle!;
          // 角度範囲正規化
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          
          b.angle = b.angle! + angleDiff * 0.025; // じわじわ曲がる
          b.vx = Math.cos(b.angle) * b.speed!;
          b.vy = Math.sin(b.angle) * b.speed!;
        }

        // 破裂カウントダウン
        if (b.homingTimer === 0) {
          // 分裂！ (16方向への小弾拡散)
          SoundManager.playEnemyShoot(false);
          const splitCount = difficulty === 'LUNATIC' ? 20 : (difficulty === 'HARD' ? 16 : 12);
          for (let i = 0; i < splitCount; i++) {
            const angle = (i * Math.PI * 2) / splitCount;
            const splitSpeed = 2.4 * DIFFICULTY_CONFIG[difficulty].bulletSpeedMultiplier;
            nextBullets.push({
              id: Math.random().toString(),
              x: b.x,
              y: b.y,
              vx: Math.cos(angle) * splitSpeed,
              vy: Math.sin(angle) * splitSpeed,
              radius: 8, // 4.5 -> 8 (分裂弾を視覚的に捉えやすくサイズアップ)
              color: '#38bdf8', // 鮮やかな青空色
              type: 'NORMAL',
              damage: 1,
            });
          }
          // 特大弾は消滅
          createBulletDisappearParticles(b.x, b.y, '#3b82f6');
          return; // 分裂したため、この巨大弾自体は追加しない
        }
      }

      // 位置を進行方向に進める
      b.x += b.vx;
      b.y += b.vy;

      // 画面判定（端から25px外に出たら消す。ただし登場時に少しズレるため余裕を持たせる）
      const outOfBounds = b.x < -30 || b.x > WIDTH + 30 || b.y < -30 || b.y > HEIGHT + 30;
      if (outOfBounds) return; // 消滅

      // ボム稼働中の当たり判定除去（ボム領域内にいる敵弾は自動で消えていく）
      if (bombActive) {
        const dx = b.x - player.x;
        const dy = b.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bombRadiusRef.current + 10) {
          createBulletDisappearParticles(b.x, b.y, b.color);
          player.score += 20; // 消滅得点
          return; // 追加しない
        }
      }

      // プレイヤー（棒人間）への被弾判定
      // 弾幕がクッキリ大きくなった分、ギリギリを滑らかにかわせるよう、
      // 弾丸の「見た目の大きさ（b.radius）」の 65% を当たり判定の実半径として計算する（弾幕STGの伝統仕様！）
      const dx = b.x - player.x;
      const dy = b.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const gameplayBulletRadius = b.radius * 0.65;

      if (dist < (gameplayBulletRadius + player.hitRadius)) {
        handlePlayerHit(b.damage);
        // 通常弾は当たると消える。巨大弾やレーザーは消えないか、貫通するなどの設定
        if (b.type !== 'SPIKE') {
          createBulletDisappearParticles(b.x, b.y, b.color);
          return; // 当たったのでこの弾は消す
        }
      }

      nextBullets.push(b);
    });
    bulletsRef.current = nextBullets;

    // 6. ボムの波紋拡張
    if (bombActive) {
      bombRadiusRef.current += 7.0; // 急速に波紋を拡げる
      if (bombRadiusRef.current > HEIGHT) {
        setBombActive(false); // 画面幅を覆いつくしたらボム終了
      }
    }

    // 7. パーティクル（破片エフェクト）の更新
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      p.alpha = Math.max(0, p.life / p.maxLife);
      return p.life > 0;
    });

    // 8. 雷閃・火花エフェクト（sparks）の更新
    sparksRef.current = sparksRef.current.filter(s => {
      s.alpha -= s.decay;
      // 位置を少し風情に流す
      s.x += Math.cos(s.angle) * 1.5;
      s.y += Math.sin(s.angle) * 1.5;
      return s.alpha > 0;
    });

    // 1フレームごとにUIスコアを滑らかに更新するため、数フレーム毎にReact Stateに伝える
    if (animFrameRef.current % 4 === 0) {
      setUiScore(player.score);
      onScoreUpdate(player.score);
    }
  };

  // -----------------------------------------------------------------
  // レンダリング（Canvasへの描画）
  // -----------------------------------------------------------------
  const renderGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const player = playerRef.current;
    const boss = bossRef.current;

    // --- 背景描画 (怪しげな和風・ダークのグラデーション) ---
    // 横縞や妖しいダークスレート
    ctx.fillStyle = '#0f172a'; // 深い藍色の夜空
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 奥ゆかしい背景模様 (お札のグリッド、またはぼやけた光)
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < WIDTH; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < HEIGHT; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }

    // --- 鬼の攻撃エフェクト：雷雲 / 妖気のモヤ (ボス周辺の描画) ---
    if (!bossApproachingRef.current) {
      // 鬼の後ろに流れる妖艶な赤/青 of 円形グラデーション（邪悪なオーラ）
      ctx.save();
      const auraRad = boss.radius * (boss.phase === 3 ? 3.0 : 2.2);
      const gradient = ctx.createRadialGradient(
        boss.x, boss.y, boss.radius * 0.4,
        boss.x, boss.y, auraRad
      );
      if (boss.phase === 1) {
        gradient.addColorStop(0, 'rgba(6, 182, 212, 0.4)'); // 青シアン
        gradient.addColorStop(1, 'rgba(6, 182, 212, 0)');
      } else if (boss.phase === 2) {
        gradient.addColorStop(0, 'rgba(234, 179, 8, 0.35)'); // 黄雷
        gradient.addColorStop(1, 'rgba(234, 179, 8, 0)');
      } else {
        gradient.addColorStop(0, 'rgba(168, 85, 247, 0.45)'); // 紫最終フェーズ
        gradient.addColorStop(1, 'rgba(168, 85, 247, 0)');
      }
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, auraRad, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // --- ボス（鬼）の描画 ---
    ctx.save();
    // 浮遊感を出すため、ボスの中心位置から描画
    const bBounce = Math.sin(animFrameRef.current * 0.08) * 3;
    const bx = boss.x;
    const by = boss.y + bBounce;

    // A. 鬼の手 (ボスの左右を浮遊する邪悪な幽霊の手。フェーズ3のみ出現等だと豪華)
    const handOffsetTime = animFrameRef.current * 0.05;
    const handLeftX = bx - 75 + Math.sin(handOffsetTime) * 4;
    const handLeftY = by + 15 + Math.cos(handOffsetTime * 0.8) * 8;
    const handRightX = bx + 75 - Math.sin(handOffsetTime) * 4;
    const handRightY = by + 15 + Math.cos(handOffsetTime * 0.8) * 8;

    // 鬼の腕・爪の描画
    const drawDemonHand = (hx: number, hy: number, isRight: boolean) => {
      ctx.save();
      ctx.shadowColor = isRight ? '#f43f5e' : '#3b82f6';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#b91c1c'; // 深紅
      ctx.beginPath();
      ctx.arc(hx, hy, 12, 0, Math.PI * 2); // 手のひら
      ctx.fill();

      // 3本の鋭い爪
      ctx.fillStyle = '#f8fafc'; // 白い爪
      for (let i = 0; i < 3; i++) {
        const fingerAngle = (isRight ? Math.PI : 0) + Math.PI / 2 + (i - 1) * 0.4;
        ctx.beginPath();
        ctx.moveTo(hx + Math.cos(fingerAngle) * 8, hy + Math.sin(fingerAngle) * 8);
        ctx.lineTo(hx + Math.cos(fingerAngle) * 18, hy + Math.sin(fingerAngle) * 18);
        ctx.lineTo(hx + Math.cos(fingerAngle + 0.25) * 6, hy + Math.sin(fingerAngle + 0.25) * 6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };

    if (boss.phase >= 2 && !bossApproachingRef.current) {
      drawDemonHand(handLeftX, handLeftY, false);
      drawDemonHand(handRightX, handRightY, true);
    }

    // B. 鬼の顔（お面・ドット絵ライク）
    // 呼吸アニメーションとして、幅と高さを少し脈動させる
    const pulseW = 1 + Math.sin(animFrameRef.current * 0.08) * 0.03;
    const pulseH = 1 - Math.sin(animFrameRef.current * 0.08) * 0.03;
    const bRadX = boss.radius * pulseW;
    const bRadY = boss.radius * pulseH;

    // 怒り度が増すと顔が真っ赤にチェンジ
    let faceColor = '#ef4444'; // 明るい赤
    if (boss.phase === 2) faceColor = '#dc2626'; // 少し濃い赤
    if (boss.phase === 3) faceColor = '#991b1b'; // 怨気のこもった濃い深紅

    ctx.fillStyle = faceColor;
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 3;

    // 輪郭 (丸っこいが顎が少し尖った迫力ある鬼お面形状)
    ctx.beginPath();
    ctx.arc(bx, by, bRadX, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 鬼のツノ (額から2本)
    // ツノ1（左）
    ctx.fillStyle = '#fef08a'; // 黄色のツノ
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - bRadX * 0.5, by - bRadY * 0.7);
    ctx.quadraticCurveTo(bx - bRadX * 0.8, by - bRadY * 1.5, bx - bRadX * 0.4, by - bRadY * 1.6);
    ctx.quadraticCurveTo(bx - bRadX * 0.2, by - bRadY * 1.1, bx - bRadX * 0.1, by - bRadY * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ツノ2（右）
    ctx.beginPath();
    ctx.moveTo(bx + bRadX * 0.5, by - bRadY * 0.7);
    ctx.quadraticCurveTo(bx + bRadX * 0.8, by - bRadY * 1.5, bx + bRadX * 0.4, by - bRadY * 1.6);
    ctx.quadraticCurveTo(bx + bRadX * 0.2, by - bRadY * 1.1, bx + bRadX * 0.1, by - bRadY * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 額のトラ柄模様 (鬼おなじみの黒いライン)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(bx - 10, by - bRadY * 0.5);
    ctx.lineTo(bx - 3, by - bRadY * 0.35);
    ctx.lineTo(bx - 12, by - bRadY * 0.3);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(bx + 10, by - bRadY * 0.5);
    ctx.lineTo(bx + 3, by - bRadY * 0.35);
    ctx.lineTo(bx + 12, by - bRadY * 0.3);
    ctx.closePath();
    ctx.fill();

    // ギラギラした眼 (黄色の眼に、赤の瞳。怒っているように吊り上がっている)
    const eyeY = by - bRadY * 0.15;
    const eyeSpread = bRadX * 0.35;

    // 左眼
    ctx.fillStyle = '#fef08a'; // 白目は黄色
    ctx.beginPath();
    ctx.moveTo(bx - eyeSpread - 15, eyeY - 8);
    ctx.quadraticCurveTo(bx - eyeSpread, eyeY - 12, bx - eyeSpread + 15, eyeY);
    ctx.quadraticCurveTo(bx - eyeSpread, eyeY + 6, bx - eyeSpread - 15, eyeY - 8);
    ctx.closePath();
    ctx.fill();
    // 瞳
    ctx.fillStyle = '#ef4444'; // 赤い瞳
    ctx.beginPath();
    ctx.arc(bx - eyeSpread + 2, eyeY - 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // 右眼
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.moveTo(bx + eyeSpread + 15, eyeY - 8);
    ctx.quadraticCurveTo(bx + eyeSpread, eyeY - 12, bx + eyeSpread - 15, eyeY);
    ctx.quadraticCurveTo(bx + eyeSpread, eyeY + 6, bx + eyeSpread + 15, eyeY - 8);
    ctx.closePath();
    ctx.fill();
    // 瞳
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(bx + eyeSpread - 2, eyeY - 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // への字太い眉毛
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    // 左
    ctx.beginPath();
    ctx.moveTo(bx - eyeSpread - 15, eyeY - 14);
    ctx.lineTo(bx - eyeSpread + 12, eyeY - 10);
    ctx.stroke();
    // 右
    ctx.beginPath();
    ctx.moveTo(bx + eyeSpread + 15, eyeY - 14);
    ctx.lineTo(bx + eyeSpread - 12, eyeY - 10);
    ctx.stroke();

    // 巨大な口 ＆ 牙
    const mouthY = by + bRadY * 0.32;
    ctx.fillStyle = '#450a0a'; // 暗い赤の口
    ctx.beginPath();
    ctx.arc(bx, mouthY, bRadX * 0.45, 0, Math.PI, false); // 半円
    ctx.closePath();
    ctx.fill();

    // 白い牙
    ctx.fillStyle = '#f8fafc';
    // 上の牙2本
    ctx.beginPath();
    ctx.moveTo(bx - bRadX * 0.2, mouthY);
    ctx.lineTo(bx - bRadX * 0.15, mouthY + 12);
    ctx.lineTo(bx - bRadX * 0.1, mouthY);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(bx + bRadX * 0.1, mouthY);
    ctx.lineTo(bx + bRadX * 0.15, mouthY + 12);
    ctx.lineTo(bx + bRadX * 0.2, mouthY);
    ctx.closePath();
    ctx.fill();

    // 下の牙（飛び出す2本。しゃくれ風で迫力がある）
    ctx.beginPath();
    ctx.moveTo(bx - bRadX * 0.3, mouthY + 18);
    ctx.lineTo(bx - bRadX * 0.25, mouthY + 4);
    ctx.lineTo(bx - bRadX * 0.2, mouthY + 18);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(bx + bRadX * 0.2, mouthY + 18);
    ctx.lineTo(bx + bRadX * 0.25, mouthY + 4);
    ctx.lineTo(bx + bRadX * 0.3, mouthY + 18);
    ctx.closePath();
    ctx.fill();

    // C. 鬼怒りエフェクト（ぷんぷんマークを頭の横に浮かべる）
    if (boss.phase >= 2) {
      const angerTime = animFrameRef.current * 0.08;
      const angerX = bx + bRadX * 0.7 + Math.sin(angerTime) * 3;
      const angerY = by - bRadY * 0.7 + Math.cos(angerTime) * 3;

      ctx.strokeStyle = '#f87171'; // 赤ピンクの怒りマーク
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      // 怒りの十字架マーク (湾曲した4本のライン)
      ctx.arc(angerX, angerY, 10, -Math.PI / 4, Math.PI / 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(angerX + 4, angerY + 4, 10, Math.PI * 0.75, Math.PI * 1.25);
      ctx.stroke();
    }

    ctx.restore();

    // --- プレイヤー（棒人間）の描画 ---
    // 無敵中は一定フレーム数ごとに表示・非表示を繰り返して点滅
    const isVisible = player.invincibleTimer === 0 || (Math.floor(animFrameRef.current / 4) % 2 === 0);
    
    if (isVisible) {
      ctx.save();
      const px = player.x;
      const py = player.y;

      // 被弾の直後は棒人間を赤く光らせる
      const nowMs = Date.now();
      const timeSinceHit = nowMs - player.lastHitTime;
      const isHealing = timeSinceHit < 300; // 被弾後0.3秒間は赤発光
      
      ctx.strokeStyle = isHealing ? '#ef4444' : '#ffffff'; // 白い棒人間
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 棒人間のポーズ（走るアニメーションの計算）
      // 動いているかどうか
      const keys = keysRef.current;
      const isMoving = keys.w || keys.a || keys.s || keys.d || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight;
      
      const walkCycle = isMoving ? Math.sin(animFrameRef.current * 0.25) : 0;
      const runCycle = isMoving ? Math.cos(animFrameRef.current * 0.25) : 0;

      // 1. 胴体（背筋）
      const headRadius = 7.5;
      const neckY = py - 8;
      const hipY = py + 8;
      
      ctx.beginPath();
      ctx.moveTo(px, neckY);
      ctx.lineTo(px, hipY); // 縦の胴体
      ctx.stroke();

      // 2. 頭（丸で描画）
      ctx.fillStyle = isHealing ? '#ef4444' : '#0f172a'; // 頭の塗りつぶし
      ctx.beginPath();
      ctx.arc(px, neckY - headRadius, headRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 表情（ダメージ中は「＞＜」の表情、普段はシンプルなドットの眼など）
      if (isHealing) {
        // 「＞＜」の目
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        // 左
        ctx.beginPath();
        ctx.moveTo(px - 4, neckY - headRadius - 2);
        ctx.lineTo(px - 2, neckY - headRadius);
        ctx.lineTo(px - 4, neckY - headRadius + 2);
        ctx.stroke();
        // 右
        ctx.beginPath();
        ctx.moveTo(px + 4, neckY - headRadius - 2);
        ctx.lineTo(px + 2, neckY - headRadius);
        ctx.lineTo(px + 4, neckY - headRadius + 2);
        ctx.stroke();
      } else {
        // 集中しているドット眼
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px - 2, neckY - headRadius - 1, 1.2, 0, Math.PI * 2);
        ctx.arc(px + 2, neckY - headRadius - 1, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. 手（両腕）
      // 移動中は走るように前後に振り、そうでない時はニュートラルに構える
      let leftHandX, leftHandY, rightHandX, rightHandY;

      if (keys.Shift) {
        // 低速移動（精神統一）時は胸の前で合掌、もしくはバリアを張り巡らせる魔法ポーズ
        leftHandX = px - 8;
        leftHandY = py - 3;
        rightHandX = px + 8;
        rightHandY = py - 3;
      } else {
        leftHandX = px - 11 * runCycle - (isMoving ? 3 : 6);
        leftHandY = py + 3 * walkCycle;
        rightHandX = px + 11 * runCycle + (isMoving ? 3 : 6);
        rightHandY = py - 3 * walkCycle;
      }

      // 左腕
      ctx.beginPath();
      ctx.moveTo(px, neckY + 2);
      ctx.lineTo(leftHandX, leftHandY);
      ctx.stroke();
      // 右腕
      ctx.beginPath();
      ctx.moveTo(px, neckY + 2);
      ctx.lineTo(rightHandX, rightHandY);
      ctx.stroke();

      // 4. 足（両脚）
      // 左脚
      const leftFootX = px - 8 * walkCycle - (isMoving ? 4 : 5);
      const leftFootY = hipY + 12 - Math.max(0, 4 * runCycle);
      ctx.beginPath();
      ctx.moveTo(px, hipY);
      ctx.lineTo(px - (isMoving ? 2 : 3), hipY + 4); // 膝
      ctx.lineTo(leftFootX, leftFootY);
      ctx.stroke();

      // 右脚
      const rightFootX = px + 8 * walkCycle + (isMoving ? 4 : 5);
      const rightFootY = hipY + 12 - Math.max(0, -4 * runCycle);
      ctx.beginPath();
      ctx.moveTo(px, hipY);
      ctx.lineTo(px + (isMoving ? 2 : 3), hipY + 4); // 膝
      ctx.lineTo(rightFootX, rightFootY);
      ctx.stroke();

      // B. 低速移動（Shiftキー）時の「当たり判定可視化」 ＆ 魔法陣オーラ
      if (keys.Shift) {
        ctx.restore();
        ctx.save();
        
        // 当たり判定を示す魔法陣のオーラ (回転する歯車または桜の花びら風サークル)
        const rotation = animFrameRef.current * 0.04;
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(px, py, 21, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
        ctx.beginPath();
        ctx.arc(px, py, 14, rotation, rotation + Math.PI * 2);
        ctx.stroke();

        // 核心の「喰らい判定(赤い極小の点)」
        // 弾幕シューティングで一番大事な当たり判定の赤い丸
        ctx.shadowColor = '#ff2a2a';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#ff2222';
        ctx.beginPath();
        ctx.arc(px, py, player.hitRadius, 0, Math.PI * 2);
        ctx.fill();

        // 内側を白でさらに光らせる
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, player.hitRadius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // --- 自機ショット（プレイヤーの弾丸）の描画 ---
    ctx.save();
    playerBulletsRef.current.forEach(pb => {
      // 弾幕ゲームライクな、上に向かって伸びるレーザーがかった縦に長い弾丸
      const grad = ctx.createLinearGradient(pb.x, pb.y - pb.radius, pb.x, pb.y + pb.radius * 3);
      grad.addColorStop(0, '#ffffff'); // 先頭は眩しい白眼
      grad.addColorStop(0.3, '#38bdf8'); // 中間シアン
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)'); // 後尾はフェード

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(pb.x, pb.y, pb.radius, pb.radius * 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // --- 敵弾（鬼の弾幕）の描画 ---
    ctx.save();
    bulletsRef.current.forEach(b => {
      ctx.beginPath();
      
      // ※弾数が非常に多い場合の描画パフォーマンス低下（スローモーション化）を防ぐため、
      // 負荷の大きい shadowBlur / shadowColor はオフにしています。
      // 代わりに、白のコアと周辺色による二重・三重の輪郭描画で十分な発光感を実現しています。
      
      if (b.type === 'ONIBI') {
        const rad = b.radius;
        // 1. 強力な黒い縁取り（ゴシック＆ダークな視認性の極み）
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(b.x, b.y, rad + 1.2, 0, Math.PI * 2);
        ctx.stroke();

        // 2. 青い鬼火
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, rad, 0, Math.PI * 2);
        ctx.fill();

        // 3. 鬼火の内側コア(より白に近いシアンの眩しい色)
        ctx.fillStyle = '#e2f8ff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, rad * 0.55, 0, Math.PI * 2);
        ctx.fill();

        // 4. 後ろにたなびく、おまけ火の玉のしっぽ
        for (let i = 1; i <= 3; i++) {
          const tailX = b.x - Math.cos(b.angle!) * i * 11 + Math.sin(animFrameRef.current * 0.25 + i) * 3;
          const tailY = b.y - Math.sin(b.angle!) * i * 11 + Math.cos(animFrameRef.current * 0.25 + i) * 3;
          const tailRad = rad * (0.9 - i * 0.2);
          if (tailRad > 1) {
            ctx.strokeStyle = 'rgba(0, 0, 0, ' + (0.6 - i * 0.15) + ')';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(tailX, tailY, tailRad + 0.5, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = 'rgba(6, 182, 212, ' + (0.65 - i * 0.15) + ')';
            ctx.beginPath();
            ctx.arc(tailX, tailY, tailRad, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (b.type === 'LIGHTNING') {
        const rad = b.radius;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, rad + 1.2, rad * 2.8 + 1.2, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, rad, rad * 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, rad * 0.5, rad * 1.8, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.type === 'SPIKE') {
        const rad = b.radius;
        const points = 10;
        const speedOffset = animFrameRef.current * 0.04;
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
          const angle = (i * Math.PI) / points + speedOffset;
          const r = (i % 2 === 0) ? rad + 1.5 : rad * 0.6 + 1.0;
          const currX = b.x + Math.cos(angle) * r;
          const currY = b.y + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(currX, currY);
          else ctx.lineTo(currX, currY);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = b.color;
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
          const angle = (i * Math.PI) / points + speedOffset;
          const r = (i % 2 === 0) ? rad : rad * 0.6;
          const currX = b.x + Math.cos(angle) * r;
          const currY = b.y + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(currX, currY);
          else ctx.lineTo(currX, currY);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, rad * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const rad = b.radius;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, rad + 1.2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, rad, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(b.x - rad * 0.15, b.y - rad * 0.15, rad * 0.48, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();

    // --- ボム（ボム発動中）のエフェクト描画 ---
    if (bombActive) {
      ctx.save();
      const radius = bombRadiusRef.current;
      
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.7)';
      ctx.lineWidth = 15;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(player.x, player.y, radius * 0.85, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 16px font-sans';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textCount = 8;
      for (let i = 0; i < textCount; i++) {
        const angle = (i * Math.PI * 2 / textCount) + animFrameRef.current * 0.02;
        const tx = player.x + Math.cos(angle) * (radius - 12);
        const ty = player.y + Math.sin(angle) * (radius - 12);
        ctx.fillText("退", tx, ty);
      }
      ctx.restore();
    }

    // --- 各種エフェクト（パーティクル、被弾火花）の描画 ---
    ctx.save();
    particlesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    sparksRef.current.forEach(s => {
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = s.alpha;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      const ex = s.x - Math.cos(s.angle) * s.length;
      const ey = s.y - Math.sin(s.angle) * s.length;
      ctx.lineTo(ex, ey);
      ctx.stroke();
    });
    ctx.restore();

    // --- 警告エリア表示 ---
    if (bossApproachingRef.current) {
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, ' + (Math.sin(animFrameRef.current * 0.15) * 0.15 + 0.15) + ')';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 32px font-sans';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👿 鬼 急 接近 👿', WIDTH / 2, HEIGHT / 2 - 40);
      
      ctx.font = 'bold 14px font-mono';
      ctx.fillStyle = '#ef4444';
      ctx.fillText('BEWARE OF THE DEMONIC BARRAGE', WIDTH / 2, HEIGHT / 2 + 10);
      ctx.restore();
    }
  };
  const phaseHpBarWidth = bossRef.current.hp > 0 
    ? (getPhaseHpCurrent(bossRef.current) / getPhaseHpMax(bossRef.current)) * 100 
    : 0;

  return (
    <div 
      id="game-container" 
      ref={containerRef} 
      className="relative flex flex-col lg:flex-row items-center lg:items-start lg:justify-center select-none bg-slate-950 p-3 md:p-5 rounded-2xl border border-slate-850/70 shadow-2xl max-w-full gap-5 backdrop-blur-md"
    >
      
      {/* プレイ領域 (左パネル、モバイル・縦) */}
      <div className="flex flex-col items-center w-full max-w-[600px] shrink-0">
        
        {/* 画面最上部：ボス(鬼級) HPゲージ ＆ フェーズマーカー */}
        <div id="boss-hud" className="w-full mb-2 px-1">
          <div className="flex justify-between items-end mb-1">
            <span className="text-rose-500 font-sans font-bold text-xs tracking-widest flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 bg-rose-600 rounded-full animate-ping"></span>
              👿 BOSS: 鬼 ({uiBossPhase === 3 ? '百鬼夜行' : uiBossPhase === 2 ? '怒髪天雷' : '通常形態'})
            </span>
            <div className="flex gap-1 text-[10px] font-mono text-slate-400">
              <span className={uiBossPhase >= 1 ? "text-rose-500 font-bold" : ""}>I</span>
              <span>•</span>
              <span className={uiBossPhase >= 2 ? "text-rose-500 font-bold" : ""}>II</span>
              <span>•</span>
              <span className={uiBossPhase >= 3 ? "text-rose-500 font-bold" : ""}>III (極)</span>
            </div>
          </div>
          
          {/* HPバー外枠 */}
          <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 flex">
            {uiBossHp > 0 ? (
              <div 
                style={{ width: `${phaseHpBarWidth}%` }}
                className={`h-full transition-all duration-75 ${
                  uiBossPhase === 3 ? 'bg-gradient-to-r from-purple-600 to-pink-500' : 
                  uiBossPhase === 2 ? 'bg-gradient-to-r from-amber-500 to-rose-500 animate-pulse' : 
                  'bg-gradient-to-r from-rose-500 to-orange-400'
                }`}
              />
            ) : (
              <div className="w-0 h-full" />
            )}
          </div>
        </div>

        {/* ゲームメイン描画キャンバス */}
        <div className="relative w-full shadow-inner border border-slate-800 rounded-lg overflow-hidden bg-slate-900 leading-none">
          <canvas 
            id="main-canvas"
            ref={canvasRef} 
            width={WIDTH} 
            height={HEIGHT}
            tabIndex={0}
            className="block w-full h-auto cursor-none outline-none focus:ring-1 focus:ring-teal-500/30 rounded touch-none"
            onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={(e) => {
              if (e.touches.length > 0) {
                handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length > 0) {
                handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchEnd={handleDragEnd}
            style={{ aspectRatio: `${WIDTH}/${HEIGHT}`, width: '100%', height: 'auto' }}
          />

          {/* 画面内：一時停止(Pause)モーダル */}
          {isPaused && (
            <div id="pause-modal" className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 z-10">
              <h2 className="text-3xl font-sans text-teal-400 font-bold tracking-widest mb-2">PAUSE</h2>
              <p className="text-slate-400 font-sans text-xs mb-6 leading-relaxed">ゲームは一時停止されています</p>
              <button 
                id="btn-resume"
                onClick={() => setIsPaused(false)}
                className="px-6 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-slate-950 font-sans font-semibold rounded-lg shadow-lg active:scale-95 transition cursor-pointer text-xs"
              >
                ゲームを再開 (Pキー)
              </button>
              <button 
                id="btn-back-to-title"
                onClick={onBackToTitle}
                className="mt-4 text-[11px] text-slate-500 hover:text-slate-350 transition duration-155 underline decoration-dotted underline-offset-4"
              >
                タイトルへ戻る
              </button>
            </div>
          )}
        </div>

        {/* 下部コントローラーHUD（モバイル表示専用、LG幅以上ではサイド筐体があるので隠す） */}
        <div id="player-hud" className="w-full mt-2 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex flex-wrap gap-4 items-center justify-between shadow-md lg:hidden">
          
          {/* スコア */}
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-slate-400 tracking-wider">SCORE</span>
            <span className="text-base font-mono font-bold text-teal-400 tabular-nums">
              {uiScore.toLocaleString()}
            </span>
          </div>

          {/* 命 */}
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-slate-400 tracking-wider mb-0.5">LIVES</span>
            <div className="flex gap-1 items-center min-h-[22px]">
              {Array.from({ length: uiMaxHp }).map((_, i) => (
                <span 
                  key={i} 
                  className={`text-base transition-transform duration-300 ${
                    i < uiHp 
                      ? 'text-rose-500 animate-pulse scale-100' 
                      : 'text-slate-800 scale-90 opacity-20 grayscale'
                  }`}
                >
                  🚶
                </span>
              ))}
            </div>
          </div>

          {/* ボム (御札) */}
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-slate-400 tracking-wider mb-0.5">BOMB</span>
            <div className="flex gap-1 items-center min-h-[22px]">
              {Array.from({ length: 3 }).map((_, i) => (
                <button
                  key={i}
                  disabled={i >= uiBombs}
                  onClick={triggerBomb}
                  className={`text-[10px] px-1.5 py-0.5 rounded border leading-tight transition font-sans ${
                    i < uiBombs 
                      ? 'bg-purple-950/60 text-purple-300 border-purple-700/80 hover:bg-purple-900 active:scale-90 cursor-pointer' 
                      : 'bg-slate-950 text-slate-800 border-slate-900 cursor-not-allowed'
                  }`}
                >
                  ☯️ {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* モバイル支援ボタン */}
          <div className="flex items-center gap-1.5">
            <button 
              onClick={toggleMobileSlowMode}
              className={`px-2.5 py-1.5 border rounded text-[10px] font-sans font-bold transition ${
                mobileSlowMode 
                  ? 'bg-sky-950 text-sky-400 border-sky-600 animate-pulse' 
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'
              }`}
            >
              🎯 精密 [{mobileSlowMode ? '極小' : '通常'}]
            </button>
            <button 
              onClick={triggerBomb}
              className="px-2.5 py-1.5 bg-gradient-to-r from-purple-800 to-indigo-800 border border-purple-600 rounded text-[10px] text-purple-100 font-sans active:bg-purple-750 font-bold"
            >
              ボム!
            </button>
          </div>
        </div>
      </div>

      {/* 右側：PC・タブレット向けの 16:9 サイド情報バー (東方Project風筐体デザイン) */}
      <div className="hidden lg:flex flex-col w-[300px] bg-slate-900 border border-slate-800/80 rounded-2xl p-5 self-stretch justify-between shadow-2xl relative overflow-hidden">
        
        {/* 背景和風うっすら意匠 */}
        <div className="absolute -right-6 -bottom-6 opacity-5 pointer-events-none text-red-500 font-black text-9xl select-none">
          👹
        </div>

        <div>
          <div className="border-b border-slate-800 pb-3 mb-4">
            <div className="text-[10px] text-rose-500 font-mono font-bold tracking-widest uppercase">System Barrage Console</div>
            <div className="text-base font-sans font-black text-slate-100">鬼神大合戦 演出盤</div>
          </div>

          {/* スコア・難易度スタック */}
          <div className="space-y-3.5 mb-5">
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/60 shadow-inner">
              <div className="text-[10px] font-mono text-slate-500 tracking-wider">HIGH SCORE</div>
              <div className="text-sm font-mono font-bold text-amber-500">
                {uiHighScore.toLocaleString()} <span className="text-[10px] text-slate-600">pts</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-2 tracking-wider">CURRENT SCORE</div>
              <div className="text-xl font-mono font-bold text-teal-400 tabular-nums leading-none">
                {uiScore.toLocaleString()}
              </div>
            </div>

            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/60">
              <div className="text-[10px] font-mono text-slate-500 mb-0.5">DIFFICULTY LEVEL</div>
              <div className="text-[11px] font-sans font-black text-slate-200 uppercase tracking-widest">
                {difficulty === 'EASY' && '🌱 EASY (安全修練)'}
                {difficulty === 'NORMAL' && '⚔️ NORMAL (本気修行)'}
                {difficulty === 'HARD' && '🔥 HARD (羅刹乱舞)'}
                {difficulty === 'LUNATIC' && '😈 鬼殺し (極限地獄)'}
              </div>
            </div>
          </div>

          {/* 残HP・ボム・精密の縦形式リスト */}
          <div className="space-y-4 mb-5">
            <div>
              <div className="text-[11px] font-sans font-bold text-slate-400 mb-1.5 flex justify-between">
                <span>🚶 棒人間の命 (残機)</span>
                <span className="font-mono text-rose-400 font-bold">{uiHp} / {uiMaxHp}</span>
              </div>
              <div className="flex gap-2 p-2 bg-slate-950/60 border border-slate-800/60 rounded-xl justify-center">
                {Array.from({ length: uiMaxHp }).map((_, i) => (
                  <span 
                    key={i} 
                    className={`text-xl transition-all duration-300 ${
                      i < uiHp 
                        ? 'text-rose-500 animate-pulse scale-100 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]' 
                        : 'text-slate-800 scale-90 opacity-20'
                    }`}
                  >
                    🚶
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-sans font-bold text-slate-400 mb-1.5 flex justify-between">
                <span>☯️ 秘奥義・退魔札 (BOMB)</span>
                <span className="font-mono text-purple-400 font-bold">{uiBombs} / 3</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <button
                    key={i}
                    disabled={i >= uiBombs}
                    onClick={triggerBomb}
                    className={`text-xs py-1.5 rounded-lg border flex flex-col items-center justify-center transition font-sans ${
                      i < uiBombs 
                        ? 'bg-purple-950/40 text-purple-200 border-purple-800 hover:bg-purple-800/70 cursor-pointer active:scale-95' 
                        : 'bg-slate-950 text-slate-800 border-slate-900 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-sm">☯️</span>
                    <span className="text-[9px] mt-0.5">御札 {i + 1}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* 精密操作トグル (PCでのマウスクリック等でも有効) */}
            <div>
              <div className="text-[11px] font-sans font-bold text-slate-400 mb-1.5">
                🎯 スピード制御
              </div>
              <button 
                onClick={toggleMobileSlowMode}
                className={`w-full py-2 rounded-lg border text-xs font-sans font-bold transition flex items-center justify-center gap-1.5 ${
                  mobileSlowMode 
                    ? 'bg-sky-950/60 text-sky-300 border-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.15)]' 
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'
                }`}
              >
                <span>🎯 {mobileSlowMode ? '低速バリア展開中' : '常時高速移動'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* タッチ＆キーボード操作ヒント */}
        <div className="bg-slate-950/90 border border-slate-850/60 p-3 rounded-xl">
          <div className="text-[10px] text-teal-400 font-bold font-sans tracking-wide mb-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-ping"></span>
            感度抜群！スライド移動対応
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed mb-2">
            画面内の Canvas をどこでも<strong>ドラッグ／スワイプ</strong>することで、自機を極めて滑らかにスライド移動できるようになりました！指やマウスで快適に避けることができます。
          </p>
          <div className="border-t border-slate-800 pt-2 text-[9px] font-mono text-slate-500 leading-tight">
            <div>[WASD / 矢印] キーボード移動</div>
            <div>[Shift] 低速精密、[Z] 高速連射</div>
            <div>[X] または [Space] ボム発動</div>
          </div>
        </div>
        
      </div>

    </div>
  );
};
