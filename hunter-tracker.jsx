import React, { useState, useEffect } from 'react';
import { Sword, Target, Dumbbell, Activity, Heart, Trophy, TrendingDown, Calendar, Zap, Flame } from 'lucide-react';

// FIREBASE CONFIGURATION
// Replace these values with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "dummy-key-not-needed-for-public-rtdb",
  authDomain: "huntertracker-212de.firebaseapp.com",
  databaseURL: "https://huntertracker-212de-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "huntertracker-212de",
  storageBucket: "huntertracker-212de.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:123456"
};

const START_DATE_STR = '2026-05-01';
const END_DATE_STR = '2026-07-26';
const START_WEIGHT = 82;
const GOAL_WEIGHT = 74;

const TARGETS = { calories: 2300, protein: 180, carbs: 230, fat: 70, steps: 10000 };

const WORKOUTS = {
  push: {
    name: 'PUSH',
    title: 'Chest · Shoulders · Triceps',
    exercises: [
      { name: 'Bench Press', sets: '4 × 6-8' },
      { name: 'Incline DB Press', sets: '3 × 8-10' },
      { name: 'Overhead Press', sets: '3 × 6-8' },
      { name: 'Lateral Raises', sets: '3 × 12-15' },
      { name: 'Cable Pushdown', sets: '3 × 10-12' },
      { name: 'Overhead Tricep Ext', sets: '3 × 10-12' },
    ],
  },
  pull: {
    name: 'PULL',
    title: 'Back · Biceps · Rear Delts',
    exercises: [
      { name: 'Pull-ups / Lat Pulldown', sets: '4 × 6-10' },
      { name: 'Barbell Row', sets: '4 × 6-8' },
      { name: 'Seated Cable Row', sets: '3 × 8-10' },
      { name: 'Face Pulls', sets: '3 × 12-15' },
      { name: 'Barbell Curl', sets: '3 × 8-10' },
      { name: 'Hammer Curl', sets: '3 × 10-12' },
    ],
  },
  legs: {
    name: 'LEGS',
    title: 'Quads · Hams · Glutes · Calves',
    exercises: [
      { name: 'Squat', sets: '4 × 6-8' },
      { name: 'Romanian Deadlift', sets: '3 × 8-10' },
      { name: 'Leg Press', sets: '3 × 10-12' },
      { name: 'Leg Curl', sets: '3 × 10-12' },
      { name: 'Walking Lunges', sets: '2 × 12 each' },
      { name: 'Calf Raises', sets: '4 × 12-15' },
    ],
  },
  rest: {
    name: 'REST DAY',
    title: 'Recovery · 10k steps only',
    exercises: [],
  },
};

const QUESTS = [
  { id: 'protein', label: 'HIT PROTEIN TARGET', sub: '180g consumed', xp: 100, icon: Sword },
  { id: 'calories', label: 'CALORIE DISCIPLINE', sub: 'Within 2,300 kcal', xp: 75, icon: Target },
  { id: 'workout', label: 'COMPLETE TRAINING', sub: "Today's session done", xp: 200, icon: Dumbbell },
  { id: 'steps', label: '10,000 STEPS', sub: 'Movement quota met', xp: 75, icon: Activity },
  { id: 'sleep', label: '7+ HOURS SLEEP', sub: 'Recovery secured', xp: 50, icon: Heart },
];

const todayKey = () => new Date().toISOString().split('T')[0];

const getTodayWorkout = () => {
  const day = new Date().getDay();
  // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
  if (day === 0) return 'rest'; // Sunday
  if (day === 1 || day === 4) return 'push'; // Monday, Thursday
  if (day === 2 || day === 5) return 'pull'; // Tuesday, Friday
  if (day === 3 || day === 6) return 'legs'; // Wednesday, Saturday
  return 'rest'; // Fallback
};

