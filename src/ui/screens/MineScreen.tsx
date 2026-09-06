/** Mine tab (spec §8.3, §8.6): Miners, the Research tree and Time Flux. */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BAL } from '../../game/balance';
import { format, formatTime, formatWhole } from '../../game/numbers';
import {
  minerCost,
  minerCount,
  oreRate,
  researchGridCost,
  researchGridLevel,
  researchOwned,
} from '../../game/systems/minerals';
import { oreMult } from '../../game/systems/multipliers';
import { useGameStore } from '../../state/store';
import { Row } from '../components/Row';
import { SectionHeader } from '../components/Panel';
import { LAYERS, mono, palette, radius, spacing, type } from '../theme';

export function MineScreen() {
  const game = useGameStore((s) => s.game);
  const buyMiner = useGameStore((s) => s.buyMiner);
  const buyResearch = useGameStore((s) => s.buyResearch);
  const buyResearchGrid = useGameStore((s) => s.buyResearchGrid);
  const startWarp = useGameStore((s) => s.startWarp);
  const startFluxBoost = useGameStore((s) => s.startFluxBoost);
  const notation = game.options.notation;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.blurb}>
        Miners chew Ore out of the dark at {format(oreRate(game), { notation, small: true })} per
        second. Ore and miners survive Collapse, Ascend AND Converge — this is the slow lane, and
        it is the only one that never gets wiped short of a Unify.
      </Text>
      {/*
        The lifetime-Ore multiplier, stated plainly. It is the answer to "what
        is mining actually FOR", and a player who cannot see it will (rightly)
        conclude the lane is decoration.
      */}
      <View style={styles.oreMult}>
        <Text style={styles.oreMultLabel}>All production, from Ore mined</Text>
        <Text style={styles.oreMultValue}>×{format(oreMult(game), { notation })}</Text>
      </View>

      <SectionHeader label="Miners" accent={palette.ore} />
      {BAL.miners.map((def) => {
        const count = minerCount(game, def.id);
        const cost = minerCost(game, def.id);
        return (
          <Row
            key={def.id}
            color={palette.ore}
            title={def.name}
            subtext={`${LAYERS.ore.glyph} ${format(def.orePerSec, { small: true })}/s each · owned ${count}`}
            costText={`${LAYERS.spark.glyph} ${format(cost, { notation })}`}
            affordable={game.spark.gte(cost)}
            onBuy={() => buyMiner(def.id)}
          />
        );
      })}

      <SectionHeader
        label="Research"
        accent={palette.ore}
        trailing={
          <Text style={styles.balance}>
            {LAYERS.ore.glyph} {formatWhole(game.ore, notation)}
          </Text>
        }
      />
      {BAL.research.map((def) => {
        const owned = researchOwned(game, def.id);
        return (
          <Row
            key={def.id}
            color={palette.aeon}
            title={def.name}
            subtext={def.desc}
            costText={`${LAYERS.ore.glyph} ${formatWhole(def.cost, notation)}`}
            affordable={game.ore.gte(def.cost)}
            maxed={owned}
            onBuy={() => buyResearch(def.id)}
          />
        );
      })}

      {BAL.researchGrid.map((def) => {
        const level = researchGridLevel(game, def.id);
        const cost = researchGridCost(game, def.id);
        return (
          <Row
            key={def.id}
            color={palette.ore}
            title={def.name}
            subtext={`${def.desc} · level ${level}`}
            costText={`${LAYERS.ore.glyph} ${formatWhole(cost, notation)}`}
            affordable={game.ore.gte(cost)}
            onBuy={() => buyResearchGrid(def.id)}
          />
        );
      })}

      <SectionHeader
        label="Time flux"
        accent={palette.aeon}
        trailing={
          <Text style={[styles.balance, { color: palette.aeon }]}>
            ⧗ {formatWhole(game.flux, notation)}
          </Text>
        }
      />
      <Text style={styles.blurb}>
        Offline time past your cap banks as Flux, and a slow trickle arrives while you play.
      </Text>
      <View style={styles.fluxRow}>
        <Pressable
          style={[styles.fluxButton, game.flux.lt(BAL.timeflux.warp.cost) && styles.fluxLocked]}
          disabled={game.flux.lt(BAL.timeflux.warp.cost)}
          onPress={startWarp}
        >
          <Text style={styles.fluxTitle}>Time warp ×{BAL.timeflux.warp.mult}</Text>
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
          <Text style={styles.fluxTitle}>Spark ×{BAL.timeflux.boost.mult.toString()}</Text>
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
  scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl * 2 },
  blurb: { ...type.body, color: palette.dim },
  oreMult: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.line,
    paddingVertical: spacing.sm,
  },
  oreMultLabel: { ...type.label, color: palette.faint },
  oreMultValue: { ...type.figure, fontSize: 15, color: palette.ore },
  balance: { ...type.figure, fontSize: 14, color: palette.ore },
  fluxRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  fluxButton: {
    flex: 1,
    backgroundColor: palette.panel,
    borderColor: palette.aeon,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  fluxLocked: { opacity: 0.4, borderColor: palette.line, backgroundColor: palette.bg },
  fluxTitle: { ...type.label, fontSize: 11, color: palette.aeon },
  fluxSub: { ...type.micro, ...mono, color: palette.dim, marginTop: 4, textAlign: 'center' },
});
