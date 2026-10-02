import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Pressable,
  Animated,
  Image,
  ScrollView,
  Share,
  Alert,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../lib/auth-context";
import { Body, Muted } from "./ui";
import { colors, space } from "../lib/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PANEL_WIDTH = Math.min(300, SCREEN_WIDTH * 0.82);

export function initials(name: string, email: string) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

type NavItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

// A lightweight, custom slide-in drawer (Modal + Animated, no extra nav
// library) opened from the DP icon on Home - the "hamburger from your
// avatar" pattern apps like Flo use for account-level settings that don't
// belong in the bottom tab bar.
export default function SideNav({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { profile, signOut } = useAuth();
  const translateX = useRef(new Animated.Value(-PANEL_WIDTH)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -PANEL_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, translateX]);

  const name = profile?.name || "";
  const email = profile?.email || "";

  const go = (path: string) => {
    onClose();
    router.push(path as any);
  };

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          onClose();
          await signOut();
          router.replace("/login");
        },
      },
    ]);
  };

  const handleReferFriend = async () => {
    try {
      await Share.share({
        message:
          "I've been using Aura to track my cycle, habits and PCOD-friendly diet - thought you'd like it too!",
      });
    } catch {
      // share sheet dismissed - nothing to do
    }
  };

  const handleAppUpdate = () => {
    Alert.alert("You're up to date", "Aura v1.0.0 - this is the latest version.");
  };

  const items: NavItem[] = [
    { key: "profile", label: "Profile", icon: "person-outline", onPress: () => go("/(tabs)/profile") },
    { key: "update", label: "App update", icon: "refresh-outline", onPress: handleAppUpdate },
    {
      key: "notifications",
      label: "Notifications",
      icon: "notifications-outline",
      onPress: () => go("/settings/notifications"),
    },
    { key: "reminders", label: "Reminders", icon: "alarm-outline", onPress: () => go("/settings/reminders") },
    { key: "refer", label: "Refer a friend", icon: "gift-outline", onPress: handleReferFriend },
    { key: "privacy", label: "Privacy policy", icon: "shield-checkmark-outline", onPress: () => go("/info/privacy") },
    { key: "help", label: "Help", icon: "help-circle-outline", onPress: () => go("/info/help") },
    { key: "about", label: "About Aura", icon: "information-circle-outline", onPress: () => go("/info/about") },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.panel, { transform: [{ translateX }] }]}>
          <ScrollView contentContainerStyle={{ paddingBottom: space.xl }} showsVerticalScrollIndicator={false}>
            <View style={styles.identity}>
              {profile?.profile_picture ? (
                <Image source={{ uri: profile.profile_picture }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Body style={{ fontFamily: "Manrope_700Bold", fontSize: 18, color: colors.primary }}>
                    {initials(name, email)}
                  </Body>
                </View>
              )}
              <View style={{ marginLeft: space.sm, flex: 1 }}>
                <Body style={{ fontFamily: "Manrope_700Bold", fontSize: 15 }} numberOfLines={1}>
                  {name || "Your profile"}
                </Body>
                <Muted style={{ fontSize: 12 }} numberOfLines={1}>
                  {email || profile?.phone || ""}
                </Muted>
              </View>
            </View>

            <View style={styles.divider} />

            <View>
              {items.map((item) => (
                <Pressable key={item.key} style={styles.row} onPress={item.onPress}>
                  <Ionicons name={item.icon} size={19} color={colors.ink} style={{ width: 26 }} />
                  <Body style={{ fontSize: 14.5 }}>{item.label}</Body>
                </Pressable>
              ))}
            </View>

            <View style={styles.divider} />

            <Pressable style={styles.row} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={19} color={colors.notice} style={{ width: 26 }} />
              <Body style={{ fontSize: 14.5, color: colors.notice }}>Logout</Body>
            </Pressable>

            <Muted style={{ fontSize: 10.5, textAlign: "center", marginTop: space.lg }}>Aura v1.0.0</Muted>
          </ScrollView>
        </Animated.View>

        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(58, 31, 38, 0.45)",
  },
  panel: {
    width: PANEL_WIDTH,
    backgroundColor: colors.surface,
    paddingTop: space.xxl,
    paddingHorizontal: space.lg,
    height: "100%",
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceSunken,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 10,
  },
});
