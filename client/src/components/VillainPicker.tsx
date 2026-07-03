import { VILLAIN_PROFILES } from '../utils/scenarioGenerator';
import type { VillainProfile } from '../types/poker';

interface Props {
  selected: VillainProfile;
  onChange: (profile: VillainProfile) => void;
  disabled?: boolean;
}

export default function VillainPicker({ selected, onChange, disabled }: Props) {
  return (
    <div className="villain-picker">
      <div className="villain-picker-label">Villain type</div>
      <div className="villain-picker-options">
        {VILLAIN_PROFILES.map(profile => (
          <button
            key={profile.name}
            className={`villain-option ${selected.name === profile.name ? 'active' : ''}`}
            onClick={() => onChange(profile)}
            disabled={disabled}
            title={profile.description}
          >
            <span className="villain-option-emoji">{profile.emoji}</span>
            <span className="villain-option-name">{profile.tagline}</span>
          </button>
        ))}
      </div>
      <div className="villain-picker-desc">{selected.description}</div>
    </div>
  );
}
