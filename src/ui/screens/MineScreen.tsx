/** Mine tab (spec §8.3, §8.6): Miners, the Research tree and Time Flux. */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BAL } from '../../game/balance';
import { format, formatTime, formatWhole } from '../../game/numbers';
import { minerCost, minerCount, oreRate, researchOwned } from '../../game/systems/minerals';
import { useGameStore } from '../../state/store';
import { Row } from '../components/Row';
import { mono, palette, spacing } from '../theme';

const ORE = '#a3e635';

export function MineScreen() {
  const game = useGameStore((s) => s.game);
  const buyMiner = useGameStore((s) => s.buyMiner);
  const buyResearch = useGameStore((s) => s.buyResearch);
  const startWarp = useGameStore((s) => s.startWarp);
  const startFluxBoost = useGameStore((s) => s.startFluxBoost);
  const notation = game.options.notation;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.blurb}>
        Miners chew Ore ⛏ out of the dark ({format(oreRate(game), { notation, small: true })}/s).
        Ore and miners survive Collapse and Ascend — only Converge resets them. Research is
        forever.
      </Text>

      <Text style={styles.section}>MINERS</Text>
      {BAL.miners.map((def) => {
        const count = minerCount(game, def.id);
        const cost = minerCost(game, def.id);
        return (
          <Row
            key={def.id}
            color={ORE}
            title={def.name}
            subtext={`⛏ ${format(def.orePerSec, { small: true })}/s each · owned ${count}`}
            costText={`✦ ${format(cost, { notation })}`}
            affordable={game.spark.gte(cost)}
            onBuy={() => buyMiner(def.id)}
          />
        );
      })}

      <Text style={styles.section}>RESEARCH · ⛏ {formatWhole(game.ore, notation)}</Text>
      {BAL.research.map((def) => {
        const owned = researchOwned(game, def.id);
        return (
          <Row
            key={def.id}
            color={palette.aeon}
            title={def.name}
            subtext={def.desc}
            costText={`⛏ ${formatWhole(def.cost, notation)}`}
            affordable={game.ore.gte(def.cost)}
            maxed={owned}
            onBuy={() => buyResearch(def.id)}
          />
        );
      })}

      <Text style={styles.section}>TIME FLUX · ⧗ {formatWhole(game.flux, notation)}</Text>
      <Text style={styles.blurb}>
        Offline time past your cap banks as Flux instead of vanishing.
      </Text>
      <View style={styles.fluxRow}>
        <Pressable
          style={[styles.fluxButton, game.flux.lt(BAL.timeflux.warp.cost) && styles.fluxLocked]}
          disabled={game.flux.lt(BAL.timeflux.warp.cost)}
          onPress={startWarp}
        >
          <Text style={styles.fluxTitle}>TIME WARP ×{BAL.timeflux.warp.mult}</Text>
          <Text style={styles.fluxSub}>
            ⧗ {formatWhole(BAL.timeflux.warp.cost, notation)} · {formatTime(BAL.timeflux.warp.seconds)}
            {game.warpRemaining > 0 ? ` · ${formatTime(game.warpRemaining)} left` : ''}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.fluxButton, game.flux.lt(BAL.timeflux.boost.cost) && styles.fluxLocked]}
          disabled={game.flux.lt(BAL.timeflux.boost.cost)}
          onPress={startFluxBoost}
        >
          <Text style={styles.fluxTitle}>SPARK ×{BAL.timeflux.boost.mult.toString()}</Text>
          <Text style={styles.fluxSub}>
            ⧗ {formatWhole(BAL.timeflux.boost.cost, notation)} · {formatTime(BAL.timeflux.boost.seconds)}
            {game.boostRemaining > 0 ? ` · ${formatTime(game.boostRemaining)} left` : ''}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  blurb: { color: palette.dim, fontSize: 11, lineHeight: 17, marginBottom: spacing.sm },
  section: {
    color: palette.dim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  fluxRow: { flexDirection: 'row', gap: spacing.sm },
  fluxButton: {
    flex: 1,
    backgroundColor: '#101c26',
    borderColor: palette.aeon,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
  },
  fluxLocked: { opacity: 0.45, borderColor: palette.line },
  fluxTitle: { color: palette.aeon, fontSize: 12, fontWeight: '800' },
  fluxSub: { color: palette.dim, fontSize: 10, marginTop: 2, textAlign: 'center', ...mono },
});
