/** Trials tab (spec §8.4): restriction runs with permanent rewards. */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BAL } from '../../game/balance';
import { format, formatTime } from '../../game/numbers';
import {
  challengeGoal,
  canEnterChallenge,
  challengeTiers,
} from '../../game/systems/challenges';
import { trialTiersCleared } from '../../game/systems/prestige';
import { useGameStore } from '../../state/store';
import { Card, Meter } from '../components/Panel';
import { LAYERS, mono, palette, radius, spacing, type } from '../theme';

export function ChallengesScreen() {
  const game = useGameStore((s) => s.game);
  const enter = useGameStore((s) => s.enterChallenge);
  const exit = useGameStore((s) => s.exitChallenge);
  const notation = game.options.notation;
  const busyElsewhere = game.activeChallenge !== null;
  const cleared = trialTiersCleared(game);
  const total = BAL.challenges.defs.reduce((sum, c) => sum + c.maxTier, 0);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.blurb}>
        A trial restarts the run under a restriction. Reach the Spark goal to complete the tier —
        the reward is permanent. Entering or leaving resets the run; your Shards, Prism and trees
        are safe.
      </Text>
      {/*
        Trials are not a side cabinet: they GATE the deep layers (BAL.gates).
        Saying so here, with the running count, is the difference between a
        player routing deliberately and a player wondering for an hour why
        Converge will not fire.
      */}
      <View style={styles.gateBox}>
        <Text style={styles.gateTitle}>
          {cleared} of {total} tiers cleared
        </Text>
        <Text style={styles.gateText}>
          Converge needs {BAL.gates.convergeTrialTiers}. Unify needs {BAL.gates.unifyTrialTiers}.
          Trials are the only way past those two doors, and every tier you clear makes the rest of
          the game faster — so clearing them early is the whole speedrun.
        </Text>
      </View>

      {BAL.challenges.defs.map((def) => {
        const tiers = challengeTiers(game, def.id);
        const active = game.activeChallenge === def.id;
        const done = tiers >= def.maxTier;
        const goal = challengeGoal(game, def.id);

        return (
          <Card
            key={def.id}
            accent={done ? palette.orbiter : palette.prism}
            active={active}
            muted={busyElsewhere && !active}
          >
            <View style={styles.head}>
              <Text style={styles.name}>{def.name}</Text>
              <Text style={styles.pips}>
                <Text style={{ color: palette.prism }}>{'●'.repeat(tiers)}</Text>
                <Text style={{ color: palette.line }}>
                  {'○'.repeat(Math.max(0, def.maxTier - tiers))}
                </Text>
              </Text>
            </View>

            <View style={styles.def}>
              <Text style={styles.defLabel}>Rule</Text>
              <Text style={[styles.defValue, { color: palette.mote }]}>{def.restriction}</Text>
            </View>
            <View style={styles.def}>
              <Text style={styles.defLabel}>Reward</Text>
              <Text style={[styles.defValue, { color: palette.orbiter }]}>{def.rewardDesc}</Text>
            </View>

            {!done && (
              <>
                <View style={styles.goalRow}>
                  <Text style={styles.defLabel}>Goal</Text>
                  <Text style={styles.goalValue}>
                    {LAYERS.spark.glyph} {format(goal, { notation })}
                  </Text>
                </View>
                {/*
                  The meter is LOGARITHMIC, because the goal is. A trial goal
                  is 1e400 and a run passes 1e200 in half the time it needs —
                  on a linear bar every trial would sit pinned at zero until
                  it finished, which tells the player nothing.
                */}
                {active && (
                  <Meter
                    value={Math.max(0, game.bestSparkRun.log10())}
                    max={Math.max(1, goal.log10())}
                    color={palette.prism}
                  />
                )}
              </>
            )}

            {active ? (
              <>
                <Text style={styles.best}>
                  Best this run: {LAYERS.spark.glyph} {format(game.bestSparkRun, { notation })} ·{' '}
                  {formatTime(game.challengeElapsed)} in
                </Text>
                <Pressable style={[styles.button, styles.buttonExit]} onPress={exit}>
                  <Text style={styles.buttonExitText}>Abandon run</Text>
                </Pressable>
              </>
            ) : done ? (
              <Text style={styles.doneText}>All {def.maxTier} tiers complete</Text>
            ) : (
              <Pressable
                style={[styles.button, !canEnterChallenge(game, def.id) && styles.buttonLocked]}
                disabled={!canEnterChallenge(game, def.id)}
                onPress={() => enter(def.id)}
              >
                <Text style={styles.buttonText}>
                  {busyElsewhere ? 'Another trial is running' : `Enter tier ${tiers + 1}`}
                </Text>
              </Pressable>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2, paddingTop: spacing.sm },
  blurb: { ...type.body, color: palette.dim, marginBottom: spacing.sm },
  gateBox: {
    borderColor: palette.prism,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: palette.panel,
  },
  gateTitle: { ...type.figure, fontSize: 15, color: palette.prism },
  gateText: { ...type.micro, color: palette.dim, marginTop: 4 },

  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { ...type.label, fontSize: 13, letterSpacing: 2, color: palette.ink },
  pips: { fontSize: 11, letterSpacing: 3 },

  def: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  defLabel: { ...type.label, color: palette.faint, width: 52, paddingTop: 2 },
  defValue: { ...type.micro, flex: 1 },

  goalRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    paddingTop: spacing.sm,
  },
  goalValue: { ...mono, color: palette.core, fontSize: 12, fontWeight: '700', flex: 1 },
  best: { ...type.micro, ...mono, color: palette.dim, marginTop: spacing.sm },

  button: {
    marginTop: spacing.md,
    backgroundColor: palette.prism,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buttonLocked: { backgroundColor: palette.panelHi },
  buttonText: { ...type.label, fontSize: 11, color: palette.bgDeep },
  buttonExit: { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.danger },
  buttonExitText: { ...type.label, fontSize: 11, color: palette.danger },
  doneText: { ...type.label, fontSize: 11, color: palette.orbiter, marginTop: spacing.md },
});
