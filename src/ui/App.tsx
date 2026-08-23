/**
 * App root: drives the fixed-timestep loop, autosave, background/resume
 * handling, and the progressive tab bar (spec §5, §11, §14).
 */
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { BAL } from '../game/balance';
import { createLoop } from '../game/loop';
import { format } from '../game/numbers';
import { automationUnlocked } from '../game/systems/automation';
import { motesUnlocked } from '../game/systems/motes';
import { collapseUnlocked } from '../game/systems/prestige';
import { starChartUnlocked } from '../game/systems/starchart';
import { useGameStore } from '../state/store';
import { OfflineModal } from './components/OfflineModal';
import { ResourceBar } from './components/ResourceBar';
import { AutoScreen } from './screens/AutoScreen';
import { CoreScreen } from './screens/CoreScreen';
import { MotesScreen } from './screens/MotesScreen';
import { OptionsScreen } from './screens/OptionsScreen';
import { PrestigeScreen } from './screens/PrestigeScreen';
import { StarChartScreen } from './screens/StarChartScreen';
import { MAX_CONTENT_WIDTH, palette, spacing } from './theme';

type TabId = 'core' | 'motes' | 'prestige' | 'chart' | 'auto' | 'options';

export default function App() {
  const [tab, setTab] = useState<TabId>('core');

  // Init once: load save, apply offline progress.
  useEffect(() => {
    useGameStore.getState().init();
  }, []);

  // The simulation loop. rAF on web and native (Expo provides it); the loop
  // itself is the accumulator from game/loop.ts, so rendering rate never
  // changes simulation results.
  useEffect(() => {
    const loop = createLoop((dt) => useGameStore.getState().tick(dt));
    let raf = 0;
    const frame = (t: number) => {
      loop.advance(t);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Autosave every 10s + on background/blur.
  useEffect(() => {
    const interval = setInterval(() => useGameStore.getState().save(), BAL.autosaveSeconds * 1000);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') useGameStore.getState().save();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  const game = useGameStore((s) => s.game);
  const showMotes = motesUnlocked(game);
  const showPrestige = collapseUnlocked(game);
  const showChart = starChartUnlocked(game);
  const showAuto = automationUnlocked(game);

  // A tab can disappear on hard reset — fall back to Core.
  const activeTab: TabId =
    (tab === 'motes' && !showMotes) ||
    (tab === 'prestige' && !showPrestige) ||
    (tab === 'chart' && !showChart) ||
    (tab === 'auto' && !showAuto)
      ? 'core'
      : tab;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={styles.column}>
          <ResourceBar />
          <View style={styles.content}>
            {activeTab === 'core' && <CoreScreen />}
            {activeTab === 'motes' && <MotesScreen />}
            {activeTab === 'prestige' && <PrestigeScreen />}
            {activeTab === 'chart' && <StarChartScreen />}
            {activeTab === 'auto' && <AutoScreen />}
            {activeTab === 'options' && <OptionsScreen />}
          </View>
          <View style={styles.tabBar}>
            <Tab label="CORE" active={activeTab === 'core'} onPress={() => setTab('core')} />
            {showMotes && <Tab label="MOTES" active={activeTab === 'motes'} onPress={() => setTab('motes')} />}
            {showPrestige ? (
              <Tab label="PRESTIGE" active={activeTab === 'prestige'} onPress={() => setTab('prestige')} />
            ) : (
              <Tab label="COLLAPSE" locked lockHint={`✦ ${format(BAL.collapse.unlockSpark)}`} />
            )}
            {showChart && <Tab label="CHART" active={activeTab === 'chart'} onPress={() => setTab('chart')} />}
            {showAuto && <Tab label="AUTO" active={activeTab === 'auto'} onPress={() => setTab('auto')} />}
            <Tab label="OPTIONS" active={activeTab === 'options'} onPress={() => setTab('options')} />
          </View>
        </View>
        <OfflineModal />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Tab({
  label,
  active,
  locked,
  lockHint,
  onPress,
}: {
  label: string;
  active?: boolean;
  locked?: boolean;
  lockHint?: string;
  onPress?(): void;
}) {
  return (
    <Pressable style={styles.tab} onPress={onPress} disabled={locked}>
      <Text style={[styles.tabText, active && styles.tabActive, locked && styles.tabLocked]}>
        {locked ? `🔒 ${label}` : label}
      </Text>
      {locked && lockHint && <Text style={styles.lockHint}>{lockHint}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgDeep },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    backgroundColor: palette.bg,
  },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: palette.line,
    backgroundColor: palette.bgDeep,
    paddingVertical: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  tabText: { color: palette.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  tabActive: { color: palette.core },
  tabLocked: { opacity: 0.5 },
  lockHint: { color: palette.dim, fontSize: 9, marginTop: 1, opacity: 0.7 },
});
