import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CollectionScreen from './src/screens/CollectionScreen';
import MasterSetScreen from './src/screens/MasterSetScreen';
import SearchScreen from './src/screens/SearchScreen';
import { Pokeball } from './src/components/Pokeball';
import { colors } from './src/theme';
import { initDatabase } from './src/db/database';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
    notification: colors.primary,
  },
};

function HeaderTitle({ children }: { children: string }) {
  return (
    <View style={styles.headerTitleRow}>
      <Pokeball size={22} />
      <Text style={styles.headerTitleText}>{children}</Text>
    </View>
  );
}

export default function App() {
  useEffect(() => {
    initDatabase().catch(console.error);
  }, []);

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.bg,
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
            shadowOpacity: 0,
          },
          headerTitleAlign: 'left',
          headerTintColor: colors.text,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 64,
            paddingTop: 8,
            paddingBottom: 8,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tab.Screen
          name="Collection"
          component={CollectionScreen}
          options={{
            headerTitle: () => <HeaderTitle>POKÉLIST</HeaderTitle>,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="cards" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Search"
          component={SearchScreen}
          options={{
            headerTitle: () => <HeaderTitle>POKÉDEX SEARCH</HeaderTitle>,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="magnify" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Master Set"
          component={MasterSetScreen}
          options={{
            headerTitle: () => <HeaderTitle>MASTER SET</HeaderTitle>,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="format-list-checks" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitleText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