const daysRemaining = () => {
  const end = new Date(END_DATE_STR);
  const today = new Date();
  return Math.max(0, Math.ceil((end - today) / 86400000));
};

const totalDays = Math.ceil((new Date(END_DATE_STR) - new Date(START_DATE_STR)) / 86400000);

const getRank = (level) => {
  if (level >= 21) return { letter: 'S', color: '#ff3838', glow: '255,56,56' };
  if (level >= 16) return { letter: 'A', color: '#c084fc', glow: '192,132,252' };
  if (level >= 11) return { letter: 'B', color: '#22d3ee', glow: '34,211,238' };
  if (level >= 7) return { letter: 'C', color: '#38bdf8', glow: '56,189,248' };
  if (level >= 4) return { letter: 'D', color: '#7dd3fc', glow: '125,211,252' };
  return { letter: 'E', color: '#94a3b8', glow: '148,163,184' };
};

export default function Tracker() {
  const tk = todayKey();
  const workoutType = getTodayWorkout();
  const workout = WORKOUTS[workoutType];

  const [state, setState] = useState({
    quests: {},
    exercises: {},
    macros: { calories: '', protein: '', carbs: '', fat: '', steps: '' },
    weightInput: '',
    weightHistory: [],
    totalXP: 0,
  });
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);

  const [aiKey, setAiKey] = useState(typeof window !== 'undefined' ? localStorage.getItem('hunter-ai-key') || '' : '');
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(typeof window !== 'undefined' ? !localStorage.getItem('hunter-ai-key') : true);

  const handleAILog = async () => {
    if (!aiInput) return;
    if (!aiKey) {
      setShowKeyInput(true);
      return;
    }

    setIsAiLoading(true);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a nutrition API. Estimate macros. Return ONLY valid JSON: {"calories": num, "protein": num, "carbs": num, "fat": num}. No markdown, no explanations.'
            },
            {
              role: 'user',
              content: aiInput
            }
          ]
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          showToast('API KEY INVALID');
          setShowKeyInput(true);
        } else {
          showToast('AI ERROR');
        }
        return;
      }

      const data = await response.json();
      const result = JSON.parse(data.choices[0].message.content.trim().replace(/```json|```/g, ''));

      setState(s => {
        const c = parseFloat(s.macros.calories) || 0;
        const p = parseFloat(s.macros.protein) || 0;
        const cb = parseFloat(s.macros.carbs) || 0;
        const f = parseFloat(s.macros.fat) || 0;
        return {
          ...s,
          macros: {
            ...s.macros,
            calories: Math.round(c + (result.calories || 0)),
            protein: Math.round(p + (result.protein || 0)),
            carbs: Math.round(cb + (result.carbs || 0)),
            fat: Math.round(f + (result.fat || 0)),
            steps: s.macros.steps
          }
        };
      });
      setAiInput('');
      showToast(`AI LOGGED: ${result.calories || 0} KCAL`);
    } catch (error) {
      showToast('AI PARSE FAILED');
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get('hunter-state');
        if (result) {
          const parsed = JSON.parse(result.value);
          const today = parsed.daily?.[tk] || {};
          setState({
            quests: today.quests || {},
            exercises: today.exercises || {},
            macros: today.macros || { calories: '', protein: '', carbs: '', fat: '', steps: '' },
            weightInput: '',
            weightHistory: parsed.weightHistory || [],
            totalXP: parsed.totalXP || 0,
          });
        }
      } catch (e) { }
      setLoaded(true);
    })();
  }, [tk]);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        let parsed = { daily: {}, weightHistory: [], totalXP: 0 };
        try {
          const r = await window.storage.get('hunter-state');
          if (r) parsed = JSON.parse(r.value);
        } catch (e) { }
        parsed.daily = parsed.daily || {};
        parsed.daily[tk] = {
          quests: state.quests,
          exercises: state.exercises,
          macros: state.macros,
        };
        parsed.weightHistory = state.weightHistory;
        parsed.totalXP = state.totalXP;
        await window.storage.set('hunter-state', JSON.stringify(parsed));
      } catch (e) { }
    })();
  }, [state, loaded, tk]);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  };

  const toggleQuest = (id, xp) => {
    const next = { ...state.quests };
    if (next[id]) {
      delete next[id];
      setState((s) => ({ ...s, quests: next, totalXP: Math.max(0, s.totalXP - xp) }));
    } else {
      next[id] = true;
      setState((s) => ({ ...s, quests: next, totalXP: s.totalXP + xp }));
      showToast(`QUEST CLEARED · +${xp} XP`);
    }
  };

  const toggleExercise = (i) => {
    setState((s) => ({ ...s, exercises: { ...s.exercises, [i]: !s.exercises[i] } }));
  };

  const updateMacro = (k, v) => {
    setState((s) => ({ ...s, macros: { ...s.macros, [k]: v } }));
  };

  const logWeight = () => {
    const w = parseFloat(state.weightInput);
    if (!w || w < 40 || w > 200) return;
    const filtered = state.weightHistory.filter((h) => h.date !== tk);
    const next = [...filtered, { date: tk, weight: w }].sort((a, b) => a.date.localeCompare(b.date));
    setState((s) => ({ ...s, weightHistory: next, weightInput: '', totalXP: s.totalXP + 100 }));
    showToast(`WEIGHT LOGGED · +100 XP`);
  };

  const level = Math.floor(state.totalXP / 1000) + 1;
  const xpInLevel = state.totalXP % 1000;
  const rank = getRank(level);
  const dLeft = daysRemaining();
  const dDone = totalDays - dLeft;
  const journeyPct = Math.min(100, (dDone / totalDays) * 100);

  const currentWeight = state.weightHistory.length > 0 ? state.weightHistory[state.weightHistory.length - 1].weight : START_WEIGHT;
  const weightLost = START_WEIGHT - currentWeight;
  const weightPct = Math.min(100, Math.max(0, (weightLost / (START_WEIGHT - GOAL_WEIGHT)) * 100));

  const questsCleared = Object.keys(state.quests).length;

  return (
    <div className="min-h-screen w-full text-slate-200 relative overflow-hidden" style={{ background: '#03060d', fontFamily: "'Share Tech Mono', 'Courier New', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Share+Tech+Mono&display=swap');
        @keyframes scan { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes glow-pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes slide-down { 0%{transform:translateY(-30px);opacity:0} 100%{transform:translateY(0);opacity:1} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes flicker { 0%,100%{opacity:1} 50%{opacity:.92} }
        .scan-line { animation: scan 8s linear infinite; }
        .pulse-glow { animation: glow-pulse 2.5s ease-in-out infinite; }
        .slide-in { animation: slide-down .4s cubic-bezier(.2,.9,.3,1.2) both; }
        .flicker { animation: flicker 4s ease-in-out infinite; }
        .display-font { font-family: 'Orbitron', sans-serif; letter-spacing: 0.08em; }
        .grid-bg {
          background-image:
            linear-gradient(rgba(56,189,248,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56,189,248,0.06) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .corner-cut {
          clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
        }
        .quest-shimmer {
          background: linear-gradient(90deg, transparent, rgba(56,189,248,0.15), transparent);
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }
      `}</style>

      {/* Background layers */}
      <div className="absolute inset-0 grid-bg opacity-50 pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 30% 10%, rgba(56,189,248,0.12), transparent 50%), radial-gradient(circle at 80% 80%, rgba(192,132,252,0.08), transparent 50%)' }} />
      <div className="absolute left-0 right-0 h-px scan-line pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.6), transparent)', boxShadow: '0 0 20px rgba(56,189,248,0.5)' }} />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 slide-in">
          <div className="px-6 py-3 border-2 corner-cut display-font text-sm tracking-widest" style={{ background: 'rgba(3,6,13,0.95)', borderColor: '#22d3ee', color: '#22d3ee', boxShadow: '0 0 30px rgba(34,211,238,0.6), inset 0 0 20px rgba(34,211,238,0.1)' }}>
            ◢ {toast} ◣
          </div>
        </div>
      )}

      <div className="relative max-w-5xl mx-auto px-3 sm:px-6 py-6 space-y-5">

        {/* SYSTEM HEADER */}
        <div className="flex items-center gap-2 text-xs tracking-[0.3em] flicker" style={{ color: '#22d3ee' }}>
          <div className="w-2 h-2 rounded-full pulse-glow" style={{ background: '#22d3ee', boxShadow: '0 0 8px #22d3ee' }} />
          <span className="display-font">[ SYSTEM ONLINE ]</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(34,211,238,0.6), transparent)' }} />
        </div>

        {/* STATUS WINDOW */}
        <div className="relative border-2 corner-cut p-5 sm:p-7" style={{ borderColor: 'rgba(34,211,238,0.5)', background: 'linear-gradient(135deg, rgba(8,14,28,0.9), rgba(3,6,13,0.95))', boxShadow: '0 0 40px rgba(34,211,238,0.15), inset 0 0 60px rgba(34,211,238,0.04)' }}>
          <div className="absolute top-0 left-0 px-3 py-1 text-[10px] tracking-[0.3em] display-font" style={{ background: '#22d3ee', color: '#03060d' }}>
            STATUS · HUNTER PROFILE
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Rank Badge */}
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 flex items-center justify-center border-2 corner-cut" style={{ borderColor: rank.color, background: `radial-gradient(circle, rgba(${rank.glow},0.25), transparent 70%)`, boxShadow: `0 0 30px rgba(${rank.glow},0.5), inset 0 0 20px rgba(${rank.glow},0.2)` }}>
                <span className="display-font text-5xl font-black" style={{ color: rank.color, textShadow: `0 0 20px rgba(${rank.glow},0.8)` }}>{rank.letter}</span>
              </div>
              <div>
                <div className="text-[10px] tracking-[0.3em]" style={{ color: '#64748b' }}>HUNTER</div>
                <div className="display-font text-2xl font-bold" style={{ color: '#e2f4ff' }}>ROSHAN</div>
                <div className="text-xs tracking-widest mt-1" style={{ color: rank.color }}>LEVEL {level} · RANK {rank.letter}</div>
              </div>
            </div>

            {/* XP Bar */}
            <div className="flex-1 sm:ml-4">
              <div className="flex justify-between text-[10px] tracking-[0.25em] mb-1.5" style={{ color: '#64748b' }}>
                <span>EXPERIENCE</span>
                <span style={{ color: '#22d3ee' }}>{xpInLevel} / 1000</span>
              </div>
              <div className="h-3 border" style={{ borderColor: 'rgba(34,211,238,0.4)', background: 'rgba(0,0,0,0.5)' }}>
                <div className="h-full transition-all duration-700 quest-shimmer" style={{ width: `${(xpInLevel / 1000) * 100}%`, background: 'linear-gradient(90deg, #22d3ee, #38bdf8, #22d3ee)', boxShadow: '0 0 15px rgba(34,211,238,0.7)' }} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="TOTAL XP" value={state.totalXP} color="#22d3ee" />
                <Stat label="QUESTS" value={`${questsCleared}/5`} color="#38bdf8" />
                <Stat label="DAYS LEFT" value={dLeft} color="#c084fc" />
              </div>
            </div>
          </div>

          {/* Journey + Weight bars */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProgressMeter
              label="JOURNEY"
              icon={Calendar}
              left={`Day ${dDone}`}
              right={`${totalDays} total`}
              pct={journeyPct}
              color="#22d3ee"
              glow="34,211,238"
            />
            <ProgressMeter
              label="BODY MASS"
              icon={TrendingDown}
              left={`${currentWeight}kg`}
              right={`${GOAL_WEIGHT}kg goal`}
              pct={weightPct}
              color="#c084fc"
              glow="192,132,252"
            />
          </div>
        </div>

        {/* DAILY QUESTS */}
        <Section title="DAILY QUESTS" subtitle="Reset at midnight · Complete all to maintain streak" accent="#22d3ee">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {QUESTS.map((q) => {
              const done = !!state.quests[q.id];
              const Icon = q.icon;
              return (
                <button
                  key={q.id}
                  onClick={() => toggleQuest(q.id, q.xp)}
                  className="group relative text-left border-2 corner-cut p-4 transition-all duration-300 hover:scale-[1.01]"
                  style={{
                    borderColor: done ? '#22d3ee' : 'rgba(100,116,139,0.4)',
                    background: done ? 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(34,211,238,0.04))' : 'rgba(8,14,28,0.6)',
                    boxShadow: done ? '0 0 20px rgba(34,211,238,0.3), inset 0 0 30px rgba(34,211,238,0.05)' : 'none',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-10 h-10 flex items-center justify-center border" style={{ borderColor: done ? '#22d3ee' : 'rgba(100,116,139,0.5)', background: done ? 'rgba(34,211,238,0.15)' : 'transparent' }}>
                      <Icon size={18} style={{ color: done ? '#22d3ee' : '#94a3b8' }} />
                    </div>
                    <div className="flex-1">
                      <div className="display-font text-sm font-bold tracking-wider" style={{ color: done ? '#22d3ee' : '#cbd5e1' }}>{q.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{q.sub}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] tracking-widest" style={{ color: done ? '#22d3ee' : '#475569' }}>{done ? 'CLEARED' : 'PENDING'}</div>
                      <div className="display-font text-sm font-bold" style={{ color: done ? '#22d3ee' : '#64748b' }}>+{q.xp} XP</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* TODAY'S WORKOUT */}
        <Section title={`TRAINING · ${workout.name}`} subtitle={workout.title} accent="#c084fc">
          {workout.exercises.length === 0 ? (
            <div className="text-center py-8 border border-dashed" style={{ borderColor: 'rgba(192,132,252,0.3)', color: '#94a3b8' }}>
              <Heart size={32} className="mx-auto mb-2 pulse-glow" style={{ color: '#c084fc' }} />
              <div className="display-font tracking-widest text-sm" style={{ color: '#c084fc' }}>RECOVERY PROTOCOL</div>
              <div className="text-xs mt-1">Walk 10,000 steps · Sleep early · Hydrate</div>
            </div>
          ) : (
            <div className="space-y-2">
              {workout.exercises.map((ex, i) => {
                const done = state.exercises[i];
                return (
                  <button
                    key={i}
                    onClick={() => toggleExercise(i)}
                    className="w-full flex items-center gap-3 p-3 border transition-all"
                    style={{
                      borderColor: done ? 'rgba(192,132,252,0.6)' : 'rgba(100,116,139,0.3)',
                      background: done ? 'rgba(192,132,252,0.08)' : 'rgba(8,14,28,0.4)',
                    }}
                  >
                    <div className="w-5 h-5 border-2 flex items-center justify-center" style={{ borderColor: done ? '#c084fc' : '#475569', background: done ? '#c084fc' : 'transparent' }}>
                      {done && <span className="text-[10px] font-bold" style={{ color: '#03060d' }}>✓</span>}
                    </div>
                    <span className="flex-1 text-left text-sm" style={{ color: done ? '#e9d5ff' : '#cbd5e1', textDecoration: done ? 'line-through' : 'none', textDecorationColor: 'rgba(192,132,252,0.4)' }}>{ex.name}</span>
                    <span className="display-font text-xs tracking-wider" style={{ color: done ? '#c084fc' : '#64748b' }}>{ex.sets}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Section>

        {/* MACRO TRACKER */}
        <Section title="NUTRITION LOG" subtitle="Input today's intake · Auto-calculates progress" accent="#38bdf8">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            <MacroInput label="KCAL" target={TARGETS.calories} value={state.macros.calories} onChange={(v) => updateMacro('calories', v)} color="#38bdf8" />
            <MacroInput label="PROTEIN" target={TARGETS.protein} unit="g" value={state.macros.protein} onChange={(v) => updateMacro('protein', v)} color="#22d3ee" />
            <MacroInput label="CARBS" target={TARGETS.carbs} unit="g" value={state.macros.carbs} onChange={(v) => updateMacro('carbs', v)} color="#c084fc" />
            <MacroInput label="FAT" target={TARGETS.fat} unit="g" value={state.macros.fat} onChange={(v) => updateMacro('fat', v)} color="#f0abfc" />
            <MacroInput label="STEPS" target={TARGETS.steps} value={state.macros.steps} onChange={(v) => updateMacro('steps', v)} color="#7dd3fc" />
          </div>

          <div className="pt-5 border-t" style={{ borderColor: 'rgba(56,189,248,0.2)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} style={{ color: '#38bdf8' }} />
              <div className="display-font text-xs tracking-widest" style={{ color: '#38bdf8' }}>AI NUTRITION UPLINK</div>
            </div>
            {showKeyInput ? (
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="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"
                  value={aiKey}
                  onChange={(e) => setAiKey(e.target.value)}
                  className="flex-1 px-4 py-2 border bg-transparent display-font text-sm focus:outline-none"
                  style={{ borderColor: 'rgba(56,189,248,0.4)', color: '#e2f4ff' }}
                />
                <button
                  onClick={() => {
                    if (aiKey.startsWith('sk-') || aiKey.length > 20) {
                      localStorage.setItem('hunter-ai-key', aiKey);
                      setShowKeyInput(false);
                      showToast('API KEY SECURED');
                    } else {
                      showToast('INVALID KEY FORMAT');
                    }
                  }}
                  className="px-4 py-2 border display-font text-xs transition-all hover:bg-cyan-900/30"
                  style={{ borderColor: '#38bdf8', color: '#38bdf8', background: 'rgba(56,189,248,0.1)' }}
                >
                  SAVE KEY
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Describe meal (e.g. 2 scrambled eggs, 1 slice toast)"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAILog()}
                  className="flex-1 px-4 py-2 border bg-transparent display-font text-sm tracking-wider focus:outline-none"
                  style={{ borderColor: 'rgba(56,189,248,0.4)', color: '#e2f4ff' }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAILog}
                    disabled={isAiLoading}
                    className="flex-1 sm:flex-none px-6 py-2 display-font text-xs tracking-widest border transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                    style={{ borderColor: '#38bdf8', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', boxShadow: '0 0 10px rgba(56,189,248,0.2)' }}
                  >
                    {isAiLoading ? 'ANALYZING...' : 'AI LOG'}
                  </button>
                  <button
                    onClick={() => setShowKeyInput(true)}
                    className="px-3 py-2 border opacity-50 hover:opacity-100 transition-all"
                    style={{ borderColor: '#94a3b8', color: '#94a3b8' }}
                    title="Update API Key"
                  >
                    KEY
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* WEIGHT LOG */}
        <Section title="BODY MASS REGISTRY" subtitle={`Start: ${START_WEIGHT}kg · Goal: ${GOAL_WEIGHT}kg · Log daily`} accent="#22d3ee">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2 flex-1">
              <input
                type="number"
                step="0.1"
                placeholder="Enter weight (kg)"
                value={state.weightInput}
                onChange={(e) => setState((s) => ({ ...s, weightInput: e.target.value }))}
                className="flex-1 px-4 py-3 border-2 bg-transparent display-font tracking-wider focus:outline-none"
                style={{ borderColor: 'rgba(34,211,238,0.4)', color: '#e2f4ff' }}
              />
              <button
                onClick={logWeight}
                className="px-6 py-3 display-font text-sm tracking-widest border-2 transition-all hover:scale-105"
                style={{ borderColor: '#22d3ee', background: 'rgba(34,211,238,0.15)', color: '#22d3ee', boxShadow: '0 0 15px rgba(34,211,238,0.3)' }}
              >
                LOG
              </button>
            </div>
          </div>
          {state.weightHistory.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] tracking-[0.3em] mb-2" style={{ color: '#64748b' }}>RECENT ENTRIES</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {state.weightHistory.slice(-8).reverse().map((h) => (
                  <div key={h.date} className="px-3 py-2 border text-xs" style={{ borderColor: 'rgba(34,211,238,0.2)', background: 'rgba(8,14,28,0.6)' }}>
                    <div style={{ color: '#64748b' }} className="text-[10px]">{h.date.slice(5)}</div>
                    <div className="display-font" style={{ color: '#22d3ee' }}>{h.weight}kg</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* FOOTER */}
        <div className="text-center py-4 text-xs tracking-[0.3em]" style={{ color: '#475569' }}>
          <div className="flicker">◇ ARISE · GRADUATION · 26.07.2026 ◇</div>
          <div className="mt-2 text-[10px]" style={{ color: '#334155' }}>Data persists across sessions</div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="border px-2 py-1.5" style={{ borderColor: 'rgba(100,116,139,0.3)', background: 'rgba(0,0,0,0.3)' }}>
      <div className="text-[9px] tracking-[0.2em]" style={{ color: '#64748b' }}>{label}</div>
      <div className="display-font text-sm font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function ProgressMeter({ label, icon: Icon, left, right, pct, color, glow }) {
  return (
    <div className="border p-3" style={{ borderColor: `rgba(${glow},0.3)`, background: 'rgba(0,0,0,0.3)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color }} />
          <span className="text-[10px] tracking-[0.25em] display-font" style={{ color }}>{label}</span>
        </div>
        <div className="text-xs" style={{ color: '#94a3b8' }}>
          <span style={{ color }}>{left}</span> · {right}
        </div>
      </div>
      <div className="h-2 border" style={{ borderColor: `rgba(${glow},0.3)`, background: 'rgba(0,0,0,0.5)' }}>
        <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, rgba(${glow},0.6))`, boxShadow: `0 0 10px rgba(${glow},0.6)` }} />
      </div>
    </div>
  );
}

function Section({ title, subtitle, accent, children }) {
  return (
    <div className="border-2 corner-cut p-5" style={{ borderColor: `${accent}40`, background: 'linear-gradient(135deg, rgba(8,14,28,0.85), rgba(3,6,13,0.95))', boxShadow: `0 0 25px ${accent}15` }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-6" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
        <div className="flex-1">
          <div className="display-font text-sm sm:text-base font-bold tracking-[0.2em]" style={{ color: accent }}>{title}</div>
          <div className="text-[10px] tracking-widest" style={{ color: '#64748b' }}>{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function MacroInput({ label, target, unit = '', value, onChange, color }) {
  const num = parseFloat(value) || 0;
  const pct = Math.min(100, (num / target) * 100);
  return (
    <div className="border p-2.5" style={{ borderColor: `${color}40`, background: 'rgba(0,0,0,0.3)' }}>
      <div className="text-[10px] tracking-[0.2em] mb-1" style={{ color }}>{label}</div>
      <input
        type="number"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent display-font text-lg font-bold focus:outline-none"
        style={{ color: '#e2f4ff' }}
      />
      <div className="text-[10px] mt-1" style={{ color: '#64748b' }}>/ {target}{unit}</div>
      <div className="h-1 mt-1.5" style={{ background: 'rgba(0,0,0,0.5)' }}>
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}` }} />
      </div>
    </div>
  );
}
