/** Options: notation, reduced motion, confirms, export/import, hard reset. */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { NotationMode } from '../../game/types';
import { exportSave, importSave } from '../../services/storage';
import { useGameStore } from '../../state/store';
import { SectionHeader } from '../components/Panel';
import { mono, palette, radius, spacing, type } from '../theme';

const NOTATIONS: NotationMode[] = ['standard', 'scientific', 'engineering'];

const VOLUMES = [
  { label: 'quiet', value: 0.3 },
  { label: 'normal', value: 0.7 },
  { label: 'loud', value: 1 },
];

export function OptionsScreen() {
  const game = useGameStore((s) => s.game);
  const setOptions = useGameStore((s) => s.setOptions);
  const hardReset = useGameStore((s) => s.hardReset);
  const importState = useGameStore((s) => s.importState);
  const [exported, setExported] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <SectionHeader label="Notation" accent={palette.core} />
      <View style={styles.rowGroup}>
        {NOTATIONS.map((n) => (
          <Pressable
            key={n}
            onPress={() => setOptions({ notation: n })}
            style={[styles.chip, game.options.notation === n && styles.chipActive]}
          >
            <Text style={[styles.chipText, game.options.notation === n && styles.chipTextActive]}>
              {n}
            </Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader label="Preferences" accent={palette.orbiter} />
      <ToggleRow
        label="Reduced motion"
        value={game.options.reducedMotion}
        onToggle={(v) => setOptions({ reducedMotion: v })}
      />
      <ToggleRow
        label="Confirm resets"
        value={game.options.confirmResets}
        onToggle={(v) => setOptions({ confirmResets: v })}
      />
      <ToggleRow
        label="Offline summary on resume"
        value={game.options.showOfflineSummary}
        onToggle={(v) => setOptions({ showOfflineSummary: v })}
      />

      <SectionHeader label="Sound" accent={palette.mote} />
      <ToggleRow
        label="Muted"
        value={game.options.muted}
        onToggle={(v) => setOptions({ muted: v })}
      />
      <View style={styles.rowGroup}>
        {VOLUMES.map((v) => (
          <Pressable
            key={v.label}
            onPress={() => setOptions({ volume: v.value, muted: false })}
            style={[
              styles.chip,
              !game.options.muted &&
                Math.abs(game.options.volume - v.value) < 0.01 &&
                styles.chipActive,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                !game.options.muted &&
                  Math.abs(game.options.volume - v.value) < 0.01 &&
                  styles.chipTextActive,
              ]}
            >
              {v.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader label="Save" accent={palette.aeon} />
      <Pressable style={styles.button} onPress={() => setExported(exportSave(game))}>
        <Text style={styles.buttonText}>Export save</Text>
      </Pressable>
      {exported && (
        <TextInput
          style={styles.blob}
          value={exported}
          multiline
          editable={false}
          selectTextOnFocus
        />
      )}
      <TextInput
        style={styles.blob}
        value={importText}
        onChangeText={(t) => {
          setImportText(t);
          setImportError(false);
        }}
        placeholder="paste an exported save here…"
        placeholderTextColor={palette.dim}
        multiline
      />
      <Pressable
        style={styles.button}
        onPress={() => {
          const state = importSave(importText);
          if (state) {
            importState(state);
            setImportText('');
          } else {
            setImportError(true);
          }
        }}
      >
        <Text style={styles.buttonText}>Import save</Text>
      </Pressable>
      {importError && <Text style={styles.error}>That is not a valid save.</Text>}

      <SectionHeader label="Danger" accent={palette.danger} />
      {!confirmReset ? (
        <Pressable style={[styles.button, styles.dangerButton]} onPress={() => setConfirmReset(true)}>
          <Text style={styles.dangerText}>Hard reset…</Text>
        </Pressable>
      ) : (
        <View style={styles.rowGroup}>
          <Pressable
            style={[styles.button, styles.dangerButton, { flex: 1 }]}
            onPress={() => {
              hardReset();
              setConfirmReset(false);
            }}
          >
            <Text style={styles.dangerText}>Erase EVERYTHING</Text>
          </Pressable>
          <Pressable style={[styles.button, { flex: 1 }]} onPress={() => setConfirmReset(false)}>
            <Text style={styles.buttonText}>Keep playing</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle(v: boolean): void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onToggle(!value)}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Text style={[styles.toggleState, value && styles.toggleOn]}>{value ? 'ON' : 'OFF'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
  rowGroup: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.bg,
  },
  chipActive: { borderColor: palette.core, backgroundColor: palette.panelWarm },
  chipText: { ...type.label, fontSize: 10, color: palette.faint },
  chipTextActive: { color: palette.core },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.bg,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: 6,
  },
  toggleLabel: { ...type.title, fontSize: 13, fontWeight: '600', color: palette.ink },
  toggleState: { ...type.label, fontSize: 10, color: palette.faint },
  toggleOn: { color: palette.orbiter },
  button: {
    backgroundColor: palette.bg,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: 6,
  },
  buttonText: { ...type.label, fontSize: 11, color: palette.ink },
  blob: {
    backgroundColor: palette.bgDeep,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    color: palette.dim,
    fontSize: 10,
    padding: spacing.sm,
    minHeight: 60,
    maxHeight: 120,
    marginBottom: spacing.sm,
    ...mono,
  },
  error: { ...type.body, color: palette.danger, marginBottom: spacing.sm },
  stat: { ...type.body, ...mono, color: palette.ink, marginBottom: 4 },
  dangerButton: { borderColor: palette.danger },
  dangerText: { ...type.label, fontSize: 11, color: palette.danger },
});
