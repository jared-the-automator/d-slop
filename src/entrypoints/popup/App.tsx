import { useState, useEffect } from 'react';
import { getExtensionState, setExtensionState, getFlagCount } from '../../lib/storage';
import type { DisplayMode, ExtensionState } from '../../lib/rules-engine/types';

const MODES: DisplayMode[] = ['highlight', 'collapse', 'hidden'];

export default function App() {
  const [state, setState] = useState<ExtensionState>({ enabled: true, mode: 'highlight' });
  const [flagCount, setFlagCountLocal] = useState(0);

  useEffect(() => {
    getExtensionState().then(setState);
    getFlagCount().then(setFlagCountLocal);
  }, []);

  async function toggleEnabled() {
    const next = !state.enabled;
    await setExtensionState({ enabled: next });
    setState(s => ({ ...s, enabled: next }));
  }

  async function pickMode(mode: DisplayMode) {
    await setExtensionState({ mode });
    setState(s => ({ ...s, mode }));
  }

  return (
    <div style={{
      width: 210,
      padding: '12px 14px',
      fontFamily: 'monospace',
      fontSize: 13,
      color: '#222',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong style={{ fontSize: 15 }}>D-slop</strong>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={toggleEnabled}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ color: state.enabled ? '#2a9d2a' : '#999' }}>
            {state.enabled ? 'ON' : 'OFF'}
          </span>
        </label>
      </div>

      <fieldset style={{
        border: '1px solid #ccc',
        borderRadius: 4,
        padding: '5px 10px 8px',
        marginBottom: 10,
        opacity: state.enabled ? 1 : 0.4,
      }}>
        <legend style={{ fontSize: 11, color: '#888', padding: '0 3px' }}>Mode</legend>
        {MODES.map(m => (
          <label key={m} style={{ display: 'block', margin: '3px 0', cursor: state.enabled ? 'pointer' : 'default' }}>
            <input
              type="radio"
              name="mode"
              value={m}
              checked={state.mode === m}
              disabled={!state.enabled}
              onChange={() => pickMode(m)}
              style={{ marginRight: 6 }}
            />
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </label>
        ))}
      </fieldset>

      <div style={{ fontSize: 11, color: '#999', textAlign: 'right' }}>
        {state.enabled
          ? `${flagCount} item${flagCount !== 1 ? 's' : ''} flagged this page`
          : 'detection off'}
      </div>
    </div>
  );
}
