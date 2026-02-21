import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants';
import {
  FactoryScreen,
  ArenaScreen,
  TreasuryScreen,
  ControlScreen,
  HistoryScreen,
  ReviewScreen,
  OthersScreen,
  PracticeScreen,
} from '../screens';

const Tab = createBottomTabNavigator();
const OthersStack = createStackNavigator();
const MainStack = createStackNavigator();

const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const icons: Record<string, string> = {
    Factory: '🏭',
    Arena: '⚔️',
    Treasury: '💎',
    Others: '📚',
    Control: '⚙️',
  };

  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.icon, focused && styles.iconFocused]}>
        {icons[name]}
      </Text>
    </View>
  );
};

const OthersStackScreen = () => {
  return (
    <OthersStack.Navigator screenOptions={{ headerShown: false }}>
      <OthersStack.Screen name="OthersMain" component={OthersScreen} />
      <OthersStack.Screen name="History" component={HistoryScreen} />
      <OthersStack.Screen name="Review" component={ReviewScreen} />
      <OthersStack.Screen name="Practice" component={PracticeScreen} />
    </OthersStack.Navigator>
  );
};

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Factory" component={FactoryScreen} />
      <Tab.Screen name="Arena" component={ArenaScreen} />
      <Tab.Screen name="Treasury" component={TreasuryScreen} />
      <Tab.Screen name="Others" component={OthersStackScreen} />
      <Tab.Screen name="Control" component={ControlScreen} />
    </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <MainStack.Navigator screenOptions={{ headerShown: false }}>
        <MainStack.Screen name="MainTabs" component={TabNavigator} />
      </MainStack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: 80,
    paddingBottom: 20,
    paddingTop: 10,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
    opacity: 0.6,
  },
  iconFocused: {
    opacity: 1,
  },
});
