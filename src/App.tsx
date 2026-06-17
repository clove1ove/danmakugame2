import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameState, Difficulty } from './types';
import { GameCanvas } from './components/GameCanvas';
import { SoundManager } from './components/SoundManager';
import { Volume2, VolumeX, Shield, Award, HelpCircle, Flame, Info, Check, RotateCcw } from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE');
  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // 今回のスコア、ハイスコア
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    return parseInt(localStorage.getItem('oni_bullet_highscore') || '0', 10);
  });

  // 音響設定の反映
  useEffect(() => {
    SoundManager.enabled = soundEnabled;
    if (!soundEnabled) {
      SoundManager.stopBGM();
    }
  }, [soundEnabled]);

  // ゲームクリア・オーバー時の処理
  const handleGameEnd = (status: 'CLEAR' | 'GAMEOVER', finalScore: number) => {
    setScore(finalScore);
    
    // ハイスコア更新チェック
    const lsHighScore = parseInt(localStorage.getItem('oni_bullet_highscore') || '0', 10);
    if (finalScore > lsHighScore) {
      localStorage.setItem('oni_bullet_highscore', finalScore.toString());
      setHighScore(finalScore);
    } else {
      setHighScore(lsHighScore);
    }

    setGameState(status === 'CLEAR' ? 'CLEAR' : 'GAMEOVER');
  };

  // スコアの更新
  const handleScoreUpdate = (currentScore: number) => {
    setScore(currentScore);
  };

  const handleStartGame = () => {
    // ユーザーインタラクションを契機にAudioをレジューム
    SoundManager.resume();
    setGameState('PLAYING');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-start items-center p-4 md:p-8 selection:bg-rose-500 selection:text-white overflow-x-hidden">
      
      {/* ヘッダーセクション（和風スレート調、すっきりクリーン） */}
      <header className="w-full max-w-4xl flex justify-between items-center mb-6 md:mb-10 px-4">
        <div className="flex items-center gap-2">
          <Flame className="w-6 h-6 text-rose-500 animate-pulse" />
          <span className="font-sans font-bold text-lg tracking-wider text-slate-100 border-l border-slate-800 pl-3">
            疾風怒濤 弾幕戦 (Stickman VS Oni)
          </span>
        </div>

        {/* サウンド有効化トグル */}
        <button
          id="btn-sound-toggle"
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition cursor-pointer ${
            soundEnabled 
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/80 hover:bg-emerald-900/60' 
              : 'bg-slate-900 text-slate-500 border-slate-800/80 hover:bg-slate-800'
          }`}
          title={soundEnabled ? "音声を消音" : "音声を出力"}
        >
          {soundEnabled ? (
            <>
              <Volume2 className="w-3.5 h-3.5" />
              <span>SOUND ON</span>
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5" />
              <span>SOUND OFF</span>
            </>
          )}
        </button>
      </header>

      {/* ゲームメインエリア */}
      <main className="w-full max-w-5xl flex flex-col lg:flex-row gap-6 items-center lg:items-stretch lg:justify-center px-2">
        
        {/* レンダリング状態の分岐 */}
        <AnimatePresence mode="wait">
          
          {/* ===============================================================
              TITLE SCREEN (タイトル画面)
              =============================================================== */}
          {gameState === 'TITLE' && (
            <motion.div
              key="title"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col text-center justify-between"
            >
              <div>
                {/* 鬼の意匠のタイトルグラフィック */}
                <div className="mb-6 relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-600 via-orange-500 to-amber-500 rounded-lg blur-xl opacity-30 animate-pulse"></div>
                  <div className="relative bg-slate-950/90 rounded-xl px-4 py-8 border border-slate-800">
                    <h1 className="text-4xl md:text-5xl font-sans font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-orange-400 to-amber-300 drop-shadow-lg leading-none">
                      棒人間 vs 鬼
                    </h1>
                    <div className="mt-2 text-xs font-mono tracking-widest text-slate-400">
                      SHIPPUDOTO DEMON BARRAGE
                    </div>
                  </div>
                </div>

                <p className="text-sm font-sans text-slate-300 leading-relaxed mb-8 px-4">
                  太鼓を打ち鳴らし容赦なく弾を放つ「鬼」の猛襲。<br />
                  素早い「棒人間」を操り、和風の超極限弾幕を避け切れ！
                </p>

                {/* 難易度ピッカー */}
                <div id="difficulty-picker" className="mb-8 text-left bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3 text-xs font-mono font-semibold text-slate-400">
                    <Shield className="w-3.5 h-3.5 text-orange-400" />
                    <span>難易度選択</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['EASY', 'NORMAL', 'HARD', 'LUNATIC'] as Difficulty[]).map((diff) => (
                      <button
                        key={diff}
                        id={`diff-${diff}`}
                        onClick={() => setDifficulty(diff)}
                        className={`py-2 px-3 rounded-lg border text-left text-xs font-sans font-bold tracking-wider transition relative overflow-hidden cursor-pointer ${
                          difficulty === diff
                            ? diff === 'EASY' ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/20' :
                              diff === 'NORMAL' ? 'bg-sky-950/50 border-sky-500 text-sky-300 shadow-md shadow-sky-950/20' :
                              diff === 'HARD' ? 'bg-orange-950/50 border-orange-500 text-orange-300 shadow-md shadow-orange-950/20' :
                              'bg-rose-950/50 border-rose-500 text-rose-300 shadow-md shadow-rose-950/20'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>
                            {diff === 'EASY' && '🌱 EASY'}
                            {diff === 'NORMAL' && '⚔️ NORMAL'}
                            {diff === 'HARD' && '🔥 HARD'}
                            {diff === 'LUNATIC' && '👿 鬼殺し'}
                          </span>
                          {difficulty === diff && (
                            <Check className="w-3.5 h-3.5 animate-bounce" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* アクションボタン */}
              <div className="flex flex-col gap-3">
                <button
                  id="btn-start"
                  onClick={handleStartGame}
                  className="w-full py-4 bg-gradient-to-r from-rose-600 via-orange-500 to-amber-500 hover:from-rose-700 hover:to-amber-600 text-slate-950 font-sans font-black tracking-widest text-base rounded-xl cursor-pointer shadow-lg active:scale-98 transition transform duration-150"
                >
                  いざ、尋常に勝負！ (START)
                </button>
                
                <button
                  id="btn-howtoplay"
                  onClick={() => setGameState('HOW_TO_PLAY')}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-755 border border-slate-700 text-xs font-sans tracking-wide text-slate-300 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-teal-400" />
                  <span>遊び方説明 (CONTROL RULES)</span>
                </button>
              </div>

              {/* 過去ハイスコア */}
              <div className="mt-8 border-t border-slate-800 pt-3 flex justify-between items-center text-xs font-mono text-slate-500">
                <span className="flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  MY HAIL SCORE:
                </span>
                <span className="font-bold text-slate-300 tracking-wider">
                  {highScore.toLocaleString()} pts
                </span>
              </div>
            </motion.div>
          )}

          {/* ===============================================================
              HOW TO PLAY (遊び方)
              =============================================================== */}
          {gameState === 'HOW_TO_PLAY' && (
            <motion.div
              key="howtoplay"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-2xl"
            >
              <h2 className="text-xl font-sans font-bold text-center border-b border-slate-800 pb-3 mb-6 flex items-center justify-center gap-2">
                <Info className="w-5 h-5 text-teal-400" />
                <span>鬼退治・指南書 (HOW TO PLAY)</span>
              </h2>

              <div className="space-y-4 text-xs font-sans leading-relaxed text-slate-300 mb-8">
                
                {/* 1. 移動 */}
                <div className="flex gap-3 bg-slate-950 border border-slate-800/80 p-3 rounded-xl">
                  <div className="flex flex-col items-center justify-center bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 font-mono text-center font-bold text-slate-300 max-h-[50px] min-w-[70px]">
                    <div>▲ / ▼</div>
                    <div>◀ / ▶</div>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-100 mb-1">棒人間の移動 (動き回る)</h4>
                    <p className="text-[11px] text-slate-400">
                      方向キー、または「W, A, S, D」キーで、棒人間を自由縦横無尽に操作します。敵の弾を避けましょう。
                    </p>
                  </div>
                </div>

                {/* 2. 低速、当たり判定 */}
                <div className="flex gap-3 bg-slate-950 border border-slate-800/80 p-3 rounded-xl">
                  <div className="flex items-center justify-center bg-sky-950/40 border border-sky-800 text-sky-300 font-mono font-bold text-xs px-3 py-2 rounded-lg max-h-[50px] min-w-[70px]">
                    SHIFT
                  </div>
                  <div>
                    <h4 className="font-bold text-sky-300 mb-1">低速集中バリア (極小判定の視覚化)</h4>
                    <p className="text-[11px] text-slate-400">
                      Shiftキーを押している間、移動がゆっくりになり、棒人間の中央に<strong className="text-rose-400 font-bold">「赤い極小の点」</strong>が表示されます。これが当たり判定です！
                      この点が敵の弾丸に当たらなければ、体の一部が弾に掠っても絶対にダメージを受けません。また、攻撃ショットが正面に集中的に収束します。
                    </p>
                  </div>
                </div>

                {/* 3. ショット */}
                <div className="flex gap-3 bg-slate-950 border border-slate-800/80 p-3 rounded-xl">
                  <div className="flex items-center justify-center bg-emerald-950/40 border border-emerald-800 text-emerald-300 font-mono font-bold text-xs px-3 py-2 rounded-lg max-h-[50px] min-w-[70px]">
                    Z キー
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-300 mb-1">退魔ショット & 自動攻撃</h4>
                    <p className="text-[11px] text-slate-400">
                      プレイ中は自動で弾（ショット）を発射してくれます。さらに「Zキー」を長押しすると、移動方向への追加弾と、より高速で強力な連射を行い、鬼の体力を一気に削ることができます。
                    </p>
                  </div>
                </div>

                {/* 4. ボム */}
                <div className="flex gap-3 bg-slate-950 border border-slate-800/80 p-3 rounded-xl">
                  <div className="flex items-center justify-center bg-purple-950/40 border border-purple-800 text-purple-300 font-mono font-bold text-xs px-3 py-2 rounded-lg max-h-[50px] min-w-[70px]">
                    X / Space
                  </div>
                  <div>
                    <h4 className="font-bold text-purple-300 mb-1">退魔滅却の札 (ボム)</h4>
                    <p className="text-[11px] text-slate-400">
                      「X」キーまたは「スペース」キー、もしくは画面下部の「札」ボタンをタップすると、溜まっていたすべての敵弾を吹き飛ばし、一時的無敵時間を得られます（おばけ波紋）。使用回数は有限ですので緊急時に活用してください。
                    </p>
                  </div>
                </div>

              </div>

              <button
                id="btn-back-to-title"
                onClick={() => setGameState('TITLE')}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 font-sans font-bold text-xs rounded-xl tracking-wider cursor-pointer border border-slate-700 transition"
              >
                了解した (お品書きへ戻る)
              </button>
            </motion.div>
          )}

          {/* ===============================================================
              PLAYING (ゲーム本編)
              =============================================================== */}
          {gameState === 'PLAYING' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex justify-center w-full"
            >
              <GameCanvas
                difficulty={difficulty}
                gameState={gameState}
                onGameEnd={handleGameEnd}
                onScoreUpdate={handleScoreUpdate}
                soundEnabled={soundEnabled}
                onBackToTitle={() => setGameState('TITLE')}
              />
            </motion.div>
          )}

          {/* ===============================================================
              GAMEOVER SCREEN (ゲームオーバー画面)
              =============================================================== */}
          {gameState === 'GAMEOVER' && (
            <motion.div
              key="gameover"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 border-t-4 border-t-rose-600 rounded-2xl p-6 md:p-8 shadow-2xl text-center"
            >
              <span className="inline-block px-4 py-1.5 bg-rose-950/40 border border-rose-800 text-rose-400 font-bold tracking-widest text-[11px] rounded-full mb-3 uppercase font-mono animate-bounce">
                Oni Slaughtered You
              </span>
              <h2 className="text-3xl md:text-4xl font-sans font-black text-rose-500 tracking-wider mb-6">
                満身創痍 (GAME OVER)
              </h2>

              <p className="text-sm text-slate-400 mb-8 max-w-xs mx-auto">
                鬼のすさまじい怨恨による弾幕に飲まれました。<br />
                だが、棒人間の修行はまだ終わらない！
              </p>

              {/* スコア・結果カード */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-left border-r border-slate-800 pr-2">
                    <div className="text-[10px] font-mono text-slate-500">FINAL SCORE</div>
                    <div className="text-2xl font-mono font-bold text-rose-400 leading-tight">
                      {score.toLocaleString()} <span className="text-xs text-slate-500">pts</span>
                    </div>
                  </div>
                  <div className="text-left pl-2">
                    <div className="text-[10px] font-mono text-slate-500">PLAYED DIFFICULTY</div>
                    <div className="text-sm font-sans font-extrabold text-slate-200 mt-1 uppercase">
                      {difficulty === 'EASY' && '🌱 EASY'}
                      {difficulty === 'NORMAL' && '⚔️ NORMAL'}
                      {difficulty === 'HARD' && '🔥 HARD'}
                      {difficulty === 'LUNATIC' && '👿 鬼殺し'}
                    </div>
                  </div>
                </div>
              </div>

              {/* ボタン */}
              <div className="flex flex-col gap-3">
                <button
                  id="btn-retry"
                  onClick={handleStartGame}
                  className="w-full py-4 bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-700 hover:to-orange-600 text-slate-950 font-sans font-black tracking-widest rounded-xl shadow-lg cursor-pointer transform hover:scale-[1.01] active:scale-98 transition duration-150 flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>もう一度挑む (RETRY)</span>
                </button>
                <button
                  id="btn-title"
                  onClick={() => setGameState('TITLE')}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-750 text-xs font-sans font-bold text-slate-300 rounded-xl cursor-pointer transition"
                >
                  降参してお品書きへ戻る (TITLE)
                </button>
              </div>
            </motion.div>
          )}

          {/* ===============================================================
              CLEAR SCREEN (ゲームクリア画面)
              =============================================================== */}
          {gameState === 'CLEAR' && (
            <motion.div
              key="clear"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 border-t-4 border-t-amber-500 rounded-2xl p-6 md:p-8 shadow-2xl text-center"
            >
              <div className="inline-block px-4 py-1.5 bg-amber-950/40 border border-amber-800 text-amber-400 font-bold tracking-widest text-[11px] rounded-full mb-3 uppercase font-mono animate-pulse">
                Oni Purged Successfully
              </div>
              <h2 className="text-3xl md:text-4xl font-sans font-black text-amber-400 tracking-wider mb-6">
                鬼退治、見事成就！
              </h2>

              <p className="text-sm text-slate-400 mb-8 max-w-xs mx-auto">
                鬼の放つすべての邪気と弾幕を打ち祓いました！<br />
                あっぱれ、最強の棒人間の誕生です。
              </p>

              {/* スコア・結果カード */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-left border-r border-slate-800 pr-2">
                    <div className="text-[10px] font-mono text-slate-500">TOTAL SCORE</div>
                    <div className="text-2xl font-mono font-bold text-amber-400 leading-tight">
                      {score.toLocaleString()} <span className="text-xs text-slate-500">pts</span>
                    </div>
                  </div>
                  <div className="text-left pl-2">
                    <div className="text-[10px] font-mono text-slate-500">CLEARED DIFFICULTY</div>
                    <div className="text-sm font-sans font-extrabold text-slate-200 mt-1 uppercase">
                      {difficulty === 'EASY' && '🌱 EASY'}
                      {difficulty === 'NORMAL' && '⚔️ NORMAL'}
                      {difficulty === 'HARD' && '🔥 HARD'}
                      {difficulty === 'LUNATIC' && '👿 鬼殺し'}
                    </div>
                  </div>
                </div>
              </div>

              {/* ボタン */}
              <div className="flex flex-col gap-3">
                <button
                  id="btn-retry"
                  onClick={handleStartGame}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-slate-950 font-sans font-black tracking-widest rounded-xl shadow-lg cursor-pointer transform hover:scale-[1.01] active:scale-98 transition duration-150 flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>さらに修行に挑む (RETRY)</span>
                </button>
                <button
                  id="btn-title"
                  onClick={() => setGameState('TITLE')}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-750 text-xs font-sans font-bold text-slate-300 rounded-xl cursor-pointer transition"
                >
                  お祝いにお品書きへ戻る (TITLE)
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

      </main>

      {/* フッター */}
      <footer className="mt-auto pt-10 text-center text-[10px] font-mono text-slate-600 leading-relaxed border-t border-slate-900 w-full max-w-4xl">
        <div>Stickman vs Devil - Elegant Retro Barrage Game</div>
        <div>Created with React, Vite & Tailwind in Cloud Run space.</div>
      </footer>
    </div>
  );
}
