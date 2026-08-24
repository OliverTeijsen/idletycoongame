/** Options: notation, reduced motion, confirms, export/import, hard reset. */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { NotationMode } from '../../game/types';
import { exportSave, importSave } from '../../services/storage';
import { useGameStore } from '../../state/store';
import { mono, palette, spacing } from '../theme';

const NOTATIONS: NotationMode[] = ['standard', 'scientific', 'engineering'];

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
      <Text style={styles.section}>NOTATION</Text>
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

      <Text style={styles.section}>PREFERENCES</Text>
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

      <Text style={styles.section}>SAVE</Text>
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

      <Text style={styles.section}>DANGER</Text>
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
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  section: {
    color: palette.dim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  rowGroup: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
  },
  chipActive: { borderColor: palette.core, backgroundColor: '#241a0d' },
  chipText: { color: palette.dim, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: palette.core },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  toggleLabel: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  toggleState: { color: palette.dim, fontSize: 12, fontWeight: '800', ...mono },
  toggleOn: { color: palette.orbiter },
  button: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  buttonText: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  blob: {
    backgroundColor: palette.bgDeep,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    color: palette.dim,
    fontSize: 10,
    padding: spacing.sm,
    minHeight: 60,
    maxHeight: 120,
    marginBottom: spacing.sm,
    ...mono,
  },
  error: { color: palette.danger, fontSize: 12, marginBottom: spacing.sm },
  stat: { color: palette.ink, fontSize: 13, marginBottom: 4, ...mono },
  dangerButton: { borderColor: palette.danger },
  dangerText: { color: palette.danger, fontSize: 13, fontWeight: '700' },
});
