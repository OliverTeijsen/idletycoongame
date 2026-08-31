/** Motes tab: the Resonance branch (spec §6.4). */
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { BAL } from '../../game/balance';
import { format } from '../../game/numbers';
import { moteRate } from '../../game/systems/motes';
import { upgradeCost, upgradeMaxed } from '../../game/systems/upgrades';
import { useGameStore } from '../../state/store';
import { Row } from '../components/Row';
import { SectionHeader } from '../components/Panel';
import { LAYERS, palette, spacing, type } from '../theme';

export function MotesScreen() {
  const game = useGameStore((s) => s.game);
  const buyMoteUpgrade = useGameStore((s) => s.buyMoteUpgrade);
  const notation = game.options.notation;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.blurb}>
        Motes drift off your Tier-1 orbiters at{' '}
        {format(moteRate(game), { notation, small: true })} per second. Spend them on resonance;
        it survives every Dimension Boost.
      </Text>
      <SectionHeader label="Resonance" accent={palette.mote} />
      {BAL.motes.upgrades.map((u) => {
        const level = game.moteUpgrades[u.id] ?? 0;
        const maxed = upgradeMaxed(u, level);
        const cost = upgradeCost(u, level);
        return (
          <Row
            key={u.id}
            color={palette.mote}
            title={u.name}
            subtext={`${u.desc} · level ${level}`}
            costText={`${LAYERS.mote.glyph} ${format(cost, { notation })}`}
            affordable={game.motes.gte(cost)}
            maxed={maxed}
            onBuy={() => buyMoteUpgrade(u.id)}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl * 2 },
  blurb: { ...type.body, color: palette.dim },
});
