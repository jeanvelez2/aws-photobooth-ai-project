import React from 'react';

interface PoseSelectorProps {
  themeId: string;
  selectedAction?: string;
  selectedMood?: string;
  generatePose: boolean;
  onActionSelect: (action: string) => void;
  onMoodSelect: (mood: string) => void;
  onGeneratePoseToggle: (enabled: boolean) => void;
}

const ACTIONS = {
  anime: ['cast-spell', 'serious-look', 'victory'],
  barbarian: ['serious-look', 'victory'],
  greek: ['heroic-pose', 'serious-look', 'meditation', 'victory'],
  mystic: ['cast-spell', 'meditation', 'serious-look', 'mystical-gesture']
};

// Blocked combinations for content safety
const BLOCKED_COMBINATIONS = [
  { theme: 'barbarian', action: 'battle-stance', mood: 'dark' },
  { theme: '*', action: 'roar', mood: 'dark' }
];

const ACTION_LABELS = {
  'cast-spell': '🪄 Cast Spell',
  'serious-look': '😤 Serious Look',
  'battle-stance': '⚔️ Battle Stance',
  'victory': '🏆 Victory',
  'roar': '🦁 Roar',
  'heroic-pose': '🦸 Heroic Pose',
  'meditation': '🧘 Meditation',
  'mystical-gesture': '✨ Mystical Gesture'
};

const MOODS = ['epic', 'dark', 'bright', 'mystical'] as const;

const MOOD_LABELS = {
  epic: '⚡ Epic',
  dark: '🌙 Dark',
  bright: '☀️ Bright',
  mystical: '🔮 Mystical'
};

export default function PoseSelector({
  themeId,
  selectedAction,
  selectedMood,
  generatePose,
  onActionSelect,
  onMoodSelect,
  onGeneratePoseToggle
}: PoseSelectorProps) {
  const availableActions = ACTIONS[themeId as keyof typeof ACTIONS] || ['serious-look', 'victory'];
  
  const isBlocked = (action: string, mood: string) => {
    return BLOCKED_COMBINATIONS.some(combo => 
      (combo.theme === '*' || combo.theme === themeId) &&
      combo.action === action &&
      combo.mood === mood
    );
  };
  
  const handleActionSelect = (action: string) => {
    if (selectedMood && isBlocked(action, selectedMood)) {
      return; // Don't allow blocked combinations
    }
    onActionSelect(action);
  };
  
  const handleMoodSelect = (mood: string) => {
    if (selectedAction && isBlocked(selectedAction, mood)) {
      return; // Don't allow blocked combinations
    }
    onMoodSelect(mood);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">AI Pose Generation</h3>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={generatePose}
            onChange={(e) => onGeneratePoseToggle(e.target.checked)}
            className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
          />
          <span className="text-sm text-gray-700">Enable AI Poses</span>
        </label>
      </div>

      {generatePose && (
        <div className="space-y-6">
          {/* Action Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Choose Action
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableActions.map((action) => {
                const blocked = selectedMood ? isBlocked(action, selectedMood) : false;
                return (
                  <button
                    key={action}
                    onClick={() => handleActionSelect(action)}
                    disabled={blocked}
                    className={`p-3 text-sm rounded-lg border transition-colors ${
                      blocked
                        ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                        : selectedAction === action
                        ? 'bg-purple-100 border-purple-500 text-purple-700'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-purple-50'
                    }`}
                  >
                    {ACTION_LABELS[action as keyof typeof ACTION_LABELS] || action}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mood Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Choose Mood
            </label>
            <div className="grid grid-cols-2 gap-2">
              {MOODS.map((mood) => {
                const blocked = selectedAction ? isBlocked(selectedAction, mood) : false;
                return (
                  <button
                    key={mood}
                    onClick={() => handleMoodSelect(mood)}
                    disabled={blocked}
                    className={`p-3 text-sm rounded-lg border transition-colors ${
                      blocked
                        ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                        : selectedMood === mood
                        ? 'bg-purple-100 border-purple-500 text-purple-700'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-purple-50'
                    }`}
                  >
                    {MOOD_LABELS[mood]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  AI will generate a new pose with your selected action and mood, then swap your face into it.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}