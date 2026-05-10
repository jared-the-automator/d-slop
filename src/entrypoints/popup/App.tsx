import { useState, useEffect } from 'react';
import { getExtensionState, setExtensionState, getUserThreshold, setUserThreshold } from '../../lib/storage';
import { DEFAULT_THRESHOLD } from '../../lib/config';
import type { DisplayMode, ExtensionState } from '../../lib/rules-engine/types';

const MODES: DisplayMode[] = ['highlight', 'collapse', 'hidden'];

export default function App() {
  const [state, setState] = useState<ExtensionState>({ enabled: true, mode: 'highlight' });
  const [flagCount, setFlagCountLocal] = useState(0);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);

  useEffect(() => {
    getExtensionState().then(setState);
    getUserThreshold().then(setThreshold);
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab?.id) return;
      browser.tabs.sendMessage(tab.id, { type: 'GET_FLAG_COUNT' })
        .then((res: { count: number }) => setFlagCountLocal(res?.count ?? 0))
        .catch(() => setFlagCountLocal(0));
    });
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

  async function changeThreshold(value: number) {
    await setUserThreshold(value);
    setThreshold(value);
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
        <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0 0' }}>
          Mode changes apply on the next page load.
        </p>
      </fieldset>

      <fieldset style={{
        border: '1px solid #ccc',
        borderRadius: 4,
        padding: '5px 10px 8px',
        marginBottom: 10,
        opacity: state.enabled ? 1 : 0.4,
      }}>
        <legend style={{ fontSize: 11, color: '#888', padding: '0 3px' }}>Threshold</legend>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa', marginBottom: 2 }}>
          <span>sensitive</span>
          <span style={{ color: '#555', fontWeight: threshold === DEFAULT_THRESHOLD ? 'bold' : 'normal' }}>
            {Math.round(threshold * 100)}%{threshold === DEFAULT_THRESHOLD ? ' (default)' : ''}
          </span>
          <span>strict</span>
        </div>
        <input
          type="range"
          min="0.05" max="0.50" step="0.05"
          value={threshold}
          disabled={!state.enabled}
          onChange={e => changeThreshold(Number(e.target.value))}
          style={{ width: '100%', cursor: state.enabled ? 'pointer' : 'default' }}
        />
      </fieldset>

      <div style={{ fontSize: 11, color: '#999', textAlign: 'right' }}>
        {state.enabled
          ? `${flagCount} item${flagCount !== 1 ? 's' : ''} flagged this page`
          : 'detection off'}
      </div>
    </div>
  );
}
