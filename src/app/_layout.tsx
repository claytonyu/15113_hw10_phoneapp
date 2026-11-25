// Root navigation for the map, journal, and entry screens.
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '@/constants/field-notes-theme';
import { JournalProvider } from '@/lib/journal-provider';

/** Provides a native stack and shares one journal across its routes. */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <JournalProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.paper },
        }}>
          <Stack.Screen name="index" options={{ title: 'Field Notes' }} />
          <Stack.Screen name="all-notes" options={{ title: 'All Notes' }} />
          <Stack.Screen name="note" options={{ title: 'New note' }} />
          <Stack.Screen name="camera" options={{ title: 'Camera' }} />
          <Stack.Screen name="photo" options={{ title: 'Photo' }} />
        </Stack>
      </JournalProvider>
    </GestureHandlerRootView>
  );
}
