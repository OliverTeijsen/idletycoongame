/** Motes tab: the Resonance branch (spec §6.4). */
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { BAL } from '../../game/balance';
import { format } from '../../game/numbers';
import { moteRate } from '../../game/systems/motes';
import { upgradeCost, upgradeMaxed } from '../../game/systems/upgrades';
import { useGameStore } from '../../state/store';
import { Row } from '../components/Row';
import { palette, spacing } from '../theme';

export function MotesScreen() {
  const game = useGameStore((s) => s.game);
  const buyMoteUpgrade = useGameStore((s) => s.buyMoteUpgrade);
  const notation = game.options.notation;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.blurb}>
        Motes ◦ drift off your Tier-1 orbiters ({format(moteRate(game), { notation, small: true })}
        /s). Spend them on resonance — permanent through Dimension Boosts.
      </Text>
      {BAL.motes.upgrades.map((u) => {
        const level = game.moteUpgrades[u.id] ?? 0;
        const maxed = upgradeMaxed(u, level);
        const cost = upgradeCost(u, level);
        return (
          <Row
            key={u.id}
            color={palette.mote}
            title={u.name}
            subtext={`${u.desc} · lvl ${level}`}
            costText={`◦ ${format(cost, { notation })}`}
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
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  blurb: { color: palette.dim, fontSize: 12, lineHeight: 18, marginBottom: spacing.md },
});
