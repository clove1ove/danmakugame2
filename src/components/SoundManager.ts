// Web Audio API を使用したレトロゲーム風のシンセ効果音および簡易BGMシステム

class SoundManagerClass {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  private bgmInterval: number | null = null;
  private bgmBeat: number = 0;
  private bgmPlaying: boolean = false;

  constructor() {
    // ユーザーアクションをトリガーにするため、最初のプレイや画面クリック時に初期化します
  }

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  public resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 短いショット音 (ピピッ、ピピッ)
  public playShoot() {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // 敵の弾丸発射音 (コト、コト、ポポポ)
  public playEnemyShoot(isBig: boolean = false) {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const startFreq = isBig ? 180 : 450;
    const endFreq = isBig ? 80 : 250;
    const duration = isBig ? 0.15 : 0.06;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

    gain.gain.setValueAtTime(isBig ? 0.05 : 0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  // 被弾時のダメージ音 (ドカッ)
  public playHit() {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(180, now);
    osc1.frequency.linearRampToValueAtTime(30, now + 0.18);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(90, now);
    osc2.frequency.linearRampToValueAtTime(20, now + 0.22);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.22);
    osc2.start(now);
    osc2.stop(now + 0.23);
  }

  // ボム発動音 (ピュイーーーーン ッドカーーーン)
  public playBomb() {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // 弾むような上昇音
    const oscRise = this.ctx.createOscillator();
    const gainRise = this.ctx.createGain();
    oscRise.type = 'sine';
    oscRise.frequency.setValueAtTime(100, now);
    oscRise.frequency.exponentialRampToValueAtTime(1500, now + 0.3);
    gainRise.gain.setValueAtTime(0.12, now);
    gainRise.gain.linearRampToValueAtTime(0.01, now + 0.3);
    oscRise.connect(gainRise);
    gainRise.connect(this.ctx.destination);
    oscRise.start(now);
    oscRise.stop(now + 0.3);

    // 爆発音
    const oscExplode = this.ctx.createOscillator();
    const gainExplode = this.ctx.createGain();
    oscExplode.type = 'sawtooth';
    oscExplode.frequency.setValueAtTime(120, now + 0.25);
    oscExplode.frequency.exponentialRampToValueAtTime(20, now + 0.95);
    
    gainExplode.gain.setValueAtTime(0.0, now + 0.25);
    gainExplode.gain.setValueAtTime(0.25, now + 0.3);
    gainExplode.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

    // バンドパス/ローパス的な役割を周波数変化でエミュレート
    oscExplode.connect(gainExplode);
    gainExplode.connect(this.ctx.destination);
    
    oscExplode.start(now + 0.25);
    oscExplode.stop(now + 0.95);
  }

  // 敵フェーズ撃破音 (ファンファーレ)
  public playPhaseClear() {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C, E, G, C, E, G, C(hi)
    
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      
      gain.gain.setValueAtTime(0.05, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.22);
    });
  }

  // 警告アラーム (ボス出現、ピピピピ)
  public playWarning() {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const dur = 0.5;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(440, now + 0.12);
    osc.frequency.setValueAtTime(880, now + 0.24);
    osc.frequency.setValueAtTime(440, now + 0.36);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0.08, now + dur - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + dur);
  }

  // ゲームオーバー時の悲しい音楽 (ド・シ・ラ・ソ)
  public playGameOver() {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [392.00, 349.23, 311.13, 246.94]; // G4, F4, Eb4, B3 (悲しげ)
    
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.25);
      
      gain.gain.setValueAtTime(0.08, now + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.25 + 0.35);
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + i * 0.25);
      osc.stop(now + i * 0.25 + 0.38);
    });
  }

  // 和風（太鼓と怪しい調べ）を奏でる超簡易ループBGM
  public startBGM() {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;
    if (this.bgmPlaying) return;

    this.bgmPlaying = true;
    this.bgmBeat = 0;

    // 和風スケール (ヨナ抜き/都節などの雰囲気: A, Bb, D, E, F)
    // 周波数: A2(110), Bb2(116), D3(146), E3(164), F3(174), A3(220), Bb3(233), D4(293), E4(329), F4(349)
    const melodyScale = [220, 233, 293, 329, 349, 440, 466, 587, 659, 698];
    // シンプルな怪奇風シーケンス
    const melodyPattern = [
      0, -1, 2, 3, 4, 3, 2, -1,
      1, -1, 3, 4, 5, 4, 3, -1,
      0, 2, 4, 7, 6, 4, 2, 1,
      3, 3, 2, 2, 1, 1, 0, -1
    ];

    const beatIntervalMs = 150; // テンポ速め、スリリングに

    this.bgmInterval = window.setInterval(() => {
      if (!this.enabled || !this.ctx) return;
      
      const now = this.ctx.currentTime;
      const step = this.bgmBeat % 32;

      // 1. 和太鼓を模した重低音 (拍子に合わせて鳴る。1, 5, 9, 13, 17, 21, 25, 29)
      if (step % 4 === 0) {
        const oscDrum = this.ctx.createOscillator();
        const gainDrum = this.ctx.createGain();
        oscDrum.type = 'sine';
        
        // 拍子の変わり目で音程を変えてメリハリをつける (ドン、コン)
        const drumFreq = (step % 8 === 0) ? 65 : 50; 
        
        oscDrum.frequency.setValueAtTime(drumFreq, now);
        oscDrum.frequency.exponentialRampToValueAtTime(10, now + 0.25);
        
        gainDrum.gain.setValueAtTime(0.18, now);
        gainDrum.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        
        oscDrum.connect(gainDrum);
        gainDrum.connect(this.ctx.destination);
        oscDrum.start(now);
        oscDrum.stop(now + 0.25);
      }

      // 2. 鬼灯（和風ロックリフ風）のお化けシンセメロディー
      const noteIdx = melodyPattern[step];
      if (noteIdx !== -1) {
        const freq = melodyScale[noteIdx];
        const oscMel = this.ctx.createOscillator();
        const gainMel = this.ctx.createGain();
        
        // 鬼々しい鋸歯状波 (怪しいピッチポルタメントを少し加える)
        oscMel.type = 'sawtooth';
        oscMel.frequency.setValueAtTime(freq, now);
        // 少し怪しげにビブラート/ピッチ低下
        oscMel.frequency.linearRampToValueAtTime(freq * 0.98, now + 0.12);
        
        gainMel.gain.setValueAtTime(0.015, now); // メロディは控えめに
        gainMel.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        
        oscMel.connect(gainMel);
        gainMel.connect(this.ctx.destination);
        oscMel.start(now);
        oscMel.stop(now + 0.14);
      }

      // 3. ドコドコ裏拍（ベース）
      if (step % 2 === 1 && Math.random() < 0.6) {
        const oscBase = this.ctx.createOscillator();
        const gainBase = this.ctx.createGain();
        oscBase.type = 'triangle';
        oscBase.frequency.setValueAtTime(110, now); // A2固定
        gainBase.gain.setValueAtTime(0.03, now);
        gainBase.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        oscBase.connect(gainBase);
        gainBase.connect(this.ctx.destination);
        oscBase.start(now);
        oscBase.stop(now + 0.1);
      }

      this.bgmBeat++;
    }, beatIntervalMs);
  }

  public stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    this.bgmPlaying = false;
  }
}

export const SoundManager = new SoundManagerClass();
