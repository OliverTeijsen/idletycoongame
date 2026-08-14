import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

import { BUSINESSES } from '../core/businesses';
import { useGameStore } from '../store/gameStore';
import { BottomBar } from './components/BottomBar';
import { BusinessRow } from './components/BusinessRow';
import { BuyAmountToggle } from './components/BuyAmountToggle';
import { AchievementsModal } from './components/AchievementsModal';
import { OfflineModal } from './components/OfflineModal';
import { PrestigeModal } from './components/PrestigeModal';
import { StreakModal } from './components/StreakModal';
import { TopBar } from './components/TopBar';
import { AchievementToast } from './juice/AchievementToast';
import { FloatingPayouts } from './juice/FloatingPayouts';
import { GoldenFries } from './juice/GoldenFries';
import { colors, spacing, type } from './theme';

/** Simulation tick. 100ms is smooth for progress bars and cheap on battery. */
const TICK_MS = 100;

export default function App(): React.JSX.Element {
  const hydrated = useGameStore((s) => s.hydrated);
  const hydrate = useGameStore((s) => s.hydrate);
  const tick = useGameStore((s) => s.tick);
  const onBackground = useGameStore((s) => s.onBackground);
  const onForeground = useGameStore((s) => s.onForeground);

  const lastTick = useRef(Date.now());

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Simulation loop. React Native pauses timers in the background, so long
  // absences are paid by the offline calculation instead — see the AppState
  // handler below, which re-anchors `lastTick` so the gap is never paid twice.
  useEffect(() => {
    lastTick.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTick.current) / 1000;
      lastTick.current = now;
      tick(dt);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [tick]);

  useEffect(() => {
    const handler = (next: AppStateStatus) => {
      if (next === 'active') {
        lastTick.current = Date.now();
        onForeground();
      } else {
        onBackground();
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [onBackground, onForeground]);

  // initialMetrics avoids a blank first frame while insets are measured.
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {hydrated ? (
          <>
            <TopBar />
            <BuyAmountToggle />
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {BUSINESSES.map((def) => (
                <BusinessRow key={def.id} id={def.id} />
              ))}
            </ScrollView>
            <BottomBar />
            {/* Overlays last so they paint above the list without affecting layout. */}
            <FloatingPayouts />
            <GoldenFries />
            <AchievementToast />
            {/* StreakModal holds itself back while the offline payout is up. */}
            <OfflineModal />
            <StreakModal />
            <PrestigeModal />
            <AchievementsModal />
          </>
        ) : (
          <View style={styles.loading}>
            <Text style={type.title}>🍟</Text>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
