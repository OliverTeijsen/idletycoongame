import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ACHIEVEMENTS, achievementProgress, isUnlocked } from '../../core/achievements';
import { formatBig } from '../../core/numbers';
import type { AchievementDef, GameState } from '../../core/types';
import { useGameStore } from '../../store/gameStore';
import { useStrings } from '../i18n';
import { colors, radius, spacing, tabular, type } from '../theme';

/** The full achievement list, earned and not. */
export function AchievementsModal(): React.JSX.Element | null {
  const open = useGameStore((s) => s.achievementsOpen);
  const close = useGameStore((s) => s.closeAchievements);
  const state = useGameStore((s) => s.state);
  const strings = useStrings();

  if (!open) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card} testID="achievements-modal">
          <Text style={styles.title}>{strings.achievementsTitle}</Text>
          <Text style={type.body}>
            {strings.achievementsCount(state.unlocked.length, ACHIEVEMENTS.length)}
          </Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {ACHIEVEMENTS.map((def) => (
              <Row key={def.id} def={def} state={state} />
            ))}
          </ScrollView>

          <Pressable
            testID="achievements-close"
            accessibilityRole="button"
            onPress={close}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Text style={styles.closeLabel}>{strings.achievementsClose}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Row({ def, state }: { def: AchievementDef; state: GameState }): React.JSX.Element {
  const strings = useStrings();
  const earned = isUnlocked(state, def.id);
  const fraction = achievementProgress(state, def.id);

  return (
    <View style={[styles.row, !earned && styles.rowLocked]} testID={`achievement-${def.id}`}>
      <Text style={styles.icon}>{earned ? def.icon : '🔒'}</Text>

      <View style={styles.rowBody}>
        <Text style={type.title} numberOfLines={1}>
          {strings.achievements[def.id]}
        </Text>

        <View style={styles.track}>
          <View
            testID={`achievement-progress-${def.id}`}
            style={[styles.fill, { width: `${fraction * 100}%` }, earned && styles.fillEarned]}
          />
        </View>
      </View>

      <Text style={styles.goal} numberOfLines={1}>
        {formatBig(Math.min(def.progress(state), def.goal))}/{formatBig(def.goal)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
  title: {
    ...type.title,
    fontSize: 22,
  },
  list: {
    width: '100%',
  },
  listContent: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  rowLocked: {
    opacity: 0.55,
  },
  icon: {
    fontSize: 22,
    width: 30,
    textAlign: 'center',
  },
  rowBody: {
    flex: 1,
    gap: spacing.xs,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.locked,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.goldDeep,
  },
  fillEarned: {
    backgroundColor: colors.green,
  },
  goal: {
    ...type.small,
    ...tabular,
  },
  close: {
    width: '100%',
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: {
    ...type.body,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
