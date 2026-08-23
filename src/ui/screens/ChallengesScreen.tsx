/** Challenges tab (spec §8.4): restriction runs with permanent rewards. */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BAL } from '../../game/balance';
import { format } from '../../game/numbers';
import {
  challengeGoal,
  canEnterChallenge,
  challengeTiers,
} from '../../game/systems/challenges';
import { useGameStore } from '../../state/store';
import { mono, palette, spacing } from '../theme';

export function ChallengesScreen() {
  const game = useGameStore((s) => s.game);
  const enter = useGameStore((s) => s.enterChallenge);
  const exit = useGameStore((s) => s.exitChallenge);
  const notation = game.options.notation;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.blurb}>
        A challenge restarts the run under a restriction. Reach the Spark goal to complete the
        tier — the reward is permanent. Entering or leaving resets the run (your Shards, Prism
        and trees are safe).
      </Text>
      {BAL.challenges.defs.map((def) => {
        const tiers = challengeTiers(game, def.id);
        const active = game.activeChallenge === def.id;
        const done = tiers >= def.maxTier;
        const goal = challengeGoal(game, def.id);
        return (
          <View key={def.id} style={[styles.card, active && styles.cardActive, done && styles.cardDone]}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{def.name}</Text>
              <Text style={styles.tiers}>
                {'●'.repeat(tiers)}
                {'○'.repeat(Math.max(0, def.maxTier - tiers))}
              </Text>
            </View>
            <Text style={styles.restriction}>{def.restriction}</Text>
            <Text style={styles.reward}>Reward: {def.rewardDesc}</Text>
            {!done && (
              <Text style={styles.goal}>
                Goal: ✦ {format(goal, { notation })}
                {active ? ` · best ✦ ${format(game.bestSparkRun, { notation })}` : ''}
              </Text>
            )}
            {active ? (
              <Pressable style={[styles.button, styles.buttonExit]} onPress={exit}>
                <Text style={styles.buttonExitText}>ABANDON RUN</Text>
              </Pressable>
            ) : done ? (
              <Text style={styles.doneText}>COMPLETE</Text>
            ) : (
              <Pressable
                style={[styles.button, !canEnterChallenge(game, def.id) && styles.buttonLocked]}
                disabled={!canEnterChallenge(game, def.id)}
                onPress={() => enter(def.id)}
              >
                <Text style={styles.buttonText}>
                  {game.activeChallenge !== null ? 'another run is active' : `ENTER TIER ${tiers + 1}`}
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  blurb: { color: palette.dim, fontSize: 11, lineHeight: 17, marginBottom: spacing.md },
  card: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardActive: { borderColor: palette.core },
  cardDone: { borderColor: palette.orbiter, opacity: 0.75 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  tiers: { color: palette.core, fontSize: 12, letterSpacing: 2, ...mono },
  restriction: { color: palette.mote, fontSize: 11, marginTop: 4 },
  reward: { color: palette.orbiter, fontSize: 11, marginTop: 2 },
  goal: { color: palette.dim, fontSize: 11, marginTop: 2, ...mono },
  button: {
    marginTop: spacing.sm,
    backgroundColor: '#241a0d',
    borderColor: palette.core,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buttonLocked: { opacity: 0.4 },
  buttonText: { color: palette.core, fontSize: 12, fontWeight: '800' },
  buttonExit: { backgroundColor: '#2a1212', borderColor: palette.danger },
  buttonExitText: { color: palette.danger, fontSize: 12, fontWeight: '800' },
  doneText: { color: palette.orbiter, fontSize: 12, fontWeight: '800', marginTop: spacing.sm },
});
